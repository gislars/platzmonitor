# Frontend (Vite, React, TypeScript)

Infoscreen fuer freie Workshop und Exkursionsplaetze. Ruft das Backend per `GET /api/v1/availability` auf.

## Befehle

```bash
pnpm install
pnpm dev          # Entwicklungsserver
pnpm run build    # Produktionsbuild nach dist/ (base ist /frontend/ nur im Production-Modus)
pnpm run lint
pnpm run typecheck
```

## Development (lokal)

Standard ist lokale Entwicklung mit Vite Proxy: das Frontend ruft relativ `/api/...` auf, Vite proxyed das in dev auf `http://127.0.0.1:8000` (siehe `vite.config.ts`). Du brauchst dafuer keinen zusaetzlichen Proxy.

## Konfiguration

Anzeige-Defaults und Theme: siehe [`./.env.example`](./.env.example) (Variablen mit `VITE_`). Kopie nach `.env` anpassen.

### Backend-URL (Multihost oder Subpfad)

Ohne Variable: relative Anfrage an `/api/v1/availability` (passt zum Vite-Dev-Proxy).

Mit **`VITE_API_BASE_URL`** beim **`pnpm build`** (oder in `.env`):

- Anderer Host: `VITE_API_BASE_URL=https://api.example.org` (CORS im Backend setzen, siehe `backend/README.md`).
- Gleicher Host mit nginx-Praefix **`/backend`**: z. B. `VITE_API_BASE_URL=https://fossgis.mapwebbing.eu/backend` (meist kein CORS noetig).

Der Produktionsbuild nutzt **`base: '/frontend/'`**, die App liegt dann unter `https://…/frontend/` (siehe Root-README, Deployment).

Details zu Gesamtsetup, Themes und Panel: [README im Projektroot](../README.md).
