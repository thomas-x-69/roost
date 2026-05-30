"""
Reports API — generate and download PDF network reports.
Uses ReportLab for PDF generation.
"""
import logging
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, Literal
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from backend.database.engine import get_db
from backend.database.models.device import Device
from backend.database.models.usage import BandwidthUsage
from backend.config import settings

router = APIRouter(prefix="/reports", tags=["reports"])
logger = logging.getLogger("roost.api.reports")


class ReportRequest(BaseModel):
    period: Literal["today", "week", "month"] = "today"
    device_ids: Optional[list[int]] = None

REPORTS_DIR = (Path(settings.data_dir) / "reports").resolve()
REPORTS_DIR.mkdir(parents=True, exist_ok=True)


def _format_bytes(b: int) -> str:
    if b < 1024:
        return f"{b} B"
    elif b < 1024 ** 2:
        return f"{b/1024:.1f} KB"
    elif b < 1024 ** 3:
        return f"{b/1024**2:.1f} MB"
    return f"{b/1024**3:.2f} GB"


async def _generate_pdf(period: str, device_ids: list[int] | None, db: AsyncSession) -> str:
    """Generate a PDF report and return the filename."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.units import cm
    except ImportError:
        raise HTTPException(status_code=500, detail="ReportLab not installed")

    now = datetime.now(timezone.utc)
    filename = f"roost_report_{now.strftime('%Y%m%d_%H%M%S')}.pdf"
    filepath = REPORTS_DIR / filename

    # Determine time range
    if period == "week":
        since = now - timedelta(days=7)
        period_label = "Last 7 Days"
    elif period == "month":
        since = now - timedelta(days=30)
        period_label = "Last 30 Days"
    else:
        since = now.replace(hour=0, minute=0, second=0, microsecond=0)
        period_label = "Today"

    since_naive = since.replace(tzinfo=None)

    # Fetch devices
    if device_ids:
        dev_result = await db.execute(select(Device).where(Device.id.in_(device_ids)))
    else:
        dev_result = await db.execute(select(Device))
    devices = dev_result.scalars().all()

    # Fetch bandwidth per device
    bw_result = await db.execute(
        select(
            BandwidthUsage.device_id,
            func.sum(BandwidthUsage.bytes_sent).label("sent"),
            func.sum(BandwidthUsage.bytes_recv).label("recv"),
        )
        .where(BandwidthUsage.bucket_time >= since_naive)
        .group_by(BandwidthUsage.device_id)
    )
    bw_map = {r.device_id: (r.sent or 0, r.recv or 0) for r in bw_result}

    # Build PDF
    doc = SimpleDocTemplate(str(filepath), pagesize=A4)
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph("Roost — Network Report", styles["Title"]))
    story.append(Paragraph(f"Period: {period_label}", styles["Normal"]))
    story.append(Paragraph(f"Generated: {now.strftime('%Y-%m-%d %H:%M UTC')}", styles["Normal"]))
    story.append(Spacer(1, 0.5 * cm))

    # Summary stats
    total_sent = sum(s for s, r in bw_map.values())
    total_recv = sum(r for s, r in bw_map.values())
    story.append(Paragraph(f"Total Upload: {_format_bytes(total_sent)}", styles["Normal"]))
    story.append(Paragraph(f"Total Download: {_format_bytes(total_recv)}", styles["Normal"]))
    story.append(Spacer(1, 0.5 * cm))

    # Device table
    table_data = [["Device", "IP Address", "Status", "Upload", "Download"]]
    for dev in devices:
        sent, recv = bw_map.get(dev.id, (0, 0))
        table_data.append([
            dev.display_name,
            dev.ip_address or "—",
            "Blocked" if dev.is_blocked else ("Online" if dev.is_online else "Offline"),
            _format_bytes(sent),
            _format_bytes(recv),
        ])

    tbl = Table(table_data, colWidths=[5 * cm, 3.5 * cm, 2.5 * cm, 2.5 * cm, 2.5 * cm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e40af")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#1f2937"), colors.HexColor("#111827")]),
        ("TEXTCOLOR", (0, 1), (-1, -1), colors.HexColor("#d1d5db")),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#374151")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(tbl)

    doc.build(story)
    return filename


@router.post("/generate")
async def generate_report(payload: ReportRequest, db: AsyncSession = Depends(get_db)):
    filename = await _generate_pdf(payload.period, payload.device_ids, db)
    return {"filename": filename, "url": f"/api/v1/reports/{filename}"}


@router.get("")
async def list_reports():
    files = sorted(REPORTS_DIR.glob("*.pdf"), key=lambda f: f.stat().st_mtime, reverse=True)
    return {"reports": [{"filename": f.name, "size": f.stat().st_size} for f in files[:20]]}


@router.get("/{filename}")
async def download_report(filename: str):
    # Security: strip any directory components and confirm the resolved path
    # stays inside REPORTS_DIR. Path.name drops drive letters, "/", "\\" and
    # "..", so Windows drive-absolute / traversal payloads cannot escape.
    safe_name = Path(filename).name
    if safe_name != filename or not safe_name.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = (REPORTS_DIR / safe_name).resolve()
    try:
        path.relative_to(REPORTS_DIR)
    except ValueError:
        raise HTTPException(status_code=403, detail="Forbidden")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Report not found")
    return FileResponse(str(path), media_type="application/pdf", filename=safe_name)
