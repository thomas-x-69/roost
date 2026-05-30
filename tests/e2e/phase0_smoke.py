"""
Phase 0 — Playwright smoke tests.
Verifies that Playwright is installed and working correctly
BEFORE any application code is written.
These tests do NOT require the Roost backend.
"""
import re
import pytest
from playwright.sync_api import Page, expect


# ---------------------------------------------------------------------------
# Test 1: Playwright can launch a browser and open about:blank
# ---------------------------------------------------------------------------
def test_playwright_opens_browser(page: Page):
    """Playwright can control a browser page."""
    page.goto("about:blank")
    assert page.url == "about:blank"


# ---------------------------------------------------------------------------
# Test 2: Playwright can navigate to a real URL (example.com)
# ---------------------------------------------------------------------------
def test_playwright_navigates_to_url(page: Page):
    """Playwright can load a real webpage."""
    page.goto("https://example.com")
    expect(page).to_have_title(re.compile("Example Domain", re.IGNORECASE))


# ---------------------------------------------------------------------------
# Test 3: Playwright can take a screenshot without errors
# ---------------------------------------------------------------------------
def test_playwright_takes_screenshot(page: Page, tmp_path):
    """Playwright screenshot capability works."""
    page.goto("about:blank")
    screenshot_path = tmp_path / "smoke_test.png"
    page.screenshot(path=str(screenshot_path))
    assert screenshot_path.exists()
    assert screenshot_path.stat().st_size > 0


# ---------------------------------------------------------------------------
# Test 4: Playwright can evaluate JavaScript
# ---------------------------------------------------------------------------
def test_playwright_js_evaluation(page: Page):
    """Playwright can execute JavaScript in the browser."""
    page.goto("about:blank")
    result = page.evaluate("() => 2 + 2")
    assert result == 4


# ---------------------------------------------------------------------------
# Test 5: Playwright can make HTTP requests via page.request
# ---------------------------------------------------------------------------
def test_playwright_api_request(page: Page):
    """Playwright API request context works."""
    response = page.request.get("https://httpbin.org/status/200")
    assert response.status == 200


# ---------------------------------------------------------------------------
# Test 6: Playwright can handle multiple pages
# ---------------------------------------------------------------------------
def test_playwright_multiple_locators(page: Page):
    """Playwright can query and iterate multiple elements."""
    page.set_content("""
        <ul>
          <li data-testid="item">Alpha</li>
          <li data-testid="item">Beta</li>
          <li data-testid="item">Gamma</li>
        </ul>
    """)
    items = page.locator("[data-testid='item']")
    expect(items).to_have_count(3)


# ---------------------------------------------------------------------------
# Test 7: Playwright can interact with DOM elements
# ---------------------------------------------------------------------------
def test_playwright_dom_interaction(page: Page):
    """Playwright can set HTML content and interact with DOM."""
    page.set_content("""
        <html>
          <body>
            <h1 data-testid="heading">Roost Ready</h1>
            <button data-testid="btn" onclick="this.textContent='Clicked'">Click me</button>
          </body>
        </html>
    """)
    heading = page.locator("[data-testid='heading']")
    expect(heading).to_have_text("Roost Ready")

    btn = page.locator("[data-testid='btn']")
    btn.click()
    expect(btn).to_have_text("Clicked")
