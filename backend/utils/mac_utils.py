import re

def normalize_mac(mac: str) -> str:
    """Normalize MAC to uppercase colon-separated: AA:BB:CC:DD:EE:FF"""
    mac = mac.upper().replace("-", ":").replace(".", ":")
    # Remove any non-hex-colon characters
    hex_only = re.sub(r"[^0-9A-F]", "", mac)
    if len(hex_only) == 12:
        return ":".join(hex_only[i:i+2] for i in range(0, 12, 2))
    return mac

def get_oui(mac: str) -> str:
    """Get the OUI prefix (first 3 bytes) from a MAC address."""
    normalized = normalize_mac(mac)
    return normalized[:8]  # "AA:BB:CC"
