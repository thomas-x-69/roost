from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, func
from backend.database.base import Base


class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, unique=True, nullable=False)
    color = Column(String, default="#3b82f6")
    icon_key = Column(String, default="group")
    is_blocked = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())


class GroupMember(Base):
    __tablename__ = "group_members"

    group_id = Column(Integer, ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), primary_key=True)
    added_at = Column(DateTime, server_default=func.now())
