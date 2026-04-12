"""Kurze Logger-Namen unter dem Praefix ``pm`` (siehe Logging-Plan)."""

from __future__ import annotations

import logging


def get_logger(component: str) -> logging.Logger:
    """Liefert Logger `pm.<component>` (z. B. main, availability, pretix)."""
    return logging.getLogger(f"pm.{component}")
