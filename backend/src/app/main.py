from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.loggers import get_logger
from app.logging_config import configure_logging
from app.logging_utils import safe_url_for_log
from app.routes.availability import router as availability_router
from app.routes.booking_timeline import router as booking_timeline_router
from app.routes.history import router as history_router
from app.routes.pretalx_public import router as pretalx_public_router
from app.routes.registrations import router as registrations_router
from app.services.availability_cache import refresh_availability_snapshot
from app.settings import get_settings


def _root_path(raw: str) -> str:
    p = raw.strip().strip("/")
    return f"/{p}" if p else ""


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    log = get_logger("main")
    interval = max(5, int(settings.availability_refresh_seconds))
    log.info("Start: availability_refresh_seconds=%s", interval)
    log.info("App-Version %s", app.version)
    log.info(
        "Quellen: pretix_base=%s organizer=%s event=%s",
        safe_url_for_log(settings.pretix_base_url),
        settings.organizer,
        settings.event,
    )
    log.info("pretalx_schedule=%s", safe_url_for_log(settings.pretalx_schedule_url))
    log.info("pretalx_widget=%s", safe_url_for_log(settings.pretalx_widget_url))
    log.info("schedule_print_path=%s", settings.schedule_print_path.strip() or "(leer)")

    stop = asyncio.Event()
    await asyncio.to_thread(refresh_availability_snapshot, settings)

    async def refresh_loop() -> None:
        while True:
            try:
                await asyncio.wait_for(stop.wait(), timeout=interval)
                return
            except TimeoutError:
                pass
            await asyncio.to_thread(refresh_availability_snapshot, settings)

    task = asyncio.create_task(refresh_loop())
    yield
    log.info("Shutdown: Refresh-Task wird beendet")
    stop.set()
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


_settings = get_settings()
configure_logging(_settings)
_rp = _root_path(_settings.root_path)
app = FastAPI(
    title="FOSSGIS Platzmonitor API",
    version="0.1.0",
    docs_url="/docs" if _settings.docs_enabled else None,
    openapi_url="/openapi.json" if _settings.docs_enabled else None,
    root_path=_rp,
    lifespan=lifespan,
)
_origins: list[str] = []
if _settings.frontend_origin.strip():
    _origins = [o.strip() for o in _settings.frontend_origin.split(",") if o.strip()]

if _settings.frontend_origin_regex.strip():
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=_settings.frontend_origin_regex.strip(),
        allow_credentials=True,
        allow_methods=["GET", "OPTIONS"],
        allow_headers=["*"],
    )
elif _origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_origins,
        allow_credentials=True,
        allow_methods=["GET", "OPTIONS"],
        allow_headers=["*"],
    )

app.include_router(availability_router, prefix="/api/v1")
app.include_router(history_router, prefix="/api/v1")
app.include_router(booking_timeline_router, prefix="/api/v1")
app.include_router(registrations_router, prefix="/api/v1")
app.include_router(pretalx_public_router, prefix="/api/v1")
