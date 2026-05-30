# Roost Design Language — Terminal / CRT Aesthetic

Roost uses a single cohesive **retro CRT terminal** look: monospace everywhere, a phosphor
palette (green/amber on near-black), subtle scanline + glow, ASCII box-drawing borders, a
blinking block cursor, and a boot-log vibe.

Build-phase agents should style components using the tokens and utility classes below.
**Do not invent new colors** — use the palette. Prefer the utility classes; fall back to the
Tailwind `term.*` tokens when you need finer control.

---

## Palette (CSS variables — defined in `frontend/src/index.css :root`)

| Variable        | Hex       | Use                                   |
|-----------------|-----------|---------------------------------------|
| `--term-bg`     | `#0a0e0a` | App background (near-black)           |
| `--term-bg-2`   | `#0e140e` | Raised panel / card background        |
| `--term-fg`     | `#c8f7c5` | Default body text                     |
| `--term-green`  | `#33ff66` | Primary phosphor green (accents, on)  |
| `--term-amber`  | `#ffb000` | Amber phosphor (warnings, secondary)  |
| `--term-dim`    | `#4a6a4f` | Muted text + default borders          |
| `--term-accent` | `#00e0ff` | Cyan accent (links, highlights)       |
| `--term-danger` | `#ff5f56` | Errors                                |
| `--term-font`   | mono stack| Default font family                   |

The same palette is exposed to Tailwind as `term.*` (see below).

---

## Tailwind tokens (`frontend/tailwind.config.js`)

- **Font:** `font-sans` and `font-mono` both resolve to the JetBrains/IBM Plex Mono stack.
  The whole app is monospace by default — you usually don't need a font utility at all.
- **Colors:** `term-bg`, `term-bg-2`, `term-fg`, `term-green`, `term-amber`, `term-dim`,
  `term-accent`, `term-danger`.
  Usable as `bg-term-bg`, `text-term-green`, `border-term-dim`, `bg-term-bg-2`, etc.
- **Animations:** `animate-blink`, `animate-flicker`, `animate-scan`.
- **Keyframes:** `blink`, `flicker`, `scan` (also defined in CSS for the class-based utilities).
- Legacy `brand.*` colors remain for backward compat — avoid in new work.

Font web-loaded via Google Fonts `@import` in `index.css` (JetBrains Mono + IBM Plex Mono) as
progressive enhancement over the system monospace stack.

---

## Utility classes (defined in `frontend/src/index.css`)

### Containers / CRT
- `.crt` — phosphor text glow + base terminal colors on a container.
- `.scanlines` — overlays CRT scanlines via `::after` (set on the wrapper).
- `.scanlines.flicker` — adds the whole-screen brightness flicker. (Use both classes together.)
- `.scan-beam` — an absolutely-positioned sweeping beam element; drop inside a `relative` parent.

### Panels (ASCII box)
- `.term-panel` — bordered panel with `--term-bg-2` fill and ASCII diagonal corner glyphs
  (`┌` top-left, `┘` bottom-right). Square corners, 1px dim border.
- `.term-corners` — optional empty `<span>` nested inside a `.term-panel` to paint the other
  two corners (`┐` top-right, `└` bottom-left) for a full four-corner ASCII box.
- `.term-panel-active` — add alongside `.term-panel` for a green border + glow (focused/selected).

### Text
- `.term-fg` `.term-green` `.term-amber` `.term-dim` `.term-accent` `.term-danger` — color helpers.
- `.term-glow` `.term-glow-amber` `.term-glow-cyan` — phosphor text glow.
- `.term-prompt` — prepends a `> ` prompt glyph (use on a line of text).
- `.term-log` — dimmed pre-wrapped monospace block for log/boot-log streams.

### Cursor
- `.blink` — a blinking block cursor element (style an empty `<span class="blink" />`).
- `.blink-text` — apply the blink animation to glyph text (e.g. `█` or `_`).

### Buttons
- `.term-btn` — terminal button, auto-wraps label in `[ … ]`, uppercase, inverts on hover.
- `.term-btn-amber` / `.term-btn-danger` — color variants (combine with `.term-btn`).

---

## Usage examples

```tsx
// Panel (full ASCII box with all four corners)
<div className="term-panel term-panel-active">
  <span className="term-corners" />
  <h2 className="term-green term-glow">SYSTEM STATUS</h2>
  <p className="term-dim">all subsystems nominal</p>
</div>

// CRT screen wrapper with scanlines + flicker
<div className="crt scanlines flicker min-h-screen">
  {/* app */}
</div>

// Prompt line with blinking cursor
<div className="term-prompt term-green">
  awaiting input<span className="blink" />
</div>

// Boot log
<pre className="term-log">
  [ ok ] mounting /dev/roost
  [ ok ] starting netguard daemon
</pre>

// Buttons
<button className="term-btn">SCAN</button>
<button className="term-btn term-btn-danger">KILL</button>

// Tailwind tokens directly
<span className="text-term-amber animate-blink">_</span>
<div className="bg-term-bg-2 border border-term-dim">…</div>
```

## Rules for Build-phase agents
1. Monospace is global — don't add serif/sans fonts.
2. Use the phosphor palette only (`term-*` / `--term-*`). No raw blues/slates in new UI.
3. Square corners (`rounded-none` / `border-radius: 0`). No soft rounded cards.
4. Prefer ASCII box-drawing (`┌─┐ │ └─┘`), brackets `[ ]`, and prompt glyphs `> $ #`.
5. Reach for the utility classes first; use `term.*` Tailwind tokens for one-offs.
