from __future__ import annotations

from typing import Any

import httpx

from app.outgoing_http import pretix_headers
from app.settings import Settings


def paginate_get(client: httpx.Client, start_url: str) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    url: str | None = start_url
    while url:
        r = client.get(url)
        r.raise_for_status()
        data = r.json()
        if isinstance(data, list):
            results.extend(data)
            break
        batch = data.get("results", [])
        if isinstance(batch, list):
            results.extend(batch)
        url = data.get("next")
    return results


def fetch_event(settings: Settings) -> dict[str, Any]:
    """Metadaten zur Veranstaltung (pretix Event-Ressource)."""
    base = settings.pretix_base_url.rstrip("/")
    token = settings.pretix_token.strip()
    if not token:
        raise ValueError("PRETIX_TOKEN fehlt")

    org = settings.organizer.strip()
    ev = settings.event.strip()
    url = f"{base}/api/v1/organizers/{org}/events/{ev}/"

    with httpx.Client(
        headers=pretix_headers(settings, token),
        timeout=60.0,
        follow_redirects=True,
    ) as client:
        r = client.get(url)
        r.raise_for_status()
        data = r.json()
        if not isinstance(data, dict):
            raise ValueError("pretix Event: unerwartetes JSON")
        return data


def fetch_items_and_quotas(settings: Settings) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    base = settings.pretix_base_url.rstrip("/")
    token = settings.pretix_token.strip()
    if not token:
        raise ValueError("PRETIX_TOKEN fehlt")

    org = settings.organizer.strip()
    ev = settings.event.strip()
    api = f"{base}/api/v1/organizers/{org}/events/{ev}"

    with httpx.Client(
        headers=pretix_headers(settings, token),
        timeout=60.0,
        follow_redirects=True,
    ) as client:
        items = paginate_get(client, f"{api}/items/")
        quotas = paginate_get(client, f"{api}/quotas/?with_availability=true")
    return items, quotas


def fetch_waiting_list_entries(settings: Settings) -> tuple[list[dict[str, Any]], bool]:
    """Wartelisteneinträge ohne ausgestellten Gutschein. Rückgabe: (Einträge, ok).

    Bei 401/403 oder Netzwerkfehler: ([], False); im JSON dann `waitingListCount: null`.
    """
    base = settings.pretix_base_url.rstrip("/")
    token = settings.pretix_token.strip()
    if not token:
        return [], False

    org = settings.organizer.strip()
    ev = settings.event.strip()
    start_url = f"{base}/api/v1/organizers/{org}/events/{ev}/waitinglistentries/?has_voucher=false"

    results: list[dict[str, Any]] = []
    url: str | None = start_url
    try:
        with httpx.Client(
            headers=pretix_headers(settings, token),
            timeout=60.0,
            follow_redirects=True,
        ) as client:
            while url:
                r = client.get(url)
                if r.status_code in (401, 403):
                    return [], False
                r.raise_for_status()
                data = r.json()
                if isinstance(data, list):
                    results.extend(data)
                    break
                batch = data.get("results", [])
                if isinstance(batch, list):
                    results.extend(batch)
                url = data.get("next")
    except httpx.HTTPStatusError:
        return [], False
    except httpx.RequestError:
        return [], False

    return results, True
