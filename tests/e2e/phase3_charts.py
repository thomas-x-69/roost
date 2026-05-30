"""
Phase 3 E2E Tests — Bandwidth Tracking + DNS + Charts
Tests the Usage and Top Sites pages and API endpoints.
Requires backend running on localhost:5000.
"""
import pytest
from playwright.sync_api import Page, expect

BASE = "http://localhost:5000"


@pytest.fixture(autouse=True)
def require_server(server_running):
    pass


# ---------------------------------------------------------------------------
# API tests
# ---------------------------------------------------------------------------

def test_api_usage_summary_shape(page: Page):
    """GET /usage/summary returns expected keys with numeric values."""
    r = page.request.get(f"{BASE}/api/v1/usage/summary")
    assert r.status == 200
    body = r.json()
    assert "total_bytes_today" in body
    assert "total_bytes_week" in body
    assert "total_bytes_month" in body
    assert isinstance(body["total_bytes_today"], (int, float))


def test_api_top_devices_returns_list(page: Page):
    """GET /usage/top-devices returns a list."""
    r = page.request.get(f"{BASE}/api/v1/usage/top-devices")
    assert r.status == 200
    assert isinstance(r.json(), list)


def test_api_usage_history_returns_list(page: Page):
    """GET /usage/history returns a list for any device."""
    r = page.request.get(f"{BASE}/api/v1/devices")
    devices = r.json()["devices"]
    if not devices:
        pytest.skip("No devices in DB")
    device_id = devices[0]["id"]
    r2 = page.request.get(f"{BASE}/api/v1/usage/history?device_id={device_id}&period=today")
    assert r2.status == 200
    assert isinstance(r2.json(), list)


def test_api_top_sites_returns_list(page: Page):
    """GET /usage/dns/top-sites returns a list."""
    r = page.request.get(f"{BASE}/api/v1/usage/dns/top-sites")
    assert r.status == 200
    assert isinstance(r.json(), list)


def test_api_device_dns_returns_list(page: Page):
    """GET /usage/dns/device/{id} returns a list."""
    r = page.request.get(f"{BASE}/api/v1/devices")
    devices = r.json()["devices"]
    if not devices:
        pytest.skip("No devices in DB")
    device_id = devices[0]["id"]
    r2 = page.request.get(f"{BASE}/api/v1/usage/dns/device/{device_id}")
    assert r2.status == 200
    assert isinstance(r2.json(), list)


# ---------------------------------------------------------------------------
# UI tests
# ---------------------------------------------------------------------------

def test_usage_page_loads(page: Page):
    """Usage page renders with correct heading."""
    page.goto(f"{BASE}/usage")
    expect(page).to_have_title("Roost")
    expect(page.locator("h1")).to_contain_text("Bandwidth")


def test_usage_period_selector_exists(page: Page):
    """Period selector (Today/7 Days/30 Days) is visible."""
    page.goto(f"{BASE}/usage")
    selector = page.locator("[data-testid='period-selector']")
    expect(selector).to_be_visible()
    # All three options present
    expect(selector).to_contain_text("Today")
    expect(selector).to_contain_text("7 Days")
    expect(selector).to_contain_text("30 Days")


def test_usage_chart_container_visible(page: Page):
    """Bandwidth chart container renders."""
    page.goto(f"{BASE}/usage")
    chart = page.locator("[data-testid='bandwidth-chart']")
    expect(chart).to_be_visible()


def test_top_sites_page_loads(page: Page):
    """Top Sites page renders with correct heading."""
    page.goto(f"{BASE}/top-sites")
    expect(page).to_have_title("Roost")
    expect(page.locator("h1")).to_contain_text("Top Sites")


def test_top_sites_table_or_empty_state(page: Page):
    """Top Sites page renders either a table or an empty-state message."""
    page.goto(f"{BASE}/top-sites")
    page.wait_for_timeout(1000)
    has_table = page.locator("[data-testid='top-sites-table']").is_visible()
    has_empty = page.locator("text=No DNS data").is_visible()
    assert has_table or has_empty, "Top Sites page shows neither table nor empty state"


def test_device_row_has_status_badge(page: Page):
    """Device rows show a status badge (Online/Offline/Blocked)."""
    page.goto(f"{BASE}/devices")
    page.wait_for_selector("[data-testid='device-row']", timeout=10000)
    badge = page.locator("[data-testid='status-badge'], [data-testid='status-badge-blocked']").first
    expect(badge).to_be_visible()


def test_navigate_to_usage_via_sidebar(page: Page):
    page.goto(BASE)
    page.locator("aside").get_by_text("Usage").click()
    expect(page).to_have_url(f"{BASE}/usage")


def test_navigate_to_top_sites_via_sidebar(page: Page):
    page.goto(BASE)
    page.locator("aside").get_by_text("Top Sites").click()
    expect(page).to_have_url(f"{BASE}/top-sites")
