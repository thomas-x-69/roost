"""
Roost - Network Control Application
FastAPI main entry point with lifespan management.
"""
import logging
import mimetypes
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.config import settings
from backend.utils.logger import setup_logging
from backend.database.migrations import init_db
from backend.api.router import api_router
from backend.websocket.router import router as ws_router

# Setup logging before anything else
setup_logging()
logger = logging.getLogger("roost")

# APScheduler
from apscheduler.schedulers.asyncio import AsyncIOScheduler
scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown."""
    logger.info("=" * 50)
    logger.info("  Roost starting up...")
    logger.info("=" * 50)

    # Ensure runtime data dirs exist (SQLite won't create the directory).
    Path(settings.data_dir).mkdir(parents=True, exist_ok=True)
    (Path(settings.data_dir) / "blocklists").mkdir(exist_ok=True)
    (Path(settings.data_dir) / "reports").mkdir(exist_ok=True)

    await init_db()
    logger.info("Database initialized")

    # On every startup, ARP spoof threads from the previous run are gone.
    # Clear any stale is_blocked flags so devices don't appear blocked when
    # they're not actually being intercepted.
    from backend.database.engine import AsyncSessionLocal
    from sqlalchemy import update
    from backend.database.models.device import Device
    async with AsyncSessionLocal() as _s:
        await _s.execute(update(Device).where(Device.is_blocked == True).values(is_blocked=False))
        await _s.commit()
    logger.info("Cleared stale is_blocked flags from previous session")

    from backend.services.network_info import get_network_info
    from backend.tasks.scan_task import run_scan
    net = get_network_info()

    scheduler.add_job(
        run_scan,
        "interval",
        seconds=settings.scan_interval_seconds,
        id="arp_scan",
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    logger.info(f"Scheduler started (scan every {settings.scan_interval_seconds}s)")

    from backend.services.scheduler_service import set_scheduler, restore_all_schedules
    set_scheduler(scheduler)
    restore_all_schedules()

    # Packet capture + usage aggregation
    from backend.services.packet_capture import start_capture
    from backend.tasks.usage_aggregator import flush_usage
    try:
        start_capture(net.interface)
    except Exception as e:
        logger.warning(f"Packet capture failed to start: {e}")

    scheduler.add_job(
        flush_usage,
        "interval",
        seconds=60,
        id="usage_agg",
        max_instances=1,
        coalesce=True,
    )
    logger.info("Usage aggregation scheduled (every 60s)")

    # Fire startup alert if Npcap unavailable (ARP features won't work)
    if not net.npcap_available:
        from backend.database.models.alert import create_alert
        await create_alert(
            type="system",
            severity="critical",
            title="Npcap Not Detected",
            message="ARP scanning and device blocking are unavailable. Install Npcap and restart Roost.",
        )

    try:
        await run_scan()
    except Exception as e:
        logger.warning(f"Initial scan failed: {e} (Npcap may not be installed)")

    yield

    logger.info("Roost shutting down...")
    from backend.services.arp_spoofer import stop_all_spoofs
    from backend.services.packet_capture import stop_capture
    stop_all_spoofs()  # CRITICAL: restore ARP before exit
    stop_capture()
    scheduler.shutdown(wait=False)
    logger.info("Goodbye.")


# Create FastAPI app
app = FastAPI(
    title="Roost",
    version=settings.app_version,
    description="Local network control and monitoring",
    lifespan=lifespan,
)

# CORS for Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5000", "http://127.0.0.1:5000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(api_router)

# WebSocket (not under /api/v1 prefix)
app.include_router(ws_router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": settings.app_version}


# ---------------------------------------------------------------------------
# Frontend static file serving
# On Windows, the mimetypes registry maps .js → text/plain which breaks
# ES module loading. We serve assets through explicit endpoints that set
# the correct content-type header.
# ---------------------------------------------------------------------------
_frontend_dist = Path(settings.frontend_dist)
_assets_dir = _frontend_dist / "assets"

# Map extensions to correct MIME types
_MIME_MAP = {
    ".js":    "application/javascript",
    ".mjs":   "application/javascript",
    ".css":   "text/css",
    ".svg":   "image/svg+xml",
    ".ico":   "image/x-icon",
    ".woff2": "font/woff2",
    ".woff":  "font/woff",
    ".json":  "application/json",
    ".png":   "image/png",
    ".jpg":   "image/jpeg",
    ".jpeg":  "image/jpeg",
    ".gif":   "image/gif",
    ".webp":  "image/webp",
    ".html":  "text/html; charset=utf-8",
    ".txt":   "text/plain; charset=utf-8",
}


if _frontend_dist.exists():
    @app.get("/assets/{filename:path}", include_in_schema=False)
    async def serve_asset(filename: str):
        """Serve files from frontend/dist/assets/ with correct MIME types."""
        file_path = _assets_dir / filename
        if not file_path.exists() or not file_path.is_file():
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Asset not found")
        # Security: ensure path stays within assets directory
        try:
            file_path.resolve().relative_to(_assets_dir.resolve())
        except ValueError:
            from fastapi import HTTPException
            raise HTTPException(status_code=403, detail="Forbidden")
        ext = file_path.suffix.lower()
        media_type = _MIME_MAP.get(ext, "application/octet-stream")
        return FileResponse(str(file_path), media_type=media_type)

    @app.get("/", include_in_schema=False)
    async def serve_root():
        return FileResponse(
            str(_frontend_dist / "index.html"),
            media_type="text/html; charset=utf-8",
        )

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        """Serve the React SPA for all non-API, non-asset routes."""
        if full_path.startswith(("api/", "assets/")) or full_path in ("health", "docs", "openapi.json"):
            from fastapi import HTTPException
            raise HTTPException(status_code=404)
        return FileResponse(
            str(_frontend_dist / "index.html"),
            media_type="text/html; charset=utf-8",
        )

else:
    @app.get("/")
    async def root():
        return {
            "message": "Roost API running. Frontend not built yet.",
            "api_docs": "/docs",
            "status": "ok",
        }
