"""Kumulativer Workshop-/Exkursions-Verlauf aus pretix-Transaktionen (tägliche Stufen, UTC)."""

from __future__ import annotations

import sqlite3
import threading
import time
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import httpx

from app.loggers import get_logger
from app.models.schema import AvailabilityResponse, AvailabilityUnlimited, Entry, Group
from app.outgoing_http import pretix_headers
from app.pretix.client import fetch_items_and_quotas, paginate_get
from app.settings import _BACKEND_ROOT, Settings

_log = get_logger("booking_timeline")

_init_lock = threading.Lock()
_initialized_paths: set[str] = set()
_write_lock = threading.Lock()
_last_refresh_monotonic: float | None = None

_ITEM_CHUNK = 45


def _db_path(settings: Settings) -> Path:
    raw = settings.booking_timeline_db_path.strip() or "data/booking_timeline.sqlite"
    p = Path(raw)
    if not p.is_absolute():
        return (_BACKEND_ROOT / p).resolve()
    return p.resolve()


def _ensure_schema(conn: sqlite3.Connection) -> None:
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS quota_tx_daily (
            quota_id TEXT NOT NULL,
            day_start_epoch INTEGER NOT NULL,
            cumulative INTEGER NOT NULL,
            PRIMARY KEY (quota_id, day_start_epoch)
        )
        """
    )


def init_booking_timeline_store(settings: Settings) -> None:
    path = _db_path(settings)
    path.parent.mkdir(parents=True, exist_ok=True)
    key = str(path)
    with _init_lock:
        if key in _initialized_paths:
            return
        with sqlite3.connect(path) as conn:
            _ensure_schema(conn)
            conn.commit()
        _initialized_paths.add(key)


def _utc_date_from_pretix_dt(raw: str) -> date:
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    dt = datetime.fromisoformat(raw)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC).date()


def _day_start_epoch(d: date) -> int:
    return int(datetime(d.year, d.month, d.day, tzinfo=UTC).timestamp())


def _tx_matches_quota(tx: dict[str, Any], quota: dict[str, Any]) -> bool:
    raw_item = tx.get("item")
    if raw_item is None:
        return False
    try:
        tx_item = int(raw_item)
    except (TypeError, ValueError):
        return False
    q_items = {int(x) for x in (quota.get("items") or []) if x is not None}
    if tx_item not in q_items:
        return False

    qs = quota.get("subevent")
    tx_sub_ev = tx.get("subevent")
    if qs is not None:
        try:
            qsv = int(qs)
        except (TypeError, ValueError):
            qsv = None
        if qsv is not None:
            if tx_sub_ev is None:
                return False
            try:
                if int(tx_sub_ev) != qsv:
                    return False
            except (TypeError, ValueError):
                return False

    q_vars_raw = quota.get("variations") or []
    q_vars = {int(x) for x in q_vars_raw if x is not None}
    tv = tx.get("variation")
    try:
        tx_var = None if tv is None else int(tv)
    except (TypeError, ValueError):
        tx_var = None

    if not q_vars:
        return True
    if tx_var is None:
        return False
    return tx_var in q_vars


def _transactions_for_items_chunk(
    settings: Settings,
    item_ids_chunk: tuple[int, ...],
) -> list[dict[str, Any]]:
    base = settings.pretix_base_url.rstrip("/")
    token = settings.pretix_token.strip()
    if not token:
        raise ValueError("PRETIX_TOKEN fehlt")
    org = settings.organizer.strip()
    ev = settings.event.strip()

    qs = ",".join(str(i) for i in item_ids_chunk)
    url = (
        f"{base}/api/v1/organizers/{org}/events/{ev}/transactions/?"
        f"{urlencode([('item__in', qs), ('ordering', 'datetime')])}"
    )

    results: list[dict[str, Any]] = []
    with httpx.Client(
        headers=pretix_headers(settings, token),
        timeout=120.0,
        follow_redirects=True,
    ) as client:
        results = paginate_get(client, url)
    seen: set[Any] = set()
    uniq: list[dict[str, Any]] = []
    for tx in results:
        tid = tx.get("id")
        dedup_k = tid if tid is not None else (
            tx.get("datetime"),
            tx.get("item"),
            tx.get("variation"),
            tx.get("count"),
        )
        if dedup_k in seen:
            continue
        seen.add(dedup_k)
        uniq.append(tx)
    return uniq


def _fetch_all_transactions_for_items(
    settings: Settings,
    item_ids: list[int],
) -> list[dict[str, Any]]:
    if not item_ids:
        return []
    out: list[dict[str, Any]] = []
    for i in range(0, len(item_ids), _ITEM_CHUNK):
        chunk = tuple(item_ids[i : i + _ITEM_CHUNK])
        out.extend(_transactions_for_items_chunk(settings, chunk))
    return out


def _rebuild_from_snapshot(settings: Settings, snapshot: AvailabilityResponse) -> None:
    init_booking_timeline_store(settings)
    token = settings.pretix_token.strip()
    if not token:
        _log.debug("booking_timeline: kein Token, ueberspringe")
        return

    target_ids = {
        e.id
        for g in snapshot.groups
        if g.id in ("workshops", "excursions")
        for e in g.entries
    }
    if not target_ids:
        return

    items, quotas = fetch_items_and_quotas(settings)
    quotas_by_id: dict[str, dict[str, Any]] = {}
    for q in quotas:
        qid = str(q.get("id"))
        if qid in target_ids:
            quotas_by_id[qid] = q

    if not quotas_by_id:
        return

    item_ids = sorted(
        {int(i) for q in quotas_by_id.values() for i in (q.get("items") or []) if i is not None}
    )
    try:
        txs = _fetch_all_transactions_for_items(settings, item_ids)
    except httpx.HTTPStatusError as e:
        _log.warning("booking_timeline: pretix transactions HTTP %s", e.response.status_code)
        return
    except httpx.RequestError as e:
        _log.warning("booking_timeline: pretix transactions Netz: %s", e)
        return
    except ValueError as e:
        _log.warning("booking_timeline: %s", e)
        return

    delta_by_q: dict[str, dict[date, int]] = defaultdict(lambda: defaultdict(int))

    for tx in txs:
        raw_dt = tx.get("datetime")
        if not isinstance(raw_dt, str):
            continue
        try:
            cnt = int(tx.get("count") or 0)
        except (TypeError, ValueError):
            continue
        if cnt == 0:
            continue
        try:
            d = _utc_date_from_pretix_dt(raw_dt)
        except ValueError:
            continue

        matched: list[str] = []
        for qid, q in quotas_by_id.items():
            if _tx_matches_quota(tx, q):
                matched.append(qid)
        if not matched:
            continue
        if len(matched) > 1:
            _log.debug(
                "booking_timeline: Transaktion ordnet mehreren Quotas zu, nutze erste: %s",
                matched,
            )
        qid0 = matched[0]
        delta_by_q[qid0][d] += cnt

    rows: list[tuple[str, int, int]] = []
    for qid, daymap in delta_by_q.items():
        if not daymap:
            continue
        touched_dates = sorted(daymap)
        d_first, d_last = touched_dates[0], touched_dates[-1]
        cum = 0
        cur = d_first
        while cur <= d_last:
            cum += daymap.get(cur, 0)
            rows.append((qid, _day_start_epoch(cur), cum))
            cur += timedelta(days=1)

    path = _db_path(settings)
    with sqlite3.connect(path) as conn:
        _ensure_schema(conn)
        quota_keys = tuple(quotas_by_id.keys())
        if quota_keys:
            ph = ",".join("?" for _ in quota_keys)
            conn.execute(f"DELETE FROM quota_tx_daily WHERE quota_id IN ({ph})", quota_keys)
        if rows:
            conn.executemany(
                """
                INSERT INTO quota_tx_daily (quota_id, day_start_epoch, cumulative)
                VALUES (?, ?, ?)
                """,
                rows,
            )
        conn.commit()
    _log.info(
        "booking_timeline: Zeilen geschrieben=%s txs=%s quotas=%s",
        len(rows),
        len(txs),
        len(delta_by_q),
    )


def try_refresh_after_snapshot(settings: Settings, snapshot: AvailabilityResponse) -> None:
    """Nach erfolgreicher Verfuegbarkeit Neuaufbau, gedrosselt per TTL."""
    global _last_refresh_monotonic  # noqa: PLW0603
    ttl = float(max(60, settings.booking_timeline_refresh_seconds))
    with _write_lock:
        now_m = time.monotonic()
        if _last_refresh_monotonic is not None and now_m - _last_refresh_monotonic < ttl:
            return
        try:
            _rebuild_from_snapshot(settings, snapshot)
        except Exception:
            _log.exception("booking_timeline: Neuaufbau fehlgeschlagen")
            return
        _last_refresh_monotonic = time.monotonic()


def read_series(
    settings: Settings,
    quota_ids: list[str],
) -> dict[str, list[dict[str, int]]]:
    """quota_id -> Liste {t, booked} sortiert nach t."""
    init_booking_timeline_store(settings)
    if not quota_ids:
        return {}
    path = _db_path(settings)
    placeholders = ",".join("?" for _ in quota_ids)
    sql = f"""
      SELECT quota_id, day_start_epoch, cumulative
      FROM quota_tx_daily
      WHERE quota_id IN ({placeholders})
      ORDER BY quota_id, day_start_epoch ASC
    """
    out: dict[str, list[dict[str, int]]] = {q: [] for q in quota_ids}
    try:
        with sqlite3.connect(path) as conn:
            _ensure_schema(conn)
            rows = conn.execute(sql, quota_ids).fetchall()
    except (OSError, sqlite3.Error):
        _log.exception("booking_timeline: read_series")
        return {q: [] for q in quota_ids}

    for qid, t0, cumulative in rows:
        if qid not in out:
            continue
        out[qid].append({"t": int(t0), "booked": int(cumulative)})
    return out


def read_latest_cumulative(settings: Settings, quota_ids: list[str]) -> dict[str, int]:
    """Pro Quota-ID der zuletzt gespeicherte kumulative Transaktionswert (timeline-DB)."""
    if not quota_ids:
        return {}
    init_booking_timeline_store(settings)
    path = _db_path(settings)
    placeholders = ",".join("?" for _ in quota_ids)
    sql = f"""
      SELECT q.quota_id, q.cumulative
      FROM quota_tx_daily q
      WHERE q.quota_id IN ({placeholders})
        AND q.day_start_epoch = (
          SELECT MAX(q2.day_start_epoch)
          FROM quota_tx_daily q2
          WHERE q2.quota_id = q.quota_id
        )
    """
    out: dict[str, int] = {}
    try:
        with sqlite3.connect(path) as conn:
            _ensure_schema(conn)
            rows = conn.execute(sql, quota_ids).fetchall()
    except (OSError, sqlite3.Error):
        _log.exception("booking_timeline: read_latest_cumulative")
        return {}
    for qid, cumulative in rows:
        out[str(qid)] = int(cumulative)
    return out


def attach_latest_bookings_to_snapshot(settings: Settings, snapshot: AvailabilityResponse) -> AvailabilityResponse:
    """Reichert unlimited-Quota-Einträge mit dem letzten timeline-Kumulativ an (Balkendiagramm)."""
    quota_ids = [
        e.id
        for g in snapshot.groups
        for e in g.entries
        if isinstance(e.availability, AvailabilityUnlimited)
    ]
    latest = read_latest_cumulative(settings, quota_ids)
    if not latest:
        return snapshot
    new_groups: list[Group] = []
    for g in snapshot.groups:
        new_entries: list[Entry] = []
        for e in g.entries:
            if isinstance(e.availability, AvailabilityUnlimited):
                cum = latest.get(e.id)
                if cum is not None:
                    new_entries.append(e.model_copy(update={"transaction_booked": cum}))
                    continue
            new_entries.append(e)
        new_groups.append(g.model_copy(update={"entries": new_entries}))
    return snapshot.model_copy(update={"groups": new_groups})
