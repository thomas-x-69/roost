/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Make monospace the default app font; keep `font-mono` explicit too.
        sans: [
          "'JetBrains Mono'", "'IBM Plex Mono'", "ui-monospace", "SFMono-Regular",
          "'SF Mono'", "Menlo", "Consolas", "'Liberation Mono'", "monospace",
        ],
        mono: [
          "'JetBrains Mono'", "'IBM Plex Mono'", "ui-monospace", "SFMono-Regular",
          "'SF Mono'", "Menlo", "Consolas", "'Liberation Mono'", "monospace",
        ],
      },
      colors: {
        // "Clean Terminal" palette (mirrors CSS variables in index.css)
        term: {
          bg: '#0b0e10',
          'bg-2': '#12171a',
          'bg-3': '#181f23',
          fg: '#e6edf1',
          green: '#4cc38a',
          amber: '#d6a13a',
          dim: '#8b969c',          // readable muted TEXT (text-term-dim)
          border: '#222b30',
          'border-strong': '#2f3a40',
          'text-dim': '#93a4ac',
          faint: '#5a666d',
          accent: '#58b2c9',
          danger: '#e0604e',
        },
        // Per-page accent colors (muted/refined — no neon, no gradients).
        // Use as text-acc-cyan, border-acc-blue, bg-acc-amber/10, etc.
        acc: {
          green:  '#4cc38a',   // devices
          cyan:   '#58b2c9',   // usage
          blue:   '#5b8def',   // top-sites
          amber:  '#d6a13a',   // schedules
          orange: '#e08c4e',   // alerts
          red:    '#e0604e',   // threats
          violet: '#a98bdb',   // groups
          sand:   '#c9a26b',   // reports
        },
        // Legacy brand colors (kept for compatibility)
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
      },
      keyframes: {
        blink: {
          '0%, 49%': { opacity: '1' },
          '50%, 100%': { opacity: '0' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '92%': { opacity: '1' },
          '93%': { opacity: '0.7' },
          '94%': { opacity: '1' },
          '97%': { opacity: '0.85' },
          '98%': { opacity: '1' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      animation: {
        blink: 'blink 1s steps(2, start) infinite',
        flicker: 'flicker 4s infinite steps(60)',
        scan: 'scan 6s linear infinite',
      },
    },
  },
  plugins: [],
}
