from __future__ import annotations

from datetime import UTC, date, datetime

from fastapi import APIRouter

from app.models.schema import RegistrationsEvent, RegistrationsPoint, RegistrationsResponse
from app.services import registrations_store
from app.settings import get_settings

router = APIRouter(tags=["registrations"])


def _weeks_before(start_d: date, snap_d: date) -> float:
    return float((start_d - snap_d).days) / 7.0


@router.get(
    "/registrations",
    response_model=RegistrationsResponse,
    response_model_by_alias=True,
)
def get_registrations() -> RegistrationsResponse:
    settings = get_settings()
    rows = registrations_store.read_all(settings)
    emphasized = settings.event.strip()

    events: list[RegistrationsEvent] = []
    for slug, label, start_date, _src, plist in rows:
        try:
            start_d = date.fromisoformat(start_date)
        except ValueError:
            continue

        pts: list[RegistrationsPoint] = []
        for sdate, online, onsite in plist:
            try:
                snap_d = date.fromisoformat(sdate)
            except ValueError:
                continue
            pts.append(
                RegistrationsPoint(
                    date=sdate,
                    weeks_before=_weeks_before(start_d, snap_d),
                    online=int(online),
                    onsite=int(onsite) if onsite is not None else None,
                )
            )

        events.append(
            RegistrationsEvent(
                slug=slug,
                label=label,
                start_date=start_date,
                points=pts,
            )
        )

    def _sort_key(ev: RegistrationsEvent) -> tuple[str, str]:
        try:
            d = date.fromisoformat(ev.start_date)
            return (d.isoformat(), ev.slug)
        except ValueError:
            return ("", ev.slug)

    events.sort(key=_sort_key)

    return RegistrationsResponse(
        fetched_at=datetime.now(UTC),
        emphasized_event_slug=emphasized,
        events=events,
    )
