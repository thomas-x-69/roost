"""
Playwright + pytest configuration for Roost E2E tests.
"""
import pytest
import subprocess
import time
import sys
import os
import socket
import asyncio

# ---------------------------------------------------------------------------
# Base URL
# ---------------------------------------------------------------------------
BASE_URL = "http://localhost:5000"


def wait_for_port(host: str, port: int, timeout: float = 30.0) -> bool:
    """Poll until a TCP port is accepting connections."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection((host, port), timeout=1):
                return True
        except OSError:
            time.sleep(0.5)
    return False


# ---------------------------------------------------------------------------
# pytest-asyncio mode
# ---------------------------------------------------------------------------
def pytest_configure(config):
    config.addinivalue_line(
        "markers", "asyncio: mark test as asyncio"
    )


def pytest_collection_modifyitems(config, items):
    """Auto-mark everything under tests/e2e as 'integration' so the default
    `pytest -m "not integration"` run (see pytest.ini) skips browser/LAN tests
    and runs only the privilege-free unit tests."""
    for item in items:
        parts = str(item.fspath).replace("\\", "/").split("/")
        if "e2e" in parts:
            item.add_marker(pytest.mark.integration)


# ---------------------------------------------------------------------------
# Playwright fixtures (sync, compatible with pytest-playwright)
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def app_url():
    """Return the base URL for the running app."""
    return BASE_URL


@pytest.fixture(scope="session")
def server_running():
    """
    Check if the backend is already running; if not, skip with a message.
    Tests that need the server use this fixture.
    """
    if not wait_for_port("localhost", 5000, timeout=5):
        pytest.skip("Roost backend not running on localhost:5000 — start with: python -m uvicorn backend.main:app --port 5000")
    return True
