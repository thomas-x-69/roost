"""
Self-diagnostics for the ARP "block device" feature.
Surfaces the conditions that silently prevent blocking from working
(missing Administrator privileges, no Npcap, unresolvable gateway MAC)
so failures are VISIBLE instead of fire-and-forget no-ops.
"""
import asyncio
import logging

from fastapi import APIRouter

logger = logging.getLogger("roost.api.diagnostics")

router = APIRouter(prefix="/diagnostics", tags=["diagnostics"])


@router.get("/blocking")
async def blocking_diagnostics():
    """
    Report whether the device-block (ARP) feature can actually work.

    Returns is_admin / npcap_available / interface details / gateway MAC
    (resolved live) plus a computed can_block flag and human-readable
    reasons when blocking is unavailable.
    """
    from backend.utils.admin_check import check_admin
    from backend.services.network_info import get_network_info

    is_admin = check_admin()
    net = get_network_info()

    invalid_mac = (not net.own_mac) or net.own_mac.lower() in (
        "00:00:00:00:00:00",
        "00-00-00-00-00-00",
    )

    # Resolve the gateway MAC live through the spoofer's own resolver, so the
    # diagnostic exercises the exact path a real block would use (right iface,
    # own MAC, Npcap send/receive). Runs off the event loop — it does blocking
    # Scapy I/O.
    gateway_mac = None
    if net.npcap_available and net.gateway_ip:
        try:
            from backend.services.arp_spoofer import _get_mac
            from backend.services.arp_scanner import _resolve_scapy_iface

            def _resolve_gateway_mac() -> str:
                resolved_iface = _resolve_scapy_iface(net.interface, net.own_ip)
                return _get_mac(net.gateway_ip, resolved_iface, own_mac=net.own_mac)

            loop = asyncio.get_running_loop()
            resolved = await loop.run_in_executor(None, _resolve_gateway_mac)
            gateway_mac = resolved or None
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning(f"gateway MAC resolution failed: {exc}", exc_info=True)
            gateway_mac = None

    reasons: list[str] = []
    if not is_admin:
        reasons.append("Not running as Administrator")
    if not net.npcap_available:
        reasons.append("Npcap not detected")
    if invalid_mac:
        reasons.append("Network interface MAC could not be detected")
    if not net.gateway_ip:
        reasons.append("Default gateway could not be detected")
    elif gateway_mac is None:
        reasons.append("Gateway MAC could not be resolved")

    can_block = len(reasons) == 0

    return {
        "is_admin": is_admin,
        "npcap_available": net.npcap_available,
        "interface": net.interface,
        "interface_display": net.interface_display,
        "own_ip": net.own_ip,
        "own_mac": net.own_mac,
        "gateway_ip": net.gateway_ip,
        "gateway_mac": gateway_mac,
        "can_block": can_block,
        "reasons": reasons,
    }
