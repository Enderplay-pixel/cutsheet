import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'
import defaultColors from 'tailwindcss/colors'

// ── Gedämpfte Palette ────────────────────────────────────────────────
// Rund 600 Stellen im Code nutzen Tailwind-Farben direkt (amber-400,
// blue-500/20 …). Statt jede einzeln anzufassen, wird die Palette hier
// zentral entsättigt und leicht angewärmt. So passen Status-Tags,
// Diagramme und Streifen zur warmen Monochrom-Basis, ohne ihre
// Bedeutung (rot = Problem, grün = erledigt) zu verlieren.
type Scale = Record<string, string>

function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s * 100, l * 100]
}

function soften(scale: Scale, satFactor: number): Scale {
  const out: Scale = {}
  for (const [k, v] of Object.entries(scale)) {
    if (typeof v !== 'string' || !v.startsWith('#')) continue
    const [h, s, l] = hexToHsl(v)
    out[k] = `hsl(${h.toFixed(1)} ${(s * satFactor).toFixed(1)}% ${l.toFixed(1)}%)`
  }
  return out
}

// Ein einziges, warmes Grau statt vier kalter Graufamilien
const warmGray = soften(defaultColors.stone as Scale, 0.9)
const HUES = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan',
  'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'] as const
const softened = Object.fromEntries(HUES.map(h => [h, soften(defaultColors[h] as Scale, 0.55)]))

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        ...softened,
        gray: warmGray, zinc: warmGray, slate: warmGray, neutral: warmGray, stone: warmGray,
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        canvas: 'hsl(var(--canvas))',
        signal: {
          DEFAULT: 'hsl(var(--signal))',
          foreground: 'hsl(var(--signal-foreground))',
          soft: 'hsl(var(--signal-soft))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        danger: {
          DEFAULT: 'hsl(var(--danger))',
          foreground: 'hsl(var(--danger-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        // Knapp statt weich: innen enger, Container etwas runder
        sm: '4px',
        md: '6px',
        lg: 'var(--radius)',
        xl: '10px',
        '2xl': '12px',
        '3xl': '14px',
      },
      boxShadow: {
        // Kaum sichtbar, warm getönt, eine Lichtrichtung (von oben)
        sm: '0 1px 2px hsl(var(--shadow) / 0.05)',
        DEFAULT: '0 1px 3px hsl(var(--shadow) / 0.06)',
        md: '0 2px 8px hsl(var(--shadow) / 0.06)',
        lg: '0 8px 24px -4px hsl(var(--shadow) / 0.08)',
        xl: '0 16px 40px -8px hsl(var(--shadow) / 0.12)',
        '2xl': '0 24px 64px -12px hsl(var(--shadow) / 0.2)',
      },
      fontFamily: {
        sans: ['"Geist Variable"', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono Variable"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [animate],
} satisfies Config
