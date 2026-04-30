# FOSSGIS Platzmonitor

Infoscreen für Veranstaltungen. Das Backend liest Verfügbarkeiten aus pretix, das Frontend zeigt freie Plätze als Kacheln an.

## Features

- Anzeige freier Plätze pro Gruppe (aus pretix Quoten)
- Optional Wartelistenanzahl 
- Kiosk Modus, helles und dunkles Theme

## Überblick

Das Projekt besteht aus zwei Teilen:

- **Backend**: FastAPI JSON API (pretix, optional pretalx) unter `/event-api/`
- **Frontend**: statische Web App (Vite React) unter `/frontend/`

Die empfohlene Auslieferung ist ein Reverse Proxy (z.B. nginx), der beide unter derselben Domain bereitstellt. Optional zusätzliche Event API Endpunkte, siehe `backend/README.md`. Frontend und Backend können auch auf unterschiedlichen Hosts deployed werden.

## Konfiguration

- **Backend** nutzt `backend/.env` oder Umgebungsvariablen (mindestens `PRETIX_TOKEN`)
- **Frontend** nutzt `frontend/.env` für die API Basis URL (`VITE_API_BASE_URL`)
- Änderungen an `.env` werden beim Start gelesen, danach ist ein Neustart nötig

## Links

- Deployment Anleitung: [`deploy/README.md`](deploy/README.md)
- Backend Details (Konfiguration, Endpunkte, Tests): [`backend/README.md`](backend/README.md)
- Frontend Details (Konfiguration, Build): [`frontend/README.md`](frontend/README.md)


