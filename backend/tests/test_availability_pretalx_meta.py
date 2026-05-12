"""pretix meta_data vs. pretalx-Code in build_availability."""

from __future__ import annotations

import logging
from unittest.mock import patch

import pytest

from app.pretalx.schedule import build_pretalx_schedule
from app.services.availability_service import build_availability
from app.settings import Settings


def _sched_workshop_wa99():
    return build_pretalx_schedule(
        {
            "schedule": {
                "conference": {
                    "days": [
                        {
                            "rooms": {
                                "r1": [
                                    {
                                        "title": "Workshop Alpha",
                                        "date": "2026-03-26T09:00:00+01:00",
                                        "code": "WA99",
                                        "type": "Workshop (Präsenz)",
                                    },
                                ],
                            },
                        },
                    ],
                },
            },
        }
    )


def _sched_excursion_ex1():
    return build_pretalx_schedule(
        {
            "schedule": {
                "conference": {
                    "days": [
                        {
                            "rooms": {
                                "r1": [
                                    {
                                        "title": "Exkursion Berlin",
                                        "date": "2026-03-27T10:00:00+01:00",
                                        "code": "EX1",
                                        "type": "Vortrag",
                                    },
                                ],
                            },
                        },
                    ],
                },
            },
        }
    )


def _settings_meta() -> Settings:
    return Settings.model_validate(
        {
            "PRETIX_TOKEN": "test-token",
            "ORGANIZER": "fossgis",
            "EVENT": "2026",
            "PRETIX_PRETALX_META_KEY": "pretalx_code",
            "GROUP_UNMATCHED_BEHAVIOR": "other",
        }
    )


@patch("app.services.availability_service.load_pretalx_schedule")
@patch("app.services.availability_service.fetch_waiting_list_entries")
@patch("app.services.availability_service.fetch_items_and_quotas")
@patch("app.services.availability_service.fetch_event")
def test_meta_code_wins_over_mismatched_product_title(
    mock_sched, mock_wl, mock_iq, mock_event
):
    mock_sched.return_value = {"name": {"de": "Konf"}}
    mock_iq.return_value = ([], True)
    mock_event.return_value = _sched_workshop_wa99()
    item = {
        "id": 1,
        "active": True,
        "name": {"de": "Completely different shop title"},
        "meta_data": {"pretalx_code": "WA99"},
        "has_variations": False,
        "variations": [],
        "allow_waitinglist": False,
    }
    quota = {
        "id": 100,
        "name": "Quota X",
        "items": [1],
        "variations": [],
        "size": 10,
        "available_number": 5,
        "closed": False,
    }
    mock_wl.return_value = ([item], [quota])
    resp = build_availability(_settings_meta())
    assert len(resp.groups) == 1
    assert resp.groups[0].id == "workshops"
    e = resp.groups[0].entries[0]
    assert e.pretalx_code == "WA99"
    assert e.sort_at is not None


@patch("app.services.availability_service.load_pretalx_schedule")
@patch("app.services.availability_service.fetch_waiting_list_entries")
@patch("app.services.availability_service.fetch_items_and_quotas")
@patch("app.services.availability_service.fetch_event")
def test_diagnostic_meta_unknown_when_code_wrong_but_title_matches(
    mock_sched, mock_wl, mock_iq, mock_event, caplog
):
    mock_sched.return_value = {"name": {"de": "Konf"}}
    mock_iq.return_value = ([], True)
    mock_event.return_value = _sched_workshop_wa99()
    item = {
        "id": 1,
        "active": True,
        "name": {"de": "irrelevant"},
        "meta_data": {"pretalx_code": "ZZZZ"},
        "has_variations": False,
        "variations": [],
        "allow_waitinglist": False,
    }
    quota = {
        "id": 101,
        "name": "WS01 - Workshop Alpha",
        "items": [1],
        "variations": [],
        "size": 10,
        "available_number": 3,
        "closed": False,
    }
    mock_wl.return_value = ([item], [quota])
    caplog.set_level(logging.INFO)
    log_av = logging.getLogger("pm.availability")
    log_av.addHandler(caplog.handler)
    log_av.setLevel(logging.INFO)
    try:
        build_availability(_settings_meta())
    finally:
        log_av.removeHandler(caplog.handler)
    assert any("pretalx_match=meta_unknown" in rec.getMessage() for rec in caplog.records)


@patch("app.services.availability_service.load_pretalx_schedule")
@patch("app.services.availability_service.fetch_waiting_list_entries")
@patch("app.services.availability_service.fetch_items_and_quotas")
@patch("app.services.availability_service.fetch_event")
def test_diagnostic_title_when_no_meta_value(mock_sched, mock_wl, mock_iq, mock_event, caplog):
    mock_sched.return_value = {"name": {"de": "Konf"}}
    mock_iq.return_value = ([], True)
    mock_event.return_value = _sched_excursion_ex1()
    item = {
        "id": 2,
        "active": True,
        "name": {"de": "irrelevant"},
        "meta_data": {},
        "has_variations": False,
        "variations": [],
        "allow_waitinglist": False,
    }
    quota = {
        "id": 102,
        "name": "Exkursion Berlin",
        "items": [2],
        "variations": [],
        "size": 20,
        "available_number": 1,
        "closed": False,
    }
    mock_wl.return_value = ([item], [quota])
    caplog.set_level(logging.INFO)
    log_av = logging.getLogger("pm.availability")
    log_av.addHandler(caplog.handler)
    log_av.setLevel(logging.INFO)
    try:
        build_availability(_settings_meta())
    finally:
        log_av.removeHandler(caplog.handler)
    assert any("pretalx_match=title" in rec.getMessage() for rec in caplog.records)


@patch("app.services.availability_service.load_pretalx_schedule")
@patch("app.services.availability_service.fetch_waiting_list_entries")
@patch("app.services.availability_service.fetch_items_and_quotas")
@patch("app.services.availability_service.fetch_event")
def test_conflict_warning_two_meta_codes(mock_sched, mock_wl, mock_iq, mock_event, caplog):
    mock_sched.return_value = {"name": {"de": "Konf"}}
    mock_iq.return_value = ([], True)
    mock_event.return_value = _sched_workshop_wa99()
    it1 = {
        "id": 1,
        "active": True,
        "name": {"de": "A"},
        "meta_data": {"pretalx_code": "WA99"},
        "has_variations": False,
        "variations": [],
        "allow_waitinglist": False,
    }
    it2 = {
        "id": 2,
        "active": True,
        "name": {"de": "B"},
        "meta_data": {"pretalx_code": "OTHER"},
        "has_variations": False,
        "variations": [],
        "allow_waitinglist": False,
    }
    quota = {
        "id": 990001,
        "name": "Combined",
        "items": [1, 2],
        "variations": [],
        "size": 5,
        "available_number": 2,
        "closed": False,
    }
    mock_wl.return_value = ([it1, it2], [quota])
    caplog.set_level(logging.WARNING)
    log_av = logging.getLogger("pm.availability")
    log_av.addHandler(caplog.handler)
    log_av.setLevel(logging.WARNING)
    try:
        build_availability(_settings_meta())
    finally:
        log_av.removeHandler(caplog.handler)
    assert any("mehrere verschiedene" in rec.getMessage() for rec in caplog.records)
