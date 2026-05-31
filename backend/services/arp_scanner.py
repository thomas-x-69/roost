"""
ARP network scanner using Scapy.
Sends broadcast ARP requests and collects responses.
"""
import logging
from dataclasses import dataclass
from typing import Optional
from backend.utils.mac_utils import normalize_mac

logger = logging.getLogger("roost.arp_scanner")


@dataclass
class ScannedDevice:
    ip: str
    mac: str
    hostname: str = ""


def _resolve_scapy_iface(interface_name: str, own_ip: str = ""):
    """
    Resolve a Scapy NetworkInterface object for the given interface.
    On Windows, Scapy uses GUID-based NPF paths internally, so friendly names
    like 'WiFi' often fail. We try four methods in order:
      1. Match by name/description string in conf.ifaces
      2. Direct key lookup in conf.ifaces
      3. Match by IP address in conf.ifaces (most reliable on Windows)
      4. Use get_windows_if_list() to find the NPF path by IP, then conf lookup
    """
    try:
        from scapy.config import conf

        # Method 1: match by iface_obj.name or iface_obj.description
        if interface_name:
            for _key, iface_obj in conf.ifaces.items():
                obj_name = getattr(iface_obj, "name", "") or ""
                obj_desc = getattr(iface_obj, "description", "") or ""
                if obj_name == interface_name or obj_desc == interface_name:
                    logger.debug(f"Interface resolved by name match: {iface_obj}")
                    return iface_obj

            # Method 2: direct key lookup
            if interface_name in conf.ifaces:
                logger.debug(f"Interface resolved by key: {interface_name}")
                return conf.ifaces[interface_name]

        # Method 3: match by IP address (works regardless of name format)
        if own_ip:
            for _key, iface_obj in conf.ifaces.items():
                iface_ip = getattr(iface_obj, "ip", None) or ""
                if iface_ip == own_ip:
                    logger.debug(f"Interface resolved by IP {own_ip}: {iface_obj}")
                    return iface_obj

        # Method 4: use get_windows_if_list to find the NPF GUID path by IP,
        #            then look it up in conf.ifaces
        if own_ip:
            try:
                from scapy.arch.windows import get_windows_if_list
                for win_iface in get_windows_if_list():
                    if own_ip in win_iface.get("ips", []):
                        npf_name = win_iface.get("name", "")
                        if npf_name:
                            # Try exact key
                            if npf_name in conf.ifaces:
                                logger.debug(f"Interface resolved via get_windows_if_list NPF key: {npf_name}")
                                return conf.ifaces[npf_name]
                            # Try matching by obj name
                            for _key, iface_obj in conf.ifaces.items():
                                if getattr(iface_obj, "name", "") == npf_name:
                                    logger.debug(f"Interface resolved via get_windows_if_list name match: {npf_name}")
                                    return iface_obj
            except Exception as e:
                logger.debug(f"get_windows_if_list lookup failed: {e}")

    except Exception as e:
        logger.warning(f"Interface resolution failed: {e}")

    # No real Scapy NetworkInterface matched. Return None rather than a bare
    # friendly-name string: a string fallback makes Scapy fall back to conf.iface
    # (the Microsoft KM-TEST Loopback Adapter on Windows), so poison packets would
    # egress nowhere. Callers (esp. the spoofer) must treat None as "abort".
    logger.warning(
        f"Could not resolve a real Scapy interface for '{interface_name}' "
        f"(own_ip={own_ip!r}); returning None"
    )
    return None


def arp_scan(
    network_cidr: str,
    interface: str,
    own_ip: str = "",
    own_mac: str = "",
    timeout: float = 2.0,
    rounds: int = 2,
) -> list[ScannedDevice]:
    """
    Perform ARP scan on the given network CIDR.
    Returns list of responding devices.

    RELIABILITY FIX: devices in Wi-Fi power-save mode frequently miss a single
    ARP request and so appear "offline" for a scan. To compensate we send
    several ARP request rounds (``rounds``) and union the answers. A device
    only has to answer ONE round to be counted present. Each round uses its own
    ``timeout`` window; total work stays bounded at roughly ``rounds * timeout``
    seconds (e.g. 2 rounds * 3s = ~6s worst case), so a scan still finishes in a
    few seconds and well within the 30s scheduler interval.
    """
    try:
        from scapy.layers.l2 import Ether, ARP
        from scapy.sendrecv import srp
        from scapy.config import conf as scapy_conf

        # Resolve the best Scapy interface object (best-effort — used only for srp iface)
        resolved_iface = _resolve_scapy_iface(interface, own_ip)
        logger.info(f"ARP scan: iface resolved={resolved_iface!r}, own_mac={own_mac!r}")

        # ---------------------------------------------------------------
        # KEY FIX: explicitly set src MAC in both Ether and ARP layers.
        # When src is None, Scapy calls resolve_iface(conf.iface).mac to
        # auto-fill it.  On Windows, conf.iface defaults to the Microsoft
        # KM-TEST Loopback Adapter which isn't in the Npcap interface list,
        # causing "Interface not found" during packet build.
        # Providing own_mac bypasses that lookup entirely.
        # ---------------------------------------------------------------
        if own_mac:
            # Normalise to lowercase colon-separated (Scapy canonical format)
            src = own_mac.upper().replace("-", ":").replace(".", ":")
            packet = Ether(src=src, dst="ff:ff:ff:ff:ff:ff") / ARP(
                hwsrc=src, pdst=network_cidr
            )
        else:
            packet = Ether(dst="ff:ff:ff:ff:ff:ff") / ARP(pdst=network_cidr)

        # Temporarily pin conf.iface so srp() picks the right adapter
        old_iface = scapy_conf.iface
        if resolved_iface is not None:
            try:
                scapy_conf.iface = resolved_iface
            except Exception:
                pass

        try:
            kwargs: dict = dict(timeout=timeout, verbose=False)
            if resolved_iface is not None:
                kwargs["iface"] = resolved_iface

            # Send several ARP request rounds and union the answers. Quiet /
            # power-save devices that miss one round usually answer a later one.
            # Keyed by IP so we keep the latest MAC seen for each responder and
            # avoid duplicate entries across rounds.
            seen: dict[str, str] = {}  # ip -> normalized mac
            for _round in range(max(1, rounds)):
                answered, _ = srp(packet, **kwargs)
                for _, recv in answered:
                    seen[recv.psrc] = normalize_mac(recv.hwsrc)
        finally:
            try:
                scapy_conf.iface = old_iface
            except Exception:
                pass

        # Collect ARP results first, then resolve hostnames in parallel
        raw = [(mac, ip) for ip, mac in seen.items()]
        ips = [ip for _, ip in raw]
        hostnames = _bulk_reverse_dns(ips, timeout=2.0)

        devices = [
            ScannedDevice(ip=ip, mac=mac, hostname=hostnames.get(ip, ""))
            for mac, ip in raw
        ]
        logger.info(f"ARP scan found {len(devices)} devices on {network_cidr}")
        return devices

    except Exception as e:
        logger.error(f"ARP scan error: {e}", exc_info=True)
        return []


def _bulk_reverse_dns(ips: list[str], timeout: float = 2.0) -> dict[str, str]:
    """
    Resolve all IPs in parallel with an overall wall-clock timeout.
    Returns a dict of ip → hostname (empty string on failure/timeout).
    Running in parallel avoids the 10-15s serial blocking on home networks
    where most devices have no PTR records.
    """
    import socket
    import concurrent.futures

    results: dict[str, str] = {ip: "" for ip in ips}
    if not ips:
        return results

    with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(ips), 16)) as pool:
        future_to_ip = {pool.submit(socket.gethostbyaddr, ip): ip for ip in ips}
        done, not_done = concurrent.futures.wait(
            future_to_ip, timeout=timeout
        )
        for f in done:
            ip = future_to_ip[f]
            try:
                results[ip] = f.result()[0]
            except Exception:
                pass
        for f in not_done:
            f.cancel()

    return results
