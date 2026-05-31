"""
Privilege-free unit tests for Roost core logic.
No network, no admin rights, no live LAN — safe for CI.
Run with:  pytest -m "not integration"
"""
from backend.utils.mac_utils import normalize_mac, get_oui
from backend.utils.ip_utils import ip_to_int, get_network_cidr
from backend.services.threat_service import is_valid_domain
from backend.services.device_classifier import classify_device
from backend.api.reports import _format_bytes


class TestMacUtils:
    def test_normalize_dash_and_dot_separators(self):
        assert normalize_mac("aa-bb-cc-dd-ee-ff") == "AA:BB:CC:DD:EE:FF"
        assert normalize_mac("aabb.ccdd.eeff") == "AA:BB:CC:DD:EE:FF"

    def test_normalize_already_normalized(self):
        assert normalize_mac("AA:BB:CC:DD:EE:FF") == "AA:BB:CC:DD:EE:FF"

    def test_get_oui_first_three_bytes(self):
        assert get_oui("aa:bb:cc:dd:ee:ff") == "AA:BB:CC"


class TestIpUtils:
    def test_ip_to_int_roundtrip(self):
        assert ip_to_int("0.0.0.0") == 0
        assert ip_to_int("255.255.255.255") == 0xFFFFFFFF

    def test_network_cidr_24(self):
        assert get_network_cidr("192.168.1.108", "255.255.255.0") == "192.168.1.0/24"

    def test_network_cidr_16(self):
        assert get_network_cidr("10.0.5.7", "255.255.0.0") == "10.0.0.0/16"


class TestDomainValidation:
    def test_accepts_normal_domains(self):
        assert is_valid_domain("doubleclick.net")
        assert is_valid_domain("ads.sub-domain.example.co.uk")

    def test_rejects_empty_and_garbage(self):
        assert not is_valid_domain("")
        assert not is_valid_domain("not a domain")
        assert not is_valid_domain("nodot")

    def test_rejects_hosts_file_injection(self):
        # The core security property: a newline must never pass validation,
        # or an attacker could inject arbitrary lines into the hosts file.
        assert not is_valid_domain("evil.com\n0.0.0.0 bank.example.com")
        assert not is_valid_domain("evil.com 0.0.0.0 bank.example.com")
        assert not is_valid_domain("evil.com\t# comment")


class TestDeviceClassifier:
    def test_specific_vendor_beats_generic(self):
        # "microsoft xbox" must win over "microsoft" (laptop)
        assert classify_device("Microsoft Xbox")[0] == "console"
        # "amazon technologies" (iot) must win over "amazon" (tv)
        assert classify_device("Amazon Technologies Inc")[0] == "iot"
        assert classify_device("Sony Interactive Entertainment")[0] == "console"

    def test_hostname_overrides_vendor(self):
        assert classify_device("Apple", "Johns-MacBook")[0] == "laptop"
        assert classify_device("Unknown", "living-room-tv")[0] == "tv"

    def test_concatenated_iot_tokens(self):
        assert classify_device("Espressif")[0] == "iot"
        assert classify_device("", "esp32-sensor")[0] == "iot"

    def test_unknown_default(self):
        assert classify_device("Totally Unknown Vendor Co")[0] == "unknown"


class TestMacValidation:
    def test_valid_and_invalid_macs(self):
        from backend.services.arp_spoofer import _is_valid_mac
        assert _is_valid_mac("48:E7:DA:C3:0A:FB")
        assert _is_valid_mac("aa-bb-cc-dd-ee-ff")
        assert not _is_valid_mac("")
        assert not _is_valid_mac("00:00:00:00:00:00")
        assert not _is_valid_mac("ff:ff:ff:ff:ff:ff")
        assert not _is_valid_mac("GG:GG:GG:GG:GG:GG")  # 6 groups but not hex
        assert not _is_valid_mac("not a mac")


class TestFormatBytes:
    def test_units(self):
        assert _format_bytes(512) == "512 B"
        assert _format_bytes(1536).endswith("KB")
        assert _format_bytes(5 * 1024 ** 2).endswith("MB")
        assert _format_bytes(3 * 1024 ** 3).endswith("GB")
