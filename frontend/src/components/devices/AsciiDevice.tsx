/**
 * AsciiDevice — renders an animated, hand-drawn ASCII-art glyph for a network
 * device. The art is chosen from `deviceType` and the visual treatment from the
 * device's online / blocked state:
 *   - online   : phosphor-green, blinking signal bars + pulsing power LED
 *   - offline  : dimmed, faintly flickering "no signal" / static look
 *   - blocked  : red, flashing strike-through alert look
 *
 * All motion is pure CSS (keyframes), so a screen full of devices stays cheap —
 * no JS timers. The keyframes are injected once via a module-level <style> tag.
 */

type DeviceState = 'online' | 'offline' | 'blocked'

interface Props {
  deviceType: string
  isOnline: boolean
  isBlocked: boolean
  size?: 'sm' | 'md' | 'lg'
}

/* ------------------------------------------------------------------ *
 * ASCII art. Each entry is a small multi-line glyph. Lines that carry
 * "signal"/"power" indicators use the sentinels below so the animated
 * spans can be slotted in without re-drawing the whole figure.
 *   ~S~  -> animated signal bars (online) / static (offline)
 *   ~P~  -> pulsing power LED dot
 * ------------------------------------------------------------------ */

const SIG = '~S~'
const PWR = '~P~'

const ART: Record<string, string[]> = {
  // tall slab with a speaker notch up top and a home dot at the base
  phone: [
    ' .------. ',
    '| .----. |',
    '| | ' + SIG + '  | |',
    '| |    | |',
    '| |    | |',
    '| .----. |',
    " |  (" + PWR + ")  | ",
    " '------' ",
  ],
  // wider slab, landscape-ish screen, side power dot
  tablet: [
    ' .--------. ',
    '| .------. |',
    '| | ' + SIG + '   | |',
    '| |      |' + PWR + '|',
    '| |      | |',
    '| .------. |',
    " '--------' ",
  ],
  // clamshell: lid (screen) over an angled keyboard base
  laptop: [
    '  .--------.  ',
    '  | ' + SIG + '      |  ',
    '  |        |  ',
    '  .--------.  ',
    ' .----------. ',
    "(_____" + PWR + "______)",
  ],
  // monitor on a stand
  desktop: [
    ' .----------. ',
    '| ' + SIG + '        |',
    '|          |',
    '|        ' + PWR + ' |',
    " '----------' ",
    '     |__|     ',
    '   .------.   ',
  ],
  // flat-panel TV on two legs
  tv: [
    ' .------------. ',
    '| ' + SIG + '          |',
    '|            |',
    '|          ' + PWR + ' |',
    " '------------' ",
    '   //      \\\\   ',
  ],
  // game console with a disc slot + LED
  console: [
    ' .------------. ',
    '|  ' + SIG + '         |',
    '| .--------.  ' + PWR + '|',
    '| | [===] |   |',
    '| .--------.  |',
    " '------------' ",
  ],
  // wifi router with two antennas and front LEDs
  router: [
    ' \\' + SIG + '       ' + SIG + '/ ',
    '  \\       /  ',
    ' .---------. ',
    '|  o o o ' + PWR + ' |',
    " '---------' ",
  ],
  // small smart sensor / hub: rounded body with a single eye
  iot: [
    '   .----.   ',
    '  /  ' + SIG + '   \\  ',
    ' |  .--.  | ',
    ' |  | ' + PWR + '|  | ',
    '  \\  --  /  ',
    "   '----'   ",
  ],
  // generic unidentified device
  unknown: [
    ' .------. ',
    '|  ' + SIG + '   |',
    '|   ??   |',
    '|      ' + PWR + ' |',
    " '------' ",
  ],
}

// Aliases for backend values / icon keys that differ from canonical keys.
const TYPE_ALIASES: Record<string, keyof typeof ART | string> = {
  smartphone: 'phone',
  mobile: 'phone',
  monitor: 'desktop',
  pc: 'desktop',
  computer: 'desktop',
  gamepad: 'console',
  gaming: 'console',
  playstation: 'console',
  xbox: 'console',
  television: 'tv',
  gateway: 'router',
  modem: 'router',
  sensor: 'iot',
  smart: 'iot',
  device: 'unknown',
}

function resolveArt(deviceType: string): string[] {
  const key = (deviceType || '').toLowerCase()
  if (ART[key]) return ART[key]
  const alias = TYPE_ALIASES[key]
  if (alias && ART[alias]) return ART[alias]
  return ART.unknown
}

const SIZE: Record<NonNullable<Props['size']>, string> = {
  sm: '9px',
  md: '12px',
  lg: '16px',
}

const STYLE_ID = 'ascii-device-keyframes'
const KEYFRAMES = `
@keyframes ad-sig {
  0%, 100% { opacity: 1; }
  33%      { opacity: 0.35; }
  66%      { opacity: 0.7; }
}
@keyframes ad-pwr {
  0%, 100% { opacity: 1; text-shadow: 0 0 4px currentColor; }
  50%      { opacity: 0.45; text-shadow: 0 0 1px currentColor; }
}
@keyframes ad-static {
  0%, 100% { opacity: 0.5; }
  20%      { opacity: 0.2; }
  40%      { opacity: 0.6; }
  60%      { opacity: 0.15; }
  80%      { opacity: 0.45; }
}
@keyframes ad-offline-flicker {
  0%, 96%, 100% { opacity: 0.5; }
  97%           { opacity: 0.28; }
  98%           { opacity: 0.55; }
}
@keyframes ad-block-flash {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.35; }
}
.ad-art { white-space: pre; line-height: 1.05; font-family: var(--term-font); display: inline-block; }
.ad-online  { color: var(--term-green); }
.ad-offline { color: var(--term-faint); animation: ad-offline-flicker 5s steps(40) infinite; }
.ad-blocked { color: var(--term-danger); animation: ad-block-flash 1.1s steps(2, start) infinite; }
.ad-sig-on      { animation: ad-sig 1.1s steps(3, start) infinite; }
.ad-sig-static  { animation: ad-static 0.4s steps(5) infinite; }
.ad-pwr-on      { color: var(--term-amber); animation: ad-pwr 1.6s ease-in-out infinite; }
.ad-pwr-off     { opacity: 0.4; }
.ad-blocked .ad-sig-on, .ad-blocked .ad-pwr-on { animation: none; color: inherit; text-shadow: inherit; }
`

function ensureStyle() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = KEYFRAMES
  document.head.appendChild(el)
}

/** Split a line on the SIG / PWR sentinels into animatable spans. */
function renderLine(line: string, state: DeviceState, lineIdx: number) {
  const parts: Array<{ text: string; kind: 'plain' | 'sig' | 'pwr' }> = []
  let buf = ''
  for (let i = 0; i < line.length; ) {
    if (line.startsWith(SIG, i)) {
      if (buf) { parts.push({ text: buf, kind: 'plain' }); buf = '' }
      parts.push({ text: 'iii', kind: 'sig' })
      i += SIG.length
    } else if (line.startsWith(PWR, i)) {
      if (buf) { parts.push({ text: buf, kind: 'plain' }); buf = '' }
      parts.push({ text: state === 'blocked' ? 'x' : 'o', kind: 'pwr' })
      i += PWR.length
    } else {
      buf += line[i]
      i += 1
    }
  }
  if (buf) parts.push({ text: buf, kind: 'plain' })

  return (
    <span key={lineIdx} style={{ display: 'block' }}>
      {parts.map((p, j) => {
        if (p.kind === 'sig') {
          const cls = state === 'online' ? 'ad-sig-on' : state === 'offline' ? 'ad-sig-static' : ''
          return <span key={j} className={cls}>{p.text}</span>
        }
        if (p.kind === 'pwr') {
          const cls = state === 'online' ? 'ad-pwr-on' : 'ad-pwr-off'
          return <span key={j} className={cls}>{p.text}</span>
        }
        return <span key={j}>{p.text}</span>
      })}
    </span>
  )
}

export default function AsciiDevice({ deviceType, isOnline, isBlocked, size = 'md' }: Props) {
  ensureStyle()

  const state: DeviceState = isBlocked ? 'blocked' : isOnline ? 'online' : 'offline'
  const art = resolveArt(deviceType)
  const stateCls =
    state === 'online' ? 'ad-online' : state === 'blocked' ? 'ad-blocked' : 'ad-offline'

  const label = `${deviceType || 'unknown'} — ${state}`

  return (
    <pre
      data-testid="ascii-device"
      data-state={state}
      aria-label={label}
      title={label}
      role="img"
      className={`ad-art ${stateCls}`}
      style={{ fontSize: SIZE[size], margin: 0 }}
    >
      {art.map((line, i) => renderLine(line, state, i))}
    </pre>
  )
}
