"""Aggregate pretix transactions into registrations SQLite (manual admin CLI)."""

from __future__ import annotations

import argparse
import sys
from datetime import date
from typing import Any

import httpx

from app.loggers import get_logger
from app.logging_config import configure_logging
from app.outgoing_http import pretix_headers
from app.pretix.client import paginate_get
from app.services.registrations_aggregator import (
    AggregateResult,
    EventSpec,
    PretixAuthError,
    PretixHttpError,
    PretixNotFoundError,
    aggregate_pretix_event,
)
from app.settings import Settings, get_settings

_log = get_logger("import_pretix")


def _name(it: dict[str, Any]) -> str:
    n = it.get("name") or {}
    if isinstance(n, dict):
        return (
            str(n.get("de") or n.get("en") or next(iter(n.values()), "") or "").strip()
        )
    return str(n).strip()


def cmd_probe(settings: Settings, organizer: str, event: str, token: str) -> int:
    base = settings.pretix_base_url.rstrip("/")
    api = f"{base}/api/v1/organizers/{organizer}/events/{event}"
    tok = token.strip()
    try:
        with httpx.Client(
            headers=pretix_headers(settings, tok),
            timeout=120.0,
            follow_redirects=True,
        ) as client:
            r = client.get(f"{api}/")
            print(f"GET event/ -> {r.status_code}")
            if r.status_code != 200:
                return 1
            items = paginate_get(client, f"{api}/items/")
    except httpx.HTTPStatusError as e:
        print(f"HTTP {e.response.status_code}: {e!s}", file=sys.stderr)
        return 1
    except httpx.RequestError as e:
        print(f"Network: {e!s}", file=sys.stderr)
        return 1

    print("")
    print("Items (pretix)")
    print("id\tlabel\tactive\tadmission")
    for it in items:
        print(
            f"{it.get('id')}\t{_name(it)}\tactive={it.get('active')}\tadmission={it.get('admission')}"
        )

    admission_ids = [int(it["id"]) for it in items if it.get("admission")]
    if not admission_ids:
        print("")
        print("Keine admission-Items fuer Transaktions-Probe.")
        return 0

    sample = ",".join(str(i) for i in admission_ids[:25])
    from urllib.parse import urlencode

    q = urlencode(
        {"item__in": sample, "ordering": "datetime"},
    )
    try:
        with httpx.Client(
            headers=pretix_headers(settings, tok),
            timeout=120.0,
            follow_redirects=True,
        ) as client:
            txs = paginate_get(client, f"{api}/transactions/?{q}")
    except httpx.HTTPStatusError as e:
        print("")
        print(f"transactions/: HTTP {e.response.status_code}", file=sys.stderr)
        return 1
    except httpx.RequestError as e:
        print("")
        print(f"transactions/: {e!s}", file=sys.stderr)
        return 1

    dts = [tx.get("datetime") for tx in txs if isinstance(tx.get("datetime"), str)]
    dts_sorted = sorted(dts)
    print("")
    n_ids = len(admission_ids[:25])
    print(f"transactions/ (subset item__in first {n_ids} admission ids): count={len(txs)}")
    if dts_sorted:
        print(f"earliest datetime: {dts_sorted[0]}")
        print(f"latest datetime:   {dts_sorted[-1]}")
    else:
        print("no transaction datetimes returned (empty subset or permissions)")
    return 0


def _parse_csv_ints(spec: str) -> tuple[int, ...]:
    out: list[int] = []
    for part in spec.replace(" ", "").split(","):
        if not part:
            continue
        out.append(int(part, 10))
    return tuple(out)


def cmd_import(settings: Settings, args: argparse.Namespace) -> int:
    token = (
        getattr(args, "token", "").strip() or settings.pretix_token.strip()
    ).strip()
    online = _parse_csv_ints(args.online_items)
    onsite = _parse_csv_ints(args.onsite_items)
    since = date.fromisoformat(args.since) if getattr(args, "since", None) else None
    until = date.fromisoformat(args.until) if getattr(args, "until", None) else None

    spec = EventSpec(
        organizer=args.organizer,
        event=args.event,
        label=args.label,
        start_date=args.start_date,
        online_item_ids=online,
        onsite_item_ids=onsite,
        since=since,
        until=until,
    )

    try:
        res: AggregateResult = aggregate_pretix_event(spec, settings, token=token)
    except ValueError as e:
        print(f"Konfiguration: {e}", file=sys.stderr)
        return 2
    except PretixAuthError as e:
        print(f"Pretix Auth: {e}", file=sys.stderr)
        return 3
    except PretixNotFoundError as e:
        print(f"Pretix nicht gefunden: {e}", file=sys.stderr)
        return 4
    except PretixHttpError as e:
        print(f"Pretix HTTP: {e}", file=sys.stderr)
        return 5

    print(
        f"Hinterlegt: slug={spec.event} "
        f"Transaktionen={res.transactions_read} "
        f"Tagesreihe={res.days_written} "
        f"span={res.date_min}..{res.date_max}",
    )
    return 0


def main(argv: list[str] | None = None) -> int:
    argv = argv if argv is not None else sys.argv[1:]
    settings = get_settings()

    configure_logging(settings)

    parser = argparse.ArgumentParser(
        prog="python -m app.tools.import_pretix_history",
        description="Pretix Anmeldungs-Aggregation in registrations.sqlite",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    probe = sub.add_parser("probe", help="Event und Items auflisten")
    probe.add_argument("--organizer", required=True)
    probe.add_argument("--event", required=True)
    probe.add_argument(
        "--token",
        default="",
        help="API-Token oder leer = PRETIX_TOKEN aus Umgebung/Settings",
    )

    sync = sub.add_parser(
        "import",
        help="Transaktionen aggregieren und in registrations.sqlite schreiben",
    )
    sync.add_argument("--organizer", required=True)
    sync.add_argument("--event", required=True)
    sync.add_argument("--label", required=True)
    sync.add_argument(
        "--start-date",
        required=True,
        help="YYYY-MM-DD Konferenz-Bezugsdatum",
    )
    sync.add_argument(
        "--online-items",
        required=True,
        help="Kommagetrennte pretix item ids",
    )
    sync.add_argument(
        "--onsite-items",
        required=True,
        help="Kommagetrennte pretix item ids",
    )
    sync.add_argument("--since", default=None, help="YYYY-MM-DD Filter Start (optional)")
    sync.add_argument("--until", default=None, help="YYYY-MM-DD Filter Ende inklusive (optional)")
    sync.add_argument(
        "--token",
        default="",
        help="API-Token oder leer = PRETIX_TOKEN",
    )

    args = parser.parse_args(argv)

    if args.command == "probe":
        token = getattr(args, "token", "").strip() or settings.pretix_token
        return cmd_probe(settings, args.organizer, args.event, token)

    if args.command == "import":
        return cmd_import(settings, args)

    print("Unbekanntes Unterkommando", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
