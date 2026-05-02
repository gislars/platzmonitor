"""Aggregate pretix order transactions into daily cumulative registration counts (no PII)."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any
from urllib.parse import urlencode

import httpx

from app.loggers import get_logger
from app.outgoing_http import pretix_headers
from app.pretix.client import paginate_get
from app.services import registrations_store
from app.settings import Settings

_log = get_logger("registrations_agg")


class PretixAuthError(RuntimeError):
    pass


class PretixNotFoundError(RuntimeError):
    pass


class PretixHttpError(RuntimeError):
    pass


@dataclass(frozen=True)
class EventSpec:
    organizer: str
    event: str
    label: str
    """YYYY-MM-DD, first conference day reference for registrations API."""
    start_date: str
    online_item_ids: tuple[int, ...]
    onsite_item_ids: tuple[int, ...]
    since: date | None
    until: date | None


@dataclass(frozen=True)
class AggregateResult:
    transactions_read: int
    days_written: int
    date_min: date | None
    date_max: date | None


def _utc_date_from_pretix_dt(raw: str) -> date:
    """Parse pretix ISO timestamp; bucket by UTC calendar date (deterministic for reruns)."""
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    dt = datetime.fromisoformat(raw)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC).date()


def _daterangeInclusive(a: date, b: date) -> list[date]:
    out: list[date] = []
    cur = a
    while cur <= b:
        out.append(cur)
        cur += timedelta(days=1)
    return out


def aggregate_pretix_event(
    spec: EventSpec,
    settings: Settings,
    *,
    token: str,
    registrations_settings: Settings | None = None,
) -> AggregateResult:
    """Read pretix transactions, write cumulative daily totals into registrations SQLite."""
    store_settings = registrations_settings or settings
    registrations_store.init_registrations_store(store_settings)

    base = settings.pretix_base_url.rstrip("/")
    org = spec.organizer.strip()
    ev = spec.event.strip()

    tok = token.strip()
    if not tok:
        raise PretixAuthError("PRETIX_TOKEN fehlt")

    item_ids = sorted(set(spec.online_item_ids) | set(spec.onsite_item_ids))
    if not item_ids:
        raise ValueError("online_item_ids und onsite_item_ids duerfen nicht leer sein")

    online_set = set(spec.online_item_ids)
    onsite_set = set(spec.onsite_item_ids)

    params: list[tuple[str, str]] = [
        ("item__in", ",".join(str(i) for i in item_ids)),
        ("ordering", "datetime"),
    ]
    if spec.since:
        params.append(("datetime_since", f"{spec.since.isoformat()}T00:00:00Z"))
    if spec.until:
        ub = (spec.until + timedelta(days=1)).isoformat()
        params.append(("datetime_before", f"{ub}T00:00:00Z"))

    qstr = urlencode(params)

    url = f"{base}/api/v1/organizers/{org}/events/{ev}/transactions/?{qstr}"

    transactions: list[dict[str, Any]] = []
    try:
        with httpx.Client(
            headers=pretix_headers(settings, tok),
            timeout=120.0,
            follow_redirects=True,
        ) as client:
            transactions = paginate_get(client, url)
    except httpx.HTTPStatusError as e:
        code = e.response.status_code
        if code in (401, 403):
            raise PretixAuthError(f"Pretix HTTP {code}") from e
        if code == 404:
            raise PretixNotFoundError(f"Pretix HTTP {code}") from e
        raise PretixHttpError(f"Pretix HTTP {code}") from e
    except httpx.RequestError as e:
        raise PretixHttpError(str(e)) from e

    delta_online: defaultdict[date, int] = defaultdict(int)
    delta_onsite: defaultdict[date, int] = defaultdict(int)

    for tx in transactions:
        raw_dt = tx.get("datetime")
        if not isinstance(raw_dt, str):
            continue
        item_raw = tx.get("item")
        try:
            iid = int(item_raw)
        except (TypeError, ValueError):
            continue
        try:
            cnt = int(tx.get("count") or 0)
        except (TypeError, ValueError):
            continue

        try:
            d = _utc_date_from_pretix_dt(raw_dt)
        except ValueError:
            continue

        if iid in online_set:
            delta_online[d] += cnt
        elif iid in onsite_set:
            delta_onsite[d] += cnt

    touched = sorted(set(delta_online) | set(delta_onsite))
    if not touched:
        registrations_store.upsert_event(
            store_settings,
            slug=spec.event,
            label=spec.label,
            start_date=spec.start_date,
            source="pretix",
        )
        return AggregateResult(
            transactions_read=len(transactions), days_written=0, date_min=None, date_max=None
        )

    d_first, d_last = touched[0], touched[-1]
    all_days = _daterangeInclusive(d_first, d_last)

    cur_o = 0
    cur_os = 0
    registrations_store.upsert_event(
        store_settings,
        slug=spec.event,
        label=spec.label,
        start_date=spec.start_date,
        source="pretix",
    )

    written = 0
    for d in all_days:
        cur_o += delta_online[d]
        cur_os += delta_onsite[d]
        registrations_store.record_daily(
            store_settings,
            event_slug=spec.event,
            snapshot_date=d.isoformat(),
            online_total=cur_o,
            onsite_total=cur_os,
        )
        written += 1

    _log.info(
        "registrations_agg: slug=%s tx=%s days=%s",
        spec.event,
        len(transactions),
        written,
    )

    return AggregateResult(
        transactions_read=len(transactions),
        days_written=written,
        date_min=d_first,
        date_max=d_last,
    )
