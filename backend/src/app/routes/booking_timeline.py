from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Query

from app.models.schema import BookingTimelinePoint, BookingTimelineResponse, BookingTimelineSeries
from app.services import booking_timeline
from app.settings import get_settings

router = APIRouter(tags=["booking-timeline"])


@router.get(
    "/booking-timeline",
    response_model=BookingTimelineResponse,
    response_model_by_alias=True,
)
def get_booking_timeline(
    quota_ids: str = Query(
        ...,
        alias="quotaIds",
        description="Komma-getrennte pretix-Quota-IDs (Workshops/Exkursionen wie im Dashboard)",
    ),
) -> BookingTimelineResponse:
    settings = get_settings()
    quotas = [q.strip() for q in quota_ids.split(",") if q.strip()]
    raw = booking_timeline.read_series(settings, quotas)

    series = [
        BookingTimelineSeries(
            quota_id=q,
            points=[BookingTimelinePoint(t=p["t"], booked=p["booked"]) for p in raw.get(q, [])],
        )
        for q in quotas
    ]

    return BookingTimelineResponse(fetched_at=datetime.now(UTC), series=series)
