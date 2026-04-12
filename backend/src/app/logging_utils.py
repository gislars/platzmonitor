"""Hilfen fuer sichere Log-Ausgaben (keine Secrets in URLs)."""

from __future__ import annotations

from urllib.parse import urlparse, urlunparse


def safe_url_for_log(url: str) -> str:
    """Entfernt Query und Fragment, damit keine Token in Query-Parametern geloggt werden."""
    s = url.strip()
    if not s:
        return ""
    try:
        p = urlparse(s)
        return urlunparse((p.scheme, p.netloc, p.path, "", "", ""))
    except Exception:
        return "[ungueltige URL]"
