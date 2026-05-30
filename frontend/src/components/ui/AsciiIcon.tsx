/**
 * AsciiIcon — small, clean monospace ASCII glyphs used for nav/section icons
 * and inline action icons across Roost. These replace most lucide-react icons,
 * keeping the "Clean Terminal" look: flat, monospace, 1–3 chars, well aligned.
 *
 * Usage:
 *   <AsciiIcon name="devices" />
 *   <AsciiIcon name="block" className="text-acc-red" />
 *   <AsciiIcon name="usage" color="var(--acc-cyan)" />
 *
 * Render as inline monospace text so glyphs align on the baseline and inherit
 * the surrounding font-size. Color defaults to currentColor (inherits text-*).
 */

export type AsciiIconName =
  // nav / section icons
  | 'dashboard'
  | 'devices'
  | 'usage'
  | 'schedules'
  | 'alerts'
  | 'threats'
  | 'groups'
  | 'top-sites'
  | 'reports'
  // action / status icons
  | 'block'
  | 'unblock'
  | 'scan'
  | 'refresh'
  | 'search'
  | 'online'
  | 'offline'
  | 'blocked'
  | 'gateway'
  | 'upload'
  | 'download'

interface Props {
  name: AsciiIconName
  className?: string
  /** Explicit color; defaults to currentColor (inherits text utilities). */
  color?: string
  /** Accessible label; falls back to the icon name. Set '' to hide from a11y. */
  title?: string
}

/**
 * Glyph table. Each glyph is 1–3 monospace chars chosen to read as the concept
 * while staying legible at small sizes. Box/geometric Unicode is used where it
 * reads cleaner than pure ASCII, but everything is flat (no emoji/color glyphs).
 */
const GLYPHS: Record<AsciiIconName, string> = {
  // --- nav / section ---
  dashboard: '▤',     // tiled panels / grid
  devices:   '▢',     // a screen/device outline
  usage:     '◔',     // a metered dial (consumption)
  schedules: '◷',     // a clock face
  alerts:    '!',     // exclamation
  threats:   '✕',     // hard X / danger
  groups:    '⧉',     // overlapping members
  'top-sites': '↟',   // ranked / rising
  reports:   '▦',     // a document grid / sheet

  // --- action / status ---
  block:     '⊘',     // prohibited
  unblock:   '○',     // open / cleared circle
  scan:      '⊹',     // radar ping
  refresh:   '↻',     // reload
  search:    '⌕',     // magnifier
  online:    '●',     // solid dot
  offline:   '○',     // hollow dot
  blocked:   '⊗',     // crossed dot
  gateway:   '⌂',     // house / gateway hub
  upload:    '↑',     // up
  download:  '↓',     // down
}

export default function AsciiIcon({ name, className, color, title }: Props) {
  const glyph = GLYPHS[name] ?? '?'
  const label = title === undefined ? name : title
  return (
    <span
      data-testid="ascii-icon"
      data-icon={name}
      role="img"
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      title={label || undefined}
      className={className}
      style={{
        display: 'inline-block',
        fontFamily: 'var(--term-font)',
        lineHeight: 1,
        textAlign: 'center',
        color: color,
        // keep glyphs from drifting; render flat (no glow)
        textShadow: 'none',
        fontVariantEmoji: 'text',
      }}
    >
      {glyph}
    </span>
  )
}

/** The full list of available icon names (handy for tooling / tests). */
export const ASCII_ICON_NAMES: AsciiIconName[] = [
  'dashboard', 'devices', 'usage', 'schedules', 'alerts', 'threats', 'groups',
  'top-sites', 'reports',
  'block', 'unblock', 'scan', 'refresh', 'search', 'online', 'offline',
  'blocked', 'gateway', 'upload', 'download',
]
