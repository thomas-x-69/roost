"""
Packet capture service using Scapy AsyncSniffer.
Counts bytes per IP (bandwidth) and captures DNS queries.
Gracefully handles missing Npcap — all functions are safe to call.
"""
import logging
import threading
from collections import defaultdict
from typing import Optional

logger = logging.getLogger("roost.packet_capture")

# ── state ──────────────────────────────────────────────────────────────────
_capture_available: bool = False
_sniffer = None
_lock = threading.Lock()

# ip → [bytes_sent, bytes_recv]
_byte_counters: dict[str, list[int]] = defaultdict(lambda: [0, 0])

# (src_ip, domain) → count
_dns_queue: dict[tuple[str, str], int] = defaultdict(int)

# ── Scapy import (optional) ─────────────────────────────────────────────────
try:
    from scapy.all import AsyncSniffer, IP, DNS, DNSQR, UDP
    _scapy_available = True
except Exception as _e:
    logger.warning(f"Scapy import failed — packet capture disabled: {_e}")
    _scapy_available = False


# ── packet handler ──────────────────────────────────────────────────────────
def _handle_packet(pkt):
    """Called for every captured packet. Must be fast and exception-safe."""
    try:
        if not pkt.haslayer(IP):
            return
        ip_layer = pkt[IP]
        pkt_len = len(pkt)
        src = ip_layer.src
        dst = ip_layer.dst

        with _lock:
            _byte_counters[src][0] += pkt_len   # bytes sent from src
            _byte_counters[dst][1] += pkt_len   # bytes recv  at dst

            # DNS query capture
            if (
                pkt.haslayer(UDP)
                and pkt.haslayer(DNS)
                and pkt.haslayer(DNSQR)
                and pkt[UDP].dport == 53
            ):
                try:
                    domain = pkt[DNS].qd.qname.decode().rstrip(".")
                    if domain:
                        _dns_queue[(src, domain)] += 1
                except Exception:
                    pass
    except Exception:
        pass


# ── public API ──────────────────────────────────────────────────────────────
def start_capture(iface: str) -> None:
    """Start the async sniffer. No-op if Npcap is unavailable."""
    global _sniffer, _capture_available

    if not _scapy_available:
        logger.info("Packet capture skipped — Scapy unavailable")
        return

    try:
        _sniffer = AsyncSniffer(
            iface=iface if iface else None,
            prn=_handle_packet,
            store=False,
        )
        _sniffer.start()
        _capture_available = True
        logger.info(f"Packet capture started on interface: {iface!r}")
    except Exception as e:
        logger.warning(f"Packet capture could not start (Npcap/admin required?): {e}")
        _capture_available = False
        _sniffer = None


def stop_capture() -> None:
    """Stop the async sniffer."""
    global _sniffer, _capture_available
    if _sniffer is not None:
        try:
            _sniffer.stop()
            logger.info("Packet capture stopped")
        except Exception as e:
            logger.warning(f"Error stopping packet capture: {e}")
        finally:
            _sniffer = None
    _capture_available = False


def get_and_reset_counters() -> dict[str, list[int]]:
    """
    Return a snapshot of byte counters and reset them atomically.
    Returns: dict[ip_str, [bytes_sent, bytes_recv]]
    """
    with _lock:
        snapshot = dict(_byte_counters)
        _byte_counters.clear()
    return snapshot


def get_and_reset_dns_queue() -> dict[tuple[str, str], int]:
    """
    Return a snapshot of DNS query counts and reset them atomically.
    Returns: dict[(src_ip, domain), count]
    """
    with _lock:
        snapshot = dict(_dns_queue)
        _dns_queue.clear()
    return snapshot


def merge_counters(snapshot: dict[str, list[int]]) -> None:
    """Add a previously-snapshotted set of byte counters back in (e.g. after a
    failed DB flush) so the data is retried on the next cycle instead of lost."""
    with _lock:
        for ip, (sent, recv) in snapshot.items():
            _byte_counters[ip][0] += sent
            _byte_counters[ip][1] += recv


def merge_dns_queue(snapshot: dict[tuple[str, str], int]) -> None:
    """Add previously-snapshotted DNS counts back in after a failed flush."""
    with _lock:
        for key, count in snapshot.items():
            _dns_queue[key] += count
