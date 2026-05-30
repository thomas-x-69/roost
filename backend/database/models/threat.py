from sqlalchemy import Column, Integer, String, DateTime, func
from backend.database.base import Base


class ThreatList(Base):
    __tablename__ = "threat_lists"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source = Column(String, nullable=False)
    domain = Column(String, nullable=False, index=True)
    threat_type = Column(String, default="malware")
    added_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        __import__("sqlalchemy").UniqueConstraint("source", "domain", name="uq_threat_source_domain"),
    )
