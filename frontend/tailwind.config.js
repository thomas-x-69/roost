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
        // Phosphor terminal palette (mirrors CSS variables in index.css)
        term: {
          bg: '#0a0e0a',
          'bg-2': '#0e140e',
          fg: '#c8f7c5',
          green: '#33ff66',
          amber: '#ffb000',
          dim: '#4a6a4f',
          accent: '#00e0ff',
          danger: '#ff5f56',
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
