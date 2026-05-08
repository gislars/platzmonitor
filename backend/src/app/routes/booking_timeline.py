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
    event: str = Query(
        ...,
        description="pretix Event-Slug (z. B. 2026 oder konf-2018)",
    ),
    quota_ids: str = Query(
        ...,
        alias="quotaIds",
        description="Komma-getrennte pretix-Quota-IDs (Workshops/Exkursionen wie im Dashboard)",
    ),
) -> BookingTimelineResponse:
    settings = get_settings()
    # Timeline ist event-spezifisch (Quota-IDs sind nicht global eindeutig).
    settings = settings.model_copy(update={"event": event.strip()})
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
