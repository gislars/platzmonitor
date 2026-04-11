#!/usr/bin/env python3
"""
Einmaliger Abruf der pretix-REST-API (Items + Quotas mit Verfügbarkeit),
um IDs und Struktur für dashboard.json / die Umsetzung zu sammeln.

Umgebungsvariablen (oder backend/.env im übergeordneten Projekt):

  PRETIX_TOKEN      Team-API-Token (Pflicht)
  PRETIX_BASE_URL   Standard: https://pretix.eu
  PRETIX_ORGANIZER  Standard: fossgis
  PRETIX_EVENT      Standard: 2026

Aufruf:
  cd scripts && uv sync && uv run python pretix_discover.py
  PRETIX_TOKEN=... uv run python pretix_discover.py --write-json
  PRETIX_TOKEN=... uv run python pretix_discover.py --snapshot

--write-json schreibt scripts/output/items.json und quotas.json (nicht versionieren).
--snapshot schreibt eine Datei scripts/output/pretix_snapshot.json (Event + Items + Quotas),
  fuer einmaligen Offline-Import oder Tests ohne erneute API-Aufrufe.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

DEFAULT_BASE = "https://pretix.eu"
DEFAULT_ORG = "fossgis"
DEFAULT_EVENT = "2026"


def load_dotenv_file(path: Path) -> None:
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$", line)
        if not m:
            continue
        key, val = m.group(1), m.group(2).strip()
        if val.startswith('"') and val.endswith('"'):
            val = val[1:-1].replace('\\n', '\n')
        elif val.startswith("'") and val.endswith("'"):
            val = val[1:-1]
        if key not in os.environ:
            os.environ[key] = val


def paginate_get(
    client: httpx.Client,
    start_url: str,
) -> list[dict[str, Any]]:
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


def _localized_name(name_obj: Any) -> str:
    if isinstance(name_obj, str):
        return name_obj
    if isinstance(name_obj, dict):
        return (
            name_obj.get("de")
            or name_obj.get("en")
            or (next(iter(name_obj.values())) if name_obj else "")
            or ""
        )
    return str(name_obj) if name_obj is not None else ""


def main() -> int:
    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir.parent
    backend_env = repo_root / "backend" / ".env"
    load_dotenv_file(backend_env)

    p = argparse.ArgumentParser(description="pretix Items + Quoten für Dashboard-Plan auslesen")
    p.add_argument("--base-url", default=os.environ.get("PRETIX_BASE_URL", DEFAULT_BASE))
    p.add_argument("--organizer", default=os.environ.get("PRETIX_ORGANIZER", DEFAULT_ORG))
    p.add_argument("--event", default=os.environ.get("PRETIX_EVENT", DEFAULT_EVENT))
    p.add_argument(
        "--token",
        default=os.environ.get("PRETIX_TOKEN", ""),
        help="Team-API-Token (sonst Umgebungsvariable PRETIX_TOKEN)",
    )
    p.add_argument(
        "--write-json",
        action="store_true",
        help=f"Roher JSON-Dump nach {script_dir / 'output'} (items.json, quotas.json)",
    )
    p.add_argument(
        "--snapshot",
        action="store_true",
        help="Kombinierten JSON-Snapshot schreiben (siehe --snapshot-file)",
    )
    p.add_argument(
        "--snapshot-file",
        type=Path,
        default=None,
        help=f"Zieldatei fuer --snapshot (Standard: {script_dir / 'output' / 'pretix_snapshot.json'})",
    )
    args = p.parse_args()

    token = (args.token or "").strip()
    if not token:
        print(
            "Fehler: PRETIX_TOKEN fehlt. Setze die Variable oder nutze --token.\n"
            f"Optional: {backend_env} anlegen (siehe backend/.env.example).",
            file=sys.stderr,
        )
        return 1

    base = args.base_url.rstrip("/")
    org = args.organizer.strip()
    ev = args.event.strip()
    api = f"{base}/api/v1/organizers/{org}/events/{ev}"

    headers = {
        "Authorization": f"Token {token}",
        "Accept": "application/json",
    }

    print("=== pretix Discovery ===")
    print(f"Basis:     {base}")
    print(f"Organizer: {org}")
    print(f"Event:     {ev}")
    print()

    with httpx.Client(headers=headers, timeout=60.0, follow_redirects=True) as client:
        event_url = f"{api}/"
        items_url = f"{api}/items/"
        quotas_url = f"{api}/quotas/?with_availability=true"

        print("Abruf: GET .../events/<slug>/ (Event-Metadaten)")
        try:
            er = client.get(event_url)
            er.raise_for_status()
            event_data = er.json()
            if not isinstance(event_data, dict):
                print("Fehler Event: JSON ist kein Objekt", file=sys.stderr)
                return 1
        except httpx.HTTPStatusError as e:
            print(f"Fehler Event: HTTP {e.response.status_code}\n{e.response.text[:500]}", file=sys.stderr)
            return 1

        print("Abruf: GET .../items/ (alle Seiten)")
        try:
            items = paginate_get(client, items_url)
        except httpx.HTTPStatusError as e:
            print(f"Fehler Items: HTTP {e.response.status_code}\n{e.response.text[:500]}", file=sys.stderr)
            return 1

        print("Abruf: GET .../quotas/?with_availability=true (alle Seiten)")
        try:
            quotas = paginate_get(client, quotas_url)
        except httpx.HTTPStatusError as e:
            print(f"Fehler Quotas: HTTP {e.response.status_code}\n{e.response.text[:500]}", file=sys.stderr)
            return 1

    if args.write_json:
        out_dir = script_dir / "output"
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "items.json").write_text(
            json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        (out_dir / "quotas.json").write_text(
            json.dumps(quotas, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"JSON geschrieben: {out_dir / 'items.json'}")
        print(f"JSON geschrieben: {out_dir / 'quotas.json'}")
        print()

    if args.snapshot:
        snap_path = args.snapshot_file
        if snap_path is None:
            snap_path = script_dir / "output" / "pretix_snapshot.json"
        else:
            snap_path = snap_path.resolve()
        snap_path.parent.mkdir(parents=True, exist_ok=True)
        snapshot_body: dict[str, Any] = {
            "meta": {
                "pretix_base_url": base,
                "organizer": org,
                "event_slug": ev,
                "api_prefix": api,
                "exported_at": datetime.now(timezone.utc).isoformat(),
            },
            "event": event_data,
            "items": items,
            "quotas": quotas,
        }
        snap_path.write_text(
            json.dumps(snapshot_body, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"Snapshot geschrieben: {snap_path}")
        print()

    # Kurzübersicht der Artikel aus pretix
    print("--- Items (Überblick) ---")
    print(f"Anzahl: {len(items)}\n")
    for it in sorted(items, key=lambda x: (x.get("position") or 0, x.get("id") or 0)):
        iid = it.get("id")
        name = _localized_name(it.get("name"))
        var = it.get("variations") or []
        print(f"  item_id={iid}  name={name!r}  variationen={len(var)}")

    print()
    print("--- Quotas (Überblick) ---")
    print(f"Anzahl: {len(quotas)}\n")
    for q in sorted(quotas, key=lambda x: (x.get("position") or 0, x.get("id") or 0)):
        qid = q.get("id")
        qname = q.get("name")
        size = q.get("size")
        item_ids = q.get("items") or []
        var_ids = q.get("variations") or []
        subev = q.get("subevent")
        avail = q.get("available_number")
        closed = q.get("closed")
        print(f"  quota_id={qid}  name={qname!r}")
        print(f"    size={size}  available_number={avail}  closed={closed}  subevent={subev}")
        print(f"    items={item_ids}  variations={var_ids}")

    print()
    print("--- Hinweis für dashboard.json ---")
    print("Pro Zeile im Dashboard typischerweise eine Quota-ID whitelisten,")
    print("oder item_id (+ optional variation_id), je nach gewählter Filterlogik im Backend.")
    print("Details: Plan-Abschnitt Whitelist und pretix-Dokumentation Quotas/Items.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
