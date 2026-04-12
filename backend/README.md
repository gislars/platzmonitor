# Backend (FastAPI)

Liest pretix (Items, Quotas, Warteliste), reichert mit pretalx-Schedule an, liefert JSON fuer das Frontend.

## Konfiguration

| | |
|---|---|
| Erste Schritte | `cp .env.example .env`, mindestens **`PRETIX_TOKEN`** |
| Ausgehende Requests | optional **`HTTP_USER_AGENT`** (pretix und pretalx) |
| **OpenAPI** (`/docs`) | Standard **aus**. Zum Einschalten: **`DOCS_ENABLED=true`**, Dienst neu starten |
| Hinter URL-Praefix `/backend` | in der systemd-Unit **`ROOT_PATH=/backend`** setzen (siehe [`deploy/systemd/README.md`](../deploy/systemd/README.md)), nicht doppelt mit `uvicorn --root-path` kombinieren |
| **App-Logs** | **`LOG_LEVEL`** (Standard INFO), **`LOG_FILE`** (leer: `/var/log/platzmonitor/app.log`). Rotation nur systemweit, siehe [`deploy/logrotate/platzmonitor`](../deploy/logrotate/platzmonitor) |

### Logging

- Logger unter dem Namensraum **`pm`** (z. B. `pm.main`, `pm.availability`). **`uvicorn`** schreibt weiter nach **stderr** (journalctl); die App-Logdatei enthaelt die Meldungen aus der Aggregationslogik.
- Keine Secrets: kein `PRETIX_TOKEN`, keine URLs mit geheimen Query-Parametern in Meldungen.
- Dieselbe erkennbare Ursache nicht an mehreren Stellen loggen (Refresh-Fehler im Cache-Layer, Erfolg nach Build in `availability_service`).

### CORS (nur Multihost)

Gleiche Origin wie das Frontend: kein CORS noetig. Sonst eine der Variablen:

| Variable | Nutzen |
|----------|--------|
| `FRONTEND_ORIGIN` | Komma-separierte Liste, z. B. `https://a.example.org,https://b.example.org` |
| `FRONTEND_ORIGIN_REGEX` | Viele Hosts (z. B. Raspberry Pi); **Vorrang** vor `FRONTEND_ORIGIN`, Regex eng halten |

## Code

| Pfad | Rolle |
|------|--------|
| `src/app/main.py` | App, CORS |
| `src/app/routes/availability.py` | `GET /api/v1/availability` |
| `src/app/pretix/client.py` | pretix REST |
| `src/app/pretalx/schedule.py` | Schedule, Titel-Match |
| `src/app/services/availability_service.py` | Gruppen, Aggregation |

## Lokal starten

```bash
cd backend && uv sync
PYTHONPATH=src uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**API:** `GET /api/v1/availability`. OpenAPI nur mit `DOCS_ENABLED=true`, z. B. `http://127.0.0.1:8000/docs`.

Eintraege koennen **`pretalxCode`** enthalten, wenn Quoten-Name und Schedule zusammenpassen; sonst `null`.

## Deployment

Siehe [README im Projektroot](../README.md) (Betrieb) und [`deploy/systemd/`](../deploy/systemd/), [`deploy/nginx/`](../deploy/nginx/).

## Lint

```bash
cd backend && PYTHONPATH=src uv run ruff check src && uv run ruff format src
```

Im Monorepo-Root: `pnpm run lint` / `pnpm run format` (Frontend + Backend).
