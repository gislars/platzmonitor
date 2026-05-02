from __future__ import annotations

import threading

import httpx

from app.loggers import get_logger
from app.models.schema import AvailabilityResponse
from app.services.availability_service import build_availability
from app.settings import Settings

logger = get_logger("cache")

_lock = threading.Lock()
_snapshot: AvailabilityResponse | None = None
_last_error: str | None = None


def refresh_availability_snapshot(settings: Settings) -> None:
    """Quellen abrufen und Snapshot setzen. Bei Fehler bleibt ein vorheriger Snapshot erhalten."""
    global _snapshot, _last_error
    try:
        data = build_availability(settings)
    except ValueError as e:
        msg = str(e)
        logger.warning("availability refresh: configuration: %s", msg)
        with _lock:
            _last_error = msg
        return
    except httpx.HTTPStatusError as e:
        msg = f"pretix HTTP {e.response.status_code}"
        logger.warning("availability refresh: %s", msg)
        with _lock:
            _last_error = msg
        return
    except httpx.RequestError as e:
        msg = str(e)
        logger.warning("availability refresh: pretix unreachable: %s", msg)
        with _lock:
            _last_error = msg
        return
    except Exception:
        logger.exception("availability refresh: unexpected error")
        with _lock:
            _last_error = "Unerwarteter Fehler beim Aktualisieren der Verfügbarkeit"
        return

    client_snapshot = data

    try:
        from app.services.history_store import record_snapshot

        record_snapshot(data, settings)
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

        try_refresh_after_snapshot(settings, snapshot=data)
        client_snapshot = attach_latest_bookings_to_snapshot(settings, data)
    except Exception:
        logger.warning(
            "availability: booking_timeline refresh failed (non-fatal)",
            exc_info=True,
        )

    with _lock:
        _snapshot = client_snapshot
        _last_error = None


def get_availability_snapshot() -> tuple[AvailabilityResponse | None, str | None]:
    """Letzten erfolgreichen Snapshot und optional letzte Fehlermeldung (wenn kein Snapshot)."""
    with _lock:
        return _snapshot, _last_error
