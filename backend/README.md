# Backend (FastAPI)

pretix-API lesen, mit pretalx-Schedule anreichern, JSON für das Dashboard liefern.

## Konfiguration

Basis: `cp .env.example .env` und mindestens `PRETIX_TOKEN` setzen (Details siehe Root `README.md`). Optional `HTTP_USER_AGENT` fuer ausgehende Requests zu pretix und pretalx.

**OpenAPI/Swagger** (`/docs`, `/openapi.json`): Standard **aus**. Zum Aktivieren lokal oder temporaer auf dem Server: **`DOCS_ENABLED=true`** in `.env`, Dienst neu starten. Hinter nginx mit URL-Praefix `/backend` und aktivierten Docs optional **`--root-path /backend`** in der systemd-Unit (siehe `deploy/systemd/README.md`).

### CORS (Singlehost und Multihost)

Wenn Frontend und Backend nicht unter derselben Origin laufen (Multihost), muss CORS im Backend erlaubt werden.

- **Explizite Liste** (gut wenn du wenige feste Hosts hast):
  - `FRONTEND_ORIGIN=https://infoscreen.example.org,https://zweiter-host.example.org`
- **Wildcard per Regex** (gut fuer viele Frontend Hosts, zB viele Raspberry Pi):
  - `FRONTEND_ORIGIN_REGEX=^https?://([a-z0-9-]+\.)?infoscreen\.example\.org(:\d+)?$`

Hinweise:

- Wenn `FRONTEND_ORIGIN_REGEX` gesetzt ist, hat es Vorrang vor `FRONTEND_ORIGIN`.
- Regex moeglichst eng halten (Security).

## Einstiegspunkte

- `src/app/main.py` – App, CORS optional ueber `FRONTEND_ORIGIN` oder `FRONTEND_ORIGIN_REGEX`
- `src/app/routes/availability.py` – `GET /api/v1/availability`
- `src/app/pretix/client.py` – pretix REST (Items, Quotas, Event-Metadaten, Warteliste)
- `src/app/pretalx/schedule.py` – Schedule laden, Startzeiten für Labels
- `src/app/services/availability_service.py` – Gruppenlogik, Filter, Aggregation

## Start

```bash
cd backend
uv sync
PYTHONPATH=src uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

## API

- OpenAPI: `http://127.0.0.1:8000/docs` (nur wenn **`DOCS_ENABLED=true`**)
- Endpoint: `GET /api/v1/availability`

## Deployment

Siehe Root-`README.md` Abschnitt „Produktion“ sowie [`deploy/systemd/`](../deploy/systemd/) und [`deploy/nginx/`](../deploy/nginx/).

## Lint und Format

```bash
cd backend && PYTHONPATH=src uv run ruff check src && uv run ruff format src
```

Im Monorepo-Root: `pnpm run lint` und `pnpm run format` rufen das Frontend und ruff gemeinsam auf.
