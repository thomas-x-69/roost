"""
APScheduler wrapper for access schedules.
Schedules block/unblock jobs at set times.
"""
import json
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger("roost.scheduler")

# Shared scheduler instance (started in main.py lifespan)
scheduler: AsyncIOScheduler = None


def set_scheduler(s: AsyncIOScheduler):
    global scheduler
    scheduler = s


async def _execute_schedule_action(device_id: int, action: str):
    """Called by APScheduler when a schedule fires."""
    from backend.database.engine import AsyncSessionLocal
    from backend.database.models.device import Device
    from sqlalchemy import select

    import asyncio
    logger.info(f"Schedule firing: {action} device {device_id}")
    try:
        loop = asyncio.get_running_loop()
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Device).where(Device.id == device_id))
            device = result.scalar_one_or_none()
            if not device:
                return

            if action == "block" and not device.is_blocked:
                from backend.services.arp_spoofer import start_spoof
                if device.ip_address:
                    # start_spoof does blocking Scapy I/O — run off the event loop.
                    ip_snap, mac_snap = device.ip_address, device.mac_address
                    success = await loop.run_in_executor(
                        None, lambda: start_spoof(ip_snap, mac_snap)
                    )
                    if success:
                        device.is_blocked = True
                        await session.commit()
                        from backend.websocket.manager import manager
                        from backend.websocket import events
                        await manager.broadcast(events.DEVICE_BLOCKED, {"device_id": device_id})

            elif action == "unblock" and device.is_blocked:
                from backend.services.arp_spoofer import stop_spoof
                mac_snap = device.mac_address
                # stop_spoof does thread.join() — run off the event loop.
                await loop.run_in_executor(None, lambda: stop_spoof(mac_snap))
                device.is_blocked = False
                await session.commit()
                from backend.websocket.manager import manager
                from backend.websocket import events
                await manager.broadcast(events.DEVICE_UNBLOCKED, {"device_id": device_id})

    except Exception as e:
        logger.error(f"Schedule action error: {e}")


async def _execute_group_action(group_id: int, action: str):
    """Apply a scheduled block/unblock to every device in a group."""
    from backend.database.engine import AsyncSessionLocal
    from backend.database.models.group import Group, GroupMember
    from sqlalchemy import select

    logger.info(f"Schedule firing: {action} group {group_id}")
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(GroupMember.device_id).where(GroupMember.group_id == group_id)
            )
            device_ids = [row[0] for row in result.all()]
            grp = (await session.execute(
                select(Group).where(Group.id == group_id)
            )).scalar_one_or_none()
            if grp is not None:
                grp.is_blocked = (action == "block")
                await session.commit()
    except Exception as e:
        logger.error(f"Group schedule lookup error: {e}")
        return

    for device_id in device_ids:
        await _execute_schedule_action(device_id, action)


def add_schedule_job(schedule_id: int, action: str, days_of_week: list, time_str: str,
                     device_id: int = None, group_id: int = None) -> str:
    """Add an APScheduler job for a schedule targeting a device OR a group.
    Returns job_id."""
    if not scheduler:
        raise RuntimeError("Scheduler not initialized")
    if device_id is None and group_id is None:
        raise ValueError("Schedule must target a device or a group")

    hour, minute = time_str.split(":")
    # Convert days: 0=Mon...6=Sun in our system, APScheduler uses 0=Mon too
    day_of_week = ",".join(str(d) for d in days_of_week) if days_of_week else "0,1,2,3,4,5,6"

    if group_id is not None:
        func, args, target = _execute_group_action, [group_id, action], f"group {group_id}"
    else:
        func, args, target = _execute_schedule_action, [device_id, action], f"device {device_id}"

    job_id = f"schedule_{schedule_id}"
    scheduler.add_job(
        func,
        CronTrigger(hour=hour, minute=minute, day_of_week=day_of_week),
        args=args,
        id=job_id,
        replace_existing=True,
        max_instances=1,
    )
    logger.info(f"Schedule job added: {job_id} ({action} {target} at {time_str})")
    return job_id


def remove_schedule_job(job_id: str):
    if scheduler and scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
        logger.info(f"Schedule job removed: {job_id}")


def restore_all_schedules():
    """Reload all active schedules from DB on startup."""
    import asyncio
    asyncio.create_task(_restore_schedules_async())


async def _restore_schedules_async():
    """Async: load all active schedules from DB and add APScheduler jobs."""
    try:
        from backend.database.engine import AsyncSessionLocal
        from backend.database.models.schedule import AccessSchedule
        from sqlalchemy import select

        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(AccessSchedule).where(AccessSchedule.is_active == True)
            )
            schedules = result.scalars().all()
            for sched in schedules:
                if sched.device_id or sched.group_id:
                    days = json.loads(sched.days_of_week or "[0,1,2,3,4,5,6]")
                    add_schedule_job(
                        sched.id, sched.action, days, sched.start_time,
                        device_id=sched.device_id, group_id=sched.group_id,
                    )
        logger.info(f"Restored {len(schedules)} schedules from DB")
    except Exception as e:
        logger.error(f"Failed to restore schedules: {e}")
