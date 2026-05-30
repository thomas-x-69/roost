import logging
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from backend.database.engine import get_db
from backend.database.models.threat import ThreatList
from backend.services.threat_service import (
    check_domain, get_stats,
    block_threat_domain, unblock_threat_domain, get_blocked_threat_domains,
)

router = APIRouter(prefix="/threats", tags=["threats"])
logger = logging.getLogger("roost.api.threats")


class DomainBody(BaseModel):
    domain: str = ""


@router.get("")
async def list_threats(
    limit: int = Query(100),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ThreatList)
        .order_by(ThreatList.added_at.desc())
        .offset(offset)
        .limit(limit)
    )
    threats = result.scalars().all()
    count_result = await db.execute(select(func.count(ThreatList.id)))
    total = count_result.scalar() or 0
    return {
        "threats": [{"id": t.id, "source": t.source, "domain": t.domain, "threat_type": t.threat_type} for t in threats],
        "total": total,
    }


@router.get("/stats")
async def threat_stats():
    return await get_stats()


@router.post("/check")
async def check_threat(payload: DomainBody):
    domain = payload.domain
    if not domain:
        return {"domain": domain, "is_threat": False, "threat_type": None}
    is_threat, threat_type = await check_domain(domain)
    return {"domain": domain, "is_threat": is_threat, "threat_type": threat_type}


@router.get("/blocklists/status")
async def blocklist_status(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(func.count(ThreatList.id)))
    total = result.scalar() or 0
    return {
        "status": "active",
        "total_domains": total,
        "sources": ["hardcoded", "stevenblack"],
        "last_updated": None,
    }


@router.post("/blocklists/update")
async def update_blocklists():
    """Trigger blocklist update (runs in background)."""
    try:
        from backend.tasks.blocklist_updater import update_blocklists as _update
        import asyncio
        asyncio.create_task(_update())
    except Exception as e:
        logger.warning(f"Blocklist update failed: {e}")
    return {"status": "update_started"}


@router.post("/block")
async def block_domain(payload: DomainBody):
    """
    Block a threat domain on this machine via Windows hosts file.
    Requires Administrator privileges.
    """
    domain = payload.domain.strip()
    if not domain:
        raise HTTPException(status_code=422, detail="domain required")
    ok = block_threat_domain(domain)
    return {"domain": domain, "blocked": ok, "method": "hosts_file"}


@router.post("/unblock")
async def unblock_domain(payload: DomainBody):
    """Remove a domain from the Windows hosts file block list."""
    domain = payload.domain.strip()
    if not domain:
        raise HTTPException(status_code=422, detail="domain required")
    ok = unblock_threat_domain(domain)
    return {"domain": domain, "unblocked": ok}


@router.get("/blocked")
async def list_blocked_domains():
    """List domains currently blocked via hosts file."""
    return {"blocked_domains": get_blocked_threat_domains()}
