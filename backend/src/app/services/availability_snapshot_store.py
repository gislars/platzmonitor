from __future__ import annotations

import sqlite3
import threading
from datetime import datetime
from pathlib import Path

from app.loggers import get_logger
from app.models.schema import (
    AvailabilityFinite,
    AvailabilityResponse,
    AvailabilityUnlimited,
    Entry,
    EventInfo,
    Group,
)
from app.settings import _BACKEND_ROOT, Settings

_log = get_logger("availability_snapshot_store")

_init_lock = threading.Lock()
_initialized_paths: set[str] = set()


def _db_path(settings: Settings) -> Path:
    # Eigenes DB-File, getrennt von history.sqlite (Zeitreihen).
    raw = "data/availability_snapshots.sqlite"
    p = Path(raw)
    if not p.is_absolute():
        return (_BACKEND_ROOT / p).resolve()
    return p.resolve()


def _ensure_schema(conn: sqlite3.Connection) -> None:
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS availability_snapshot (
            event_slug TEXT PRIMARY KEY,
            fetched_at TEXT NOT NULL,
            organizer TEXT NOT NULL,
            title TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS availability_group (
            event_slug TEXT NOT NULL,
            group_id TEXT NOT NULL,
            title TEXT NOT NULL,
            PRIMARY KEY (event_slug, group_id)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS availability_entry (
            event_slug TEXT NOT NULL,
            entry_id TEXT NOT NULL,
            label TEXT NOT NULL,
            group_id TEXT NOT NULL,
            status TEXT NOT NULL,
            sort_at TEXT,
            pretalx_code TEXT,
            avail_kind TEXT NOT NULL,
            avail_free INTEGER,
            avail_total INTEGER,
            waiting_list_enabled INTEGER NOT NULL,
            waiting_list_count INTEGER,
            transaction_booked INTEGER,
            PRIMARY KEY (event_slug, entry_id)
        )
        """
    )


def init_snapshot_store(settings: Settings) -> None:
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


def write_snapshot(settings: Settings, snap: AvailabilityResponse) -> None:
    init_snapshot_store(settings)
    path = _db_path(settings)
    ev_slug = snap.event.slug

    g_rows: list[tuple[str, str, str]] = []
    e_rows: list[tuple] = []

    for g in snap.groups:
        g_rows.append((ev_slug, g.id, g.title))
        for e in g.entries:
            avail_kind = e.availability.kind
            free = None
            total = None
            if isinstance(e.availability, AvailabilityFinite):
                free = int(e.availability.free)
                total = int(e.availability.total) if e.availability.total is not None else None
            e_rows.append(
                (
                    ev_slug,
                    e.id,
                    e.label,
                    e.group_id,
                    e.status,
                    e.sort_at.isoformat() if e.sort_at is not None else None,
                    e.pretalx_code,
                    avail_kind,
                    free,
                    total,
                    1 if e.waiting_list_enabled else 0,
                    int(e.waiting_list_count)
                    if e.waiting_list_count is not None
                    else None,
                    int(e.transaction_booked)
                    if e.transaction_booked is not None
                    else None,
                )
            )

    try:
        with sqlite3.connect(path) as conn:
            _ensure_schema(conn)
            conn.execute(
                """
                INSERT INTO availability_snapshot (event_slug, fetched_at, organizer, title)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(event_slug) DO UPDATE SET
                  fetched_at=excluded.fetched_at,
                  organizer=excluded.organizer,
                  title=excluded.title
                """,
                (
                    ev_slug,
                    snap.fetched_at.isoformat(),
                    snap.event.organizer,
                    snap.event.title,
                ),
            )
            conn.execute("DELETE FROM availability_group WHERE event_slug = ?", (ev_slug,))
            conn.execute("DELETE FROM availability_entry WHERE event_slug = ?", (ev_slug,))
            if g_rows:
                conn.executemany(
                    "INSERT INTO availability_group (event_slug, group_id, title) VALUES (?, ?, ?)",
                    g_rows,
                )
            if e_rows:
                conn.executemany(
                    """
                    INSERT INTO availability_entry (
                      event_slug, entry_id, label, group_id, status, sort_at, pretalx_code,
                      avail_kind, avail_free, avail_total,
                      waiting_list_enabled, waiting_list_count, transaction_booked
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    e_rows,
                )
            conn.commit()
    except (OSError, sqlite3.Error):
        _log.exception("snapshot write failed")


def read_snapshot(settings: Settings, event_slug: str) -> AvailabilityResponse | None:
    init_snapshot_store(settings)
    path = _db_path(settings)
    ev = event_slug.strip()
    if not ev:
        return None

    try:
        with sqlite3.connect(path) as conn:
            _ensure_schema(conn)
            m = conn.execute(
                """
                SELECT fetched_at, organizer, title
                FROM availability_snapshot
                WHERE event_slug = ?
                """,
                (ev,),
            ).fetchone()
            if not m:
                return None
            fetched_at_s, organizer, title = m
            g_rows = conn.execute(
                """
                SELECT group_id, title
                FROM availability_group
                WHERE event_slug = ?
                ORDER BY title ASC
                """,
                (ev,),
            ).fetchall()
            e_rows = conn.execute(
                """
                SELECT entry_id, label, group_id, status, sort_at, pretalx_code,
                       avail_kind, avail_free, avail_total,
                       waiting_list_enabled, waiting_list_count, transaction_booked
                FROM availability_entry
                WHERE event_slug = ?
                ORDER BY group_id ASC, label ASC
                """,
                (ev,),
            ).fetchall()
    except (OSError, sqlite3.Error):
        _log.exception("snapshot read failed")
        return None

    entries_by_group: dict[str, list[Entry]] = {gid: [] for gid, _ in g_rows}

    for (
        entry_id,
        label,
        group_id,
        status,
        sort_at_s,
        pretalx_code,
        avail_kind,
        avail_free,
        avail_total,
        wl_enabled,
        wl_count,
        tx_booked,
    ) in e_rows:
        if avail_kind == "finite":
            availability = AvailabilityFinite(
                free=int(avail_free or 0),
                total=int(avail_total) if avail_total is not None else None,
            )
        else:
            availability = AvailabilityUnlimited()

        sort_at = datetime.fromisoformat(sort_at_s) if sort_at_s else None
        e = Entry(
            id=str(entry_id),
            label=str(label),
            group_id=str(group_id),
            availability=availability,
            status=str(status),
            sort_at=sort_at,
            pretalx_code=str(pretalx_code) if pretalx_code is not None else None,
            waiting_list_enabled=bool(int(wl_enabled or 0)),
            waiting_list_count=int(wl_count) if wl_count is not None else None,
            transaction_booked=int(tx_booked) if tx_booked is not None else None,
        )
        entries_by_group.setdefault(str(group_id), []).append(e)

    groups: list[Group] = []
    for gid, gtitle in g_rows:
        groups.append(
            Group(
                id=str(gid),
                title=str(gtitle),
                entries=entries_by_group.get(str(gid), []),
            )
        )

    return AvailabilityResponse(
        fetched_at=datetime.fromisoformat(str(fetched_at_s)),
        event=EventInfo(organizer=str(organizer), slug=ev, title=str(title)),
        groups=groups,
    )

