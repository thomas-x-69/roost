"""
Phase 2 E2E Tests — Block/Unblock + WebSocket + Schedules
Requires backend running on localhost:5000.

NOTE: Tests that execute actual ARP spoofing are skipped here to avoid
disrupting the live network. They are covered by the final integration suite.
"""
import pytest
from playwright.sync_api import Page, expect

BASE = "http://localhost:5000"


@pytest.fixture(autouse=True)
def require_server(server_running):
    pass


def json_post(page: Page, url: str, payload: dict):
    return page.request.post(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
    )


def get_blockable_device_id(page: Page) -> int:
    """Return a non-protected, non-gateway device ID."""
    response = page.request.get(f"{BASE}/api/v1/devices")
    body = response.json()
    # Skip protected AND gateway/router devices
    for d in body["devices"]:
        if not d["is_protected"] and d.get("device_type") not in ("router", "gateway"):
            return d["id"]
    pytest.skip("No blockable (non-protected, non-gateway) device found")


# ---------------------------------------------------------------------------
# UI tests
# ---------------------------------------------------------------------------

def test_block_button_exists(page: Page):
    """Block button is visible on at least one non-protected device row."""
    page.goto(f"{BASE}/devices")
    page.wait_for_selector("[data-testid='device-row']", timeout=20000)
    expect(page.locator("[data-testid='block-button']").first).to_be_visible()


def test_protected_device_shows_protected_label(page: Page):
    """Protected devices show 'Protected' label instead of block button."""
    response = page.request.get(f"{BASE}/api/v1/devices")
    if not any(d["is_protected"] for d in response.json()["devices"]):
        pytest.skip("No protected device in DB")
    page.goto(f"{BASE}/devices")
    page.wait_for_selector("[data-testid='device-row']", timeout=20000)
    rows = page.locator("[data-testid='device-row']")
    assert any("Protected" in rows.nth(i).inner_text() for i in range(rows.count()))


def test_bandwidth_slider_visible(page: Page):
    """Bandwidth slider renders for each device row."""
    page.goto(f"{BASE}/devices")
    page.wait_for_selector("[data-testid='device-row']", timeout=20000)
    expect(page.locator("[data-testid='bandwidth-slider']").first).to_be_visible()


def test_pause_all_button_exists(page: Page):
    """Pause All button is visible in the sidebar."""
    page.goto(f"{BASE}/devices")
    page.wait_for_selector("[data-testid='device-row']", timeout=20000)
    expect(page.locator("[data-testid='pause-all-btn']")).to_be_visible()


# ---------------------------------------------------------------------------
# API structural tests (verify endpoints exist and return correct shape)
# ---------------------------------------------------------------------------

def test_api_block_endpoint_exists(page: Page):
    """POST /devices/{id}/block exists (gateway returns 403, not 404/500)."""
    # Use the gateway device — it should be protected and return 403
    response = page.request.get(f"{BASE}/api/v1/devices")
    gateway = next(
        (d for d in response.json()["devices"] if d.get("device_type") == "router"),
        None,
    )
    if not gateway:
        pytest.skip("No gateway/router device found")
    r = json_post(page, f"{BASE}/api/v1/devices/{gateway['id']}/block", {})
    # 403 = endpoint works, correctly refuses to block gateway
    assert r.status == 403, f"Expected 403 for gateway block, got {r.status}: {r.text()}"


def test_api_bandwidth_limit(page: Page):
    """POST /devices/{id}/bandwidth-limit sets bandwidth_limit_kbps."""
    device_id = get_blockable_device_id(page)
    # Set a generous limit (50 Mbps) — harmless, just records in DB
    r = json_post(page, f"{BASE}/api/v1/devices/{device_id}/bandwidth-limit", {"limit_kbps": 50000})
    assert r.status == 200, f"bandwidth-limit failed [{r.status}]: {r.text()}"
    body = r.json()
    assert body["device"]["bandwidth_limit_kbps"] == 50000
    # Reset to unlimited
    json_post(page, f"{BASE}/api/v1/devices/{device_id}/bandwidth-limit", {"limit_kbps": 0})


def test_api_pause_all_endpoint_exists(page: Page):
    """POST /system/pause-all returns 200 with blocked_count key."""
    r = json_post(page, f"{BASE}/api/v1/system/pause-all", {})
    assert r.status == 200
    assert "blocked_count" in r.json()
    # Immediately resume to restore network
    json_post(page, f"{BASE}/api/v1/system/resume-all", {})


def test_api_resume_all_endpoint_exists(page: Page):
    """POST /system/resume-all returns 200 with unblocked_count key."""
    r = json_post(page, f"{BASE}/api/v1/system/resume-all", {})
    assert r.status == 200
    assert "unblocked_count" in r.json()


# ---------------------------------------------------------------------------
# Schedules
# ---------------------------------------------------------------------------

def test_schedules_page_loads(page: Page):
    page.goto(f"{BASE}/schedules")
    expect(page).to_have_title("Roost")
    expect(page.locator("h1")).to_contain_text("Schedules")


def test_create_schedule_button_exists(page: Page):
    page.goto(f"{BASE}/schedules")
    expect(page.locator("[data-testid='create-schedule-btn']")).to_be_visible()


def test_api_create_and_delete_schedule(page: Page):
    """Schedule can be created and deleted via API."""
    device_id = get_blockable_device_id(page)
    r = json_post(page, f"{BASE}/api/v1/schedules", {
        "name": "Test Bedtime",
        "device_id": device_id,
        "action": "block",
        "days_of_week": [0, 1, 2, 3, 4],
        "start_time": "22:00",
        "end_time": "07:00",
    })
    assert r.status == 200
    schedule = r.json()["schedule"]
    assert schedule["name"] == "Test Bedtime"
    sid = schedule["id"]

    # Appears in list
    list_r = page.request.get(f"{BASE}/api/v1/schedules")
    assert sid in [s["id"] for s in list_r.json()["schedules"]]

    # Delete it
    del_r = page.request.delete(f"{BASE}/api/v1/schedules/{sid}")
    assert del_r.status == 200


def test_navigate_to_schedules(page: Page):
    page.goto(BASE)
    page.locator("aside").get_by_text("Schedules").click()
    expect(page).to_have_url(f"{BASE}/schedules")
    expect(page.locator("h1")).to_contain_text("Schedules")
