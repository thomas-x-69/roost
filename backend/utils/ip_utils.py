import socket
import struct

def ip_to_int(ip: str) -> int:
    return struct.unpack("!I", socket.inet_aton(ip))[0]

def get_network_cidr(ip: str, netmask: str) -> str:
    """Given IP and netmask, return CIDR notation like 192.168.1.0/24."""
    ip_int = ip_to_int(ip)
    mask_int = ip_to_int(netmask)
    network_int = ip_int & mask_int
    prefix_len = bin(mask_int).count("1")
    network_ip = socket.inet_ntoa(struct.pack("!I", network_int))
    return f"{network_ip}/{prefix_len}"

def get_own_ip() -> str:
    """Get the machine's primary outbound IP address."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
