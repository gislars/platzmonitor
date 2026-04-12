from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.availability import router as availability_router
from app.services.availability_cache import refresh_availability_snapshot
from app.settings import get_settings


def _root_path(raw: str) -> str:
    p = raw.strip().strip("/")
    return f"/{p}" if p else ""


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    stop = asyncio.Event()
    await asyncio.to_thread(refresh_availability_snapshot, settings)

    async def refresh_loop() -> None:
        interval = max(5, int(settings.availability_refresh_seconds))
        while True:
            try:
                await asyncio.wait_for(stop.wait(), timeout=interval)
                return
            except TimeoutError:
                pass
            await asyncio.to_thread(refresh_availability_snapshot, settings)

    task = asyncio.create_task(refresh_loop())
    yield
    stop.set()
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


_settings = get_settings()
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
