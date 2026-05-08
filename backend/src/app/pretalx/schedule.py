from __future__ import annotations

import json
import re
import time
import unicodedata
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import httpx

from app.loggers import get_logger
from app.outgoing_http import pretalx_headers
from app.settings import Settings

_log = get_logger("pretalx")

# Typische Praefixe in Pretix-Quoten: "WS03 - Titel", "WS03 - Titel" (Langstrich),
# "WS03: Titel", "WS03-Titel"
_WS_QUOTA_PREFIX = re.compile(r"(?i)^ws\s*\d*\s*[-:]\s*(.+)$")


def normalize_schedule_title_for_match(raw: str) -> str:
    s = raw.strip()
    s = unicodedata.normalize("NFKC", s)
    # Gedanken-/Langstriche wie ASCII-Bindestrich behandeln (Pretix nutzt oft U+2013)
    for ch in ("\u2013", "\u2014", "\u2212"):
        s = s.replace(ch, "-")
    # Praefix "WS.." entfernen (ohne ^ws\\b: bei "WS05-..." liegt kein Wortzwischenraum
    # vor der Ziffer).
    prefix_m = _WS_QUOTA_PREFIX.match(s)
    if prefix_m:
        s = prefix_m.group(1).strip()
    else:
        parts = re.split(r"\s+-\s+", s, maxsplit=1)
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


def _event_code(ev: dict[str, Any]) -> str | None:
    raw = ev.get("code")
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    return None


_WS_ROOM_HEAD = re.compile(r"^ws\s*\d+\b")


def _event_submission_is_workshop(ev: dict[str, Any]) -> bool:
    """True wenn Pretalx-Export den Slot als Workshop kennzeichnet (nicht ueber Produktnamen-Regex).

    Grundlage ist das Schedule-JSON (FRAB/Pretalx): Felder ``type``, optional ``track``,
    Raum mit ``WS``+Nummer oder mit ``workshop`` im Namen (z. B. ``Workshop 1 (D.013)``).
    """
    typ = ev.get("type")
    if isinstance(typ, str) and "workshop" in typ.casefold():
        return True
    track = ev.get("track")
    if isinstance(track, str) and track.strip() and "workshop" in track.casefold():
        return True
    room = ev.get("room")
    if isinstance(room, str):
        rn = room.strip().casefold()
        if rn and _WS_ROOM_HEAD.match(rn):
            return True
        # FOSSGIS 2024/2025 u. a.: Raeume "Workshop 1 (D.013)", nicht "WS1 (...)"
        if "workshop" in rn:
            return True
    return False


def build_title_to_meta_map(
    schedule_json: dict[str, Any],
) -> dict[str, tuple[datetime, str | None, bool]]:
    """Pro normalisiertem Titel: fruehester Start, Pretalx-``code``, Workshop-Kennzeichnung."""
    mapping: dict[str, tuple[datetime, str | None, bool]] = {}
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
        key = normalize_schedule_title_for_match(title)
        code = _event_code(ev)
        is_w = _event_submission_is_workshop(ev)
        prev = mapping.get(key)
        if prev is None or dt < prev[0]:
            mapping[key] = (dt, code, is_w)
    return mapping


@dataclass(frozen=True)
class PretalxSchedule:
    title_to_meta: dict[str, tuple[datetime, str | None, bool]]


@dataclass(frozen=True)
class PretalxLabelMatch:
    sort_at: datetime
    code: str | None
    is_workshop: bool


# URL -> (Zeitstempel, Schedule); wechsel der Schedule-URL laedt automatisch neu.
_CACHE: dict[str, tuple[float, PretalxSchedule]] = {}


def load_pretalx_schedule(settings: Settings) -> PretalxSchedule | None:
    global _CACHE
    now = time.time()
    url = settings.pretalx_schedule_url.strip()
    if not url:
        return None

    ttl = max(1, int(settings.pretalx_schedule_cache_seconds))
    hit = _CACHE.get(url)
    if hit is not None:
        cached_at, cached = hit
        if now - cached_at < ttl:
            return cached

    try:
        with httpx.Client(timeout=30.0, follow_redirects=True) as client:
            r = client.get(url, headers=pretalx_headers(settings))
            r.raise_for_status()
            data = json.loads(r.text)
    except httpx.HTTPStatusError as e:
        _log.warning("Schedule nicht ladbar: HTTP %s", e.response.status_code)
        return None
    except httpx.RequestError as e:
        _log.warning("Schedule nicht ladbar: %s", type(e).__name__)
        return None
    except json.JSONDecodeError:
        _log.warning("Schedule nicht ladbar: JSONDecodeError")
        return None

    if not isinstance(data, dict):
        return None

    sched = PretalxSchedule(title_to_meta=build_title_to_meta_map(data))
    _CACHE[url] = (now, sched)
    return sched


def match_pretalx_label(label: str, sched: PretalxSchedule | None) -> PretalxLabelMatch | None:
    if sched is None:
        return None
    key = normalize_schedule_title_for_match(label)
    row = sched.title_to_meta.get(key)
    if row is None:
        return None
    dt, code, is_w = row
    return PretalxLabelMatch(sort_at=dt, code=code, is_workshop=is_w)


def match_pretalx_from_candidates(
    labels: list[str], sched: PretalxSchedule | None
) -> PretalxLabelMatch | None:
    """Ersten Treffer ueber mehrere Roh-Bezeichner (Quota- vs. Produktnamen)."""
    if sched is None:
        return None
    seen_norm: set[str] = set()
    for raw in labels:
        t = raw.strip()
        if not t:
            continue
        nk = normalize_schedule_title_for_match(t)
        if nk in seen_norm:
            continue
        seen_norm.add(nk)
        m = match_pretalx_label(t, sched)
        if m is not None:
            return m
    return None


def match_pretalx_meta(label: str, sched: PretalxSchedule) -> tuple[datetime | None, str | None]:
    m = match_pretalx_label(label, sched)
    if m is None:
        return (None, None)
    return (m.sort_at, m.code)


def match_sort_at(label: str, sched: PretalxSchedule) -> datetime | None:
    m = match_pretalx_label(label, sched)
    return m.sort_at if m else None
