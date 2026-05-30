"""
Classify a device type based on vendor name and hostname heuristics.
Returns one of: phone, laptop, desktop, tablet, tv, console, router, iot, unknown
"""

VENDOR_TYPE_MAP = {
    # Phones
    "apple": "phone",
    "samsung": "phone",
    "huawei": "phone",
    "xiaomi": "phone",
    "oppo": "phone",
    "vivo": "phone",
    "oneplus": "phone",
    "motorola": "phone",
    "nokia": "phone",
    "lg electronics": "phone",
    # Laptops/Computers
    "dell": "laptop",
    "hp": "laptop",
    "lenovo": "laptop",
    "asus": "laptop",
    "acer": "laptop",
    "toshiba": "laptop",
    "intel": "laptop",
    "microsoft": "laptop",
    # TV/Streaming
    "lg": "tv",
    "sony": "tv",
    "samsung electronics": "tv",
    "tcl": "tv",
    "roku": "tv",
    "amazon": "tv",
    "chromecast": "tv",
    # Consoles
    "sony interactive": "console",
    "microsoft xbox": "console",
    "nintendo": "console",
    # Networking
    "cisco": "router",
    "tp-link": "router",
    "netgear": "router",
    "d-link": "router",
    "asus router": "router",
    "ubiquiti": "router",
    "mikrotik": "router",
    # IoT
    "raspberry pi": "iot",
    "esp": "iot",
    "tuya": "iot",
    "shenzhen": "iot",
    "google": "iot",
    "amazon technologies": "iot",
    # VM
    "vmware": "desktop",
}

HOSTNAME_TYPE_MAP = {
    "iphone": "phone",
    "android": "phone",
    "galaxy": "phone",
    "pixel": "phone",
    "ipad": "tablet",
    "tablet": "tablet",
    "macbook": "laptop",
    "laptop": "laptop",
    "desktop": "desktop",
    "pc": "desktop",
    "tv": "tv",
    "firestick": "tv",
    "roku": "tv",
    "playstation": "console",
    "xbox": "console",
    "nintendo": "console",
    "router": "router",
    "gateway": "router",
    "pi": "iot",
    "arduino": "iot",
    "esp": "iot",
}

ICON_MAP = {
    "phone": "smartphone",
    "laptop": "laptop",
    "desktop": "monitor",
    "tablet": "tablet",
    "tv": "tv",
    "console": "gamepad",
    "router": "router",
    "iot": "cpu",
    "unknown": "device",
}


def classify_device(vendor: str, hostname: str = "") -> tuple[str, str]:
    """
    Returns (device_type, icon_key).

    Keywords are tested longest-first so the most specific match wins:
    "microsoft xbox" (console) beats "microsoft" (laptop), "sony interactive"
    (console) beats "sony" (tv), and "amazon technologies" (iot) beats the
    generic "amazon" (tv). Substring matching is kept so concatenated tokens
    like "esp32", "espressif" and "raspberrypi" still classify correctly.
    """
    vendor_lower = (vendor or "").lower()
    hostname_lower = (hostname or "").lower()

    # Hostname is more reliable than vendor — check it first.
    for kw in sorted(HOSTNAME_TYPE_MAP, key=len, reverse=True):
        if kw in hostname_lower:
            dtype = HOSTNAME_TYPE_MAP[kw]
            return dtype, ICON_MAP[dtype]

    for kw in sorted(VENDOR_TYPE_MAP, key=len, reverse=True):
        if kw in vendor_lower:
            dtype = VENDOR_TYPE_MAP[kw]
            return dtype, ICON_MAP[dtype]

    return "unknown", "device"
