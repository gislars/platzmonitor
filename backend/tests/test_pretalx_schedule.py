"""Tests fuer Pretalx-Schedule-Parsing (Workshop-Erkennung ueber Export-Feld ``type``)."""

from __future__ import annotations

from app.pretalx.schedule import (
    PretalxSchedule,
    build_title_to_meta_map,
    match_pretalx_from_candidates,
    match_pretalx_label,
)
from app.services.group_rules import DEFAULT_GROUP_RULES


def _minimal_day(room_events: list[dict]) -> dict:
    return {"rooms": {"r1": room_events}}


def test_build_title_flags_workshop_from_type():
    raw = {
        "schedule": {
            "conference": {
                "days": [
                    _minimal_day(
                        [
                            {
                                "title": "QGIS fuer Einsteiger",
                                "date": "2026-03-26T09:00:00+01:00",
                                "code": "AA123",
                                "type": "Workshop (Präsenz)",
                            },
                            {
                                "title": "Einfuehrung MapServer",
                                "date": "2026-03-26T11:00:00+01:00",
                                "code": "BB999",
                                "type": "Vortrag",
                            },
                        ]
                    ),
                ]
            }
        }
    }
    m = build_title_to_meta_map(raw)
    assert m["qgis fuer einsteiger"][2] is True
    assert m["einfuehrung mapserver"][2] is False


def test_match_label_strips_ws_prefix_with_unicode_dash():
    """Pretix nutzt haeufig U+2013 statt ASCII-Hyphen im WS-Praefix."""
    raw = {
        "schedule": {
            "conference": {
                "days": [
                    _minimal_day(
                        [
                            {
                                "title": "QGIS Workshop",
                                "date": "2024-03-20T13:30:00+01:00",
                                "code": "QD77",
                                "type": "Workshop (Präsenz)",
                            },
                        ]
                    ),
                ]
            }
        }
    }
    sched = PretalxSchedule(title_to_meta=build_title_to_meta_map(raw))
    label = "WS05\u2013QGIS Workshop"
    mt = match_pretalx_label(label, sched)
    assert mt is not None
    assert mt.is_workshop is True
    assert mt.code == "QD77"


def test_match_label_strips_ws_prefix_like_pretix_product_name():
    raw = {
        "schedule": {
            "conference": {
                "days": [
                    _minimal_day(
                        [
                            {
                                "title": "Datenbanktricks",
                                "date": "2025-03-27T10:00:00+01:00",
                                "code": "XX42",
                                "type": "Langer Workshop am Dienstag",
                            },
                        ]
                    ),
                ]
            }
        }
    }
    sched = PretalxSchedule(title_to_meta=build_title_to_meta_map(raw))
    label = "WS07 - Datenbanktricks"
    mt = match_pretalx_label(label, sched)
    assert mt is not None
    assert mt.is_workshop is True
    assert mt.code == "XX42"


def test_match_pretalx_from_candidates_falls_back_to_second_label():
    raw = {
        "schedule": {
            "conference": {
                "days": [
                    _minimal_day(
                        [
                            {
                                "title": "PostGIS fuer Einsteiger",
                                "date": "2024-03-20T14:00:00+01:00",
                                "code": "PG1",
                                "type": "Workshop (Präsenz)",
                            },
                        ]
                    ),
                ]
            }
        }
    }
    sched = PretalxSchedule(title_to_meta=build_title_to_meta_map(raw))
    m = match_pretalx_from_candidates(
        ["Generische Quota", "WS03 - PostGIS fuer Einsteiger"],
        sched,
    )
    assert m is not None
    assert m.is_workshop is True
    assert m.code == "PG1"


def test_default_group_rules_do_not_define_workshops_by_name():
    assert all(r["id"] != "workshops" for r in DEFAULT_GROUP_RULES)


def test_workshop_named_room_fossgis_2024_style():
    raw = {
        "schedule": {
            "conference": {
                "days": [
                    _minimal_day(
                        [
                            {
                                "title": "Kartendrucke Automation",
                                "date": "2024-03-21T09:00:00+01:00",
                                "code": "K9",
                                "type": "Vortrag",
                                "room": "Workshop 1 (D.013)",
                            },
                        ]
                    ),
                ]
            }
        }
    }
    m = build_title_to_meta_map(raw)
    assert m["kartendrucke automation"][2] is True


def test_workshop_fallback_ws_room_when_type_missing():
    raw = {
        "schedule": {
            "conference": {
                "days": [
                    _minimal_day(
                        [
                            {
                                "title": "Legacy Slot",
                                "date": "2025-03-26T09:00:00+01:00",
                                "code": "Z1",
                                "room": "WS3 (Labor)",
                            },
                        ]
                    ),
                ]
            }
        }
    }
    sched = PretalxSchedule(title_to_meta=build_title_to_meta_map(raw))
    mt = match_pretalx_label("WS01 - Legacy Slot", sched)
    assert mt is not None
    assert mt.is_workshop is True
