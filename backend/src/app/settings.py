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
    pretalx_schedule_url: str = Field(
        default="https://pretalx.com/fossgis2026/schedule/export/schedule.json",
        alias="PRETALX_SCHEDULE_URL",
    )
    pretalx_schedule_cache_seconds: int = Field(
        default=3600,
        alias="PRETALX_SCHEDULE_CACHE_SECONDS",
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


@lru_cache
def get_settings() -> Settings:
    return Settings()


def clear_settings_cache() -> None:
    get_settings.cache_clear()
