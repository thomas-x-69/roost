"""
Usage API endpoints — bandwidth summaries, history, DNS top sites.
All endpoints return empty/zero responses when no data is present (never 500).
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.engine import get_db
from backend.database.models.device import Device
from backend.database.models.usage import BandwidthUsage, DnsQuery

logger = logging.getLogger("roost.api.usage")
router = APIRouter(prefix="/usage", tags=["usage"])


# ── helpers ─────────────────────────────────────────────────────────────────

def _now_utc() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _period_start(period: str) -> datetime:
    now = _now_utc()
    if period == "7d":
        return now - timedelta(days=7)
    if period == "30d":
        return now - timedelta(days=30)
    # "today" — start of today
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


# ── /usage/summary ──────────────────────────────────────────────────────────

@router.get("/summary")
async def get_summary(db: AsyncSession = Depends(get_db)):
    try:
        today_start = _now_utc().replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = _now_utc() - timedelta(days=7)
        month_start = _now_utc() - timedelta(days=30)

        async def total_bytes(since: datetime) -> int:
            result = await db.execute(
                select(
                    func.coalesce(func.sum(BandwidthUsage.bytes_sent), 0)
                    + func.coalesce(func.sum(BandwidthUsage.bytes_recv), 0)
                ).where(BandwidthUsage.bucket_time >= since)
            )
            return result.scalar() or 0

        total_today = await total_bytes(today_start)
        total_week = await total_bytes(week_start)
        total_month = await total_bytes(month_start)

        # Top device by today's usage
        top_result = await db.execute(
            select(
                BandwidthUsage.device_id,
                (
                    func.coalesce(func.sum(BandwidthUsage.bytes_sent), 0)
                    + func.coalesce(func.sum(BandwidthUsage.bytes_recv), 0)
                ).label("total"),
            )
            .where(BandwidthUsage.bucket_time >= today_start)
            .group_by(BandwidthUsage.device_id)
            .order_by(text("total DESC"))
            .limit(1)
        )
        top_row = top_result.first()

        return {
            "total_bytes_today": total_today,
            "total_bytes_week": total_week,
            "total_bytes_month": total_month,
            "top_device_id": top_row.device_id if top_row else None,
        }
    except Exception as e:
        logger.error(f"Summary error: {e}")
        return {"total_bytes_today": 0, "total_bytes_week": 0, "total_bytes_month": 0, "top_device_id": None}


# ── /usage/top-devices ───────────────────────────────────────────────────────

@router.get("/top-devices")
async def get_top_devices(db: AsyncSession = Depends(get_db)):
    try:
        today_start = _now_utc().replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = _now_utc() - timedelta(days=7)

        # Bytes today per device
        today_result = await db.execute(
            select(
                BandwidthUsage.device_id,
                (
                    func.coalesce(func.sum(BandwidthUsage.bytes_sent), 0)
                    + func.coalesce(func.sum(BandwidthUsage.bytes_recv), 0)
                ).label("bytes_today"),
            )
            .where(BandwidthUsage.bucket_time >= today_start)
            .group_by(BandwidthUsage.device_id)
        )
        today_map: dict[int, int] = {r.device_id: r.bytes_today for r in today_result}

        # Bytes this week per device
        week_result = await db.execute(
            select(
                BandwidthUsage.device_id,
                (
                    func.coalesce(func.sum(BandwidthUsage.bytes_sent), 0)
                    + func.coalesce(func.sum(BandwidthUsage.bytes_recv), 0)
                ).label("bytes_week"),
            )
            .where(BandwidthUsage.bucket_time >= week_start)
            .group_by(BandwidthUsage.device_id)
        )
        week_map: dict[int, int] = {r.device_id: r.bytes_week for r in week_result}

        all_device_ids = set(today_map) | set(week_map)
        if not all_device_ids:
            return []

        devices_result = await db.execute(
            select(Device).where(Device.id.in_(all_device_ids))
        )
        devices = {d.id: d for d in devices_result.scalars()}

        rows = []
        for did in sorted(all_device_ids, key=lambda x: today_map.get(x, 0), reverse=True):
            dev = devices.get(did)
            rows.append({
                "device_id": did,
                "display_name": dev.display_name if dev else f"Device {did}",
                "bytes_today": today_map.get(did, 0),
                "bytes_week": week_map.get(did, 0),
            })
        return rows
    except Exception as e:
        logger.error(f"Top devices error: {e}")
        return []


# ── /usage/history ──────────────────────────────────────────────────────────

@router.get("/history")
async def get_history(
    device_id: int = Query(...),
    period: str = Query("today", regex="^(today|7d|30d)$"),
    db: AsyncSession = Depends(get_db),
):
    try:
        since = _period_start(period)
        result = await db.execute(
            select(
                BandwidthUsage.bucket_time,
                BandwidthUsage.bytes_sent,
                BandwidthUsage.bytes_recv,
            )
            .where(
                BandwidthUsage.device_id == device_id,
                BandwidthUsage.bucket_time >= since,
            )
            .order_by(BandwidthUsage.bucket_time)
        )
        rows = result.all()
        return [
            {
                "time": r.bucket_time.isoformat(),
                "bytes_sent": r.bytes_sent,
                "bytes_recv": r.bytes_recv,
            }
            for r in rows
        ]
    except Exception as e:
        logger.error(f"History error: {e}")
        return []


# ── /usage/dns/top-sites ─────────────────────────────────────────────────────

@router.get("/dns/top-sites")
async def get_top_sites(db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(
            select(
                DnsQuery.domain,
                func.sum(DnsQuery.query_count).label("query_count"),
                func.count(DnsQuery.device_id.distinct()).label("device_count"),
                func.max(DnsQuery.is_threat).label("is_threat"),
                func.max(DnsQuery.threat_type).label("threat_type"),
            )
            .group_by(DnsQuery.domain)
            .order_by(text("query_count DESC"))
            .limit(100)
        )
        return [
            {
                "domain": r.domain,
                "query_count": r.query_count,
                "device_count": r.device_count,
                "is_threat": bool(r.is_threat),
                "threat_type": r.threat_type,
            }
            for r in result
        ]
    except Exception as e:
        logger.error(f"Top sites error: {e}")
        return []


# ── /usage/dns/device/{device_id} ────────────────────────────────────────────

@router.get("/dns/device/{device_id}")
async def get_device_dns(device_id: int, db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(
            select(DnsQuery)
            .where(DnsQuery.device_id == device_id)
            .order_by(DnsQuery.query_count.desc())
            .limit(50)
        )
        rows = result.scalars().all()
        return [
            {
                "domain": r.domain,
                "query_count": r.query_count,
                "is_threat": r.is_threat,
                "threat_type": r.threat_type,
                "first_seen": r.first_seen.isoformat() if r.first_seen else None,
                "last_seen": r.last_seen.isoformat() if r.last_seen else None,
            }
            for r in rows
        ]
    except Exception as e:
        logger.error(f"Device DNS error: {e}")
        return []
