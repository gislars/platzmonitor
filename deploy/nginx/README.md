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

Zertifikat (nginx-Plugin, passt die Site an):

```bash
sudo certbot --nginx -d fossgis.mapwebbing.eu
```

Falls die `ssl_certificate`-Zeilen noch nicht passen: zuerst eine minimale HTTPS-Server-Block-Variante ohne die letzencrypt-Pfade nutzen oder certbot-Anleitung der Distribution befolgen. Nach erfolgreicher Ausstellung `sudo nginx -t && sudo systemctl reload nginx`.

Erneuerung: typisch `certbot.timer` oder cron pruefen (`systemctl status certbot.timer`).

## 4. Backend

uvicorn laeuft auf `127.0.0.1:8000` (siehe `deploy/systemd/`). Oeffentliche API-Beispiel-URL:

`https://fossgis.mapwebbing.eu/backend/api/v1/availability`

## 5. Frontend unter `/frontend/` (spaeter)

Vite-Build mit `base: '/frontend/'` bauen, Inhalt von `dist/` nach z. B. `/var/www/platzmonitor/frontend/` legen (sodass `index.html` unter diesem Pfad liegt), dann die auskommentierte `location /frontend/` und `root` in der Site-Datei aktivieren und `nginx -t` erneut pruefen.
