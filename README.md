<div align="center">

# 🪺 Roost

### See every device on your network. Control all of them. Own your data.

**Roost** is a beautiful, self-hosted dashboard that shows you everything connected to
your home network — and lets you pause the internet for any device, block ads & trackers,
and set screen-time schedules. No cloud. No account. No subscription. It all runs on *your*
machine, and your data never leaves it.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-3776AB.svg?logo=python&logoColor=white)](https://www.python.org/)
[![React 18](https://img.shields.io/badge/react-18-61DAFB.svg?logo=react&logoColor=white)](https://react.dev/)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Self-hosted](https://img.shields.io/badge/self--hosted-100%25%20local-success.svg)](#-your-data-never-leaves-your-machine)

[Why Roost](#-the-problem) · [Features](#-what-roost-does) · [Quick start](#-quick-start) · [vs Fing / GlassWire / NetCut](#-how-roost-compares) · [Privacy](#-your-data-never-leaves-your-machine) · [FAQ](#-faq)

</div>

---

> ### ⚠️ Use only on a network you own or are authorized to manage.
> Roost controls real devices via ARP. On your own network that's a feature; on someone
> else's it may be illegal. Read the [**DISCLAIMER**](DISCLAIMER.md) before you start.

---

## 😩 The problem

You don't actually know what's happening on your own network.

- **"Who is connected to my WiFi right now?"** — strangers, neighbors, that one device you can't identify?
- **"Why is the internet so slow?"** — and *which* device is hogging all the bandwidth?
- **"The kids won't put the tablet down."** — but there's no easy off switch at bedtime.
- **Ads and trackers everywhere** — on every device, even the ones with no ad-blocker.

The "solutions" today all make you pay for the privilege of fixing your own network:

- **Fing / GlassWire** want a **cloud account**, nag you to **upgrade**, paywall the useful
  features, and quietly send your network's data to *their* servers.
- **NetCut** can kick devices off — but it's Windows-only, looks like it's from 2009, and
  bundles things you didn't ask for.
- **Pi-hole / AdGuard Home** are brilliant at blocking ads… and *only* blocking ads. They
  don't show you devices or let you pause one.
- **LibreNMS / Zabbix / Nagios** are powerful — and built for data-center admins, not for
  "show me my house in one screen."

## ✨ The fix: one screen for your whole network

Roost puts **discovery + control + ad-blocking + schedules** in a single, modern, local
dashboard — the tool the apps above each do one slice of, without the accounts, paywalls,
or ugliness.

## 🚀 What Roost does

| | Feature | What it solves |
|---|---|---|
| 🔍 | **Live device discovery** | Instantly see every device — name, vendor, type, IP, MAC, online/offline — auto-classified (phone, laptop, TV, console, IoT…). |
| ⛔ | **One-click pause** | Cut a device's internet in one click (and restore it just as fast). Your own machine and router are auto-protected and *can't* be blocked. |
| ⏰ | **Access schedules** | "Kids' tablets off at 21:00 on school nights." Per-device **or per-group** weekly schedules that run themselves. |
| 📊 | **Bandwidth insight** | See who's using what, in real time, with per-device history and reports. |
| 🛡️ | **Ad / tracker / threat blocking** | Network-aware DNS threat detection + one-click domain sinkholing, with optional StevenBlack blocklist import. |
| 👨‍👩‍👧 | **Groups** | Bundle devices ("Kids", "IoT", "Guests") and act on them together. |
| 🔔 | **Alerts** | Know the moment a **new/unknown device** joins or a threat domain is queried. |
| 📄 | **PDF reports** | Export a clean network report for the week or month. |
| ⚡ | **Real-time UI** | WebSocket-powered — the dashboard updates the instant the network changes. |

## 🔒 Your data never leaves your machine

This is the whole point.

- **No account. No sign-up. No cloud.** Roost runs entirely on your computer.
- **No telemetry, no analytics, no "phone home."**
- **No subscription, no "Pro" tier, no feature gating** — every feature is in the box, free.
- **Open source (Apache-2.0).** Read the code. Audit it. Fork it.
- Binds to **`127.0.0.1`** by default — only *you*, on *your* machine, can reach it.

Your network map — the most private map there is — stays yours.

## 🆚 How Roost compares

| | **Roost** | Fing | GlassWire | NetCut | Pi-hole |
|---|:---:|:---:|:---:|:---:|:---:|
| 100% self-hosted / local | ✅ | ⚠️ cloud | ⚠️ cloud | ✅ | ✅ |
| No account required | ✅ | ❌ | ❌ | ✅ | ✅ |
| Free & open source | ✅ | ❌ | ❌ | ❌ | ✅ |
| See all devices | ✅ | ✅ | ⚠️ | ✅ | ❌ |
| Pause a device's internet | ✅ | 💲 | ❌ | ✅ | ❌ |
| Per-device schedules | ✅ | 💲 | ❌ | ❌ | ❌ |
| Bandwidth per device | ✅ | 💲 | ✅ | ⚠️ | ❌ |
| Ad / threat blocking | ✅ | ❌ | ❌ | ❌ | ✅ |
| Modern UI | ✅ | ✅ | ✅ | ❌ | ⚠️ |

<sub>✅ included · 💲 paid tier · ⚠️ partial · ❌ no. Comparison reflects typical offerings at time of writing.</sub>

## 🛠️ Tech stack

**Backend:** FastAPI · async SQLAlchemy (SQLite/WAL) · APScheduler · Scapy
**Frontend:** React 18 · TypeScript · Vite · Tailwind · React Query · Recharts · vis-network

```
┌──────────────────────────────┐      ┌───────────────────────────────────┐
│  React + TS + Vite SPA        │ HTTP │  FastAPI backend                    │
│  dashboard · devices · usage  │◄────►│  api · services · tasks · ws        │
│  schedules · threats · groups │  WS  │  Scapy discovery + access control   │
└──────────────────────────────┘      │  SQLite (async, WAL)                │
                                       └───────────────────────────────────┘
```

## 📦 Requirements

- **Python 3.11+** and **Node.js 18+**
- For discovery / access-control / capture: a packet driver + privileges
  - **Windows:** [Npcap](https://npcap.com/) + run as Administrator
  - **Linux/macOS:** libpcap + run with `sudo`

> No driver or privileges? Roost still runs — UI, schedules, threat lists and reports work;
> live scanning and access control are disabled and an alert tells you why.

## ⚡ Quick start

```bash
git clone https://github.com/thomas-x-69/roost.git && cd roost

# Backend
python -m venv .venv
# Windows: .venv\Scripts\activate   |   Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt

# Frontend
cd frontend && npm install && npm run build && cd ..

# Run (use Administrator / sudo for full functionality)
python -m uvicorn backend.main:app --host 127.0.0.1 --port 5000
```

Open <http://localhost:5000>.

- **Windows:** just run `start.bat` (handles elevation, build, launch).
- **Linux/macOS:** `./start.sh`.

## ⚙️ Configuration

Copy `.env.example` → `.env`. Key settings:

| Variable | Default | Notes |
|---|---|---|
| `HOST` | `127.0.0.1` | **Keep localhost** unless you read [SECURITY.md](SECURITY.md). `0.0.0.0` exposes control to your whole LAN with no auth. |
| `PORT` | `5000` | HTTP port. |
| `SCAN_INTERVAL_SECONDS` | `30` | How often to re-scan. |

## 🧪 Development

```bash
pip install -r requirements-dev.txt
python -m uvicorn backend.main:app --reload --port 5000   # backend
cd frontend && npm run dev                                # frontend (proxies to :5000)
pytest                                                    # fast unit tests (no privileges)
pytest -m integration                                     # browser/LAN e2e (needs running backend)
```

See [CONTRIBUTING.md](CONTRIBUTING.md).

## ❓ FAQ

**Does Roost send my data anywhere?** No. Everything is local. There is no account and no cloud.

**Is "pausing a device" the same as a real firewall?** Roost uses ARP-based access control,
which works on typical switched home networks. It's not a router-grade firewall and may not
work where client isolation / dynamic ARP inspection is enforced. See [limitations](#-limitations).

**Will this work without admin rights?** The UI and most features yes; live scanning and
device control need admin/root + a packet driver.

**Is the bandwidth limit a true rate limiter?** It's coarse — it briefly pauses a device that
exceeds its budget to lower average throughput, plus host-side QoS on Windows. See below.

## ⚠️ Limitations

- **Access control is ARP-based** — great on home networks, not guaranteed on managed/enterprise gear.
- **"Bandwidth limit" is coarse**, not precise per-packet shaping.
- **Discovery assumes a /24** subnet for CIDR computation.

## 🗺️ Roadmap

- [ ] Docker image / one-line deploy
- [ ] Per-group bandwidth + schedules in the UI
- [ ] Mobile-friendly layout
- [ ] Pluggable blocklist sources
- [ ] Optional token auth for LAN-exposed deployments

## 🤝 Contributing

PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Please keep Roost an
**authorized-use** tool (no features whose purpose is attacking networks you don't own).

## 📜 License

[Apache License 2.0](LICENSE) · third-party data attribution in [NOTICE](NOTICE) · use is
subject to the [DISCLAIMER](DISCLAIMER.md).

<div align="center"><sub>Built for people who want to own their network — and their data. ⭐ it if that's you.</sub></div>
