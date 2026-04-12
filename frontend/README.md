# Frontend (Vite, React, TypeScript)

Infoscreen-UI; Daten per `GET /api/v1/availability`.

## Befehle

```bash
pnpm install
pnpm dev              # Entwicklung
pnpm run build        # Ausgabe: dist/ (base im Production-Build: /frontend/)
pnpm run lint
pnpm run typecheck
```

## Lokal

Vite leitet `/api` auf `http://127.0.0.1:8000` (siehe `vite.config.ts`). Backend separat starten, kein extra Proxy noetig.

## Konfiguration

Kopie von [`.env.example`](./.env.example) nach `.env`; alle Optionen sind dort kommentiert (`VITE_*`).

| Situation | `VITE_API_BASE_URL` |
|-----------|---------------------|
| Standard (Dev) | leer: Anfragen an `/api/v1/availability` (Vite-Proxy) |
| Anderer Host | z. B. `https://api.example.org` (CORS im Backend, siehe [`backend/README.md`](../backend/README.md)) |
| Gleicher Host, API unter Praefix `/backend` | z. B. `https://example.org/backend` (oft kein CORS) |

Production-Build nutzt **`base: '/frontend/'`**; Auslieferung unter z. B. `https://host/frontend/` (siehe Deploy-Doku im Root-README).

Weitere Themen (Themes, Panel): [README im Projektroot](../README.md).
