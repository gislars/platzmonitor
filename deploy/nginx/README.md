# nginx (Beispiel: fossgis.mapwebbing.eu)

Voraussetzungen: DNS zeigt auf den Server, Port 80 fuer ACME erreichbar.

## Schritte

| # | Was | Kurz |
|---|-----|------|
| 1 | Rate-Limit | `http-snippet-limits.conf` **einmal** im `http { }`-Block einbinden (sonst unbekannt: `zone=platzmonitor_api`). Beispiel: nach `/etc/nginx/conf.d/zz-platzmonitor-limits.conf` kopieren, `nginx -t`, reload. |
| 2 | Site | `fossgis.mapwebbing.eu.conf` nach `sites-available/` kopieren, nach `sites-enabled/` verlinken. |
| 3 | TLS | `certbot --nginx -d fossgis.mapwebbing.eu`, dann `nginx -t` und reload. Erneuerung: z. B. `certbot.timer` pruefen. |

Die Site-Vorlage: HTTP (80) fuer Redirect/ACME, HTTPS (443) mit `proxy_pass` zum Backend. Zertifikat nur im 443-Block.

## Backend hinter diesem Setup

uvicorn laeuft typisch auf `127.0.0.1:8000` (siehe [`deploy/systemd/`](../systemd/)).

Beispiel-URL (mit nginx-Praefix `/backend`):

`https://fossgis.mapwebbing.eu/backend/api/v1/availability`

Swagger oeffentlich: im Backend `DOCS_ENABLED=true` und `ROOT_PATH=/backend` (siehe systemd-README).

## Frontend unter `/frontend/`

Build mit `pnpm build` (`base: '/frontend/'`), Inhalt von `dist/` auf den Webserver legen (z. B. so dass `index.html` unter `/frontend/` erreichbar ist). In der Site-Datei die `location /frontend/` und `root` aktivieren, erneut `nginx -t`.
