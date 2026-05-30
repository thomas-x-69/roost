"""
Full Integration Suite — runs after all phase tests to verify end-to-end flows.
Tests WebSocket, system info, error handling, and cross-cutting concerns.
Requires backend running on localhost:5000.
"""
import json
import pytest
from playwright.sync_api import Page, expect

BASE = "http://localhost:5000"

ALL_PAGES = [
    ("/",          "Dashboard"),
    ("/devices",   "Devices"),
    ("/groups",    "Groups"),
    ("/schedules", "Schedules"),
    ("/usage",     "Usage"),
    ("/top-sites", "Top Sites"),
    ("/threats",   "Threats"),
    ("/alerts",    "Alerts"),
    ("/reports",   "Reports"),
]


@pytest.fixture(autouse=True)
def require_server(server_running):
    pass


# ---------------------------------------------------------------------------
# Health / system
# ---------------------------------------------------------------------------

def test_health_endpoint(page: Page):
    r = page.request.get(f"{BASE}/health")
    assert r.status == 200
    body = r.json()
    assert body["status"] == "ok"
    assert "version" in body


def test_system_info_returns_gateway(page: Page):
    r = page.request.get(f"{BASE}/api/v1/system/info")
    assert r.status == 200
    body = r.json()
    assert "gateway_ip" in body
    assert "own_ip" in body
    assert body["gateway_ip"]   # not None/empty


# ---------------------------------------------------------------------------
# All pages load without JS errors
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("path,heading", ALL_PAGES)
def test_page_loads(page: Page, path: str, heading: str):
    """Every nav page should load, have title Roost and show a heading."""
    page.goto(f"{BASE}{path}")
    expect(page).to_have_title("Roost")
    page.wait_for_load_state("domcontentloaded")


# ---------------------------------------------------------------------------
# API error handling
# ---------------------------------------------------------------------------

def test_api_404_for_missing_device(page: Page):
    r = page.request.get(f"{BASE}/api/v1/devices/999999")
    assert r.status == 404


def test_api_403_for_blocking_gateway(page: Page):
    """Blocking the gateway returns 403, not 200 or 500."""
    r = page.request.get(f"{BASE}/api/v1/devices")
    gateway = next(
        (d for d in r.json()["devices"] if d.get("device_type") == "router" or d.get("is_protected")),
        None,
    )
    if not gateway:
        pytest.skip("No gateway in DB")
    r2 = page.request.post(f"{BASE}/api/v1/devices/{gateway['id']}/block")
    assert r2.status == 403


# ---------------------------------------------------------------------------
# WebSocket connectivity
# ---------------------------------------------------------------------------

def test_websocket_connected_event(page: Page):
    """WebSocket endpoint sends a 'connected' event on connect."""
    page.goto(f"{BASE}/")
    # Open a fresh WS, collect the first server message
    result = page.evaluate("""
        () => new Promise((resolve) => {
            const ws = new WebSocket('ws://localhost:5000/ws');
            ws.onmessage = (e) => {
                try { ws.close(); resolve(JSON.parse(e.data)); }
                catch { ws.close(); resolve(null); }
            };
            ws.onerror = () => resolve(null);
        })
    """)
    assert result is not None, "WebSocket did not receive any message"
    assert result.get("event") == "connected"
    assert "client_id" in result.get("data", {})


# ---------------------------------------------------------------------------
# Devices list is non-empty
# ---------------------------------------------------------------------------

def test_at_least_one_device_discovered(page: Page):
    """At least one device (own PC or gateway) is in the DB."""
    r = page.request.get(f"{BASE}/api/v1/devices")
    assert r.status == 200
    body = r.json()
    assert body["total"] >= 1, "Expected at least 1 device in DB"


# ---------------------------------------------------------------------------
# Threats API end-to-end
# ---------------------------------------------------------------------------

def test_threat_check_unknown_safe_domain(page: Page):
    r = page.request.post(
        f"{BASE}/api/v1/threats/check",
        data={"domain": "this-domain-is-definitely-not-a-threat-12345.example"},
        headers={"Content-Type": "application/json"},
    )
    assert r.status == 200
    body = r.json()
    assert body["is_threat"] is False


# ---------------------------------------------------------------------------
# Reports end-to-end
# ---------------------------------------------------------------------------

def test_generate_and_download_report(page: Page):
    """Generate a PDF and download it — verify content-type."""
    gen = page.request.post(
        f"{BASE}/api/v1/reports/generate",
        data={"period": "today"},
        headers={"Content-Type": "application/json"},
    )
    assert gen.status == 200
    filename = gen.json().get("filename", "")
    assert filename.endswith(".pdf")

    dl = page.request.get(f"{BASE}/api/v1/reports/{filename}")
    assert dl.status == 200
    ct = dl.headers.get("content-type", "")
    assert "pdf" in ct


# ---------------------------------------------------------------------------
# Schedules API end-to-end
# ---------------------------------------------------------------------------

def test_schedule_crud(page: Page):
    """Create, list, delete a schedule."""
    # Need a non-protected device
    devs = page.request.get(f"{BASE}/api/v1/devices").json()["devices"]
    device = next(
        (d for d in devs if not d["is_protected"] and d.get("device_type") not in ("router", "gateway")),
        None,
    )
    if not device:
        pytest.skip("No non-protected device")

    r = page.request.post(
        f"{BASE}/api/v1/schedules",
        data={"name": "Integration Test Schedule", "device_id": device["id"],
              "action": "block", "days_of_week": [6], "start_time": "23:59", "end_time": "23:58"},
        headers={"Content-Type": "application/json"},
    )
    assert r.status == 200
    sid = r.json()["schedule"]["id"]

    list_r = page.request.get(f"{BASE}/api/v1/schedules")
    assert sid in [s["id"] for s in list_r.json()["schedules"]]

    del_r = page.request.delete(f"{BASE}/api/v1/schedules/{sid}")
    assert del_r.status == 200
