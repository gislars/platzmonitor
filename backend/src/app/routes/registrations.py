from __future__ import annotations

from datetime import UTC, date, datetime

from fastapi import APIRouter, Query

from app.models.schema import RegistrationsEvent, RegistrationsPoint, RegistrationsResponse
from app.services import registrations_store
from app.services.events_catalog import get_catalog_event, list_catalog_events
from app.settings import get_settings

router = APIRouter(tags=["registrations"])


def _weeks_before(start_d: date, snap_d: date) -> float:
    return float((start_d - snap_d).days) / 7.0


@router.get(
    "/registrations",
    response_model=RegistrationsResponse,
    response_model_by_alias=True,
)
def get_registrations(
    event: str = Query(
        ...,
        description="pretix Event-Slug (z. B. 2026 oder konf-2018)",
    ),
    include: str | None = Query(
        None,
        description=(
            "Optional: zusaetzliche Events. "
            "Wert 'previous' liefert alle Vorjahre (gemessen am Event-Katalog). "
            "Oder CSV Liste wie '2025,konf-2018'."
        ),
    ),
) -> RegistrationsResponse:
    settings = get_settings()
    rows = registrations_store.read_all(settings)
    emphasized = event.strip()

    include_set: set[str] = set()
    if include is not None and include.strip():
        raw = include.strip()
        if raw == "previous":
            cur = get_catalog_event(settings, emphasized)
            if cur is not None:
                cur_start = cur.start_date
                for ev in list_catalog_events(settings):
                    if ev.slug != emphasized and ev.start_date < cur_start:
                        include_set.add(ev.slug)
        else:
            include_set = {s.strip() for s in raw.split(",") if s.strip()}

    allowed = {emphasized} | include_set

    events: list[RegistrationsEvent] = []
    for slug, label, start_date, _src, plist in rows:
        if slug not in allowed:
            continue
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
