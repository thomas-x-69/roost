"""
Phase 4 E2E Tests — Network Map + Threats + Alerts + PDF Reports + Groups
Requires backend running on localhost:5000.
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


# ---------------------------------------------------------------------------
# Network Map
# ---------------------------------------------------------------------------

def test_dashboard_has_network_map(page: Page):
    """Dashboard renders the network map container."""
    page.goto(BASE)
    map_div = page.locator("[data-testid='network-map']")
    expect(map_div).to_be_visible()


def test_network_map_renders_nodes(page: Page):
    """Network map renders at least one vis-network node after loading."""
    page.goto(BASE)
    # Wait for devices to load and map to initialize
    page.wait_for_timeout(3000)
    map_div = page.locator("[data-testid='network-map']")
    expect(map_div).to_be_visible()
    # vis-network creates canvas element inside the container
    canvas = map_div.locator("canvas")
    expect(canvas).to_be_visible()


# ---------------------------------------------------------------------------
# Threats
# ---------------------------------------------------------------------------

def test_api_threat_check_known_bad(page: Page):
    """POST /threats/check returns is_threat=True for doubleclick.net."""
    r = json_post(page, f"{BASE}/api/v1/threats/check", {"domain": "doubleclick.net"})
    assert r.status == 200
    body = r.json()
    assert body["is_threat"] is True, f"Expected doubleclick.net to be a threat, got: {body}"


def test_api_threat_check_clean_domain(page: Page):
    """POST /threats/check returns is_threat=False for a safe domain."""
    r = json_post(page, f"{BASE}/api/v1/threats/check", {"domain": "example.com"})
    assert r.status == 200
    body = r.json()
    assert body["is_threat"] is False


def test_api_threats_list(page: Page):
    """GET /threats returns threats list with total."""
    r = page.request.get(f"{BASE}/api/v1/threats")
    assert r.status == 200
    body = r.json()
    assert "threats" in body
    assert "total" in body


def test_api_threats_stats(page: Page):
    """GET /threats/stats returns stats dict."""
    r = page.request.get(f"{BASE}/api/v1/threats/stats")
    assert r.status == 200
    body = r.json()
    assert "total_entries" in body


def test_threats_page_loads(page: Page):
    page.goto(f"{BASE}/threats")
    expect(page).to_have_title("Roost")
    expect(page.locator("h1")).to_contain_text("Threats")


def test_threats_domain_check_ui(page: Page):
    """Threat domain check form works in the UI."""
    page.goto(f"{BASE}/threats")
    page.wait_for_timeout(500)
    page.fill("input[placeholder*='doubleclick']", "doubleclick.net")
    page.locator("[data-testid='check-domain-btn']").click()
    page.wait_for_timeout(1500)
    result = page.locator("[data-testid='domain-check-result']")
    expect(result).to_be_visible()
    expect(result).to_contain_text("Threat")


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

def test_api_alerts_list(page: Page):
    """GET /alerts returns alerts list."""
    r = page.request.get(f"{BASE}/api/v1/alerts")
    assert r.status == 200
    assert "alerts" in r.json()


def test_api_alerts_count(page: Page):
    """GET /alerts/count returns unread count."""
    r = page.request.get(f"{BASE}/api/v1/alerts/count")
    assert r.status == 200
    assert "unread_count" in r.json()


def test_alerts_page_loads(page: Page):
    page.goto(f"{BASE}/alerts")
    expect(page).to_have_title("Roost")
    expect(page.locator("h1")).to_contain_text("Alerts")


# ---------------------------------------------------------------------------
# Groups
# ---------------------------------------------------------------------------

def test_api_create_and_delete_group(page: Page):
    """Group can be created and deleted via API."""
    r = json_post(page, f"{BASE}/api/v1/groups", {"name": "Test Family Group"})
    assert r.status == 200
    group = r.json()["group"]
    assert group["name"] == "Test Family Group"
    gid = group["id"]

    # Appears in list
    list_r = page.request.get(f"{BASE}/api/v1/groups")
    ids = [g["id"] for g in list_r.json()["groups"]]
    assert gid in ids

    # Delete
    del_r = page.request.delete(f"{BASE}/api/v1/groups/{gid}")
    assert del_r.status == 200


def test_groups_page_loads(page: Page):
    page.goto(f"{BASE}/groups")
    expect(page).to_have_title("Roost")
    expect(page.locator("h1")).to_contain_text("Groups")


def test_create_group_button_exists(page: Page):
    page.goto(f"{BASE}/groups")
    expect(page.locator("[data-testid='create-group-btn']")).to_be_visible()


# ---------------------------------------------------------------------------
# PDF Reports
# ---------------------------------------------------------------------------

def test_api_generate_report(page: Page):
    """POST /reports/generate creates a PDF report."""
    r = json_post(page, f"{BASE}/api/v1/reports/generate", {"period": "today"})
    assert r.status == 200
    body = r.json()
    assert "filename" in body
    assert body["filename"].endswith(".pdf")


def test_api_list_reports(page: Page):
    """GET /reports returns list of generated reports."""
    # Generate one first
    json_post(page, f"{BASE}/api/v1/reports/generate", {"period": "today"})
    r = page.request.get(f"{BASE}/api/v1/reports")
    assert r.status == 200
    body = r.json()
    assert "reports" in body
    assert len(body["reports"]) >= 1


def test_api_download_report(page: Page):
    """Generated PDF can be downloaded."""
    gen_r = json_post(page, f"{BASE}/api/v1/reports/generate", {"period": "today"})
    filename = gen_r.json()["filename"]
    dl_r = page.request.get(f"{BASE}/api/v1/reports/{filename}")
    assert dl_r.status == 200
    assert dl_r.headers.get("content-type", "").startswith("application/pdf")


def test_reports_page_loads(page: Page):
    page.goto(f"{BASE}/reports")
    expect(page).to_have_title("Roost")
    expect(page.locator("h1")).to_contain_text("Reports")


def test_reports_generate_button_exists(page: Page):
    page.goto(f"{BASE}/reports")
    expect(page.locator("[data-testid='generate-report-btn']")).to_be_visible()
