"""Gemeinsamer Pretalx-Rohabruf mit In-Memory-Cache fuer oeffentliche JSON-Proxys."""

from __future__ import annotations

import json
import time
from dataclasses import dataclass

import httpx

from app.loggers import get_logger
from app.models.schema import ErrorBody
from app.outgoing_http import pretalx_headers
from app.settings import Settings

_log = get_logger("pretalx.proxy")

# URL -> (cached_at_epoch, roher JSON-Body als bytes)
_cache: dict[str, tuple[float, bytes]] = {}


@dataclass(frozen=True)
class PretalxRawResult:
    body: bytes | None
    error_status: int | None
    error: ErrorBody | None


def _cache_ttl_seconds(settings: Settings) -> int:
    return max(1, int(settings.pretalx_schedule_cache_seconds))


def fetch_pretalx_json_raw(
    settings: Settings,
    url: str,
    *,
    not_configured_error: str,
    not_configured_message: str,
) -> PretalxRawResult:
    """
    Laedt JSON-Rohbytes von einer Pretalx-URL mit Cache.
    Bei leerer URL: 404 mit not_configured_error.
    """
    u = url.strip()
    if not u:
        return PretalxRawResult(
            body=None,
            error_status=404,
            error=ErrorBody(error=not_configured_error, message=not_configured_message),
        )

    now = time.time()
    ttl = float(_cache_ttl_seconds(settings))
    hit = _cache.get(u)
    if hit is not None:
        cached_at, cached_body = hit
        if now - cached_at < ttl:
            return PretalxRawResult(body=cached_body, error_status=None, error=None)

    try:
        with httpx.Client(timeout=30.0, follow_redirects=True) as client:
            r = client.get(u, headers=pretalx_headers(settings))
    except httpx.RequestError as e:
        _log.warning("Pretalx nicht erreichbar: %s", type(e).__name__)
        return PretalxRawResult(
            body=None,
            error_status=503,
            error=ErrorBody(
                error="pretalx_upstream_unavailable",
                message="Pretalx ist voruebergehend nicht erreichbar.",
            ),
        )

    if r.status_code >= 400:
        _log.warning("Pretalx HTTP %s", r.status_code)
        return PretalxRawResult(
            body=None,
            error_status=502,
            error=ErrorBody(
                error="pretalx_upstream_error",
                message=f"Pretalx hat HTTP {r.status_code} geliefert.",
            ),
        )

    body = r.content
    if not body.strip():
        return PretalxRawResult(
            body=None,
            error_status=502,
            error=ErrorBody(
                error="pretalx_upstream_error",
                message="Pretalx lieferte eine leere Antwort.",
            ),
        )

    try:
        json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        _log.warning("Pretalx-Antwort ist kein gueltiges JSON: %s", type(e).__name__)
        return PretalxRawResult(
            body=None,
            error_status=502,
            error=ErrorBody(
                error="pretalx_upstream_error",
                message="Pretalx lieferte kein gueltiges JSON.",
            ),
        )

    _cache[u] = (now, body)
    return PretalxRawResult(body=body, error_status=None, error=None)


def clear_proxy_cache_for_tests() -> None:
    """Nur fuer Tests."""
    _cache.clear()
