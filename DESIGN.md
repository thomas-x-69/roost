# Roost Design Language — "Clean Terminal"

Roost uses a single cohesive **Clean Terminal** look: monospace everywhere, near-black flat
surfaces, crisp 1px borders, generous spacing, and smooth ~140ms transitions.
**FLAT** — no gradients, no scanlines, no glow, no neon. (Linear / Warp / Raycast energy.)

Build-phase agents should style components using the tokens and utility classes below.
**Do not invent new colors** — use the palette. Prefer the utility classes; fall back to the
Tailwind `term.*` / `acc.*` tokens when you need finer control.

---

## Base palette (CSS variables — `frontend/src/index.css :root`, mirrored as Tailwind `term.*`)

| Variable               | Hex       | Tailwind                  | Use                                   |
|------------------------|-----------|---------------------------|---------------------------------------|
| `--term-bg`            | `#0b0e10` | `bg-term-bg`              | App background (near-black)           |
| `--term-bg-2`          | `#12171a` | `bg-term-bg-2`            | Raised panel / card                   |
| `--term-bg-3`          | `#181f23` | `bg-term-bg-3`            | Hover / inset                         |
| `--term-border`        | `#222b30` | `border-term-border`      | Default 1px border                    |
| `--term-border-strong` | `#2f3a40` | `border-term-border-strong` | Stronger divider / control border   |
| `--term-fg`            | `#e6edf1` | `text-term-fg`            | Primary text                          |
| `--term-text-dim`      | `#93a4ac` | `text-term-dim`           | Secondary text                        |
| `--term-faint`         | `#5a666d` | `text-term-faint`         | Tertiary / disabled                   |
| `--term-green`         | `#4cc38a` | `text-term-green`         | THE base accent (online / primary)    |
| `--term-amber`         | `#d6a13a` | `text-term-amber`         | Warning / protected                   |
| `--term-accent`        | `#58b2c9` | `text-term-accent`        | Secondary cool accent (links/meta)    |
| `--term-danger`        | `#e0604e` | `text-term-danger`        | Blocked / error                       |

---

## Per-page accent colors

Each page owns ONE muted accent (no neon, no gradients). The dashboard (`/`) aggregates — its
widgets each use **their source page's** color, so `/` itself maps to neutral green.

| Page        | Route        | Name   | Hex       | Tailwind token suffix |
|-------------|--------------|--------|-----------|-----------------------|
| dashboard   | `/`          | neutral| `#4cc38a` | `green` (per-widget colors override) |
| devices     | `devices`    | green  | `#4cc38a` | `green`               |
| usage       | `usage`      | cyan   | `#58b2c9` | `cyan`                |
| top-sites   | `top-sites`  | blue   | `#5b8def` | `blue`                |
| schedules   | `schedules`  | amber  | `#d6a13a` | `amber`               |
| alerts      | `alerts`     | orange | `#e08c4e` | `orange`              |
| threats     | `threats`    | red    | `#e0604e` | `red`                 |
| groups      | `groups`     | violet | `#a98bdb` | `violet`              |
| reports     | `reports`    | sand   | `#c9a26b` | `sand`                |

### Tailwind `acc-*` tokens (`frontend/tailwind.config.js`)

Available as text / border / background utilities (with opacity modifiers):

```
text-acc-green   border-acc-green   bg-acc-green/10
text-acc-cyan    border-acc-cyan    bg-acc-cyan/10
text-acc-blue    border-acc-blue    bg-acc-blue/10
text-acc-amber   border-acc-amber   bg-acc-amber/10
text-acc-orange  border-acc-orange  bg-acc-orange/10
text-acc-red     border-acc-red     bg-acc-red/10
text-acc-violet  border-acc-violet  bg-acc-violet/10
text-acc-sand    border-acc-sand    bg-acc-sand/10
```

Matching CSS variables also exist: `var(--acc-green)` … `var(--acc-sand)` (for inline styles
and chart/SVG fills).

### `pageAccents.ts` helper (`frontend/src/theme/pageAccents.ts`)

```ts
import { getPageAccent, PAGE_ACCENTS, PageAccent } from '@/theme/pageAccents'

// shape:
interface PageAccent { name: string; hex: string; token: string }

// lookup table keyed by route path:
PAGE_ACCENTS['usage']            // { name: 'cyan', hex: '#58b2c9', token: 'cyan' }

// tolerant resolver (handles '/usage', 'usage', '/usage/42'):
const acc = getPageAccent('/usage')          // { name:'cyan', hex:'#58b2c9', token:'cyan' }
<h1 className={`text-acc-${acc.token}`}>Usage</h1>
<svg><path stroke={acc.hex} /></svg>
```

---

## ASCII icons — `AsciiIcon` (`frontend/src/components/ui/AsciiIcon.tsx`)

Small, flat monospace glyphs (1–3 chars) that replace most lucide-react icons. Inherit
`currentColor` by default; accept `className`, `color`, and `title`.

```tsx
import AsciiIcon from '@/components/ui/AsciiIcon'

<AsciiIcon name="devices" />
<AsciiIcon name="block" className="text-acc-red" />
<AsciiIcon name="usage" color="var(--acc-cyan)" />
```

**Available `name` values** (also exported as `ASCII_ICON_NAMES`):

- Nav / section: `dashboard`, `devices`, `usage`, `schedules`, `alerts`, `threats`,
  `groups`, `top-sites`, `reports`
- Action / status: `block`, `unblock`, `scan`, `refresh`, `search`, `online`, `offline`,
  `blocked`, `gateway`, `upload`, `download`

---

## Tailwind tokens (`frontend/tailwind.config.js`)

- **Font:** `font-sans` and `font-mono` both resolve to the JetBrains/IBM Plex Mono stack.
  The whole app is monospace by default — you usually don't need a font utility at all.
- **Colors:** `term.*` (base palette) and `acc.*` (per-page accents) — see tables above.
- **Animations:** `animate-blink` (others — `flicker`, `scan` — exist but are inert/no-op).
- Legacy `brand.*` colors remain for backward compat — avoid in new work.

---

## Utility classes (`frontend/src/index.css`)

### Panels
- `.term-panel` — flat bordered surface: `--term-bg-2` fill, 1px `--term-border`, 10px radius.
- `.term-panel-active` — green border for focused/selected.
- `.panel-head` — header row inside a panel (space-between, bottom border).
- `.panel-title` — small uppercase, letter-spaced, dim section label.

### Text colors
- `.term-fg` `.term-green` `.term-amber` `.term-accent` `.term-dim` `.term-faint` `.term-danger`
- `.term-glow*` exist but are flat no-ops (kept for compatibility — do not rely on glow).

### Buttons
- `.term-btn` — flat button (no auto brackets). Hover lightens bg + border.
- `.term-btn-primary` (green) / `.term-btn-amber` / `.term-btn-danger` — variants.

### Status dot
- `.dot` + `.dot-online` / `.dot-offline` / `.dot-blocked`.

### Prompt / log / cursor
- `.term-prompt` — prepends a green `> ` glyph.
- `.term-log` — dimmed pre-wrapped monospace block.
- `.blink` — subtle blinking block cursor; `.blink-text` for glyph text.
- `.rise` — gentle entrance for cards/rows.

---

## Usage examples

```tsx
// Per-page accented header
const acc = getPageAccent('/threats')
<header className="panel-head">
  <span className="panel-title flex items-center gap-2">
    <AsciiIcon name="threats" className={`text-acc-${acc.token}`} /> Threats
  </span>
</header>

// Panel
<div className="term-panel">
  <div className="panel-head"><span className="panel-title">System Status</span></div>
  <div className="p-4 term-dim">all subsystems nominal</div>
</div>

// Buttons
<button className="term-btn term-btn-primary"><AsciiIcon name="scan" /> Scan</button>
<button className="term-btn term-btn-danger"><AsciiIcon name="block" /> Block</button>

// Status row
<span className="dot dot-online" /> <span className="term-green">online</span>

// Prompt line with blinking cursor
<div className="term-prompt term-green">awaiting input<span className="blink" /></div>

// Tailwind tokens directly
<div className="bg-term-bg-2 border border-term-border">…</div>
<svg><path stroke="var(--acc-cyan)" /></svg>
```

## Rules for Build-phase agents
1. Monospace is global — don't add serif/sans fonts.
2. FLAT only — no gradients, no scanlines, no glow, no neon.
3. Use the base palette (`term-*` / `--term-*`) plus the page's ONE accent (`acc-*`). No raw
   blues/slates in new UI.
4. Crisp 1px borders, generous spacing, ~140ms transitions.
5. Prefer `AsciiIcon` over lucide-react. Reach for utility classes first; use `term.*` / `acc.*`
   tokens for one-offs.
6. Preserve all routes, react-query keys, and `data-testid` attributes.
