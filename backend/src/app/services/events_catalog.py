from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from app.settings import Settings


@dataclass(frozen=True)
class CatalogEvent:
    slug: str
    title: str | None
    start_date: str
    end_date: str

    def freeze_at(self) -> datetime:
        d = date.fromisoformat(self.end_date)
        # Freeze: end_date + 1 Tag, Tagesbeginn UTC
        return datetime(d.year, d.month, d.day, tzinfo=UTC) + timedelta(days=1)


def _parse_events_json(raw: str) -> list[CatalogEvent]:
    if not raw.strip():
        return []
    obj = json.loads(raw)
    if not isinstance(obj, list):
        raise ValueError("EVENTS_JSON muss eine JSON-Liste sein")
    out: list[CatalogEvent] = []
    for i, row in enumerate(obj):
        if not isinstance(row, dict):
            raise ValueError(f"EVENTS_JSON[{i}] muss ein Objekt sein")
        slug = str(row.get("slug") or "").strip()
        start_date = str(row.get("start_date") or row.get("startDate") or "").strip()
        end_date = str(row.get("end_date") or row.get("endDate") or "").strip()
        title_raw = row.get("title")
        title = None if title_raw is None else str(title_raw).strip() or None
        if not slug:
            raise ValueError(f"EVENTS_JSON[{i}].slug fehlt")
        if not start_date:
            raise ValueError(f"EVENTS_JSON[{i}].start_date fehlt")
        if not end_date:
            raise ValueError(f"EVENTS_JSON[{i}].end_date fehlt")
        # Validierung ISO-Date
        date.fromisoformat(start_date)
        date.fromisoformat(end_date)
        out.append(CatalogEvent(slug=slug, title=title, start_date=start_date, end_date=end_date))
    # Dedup nach slug, erster gewinnt
    uniq: dict[str, CatalogEvent] = {}
    for ev in out:
        uniq.setdefault(ev.slug, ev)
    return list(uniq.values())


def list_catalog_events(settings: Settings) -> list[CatalogEvent]:
    """Event-Katalog aus Settings. Kann leer sein, wenn nicht konfiguriert."""
    try:
        return _parse_events_json(settings.events_json)
    except json.JSONDecodeError as e:
        raise ValueError(f"EVENTS_JSON ist ungueltig: {e.msg}") from e


def get_catalog_event(settings: Settings, slug: str) -> CatalogEvent | None:
    s = slug.strip()
    if not s:
        return None
    for ev in list_catalog_events(settings):
        if ev.slug == s:
            return ev
    return None


def is_event_frozen(settings: Settings, slug: str, *, now: datetime | None = None) -> bool:
    ev = get_catalog_event(settings, slug)
    if ev is None:
        return False
    t = now or datetime.now(UTC)
    if t.tzinfo is None:
        t = t.replace(tzinfo=UTC)
    return t >= ev.freeze_at()


def settings_for_event(base: Settings, slug: str) -> Settings:
    """Erzeugt neue Settings mit anderem Event-Slug ohne globale Mutation.

    Unterstuetzt URL-Templates: wenn PRETALX_* eine {event}-Sequenz enthaelt, wird sie ersetzt.
    """
    s = slug.strip()
    if not s:
        return base

    next_settings = base.model_copy(update={"event": s})
    base_event = base.event.strip()

    def _tpl(raw: str) -> str:
        txt = raw.strip()
        if "{event}" in txt:
            return txt.replace("{event}", s)
        return txt

    # Schedule/Widget URLs optional pro Event.
    #
    # Wichtig: Wenn URLs NICHT templated sind (kein {event}) und wir auf ein anderes Event
    # umschalten, wuerden wir sonst z. B. weiterhin den 2026er pretalx Schedule laden.
    # Das fuehrt dazu, dass Workshops (mit schedule!=None) wegen fehlendem Match gefiltert
    # werden und "verschwinden". Daher: ohne Template fuer fremde Events deaktivieren.
    raw_sched = next_settings.pretalx_schedule_url.strip()
    raw_widget = next_settings.pretalx_widget_url.strip()
    if base_event and s != base_event:
        if raw_sched and "{event}" not in raw_sched:
            raw_sched = ""
        if raw_widget and "{event}" not in raw_widget:
            raw_widget = ""

    next_settings = next_settings.model_copy(
        update={
            "pretalx_schedule_url": _tpl(raw_sched),
            "pretalx_widget_url": _tpl(raw_widget),
        }
    )
    return next_settings

