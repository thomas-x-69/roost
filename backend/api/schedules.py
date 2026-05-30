import json
import logging
import re
from typing import Optional, Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.database.engine import get_db
from backend.database.models.schedule import AccessSchedule
from backend.services.scheduler_service import add_schedule_job, remove_schedule_job

router = APIRouter(prefix="/schedules", tags=["schedules"])
logger = logging.getLogger("roost.api.schedules")

_TIME_RE = re.compile(r"^([01]?\d|2[0-3]):[0-5]\d$")


class ScheduleCreate(BaseModel):
    name: str = "New Schedule"
    device_id: Optional[int] = None
    group_id: Optional[int] = None
    action: Literal["block", "unblock"] = "block"
    days_of_week: list[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4, 5, 6])
    start_time: str = "22:00"
    end_time: Optional[str] = None

    @field_validator("start_time", "end_time")
    @classmethod
    def _valid_time(cls, v):
        if v is not None and not _TIME_RE.match(v):
            raise ValueError("time must be HH:MM (24h)")
        return v

    @field_validator("days_of_week")
    @classmethod
    def _valid_days(cls, v):
        if any(d < 0 or d > 6 for d in v):
            raise ValueError("days_of_week values must be 0..6 (Mon..Sun)")
        return v


class ScheduleUpdate(BaseModel):
    name: Optional[str] = None
    action: Optional[Literal["block", "unblock"]] = None
    days_of_week: Optional[list[int]] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("start_time", "end_time")
    @classmethod
    def _valid_time(cls, v):
        if v is not None and not _TIME_RE.match(v):
            raise ValueError("time must be HH:MM (24h)")
        return v


def schedule_to_dict(s: AccessSchedule) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "device_id": s.device_id,
        "group_id": s.group_id,
        "action": s.action,
        "days_of_week": json.loads(s.days_of_week or "[0,1,2,3,4,5,6]"),
        "start_time": s.start_time,
        "end_time": s.end_time,
        "is_active": s.is_active,
        "job_id": s.job_id,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


def _register_job(sched: AccessSchedule) -> None:
    """(Re)register the APScheduler job for an active schedule. Best-effort."""
    if sched.job_id:
        remove_schedule_job(sched.job_id)
        sched.job_id = None
    if sched.is_active and (sched.device_id or sched.group_id):
        days = json.loads(sched.days_of_week or "[0,1,2,3,4,5,6]")
        try:
            sched.job_id = add_schedule_job(
                sched.id, sched.action, days, sched.start_time,
                device_id=sched.device_id, group_id=sched.group_id,
            )
        except Exception as e:
            logger.warning(f"Could not (re)register schedule job: {e}")


@router.get("")
async def list_schedules(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AccessSchedule).order_by(AccessSchedule.created_at.desc()))
    schedules = result.scalars().all()
    return {"schedules": [schedule_to_dict(s) for s in schedules]}


@router.post("")
async def create_schedule(payload: ScheduleCreate, db: AsyncSession = Depends(get_db)):
    if payload.device_id is None and payload.group_id is None:
        raise HTTPException(status_code=400, detail="device_id or group_id is required")

    schedule = AccessSchedule(
        name=payload.name,
        device_id=payload.device_id,
        group_id=payload.group_id,
        action=payload.action,
        days_of_week=json.dumps(payload.days_of_week),
        start_time=payload.start_time,
        end_time=payload.end_time,
        is_active=True,
    )
    db.add(schedule)
    await db.flush()  # get ID
    _register_job(schedule)
    await db.commit()
    return {"schedule": schedule_to_dict(schedule)}


@router.get("/{schedule_id}")
async def get_schedule(schedule_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AccessSchedule).where(AccessSchedule.id == schedule_id))
    sched = result.scalar_one_or_none()
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"schedule": schedule_to_dict(sched)}


@router.patch("/{schedule_id}")
async def update_schedule(schedule_id: int, payload: ScheduleUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AccessSchedule).where(AccessSchedule.id == schedule_id))
    sched = result.scalar_one_or_none()
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")

    data = payload.model_dump(exclude_unset=True)
    for field in ("name", "action", "start_time", "end_time", "is_active"):
        if field in data:
            setattr(sched, field, data[field])
    if "days_of_week" in data:
        sched.days_of_week = json.dumps(data["days_of_week"])

    _register_job(sched)
    await db.commit()
    return {"schedule": schedule_to_dict(sched)}


@router.delete("/{schedule_id}")
async def delete_schedule(schedule_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AccessSchedule).where(AccessSchedule.id == schedule_id))
    sched = result.scalar_one_or_none()
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")
    if sched.job_id:
        remove_schedule_job(sched.job_id)
    await db.delete(sched)
    await db.commit()
    return {"status": "deleted"}


@router.post("/{schedule_id}/toggle")
async def toggle_schedule(schedule_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AccessSchedule).where(AccessSchedule.id == schedule_id))
    sched = result.scalar_one_or_none()
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")
    sched.is_active = not sched.is_active
    _register_job(sched)
    await db.commit()
    return {"schedule": schedule_to_dict(sched)}
