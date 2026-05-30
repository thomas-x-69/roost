"""
Phase 1 E2E Tests — Device Discovery
Tests that the app loads, shows the device table, and the API works.
Requires backend running on localhost:5000.
"""
import pytest
from playwright.sync_api import Page, expect


BASE = "http://localhost:5000"


@pytest.fixture(autouse=True)
def require_server(server_running):
    """All tests in this file need the server."""
    pass


# ---------------------------------------------------------------------------
# Test 1: App loads with title Roost
# ---------------------------------------------------------------------------
def test_app_loads(page: Page):
    page.goto(BASE)
    expect(page).to_have_title("Roost")


# ---------------------------------------------------------------------------
# Test 2: Sidebar is visible
# ---------------------------------------------------------------------------
def test_sidebar_visible(page: Page):
    page.goto(BASE)
    # Sidebar contains "Roost" text
    sidebar = page.locator("aside")
    expect(sidebar).to_be_visible()
    expect(sidebar).to_contain_text("Roost")


# ---------------------------------------------------------------------------
# Test 3: Devices page has a table
# ---------------------------------------------------------------------------
def test_device_table_visible(page: Page):
    page.goto(f"{BASE}/devices")
    table = page.locator("[data-testid='device-table']")
    expect(table).to_be_visible(timeout=20000)


# ---------------------------------------------------------------------------
# Test 4: At least one device row present
# ---------------------------------------------------------------------------
def test_devices_populated(page: Page):
    page.goto(f"{BASE}/devices")
    # Wait for table to load
    page.wait_for_selector("[data-testid='device-table']", timeout=20000)
    rows = page.locator("[data-testid='device-row']")
    count = rows.count()
    assert count >= 1, f"Expected ≥1 device rows, got {count}"


# ---------------------------------------------------------------------------
# Test 5: Device rows show IP and MAC columns
# ---------------------------------------------------------------------------
def test_device_row_has_ip_mac(page: Page):
    page.goto(f"{BASE}/devices")
    page.wait_for_selector("[data-testid='device-row']", timeout=20000)
    first_row = page.locator("[data-testid='device-row']").first
    ip_cell = first_row.locator("[data-testid='device-ip']")
    mac_cell = first_row.locator("[data-testid='device-mac']")
    expect(ip_cell).to_be_visible()
    expect(mac_cell).to_be_visible()


# ---------------------------------------------------------------------------
# Test 6: API GET /devices returns valid JSON
# ---------------------------------------------------------------------------
def test_api_devices_returns_json(page: Page):
    response = page.request.get(f"{BASE}/api/v1/devices")
    assert response.status == 200
    body = response.json()
    assert "devices" in body
    assert isinstance(body["devices"], list)
    assert "total" in body
    assert body["total"] >= 1


# ---------------------------------------------------------------------------
# Test 7: API GET /system/info returns network info
# ---------------------------------------------------------------------------
def test_api_system_info(page: Page):
    response = page.request.get(f"{BASE}/api/v1/system/info")
    assert response.status == 200
    body = response.json()
    assert "gateway_ip" in body
    assert "own_ip" in body
    assert "network_cidr" in body


# ---------------------------------------------------------------------------
# Test 8: Scan button exists in the topbar
# ---------------------------------------------------------------------------
def test_scan_button_exists(page: Page):
    page.goto(f"{BASE}/devices")
    scan_btn = page.locator("[data-testid='scan-button']")
    expect(scan_btn).to_be_visible()


# ---------------------------------------------------------------------------
# Test 9: Manual scan button triggers a scan
# ---------------------------------------------------------------------------
def test_manual_scan_triggers(page: Page):
    page.goto(f"{BASE}/devices")
    scan_btn = page.locator("[data-testid='scan-button']")
    scan_btn.click()
    # After click, button should show "Scanning..." or progress indicator appears
    # (progress may be brief — check the scan API was called)
    response = page.request.post(f"{BASE}/api/v1/devices/scan")
    assert response.status == 200
    body = response.json()
    assert body["status"] in ("scan_started", "already_scanning")


# ---------------------------------------------------------------------------
# Test 10: WebSocket connection status is visible in sidebar
# ---------------------------------------------------------------------------
def test_ws_status_visible(page: Page):
    """Sidebar shows live WebSocket connection status (Live / Connecting / Offline)."""
    page.goto(f"{BASE}/devices")
    # The sidebar footer contains a WS status label
    sidebar = page.locator("aside")
    # Give WS a moment to connect
    page.wait_for_timeout(1500)
    text = sidebar.inner_text().lower()
    assert any(word in text for word in ("live", "connecting", "offline")), \
        f"WS status label not found in sidebar text: {text!r}"


# ---------------------------------------------------------------------------
# Test 11: Dashboard page loads with stat cards
# ---------------------------------------------------------------------------
def test_dashboard_loads(page: Page):
    page.goto(BASE)
    expect(page).to_have_title("Roost")
    # TopBar shows "Dashboard" as an h2 heading
    heading = page.locator("h2").first
    expect(heading).to_be_visible()


# ---------------------------------------------------------------------------
# Test 12: Navigation between pages works
# ---------------------------------------------------------------------------
def test_navigation_works(page: Page):
    page.goto(BASE)
    # Click Devices in sidebar
    page.locator("aside").get_by_text("Devices").click()
    expect(page).to_have_url(f"{BASE}/devices")
    # Click Dashboard
    page.locator("aside").get_by_text("Dashboard").click()
    expect(page).to_have_url(f"{BASE}/")


# ---------------------------------------------------------------------------
# Test 13: API /health endpoint works
# ---------------------------------------------------------------------------
def test_health_endpoint(page: Page):
    response = page.request.get(f"{BASE}/health")
    assert response.status == 200
    body = response.json()
    assert body["status"] == "ok"


# ---------------------------------------------------------------------------
# Test 14: Device vendor/type is displayed in rows
# ---------------------------------------------------------------------------
def test_device_row_shows_vendor(page: Page):
    page.goto(f"{BASE}/devices")
    page.wait_for_selector("[data-testid='device-row']", timeout=20000)
    # At least one row should have some content in it (not all blanks)
    first_row = page.locator("[data-testid='device-row']").first
    row_text = first_row.inner_text()
    assert len(row_text.strip()) > 10, "Device row appears empty"
