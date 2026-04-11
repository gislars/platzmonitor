from __future__ import annotations

from app.settings import Settings

_FALLBACK_UA = "fossgis-platzmonitor/0.1.0"


def user_agent(settings: Settings) -> str:
    s = settings.http_user_agent.strip()
    return s if s else _FALLBACK_UA


def pretix_headers(settings: Settings, token: str) -> dict[str, str]:
    return {
        "Authorization": f"Token {token}",
        "Accept": "application/json",
        "User-Agent": user_agent(settings),
    }


def pretalx_headers(settings: Settings) -> dict[str, str]:
    return {
        "Accept": "application/json",
        "User-Agent": user_agent(settings),
    }
