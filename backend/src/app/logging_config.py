from __future__ import annotations

import logging
import sys
from typing import Final

from app.settings import Settings

_DEFAULT_LOG_PATH: Final[str] = "/var/log/platzmonitor/app.log"

_configured = False


def _parse_level(name: str) -> int:
    n = name.strip().upper()
    if n.isdigit():
        return int(n)
    level = getattr(logging, n, None)
    if isinstance(level, int):
        return level
    return logging.INFO


def configure_logging(settings: Settings) -> None:
    """Richtet den Logger ``pm`` mit Datei-Handler ein (idempotent). Keine Rotation in der App."""
    global _configured
    if _configured:
        return

    effective = settings.log_file.strip() or _DEFAULT_LOG_PATH
    level = _parse_level(settings.log_level)

    fmt = logging.Formatter(
        fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    log_pm = logging.getLogger("pm")
    log_pm.setLevel(level)
    log_pm.propagate = False

    handler: logging.Handler
    try:
        handler = logging.FileHandler(effective, encoding="utf-8")
    except OSError as e:
        print(
            f"WARNING: Logdatei konnte nicht geoeffnet werden ({effective}): {e}",
            file=sys.stderr,
        )
        handler = logging.StreamHandler(sys.stderr)

    handler.setFormatter(fmt)
    log_pm.addHandler(handler)
    _configured = True
