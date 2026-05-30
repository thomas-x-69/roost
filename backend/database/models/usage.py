from sqlalchemy import Column, Integer, String, Boolean, DateTime, BigInteger, UniqueConstraint, ForeignKey, func
from backend.database.base import Base


class BandwidthUsage(Base):
    __tablename__ = "bandwidth_usage"

    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    bucket_time = Column(DateTime, nullable=False)  # truncated to 1-minute resolution
    bytes_sent = Column(BigInteger, default=0)
    bytes_recv = Column(BigInteger, default=0)
    packets_sent = Column(Integer, default=0)
    packets_recv = Column(Integer, default=0)

    __table_args__ = (
        UniqueConstraint("device_id", "bucket_time", name="uq_bw_device_bucket"),
    )


class DnsQuery(Base):
    __tablename__ = "dns_queries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    domain = Column(String, nullable=False)
    query_count = Column(Integer, default=1)
    first_seen = Column(DateTime, server_default=func.now())
    last_seen = Column(DateTime, server_default=func.now(), onupdate=func.now())
    is_threat = Column(Boolean, default=False)
    threat_type = Column(String, nullable=True)

    __table_args__ = (
        UniqueConstraint("device_id", "domain", name="uq_dns_device_domain"),
    )
