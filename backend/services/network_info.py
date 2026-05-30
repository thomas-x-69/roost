"""
Detect network interface, gateway IP, own IP/MAC.
Windows-aware: handles Npcap/Scapy interface naming.
"""
import socket
import logging
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger("roost.network_info")


@dataclass
class NetworkInfo:
    interface: str          # Scapy/Npcap interface identifier
    interface_display: str  # Human-readable name
    gateway_ip: str
    own_ip: str
    own_mac: str
    network_cidr: str       # e.g. "192.168.1.0/24"
    npcap_available: bool


_cached_info: Optional[NetworkInfo] = None
_all_own_ips: Optional[set[str]] = None
_all_own_macs: Optional[set[str]] = None


def get_all_own_ips() -> set[str]:
    """Return ALL IPv4 addresses assigned to this machine (all adapters)."""
    global _all_own_ips
    if _all_own_ips is not None:
        return _all_own_ips

    ips: set[str] = set()
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None):
            addr = info[4][0]
            if "." in addr and not addr.startswith("127.") and not addr.startswith("169.254."):
                ips.add(addr)
    except Exception:
        pass

    try:
        from scapy.arch.windows import get_windows_if_list
        for iface in get_windows_if_list():
            for ip in iface.get("ips", []):
                if "." in ip and not ip.startswith("127.") and not ip.startswith("169.254."):
                    ips.add(ip)
    except Exception:
        pass

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            ips.add(s.getsockname()[0])
    except Exception:
        pass

    _all_own_ips = ips
    logger.info(f"All own IPs detected: {ips}")
    return ips


def get_all_own_macs() -> set[str]:
    """Return ALL MAC addresses of this machine's network adapters (normalised)."""
    global _all_own_macs
    if _all_own_macs is not None:
        return _all_own_macs

    from backend.utils.mac_utils import normalize_mac
    macs: set[str] = set()
    try:
        from scapy.arch.windows import get_windows_if_list
        for iface in get_windows_if_list():
            mac = iface.get("mac", "")
            if mac and mac not in ("00:00:00:00:00:00", "ff:ff:ff:ff:ff:ff"):
                macs.add(normalize_mac(mac))
    except Exception:
        pass

    _all_own_macs = macs
    logger.info(f"All own MACs detected: {macs}")
    return macs


def _get_own_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "192.168.1.1"


def _get_default_gateway() -> str:
    """Get the default gateway using multiple methods."""
    # Method 1: Scapy routing table
    try:
        from scapy.config import conf as scapy_conf
        route_obj = scapy_conf.route
        if route_obj is not None:
            gw = route_obj.route("0.0.0.0")[2]
            if gw and gw != "0.0.0.0":
                return gw
    except Exception:
        pass

    # Method 2: Windows ipconfig/route parsing
    try:
        import subprocess
        result = subprocess.run(
            ["route", "print", "0.0.0.0"],
            capture_output=True, text=True, timeout=5
        )
        for line in result.stdout.splitlines():
            parts = line.split()
            if len(parts) >= 3 and parts[0] == "0.0.0.0" and parts[1] == "0.0.0.0":
                gw = parts[2]
                if gw and gw != "0.0.0.0":
                    return gw
    except Exception:
        pass

    return ""


def _check_npcap() -> bool:
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE,
                            r"SYSTEM\CurrentControlSet\Services\npcap"):
            return True
    except Exception:
        try:
            import winreg
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE,
                                r"SYSTEM\CurrentControlSet\Services\NPF"):
                return True
        except Exception:
            return False


def get_network_info() -> NetworkInfo:
    global _cached_info
    if _cached_info:
        return _cached_info

    own_ip = _get_own_ip()
    npcap = _check_npcap()

    # Try to get gateway and interface via Scapy
    interface = ""
    interface_display = "Unknown"
    gateway_ip = ""
    own_mac = "00:00:00:00:00:00"
    network_cidr = "192.168.1.0/24"

    try:
        from scapy.config import conf
        from scapy.arch.windows import get_windows_if_list

        # Find the interface that has the matching IP
        ifaces = get_windows_if_list()
        for iface in ifaces:
            ips = iface.get("ips", [])
            if own_ip in ips:
                interface = iface.get("name", "")
                interface_display = iface.get("description", interface)
                own_mac = iface.get("mac", "00:00:00:00:00:00").upper()
                # Compute network CIDR (assume /24 for home network)
                parts = own_ip.split(".")
                network_cidr = f"{parts[0]}.{parts[1]}.{parts[2]}.0/24"
                break

        if not interface and ifaces:
            # fallback: pick first non-loopback
            for iface in ifaces:
                if "loopback" not in iface.get("description", "").lower():
                    interface = iface.get("name", "")
                    interface_display = iface.get("description", interface)
                    own_mac = iface.get("mac", "00:00:00:00:00:00").upper()
                    ips = iface.get("ips", [own_ip])
                    if ips:
                        own_ip = ips[0]
                    parts = own_ip.split(".")
                    network_cidr = f"{parts[0]}.{parts[1]}.{parts[2]}.0/24"
                    break

        # Get gateway using multi-method detection
        gateway_ip = _get_default_gateway()

    except Exception as e:
        logger.warning(f"Scapy interface detection failed: {e}")

    # Final fallback: guess gateway as .1 of own network
    if not gateway_ip:
        parts = own_ip.split(".")
        gateway_ip = f"{parts[0]}.{parts[1]}.{parts[2]}.1"
    if not network_cidr or network_cidr == "192.168.1.0/24":
        parts = own_ip.split(".")
        network_cidr = f"{parts[0]}.{parts[1]}.{parts[2]}.0/24"

    _cached_info = NetworkInfo(
        interface=interface,
        interface_display=interface_display,
        gateway_ip=gateway_ip,
        own_ip=own_ip,
        own_mac=own_mac,
        network_cidr=network_cidr,
        npcap_available=npcap,
    )
    logger.info(f"Network: {own_ip} via {gateway_ip} on {interface_display}")
    return _cached_info


def clear_cache():
    global _cached_info
    _cached_info = None
