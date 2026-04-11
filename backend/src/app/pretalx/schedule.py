from __future__ import annotations

import json
import time
import unicodedata
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import httpx

from app.outgoing_http import pretalx_headers
from app.settings import Settings


def _normalize_title(raw: str) -> str:
    s = raw.strip()
    s = unicodedata.normalize("NFKC", s)
    # Praefix fuer Workshops aus Quoten-Namen entfernen, z. B. "WS07 - "
    if s.casefold().startswith("ws"):
        # Einfach halten: einmal an " - " teilen
        parts = s.split(" - ", 1)
        if len(parts) == 2 and parts[0].strip().lower().startswith("ws"):
            s = parts[1].strip()
    cf = s.casefold()
    # Optional Umlaute und Eszett vereinheitlichen fuer stabiles Matching
    cf = (
        cf.replace("ä", "ae")
        .replace("ö", "oe")
        .replace("ü", "ue")
        .replace("ß", "ss")
        .replace("á", "a")
        .replace("é", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ú", "u")
    )
    # Leerzeichen normalisieren
    cf = " ".join(cf.split())
    return cf


def _parse_iso_datetime(value: str) -> datetime | None:
    s = value.strip()
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt


def _extract_events_from_frab(schedule: dict[str, Any]) -> list[dict[str, Any]]:
    # FRAB-aehnlich: schedule.conference.days[].rooms als dict von Raum zu Event-Listen
    sch = schedule.get("schedule")
    if not isinstance(sch, dict):
        return []
    conf = sch.get("conference")
    if not isinstance(conf, dict):
        return []
    days = conf.get("days")
    if not isinstance(days, list):
        return []
    events: list[dict[str, Any]] = []
    for day in days:
        if not isinstance(day, dict):
            continue
        rooms = day.get("rooms")
        if not isinstance(rooms, dict):
            continue
        for _room_name, room_events in rooms.items():
            if not isinstance(room_events, list):
                continue
            for ev in room_events:
                if isinstance(ev, dict):
                    events.append(ev)
    return events


def build_title_to_start_map(schedule_json: dict[str, Any]) -> dict[str, datetime]:
    mapping: dict[str, datetime] = {}
    for ev in _extract_events_from_frab(schedule_json):
        title = ev.get("title")
        if not isinstance(title, str) or not title.strip():
            continue
        start = ev.get("date")
        if not isinstance(start, str) or not start.strip():
            continue
        dt = _parse_iso_datetime(start)
        if dt is None:
            continue
        key = _normalize_title(title)
        # Bei Duplikaten den fruehesten Start behalten
        prev = mapping.get(key)
        if prev is None or dt < prev:
            mapping[key] = dt
    return mapping


@dataclass(frozen=True)
class PretalxSchedule:
    title_to_start: dict[str, datetime]


_CACHE: tuple[float, PretalxSchedule] | None = None


def load_pretalx_schedule(settings: Settings) -> PretalxSchedule | None:
    global _CACHE
    now = time.time()
    if _CACHE is not None:
        cached_at, cached = _CACHE
        if now - cached_at < max(1, int(settings.pretalx_schedule_cache_seconds)):
            return cached

    url = settings.pretalx_schedule_url.strip()
    if not url:
        return None

    try:
        with httpx.Client(timeout=30.0, follow_redirects=True) as client:
            r = client.get(url, headers=pretalx_headers(settings))
            r.raise_for_status()
            data = json.loads(r.text)
    except (httpx.RequestError, httpx.HTTPStatusError, json.JSONDecodeError):
        return None

    if not isinstance(data, dict):
        return None

    sched = PretalxSchedule(title_to_start=build_title_to_start_map(data))
    _CACHE = (now, sched)
    return sched


def match_sort_at(label: str, sched: PretalxSchedule) -> datetime | None:
    key = _normalize_title(label)
    return sched.title_to_start.get(key)
