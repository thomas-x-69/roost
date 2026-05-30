"""
Blocklist updater — fetches StevenBlack hosts file and loads domains into DB.
Runs daily at 3am via APScheduler. Safe to call manually.
"""
import logging
import urllib.request

from backend.services.threat_service import is_valid_domain

logger = logging.getLogger("roost.blocklist_updater")

STEVENBLACK_URL = "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts"


def _download_and_parse() -> list[str]:
    """Blocking: fetch + parse the StevenBlack hosts file into a domain list."""
    response = urllib.request.urlopen(STEVENBLACK_URL, timeout=30)
    content = response.read().decode("utf-8", errors="ignore")

    domains = []
    for line in content.splitlines():
        line = line.strip()
        if line.startswith("#") or not line:
            continue
        parts = line.split()
        if len(parts) >= 2 and parts[0] in ("0.0.0.0", "127.0.0.1"):
            domain = parts[1].strip().lower()
            if is_valid_domain(domain) and domain not in (
                "localhost", "localhost.localdomain"
            ):
                domains.append(domain)
    return domains


async def update_blocklists() -> None:
    """Download StevenBlack blocklist and upsert into threat_lists."""
    try:
        import asyncio
        logger.info("Downloading StevenBlack blocklist...")
        # Network fetch + parse are blocking — keep them off the event loop.
        loop = asyncio.get_running_loop()
        domains = await loop.run_in_executor(None, _download_and_parse)

        logger.info(f"Parsed {len(domains)} domains from StevenBlack")

        from backend.database.engine import AsyncSessionLocal
        from sqlalchemy import text

        batch_size = 500
        inserted = 0
        async with AsyncSessionLocal() as session:
            for i in range(0, len(domains), batch_size):
                batch = domains[i : i + batch_size]
                for domain in batch:
                    await session.execute(
                        text(
                            """
                            INSERT OR IGNORE INTO threat_lists (source, domain, threat_type)
                            VALUES ('stevenblack', :domain, 'adware/malware')
                            """
                        ),
                        {"domain": domain},
                    )
                    inserted += 1
                await session.commit()

        logger.info(f"Blocklist update complete: {inserted} entries")

    except Exception as e:
        logger.error(f"Blocklist update failed: {e}")
