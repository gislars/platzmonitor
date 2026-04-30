# Backend (FastAPI)

Liest Daten aus pretix (Items, Quotas, optional Warteliste) und liefert JSON für das Frontend. Optional gibt es zusätzliche Endpunkte für eine Event API (pretalx Proxy).

## Lokal starten

```bash
cd backend && uv sync
PYTHONPATH=src uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

## Konfiguration

Startpunkt:

- `.env` aus Vorlage erstellen: `cp .env.example .env`
- mindestens `PRETIX_TOKEN` setzen

Weitere wichtige Variablen:

- `HTTP_USER_AGENT` (optional, für pretix und pretalx)
- `DOCS_ENABLED=true` (optional, OpenAPI unter `/docs`)

Reverse Proxy und Pfad Präfix (z.B. `/event-api`) werden in der Deploy Doku beschrieben:

- siehe [`deploy/README.md`](../deploy/README.md)

### Logging

- App Logger nutzt den Namensraum `pm`
- keine Secrets loggen (z.B. `PRETIX_TOKEN`)
- `LOG_LEVEL` steuert Detailgrad
- `LOG_FILE` kann eine Datei aktivieren (leer bedeutet: kein App Logfile)

### CORS (nur Multihost)

Wenn Frontend und API nicht unter derselben Origin laufen, kann eine Origin Liste oder ein Regex gesetzt werden:

- `FRONTEND_ORIGIN` (Komma separiert, z.B. `https://a.example.org,https://b.example.org`)
- `FRONTEND_ORIGIN_REGEX` (hat Vorrang, Regex eng halten)

## Endpunkte

- `GET /api/v1/availability` (Platzmonitor)
- optional zusätzliche Event API Endpunkte:
  - `GET /api/v1/schedule`
  - `GET /api/v1/widget-schedule`
  - `GET /api/v1/schedule-print`

## Tests

```bash
cd backend && uv sync --group dev && uv run pytest
```

## Lint

```bash
cd backend && PYTHONPATH=src uv run ruff check src && uv run ruff format src
```

