from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.models.schema import AvailabilityResponse, ErrorBody
from app.services.availability_cache import get_availability_snapshot

router = APIRouter(tags=["availability"])


@router.get(
    "/availability",
    response_model=AvailabilityResponse,
    response_model_by_alias=True,
    summary="Aggregierte freie Plätze (Workshops und Exkursionen)",
)
def get_availability():
    snap, err = get_availability_snapshot()
    if snap is not None:
        return snap
    return JSONResponse(
        status_code=503,
        content=ErrorBody(
            error="cache_empty",
            message=err or "Noch keine Daten vom Hintergrundabruf",
        ).model_dump(),
    )
