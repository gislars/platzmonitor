from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    pretix_base_url: str = Field(default="https://pretix.eu", alias="PRETIX_BASE_URL")
    pretix_token: str = Field(default="", alias="PRETIX_TOKEN")
    http_user_agent: str = Field(
        default="fossgis-platzmonitor/0.1.0",
        alias="HTTP_USER_AGENT",
        description="User-Agent für ausgehende HTTP-Requests zu pretix und pretalx",
    )
    organizer: str = Field(default="fossgis", alias="ORGANIZER")
    event: str = Field(default="2026", alias="EVENT")
    frontend_origin: str = Field(default="", alias="FRONTEND_ORIGIN")
    frontend_origin_regex: str = Field(default="", alias="FRONTEND_ORIGIN_REGEX")
    docs_enabled: bool = Field(
        default=False,
        alias="DOCS_ENABLED",
        description="Swagger UI und /openapi.json; Standard aus (Produktion)",
    )
    root_path: str = Field(
        default="",
        alias="ROOT_PATH",
        description=(
            "URL-Prefix hinter Reverse-Proxy (z. B. /event-api), damit /docs die OpenAPI-URL "
            "korrekt auflöst; leer wenn die App an der Domainwurzel hängt"
        ),
    )
    pretalx_schedule_url: str = Field(
        default="https://pretalx.com/fossgis2026/schedule/export/schedule.json",
        alias="PRETALX_SCHEDULE_URL",
    )
    pretalx_widget_url: str = Field(
        default="",
        alias="PRETALX_WIDGET_URL",
        description="Pretalx Widget-JSON URL; leer liefert 404 auf /api/v1/widget-schedule",
    )
    schedule_print_path: str = Field(
        default="",
        alias="SCHEDULE_PRINT_PATH",
        description="Pfad zur Druck-JSON fuer schedule-print; leer liefert 404",
    )
    pretalx_schedule_cache_seconds: int = Field(
        default=3600,
        alias="PRETALX_SCHEDULE_CACHE_SECONDS",
    )
    availability_refresh_seconds: int = Field(
        default=55,
        ge=1,
        le=86400,
        alias="AVAILABILITY_REFRESH_SECONDS",
        description=(
            "Sekunden zwischen Hintergrund-Abrufen (pretix/pretalx); GET liefert nur den Snapshot. "
            "Mehrere uvicorn-Worker: je Prozess eigener Abruf."
        ),
    )

    group_rules_json: str = Field(
        default="",
        alias="GROUP_RULES_JSON",
        description="JSON-Liste von Gruppenregeln; leer = Standard (Workshops, Exkursionen)",
    )
    group_unmatched_behavior: Literal["drop", "other"] = Field(
        default="drop",
        alias="GROUP_UNMATCHED_BEHAVIOR",
    )
    group_other_id: str = Field(default="other", alias="GROUP_OTHER_ID")
    group_other_title: str = Field(default="Sonstiges", alias="GROUP_OTHER_TITLE")
    log_level: str = Field(
        default="INFO",
        alias="LOG_LEVEL",
        description="Python-Log-Level fuer Logger pm (DEBUG, INFO, WARNING, ...)",
    )
    log_file: str = Field(
        default="",
        alias="LOG_FILE",
        description="App-Logdatei; leer = /var/log/platzmonitor/app.log",
    )
    history_db_path: str = Field(default="data/history.sqlite", alias="HISTORY_DB_PATH")
    history_retention_days: int = Field(
        default=0,
        ge=0,
        alias="HISTORY_RETENTION_DAYS",
        description="0 = unbegrenzt; sonst beim Schreiben ggf. alte Buckets loeschen",
    )
    history_bucket_seconds: int = Field(
        default=3600,
        ge=60,
        le=86400,
        alias="HISTORY_BUCKET_SECONDS",
    )
    history_default_window_hours: int = Field(
        default=0,
        ge=0,
        alias="HISTORY_DEFAULT_WINDOW_HOURS",
        description="0 = keine Default-Begrenzung im Client; Server nutzt seit erstem Bucket",
    )
    registrations_db_path: str = Field(
        default="data/registrations.sqlite",
        alias="REGISTRATIONS_DB_PATH",
    )
    booking_timeline_db_path: str = Field(
        default="data/booking_timeline.sqlite",
        alias="BOOKING_TIMELINE_DB_PATH",
    )
    booking_timeline_refresh_seconds: int = Field(
        default=900,
        ge=60,
        le=86400,
        alias="BOOKING_TIMELINE_REFRESH_SECONDS",
        description=(
            "Mindestabstand zwischen Neuaufbauten Workshop-Kumulativa aus pretix-Transaktionen "
            "(nach erfolgreicher Verfügbarkeitsaktualisierung)"
        ),
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


def clear_settings_cache() -> None:
    get_settings.cache_clear()
