#!/usr/bin/env bash
# Roost launcher for Linux / macOS.
# Packet capture and ARP-based access control need root + libpcap.
set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-5000}"
HOST="${HOST:-127.0.0.1}"

# Re-exec with sudo for raw-socket / packet-capture privileges.
if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Roost needs root for packet capture / ARP access control."
  echo "Re-launching with sudo..."
  exec sudo -E "$0" "$@"
fi

# Build the frontend if it hasn't been built yet.
if [[ ! -f "frontend/dist/index.html" ]]; then
  echo "Building frontend..."
  ( cd frontend && npm install && npm run build )
fi

# Create runtime data dirs.
mkdir -p data/blocklists data/reports

echo "============================================================"
echo "  Roost starting at http://${HOST}:${PORT}"
echo "  Press Ctrl+C to stop"
echo "============================================================"

exec python3 -m uvicorn backend.main:app --host "${HOST}" --port "${PORT}"
