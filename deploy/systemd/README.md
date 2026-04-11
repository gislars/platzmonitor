# systemd: Backend-Dienst

Datei: `fossgis-platzmonitor-backend.service`

## Anpassen

1. `User` / `Group`: Account, der das Repo und `backend/.env` lesen darf.
2. `WorkingDirectory` und `EnvironmentFile`: absoluter Pfad zu eurem `backend/`-Ordner (nach `git clone`).
3. `ExecStart`: Falls `uv` nicht gefunden wird, entweder `PATH` in der Unit setzen oder den vollen Pfad zu `uv` aus `which uv` eintragen.

Optional, wenn Swagger unter `https://fossgis.mapwebbing.eu/backend/docs` korrekt sein soll und `DOCS_ENABLED=true` gesetzt ist:

```ini
ExecStart=/usr/bin/env uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --root-path /backend --no-access-log
```

## Installation auf dem Server

```bash
sudo cp deploy/systemd/fossgis-platzmonitor-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now fossgis-platzmonitor-backend.service
sudo systemctl status fossgis-platzmonitor-backend.service
```

Logs: `journalctl -u fossgis-platzmonitor-backend.service -f`
