import logging
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, func
from backend.database.base import Base

logger = logging.getLogger("roost.alerts")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    type = Column(String, nullable=False)
    severity = Column(String, default="info")
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="SET NULL"), nullable=True)
    metadata_json = Column(String)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now(), index=True)


async def create_alert(
    type: str,
    title: str,
    message: str,
    severity: str = "info",
    device_id: int | None = None,
) -> dict:
    """
    Create an alert in the DB and broadcast ALERT_NEW via WebSocket.
    Safe to call from anywhere — catches and logs its own exceptions.
    """
    try:
        from backend.database.engine import AsyncSessionLocal
        async with AsyncSessionLocal() as session:
            alert = Alert(
                type=type,
                severity=severity,
                title=title,
                message=message,
                device_id=device_id,
            )
            session.add(alert)
            await session.commit()
            await session.refresh(alert)
            alert_dict = {
                "id": alert.id,
                "type": alert.type,
                "severity": alert.severity,
                "title": alert.title,
                "message": alert.message,
                "device_id": alert.device_id,
                "is_read": alert.is_read,
                "created_at": alert.created_at.isoformat() if alert.created_at else None,
            }
        # Broadcast to all connected clients
        try:
            from backend.websocket.manager import manager
            from backend.websocket import events
            await manager.broadcast(events.ALERT_NEW, alert_dict)
        except Exception:
            pass  # WebSocket failure never blocks alert creation
        return alert_dict
    except Exception as e:
        logger.error(f"create_alert failed: {e}")
