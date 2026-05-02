"""SQLite persistence for hourly workshop quota snapshots (DSGVO: aggregate counts only)."""

from __future__ import annotations

import sqlite3
import threading
from datetime import UTC, datetime
from pathlib import Path

from app.loggers import get_logger
from app.models.schema import AvailabilityResponse, Entry
from app.settings import _BACKEND_ROOT, Settings

_logger = get_logger("history_store")

_init_lock = threading.Lock()
_initialized_paths: set[str] = set()
_last_cleanup_iso_date: dict[str, str] = {}  # path -> UTC date YYYY-MM-DD


def _db_path(settings: Settings) -> Path:
    raw = settings.history_db_path.strip() or "data/history.sqlite"
    p = Path(raw)
    if not p.is_absolute():
        return (_BACKEND_ROOT / p).resolve()
    return p.resolve()


def _ensure_schema(conn: sqlite3.Connection) -> None:
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS availability_history (
            quota_id TEXT NOT NULL,
            bucket_at INTEGER NOT NULL,
            total INTEGER,
            free INTEGER,
            booked INTEGER,
            waiting INTEGER,
            PRIMARY KEY (quota_id, bucket_at)
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS ix_availability_history_bucket "
        "ON availability_history(bucket_at)"
    )


def init_history_store(settings: Settings) -> None:
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


def _entry_row(entry: Entry) -> tuple[int | None, int | None, int | None, int]:
    wl = entry.waiting_list_count
    waiting_val = int(wl) if wl is not None else 0

    avail = entry.availability
    if avail.kind == "unlimited":
        return None, None, None, waiting_val

    total = avail.total
    free = avail.free
    booked: int | None
    if total is not None:
        booked = max(0, int(total) - int(free))
    else:
        booked = None

    tv = int(total) if total is not None else None
    fv = int(free)
    return tv, fv, booked, waiting_val


def _maybe_cleanup(settings: Settings, conn: sqlite3.Connection) -> None:
    retention = settings.history_retention_days
    if retention <= 0:
        return

    today = datetime.now(UTC).date().isoformat()
    path_key = str(_db_path(settings))
    if _last_cleanup_iso_date.get(path_key) == today:
        return

    cutoff = int(datetime.now(UTC).timestamp()) - retention * 86400
    cur = conn.execute("DELETE FROM availability_history WHERE bucket_at < ?", (cutoff,))
    deleted = cur.rowcount if cur.rowcount is not None else 0
    conn.commit()
    _last_cleanup_iso_date[path_key] = today
    if deleted:
        _logger.debug(
            "history cleanup removed %s rows older than retention_days=%s",
            deleted,
            retention,
        )


def record_snapshot(
    snap: AvailabilityResponse,
    settings: Settings,
) -> None:
    """Persist one logical row per (quota_id, Zeit-Bucket); letzte Messung ueberschreibt aeltere."""
    init_history_store(settings)
    path = _db_path(settings)
    bucket_seconds = settings.history_bucket_seconds
    ts = snap.fetched_at.timestamp()
    bucket_at = int(ts // bucket_seconds) * bucket_seconds

    rows: list[tuple[str, int, int | None, int | None, int | None, int]] = []

    for group in snap.groups:
        for entry in group.entries:
            total, free, booked, waiting = _entry_row(entry)
            rows.append((entry.id, bucket_at, total, free, booked, waiting))

    if not rows:
        return

    try:
        with sqlite3.connect(path) as conn:
            _ensure_schema(conn)
            _maybe_cleanup(settings, conn)
            conn.executemany(
                """
                INSERT INTO availability_history
                  (quota_id, bucket_at, total, free, booked, waiting)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(quota_id, bucket_at) DO UPDATE SET
                  total = excluded.total,
                  free = excluded.free,
                  booked = excluded.booked,
                  waiting = excluded.waiting
                """,
                rows,
            )
            conn.commit()
    except OSError:
        _logger.exception("history_store: cannot write %s", path)
    except sqlite3.Error:
        _logger.exception("history_store: sqlite error on %s", path)


def get_first_recorded_bucket(settings: Settings) -> int | None:
    init_history_store(settings)
    path = _db_path(settings)
    try:
        with sqlite3.connect(path) as conn:
            _ensure_schema(conn)
            row = conn.execute(
                "SELECT MIN(bucket_at) FROM availability_history",
            ).fetchone()
    except OSError:
        return None
    except sqlite3.Error:
        return None
    if not row or row[0] is None:
        return None
    return int(row[0])


def cleanup_older_than(settings: Settings, retention_days: int) -> int:
    """Manual cleanup; retention_days<=0 clears nothing."""
    if retention_days <= 0:
        return 0
    init_history_store(settings)
    path = _db_path(settings)
    cutoff = int(datetime.now(UTC).timestamp()) - retention_days * 86400
    try:
        with sqlite3.connect(path) as conn:
            _ensure_schema(conn)
            cur = conn.execute(
                "DELETE FROM availability_history WHERE bucket_at < ?",
                (cutoff,),
            )
            conn.commit()
            return int(cur.rowcount or 0)
    except (OSError, sqlite3.Error):
        _logger.exception("history cleanup failed")
        return 0


def read_history(
    settings: Settings,
    *,
    quota_ids: list[str] | None,
    since_epoch: int | None,
    until_epoch: int | None,
) -> dict[str, list[dict[str, int | float | None]]]:
    """Return quota_id -> list of point dicts sorted by bucket time ascending."""
    init_history_store(settings)
    path = _db_path(settings)
    params: list[int | str] = []
    where = ["1=1"]
    if since_epoch is not None:
        where.append("bucket_at >= ?")
        params.append(since_epoch)
    if until_epoch is not None:
        where.append("bucket_at <= ?")
        params.append(until_epoch)
    if quota_ids:
        placeholders = ",".join("?" for _ in quota_ids)
        where.append(f"quota_id IN ({placeholders})")
        params.extend(quota_ids)

    sql = f"""
      SELECT quota_id, bucket_at, total, free, booked, waiting
      FROM availability_history
      WHERE {" AND ".join(where)}
      ORDER BY bucket_at ASC
    """

    series: dict[str, list[dict[str, int | float | None]]] = {}

    try:
        with sqlite3.connect(path) as conn:
            _ensure_schema(conn)
            rows = conn.execute(sql, params).fetchall()
    except (OSError, sqlite3.Error):
        _logger.exception("read_history failed")
        return {}

    for qid, bucket_at, total, free, booked, waiting in rows:
        series.setdefault(qid, []).append(
            {
                "t": bucket_at,
                "total": total,
                "free": free,
                "booked": booked,
                "waiting": waiting,
            }
        )

    for pts in series.values():
        pts.sort(key=lambda p: int(p["t"]))
    return series
