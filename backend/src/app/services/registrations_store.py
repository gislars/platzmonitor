"""SQLite store for aggregated conference registrations (counts per day, no PII)."""

from __future__ import annotations

import sqlite3
import threading
from pathlib import Path

from app.loggers import get_logger
from app.settings import _BACKEND_ROOT, Settings

_logger = get_logger("registrations_store")

_init_lock = threading.Lock()
_initialized_paths: set[str] = set()


def _db_path(settings: Settings) -> Path:
    raw = settings.registrations_db_path.strip() or "data/registrations.sqlite"
    p = Path(raw)
    if not p.is_absolute():
        return (_BACKEND_ROOT / p).resolve()
    return p.resolve()


def _ensure_schema(conn: sqlite3.Connection) -> None:
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS event (
            slug TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            start_date TEXT NOT NULL,
            source TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS registration_daily (
            event_slug TEXT NOT NULL,
            snapshot_date TEXT NOT NULL,
            online_total INTEGER NOT NULL DEFAULT 0,
            onsite_total INTEGER,
            PRIMARY KEY (event_slug, snapshot_date),
            FOREIGN KEY (event_slug) REFERENCES event(slug)
        )
        """
    )


def init_registrations_store(settings: Settings) -> None:
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


def upsert_event(
    settings: Settings,
    *,
    slug: str,
    label: str,
    start_date: str,
    source: str,
) -> None:
    init_registrations_store(settings)
    path = _db_path(settings)
    try:
        with sqlite3.connect(path) as conn:
            _ensure_schema(conn)
            conn.execute(
                """
                INSERT INTO event (slug, label, start_date, source)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(slug) DO UPDATE SET
                  label=excluded.label,
                  start_date=excluded.start_date,
                  source=excluded.source
                """,
                (slug, label, start_date, source),
            )
            conn.commit()
    except (OSError, sqlite3.Error):
        _logger.exception("upsert_event failed")


def record_daily(
    settings: Settings,
    *,
    event_slug: str,
    snapshot_date: str,
    online_total: int,
    onsite_total: int | None,
) -> None:
    init_registrations_store(settings)
    path = _db_path(settings)
    try:
        with sqlite3.connect(path) as conn:
            _ensure_schema(conn)
            conn.execute(
                """
                INSERT INTO registration_daily
                  (event_slug, snapshot_date, online_total, onsite_total)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(event_slug, snapshot_date) DO UPDATE SET
                  online_total=excluded.online_total,
                  onsite_total=excluded.onsite_total
                """,
                (event_slug, snapshot_date, online_total, onsite_total),
            )
            conn.commit()
    except (OSError, sqlite3.Error):
        _logger.exception("record_daily failed")


def read_all(
    settings: Settings,
) -> list[tuple[str, str, str, str, list[tuple[str, int, int | None]]]]:
    """(slug, label, start_date, source, daily points) matching event order."""
    init_registrations_store(settings)
    path = _db_path(settings)
    ordered_slugs: list[str] = []
    meta: dict[str, tuple[str, str, str]] = {}
    points: dict[str, list[tuple[str, int, int | None]]] = {}

    try:
        with sqlite3.connect(path) as conn:
            _ensure_schema(conn)
            erows = conn.execute(
                "SELECT slug, label, start_date, source FROM event "
                "ORDER BY start_date ASC, slug ASC"
            ).fetchall()
            dro = conn.execute(
                """
                SELECT event_slug, snapshot_date, online_total, onsite_total
                FROM registration_daily
                ORDER BY event_slug, snapshot_date ASC
                """
            ).fetchall()
    except (OSError, sqlite3.Error):
        _logger.exception("read_all failed")
        return []

    for slug, label, sd, src in erows:
        ordered_slugs.append(slug)
        meta[slug] = (label, sd, src)
        points[slug] = []

    for ev_slug, sdate, online, onsite in dro:
        if ev_slug not in points:
            continue
        points[ev_slug].append((sdate, int(online), int(onsite) if onsite is not None else None))

    return [
        (slug, meta[slug][0], meta[slug][1], meta[slug][2], points[slug]) for slug in ordered_slugs
    ]
