"""
Threat detection service — checks domains against local blocklists.
Blocklists are stored in the DB (threat_lists table).

Threat blocking strategy:
  - Local machine: Windows hosts file (0.0.0.0 redirect) — instant, no DNS needed
  - Other network devices: Generate alert + optionally block the device via ARP
    (aggressive — use block_device_on_threat flag in config)
"""
import logging
import re
from pathlib import Path
from typing import Optional

logger = logging.getLogger("roost.threat_service")

HOSTS_FILE = Path(r"C:\Windows\System32\drivers\etc\hosts")
_HOSTS_MARKER = "# Roost-threat"  # marker line for managed entries

# A valid DNS hostname: 1–253 chars, dot-separated labels of [a-z0-9_-],
# each label 1–63 chars not starting/ending with a hyphen. This rejects
# whitespace, newlines, comment chars, and anything else that could inject
# arbitrary lines into the hosts file.
_DOMAIN_RE = re.compile(
    r"^(?=.{1,253}$)([a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$"
)


def is_valid_domain(domain: str) -> bool:
    """True if `domain` is a syntactically valid hostname safe to write to hosts."""
    return bool(_DOMAIN_RE.match(domain or ""))

# Common known-bad domains for immediate detection without needing blocklists
_HARDCODED_THREATS = {
    "doubleclick.net": "adware",
    "adservice.google.com": "adware",
    "pagead2.googlesyndication.com": "adware",
    "analytics.google.com": "tracking",
    "scorecardresearch.com": "tracking",
    "static.doubleclick.net": "adware",
}


async def check_domain(domain: str) -> tuple[bool, Optional[str]]:
    """
    Check if a domain is a threat.
    Returns (is_threat, threat_type).
    Checks hardcoded list first, then DB.
    """
    domain = domain.lower().strip().rstrip(".")

    # Check hardcoded list
    for bad_domain, threat_type in _HARDCODED_THREATS.items():
        if domain == bad_domain or domain.endswith("." + bad_domain):
            return True, threat_type

    # Check DB
    try:
        from backend.database.engine import AsyncSessionLocal
        from backend.database.models.threat import ThreatList
        from sqlalchemy import select

        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(ThreatList).where(ThreatList.domain == domain).limit(1)
            )
            row = result.scalar_one_or_none()
            if row:
                return True, row.threat_type
    except Exception as e:
        logger.error(f"DB threat check error: {e}")

    return False, None


def block_threat_domain(domain: str) -> bool:
    """
    Block a threat domain on this machine by adding it to the Windows hosts file.
    Redirects domain → 0.0.0.0 (black hole).
    Returns True on success, False if hosts file can't be written (needs admin).
    """
    domain = domain.lower().strip().rstrip(".")
    if not is_valid_domain(domain):
        logger.warning(f"Refusing to block invalid domain: {domain!r}")
        return False
    entry = f"0.0.0.0 {domain} {_HOSTS_MARKER}\n"
    try:
        content = HOSTS_FILE.read_text(encoding="utf-8", errors="replace")
        # Avoid duplicates — match a Roost-managed line for this EXACT domain
        # (per-line + marker, not a whole-file substring which mis-fires on
        # unrelated entries or substrings of other domains).
        already = any(
            _HOSTS_MARKER in line
            and line.startswith("0.0.0.0")
            and line.split()[1:2] == [domain]
            for line in content.splitlines()
        )
        if already:
            return True
        HOSTS_FILE.write_text(content.rstrip("\n") + "\n" + entry, encoding="utf-8")
        logger.info(f"Threat domain blocked in hosts file: {domain}")
        return True
    except PermissionError:
        logger.warning(f"Cannot write hosts file (not admin) — {domain} not blocked locally")
        return False
    except Exception as e:
        logger.error(f"block_threat_domain error for {domain}: {e}")
        return False


def unblock_threat_domain(domain: str) -> bool:
    """Remove a domain from the Windows hosts file (removes Roost-managed entry)."""
    domain = domain.lower().strip().rstrip(".")
    if not is_valid_domain(domain):
        logger.warning(f"Refusing to unblock invalid domain: {domain!r}")
        return False
    try:
        content = HOSTS_FILE.read_text(encoding="utf-8", errors="replace")
        lines = [
            line for line in content.splitlines(keepends=True)
            if not (_HOSTS_MARKER in line and line.split()[1:2] == [domain])
        ]
        HOSTS_FILE.write_text("".join(lines), encoding="utf-8")
        logger.info(f"Threat domain removed from hosts file: {domain}")
        return True
    except PermissionError:
        logger.warning(f"Cannot write hosts file (not admin) — {domain} not unblocked")
        return False
    except Exception as e:
        logger.error(f"unblock_threat_domain error for {domain}: {e}")
        return False


def get_blocked_threat_domains() -> list[str]:
    """Return list of domains currently blocked via hosts file."""
    try:
        content = HOSTS_FILE.read_text(encoding="utf-8", errors="replace")
        domains = []
        for line in content.splitlines():
            if _HOSTS_MARKER in line and line.startswith("0.0.0.0"):
                parts = line.split()
                if len(parts) >= 2:
                    domains.append(parts[1])
        return domains
    except Exception:
        return []


async def get_stats() -> dict:
    """Return basic threat list stats."""
    try:
        from backend.database.engine import AsyncSessionLocal
        from backend.database.models.threat import ThreatList
        from sqlalchemy import select, func

        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(func.count(ThreatList.id))
            )
            total = result.scalar() or 0
            return {"total_entries": total, "sources": ["hardcoded", "stevenblack"]}
    except Exception:
        return {"total_entries": 0, "sources": []}
