# FOSSGIS Platzmonitor

Infoscreen fuer Veranstaltungen: **FastAPI** holt Verfuegbarkeiten aus **pretix**, **Vite/React** zeigt freie Plaetze nach Gruppen (Workshops, Exkursionen, usw.).

## Was es macht

- Kacheln mit freien Plaetzen je Gruppe (Regeln aus pretix-Quoten)
- Optional Wartelistenanzahl (nur Zahl), Kiosk-Modus, helles/dunkles Theme

## Voraussetzungen

| | |
|---|---|
| Laufzeit | Python 3.12+ mit [uv](https://docs.astral.sh/uv/), Node 20+ mit pnpm |
| pretix | Team-API-Token mit Lesezugriff auf **Items**, **Quotas**; **Waiting list** nur fuer die Wartelisten-Zahl (sonst bleibt `waitingListCount` leer) |

## Schnellstart (lokal)

1. **`backend/.env`** aus Vorlage: `cp backend/.env.example backend/.env`. Mindestens **`PRETIX_TOKEN`**, bei Bedarf **`ORGANIZER`**, **`EVENT`**.

2. **Abhaengigkeiten:** `cd backend && uv sync` und `cd frontend && pnpm install`.

3. **Zwei Terminals:**

```bash
cd backend && PYTHONPATH=src uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

```bash
cd frontend && pnpm dev
```

4. **Oeffnen:** Frontend [http://127.0.0.1:5173](http://127.0.0.1:5173). API im Dev: Vite leitet `/api` auf Port 8000.

**Endpoint:** `GET /api/v1/availability`. Eintraege nutzen das Feld `groupId` (JSON-Alias). **OpenAPI** (`/docs`) nur wenn `DOCS_ENABLED=true` in `backend/.env`.

## Betrieb und Netzwerk

| Thema | Kurz |
|-------|------|
| **Worker** | **Ein** uvicorn-Worker (`--workers 1`) pro Instanz. Mehrere Prozesse: mehrfaches pretix-Polling, je Prozess eigener Snapshot. |
| **Singlehost** | Frontend und Backend hinter einem Reverse Proxy; `/api` zum Backend routen. **Kein CORS** noetig. |
| **Multihost** | Frontend setzt z. B. `VITE_API_BASE_URL=https://api.example.org`. Backend: `FRONTEND_ORIGIN` (komma-separiert) **oder** `FRONTEND_ORIGIN_REGEX`. Mit `allow_credentials=True` passende Origins waehlen (keine Wildcard-Origin mit Credentials). |
| **Konfiguration** | `backend/.env` / Umgebung wird beim **Start** gelesen; Aenderungen erst nach **Neustart**. |
| **pretalx** | Workshop-Zeiten per Titel-Match zum Schedule. Zwei Titel, die nach Normalisierung gleich sind, kollidieren (es gewinnt der fruehere Slot). |

Details **nginx**, **systemd**, Beispiel-URLs: [`deploy/nginx/README.md`](deploy/nginx/README.md), [`deploy/systemd/README.md`](deploy/systemd/README.md).

## Konfiguration

**Backend:** Standard-Gruppenregeln in Code (`backend/src/app/services/group_rules.py`); Override per **`GROUP_RULES_JSON`** in `backend/.env` (siehe `backend/.env.example`). Leer: Workshops per Praefix `WS` (case-insensitive), Exkursionen per Schluesselwoerter. Regex-Patterns max. **256** Zeichen. Unbekannte Quoten: `GROUP_UNMATCHED_BEHAVIOR=drop` (Standard) oder `=other` (Sammelgruppe).

**Frontend:** Optional `frontend/.env` aus `frontend/.env.example` (Raster, Poll, Kiosk, Theme, API-URL). Ausfuehrlicher: [`frontend/README.md`](frontend/README.md), [`backend/README.md`](backend/README.md).

## Warteliste

Ist `allow_waitinglist` aktiv, kann die Karte „Warteliste: n“ erscheinen; es werden nur Zahlen angezeigt.

## Entwicklung

```bash
pnpm install && pnpm run lint && pnpm run typecheck && pnpm run format
```

## Verzeichnis

| Pfad | Inhalt |
|------|--------|
| `backend/src/app/` | FastAPI, pretix, `GET /api/v1/availability` |
| `frontend/src/` | React-UI |
| `scripts/` | Hilfsskripte (eigenes uv-Projekt), Ausgaben nicht versionieren |

## Lizenz

FOSSGIS-Projekt; Details nach Teamkonvention.
