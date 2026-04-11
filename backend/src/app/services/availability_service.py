from __future__ import annotations

import time
from datetime import UTC, datetime
from typing import Any, Literal

from app.models.schema import (
    AvailabilityFinite,
    AvailabilityResponse,
    AvailabilityUnlimited,
    Entry,
    EventInfo,
    Group,
)
from app.pretalx.schedule import load_pretalx_schedule, match_sort_at
from app.pretix.client import fetch_event, fetch_items_and_quotas, fetch_waiting_list_entries
from app.services.group_rules import find_group_for_label, load_group_rules
from app.settings import Settings


def _localized_name(name_obj: Any) -> str:
    if isinstance(name_obj, str):
        return name_obj
    if isinstance(name_obj, dict):
        return (
            name_obj.get("de")
            or name_obj.get("en")
            or (next(iter(name_obj.values())) if name_obj else "")
            or ""
        )
    return str(name_obj) if name_obj is not None else ""


_EVENT_TITLE_CACHE_TTL_S = 3600.0
_event_title_cache: dict[str, tuple[str, float]] = {}


def _get_event_title(settings: Settings) -> str:
    """Name aus pretix (gecached, damit nicht bei jedem Poll die Event-API trifft)."""
    key = (
        f"{settings.pretix_base_url.rstrip('/')}|"
        f"{settings.organizer.strip()}|{settings.event.strip()}"
    )
    now = time.monotonic()
    hit = _event_title_cache.get(key)
    if hit is not None:
        title, until = hit
        if now < until:
            return title
    try:
        ev_raw = fetch_event(settings)
        title = _localized_name(ev_raw.get("name")).strip()
    except Exception:
        title = ""
    if not title:
        title = f"{settings.organizer} · {settings.event}"
    _event_title_cache[key] = (title, now + _EVENT_TITLE_CACHE_TTL_S)
    return title


def _first_item_for_quota(
    quota: dict[str, Any], items_by_id: dict[int, dict[str, Any]]
) -> dict[str, Any] | None:
    for iid in quota.get("items") or []:
        it = items_by_id.get(int(iid))
        if it:
            return it
    return None


def _quota_label(quota: dict[str, Any], items_by_id: dict[int, dict[str, Any]]) -> str:
    raw = quota.get("name")
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    if isinstance(raw, dict):
        ln = _localized_name(raw)
        if ln.strip():
            return ln.strip()
    for iid in quota.get("items") or []:
        it = items_by_id.get(int(iid))
        if it:
            return _localized_name(it.get("name")).strip() or f"Item {iid}"
    return "Unbenannt"


def _waiting_entry_matches_quota(wl: dict[str, Any], quota: dict[str, Any]) -> bool:
    raw_item = wl.get("item")
    if raw_item is None:
        return False
    try:
        item_id = int(raw_item)
    except (TypeError, ValueError):
        return False
    q_items: list[int] = []
    for x in quota.get("items") or []:
        try:
            q_items.append(int(x))
        except (TypeError, ValueError):
            continue
    if item_id not in q_items:
        return False
    q_vars: list[int] = []
    for x in quota.get("variations") or []:
        try:
            q_vars.append(int(x))
        except (TypeError, ValueError):
            continue
    if not q_vars:
        return True
    raw_var = wl.get("variation")
    if raw_var is None:
        return False
    try:
        return int(raw_var) in q_vars
    except (TypeError, ValueError):
        return False


def _count_waiting_for_quota(quota: dict[str, Any], wl_entries: list[dict[str, Any]]) -> int:
    return sum(1 for e in wl_entries if _waiting_entry_matches_quota(e, quota))


def _quota_to_entry(
    quota: dict[str, Any],
    label: str,
    group_id: str,
    sort_at: datetime | None,
    waiting_list_enabled: bool,
    waiting_list_count: int | None,
) -> Entry:
    qid = quota.get("id")
    closed = bool(quota.get("closed"))
    avail_num = quota.get("available_number")
    size = quota.get("size")

    if closed:
        status: Literal["open", "sold_out", "closed"] = "closed"
    elif avail_num == 0:
        status = "sold_out"
    else:
        status = "open"

    if size is None:
        availability: AvailabilityFinite | AvailabilityUnlimited = AvailabilityUnlimited()
    else:
        free = int(avail_num) if avail_num is not None else 0
        availability = AvailabilityFinite(free=free, total=int(size) if size is not None else None)

    return Entry(
        id=str(qid),
        label=label,
        group_id=group_id,
        availability=availability,
        status=status,
        sort_at=sort_at,
        waiting_list_enabled=waiting_list_enabled,
        waiting_list_count=waiting_list_count,
    )


def build_availability(settings: Settings) -> AvailabilityResponse:
    event_title = _get_event_title(settings)

    items, quotas = fetch_items_and_quotas(settings)
    wl_entries, wl_ok = fetch_waiting_list_entries(settings)
    schedule = load_pretalx_schedule(settings)
    items_by_id: dict[int, dict[str, Any]] = {}
    for it in items:
        iid = it.get("id")
        if iid is not None:
            items_by_id[int(iid)] = it

    rules = load_group_rules(settings)
    buckets: dict[str, list[Entry]] = {}
    titles: dict[str, str] = {}

    def add_entry(group_id: str, title: str, entry: Entry) -> None:
        titles[group_id] = title
        buckets.setdefault(group_id, []).append(entry)

    for quota in quotas:
        label = _quota_label(quota, items_by_id)
        rule = find_group_for_label(label, rules)
        if rule is None:
            if settings.group_unmatched_behavior != "other":
                continue
            group_id = settings.group_other_id
            group_title = settings.group_other_title
        else:
            group_id = rule.id
            group_title = rule.title

        item = _first_item_for_quota(quota, items_by_id)
        # Abgesagte / deaktivierte Produkte in pretix nicht im Dashboard anzeigen
        if item is not None and item.get("active") is False:
            continue
        sort_at = match_sort_at(label, schedule) if schedule else None
        # Wenn ein pretalx-Schedule verfuegbar ist, zeigen wir nur Workshops mit Match.
        # So fallen Tippfehler auf und erscheinen nicht "unsortiert" im Dashboard.
        if group_id == "workshops" and schedule is not None and sort_at is None:
            continue
        wl_enabled = bool(item.get("allow_waitinglist")) if item else False
        wl_count = _count_waiting_for_quota(quota, wl_entries) if wl_ok else None
        entry = _quota_to_entry(quota, label, group_id, sort_at, wl_enabled, wl_count)
        add_entry(group_id, group_title, entry)

    for entries in buckets.values():
        if schedule and entries and all(e.sort_at is not None for e in entries):
            entries.sort(key=lambda e: e.sort_at)

    group_list = [
        Group(id=gid, title=titles[gid], entries=buckets[gid]) for gid in buckets if buckets[gid]
    ]
    group_list.sort(key=lambda g: g.title.casefold())

    fetched = datetime.now(UTC)

    return AvailabilityResponse(
        fetched_at=fetched,
        event=EventInfo(
            organizer=settings.organizer,
            slug=settings.event,
            title=event_title,
        ),
        groups=group_list,
    )
