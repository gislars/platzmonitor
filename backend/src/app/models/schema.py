from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class EventInfo(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    organizer: str
    slug: str
    title: str = Field(
        default="",
        description="Anzeigename der Veranstaltung (pretix name, lokalisiert)",
    )


class AvailabilityFinite(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    kind: Literal["finite"] = "finite"
    free: int = Field(description="Freie Plätze (available_number oder 0)")
    total: int | None = None


class AvailabilityUnlimited(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    kind: Literal["unlimited"] = "unlimited"


class Entry(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    label: str
    group_id: str = Field(
        serialization_alias="groupId",
        description="Gruppen-ID aus der Klassifikation (z. B. workshops, excursions)",
    )
    availability: AvailabilityFinite | AvailabilityUnlimited
    status: Literal["open", "sold_out", "closed"]
    sort_at: datetime | None = Field(
        default=None,
        serialization_alias="sortAt",
        description="Frühester bekannter Zeitpunkt aus pretix (Item), für Sortierung",
    )
    pretalx_code: str | None = Field(
        default=None,
        serialization_alias="pretalxCode",
        description="Session-Code aus Pretalx-Schedule bei Titel-Match; sonst null",
    )
    waiting_list_enabled: bool = Field(
        default=False,
        serialization_alias="waitingListEnabled",
        description="pretix-Item erlaubt Warteliste",
    )
    waiting_list_count: int | None = Field(
        default=None,
        serialization_alias="waitingListCount",
        description="Aktive Wartende (ohne Gutschein); null wenn Abruf fehlgeschlagen",
    )


class Group(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    title: str
    entries: list[Entry]


class AvailabilityResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    fetched_at: datetime = Field(serialization_alias="fetchedAt")
    event: EventInfo
    groups: list[Group]


class ErrorBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    error: str
    message: str
