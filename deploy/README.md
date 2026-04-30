# Deployment

Diese Anleitung ist für ein einfaches Setup auf einem eigenen Server:

- nginx als Reverse Proxy
- Backend als systemd Dienst
- Frontend als statische Dateien

## Voraussetzungen

- Linux Server mit root Zugriff
- DNS zeigt auf den Server
- Port 80 ist für ACME erreichbar (TLS Zertifikat)
- Zugriff auf pretix (API Token)
- uv muss installiert sein

## Schritt für Schritt Anleitung

### 0. Repo clonen

Waehle ein Installationsverzeichnis:

- Systemdienst Variante: z.B. `/opt/platzmonitor`
- User Dienst Variante: z.B. `~/platzmonitor`

Im Folgenden wird dieses Verzeichnis als `PLATZMONITOR_DIR` bezeichnet.

```bash
# Beispiel Systemdienst:
# export PLATZMONITOR_DIR=/opt/platzmonitor
#
# Beispiel User Dienst:
# export PLATZMONITOR_DIR="$HOME/platzmonitor"
export PLATZMONITOR_DIR=/opt/platzmonitor
git clone git@github.com:gislars/platzmonitor.git "$PLATZMONITOR_DIR"
cd "$PLATZMONITOR_DIR"
```

### 1. Backend Konfiguration anlegen

`.env` aus der Vorlage erstellen:

```bash
cd "$PLATZMONITOR_DIR/backend"
cp .env.example .env
```

Mindestens diese Werte setzen:

- `PRETIX_TOKEN=...`

Für Betrieb hinter nginx unter `/event-api`:

- `ROOT_PATH=/event-api`

Optional:

- `DOCS_ENABLED=true` (aktiviert Docs unter `/event-api/docs`)

### 2. Backend als systemd Dienst einrichten

Es gibt zwei Varianten: als Systemdienst (klassisch, läuft systemweit) oder als User Dienst (läuft im User Kontext).

#### 2a. Als Systemdienst (systemweit)

```bash
sudo cp "$PLATZMONITOR_DIR/deploy/systemd/fossgis-platzmonitor-backend.service" /etc/systemd/system/
```

In der Unit anpassen:

- `WorkingDirectory=$PLATZMONITOR_DIR/backend`
- `EnvironmentFile=$PLATZMONITOR_DIR/backend/.env`
- `User=` und `Group=` (z.B. `www-data`)

Dann aktivieren:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now fossgis-platzmonitor-backend.service
```

Test:

```bash
curl -sSf http://127.0.0.1:8000/api/v1/availability >/dev/null
```

Logs:

```bash
sudo journalctl -u fossgis-platzmonitor-backend.service -f
```

#### 2b. Als User Dienst (systemd --user)

Voraussetzungen:

- `WorkingDirectory` und `EnvironmentFile` müssen für den User lesbar sein (z.B. unter `~/platzmonitor/...` oder mit passenden Rechten).
- In der Unit normalerweise kein `User=` und `Group=` setzen (der Dienst läuft als dein User).

Unit installieren:

```bash
mkdir -p ~/.config/systemd/user
cp "$PLATZMONITOR_DIR/deploy/systemd/fossgis-platzmonitor-backend.service" ~/.config/systemd/user/
```

In der kopierten Unit anpassen:

- `WorkingDirectory=$PLATZMONITOR_DIR/backend`
- `EnvironmentFile=$PLATZMONITOR_DIR/backend/.env`
- `User=` und `Group=` entfernen

Dann aktivieren:

```bash
systemctl --user daemon-reload
systemctl --user enable --now fossgis-platzmonitor-backend.service
```

Logs:

```bash
journalctl --user -u fossgis-platzmonitor-backend.service -f
```

Optional (wenn der Dienst auch ohne Login laufen soll):

```bash
sudo loginctl enable-linger <user>
```

### 3. nginx konfigurieren

Beispiel Konfiguration:

- `deploy/nginx/fossgis.mapwebbing.eu.conf`

Wichtig: Rate Limit Snippet einmal im `http { }` Block einbinden, sonst ist `zone=platzmonitor_api` unbekannt.

Schritte (Beispiel für Debian/Ubuntu Layout):

```bash
sudo cp "$PLATZMONITOR_DIR/deploy/nginx/http-snippet-limits.conf" /etc/nginx/conf.d/zz-platzmonitor-limits.conf
sudo cp "$PLATZMONITOR_DIR/deploy/nginx/fossgis.mapwebbing.eu.conf" /etc/nginx/sites-available/platzmonitor.conf
sudo ln -s /etc/nginx/sites-available/platzmonitor.conf /etc/nginx/sites-enabled/platzmonitor.conf
sudo nginx -t
sudo systemctl reload nginx
```

In `platzmonitor.conf` anpassen:

- Domain Name (nginx `server_name`, z.B. `example.org`)
- Pfade für `/frontend/` (root oder alias, z.B. `/var/www/platzmonitor/frontend`)
- Upstream zum Backend (typisch `http://127.0.0.1:8000`)

### 4. TLS Zertifikat holen

Mit certbot ein Zertifikat für die Domain anfordern, dann nginx testen und reload.

Hinweis: Der genaue certbot Aufruf hängt von Distribution und Setup ab.

### 5. Frontend bauen und ausliefern

Build im Repo:

```bash
cd "$PLATZMONITOR_DIR/frontend"
pnpm install
pnpm run build
```

Auslieferung:

- `frontend/dist/` muss vom Webserver unter `/frontend/` erreichbar sein
- empfohlen: Dateien nach `/var/www/platzmonitor/frontend/` kopieren und nginx darauf zeigen

Beispiel (einmalig):

```bash
sudo mkdir -p /var/www/platzmonitor/frontend
sudo rsync -a --delete "$PLATZMONITOR_DIR/frontend/dist/" /var/www/platzmonitor/frontend/
sudo nginx -t
sudo systemctl reload nginx
```

Wenn Frontend und API nicht unter derselben Domain laufen, ist CORS im Backend nötig (siehe Abschnitt CORS in [`backend/README.md`](../backend/README.md)).

## Erfolgskontrolle

Backend Dienst

- ok: in der Ausgabe steht `active (running)`
- nicht ok: `inactive`, `failed` oder der Dienst existiert nicht

```bash
sudo systemctl status fossgis-platzmonitor-backend.service
```

API direkt auf dem Server

- ok: HTTP Status `200`
- nicht ok: Status ist nicht `200` oder der Befehl endet mit Fehler

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/api/v1/availability
```

API über nginx (von einem Rechner mit Zugriff auf die Domain)

- ok: HTTP Status `200`
- haeufige Fehler:
  - `404`: nginx `location` oder `ROOT_PATH` stimmt nicht
  - `502`: nginx erreicht das Backend nicht (Dienst down, falscher Upstream)

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://example.org/event-api/api/v1/availability
```

Frontend über nginx:

- ok: `https://example.org/frontend/` laedt im Browser ohne Fehler
- nicht ok: 404 oder es erscheint eine nginx Fehlerseite

## Troubleshooting

- Backend Logs: `sudo journalctl -u fossgis-platzmonitor-backend.service -f`
- nginx Konfiguration testen: `sudo nginx -t`
- **404 unter `/event-api/...`**: `ROOT_PATH=/event-api` im Backend und nginx `location` prüfen.
- **Swagger zeigt falsche OpenAPI URL**: `ROOT_PATH` und `DOCS_ENABLED` prüfen.
- **Browser Fehler bei API Calls**: bei unterschiedlichen Hosts ist CORS nötig (siehe Abschnitt CORS in [`backend/README.md`](../backend/README.md)).

## Mini Glossar

- `event-api`: Pfad Präfix, unter dem die API hinter dem Reverse Proxy liegt.
- `ROOT_PATH`: FastAPI Einstellung, damit Routing und OpenAPI hinter einem Pfad Präfix funktionieren.
- `VITE_API_BASE_URL`: Basis URL der API im Frontend (leer im Dev, gesetzt in Produktion).
- Reverse Proxy: Webserver, der Anfragen an Backend und Frontend weiterleitet.
- CORS: Browser Schutz, wenn Frontend und API auf unterschiedlichen Origins liegen.
