# FOSSGIS Platzmonitor

Schlanker Infoscreen fuer Veranstaltungen: Ein FastAPI Backend aggregiert Verfuegbarkeiten aus pretix, ein Vite React Frontend zeigt freie Plaetze fuer Gruppen wie Workshops und Exkursionen.

## Hauptfeatures

- **Live Uebersicht**: Kacheln mit freien Plaetzen je Quote Gruppe
- **Gruppierung per Regeln**: Zuordnung von pretix Quoten zu Gruppen (Workshops, Exkursionen, Sonstiges)
- **Optional Wartelistenanzahl**: Anzeige nur als Zahl, ohne personenbezogene Daten
- **Kiosk Modus**: Anzeige ohne Konfigurationspanel (fuer Infoscreen Betrieb)
- **Theme**: FOSSGIS hell oder dunkel, erweiterbar

## Voraussetzungen

- **Python** 3.12+ und `uv` (siehe `https://docs.astral.sh/uv/`)
- **Node.js** 20+ und **pnpm** (zB via `corepack`)
- **pretix Team API Token** mit Lesezugriff auf:
  - **Items**
  - **Quotas**
  - **Waiting list entries** (nur noetig fuer Wartelistenanzahl, fehlt die Berechtigung bleibt `waitingListCount` `null`)

## Schnellstart (lokal)

1. Backend konfigurieren

```bash
cp backend/.env.example backend/.env
```

In `backend/.env` mindestens setzen:

- `PRETIX_TOKEN`
- ggf `ORGANIZER` und `EVENT` (abhängig von eurem pretix Setup)

2. Abhaengigkeiten installieren

```bash
cd backend && uv sync
cd ../frontend && pnpm install
```

3. Entwicklungsserver starten (zwei Terminals)

```bash
cd backend
PYTHONPATH=src uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

```bash
cd frontend
pnpm dev
```

4. Oeffnen

- Frontend: `http://127.0.0.1:5173`
- OpenAPI/Swagger (`/docs`): nur wenn in `backend/.env` **`DOCS_ENABLED=true`** gesetzt ist, dann z. B. `http://127.0.0.1:8000/docs` (Standard ist aus).

Hinweis: Das Frontend ruft die API relativ unter `/api` auf und proxyed in der Entwicklung auf `http://127.0.0.1:8000`. Der zentrale Endpoint ist `GET /api/v1/availability`. In der JSON-Antwort trägt jeder Eintrag unter `entries` die technische Gruppen-ID als Feld `groupId` (nicht mehr `category`).

## Deployment (Singlehost und Multihost)

Es gibt zwei gaengige Betriebsarten.

### Variante A: Singlehost (same origin, Reverse Proxy)

- Frontend und Backend laufen auf demselben Host hinter einem Reverse Proxy.
- Das Frontend nutzt die relative API unter `/api/...`.
- Der Reverse Proxy route `/api` zum Backend und liefert das Frontend aus.

Vorteil: Kein CORS noetig.

### Variante B: Multihost (Frontend Hosts sprechen direkt mit Backend)

- Mehrere Frontend Hosts (zB Raspberry Pi) rufen ein Backend im lokalen Netz oder ueber Internet auf.
- Frontend nutzt eine absolute API Base URL:
  - `VITE_API_BASE_URL=https://api.example.org`
- Backend erlaubt CORS entweder als Liste oder Wildcard per Regex:
  - `FRONTEND_ORIGIN=https://a.example.org,https://b.example.org`
  - oder `FRONTEND_ORIGIN_REGEX=^https?://([a-z0-9-]+\.)?infoscreen\.example\.org(:\d+)?$`

## Produktion (nginx, systemd, Subdomain)

Betrieb ohne Docker: Backend mit **uv** und **systemd**, TLS und Routing mit **nginx**. Zielbeispiel: Host **`fossgis.mapwebbing.eu`**, API oeffentlich unter **`/backend`** (z. B. `https://fossgis.mapwebbing.eu/backend/api/v1/availability`), Frontend-Build spaeter unter **`/frontend/`** (Vite `base` ist im Produktionsbuild auf `/frontend/` gesetzt).

**Ablauf auf dem Server (Kurz):**

1. Repo klonen oder aktualisieren, im `backend/`-Verzeichnis **`uv sync`**, **`cp .env.example .env`** und mindestens **`PRETIX_TOKEN`** setzen (Produktion: **`DOCS_ENABLED`** weglassen oder `false`, damit `/docs` nicht oeffentlich liegt).
2. **Rate-Limit-Snippet** und **Site-Datei** aus [`deploy/nginx/`](deploy/nginx/) einbinden (siehe [`deploy/nginx/README.md`](deploy/nginx/README.md)), **`nginx -t`**, Zertifikat z. B. mit **certbot** (`certbot --nginx -d fossgis.mapwebbing.eu`), **`systemctl reload nginx`**.
3. **Backend als systemd-Dienst** einrichten (siehe [`deploy/systemd/README.md`](deploy/systemd/README.md)):
   - **System-Dienst**: Unit nach `/etc/systemd/system/` kopieren, **`WorkingDirectory`**, **`User`** und **`Group`** sowie ggf. **`EnvironmentFile`** setzen, dann `systemctl` (mit **`sudo`**) verwenden.
   - **User-Dienst**: Vorlage `fossgis-platzmonitor-backend.user.service` nach `~/.config/systemd/user/` kopieren, Pfade anpassen, mit **`systemctl --user`** starten (kein `sudo` fuer Start/Stop; optional **`loginctl enable-linger`** fuer Start nach Reboot ohne Login).

Details und Pfade: [`deploy/systemd/README.md`](deploy/systemd/README.md), [`deploy/nginx/README.md`](deploy/nginx/README.md).

**Frontend** fuer dieselbe Domain: Build mit `pnpm build`, `dist/`-Inhalt auf den Webserver-Pfad legen (siehe nginx-Kommentar zu `/frontend/`). API-URL setzen, z. B. `VITE_API_BASE_URL=https://fossgis.mapwebbing.eu/backend` (siehe `frontend/.env.example`).

## Lokale Anpassungen

### Backend: Gruppierungs und Filterregeln

Die Standardregeln stehen in `backend/src/app/services/group_rules.py` (`DEFAULT_GROUP_RULES`). Ueberschreiben geht ueber `GROUP_RULES_JSON` in `backend/.env` (Beispiel und Hinweise in `backend/.env.example`).

Standardverhalten (wenn `GROUP_RULES_JSON` leer):

- **Workshops**: Quote Name beginnt mit `WS` (exakt Grossbuchstaben)
- **Exkursionen**: Quote Name enthaelt (case insensitive) `Exkursion`, `Stadtrundgang`, `Stadtfuehrung` (auch `stadtfuhrung` ohne Umlaut)

Nicht gematchte Quoten:

- `GROUP_UNMATCHED_BEHAVIOR=drop` blendet sie aus (Default)
- `GROUP_UNMATCHED_BEHAVIOR=other` zeigt sie unter **Sonstiges** (`GROUP_OTHER_TITLE`)

### Frontend: Defaults, Kiosk, Theme

Optional kann `frontend/.env` angelegt werden:

```bash
cp frontend/.env.example frontend/.env
```

In `frontend/.env.example` sind alle Optionen kommentiert (Raster, Filter, Kiosk, Theme Defaults).

Theme kurz:

- **Build Default**: `VITE_DEFAULT_THEME=fossgis-light` oder `fossgis-dark`
- **Styles**: `frontend/src/themes.css` (aktives Theme ueber `data-theme` am `html`)
- **Theme Liste**: `frontend/src/themes.ts` (`THEMES`)

Weitere Details:

- Frontend: `frontend/README.md`
- Backend: `backend/README.md`

## Warteliste (Datenschutz)

Wenn das pretix Item `allow_waitinglist` erlaubt und es aktive Eintraege gibt (ohne Gutschein), kann eine Karte "Warteliste: n" erscheinen. Es wird nur die Anzahl angezeigt, keine personenbezogenen Daten.

## Qualitaetssicherung

```bash
pnpm install
pnpm run lint
pnpm run typecheck
pnpm run format
```

## Projektstruktur

- `backend/src/app/`: FastAPI, pretix Anbindung, Endpoint `GET /api/v1/availability`
- `frontend/src/`: React UI
- `scripts/`: eigenes kleines `uv` Projekt, zB `pretix_discover.py` (exportiert JSON nach `scripts/output/`, nicht versionieren)

## Lizenz

FOSSGIS Projekt, Details siehe Teamkonvention.
