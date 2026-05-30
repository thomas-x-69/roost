from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, func
from backend.database.base import Base


class AccessSchedule(Base):
    __tablename__ = "access_schedules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=True)
    group_id = Column(Integer, nullable=True)
    action = Column(String, nullable=False)  # 'block' | 'unblock'
    days_of_week = Column(String, nullable=False)  # JSON: [0,1,2,3,4] Mon=0
    start_time = Column(String, nullable=False)  # "HH:MM"
    end_time = Column(String, nullable=True)
    job_id = Column(String, unique=True, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
