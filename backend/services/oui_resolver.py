"""
OUI (Organizationally Unique Identifier) resolver.
Maps MAC address prefixes to vendor names.
Uses the bundled Wireshark manuf file if available,
falls back to a small built-in table.
"""
import gzip
import logging
import urllib.request
from pathlib import Path
from backend.utils.mac_utils import normalize_mac
from backend.config import settings

logger = logging.getLogger("roost.oui_resolver")

# The Wireshark "manuf" OUI database is GPLv2 and NOT bundled with Roost.
# It is downloaded to data/manuf on first use and git-ignored. If the download
# fails (offline / blocked), the small BUILTIN_OUI table below is used instead.
MANUF_URL = "https://www.wireshark.org/download/automated/data/manuf.gz"

# Small built-in fallback table (most common vendors)
BUILTIN_OUI = {
    "00:50:56": "VMware",
    "00:0C:29": "VMware",
    "00:1A:11": "Google",
    "00:17:F2": "Apple",
    "3C:5A:B4": "Google",
    "DC:A6:32": "Raspberry Pi",
    "B8:27:EB": "Raspberry Pi",
    "00:1B:21": "Intel",
    "00:1C:BF": "Intel",
    "70:B3:D5": "IEEE Registration Authority",
    "FC:FB:FB": "Cisco",
    "00:0A:F7": "Cisco",
    "00:11:22": "Cisco",
    "00:50:F2": "Microsoft",
    "28:16:A8": "Broadcom",
    "AC:DE:48": "Private",
}

_oui_db: dict[str, str] = {}
_loaded = False


def _try_download_manuf(manuf_path: Path) -> None:
    """Fetch the Wireshark manuf DB to `manuf_path` (gunzipped). Best-effort."""
    try:
        manuf_path.parent.mkdir(parents=True, exist_ok=True)
        logger.info("Downloading Wireshark OUI database (manuf)...")
        with urllib.request.urlopen(MANUF_URL, timeout=30) as resp:
            data = gzip.decompress(resp.read())
        manuf_path.write_bytes(data)
        logger.info(f"OUI database saved to {manuf_path}")
    except Exception as e:
        logger.warning(f"Could not download manuf DB ({e}); using built-in OUI table")


def _load_manuf_file():
    global _oui_db, _loaded
    if _loaded:
        return
    manuf_path = Path(settings.data_dir) / "manuf"
    if not manuf_path.exists():
        _try_download_manuf(manuf_path)
    if manuf_path.exists():
        try:
            with open(manuf_path, "r", encoding="utf-8", errors="ignore") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    parts = line.split("\t")
                    if len(parts) >= 2:
                        raw_oui = parts[0].strip()
                        vendor = parts[-1].strip() or parts[1].strip()
                        # Normalize OUI prefix (can be 3-byte or longer)
                        oui_clean = raw_oui.upper().replace("-", ":").replace(".", ":")
                        if len(oui_clean) >= 8:  # at least XX:XX:XX
                            _oui_db[oui_clean[:8]] = vendor
        except Exception:
            pass
    # Always merge built-in table as fallback
    for k, v in BUILTIN_OUI.items():
        if k not in _oui_db:
            _oui_db[k] = v
    _loaded = True


def resolve_vendor(mac: str) -> str:
    """Look up the vendor name for a MAC address."""
    _load_manuf_file()
    normalized = normalize_mac(mac)
    oui = normalized[:8]
    return _oui_db.get(oui, "Unknown")
