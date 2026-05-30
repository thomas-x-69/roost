import sys
import ctypes
import os

def check_admin() -> bool:
    """Return True if running as Administrator."""
    try:
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except Exception:
        return os.getuid() == 0  # Linux/Mac fallback

def require_admin():
    """Exit with a clear message if not running as Administrator."""
    if not check_admin():
        print("=" * 60)
        print("  Roost requires Administrator privileges.")
        print("  Right-click 'start.bat' → 'Run as administrator'")
        print("=" * 60)
        sys.exit(1)
