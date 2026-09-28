import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

// ── Abgestimmte Palette ──────────────────────────────────────────────
// Rund 550 Stellen im Code nutzen Tailwind-Farben direkt (amber-400,
// blue-500/20 …). Statt der knalligen Standardskalen erzeugen wir hier
// jede Farbfamilie neu in OKLCH: gleiche Helligkeitsstufen für alle
// Farbtöne, gedämpfte Sättigung, und ein einziges warmes Grau passend zu
// den Negativ-Grautönen von „Tungsten“. So wirkt jede Stelle wie aus
// einem Guss, ohne dass ihre Bedeutung (rot = Problem, grün = erledigt)
// verloren geht. Details: docs/designphilosophie.md
type Scale = Record<string, string>

const STUFEN: [string, number, number][] = [
  // Stufe, OKLCH-Helligkeit, Anteil der vollen Sättigung
  ['50', 0.975, 0.14], ['100', 0.948, 0.26], ['200', 0.9, 0.46], ['300', 0.83, 0.7],
  ['400', 0.735, 0.9], ['500', 0.645, 1], ['600', 0.55, 1], ['700', 0.475, 0.92],
  ['800', 0.395, 0.78], ['900', 0.325, 0.62], ['950', 0.245, 0.48],
]

function oklchHex(L: number, C: number, h: number): string {
  // Chroma so weit senken, bis die Farbe im sRGB-Raum liegt
  for (let c = C; c >= 0; c -= 0.004) {
    const a = c * Math.cos((h * Math.PI) / 180), b = c * Math.sin((h * Math.PI) / 180)
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
    const rgb = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ]
    if (rgb.every(v => v >= -0.0005 && v <= 1.0005)) {
      return '#' + rgb.map(v => {
        v = Math.min(1, Math.max(0, v))
        v = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055
        return Math.round(v * 255).toString(16).padStart(2, '0')
      }).join('')
    }
  }
  return '#808080'
}

const skala = (h: number, chroma: number): Scale =>
  Object.fromEntries(STUFEN.map(([k, L, f]) => [k, oklchHex(L, chroma * f, h)]))

// OKLCH-Farbton und größte Sättigung je Familie
const FAMILIEN: Record<string, [number, number]> = {
  red: [22, 0.15], rose: [12, 0.145], pink: [355, 0.13], fuchsia: [330, 0.12],
  purple: [308, 0.12], violet: [292, 0.12], indigo: [272, 0.12], blue: [252, 0.13],
  sky: [236, 0.11], cyan: [218, 0.1], teal: [192, 0.095], emerald: [165, 0.12],
  green: [150, 0.13], lime: [128, 0.13], yellow: [92, 0.13], amber: [74, 0.14],
  orange: [48, 0.16],
}
const familien = Object.fromEntries(Object.entries(FAMILIEN).map(([n, [h, c]]) => [n, skala(h, c)]))

// Ein einziges warmes Grau statt fünf Graufamilien
const warmGrau: Scale = Object.fromEntries(STUFEN.map(([k, L]) => [k, oklchHex(L, L > 0.85 ? 0.006 : 0.009, 60)]))

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
        ...familien,
        gray: warmGrau, zinc: warmGrau, slate: warmGrau, neutral: warmGrau, stone: warmGrau,
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
        // Zahlen, Zeiten und Codes stehen in der Systemschrift mit Tabellenziffern
        // (siehe .font-mono in index.css) statt in einer Monospace-Schrift - so
        // macht es Apple in Numbers, Kalender und Uhr. Echte Schreibmaschine gibt
        // es nur im Drehbuch (font-script).
        mono: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Geist Variable"', 'system-ui', 'sans-serif'],
        script: ['"Courier Prime"', '"Courier New"', 'Courier', 'monospace'],
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
