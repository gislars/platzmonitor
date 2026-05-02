"""Tests fuer oeffentliche Event-API (Pretalx-Proxy, schedule-print)."""

from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.pretalx.proxy import clear_proxy_cache_for_tests
from app.routes.pretalx_public import reset_schedule_print_log_for_tests
from app.settings import clear_settings_cache


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch):
    clear_settings_cache()
    clear_proxy_cache_for_tests()
    reset_schedule_print_log_for_tests()
    monkeypatch.delenv("PRETALX_WIDGET_URL", raising=False)
    monkeypatch.delenv("SCHEDULE_PRINT_PATH", raising=False)
    monkeypatch.delenv("PRETALX_SCHEDULE_URL", raising=False)
    monkeypatch.delenv("ROOT_PATH", raising=False)
    clear_settings_cache()
    yield TestClient(app)
    clear_settings_cache()
    clear_proxy_cache_for_tests()
    reset_schedule_print_log_for_tests()


def test_widget_schedule_404_when_url_empty(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("PRETALX_WIDGET_URL", "   ")
    clear_settings_cache()
    r = client.get("/api/v1/widget-schedule")
    assert r.status_code == 404
    body = r.json()
    assert body["error"] == "widget_schedule_not_configured"


def test_schedule_404_when_url_empty(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("PRETALX_SCHEDULE_URL", "")
    clear_settings_cache()
    r = client.get("/api/v1/schedule")
    assert r.status_code == 404
    assert r.json()["error"] == "schedule_not_configured"


def test_schedule_print_404_when_path_empty(client: TestClient):
    r = client.get("/api/v1/schedule-print")
    assert r.status_code == 404
    assert r.json()["error"] == "schedule_print_not_configured"


def test_schedule_print_serves_file(client: TestClient, monkeypatch: pytest.MonkeyPatch, tmp_path):
    p = tmp_path / "sp.json"
    p.write_text('{"schedule":{"version":"1"}}', encoding="utf-8")
    monkeypatch.setenv("SCHEDULE_PRINT_PATH", str(p))
    clear_settings_cache()
    r = client.get("/api/v1/schedule-print")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/json")
    assert r.json()["schedule"]["version"] == "1"


class _FakeResponse:
    def __init__(self, status_code: int, content: bytes):
        self.status_code = status_code
        self.content = content
        self.text = content.decode("utf-8")


class _FakeHttpxClient:
    def __init__(self, *args: object, **kwargs: object) -> None:
        del args, kwargs

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def get(self, url, headers=None):
        return _FakeResponse(200, b'{"ok":true,"x":1}')


def test_schedule_proxy_returns_json(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv(
        "PRETALX_SCHEDULE_URL",
        "https://pretalx.example.com/export/schedule.json",
    )
    clear_settings_cache()
    clear_proxy_cache_for_tests()
    with patch("app.pretalx.proxy.httpx.Client", _FakeHttpxClient):
        r = client.get("/api/v1/schedule")
    assert r.status_code == 200
    assert r.json() == {"ok": True, "x": 1}
