/**
 * Per-page accent colors for Roost ("Clean Terminal" aesthetic).
 *
 * Each page owns ONE muted accent (no neon, no gradients). Use the matching
 * Tailwind token (`text-acc-cyan`, `border-acc-cyan`, `bg-acc-cyan/10`, …),
 * the raw `hex` for inline styles / charts, or the CSS variable (`var(--acc-cyan)`).
 *
 * The dashboard ('/') has no single accent — its widgets each use THEIR source
 * page's color — so it is mapped to neutral green as a sensible default.
 */

export interface PageAccent {
  /** Human-readable color name. */
  name: string
  /** Raw hex (for inline styles, SVG/canvas charts). */
  hex: string
  /** Tailwind/CSS token suffix, e.g. 'cyan' → text-acc-cyan / var(--acc-cyan). */
  token: string
}

/** Route path (relative, no leading slash except '/') -> accent. */
export const PAGE_ACCENTS: Record<string, PageAccent> = {
  '/':           { name: 'neutral', hex: '#4cc38a', token: 'green'  },
  'devices':     { name: 'green',   hex: '#4cc38a', token: 'green'  },
  'usage':       { name: 'cyan',    hex: '#58b2c9', token: 'cyan'   },
  'top-sites':   { name: 'blue',    hex: '#5b8def', token: 'blue'   },
  'schedules':   { name: 'amber',   hex: '#d6a13a', token: 'amber'  },
  'alerts':      { name: 'orange',  hex: '#e08c4e', token: 'orange' },
  'threats':     { name: 'red',     hex: '#e0604e', token: 'red'    },
  'groups':      { name: 'violet',  hex: '#a98bdb', token: 'violet' },
  'reports':     { name: 'sand',    hex: '#c9a26b', token: 'sand'   },
}

const DEFAULT_ACCENT: PageAccent = PAGE_ACCENTS['/']

/**
 * Resolve a route/path to its accent. Tolerant of leading slashes and full
 * paths (e.g. '/devices', 'devices', '/devices/42' all resolve to devices).
 */
export function getPageAccent(path: string | undefined | null): PageAccent {
  if (!path) return DEFAULT_ACCENT
  if (path === '/') return PAGE_ACCENTS['/']
  const seg = path.replace(/^\/+/, '').split('/')[0]
  return PAGE_ACCENTS[seg] ?? DEFAULT_ACCENT
}

export default PAGE_ACCENTS
