from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.availability import router as availability_router
from app.settings import get_settings

_settings = get_settings()
app = FastAPI(
    title="FOSSGIS Platzmonitor API",
    version="0.1.0",
    docs_url="/docs" if _settings.docs_enabled else None,
    openapi_url="/openapi.json" if _settings.docs_enabled else None,
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
