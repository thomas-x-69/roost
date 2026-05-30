from fastapi import APIRouter
from backend.api.devices import router as devices_router
from backend.api.system import router as system_router
from backend.api.schedules import router as schedules_router
from backend.api.usage import router as usage_router
from backend.api.alerts import router as alerts_router
from backend.api.groups import router as groups_router
from backend.api.threats import router as threats_router
from backend.api.reports import router as reports_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(devices_router)
api_router.include_router(system_router)
api_router.include_router(schedules_router)
api_router.include_router(usage_router)
api_router.include_router(alerts_router)
api_router.include_router(groups_router)
api_router.include_router(threats_router)
api_router.include_router(reports_router)
