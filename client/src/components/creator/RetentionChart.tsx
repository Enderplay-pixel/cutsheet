import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

interface Point { ratio: number; watch: number }
interface Section {
  id?: number
  kind: string
  heading?: string
  startSeconds: number
  endSeconds: number
  watchStart: number | null
  dropPerMinute: number | null
}

const KIND_FILL: Record<string, string> = {
  hook: 'fill-red-500/10',
  intro: 'fill-blue-500/10',
  sponsor: 'fill-amber-500/15',
  segment: 'fill-transparent',
  broll: 'fill-violet-500/10',
  cta: 'fill-cyan-500/10',
  outro: 'fill-emerald-500/10',
}

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0
}

/**
 * Zuschaueranteil an einer Position im Video, linear zwischen den Stuetzpunkten.
 * Bewusst herausgezogen: als reine Funktion laesst sie sich pruefen, ohne die
 * Kurve tatsaechlich zeichnen zu muessen.
 */
export function watchAtRatio(curve: Point[], ratio: number): number {
  if (curve.length === 0) return 0
  const r = clamp01(ratio)
  if (r <= curve[0].ratio) return curve[0].watch

  for (let i = 1; i < curve.length; i++) {
    if (r <= curve[i].ratio) {
      const a = curve[i - 1]
      const b = curve[i]
      const span = b.ratio - a.ratio
      return span > 0 ? a.watch + (b.watch - a.watch) * ((r - a.ratio) / span) : b.watch
    }
  }
  return curve[curve.length - 1].watch
}

function timecode(total: number): string {
  const s = Math.max(0, Math.floor(total || 0))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Retention-Kurve mit den Skript-Abschnitten als Hintergrundbänder.
 *
 * Die Liste darunter sagt, *wie viel* ein Abschnitt kostet. Die Kurve zeigt,
 * *wo* der Absprung passiert — ob gleichmäßig über den Abschnitt oder als Kante
 * an einer bestimmten Sekunde. Das unterscheidet "der Teil ist zu lang" von
 * "an dieser Stelle steigen sie aus", und das sieht man nur im Verlauf.
 *
 * Bewusst als reines SVG ohne Diagrammbibliothek: eine Kurve mit Bändern
 * rechtfertigt keine zusätzliche Abhängigkeit im Bundle.
 */
export function RetentionChart({
  curve,
  sections,
  videoSeconds,
}: {
  curve: Point[]
  sections: Section[]
  videoSeconds: number
}) {
  const [hover, setHover] = useState<{ x: number; second: number; watch: number } | null>(null)

  const W = 1000
  const H = 260
  const PAD = { top: 12, right: 12, bottom: 26, left: 34 }

  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const x = (ratio: number) => PAD.left + ratio * plotW
  const y = (watch: number) => PAD.top + (1 - Math.min(1, Math.max(0, watch))) * plotH

  const path = useMemo(() => {
    if (curve.length === 0) return ''
    return curve.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.ratio).toFixed(1)} ${y(p.watch).toFixed(1)}`).join(' ')
  }, [curve])

  const area = useMemo(() => {
    if (curve.length === 0) return ''
    const first = curve[0]
    const last = curve[curve.length - 1]
    return `${path} L ${x(last.ratio).toFixed(1)} ${y(0).toFixed(1)} L ${x(first.ratio).toFixed(1)} ${y(0).toFixed(1)} Z`
  }, [path, curve])

  if (curve.length === 0 || videoSeconds <= 0) return null

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    // Ohne gerenderte Breite waere die Umrechnung eine Division durch null und
    // ergaebe NaN — dann lieber gar keinen Wert anzeigen
    if (rect.width <= 0) return

    // Auf das viewBox-Koordinatensystem umrechnen, damit es bei jeder Breite stimmt
    const svgX = ((e.clientX - rect.left) / rect.width) * W
    const ratio = clamp01((svgX - PAD.left) / plotW)
    setHover({ x: ratio, second: ratio * videoSeconds, watch: watchAtRatio(curve, ratio) })
  }

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto select-none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* Abschnitte als Bänder hinter der Kurve */}
        {sections.map((s, i) => {
          const x1 = x(Math.min(1, s.startSeconds / videoSeconds))
          const x2 = x(Math.min(1, s.endSeconds / videoSeconds))
          if (x2 <= x1) return null
          return (
            <g key={s.id ?? i}>
              <rect
                x={x1} y={PAD.top} width={x2 - x1} height={plotH}
                className={KIND_FILL[s.kind] ?? 'fill-transparent'}
              />
              <line
                x1={x1} y1={PAD.top} x2={x1} y2={PAD.top + plotH}
                className="stroke-border" strokeWidth="1" strokeDasharray="3 3"
              />
            </g>
          )
        })}

        {/* Hilfslinien bei 25, 50, 75 und 100 Prozent */}
        {[0, 0.25, 0.5, 0.75, 1].map(v => (
          <g key={v}>
            <line
              x1={PAD.left} y1={y(v)} x2={PAD.left + plotW} y2={y(v)}
              className={cn('stroke-border', v === 0.5 && 'stroke-border')}
              strokeWidth="1" opacity={v === 0 || v === 1 ? 0.6 : 0.3}
            />
            <text x={PAD.left - 6} y={y(v) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">
              {Math.round(v * 100)}
            </text>
          </g>
        ))}

        <path d={area} className="fill-primary/15" />
        <path d={path} className="stroke-primary fill-none" strokeWidth="2" strokeLinejoin="round" />

        {/* Zeitachse */}
        {[0, 0.25, 0.5, 0.75, 1].map(v => (
          <text key={v} x={x(v)} y={H - 8} textAnchor={v === 0 ? 'start' : v === 1 ? 'end' : 'middle'}
            className="fill-muted-foreground text-[10px]">
            {timecode(v * videoSeconds)}
          </text>
        ))}

        {hover && (
          <g>
            <line
              x1={x(hover.x)} y1={PAD.top} x2={x(hover.x)} y2={PAD.top + plotH}
              className="stroke-foreground" strokeWidth="1" opacity="0.5"
            />
            <circle cx={x(hover.x)} cy={y(hover.watch)} r="4" className="fill-primary" />
          </g>
        )}
      </svg>

      <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground min-h-[18px]">
        <span>
          {hover
            ? `Bei ${timecode(hover.second)} schauen noch ${Math.round(hover.watch * 100)} %`
            : 'Mit der Maus über die Kurve fahren für Werte'}
        </span>
        <span className="flex items-center gap-3">
          {sections.some(s => s.kind === 'sponsor') && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-500/40" />Sponsor
            </span>
          )}
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-500/30" />Hook
          </span>
        </span>
      </div>
    </div>
  )
}
