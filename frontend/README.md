# Frontend (Vite, React, TypeScript)

Infoscreen-UI. Daten kommen vom Platzmonitor Backend (bei Dev leitet Vite **`/api/*`** zum lokalen FastAPI weiter, siehe `vite.config.ts`). Genutzt werden u. a.:

- `GET /api/v1/availability` (Kachelmodus und Statistik-Begleitprogramm)
- `GET /api/v1/registrations` (Statistik Tab Anmeldungen)
- `GET /api/v1/booking-timeline` (Detaildialog zu einer Quota)
- optional `GET /api/v1/history` (Zeitreihe aus der History-Datenbank; derzeit kein periodischer Abruf im UI, API bleibt für Skripte und Erweiterungen in `api.ts`)

## Befehle

```bash
pnpm install
pnpm dev              # Entwicklung
pnpm run build        # Ausgabe: dist/
pnpm run lint
pnpm run typecheck
```

## Lokal

Vite leitet `/api` auf `http://127.0.0.1:8000` (siehe `vite.config.ts`). Backend separat starten, kein extra Proxy nötig.

## Konfiguration

Kopie von [`.env.example`](./.env.example) nach `.env`; alle Optionen sind dort kommentiert (`VITE_*`).

| Situation | `VITE_API_BASE_URL` |
|-----------|---------------------|
| Standard (Dev) | leer: Anfragen an `/api/...` werden per Vite zum Backend (`127.0.0.1:8000`) weitergeleitet |
| Anderer Host | z. B. `https://api.example.org` (CORS im Backend, siehe [`backend/README.md`](../backend/README.md)) |
| Gleicher Host, API unter Präfix `/event-api` | z. B. `https://example.org/event-api`  |

Deployment (nginx Pfade, `/frontend/`, API unter `/event-api`) steht in:

- [`deploy/README.md`](../deploy/README.md)
