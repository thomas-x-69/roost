# 🪺 Roost — Feature Suggestions

Roost already *sees every device and controls its internet*. That's a superpower.
Most apps waste it on boring dashboards. This list is about turning that power into
things people **screenshot, laugh at, and tell their friends about** — while still being
genuinely useful.

Theme: Roost is a bird. Your devices are **the flock**. Strangers are **strays**.
Blocking is **clipping wings**. The vocabulary is half the fun.

Tags: 🟢 easy · 🟡 medium · 🔴 hard · 🛠️ needs hardware · 💰 product/revenue
Every hit below uses tech Roost *already has*: ARP control, passive DNS/packet capture,
per-device bandwidth, scheduler, WebSocket.

---

## 🔥 The Crown Jewels (creative + funny + actually useful)

### 1. 🚪 The Roast Page (captive-portal redirect) — 🟡
The single most fun thing you can build. When a clipped/throttled device opens a browser,
Roost owns its DNS — so instead of a dead "no internet" error, **serve them a page you wrote**:

> 🪺 **Internet revoked by Mom.**
> Reason: *dishes not done.*
> Time remaining: **23:41**
> [I did the dishes →] (button pings your phone for approval)

Endless variants: a meme, a chore checklist, a countdown, a "pay the toll" puzzle, an
"explain yourself" text box. **Why it wins:** turns a confusing outage into a message, a
joke, or a negotiation. Nobody else does this for the *whole device*.

### 2. 🍽️ Dinner Bell — 🟢
One button: pause the internet for the **entire flock except you** for 30 minutes.
Schedulable ("every night 7:00–7:30"). The family physically has to look up from screens.
Add a 60-second "the internet is about to sleep 😴" warning so it's a nudge, not an ambush.
**Why it wins:** every parent instantly gets it; demo sells itself.

### 3. 🏆 The Wall of Shame (bandwidth leaderboard) — 🟢
Daily/weekly ranking of who torched the most data, with auto-generated petty titles:

> 🥇 **Today's Data Goblin:** Jake's Xbox — 84 GB
> 🥈 The Buffering Bandit: Living Room TV
> 🥉 Sneaky Streamer: bedroom-iphone (3am–5am 👀)

**Why it wins:** gamifies a boring metric, sparks family banter, screenshot-bait.

### 4. 🐦 Dawn Chorus (daily digest with personality) — 🟢
A morning summary written like a tiny newspaper, not a chart:

> ☀️ *Good morning. Quiet night on the nest.*
> • 8,412 ads & trackers clipped 🛡️
> • Jake rage-reconnected 3× at 9pm (Fortnite lost, presumably)
> • A **stray** appeared at 11:48pm — "Galaxy-A14". Friend or foe?
> • Your fridge phoned a server in 🇨🇳 191 times. As fridges do.

Delivered in-app / push / Telegram. **Why it wins:** personality = retention. This is the
"Roost has a soul" feature.

### 5. 🎀 The Velvet Rope (VIP allowlist / bouncer mode) — 🟡
Flip Roost from "block bad guys" to "only let in *my* flock." Any device **not** on your
list is held at the door — no internet until you tap **approve** on your phone.

> 🚧 *A stray wants in:* "amazon-echo-dot" (Amazon). [Let it perch] [Banish]

**Why it wins:** turns your WiFi into a guest list. Genuinely strong security posture, framed
like a nightclub.

### 6. 🐌 The Slow Lane (petty throttle instead of block) — 🟢
Hard-blocking is obvious and gets you caught. **The Slow Lane** drops a device to dial-up
speed — TikTok buffers, pages crawl, but it's "technically working," so they blame their
phone, not you. Pure chaotic-good. (You already have bandwidth control.)

### 7. 🍅 Nest Mode (focus mode for *yourself*) — 🟢
Point the weapon at yourself. Start a 50-minute sprint → Roost network-wide blocks *your own*
distraction sites (or throttles them). A Pomodoro that you literally cannot cheat by
"just checking" your phone, because the block is on the network, not the app.
**Why it wins:** flips a "control the kids" tool into a "control myself" tool — huge market.

### 8. 🧹 Chore Bank / Internet Allowance — 🟡
Kids get a weekly **budget** (time or GB) they manage themselves — they see the balance tick
down. Optionally: internet *unlocks* when a chore is checked off ("trash out → +1 hour").
Teaches self-regulation instead of nagging. Pairs perfectly with the Roast Page.

---

## 🕵️ The "Whoa, it can do that?" tier

### 9. 🐍 The Snitch (IoT phone-home exposer) — 🟡
Surface the creepy truth passively: "Your smart TV contacted **57 tracking domains** while
'off.' Your doorbell uploads to 3 countries." Turns invisible IoT surveillance into a
shocking, shareable feed. (You already capture DNS per device.)

### 10. ⏪ Time Machine (network replay) — 🟡
"Show me the network last Tuesday 8pm." Scrub a timeline of who was on, what they hit, how
much they used. Feels like a security-camera DVR for your internet. **Owner-only — ethics gate.**

### 11. 👻 Night Owl Watch — 🟢
Alert when a device that *should* be asleep is awake and chatty: *"bedroom-iphone is talking
to Instagram at 02:34."* Quietly devastating for parents; trivial to build on join/leave + DNS.

### 12. 🛡️ Counter-Snoop (catch attackers on your LAN) — 🟡
Roost does ARP for good — so it knows what malicious ARP looks like. Detect **evil-twin
hotspots** and *someone else* ARP-spoofing your network. "Roost watches the watchers."

### 13. 🔎 Hidden-Camera Sweep — 🟡 💰
Scan any network (hotel, Airbnb) and flag devices whose fingerprints match spy-cams / baby
monitors. Massive privacy + travel virality; Fing paywalls this — you give it free.

### 14. 🗣️ Talk to Roost (natural-language command) — 🟡
A chat/voice box: *"slow the living room TV until 6pm"* → done. *"who's been on YouTube
today?"* → answer. An LLM command layer over your existing API. Feels like magic, demos like wizardry.

### 15. 🎁 Network Wrapped (your "Spotify Wrapped") — 🟢
A yearly/monthly shareable card: *"Your Network in 2026: 1.4 TB devoured, 92,180 ads clipped,
top goblin: Jake, busiest hour: 9pm Sundays."* Built for sharing = free marketing.

---

## 🛸 Moonshots (the "see through walls" energy)

### 16. WiFi Presence — "Who's home" board — 🟢
No hardware: derive arrivals/departures from devices joining/leaving. *"Mom flew the nest at
08:12."* Feeds automations (Home Assistant) and the away-mode features below.

### 17. 🏠 Auto-Pilot (presence-driven automation) — 🟡
When *your* phone leaves → arm "Velvet Rope" + pause kids' devices. When you arrive → relax.
The house reacts to who's actually in it.

### 18. 🛸 Roost Sense — see-through-walls via WiFi — 🔴 🛠️ 💰
The viral moonshot. WiFi **CSI** sensing detects presence, motion, **breathing, heart rate,
even body pose — through walls, no camera** (see RuView / WiFi-DensePose, 48k★, ESP32 nodes
~$54). A normal PC NIC can't read CSI, so this ships as a **companion hardware kit** ("Roost
Sense") that reports into the dashboard. This is a *product*, not a checkbox. Use cases:
elderly fall-detection, baby breathing monitor, intruder presence — all privacy-friendly
because there's no video.

---

## 🧱 The unglamorous staples (still need them)

Boring but expected; ship alongside the fun stuff so reviewers don't dock you.

- Per-device **site / category** blocking (porn/social/games lists) — 🟡
- **Screen-time schedules & quotas** per device/group — 🟢
- **Instant new-device push alerts** (Telegram/email/PWA) — 🟢
- **Scheduled speed tests + ISP history** ("is my ISP cheating me?") — 🟡
- **Open-ports / vulnerability scan** per device — 🟡
- **Mobile PWA + push notifications** — 🟡
- **Home Assistant / MQTT integration** (presence + control as entities) — 🟡 💰

---

## 💰 What turns into money

| Product | Model |
|---|---|
| **Roost Sense** hardware kit (CSI sense-through-walls) | sell kits 🛠️ |
| **Roost Pro** (vuln scans, threat-intel feeds, long-term analytics, scheduled reports) | optional paid tier — *never gate the core* |
| **Roost Connect** (secure remote access + push, local-first preserved) | monetize convenience, not features (Pi-hole model) |
| **MSP / small-office edition** (multi-site, guest portal, compliance) | B2B license |

---

## ⚠️ The one rule
The Time Machine, Snitch, Presence and Sense features are *powerful*. Keep them strictly
**owner / authorized-network only** (matches the DISCLAIMER). The line between "cool home
tool" and "stalkerware" is consent — stay loudly on the right side of it, or adoption dies.

---

### 🎯 If I had to pick 3 to build first
1. **The Roast Page** — nothing else looks or feels like it.
2. **Dinner Bell + Wall of Shame** — instant family delight, trivial effort.
3. **Dawn Chorus** — gives Roost a personality people come back for.
