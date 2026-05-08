from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.models.schema import ErrorBody, EventsCatalogEvent, EventsCatalogResponse
from app.services.events_catalog import list_catalog_events
from app.settings import get_settings

router = APIRouter(tags=["events"])


@router.get(
    "/events",
    response_model=EventsCatalogResponse,
    response_model_by_alias=True,
    responses={
        404: {
            "description": "EVENTS_JSON ist nicht gesetzt oder leer.",
            "model": ErrorBody,
        }
    },
)
def get_events_catalog() -> EventsCatalogResponse | JSONResponse:
    settings = get_settings()
    evs = list_catalog_events(settings)
    if not evs:
        return JSONResponse(
            status_code=404,
            content=ErrorBody(
                error="events_not_configured",
                message="EVENTS_JSON ist nicht gesetzt oder leer",
            ).model_dump(),
        )
    # Sort: end_date desc, start_date desc, slug desc
    evs_sorted = sorted(
        evs,
        key=lambda e: (e.end_date, e.start_date, e.slug),
        reverse=True,
    )
    return EventsCatalogResponse(
        fetched_at=datetime.now(UTC),
        events=[
            EventsCatalogEvent(
                slug=e.slug,
                title=e.title,
                start_date=e.start_date,
                end_date=e.end_date,
            )
            for e in evs_sorted
        ],
    )

