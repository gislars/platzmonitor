"""Einmaliger Neuaufbau der Workshop-/Exkursions-Timeline (quota_tx_daily).

Liest den Verfügbarkeits-Snapshot aus data/availability_snapshots.sqlite (wie der laufende Server)
und zieht die Transaktionen direkt von pretix. Kein FastAPI nötig.

Voraussetzungen:
  backend/.env oder Umgebung: PRETIX_TOKEN, ORGANIZER, ggf. PRETIX_BASE_URL
  Snapshot fuer den Event-Slug muss existieren, es sei denn --fetch-snapshot (pretix+pretalx).

Beispiele:
  cd backend/src && uv run python -m app.tools.rebuild_booking_timeline --event 2025
  cd backend && PYTHONPATH=src uv run python -m app.tools.rebuild_booking_timeline --event 2025
  (mit --fetch-snapshot falls noch kein Snapshot in data/availability_snapshots.sqlite)
"""

from __future__ import annotations

import argparse
import sys

import httpx

from app.logging_config import configure_logging
from app.services import availability_snapshot_store
from app.services.availability_service import build_availability
from app.services.booking_timeline import (
    booking_timeline_db_path,
    read_series,
    rebuild_quota_tx_daily_from_snapshot,
)
from app.services.events_catalog import settings_for_event
from app.settings import get_settings


def _workshop_excursion_quota_ids(snap) -> list[str]:
    return [
        e.id
        for g in snap.groups
        if g.id in ("workshops", "excursions")
        for e in g.entries
    ]


def main(argv: list[str] | None = None) -> int:
    argv = argv if argv is not None else sys.argv[1:]
    parser = argparse.ArgumentParser(
        description="Booking-Timeline SQLite aus pretix-Transaktionen fuellen.",
    )
    parser.add_argument(
        "--event",
        required=True,
        help="pretix Event-Slug (z. B. 2025)",
    )
    parser.add_argument(
        "--fetch-snapshot",
        action="store_true",
        help=(
            "Wenn kein Eintrag in availability_snapshots.sqlite: Verfuegbarkeit live "
            "per pretix/pretalx bauen (langsamer; fuer aeltere Events ggf. PRETALX_* mit {event})."
        ),
    )

    args = parser.parse_args(argv)
    event = args.event.strip()
    if not event:
        print("event darf nicht leer sein.", file=sys.stderr)
        return 2

    settings = get_settings()
    configure_logging(settings)

    if not settings.pretix_token.strip():
        print("PRETIX_TOKEN fehlt (backend/.env).", file=sys.stderr)
        return 3

    effective = settings_for_event(settings, event)

    snap = availability_snapshot_store.read_snapshot(settings, event)
    if snap is None:
        if not args.fetch_snapshot:
            print(
                f"Kein Snapshot fuer event={event!r} in availability_snapshots.sqlite.\n"
                "  Neu anlegen lassen durch laufenden Server nach GET .../availability, oder\n"
                "  dieses Kommando mit --fetch-snapshot erneut ausfuehren.",
                file=sys.stderr,
            )
            return 4
        try:
            snap = build_availability(effective)
        except ValueError as e:
            print(f"Konfiguration: {e}", file=sys.stderr)
            return 5
        except httpx.HTTPStatusError as e:
            print(f"pretix HTTP {e.response.status_code}", file=sys.stderr)
            return 6
        except httpx.RequestError as e:
            print(f"Netzwerk pretix/pretalx: {e}", file=sys.stderr)
            return 7

    slug = snap.event.slug.strip()
    if slug != event:
        print(
            f"Snapshot gehoert zu slug={slug!r}, angefragt war {event!r}. Abbruch.",
            file=sys.stderr,
        )
        return 8

    qids = _workshop_excursion_quota_ids(snap)
    if not qids:
        print(
            "Snapshot enthaelt keine Eintraege in Gruppen workshops/excursions. "
            "Ohne diese IDs wird keine Timeline geschrieben.",
            file=sys.stderr,
        )
        return 9

    rebuild_quota_tx_daily_from_snapshot(effective, snap)

    dbp = booking_timeline_db_path(effective)
    series = read_series(effective, qids)
    nonempty = sum(1 for q in qids if len(series.get(q, [])) > 0)
    points_total = sum(len(series.get(q, [])) for q in qids)
    print(
        f"Fertig: event={event}\n"
        f"  Timeline-DB: {dbp}\n"
        f"  Quoten (workshops/excursions): {len(qids)}, mit mindestens einem Punkt: {nonempty}, "
        f"Stuetzstellen gesamt: {points_total}",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
