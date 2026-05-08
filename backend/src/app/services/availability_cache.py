from __future__ import annotations

import threading

import httpx

from app.loggers import get_logger
from app.models.schema import AvailabilityResponse
from app.services import availability_snapshot_store
from app.services.availability_service import build_availability
from app.services.events_catalog import is_event_frozen, settings_for_event
from app.settings import Settings

logger = get_logger("cache")

_lock = threading.Lock()
_snapshots: dict[str, AvailabilityResponse] = {}
_last_error_by_event: dict[str, str] = {}


def refresh_availability_snapshot(settings: Settings, *, event: str | None = None) -> None:
    """Quellen abrufen und Snapshot setzen. Bei Fehler bleibt ein vorheriger Snapshot erhalten.

    Wenn das Event eingefroren ist, wird stattdessen der persistierte Snapshot geladen.
    """
    ev = (event or settings.event).strip()
    if not ev:
        return

    if is_event_frozen(settings, ev):
        # Eingefroren: bevorzugt aus persistentem Snapshot liefern.
        snap = availability_snapshot_store.read_snapshot(settings, ev)
        if snap is not None:
            with _lock:
                _snapshots[ev] = snap
                _last_error_by_event.pop(ev, None)
            return

        # Snapshot fehlt: einmalig bootstrap aus pretix, danach persistieren
        # und ab dann pretix-frei.
        # (Ohne dieses Bootstrap koennen alte Events nie angezeigt werden, wenn der Snapshot nie
        # erstellt wurde.)
        logger.info("availability: bootstrap snapshot for frozen event=%s", ev)
        # Weiter unten normaler Build-Pfad (pretix) mit effective Settings.

    effective = settings_for_event(settings, ev)
    try:
        data = build_availability(effective)
    except ValueError as e:
        msg = str(e)
        logger.warning("availability refresh: configuration: %s", msg)
        with _lock:
            _last_error_by_event[ev] = msg
        return
    except httpx.HTTPStatusError as e:
        msg = f"pretix HTTP {e.response.status_code}"
        logger.warning("availability refresh: %s", msg)
        with _lock:
            _last_error_by_event[ev] = msg
        return
    except httpx.RequestError as e:
        msg = str(e)
        logger.warning("availability refresh: pretix unreachable: %s", msg)
        with _lock:
            _last_error_by_event[ev] = msg
        return
    except Exception:
        logger.exception("availability refresh: unexpected error")
        with _lock:
            _last_error_by_event[ev] = "Unerwarteter Fehler beim Aktualisieren der Verfügbarkeit"
        return

    client_snapshot = data

    try:
        from app.services.history_store import record_snapshot

        record_snapshot(data, effective)
    except Exception:
        logger.warning(
            "availability: history_store record_snapshot failed (non-fatal)",
            exc_info=True,
        )

    try:
        from app.services.booking_timeline import (
            attach_latest_bookings_to_snapshot,
            try_refresh_after_snapshot,
        )

        try_refresh_after_snapshot(effective, snapshot=data)
        client_snapshot = attach_latest_bookings_to_snapshot(effective, data)
    except Exception:
        logger.warning(
            "availability: booking_timeline refresh failed (non-fatal)",
            exc_info=True,
        )

    try:
        availability_snapshot_store.write_snapshot(settings, client_snapshot)
    except Exception:
        logger.warning("availability_snapshot_store write failed (non-fatal)", exc_info=True)

    with _lock:
        _snapshots[ev] = client_snapshot
        _last_error_by_event.pop(ev, None)


def get_availability_snapshot(
    settings: Settings, *, event: str
) -> tuple[AvailabilityResponse | None, str | None]:
    """Letzten Snapshot fuer Event und optional letzte Fehlermeldung."""
    ev = event.strip()
    if not ev:
        return None, "event_required"
    with _lock:
        return _snapshots.get(ev), _last_error_by_event.get(ev)


def ensure_availability_snapshot(settings: Settings, *, event: str) -> None:
    """Falls leer: einmalig versuchen zu laden oder aus persistentem Snapshot ziehen."""
    ev = event.strip()
    if not ev:
        return
    # Eingefrorenes Event: wenn die SQLite fehlt (z. B. geloescht), RAM aber noch alter Stand,
    # wuerde ohne diesen Schritt niemals neu gebaut.
    if is_event_frozen(settings, ev):
        persisted = availability_snapshot_store.read_snapshot(settings, ev)
        with _lock:
            mem = _snapshots.get(ev)
        if persisted is None and mem is not None:
            logger.info(
                "availability: RAM-Snapshot fuer event=%s verworfen (Persistenz fehlt), Neuaufbau",
                ev,
            )
            with _lock:
                _snapshots.pop(ev, None)
                _last_error_by_event.pop(ev, None)
            refresh_availability_snapshot(settings, event=ev)
            return
    with _lock:
        has = ev in _snapshots
    if has:
        return
    refresh_availability_snapshot(settings, event=ev)
