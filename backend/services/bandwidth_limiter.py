"""
Bandwidth limiting service for Roost.

True per-packet throttling requires routing traffic through this machine
(man-in-the-middle mode) or a router API.

Instead we use a practical enforcement strategy:
  - Bandwidth limits are stored in device.bandwidth_limit_kbps
  - usage_aggregator checks usage every 60s against the stored limit
  - If a device exceeds its limit in a 60s window, it is auto-blocked
    for BLOCK_DURATION_SECONDS to reduce average throughput
  - This gives coarse but effective rate control without router API

Windows QoS (New-NetQosPolicy) is also attempted for traffic TO/FROM
this machine, but only affects traffic that passes through our host.
"""
import logging
import subprocess

logger = logging.getLogger("roost.bandwidth_limiter")

# How many seconds to block a device that blew its bandwidth budget
BLOCK_DURATION_SECONDS = 30

# Track devices auto-blocked by bandwidth enforcement so we can unblock them
_auto_blocked: dict[str, float] = {}  # mac → time_blocked


def set_bandwidth_limit(ip_address: str, limit_kbps: int) -> bool:
    """
    Set bandwidth limit for a device.
    limit_kbps=0 means unlimited (remove any existing enforcement).
    Returns True; actual enforcement happens in usage_aggregator.
    """
    if limit_kbps == 0:
        return _remove_limit(ip_address)

    logger.info(
        f"Bandwidth limit {limit_kbps} kbps set for {ip_address} — "
        f"enforcement via auto-block when 60s window is exceeded."
    )
    # Also try Windows QoS for traffic to/from this machine
    _apply_qos_policy(ip_address, limit_kbps)
    return True


def _remove_limit(ip_address: str) -> bool:
    logger.info(f"Bandwidth limit removed for {ip_address}")
    _remove_qos_policy(ip_address)
    return True


def _apply_qos_policy(ip_address: str, limit_kbps: int) -> None:
    """
    Apply a Windows QoS policy to rate-limit traffic to/from this IP.
    Only affects connections where this machine is an endpoint.
    Silently skips if not running as Administrator.
    """
    name = f"Roost_{ip_address.replace('.', '_')}"
    bps = limit_kbps * 1000  # kbps → bps
    cmd = (
        f"New-NetQosPolicy -Name '{name}' "
        f"-IPSrcAddressPrefix {ip_address}/32 "
        f"-ThrottleRateActionBitsPerSecond {bps} "
        f"-PolicyStore ActiveStore -ErrorAction SilentlyContinue"
    )
    try:
        subprocess.run(
            ["powershell", "-NoProfile", "-Command", cmd],
            capture_output=True, timeout=5
        )
    except Exception:
        pass  # Not admin or QoS unavailable — enforcement falls back to auto-block


def _remove_qos_policy(ip_address: str) -> None:
    name = f"Roost_{ip_address.replace('.', '_')}"
    cmd = f"Remove-NetQosPolicy -Name '{name}' -Confirm:$false -ErrorAction SilentlyContinue"
    try:
        subprocess.run(
            ["powershell", "-NoProfile", "-Command", cmd],
            capture_output=True, timeout=5
        )
    except Exception:
        pass


async def enforce_bandwidth_limits(ip_to_device_id: dict, byte_counters: dict) -> None:
    """
    Called by usage_aggregator after each flush.
    Checks if any device exceeded its bandwidth_limit_kbps over the last 60s window.
    If so, temporarily blocks the device to enforce the limit.
    """
    import asyncio
    import time

    if not byte_counters:
        return

    try:
        from backend.database.engine import AsyncSessionLocal
        from backend.database.models.device import Device
        from sqlalchemy import select

        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Device).where(
                    Device.bandwidth_limit_kbps > 0,
                    Device.is_online == True,
                    Device.is_protected == False,
                )
            )
            limited_devices = result.scalars().all()

        now = time.time()

        # Unblock devices whose block period has expired
        for mac, block_time in list(_auto_blocked.items()):
            if now - block_time >= BLOCK_DURATION_SECONDS:
                try:
                    from backend.services.arp_spoofer import stop_spoof
                    mac_snap = mac
                    await asyncio.get_running_loop().run_in_executor(
                        None, lambda: stop_spoof(mac_snap)
                    )
                    _auto_blocked.pop(mac, None)
                    logger.info(f"Bandwidth auto-unblock: {mac}")
                    # Update DB
                    async with AsyncSessionLocal() as session:
                        res = await session.execute(select(Device).where(Device.mac_address == mac))
                        dev = res.scalar_one_or_none()
                        if dev:
                            dev.is_blocked = False
                            await session.commit()
                except Exception as e:
                    logger.error(f"Bandwidth auto-unblock failed for {mac}: {e}")

        # Check each limited device's 60s usage
        for dev in limited_devices:
            if dev.mac_address in _auto_blocked:
                continue  # Already blocked this cycle
            if not dev.ip_address:
                continue

            counters = byte_counters.get(dev.ip_address)
            if not counters:
                continue

            sent, recv = counters
            total_bytes = sent + recv
            total_kbps = (total_bytes * 8) / (60 * 1000)  # bits/s → kbps over 60s window

            if total_kbps > dev.bandwidth_limit_kbps:
                logger.info(
                    f"Bandwidth limit exceeded: {dev.display_name} @ {dev.ip_address} "
                    f"used {total_kbps:.0f} kbps, limit={dev.bandwidth_limit_kbps} kbps — auto-blocking {BLOCK_DURATION_SECONDS}s"
                )
                try:
                    from backend.services.arp_spoofer import start_spoof
                    loop = asyncio.get_running_loop()
                    ip_snap, mac_snap = dev.ip_address, dev.mac_address
                    await loop.run_in_executor(None, lambda: start_spoof(ip_snap, mac_snap))
                    _auto_blocked[dev.mac_address] = now
                    # Update DB
                    async with AsyncSessionLocal() as session:
                        res = await session.execute(select(Device).where(Device.id == dev.id))
                        d = res.scalar_one_or_none()
                        if d:
                            d.is_blocked = True
                            await session.commit()
                    from backend.database.models.alert import create_alert
                    await create_alert(
                        type="bandwidth_exceeded",
                        severity="warning",
                        title="Bandwidth Limit Exceeded",
                        message=(
                            f"{dev.display_name} ({dev.ip_address}) used "
                            f"{total_kbps:.0f} kbps, exceeding its {dev.bandwidth_limit_kbps} kbps limit. "
                            f"Blocked for {BLOCK_DURATION_SECONDS}s."
                        ),
                        device_id=dev.id,
                    )
                except Exception as e:
                    logger.error(f"Bandwidth auto-block failed for {dev.display_name}: {e}")

    except Exception as e:
        logger.error(f"enforce_bandwidth_limits error: {e}")
