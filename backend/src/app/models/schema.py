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
    transaction_booked: int | None = Field(
        default=None,
        serialization_alias="transactionBooked",
        description=(
            "Kumulative Buchungen aus Transaktions-Timeline (pretix); "
            "nur bei Kapazität unlimited gesetzt wenn Wert bekannt"
        ),
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


class HistoryPoint(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    t: int = Field(description="Bucket start as Unix epoch seconds (UTC)")
    booked: int | None = None
    total: int | None = None
    waiting: int | None = None
    free: int | None = None


class HistorySeries(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    quota_id: str = Field(serialization_alias="quotaId")
    points: list[HistoryPoint]


class HistoryResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    fetched_at: datetime = Field(serialization_alias="fetchedAt")
    bucket_seconds: int = Field(serialization_alias="bucketSeconds")
    recording_started_at: int | None = Field(
        default=None,
        serialization_alias="recordingStartedAt",
        description="Unix epoch seconds first stored bucket, wenn bekannt",
    )
    series: list[HistorySeries]


class BookingTimelinePoint(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    t: int = Field(description="UTC Tagesbeginn Unix-Sekunden (Kalenderbucket)")
    booked: int


class BookingTimelineSeries(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    quota_id: str = Field(serialization_alias="quotaId")
    points: list[BookingTimelinePoint]


class BookingTimelineResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    fetched_at: datetime = Field(serialization_alias="fetchedAt")
    granularity: str = Field(default="daily_utc")
    source: str = Field(default="pretix_transactions")
    series: list[BookingTimelineSeries]


class RegistrationsPoint(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    date: str = Field(description="YYYY-MM-DD snapshot day")
    weeks_before: float = Field(serialization_alias="weeksBefore")
    online: int
    onsite: int | None = Field(
        default=None,
        description="null wenn keine getrennte Onsite-Zählung gespeichert",
    )


class RegistrationsEvent(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    slug: str
    label: str
    start_date: str = Field(serialization_alias="startDate")
    points: list[RegistrationsPoint]


class RegistrationsResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    fetched_at: datetime = Field(serialization_alias="fetchedAt")
    emphasized_event_slug: str = Field(serialization_alias="emphasizedEventSlug")
    events: list[RegistrationsEvent]
