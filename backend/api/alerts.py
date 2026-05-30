import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from backend.database.engine import get_db
from backend.database.models.alert import Alert

router = APIRouter(prefix="/alerts", tags=["alerts"])
logger = logging.getLogger("roost.api.alerts")


def alert_to_dict(a: Alert) -> dict:
    return {
        "id": a.id,
        "type": a.type,
        "severity": a.severity,
        "title": a.title,
        "message": a.message,
        "device_id": a.device_id,
        "is_read": a.is_read,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


@router.get("")
async def list_alerts(
    unread_only: bool = Query(False),
    limit: int = Query(50),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Alert).order_by(Alert.created_at.desc()).limit(limit)
    if unread_only:
        stmt = stmt.where(Alert.is_read == False)
    result = await db.execute(stmt)
    alerts = result.scalars().all()
    return {"alerts": [alert_to_dict(a) for a in alerts]}


@router.get("/count")
async def get_alert_count(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(func.count(Alert.id)).where(Alert.is_read == False))
    return {"unread_count": result.scalar() or 0}


@router.post("/{alert_id}/read")
async def mark_read(alert_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if alert:
        alert.is_read = True
        await db.commit()
    return {"status": "ok"}


@router.post("/read-all")
async def mark_all_read(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Alert).where(Alert.is_read == False))
    alerts = result.scalars().all()
    for a in alerts:
        a.is_read = True
    await db.commit()
    return {"marked_count": len(alerts)}


@router.delete("/{alert_id}")
async def delete_alert(alert_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if alert:
        await db.delete(alert)
        await db.commit()
    return {"status": "deleted"}
