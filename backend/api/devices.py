from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from backend.database.engine import get_db
from backend.database.models.device import Device
from backend.tasks.scan_task import run_scan
import logging

router = APIRouter(prefix="/devices", tags=["devices"])
logger = logging.getLogger("roost.api.devices")


class DeviceUpdate(BaseModel):
    custom_name: Optional[str] = None
    icon_key: Optional[str] = None
    notes: Optional[str] = None
    is_protected: Optional[bool] = None


class BandwidthLimitBody(BaseModel):
    limit_kbps: int = Field(0, ge=0, le=10_000_000)

_scan_in_progress = False


def device_to_dict(d: Device) -> dict:
    return {
        "id": d.id,
        "mac_address": d.mac_address,
        "ip_address": d.ip_address,
        "hostname": d.hostname,
        "vendor": d.vendor,
        "device_type": d.device_type,
        "display_name": d.display_name,
        "custom_name": d.custom_name,
        "icon_key": d.icon_key,
        "notes": d.notes,
        "is_online": d.is_online,
        "is_blocked": d.is_blocked,
        "is_protected": d.is_protected,
        "bandwidth_limit_kbps": d.bandwidth_limit_kbps,
        "first_seen": d.first_seen.isoformat() if d.first_seen else None,
        "last_seen": d.last_seen.isoformat() if d.last_seen else None,
    }


@router.get("")
async def list_devices(
    online_only: bool = Query(False),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Device).order_by(Device.is_online.desc(), Device.last_seen.desc())
    result = await db.execute(stmt)
    devices = result.scalars().all()

    if online_only:
        devices = [d for d in devices if d.is_online]
    if search:
        search_lower = search.lower()
        devices = [
            d for d in devices
            if search_lower in (d.custom_name or "").lower()
            or search_lower in (d.hostname or "").lower()
            or search_lower in (d.ip_address or "").lower()
            or search_lower in (d.mac_address or "").lower()
            or search_lower in (d.vendor or "").lower()
        ]

    return {"devices": [device_to_dict(d) for d in devices], "total": len(devices)}


@router.get("/my-device")
async def get_my_device(db: AsyncSession = Depends(get_db)):
    from backend.services.network_info import get_network_info
    from backend.utils.mac_utils import normalize_mac
    net = get_network_info()
    own_mac = normalize_mac(net.own_mac)
    result = await db.execute(select(Device).where(Device.mac_address == own_mac))
    device = result.scalar_one_or_none()
    if not device:
        return {"device": None}
    return {"device": device_to_dict(device)}


@router.get("/{device_id}")
async def get_device(device_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return {"device": device_to_dict(device)}


@router.patch("/{device_id}")
async def update_device(device_id: int, payload: DeviceUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(device, key, value)
    await db.commit()
    await db.refresh(device)
    return {"device": device_to_dict(device)}


@router.post("/{device_id}/block")
async def block_device(device_id: int, db: AsyncSession = Depends(get_db)):
    import asyncio
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    if device.is_protected:
        raise HTTPException(status_code=403, detail="Cannot block a protected device")
    from backend.services.network_info import get_network_info, get_all_own_ips, get_all_own_macs
    net = get_network_info()
    own_ips = get_all_own_ips()
    own_macs = get_all_own_macs()
    if (device.ip_address == net.gateway_ip
            or device.ip_address in own_ips
            or device.mac_address in own_macs):
        raise HTTPException(status_code=403, detail="Cannot block this device (gateway or own machine)")
    if not device.is_blocked:
        if device.ip_address:
            from backend.services.arp_spoofer import start_spoof
            # Run in thread — start_spoof does blocking Scapy I/O (_get_mac)
            loop = asyncio.get_running_loop()
            ip_snap = device.ip_address
            mac_snap = device.mac_address
            spoof_ok = await loop.run_in_executor(
                None, lambda: start_spoof(ip_snap, mac_snap)
            )
            if not spoof_ok:
                raise HTTPException(
                    status_code=503,
                    detail="ARP spoof failed — ensure Npcap is installed and app runs as Administrator",
                )
        device.is_blocked = True
        await db.commit()
        await db.refresh(device)
        from backend.websocket.manager import manager
        from backend.websocket import events
        await manager.broadcast(events.DEVICE_BLOCKED, {"device_id": device_id})
        from backend.database.models.alert import create_alert
        await create_alert(
            type="device_blocked",
            severity="info",
            title="Device Blocked",
            message=f"{device.display_name} ({device.ip_address}) has been blocked from the network.",
            device_id=device_id,
        )
    return {"device": device_to_dict(device)}


@router.post("/{device_id}/unblock")
async def unblock_device(device_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    if device.is_blocked:
        import asyncio
        from backend.services.arp_spoofer import stop_spoof
        # stop_spoof does thread.join() — run off the event loop.
        mac_snap = device.mac_address
        await asyncio.get_running_loop().run_in_executor(
            None, lambda: stop_spoof(mac_snap)
        )
        device.is_blocked = False
        await db.commit()
        await db.refresh(device)
        from backend.websocket.manager import manager
        from backend.websocket import events
        await manager.broadcast(events.DEVICE_UNBLOCKED, {"device_id": device_id})
        from backend.database.models.alert import create_alert
        await create_alert(
            type="device_unblocked",
            severity="info",
            title="Device Unblocked",
            message=f"{device.display_name} ({device.ip_address}) has been restored to the network.",
            device_id=device_id,
        )
    return {"device": device_to_dict(device)}


@router.post("/{device_id}/bandwidth-limit")
async def set_bandwidth_limit(device_id: int, payload: BandwidthLimitBody, db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(select(Device).where(Device.id == device_id))
        device = result.scalar_one_or_none()
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        limit_kbps = payload.limit_kbps
        device.bandwidth_limit_kbps = limit_kbps
        await db.commit()
        await db.refresh(device)
        # Apply (or clear) the host-side QoS policy. Best-effort and non-blocking;
        # the main coarse enforcement runs in the usage aggregator.
        if device.ip_address:
            import asyncio
            from backend.services.bandwidth_limiter import set_bandwidth_limit as apply_limit
            ip_snap = device.ip_address
            await asyncio.get_running_loop().run_in_executor(
                None, lambda: apply_limit(ip_snap, limit_kbps)
            )
        return {"device": device_to_dict(device), "limit_kbps": limit_kbps}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"bandwidth-limit error for device {device_id}: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/scan")
async def trigger_scan(background_tasks: BackgroundTasks):
    global _scan_in_progress
    if _scan_in_progress:
        return {"status": "already_scanning"}
    _scan_in_progress = True
    async def _do_scan():
        global _scan_in_progress
        try:
            await run_scan()
        finally:
            _scan_in_progress = False
    background_tasks.add_task(_do_scan)
    return {"status": "scan_started"}


@router.get("/scan/status")
async def scan_status():
    return {"scanning": _scan_in_progress}
