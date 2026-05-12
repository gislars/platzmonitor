from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any, Literal

from app.loggers import get_logger
from app.models.schema import (
    AvailabilityFinite,
    AvailabilityResponse,
    AvailabilityUnlimited,
    Entry,
    EventInfo,
    Group,
)
from app.pretalx.schedule import (
    PretalxLabelMatch,
    PretalxSchedule,
    load_pretalx_schedule,
    match_pretalx_by_code,
    match_pretalx_from_candidates,
    normalize_pretalx_code_for_match,
    normalize_schedule_title_for_match,
)
from app.pretix.client import fetch_event, fetch_items_and_quotas, fetch_waiting_list_entries
from app.services.group_rules import GroupRule, find_group_for_label, load_group_rules
from app.settings import Settings

_log = get_logger("availability")


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


_event_title_by_key: dict[str, str] = {}


def _get_event_title(settings: Settings) -> str:
    """Name aus pretix: einmal pro Prozess und Schlüssel laden, danach nur aus dem Speicher."""
    key = (
        f"{settings.pretix_base_url.rstrip('/')}|"
        f"{settings.organizer.strip()}|{settings.event.strip()}"
    )
    cached = _event_title_by_key.get(key)
    if cached is not None:
        return cached

    fallback = f"{settings.organizer} · {settings.event}"
    try:
        ev_raw = fetch_event(settings)
        title = _localized_name(ev_raw.get("name")).strip()
    except Exception as e:
        _log.warning(
            "Event-Titel nicht ermittelbar (Fehler: %s), nutze Fallback %r",
            type(e).__name__,
            fallback,
        )
        title = fallback
    else:
        if not title:
            _log.warning(
                "Event-Titel nicht ermittelbar (leerer Name in pretix), nutze Fallback %r",
                fallback,
            )
            title = fallback

    _event_title_by_key[key] = title
    return title


def _first_item_for_quota(
    quota: dict[str, Any], items_by_id: dict[int, dict[str, Any]]
) -> dict[str, Any] | None:
    for iid in quota.get("items") or []:
        it = items_by_id.get(int(iid))
        if it:
            return it
    return None


def _parse_api_id(raw: Any) -> int | None:
    """pretix-IDs aus int oder gelegentlich Ziffernstring; optional URL-Pfad."""
    if raw is None:
        return None
    if isinstance(raw, bool):
        return None
    if isinstance(raw, int):
        return raw
    if isinstance(raw, float) and raw.is_integer():
        return int(raw)
    if isinstance(raw, str):
        s = raw.strip().rstrip("/")
        if s.isdigit():
            return int(s)
        m = re.search(r"/items/(\d+)/", s)
        if m:
            return int(m.group(1))
        try:
            return int(s)
        except ValueError:
            return None
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
    """WL-Eintrag passt zur Quota inkl. Subevent (pretix Event-Serien)."""
    q_sub = _parse_api_id(quota.get("subevent"))
    wl_sub = _parse_api_id(wl.get("subevent"))
    if q_sub != wl_sub:
        return False

    item_id = _parse_api_id(wl.get("item"))
    if item_id is None:
        return False
    q_items: list[int] = []
    for x in quota.get("items") or []:
        pid = _parse_api_id(x)
        if pid is not None:
            q_items.append(pid)
    if item_id not in q_items:
        return False
    q_vars: list[int] = []
    for x in quota.get("variations") or []:
        vid = _parse_api_id(x)
        if vid is not None:
            q_vars.append(vid)
    if not q_vars:
        return True
    var_id = _parse_api_id(wl.get("variation"))
    if var_id is None:
        return False
    return var_id in q_vars


def _count_waiting_for_quota(quota: dict[str, Any], wl_entries: list[dict[str, Any]]) -> int:
    return sum(1 for e in wl_entries if _waiting_entry_matches_quota(e, quota))


def _waiting_list_count_for_quota(
    quota: dict[str, Any], wl_entries: list[dict[str, Any]], wl_ok: bool
) -> int | None:
    """Pretix-Zaehler aus Quota-Feld waiting_list oder manuelle WL-Zaehlung."""
    raw = quota.get("waiting_list")
    if isinstance(raw, int) and raw >= 0:
        return raw
    if not wl_ok:
        return None
    return _count_waiting_for_quota(quota, wl_entries)


def _workshops_group_tuple(rules: list[GroupRule]) -> tuple[str, str]:
    """Titel der Workshop-Gruppe.

    Default wenn keine (reine Metadaten-)Regel id workshops in JSON.
    """
    for r in rules:
        if r.id == "workshops":
            return (r.id, r.title)
    return ("workshops", "Workshops")


def _rules_excluding_workshops(rules: list[GroupRule]) -> list[GroupRule]:
    return [r for r in rules if r.id != "workshops"]


def _pretalx_meta_codes_from_quota(
    quota: dict[str, Any], items_by_id: dict[int, dict[str, Any]], meta_key: str
) -> tuple[str | None, bool, list[str]]:
    """Erste nicht-leere Meta-Zeichenkette (roh).

    Zweiter Wert: True, wenn mehrere normalisiert verschiedene Codes vorkommen.
    Dritter Wert: sortierte Liste der vorkommenden Rohstrings (Duplikate entfernt),
    leer wenn keine Meta-Zeichenkette.
    """
    raws: list[str] = []
    norms: list[str] = []
    for iid_raw in quota.get("items") or []:
        iid = _parse_api_id(iid_raw)
        if iid is None:
            continue
        it = items_by_id.get(iid)
        if not it:
            continue
        md = it.get("meta_data")
        if isinstance(md, dict):
            v = md.get(meta_key)
            if isinstance(v, str) and v.strip():
                s = v.strip()
                raws.append(s)
                norms.append(normalize_pretalx_code_for_match(s))
        for var in it.get("variations") or []:
            if not isinstance(var, dict):
                continue
            vmd = var.get("meta_data")
            if isinstance(vmd, dict):
                vv = vmd.get(meta_key)
                if isinstance(vv, str) and vv.strip():
                    s = vv.strip()
                    raws.append(s)
                    norms.append(normalize_pretalx_code_for_match(s))
    if not raws:
        return None, False, []
    uniq_raw = sorted(set(raws))
    return raws[0], len(set(norms)) > 1, uniq_raw


def _resolve_pretalx_for_quota(
    quota: dict[str, Any],
    items_by_id: dict[int, dict[str, Any]],
    schedule: PretalxSchedule | None,
    settings: Settings,
    label: str,
) -> tuple[PretalxLabelMatch | None, str | None, str | None]:
    """pretalx-Match; optional Diagnose-Tag (title|meta_unknown|none) und Meta-Rohzeile."""
    labels = _pretalx_label_candidates(quota, items_by_id)
    meta_key = settings.pretix_pretalx_meta_key.strip()
    if not meta_key:
        return match_pretalx_from_candidates(labels, schedule), None, None

    first_meta_raw, meta_conflict, meta_raws_distinct = _pretalx_meta_codes_from_quota(
        quota, items_by_id, meta_key
    )
    if meta_conflict:
        _log.warning(
            "pretix_quota_id=%s organizer=%s event=%s: mehrere verschiedene %r-Werte %s, "
            "nutze ersten",
            quota.get("id"),
            settings.organizer,
            settings.event,
            meta_key,
            meta_raws_distinct,
        )

    px_code: PretalxLabelMatch | None = None
    if schedule is not None and first_meta_raw:
        px_code = match_pretalx_by_code(first_meta_raw, schedule)
    px_title = match_pretalx_from_candidates(labels, schedule)

    if px_code is not None:
        return px_code, "code", None

    diag: str
    if first_meta_raw and schedule is not None:
        diag = "meta_unknown"
    elif px_title is not None:
        diag = "title"
    else:
        diag = "none"
    return px_title, diag, first_meta_raw if diag == "meta_unknown" else None


def _pretalx_label_candidates(
    quota: dict[str, Any], items_by_id: dict[int, dict[str, Any]]
) -> list[str]:
    """Bezeichner fuer Pretalx-Titelabgleich.

    Quotenname zuerst, dann alle zugeordneten Produktnamen.
    """
    out: list[str] = []
    keys_seen: set[str] = set()

    def add_raw(raw: str) -> None:
        t = raw.strip()
        if not t:
            return
        nk = normalize_schedule_title_for_match(t)
        if nk in keys_seen:
            return
        keys_seen.add(nk)
        out.append(t)

    add_raw(_quota_label(quota, items_by_id))
    for iid_raw in quota.get("items") or []:
        iid = _parse_api_id(iid_raw)
        if iid is None:
            continue
        it = items_by_id.get(iid)
        if not it:
            continue
        add_raw(_localized_name(it.get("name")))
    return out


def _quota_to_entry(
    quota: dict[str, Any],
    label: str,
    group_id: str,
    sort_at: datetime | None,
    pretalx_code: str | None,
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
        pretalx_code=pretalx_code,
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
        item = _first_item_for_quota(quota, items_by_id)
        # Abgesagte / deaktivierte Produkte in pretix nicht im Dashboard anzeigen
        if item is not None and item.get("active") is False:
            continue

        px, pretalx_diag, meta_unknown_raw = _resolve_pretalx_for_quota(
            quota, items_by_id, schedule, settings, label
        )
        if pretalx_diag in ("title", "meta_unknown", "none"):
            suffix = ""
            if pretalx_diag == "meta_unknown" and meta_unknown_raw:
                suffix = f" pretalx_meta_raw={meta_unknown_raw[:40]!r}"
            _log.info(
                "pretalx_match=%s pretix_quota_id=%s label=%s organizer=%s event=%s%s",
                pretalx_diag,
                str(quota.get("id", "")),
                label,
                settings.organizer,
                settings.event,
                suffix,
            )
        sort_at: datetime | None
        pretalx_code: str | None

        if px is not None and px.is_workshop:
            # Nur Pretalx kennzeichnet Workshops; Pretix-Quoten werden per Titel mit dem Slot
            # verknuepft.
            group_id, group_title = _workshops_group_tuple(rules)
            sort_at = px.sort_at
            pretalx_code = px.code
        elif px is not None:
            rule = find_group_for_label(label, _rules_excluding_workshops(rules))
            if rule is None:
                if settings.group_unmatched_behavior != "other":
                    continue
                group_id = settings.group_other_id
                group_title = settings.group_other_title
            else:
                group_id = rule.id
                group_title = rule.title
            sort_at = px.sort_at
            pretalx_code = px.code
        else:
            rule = find_group_for_label(label, _rules_excluding_workshops(rules))
            if rule is None:
                if settings.group_unmatched_behavior != "other":
                    continue
                group_id = settings.group_other_id
                group_title = settings.group_other_title
            else:
                group_id = rule.id
                group_title = rule.title
            sort_at = None
            pretalx_code = None

        wl_enabled = bool(item.get("allow_waitinglist")) if item else False
        wl_count = _waiting_list_count_for_quota(quota, wl_entries, wl_ok)
        entry = _quota_to_entry(quota, label, group_id, sort_at, pretalx_code, wl_enabled, wl_count)
        add_entry(group_id, group_title, entry)

    for entries in buckets.values():
        if schedule and entries and all(e.sort_at is not None for e in entries):
            entries.sort(key=lambda e: e.sort_at)

    group_list = [
        Group(id=gid, title=titles[gid], entries=buckets[gid]) for gid in buckets if buckets[gid]
    ]
    group_list.sort(key=lambda g: g.title.casefold())

    total_entries = sum(len(g.entries) for g in group_list)
    _log.info(
        "Verfuegbarkeit aktualisiert: groups=%s entries=%s organizer=%s event=%s",
        len(group_list),
        total_entries,
        settings.organizer,
        settings.event,
    )

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
