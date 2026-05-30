from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from backend.database.base import Base

class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    mac_address = Column(String, unique=True, nullable=False, index=True)
    ip_address = Column(String, index=True)
    hostname = Column(String)
    vendor = Column(String)
    device_type = Column(String, default="unknown")
    custom_name = Column(String)
    icon_key = Column(String, default="device")
    notes = Column(String)
    is_online = Column(Boolean, default=False, index=True)
    is_blocked = Column(Boolean, default=False)
    is_protected = Column(Boolean, default=False)
    bandwidth_limit_kbps = Column(Integer, default=0)
    first_seen = Column(DateTime, server_default=func.now())
    last_seen = Column(DateTime, server_default=func.now(), onupdate=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    @property
    def display_name(self) -> str:
        return self.custom_name or self.hostname or f"Device ({self.mac_address[-8:]})"
