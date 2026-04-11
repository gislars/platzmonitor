from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.models.schema import AvailabilityResponse, ErrorBody
from app.services.availability_service import build_availability
from app.settings import Settings, get_settings

router = APIRouter(tags=["availability"])


@router.get(
    "/availability",
    response_model=AvailabilityResponse,
    response_model_by_alias=True,
    summary="Aggregierte freie Plätze (Workshops und Exkursionen)",
)
def get_availability(settings: Settings = Depends(get_settings)):
    try:
        return build_availability(settings)
    except ValueError as e:
        return JSONResponse(
            status_code=503,
            content=ErrorBody(
                error="configuration_error",
                message=str(e),
            ).model_dump(),
        )
    except httpx.HTTPStatusError as e:
        return JSONResponse(
            status_code=502,
            content=ErrorBody(
                error="pretix_unavailable",
                message=f"pretix HTTP {e.response.status_code}",
            ).model_dump(),
        )
    except httpx.RequestError as e:
        return JSONResponse(
            status_code=503,
            content=ErrorBody(
                error="pretix_unavailable",
                message=str(e),
            ).model_dump(),
        )
