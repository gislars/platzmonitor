# systemd: Backend

Zwei Vorlagen:

| Datei                                       | Einsatz                                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| `fossgis-platzmonitor-backend.service`      | System-Unit unter `/etc/systemd/system/`, fester `User`/`Group` (z. B. `www-data`) |
| `fossgis-platzmonitor-backend.user.service` | User-Unit (`systemctl --user`), kein `sudo` fuer Start/Stop                        |

Vor dem Kopieren: **`WorkingDirectory`** und **`EnvironmentFile`** auf euren absoluten `backend/`-Pfad setzen; bei System-Unit **`User`/`Group`** anpassen. Falls `uv` nicht gefunden wird: `PATH` in der Unit oder vollen Pfad zu `uv` eintragen.

## ROOT_PATH und Swagger

Oeffentliche Docs unter z. B. `https://fossgis.mapwebbing.eu/backend/docs` brauchen im Backend **`DOCS_ENABLED=true`** und **`ROOT_PATH=/backend`** (OpenAPI-URL muss `/backend/openapi.json` sein). Die Beispiel-System-Unit setzt `Environment=ROOT_PATH=/backend` passend zu nginx.

**Wichtig:** FastAPI nutzt `ROOT_PATH` aus der Umgebung. **`uvicorn --root-path`** hier **nicht** zusaetzlich verwenden, wenn nginx den Pfad bereits passend reicht (sonst Routing-Probleme).

## System-Dienst

```bash
sudo cp deploy/systemd/fossgis-platzmonitor-backend.service /etc/systemd/system/
# Unit editieren: WorkingDirectory, User, Group, EnvironmentFile
sudo systemctl daemon-reload
sudo systemctl enable --now fossgis-platzmonitor-backend.service
```

Logs: `journalctl -u fossgis-platzmonitor-backend.service -f` (Uvicorn/Server). Anwendungslogs mit konfigurierten Quellen und Snapshot-Zahlen stehen bei Standardkonfiguration in **`/var/log/platzmonitor/app.log`** (Verzeichnis anlegen und Rechte siehe Backend-README); Rotation z. B. mit [`deploy/logrotate/platzmonitor`](../logrotate/platzmonitor).

## User-Dienst

```bash
mkdir -p ~/.config/systemd/user
cp deploy/systemd/fossgis-platzmonitor-backend.user.service ~/.config/systemd/user/fossgis-platzmonitor-backend.service
# WorkingDirectory, EnvironmentFile anpassen
systemctl --user daemon-reload
systemctl --user enable --now fossgis-platzmonitor-backend.service
```

Logs: `journalctl --user -u fossgis-platzmonitor-backend.service -f`

**Nach Reboot ohne Login:** `sudo loginctl enable-linger "$USER"` (einmalig), sonst startet der User-Dienst nicht ohne Session.
