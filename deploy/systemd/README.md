# systemd: Backend-Dienst

Vorlagen:

- **`fossgis-platzmonitor-backend.service`**: System-Dienst (`/etc/systemd/system/`), startet mit festem `User`/`Group` (z. B. `www-data`).
- **`fossgis-platzmonitor-backend.user.service`**: User-Dienst (`systemctl --user`), laeuft als der Account, der die Unit verwaltet (kein `sudo` fuer Start/Stop noetig).

## Anpassen (beide Varianten)

1. **System-Unit**: `User` / `Group` auf den Account setzen, der `WorkingDirectory` und `backend/.env` lesen darf.
2. **WorkingDirectory** und **EnvironmentFile**: absoluter Pfad zu eurem `backend/`-Ordner (nach `git clone`).
3. **ExecStart**: Falls `uv` nicht gefunden wird, `PATH` in der Unit setzen oder den vollen Pfad zu `uv` aus `which uv` eintragen.

Swagger unter `https://fossgis.mapwebbing.eu/backend/docs` braucht **`DOCS_ENABLED=true`** und einen gesetzten **`ROOT_PATH`** (oeffentliche OpenAPI-URL muss `/backend/openapi.json` sein, nicht `/openapi.json`). Die Unit setzt dafuer **`Environment=ROOT_PATH=/backend`** (passt zu `deploy/nginx/`). Technisch setzt FastAPI damit `scope["root_path"]`; **`uvicorn --root-path`** darf hier **nicht** genutzt werden, weil nginx den Request-Pfad bereits auf `/…` ohne `/backend` normalisiert und sonst das Routing bricht.

---

## Installation: System-Dienst

Unit nach `/etc/systemd/system/` kopieren, Pfade und `User`/`Group` anpassen:

```bash
sudo cp deploy/systemd/fossgis-platzmonitor-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now fossgis-platzmonitor-backend.service
sudo systemctl status fossgis-platzmonitor-backend.service
```

Logs: `journalctl -u fossgis-platzmonitor-backend.service -f`

---

## Installation: User-Dienst (`systemctl --user`)

Geeignet, wenn der Dienst unter einem normalen Login-Account laufen soll und **kein** `sudo` zum Starten und Stoppen noetig sein soll.

1. Vorlage nach **`~/.config/systemd/user/`** kopieren und **`WorkingDirectory`** sowie **`EnvironmentFile`** auf euren `backend/`-Pfad setzen (Dateiname beliebig, z. B. `fossgis-platzmonitor-backend.service`):

```bash
mkdir -p ~/.config/systemd/user
cp deploy/systemd/fossgis-platzmonitor-backend.user.service ~/.config/systemd/user/fossgis-platzmonitor-backend.service
# Datei editieren: WorkingDirectory, EnvironmentFile
systemctl --user daemon-reload
systemctl --user enable --now fossgis-platzmonitor-backend.service
systemctl --user status fossgis-platzmonitor-backend.service
```

Logs: `journalctl --user -u fossgis-platzmonitor-backend.service -f`

**Nach Reboot ohne aktive Login-Session:** User-Dienste laufen standardmaessig nur, wenn eine Session fuer diesen Benutzer existiert. Soll der Dienst auch ohne Login starten:

```bash
sudo loginctl enable-linger "$USER"
```

(`linger` einmalig vom Administrator ausfuehren.)

**Alternative ohne User-Dienst:** System-Unit unter `/etc/systemd/system/` behalten und mit **`sudo systemctl …`** verwalten.
