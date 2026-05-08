from __future__ import annotations

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.models.schema import AvailabilityResponse, ErrorBody
from app.services.availability_cache import ensure_availability_snapshot, get_availability_snapshot
from app.settings import get_settings

router = APIRouter(tags=["availability"])


@router.get(
    "/availability",
    response_model=AvailabilityResponse,
    response_model_by_alias=True,
    summary="Aggregierte freie Plätze (Workshops und Exkursionen)",
)
def get_availability(
    event: str = Query(
        ...,
        description="pretix Event-Slug (z. B. 2026 oder konf-2018)",
    ),
):
    settings = get_settings()
    ensure_availability_snapshot(settings, event=event)
    snap, err = get_availability_snapshot(settings, event=event)
    if snap is not None:
        return snap
    return JSONResponse(
        status_code=503,
        content=ErrorBody(
            error="cache_empty",
            message=err or "Noch keine Daten vom Hintergrundabruf",
        ).model_dump(),
    )
