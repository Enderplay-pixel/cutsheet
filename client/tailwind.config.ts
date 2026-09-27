import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'
import defaultColors from 'tailwindcss/colors'

// ── Gedämpfte Palette ────────────────────────────────────────────────
// Rund 600 Stellen im Code nutzen Tailwind-Farben direkt (amber-400,
// blue-500/20 …). Statt jede einzeln anzufassen, wird die Palette hier
// zentral etwas zurückgenommen. So passen Status-Tags, Diagramme und
// Streifen zur neutralen Basis, ohne ihre Bedeutung (rot = Problem,
// grün = erledigt) zu verlieren.
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

// Ein einziges, neutrales Grau statt fünf Graufamilien
const neutralGray = soften(defaultColors.zinc as Scale, 1)
const HUES = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan',
  'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'] as const
const softened = Object.fromEntries(HUES.map(h => [h, soften(defaultColors[h] as Scale, 0.92)]))

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
        gray: neutralGray, zinc: neutralGray, slate: neutralGray, neutral: neutralGray, stone: neutralGray,
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
        sm: '6px',
        md: '8px',
        lg: 'var(--radius)',
        xl: '14px',
        '2xl': '18px',
        '3xl': '22px',
      },
      boxShadow: {
        // Kaum sichtbar, warm getönt, eine Lichtrichtung (von oben)
        sm: '0 1px 2px hsl(var(--shadow) / 0.04)',
        DEFAULT: '0 1px 3px hsl(var(--shadow) / 0.06), 0 1px 2px hsl(var(--shadow) / 0.04)',
        md: '0 4px 12px -2px hsl(var(--shadow) / 0.08), 0 1px 3px hsl(var(--shadow) / 0.05)',
        lg: '0 12px 32px -8px hsl(var(--shadow) / 0.14), 0 2px 6px hsl(var(--shadow) / 0.05)',
        xl: '0 20px 48px -12px hsl(var(--shadow) / 0.2), 0 4px 10px hsl(var(--shadow) / 0.06)',
        '2xl': '0 32px 80px -16px hsl(var(--shadow) / 0.35)',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Geist Variable"', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', '"SF Mono"', '"Geist Mono Variable"', 'SFMono-Regular', 'monospace'],
        display: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Geist Variable"', 'system-ui', 'sans-serif'],
      },
      transitionTimingFunction: {
        // Federnd wie UIKit-Buttons, und Apples Kurve fuer Sheets/Dialoge
        spring: 'cubic-bezier(0.34, 1.4, 0.64, 1)',
        sheet: 'cubic-bezier(0.32, 0.72, 0, 1)',
        smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
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
