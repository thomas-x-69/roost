"""
Periodic ARP scan task — runs every 30 seconds via APScheduler.
Upserts discovered devices into the database.
"""
import asyncio
import logging
from datetime import datetime, timezone
from sqlalchemy import select
from backend.database.engine import AsyncSessionLocal
from backend.database.models.device import Device
from backend.services.arp_scanner import arp_scan
from backend.services.network_info import get_network_info, get_all_own_ips, get_all_own_macs
from backend.services.oui_resolver import resolve_vendor
from backend.services.device_classifier import classify_device
from backend.utils.mac_utils import normalize_mac

logger = logging.getLogger("roost.scan_task")


async def _fire_new_device_alert(name: str, ip: str, mac: str) -> None:
    from backend.database.models.alert import create_alert
    await create_alert(
        type="new_device",
        severity="info",
        title="New Device Detected",
        message=f"{name} joined the network at {ip} ({mac})",
    )

# Track which MACs were online in the last scan
_last_online: set[str] = set()

# Grace-period counter: how many consecutive scans a device has been absent.
# A device is only marked offline after OFFLINE_GRACE_SCANS misses in a row.
# This prevents devices in WiFi power-save mode from flickering offline.
#
# RELIABILITY FIX: the previous value of 2 (~60s) was too small — a power-save
# device that happened to miss two scans in a row (now made far less likely by
# the multi-round ARP scan, but still possible) would wrongly flip to OFFLINE.
# At the 30s scan interval, 4 consecutive misses means a device is only marked
# offline after ~120s (4 * 30s) of total silence, which reliably distinguishes
# a genuinely-departed device from a momentarily-quiet one. Any single answered
# scan resets the counter immediately (see below), so a device that responds at
# all stays online.
_missed_scans: dict[str, int] = {}
OFFLINE_GRACE_SCANS = 4  # mark offline only after 4 consecutive misses (~120s @ 30s interval)


async def run_scan():
    """Main scan job — called by APScheduler every 30s."""
    try:
        net = get_network_info()
        own_ips = get_all_own_ips()    # ALL IPs of this machine
        own_macs = get_all_own_macs()  # ALL MACs of this machine

        # Run the synchronous Scapy scan in a thread pool so we don't block
        # the async event loop (and cause APScheduler to miss other jobs).
        loop = asyncio.get_running_loop()
        devices = await loop.run_in_executor(
            None,
            lambda: arp_scan(
                net.network_cidr,
                net.interface,
                own_ip=net.own_ip,
                own_mac=net.own_mac,
                timeout=3.0,          # 3s ARP window — captures slow power-save devices
            ),
        )

        if not devices:
            logger.debug("Scan returned 0 devices (network unreachable or no Npcap?)")
            return

        current_macs = {d.mac for d in devices}

        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Device))
            existing = {d.mac_address: d for d in result.scalars().all()}

            now = datetime.now(timezone.utc)
            changed = False  # whether to push a live refresh to clients

            for scanned in devices:
                mac = scanned.mac
                ip = scanned.ip
                hostname = scanned.hostname
                vendor = resolve_vendor(mac)
                device_type, icon_key = classify_device(vendor, hostname)

                # Reset grace counter — device is present
                _missed_scans.pop(mac, None)

                # Protect: gateway, any IP on this machine, any MAC on this machine
                is_own = ip in own_ips or mac in own_macs
                should_protect = ip == net.gateway_ip or is_own

                if mac in existing:
                    dev = existing[mac]
                    if not dev.is_online:
                        changed = True  # device came back online
                    dev.ip_address = ip
                    dev.is_online = True
                    dev.last_seen = now
                    if hostname and not dev.hostname:
                        dev.hostname = hostname
                    if vendor and dev.vendor == "Unknown":
                        dev.vendor = vendor
                    if should_protect:
                        dev.is_protected = True
                        # Safety: unblock immediately if it was somehow blocked
                        if dev.is_blocked:
                            dev.is_blocked = False
                            logger.warning(f"Force-unblocked own/gateway device {mac} @ {ip}")
                else:
                    dev = Device(
                        mac_address=mac,
                        ip_address=ip,
                        hostname=hostname,
                        vendor=vendor,
                        device_type=device_type,
                        icon_key=icon_key,
                        is_online=True,
                        is_protected=should_protect,
                        first_seen=now,
                        last_seen=now,
                    )
                    session.add(dev)
                    changed = True
                    logger.info(f"New device: {mac} @ {ip} ({vendor}){' [PROTECTED]' if should_protect else ''}")
                    if not should_protect:
                        # Build a friendly name for the alert
                        _name = hostname or vendor or mac
                        asyncio.ensure_future(
                            _fire_new_device_alert(_name, ip, mac)
                        )

            # Grace-period offline logic: only mark offline after N consecutive misses
            for mac, dev in existing.items():
                if mac not in current_macs and dev.is_online:
                    _missed_scans[mac] = _missed_scans.get(mac, 0) + 1
                    if _missed_scans[mac] >= OFFLINE_GRACE_SCANS:
                        dev.is_online = False
                        _missed_scans.pop(mac, None)
                        changed = True
                        logger.debug(f"Device offline (missed {OFFLINE_GRACE_SCANS} scans): {mac}")

            await session.commit()

        # Push a live refresh to connected clients when the device set changed.
        if changed:
            try:
                from backend.websocket.manager import manager
                from backend.websocket import events
                await manager.broadcast(events.DEVICES_REFRESH, {})
            except Exception as e:
                logger.debug(f"devices:refresh broadcast failed: {e}")

        _last_online.clear()
        _last_online.update(current_macs)

    except Exception as e:
        logger.error(f"Scan task error: {e}", exc_info=True)
