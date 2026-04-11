# systemd: Backend-Dienst

Datei: `fossgis-platzmonitor-backend.service`

## Anpassen

1. `User` / `Group`: Account, der das Repo und `backend/.env` lesen darf.
2. `WorkingDirectory` und `EnvironmentFile`: absoluter Pfad zu eurem `backend/`-Ordner (nach `git clone`).
3. `ExecStart`: Falls `uv` nicht gefunden wird, entweder `PATH` in der Unit setzen oder den vollen Pfad zu `uv` aus `which uv` eintragen.

Swagger unter `https://fossgis.mapwebbing.eu/backend/docs` braucht **`DOCS_ENABLED=true`** und einen gesetzten **`ROOT_PATH`** (öffentliche OpenAPI-URL muss `/backend/openapi.json` sein, nicht `/openapi.json`). Die Unit setzt dafür **`Environment=ROOT_PATH=/backend`** (passt zu `deploy/nginx/`). Technisch setzt FastAPI damit `scope["root_path"]`; **`uvicorn --root-path`** darf hier **nicht** genutzt werden, weil nginx den Request-Pfad bereits auf `/…` ohne `/backend` normalisiert und sonst das Routing bricht.

## Installation auf dem Server

```bash
sudo cp deploy/systemd/fossgis-platzmonitor-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now fossgis-platzmonitor-backend.service
sudo systemctl status fossgis-platzmonitor-backend.service
```

Logs: `journalctl -u fossgis-platzmonitor-backend.service -f`
