# nginx: fossgis.mapwebbing.eu

## 1. Rate-Limit (einmalig, im `http`-Kontext)

Die Datei `http-snippet-limits.conf` muss **einmal** im `http { }`-Block von nginx eingebunden werden, sonst ist `zone=platzmonitor_api` unbekannt.

Beispiel Debian/Ubuntu:

```bash
sudo cp http-snippet-limits.conf /etc/nginx/conf.d/zz-platzmonitor-limits.conf
sudo nginx -t && sudo systemctl reload nginx
```

Alternativ: Inhalt in `/etc/nginx/nginx.conf` unter `http {` per `include` einbinden.

## 2. Site aktivieren

```bash
sudo cp fossgis.mapwebbing.eu.conf /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/fossgis.mapwebbing.eu.conf /etc/nginx/sites-enabled/
```

## 3. TLS (certbot 1.21+)

- DNS der Subdomain muss auf den Server zeigen.
- Port 80 muss von aussen erreichbar sein (HTTP-01).

Die Vorlage `fossgis.mapwebbing.eu.conf` nutzt **zwei** `server`-Bloecke: Port **80** (ACME, Redirect nach HTTPS) und Port **443** (TLS, `proxy_pass` nach dem Backend). Zertifikatszeilen gehoeren nur in den **443**-Block.

Zertifikat einrichten (nginx-Plugin):

```bash
sudo certbot --nginx -d fossgis.mapwebbing.eu
sudo nginx -t && sudo systemctl reload nginx
```

Erneuerung: typisch `certbot.timer` oder cron pruefen (`systemctl status certbot.timer`).

## 4. Backend

uvicorn laeuft auf `127.0.0.1:8000` (siehe `deploy/systemd/`). Swagger: `DOCS_ENABLED=true` und `ROOT_PATH` (in der mitgelieferten Unit per `Environment=ROOT_PATH=/backend`). Oeffentliche API-Beispiel-URL:

`https://fossgis.mapwebbing.eu/backend/api/v1/availability`

## 5. Frontend unter `/frontend/` (spaeter)

Vite-Build mit `base: '/frontend/'` bauen, Inhalt von `dist/` nach z. B. `/var/www/platzmonitor/frontend/` legen (sodass `index.html` unter diesem Pfad liegt), dann die auskommentierte `location /frontend/` und `root` in der Site-Datei aktivieren und `nginx -t` erneut pruefen.
