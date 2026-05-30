import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.database.engine import get_db
from backend.database.models.group import Group, GroupMember
from backend.database.models.device import Device

router = APIRouter(prefix="/groups", tags=["groups"])
logger = logging.getLogger("roost.api.groups")


def group_to_dict(g: Group, members: list = None) -> dict:
    return {
        "id": g.id,
        "name": g.name,
        "color": g.color,
        "icon_key": g.icon_key,
        "is_blocked": g.is_blocked,
        "created_at": g.created_at.isoformat() if g.created_at else None,
        "member_count": len(members) if members is not None else 0,
    }


@router.get("")
async def list_groups(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Group).order_by(Group.created_at.desc()))
    groups = result.scalars().all()
    return {"groups": [group_to_dict(g) for g in groups]}


@router.post("")
async def create_group(data: dict, db: AsyncSession = Depends(get_db)):
    name = data.get("name", "New Group")
    existing = await db.execute(select(Group).where(Group.name == name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Group name already exists")
    group = Group(
        name=name,
        color=data.get("color", "#3b82f6"),
        icon_key=data.get("icon_key", "group"),
    )
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return {"group": group_to_dict(group)}


@router.get("/{group_id}")
async def get_group(group_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    members_result = await db.execute(select(GroupMember).where(GroupMember.group_id == group_id))
    members = members_result.scalars().all()
    return {"group": group_to_dict(group, members)}


@router.patch("/{group_id}")
async def update_group(group_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    for field in ("name", "color", "icon_key"):
        if field in data:
            setattr(group, field, data[field])
    await db.commit()
    return {"group": group_to_dict(group)}


@router.delete("/{group_id}")
async def delete_group(group_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    await db.delete(group)
    await db.commit()
    return {"status": "deleted"}


@router.post("/{group_id}/members")
async def add_member(group_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    device_id = data.get("device_id")
    if not device_id:
        raise HTTPException(status_code=400, detail="device_id required")
    member = GroupMember(group_id=group_id, device_id=device_id)
    db.add(member)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
    return {"status": "added"}


@router.delete("/{group_id}/members/{device_id}")
async def remove_member(group_id: int, device_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.device_id == device_id,
        )
    )
    member = result.scalar_one_or_none()
    if member:
        await db.delete(member)
        await db.commit()
    return {"status": "removed"}


@router.post("/{group_id}/block")
async def block_group(group_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    members_result = await db.execute(select(GroupMember).where(GroupMember.group_id == group_id))
    members = members_result.scalars().all()
    device_ids = [m.device_id for m in members]

    blocked = []
    for did in device_ids:
        dev_result = await db.execute(select(Device).where(Device.id == did))
        dev = dev_result.scalar_one_or_none()
        if dev and not dev.is_protected and not dev.is_blocked and dev.ip_address:
            from backend.services.arp_spoofer import start_spoof
            start_spoof(dev.ip_address, dev.mac_address)
            dev.is_blocked = True
            blocked.append(did)

    group.is_blocked = True
    await db.commit()
    return {"blocked_count": len(blocked), "device_ids": blocked}


@router.post("/{group_id}/unblock")
async def unblock_group(group_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    members_result = await db.execute(select(GroupMember).where(GroupMember.group_id == group_id))
    members = members_result.scalars().all()
    device_ids = [m.device_id for m in members]

    unblocked = []
    for did in device_ids:
        dev_result = await db.execute(select(Device).where(Device.id == did))
        dev = dev_result.scalar_one_or_none()
        if dev and dev.is_blocked:
            from backend.services.arp_spoofer import stop_spoof
            stop_spoof(dev.mac_address)
            dev.is_blocked = False
            unblocked.append(did)

    group.is_blocked = False
    await db.commit()
    return {"unblocked_count": len(unblocked), "device_ids": unblocked}
