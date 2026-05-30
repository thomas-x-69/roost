from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.database.engine import get_db
from backend.database.models.device import Device
from backend.services.network_info import get_network_info

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/info")
async def system_info():
    net = get_network_info()
    return {
        "interface": net.interface,
        "interface_display": net.interface_display,
        "gateway_ip": net.gateway_ip,
        "own_ip": net.own_ip,
        "own_mac": net.own_mac,
        "network_cidr": net.network_cidr,
        "npcap_available": net.npcap_available,
    }


@router.post("/pause-all")
async def pause_all(db: AsyncSession = Depends(get_db)):
    """Block all non-protected online devices."""
    from backend.services.arp_spoofer import start_spoof
    from backend.websocket.manager import manager
    from backend.websocket import events as ws_events

    result = await db.execute(
        select(Device).where(Device.is_online == True, Device.is_protected == False)
    )
    devices = result.scalars().all()
    blocked = []
    for device in devices:
        if not device.is_blocked and device.ip_address:
            start_spoof(device.ip_address, device.mac_address)
            device.is_blocked = True
            blocked.append(device.id)
    await db.commit()
    for did in blocked:
        await manager.broadcast(ws_events.DEVICE_BLOCKED, {"device_id": did})
    return {"blocked_count": len(blocked), "device_ids": blocked}


@router.post("/resume-all")
async def resume_all(db: AsyncSession = Depends(get_db)):
    """Unblock all blocked devices."""
    from backend.services.arp_spoofer import stop_spoof
    from backend.websocket.manager import manager
    from backend.websocket import events as ws_events

    result = await db.execute(select(Device).where(Device.is_blocked == True))
    devices = result.scalars().all()
    unblocked = []
    for device in devices:
        stop_spoof(device.mac_address)
        device.is_blocked = False
        unblocked.append(device.id)
    await db.commit()
    for did in unblocked:
        await manager.broadcast(ws_events.DEVICE_UNBLOCKED, {"device_id": did})
    return {"unblocked_count": len(unblocked), "device_ids": unblocked}
