"""
Bandwidth limiting service for Roost.

True per-packet throttling requires routing traffic through this machine
(man-in-the-middle mode) or a router API.

Instead we use a practical enforcement strategy:
  - Bandwidth limits are stored in device.bandwidth_limit_kbps
  - usage_aggregator calls enforce_bandwidth_limits() every flush window (60s)
    with the raw byte counters captured during that window
  - If a device's average throughput over the window exceeds its limit, it is
    auto-blocked (ARP-spoofed) for BLOCK_DURATION_SECONDS. While blocked it
    sends/receives nothing, which drags its *average* throughput back down
    under the cap. This is coarse (bursty, not a smooth token bucket) but it
    genuinely caps sustained throughput without a router/MITM proxy.
  - After the cooldown the device is automatically unblocked and re-measured.

Windows QoS (New-NetQosPolicy) is also attempted as a best-effort smooth
throttle, but it only affects traffic where THIS machine is an endpoint and
requires Administrator. It is not the primary enforcement mechanism.

Enforcement guarantees:
  * A device with a limit > 0 that sustains traffic above the limit WILL be
    blocked within one flush window and stay blocked for BLOCK_DURATION_SECONDS.
  * Protected devices (is_protected) are never auto-blocked.
  * Devices the user has *manually* blocked are never auto-unblocked by this
    service (we only ever unblock what we ourselves auto-blocked).
  * A limit of 0 means unlimited and removes any host QoS policy.
"""
import logging
import subprocess

logger = logging.getLogger("roost.bandwidth_limiter")

# How many seconds to block a device that blew its bandwidth budget. Keeping it
# short keeps the average-throughput control responsive instead of a hard cut.
BLOCK_DURATION_SECONDS = 30

# The flush window length the aggregator measures over (seconds). Must match the
# usage_aggregator scheduler interval so the bytes->kbps conversion is accurate.
WINDOW_SECONDS = 60

# Track devices auto-blocked by bandwidth enforcement so we can later unblock
# them. mac (DB value) -> epoch time blocked. Only entries WE created live here,
# which is what protects manually-blocked devices from being auto-unblocked.
_auto_blocked: dict[str, float] = {}  # mac → time_blocked


def set_bandwidth_limit(ip_address: str, limit_kbps: int) -> bool:
    """
    Set bandwidth limit for a device.
    limit_kbps=0 means unlimited (remove any existing enforcement).
    Returns True; the primary enforcement happens in enforce_bandwidth_limits.
    """
    if limit_kbps <= 0:
        return _remove_limit(ip_address)

    logger.info(
        f"Bandwidth limit {limit_kbps} kbps set for {ip_address} — "
        f"enforcement via auto-block when the {WINDOW_SECONDS}s window is exceeded."
    )
    # Best-effort smooth throttle for traffic to/from this host (needs admin).
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
    Replaces any prior policy for the IP first so the rate actually updates.
    Silently skips if not running as Administrator.
    """
    name = f"Roost_{ip_address.replace('.', '_')}"
    # kbps -> bits/sec. 1 kbit = 1000 bit, so multiply by 1000.
    bps = limit_kbps * 1000
    # Remove any existing policy of the same name first; New-NetQosPolicy errors
    # if the name already exists, which would silently keep the old (wrong) rate.
    cmd = (
        f"Remove-NetQosPolicy -Name '{name}' -Confirm:$false "
        f"-PolicyStore ActiveStore -ErrorAction SilentlyContinue; "
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
    cmd = (
        f"Remove-NetQosPolicy -Name '{name}' -Confirm:$false "
        f"-PolicyStore ActiveStore -ErrorAction SilentlyContinue"
    )
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

    Two phases:
      1. Unblock any device whose auto-block cooldown has expired.
      2. For each online, non-protected device with a limit > 0, compute its
         average throughput over the window and auto-block it if it exceeded
         the cap.

    `byte_counters` is dict[ip_str, [bytes_sent, bytes_recv]] for the window.
    """
    import asyncio
    import time

    try:
        from backend.database.engine import AsyncSessionLocal
        from backend.database.models.device import Device
        from sqlalchemy import select

        now = time.time()

        # ── Phase 1: unblock devices whose cooldown expired ──────────────────
        # We only ever touch devices that WE auto-blocked (tracked in
        # _auto_blocked), so a device the user manually blocked is never freed.
        for mac, block_time in list(_auto_blocked.items()):
            if now - block_time < BLOCK_DURATION_SECONDS:
                continue
            try:
                from backend.services.arp_spoofer import stop_spoof
                mac_snap = mac
                await asyncio.get_running_loop().run_in_executor(
                    None, lambda: stop_spoof(mac_snap)
                )
                _auto_blocked.pop(mac, None)
                logger.info(f"Bandwidth auto-unblock: {mac}")
                async with AsyncSessionLocal() as session:
                    res = await session.execute(
                        select(Device).where(Device.mac_address == mac)
                    )
                    dev = res.scalar_one_or_none()
                    if dev:
                        dev.is_blocked = False
                        await session.commit()
            except Exception as e:
                # Drop the tracking entry so we don't get stuck retrying a
                # device that can no longer be unblocked.
                _auto_blocked.pop(mac, None)
                logger.error(f"Bandwidth auto-unblock failed for {mac}: {e}")

        if not byte_counters:
            return

        # ── Phase 2: measure + block over-limit devices ─────────────────────
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Device).where(
                    Device.bandwidth_limit_kbps > 0,
                    Device.is_online == True,
                    Device.is_protected == False,
                )
            )
            limited_devices = result.scalars().all()

        for dev in limited_devices:
            if dev.mac_address in _auto_blocked:
                continue  # We already blocked it; leave it for the cooldown.
            if dev.is_blocked:
                continue  # Manually blocked by the user — don't interfere.
            if not dev.ip_address:
                continue

            counters = byte_counters.get(dev.ip_address)
            if not counters:
                continue

            sent, recv = counters
            total_bytes = sent + recv
            # bytes over the window -> average kbps.
            #   bits          = total_bytes * 8
            #   bits/sec      = bits / WINDOW_SECONDS
            #   kbps          = bits/sec / 1000
            total_kbps = (total_bytes * 8) / (WINDOW_SECONDS * 1000)

            if total_kbps <= dev.bandwidth_limit_kbps:
                continue

            logger.info(
                f"Bandwidth limit exceeded: {dev.display_name} @ {dev.ip_address} "
                f"used {total_kbps:.0f} kbps, limit={dev.bandwidth_limit_kbps} kbps "
                f"— auto-blocking {BLOCK_DURATION_SECONDS}s"
            )
            try:
                from backend.services.arp_spoofer import start_spoof
                loop = asyncio.get_running_loop()
                ip_snap, mac_snap = dev.ip_address, dev.mac_address
                spoof_ok = await loop.run_in_executor(
                    None, lambda: start_spoof(ip_snap, mac_snap)
                )
                if not spoof_ok:
                    # Couldn't actually block (no admin / Npcap). Don't record a
                    # phantom block we'd later try to "unblock".
                    logger.warning(
                        f"Bandwidth auto-block could not start ARP spoof for "
                        f"{dev.display_name} — limit not enforced this window."
                    )
                    continue

                _auto_blocked[dev.mac_address] = now
                async with AsyncSessionLocal() as session:
                    res = await session.execute(
                        select(Device).where(Device.id == dev.id)
                    )
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
                        f"{total_kbps:.0f} kbps, exceeding its "
                        f"{dev.bandwidth_limit_kbps} kbps limit. "
                        f"Blocked for {BLOCK_DURATION_SECONDS}s."
                    ),
                    device_id=dev.id,
                )
            except Exception as e:
                logger.error(
                    f"Bandwidth auto-block failed for {dev.display_name}: {e}"
                )

    except Exception as e:
        logger.error(f"enforce_bandwidth_limits error: {e}")
