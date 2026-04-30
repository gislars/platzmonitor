"""Oeffentliche Pretalx-Proxys und Druck-Schedule fuer Abfahrtsmonitor."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import JSONResponse, Response

from app.loggers import get_logger
from app.models.schema import ErrorBody
from app.pretalx.proxy import PretalxRawResult, fetch_pretalx_json_raw
from app.settings import get_settings

router = APIRouter(tags=["event"])
_log = get_logger("pretalx_public")

_schedule_print_logged: set[str] = set()


def reset_schedule_print_log_for_tests() -> None:
    """Nur fuer Tests: einmalige Logs zuruecksetzen."""
    _schedule_print_logged.clear()


def _log_schedule_print_once(key: str, msg: str) -> None:
    if key in _schedule_print_logged:
        return
    _schedule_print_logged.add(key)
    _log.warning("%s", msg)


def _raw_result_to_response(res: PretalxRawResult) -> Response | JSONResponse:
    if res.body is not None:
        return Response(
            content=res.body,
            media_type="application/json; charset=utf-8",
        )
    assert res.error_status is not None and res.error is not None
    return JSONResponse(
        status_code=res.error_status,
        content=res.error.model_dump(),
    )


@router.get(
    "/schedule",
    summary="Pretalx Fahrplan-Export (Roh-JSON)",
)
def get_schedule_proxy():
    settings = get_settings()
    res = fetch_pretalx_json_raw(
        settings,
        settings.pretalx_schedule_url,
        not_configured_error="schedule_not_configured",
        not_configured_message="PRETALX_SCHEDULE_URL ist nicht gesetzt.",
    )
    return _raw_result_to_response(res)


@router.get(
    "/widget-schedule",
    summary="Pretalx Widget-Schedule (Roh-JSON)",
)
def get_widget_schedule_proxy():
    settings = get_settings()
    res = fetch_pretalx_json_raw(
        settings,
        settings.pretalx_widget_url,
        not_configured_error="widget_schedule_not_configured",
        not_configured_message="PRETALX_WIDGET_URL ist nicht gesetzt.",
    )
    return _raw_result_to_response(res)


@router.get(
    "/schedule-print",
    summary="Eingefrorener Druck-Stand (JSON-Datei)",
)
def get_schedule_print():
    settings = get_settings()
    raw = settings.schedule_print_path.strip()
    if not raw:
        _log_schedule_print_once(
            "not_configured",
            "schedule-print: SCHEDULE_PRINT_PATH ist nicht gesetzt",
        )
        return JSONResponse(
            status_code=404,
            content=ErrorBody(
                error="schedule_print_not_configured",
                message="SCHEDULE_PRINT_PATH ist nicht konfiguriert.",
            ).model_dump(),
        )

    path = Path(raw)
    if not path.is_file():
        _log_schedule_print_once(
            "not_found",
            f"schedule-print: Datei fehlt unter {path}",
        )
        return JSONResponse(
            status_code=404,
            content=ErrorBody(
                error="schedule_print_not_found",
                message="Druck-Stand-Datei wurde nicht gefunden.",
            ).model_dump(),
        )

    try:
        data = path.read_bytes()
    except OSError as e:
        _log_schedule_print_once(
            "io",
            f"schedule-print: Lesen fehlgeschlagen: {e}",
        )
        return JSONResponse(
            status_code=503,
            content=ErrorBody(
                error="schedule_print_unavailable",
                message="Druck-Stand-Datei konnte nicht gelesen werden.",
            ).model_dump(),
        )

    try:
        json.loads(data.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        _log_schedule_print_once(
            "invalid_json",
            "schedule-print: Datei enthaelt kein gueltiges JSON",
        )
        return JSONResponse(
            status_code=500,
            content=ErrorBody(
                error="schedule_print_invalid_json",
                message="Druck-Stand-Datei ist kein gueltiges JSON.",
            ).model_dump(),
        )

    return Response(
        content=data,
        media_type="application/json; charset=utf-8",
    )
