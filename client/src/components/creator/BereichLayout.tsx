import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Gemeinsame Hülle der Creator-Bereiche.
 *
 * Neun Seiten zeigen dieselbe Form: Kopf mit Symbol, eine Reihe Kennzahlen,
 * dann eine Tabelle. Ohne gemeinsames Gerüst driften sie auseinander - und
 * genau das unterscheidet eine Anwendung von einer Sammlung von Seiten.
 */

export type Kennzahl = {
  label: string
  wert: string | number | null
  /** Hebt die Zahl hervor, wenn sie ein Problem beschreibt. */
  warnung?: boolean
  hinweis?: string
}

export function BereichKopf({ symbol: Symbol, titel, untertitel, aktionen }: {
  symbol: any
  titel: string
  untertitel?: string
  aktionen?: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="w-9 h-9 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
        <Symbol className="w-[17px] h-[17px] text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-bold tracking-tight leading-none">{titel}</h1>
        {untertitel && (
          <p className="text-[12px] text-muted-foreground mt-1 leading-snug">{untertitel}</p>
        )}
      </div>
      {aktionen && <div className="flex items-center gap-2 flex-wrap shrink-0">{aktionen}</div>}
    </div>
  )
}

export function Kennzahlen({ werte }: { werte: Kennzahl[] }) {
  if (!werte.length) return null
  return (
    <div className={cn(
      'grid gap-3 mb-7 stagger-sm grid-cols-2',
      werte.length >= 4 ? 'lg:grid-cols-4' : 'sm:grid-cols-3'
    )}>
      {werte.map(k => (
        <div key={k.label} className={cn('stat-card', k.warnung && k.wert ? 'border-danger/30' : undefined)}>
          <p className="section-label mb-2">{k.label}</p>
          <p className={cn(
            'text-2xl font-bold tabular-nums tracking-tight',
            k.warnung && k.wert ? 'text-danger' : undefined
          )}>
            {/* Ein nicht erhobener Wert ist ein Strich, keine Null - sonst
                behauptet die Kennzahl etwas, das nie gemessen wurde. */}
            {k.wert === null || k.wert === undefined || k.wert === '' ? '—' : k.wert}
          </p>
          {k.hinweis && <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">{k.hinweis}</p>}
        </div>
      ))}
    </div>
  )
}

export function BereichLaden() {
  return (
    <div className="page-container space-y-4">
      <Skeleton className="h-12 w-64 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}

export function NichtsDa({ symbol: Symbol, titel, text, aktion }: {
  symbol: any
  titel: string
  text: string
  aktion?: React.ReactNode
}) {
  return (
    <div className="border border-dashed border-border rounded-xl py-14 px-6 text-center">
      <Symbol className="w-7 h-7 mx-auto text-muted-foreground/40" />
      <p className="mt-3 font-semibold text-sm">{titel}</p>
      <p className="mt-1 text-[13px] text-muted-foreground max-w-md mx-auto leading-relaxed">{text}</p>
      {aktion && <div className="mt-4">{aktion}</div>}
    </div>
  )
}

/** Verweis auf ein Video. Jede Zeile eines Bereichs soll dorthin führen,
 *  wo sich der Wert auch ändern lässt. */
export function VideoLink({ projectId, videoId, children }: {
  projectId: number
  videoId: number | string
  children: React.ReactNode
}) {
  return (
    <Link
      to={`/projects/${projectId}/creator/${videoId}`}
      className="font-medium hover:text-primary transition-colors underline-offset-4 hover:underline"
    >
      {children}
    </Link>
  )
}

/** Kleines farbiges Etikett für Status, Plattform, Risiko. */
export function Marke({ text, ton = 'neutral' }: {
  text: string
  ton?: 'neutral' | 'gut' | 'warnung' | 'gefahr'
}) {
  if (!text) return null
  return (
    <span className={cn(
      'inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap',
      ton === 'gut' && 'bg-success/10 text-success',
      ton === 'warnung' && 'bg-warning/10 text-warning',
      ton === 'gefahr' && 'bg-danger/10 text-danger',
      ton === 'neutral' && 'bg-muted text-muted-foreground',
    )}>
      {text}
    </span>
  )
}

/** Tabelle mit waagerechtem Scrollen in der eigenen Karte statt auf der
 *  ganzen Seite - sonst laeuft am Telefon das Layout ueber. */
export function BereichTabelle({ kopf, minBreite = 560, children }: {
  kopf: React.ReactNode
  minBreite?: number
  children: React.ReactNode
}) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table" style={{ minWidth: `${minBreite}px` }}>
        <thead>{kopf}</thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}
