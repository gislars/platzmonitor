from __future__ import annotations

import json
import re
from typing import Any, Literal

from pydantic import BaseModel, Field, TypeAdapter, ValidationError

from app.loggers import get_logger
from app.settings import Settings

logger = get_logger("groups")


class MatchPrefix(BaseModel):
    type: Literal["prefix"] = "prefix"
    value: str


class MatchContainsAny(BaseModel):
    type: Literal["contains_any"] = "contains_any"
    values: list[str]


_MAX_REGEX_PATTERN_LEN = 256


class MatchRegex(BaseModel):
    type: Literal["regex"] = "regex"
    pattern: str = Field(max_length=_MAX_REGEX_PATTERN_LEN)


MatchSpec = MatchPrefix | MatchContainsAny | MatchRegex


class GroupRule(BaseModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    match: MatchSpec


DEFAULT_GROUP_RULES: list[dict[str, Any]] = [
    {
        "id": "workshops",
        "title": "Workshops",
        "match": {"type": "prefix", "value": "WS"},
    },
    {
        "id": "excursions",
        "title": "Exkursionen",
        "match": {
            "type": "contains_any",
            "values": ["exkursion", "stadtrundgang", "stadtführung", "stadtfuhrung"],
        },
    },
]


def _match_name(name: str, spec: MatchSpec) -> bool:
    n = name.strip()
    cf = n.casefold()
    if isinstance(spec, MatchPrefix):
        prefix = spec.value.strip()
        if not prefix:
            return False
        return cf.startswith(prefix.casefold())
    if isinstance(spec, MatchContainsAny):
        return any(v.casefold() in cf for v in spec.values)
    if isinstance(spec, MatchRegex):
        return re.search(spec.pattern, n, re.IGNORECASE) is not None
    return False


def find_group_for_label(label: str, rules: list[GroupRule]) -> GroupRule | None:
    for rule in rules:
        if _match_name(label, rule.match):
            return rule
    return None


def parse_group_rules_json(raw: str) -> list[GroupRule]:
    data = json.loads(raw)
    ta = TypeAdapter(list[GroupRule])
    return ta.validate_python(data)


def load_group_rules(settings: Settings) -> list[GroupRule]:
    ta = TypeAdapter(list[GroupRule])
    fallback = ta.validate_python(DEFAULT_GROUP_RULES)
    raw = settings.group_rules_json.strip()
    if not raw:
        return fallback
    try:
        return parse_group_rules_json(raw)
    except (json.JSONDecodeError, ValidationError, ValueError) as e:
        logger.warning("GROUP_RULES_JSON ungültig, Standardregeln: %s", e)
        return fallback
