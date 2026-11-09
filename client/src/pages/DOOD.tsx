import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { Download, Users, CalendarDays, AlertCircle } from 'lucide-react'
import { useT, useGebietsschema } from '@/lib/useT'
import type { Lang } from '@/lib/i18n'
import { doodT as T } from '@/lib/texte/DOOD'
import { csvHerunterladen, betragCsv } from '@/lib/csv'
import { parseISO } from 'date-fns'
import { useSchreibrecht } from '@/lib/useSchreibrecht'

type Tt = (map: Record<Lang, string>) => string

// ─── Types ───────────────────────────────────────────────────────────────────

interface DoodDay {
  shoot_day_id: number
  day_number: number
  date: string
}

interface DoodEntry {
  status: string // W | H | SW | F | SWF | ''
}

interface DoodCastRow {
  cast_id: number
  name: string
  character: string
  daily_rate_cents: number
  days: Record<number, DoodEntry> // keyed by shoot_day_id
  total_work: number
  total_hold: number
  estimated_cost_cents: number
}

interface DoodReport {
  shoot_days: DoodDay[]
  cast: DoodCastRow[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Codes wie sie der Server liefert (routes/dood.ts). F steht dort fuer den
// letzten Arbeitstag und zaehlt als Arbeitstag - die alte Legende nannte ihn
// "Frei" und faerbte ihn grau wie einen leeren Tag - beides behauptete das
// Gegenteil.
const STATUS_CONFIG: Record<string, { label: Record<Lang, string>; bg: string; text: string; border: string }> = {
  W:   { label: T.arbeit,             bg: 'bg-green-500/20',  text: 'text-green-700 dark:text-green-300',   border: 'border-green-500/30' },
  H:   { label: T.haltetag,           bg: 'bg-amber-400/20',  text: 'text-amber-700 dark:text-amber-300',   border: 'border-amber-400/30' },
  SW:  { label: T.ersterArbeitstag,  bg: 'bg-blue-500/20',   text: 'text-blue-700 dark:text-blue-300',     border: 'border-blue-500/30' },
  F:   { label: T.letzterArbeitstag, bg: 'bg-cyan-500/20',   text: 'text-cyan-700 dark:text-cyan-300',     border: 'border-cyan-500/30' },
  SWF: { label: T.einzigerArbeitstag, bg: 'bg-purple-500/20', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-500/30' },
}

function statusCell(status: string) {
  const cfg = STATUS_CONFIG[status]
  if (!cfg) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground/30">
        -
      </div>
    )
  }
  return (
    <div className={`w-full h-full flex items-center justify-center text-[11px] font-bold rounded-md border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {status}
    </div>
  )
}

function formatDate(iso: string, gebietsschema: string) {
  if (!iso) return ''
  const d = parseISO(iso)
  return d.toLocaleDateString(gebietsschema, { day: '2-digit', month: '2-digit' })
}

/**
 * Deckender Hintergrund für die feste Namensspalte im Farbton der Zeile. Vorher
 * `bg-inherit` auf durchsichtigen Zeilen: Beim Waagerecht-Scrollen lagen die
 * Tageszellen ("SW", "W") über den Namen (gemessen am 31.10.2026).
 */
const deckend = (tönung: number) => ({
  background: `linear-gradient(hsl(var(--muted) / ${tönung}), hsl(var(--muted) / ${tönung})), hsl(var(--card))`,
})

function formatCurrency(cents: number, gebietsschema: string) {
  return (cents / 100).toLocaleString(gebietsschema, { style: 'currency', currency: 'EUR' })
}

function downloadCSV(report: DoodReport, pid: number, tt: Tt, gebietsschema: string, mitKosten: boolean) {
  const days = report.shoot_days
  const header = [tt(T.name), tt(T.figur), ...days.map(d => `${tt(T.dt).replace('{n}', String(d.day_number))} (${formatDate(d.date, gebietsschema)})`), tt(T.arbeitstage), tt(T.haltetage), ...(mitKosten ? [tt(T.kosten)] : [])]
  const rows = report.cast.map(c => [
    c.name,
    c.character,
    ...days.map(d => c.days[d.shoot_day_id]?.status ?? ''),
    String(c.total_work),
    String(c.total_hold),
    // Wie alle CSV-Ausfuhren (Fund 180): Zahl mit Komma, ohne Währungszeichen.
    // Kosten sind Gagen mal Tage - nur für die Produktion (lib/useSchreibrecht.ts).
    ...(mitKosten ? [betragCsv(c.estimated_cost_cents)] : []),
  ])
  csvHerunterladen(tt(T.dateiname).replace('{n}', String(pid)), header, rows)
}

// ─── Component ───────────────────────────────────────────────────────────────

export function Component() {
  const { projectId: id } = useParams<{ projectId: string }>()
  const pid = Number(id)
  const { toast } = useToast()
  const tt = useT()
  const gebietsschema = useGebietsschema()
  const { siehtGagen } = useSchreibrecht()

  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const { data: report, isLoading, isError } = useQuery<DoodReport>({
    queryKey: ['dood-report', pid],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${pid}/dood-report`, { headers })
      if (!res.ok) throw new Error(tt(T.fehlerLaden))
      const data = (await res.json()).data
      return {
        shoot_days: data.shoot_days.map((day: any) => ({ ...day, shoot_day_id: day.id })),
        cast: data.cast.map((actor: any) => ({
          cast_id: actor.id,
          name: actor.actor_name || tt(T.nichtBesetzt),
          character: actor.character_name || '',
          daily_rate_cents: Number(actor.fee_per_day) || 0,
          days: Object.fromEntries(data.shoot_days.map((day: any, index: number) => [
            day.id, { status: actor.days[index]?.code || '' },
          ])),
          total_work: Number(actor.total_work_days) || 0,
          total_hold: Number(actor.total_hold_days) || 0,
          estimated_cost_cents: Number(actor.total_cost_cents) || 0,
        })),
      }
    },
  })

  if (isLoading) {
    return (
      <div className="p-4 sm:p-7 max-w-6xl mx-auto animate-fade-up">
        <div className="mb-8 pb-7 border-b border-border/40">
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    )
  }

  if (isError || !report) {
    return (
      <div className="p-4 sm:p-7 max-w-6xl mx-auto animate-fade-up">
        <div className="mb-8 pb-7 border-b border-border/40">
          <h1 className="font-display text-[28px] sm:text-[34px]">{tt(T.titel)}</h1>
        </div>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
            <AlertCircle className="w-4 h-4 text-destructive" />
          </div>
          <p className="text-sm text-destructive">{tt(T.fehlerBericht)}</p>
        </div>
      </div>
    )
  }

  const days = report.shoot_days ?? []
  const cast = report.cast ?? []
  const totalWork = cast.reduce((sum, c) => sum + c.total_work, 0)
  const totalHold = cast.reduce((sum, c) => sum + c.total_hold, 0)
  const totalCost = cast.reduce((sum, c) => sum + c.estimated_cost_cents, 0)

  return (
    <div className="p-4 sm:p-7 max-w-6xl mx-auto animate-fade-up">
      {/* Page hero */}
      <div className="mb-8 pb-7 border-b border-border/40">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-[28px] sm:text-[34px]">{tt(T.titel)}</h1>
            <p className="text-sm text-muted-foreground/60 mt-1.5">
              {tt(T.untertitel)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="flex items-center gap-5">
              <div className="text-right">
                <div className="text-[2.25rem] font-bold tabular-nums tracking-tight leading-none">{cast.length}</div>
                <div className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40 mt-1">{tt(T.darsteller)}</div>
              </div>
              <div className="text-right">
                <div className="text-[2.25rem] font-bold tabular-nums tracking-tight leading-none">{days.length}</div>
                <div className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40 mt-1">{tt(T.drehtage)}</div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadCSV(report, pid, tt, gebietsschema, siehtGagen)}
              className="active:scale-[0.97] ml-4"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {tt(T.csvExportieren)}
            </Button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div data-einfuehrung="legende" className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40 mb-3">{tt(T.legende)}</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(STATUS_CONFIG).map(([k, cfg]) => (
            <span
              key={k}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${cfg.bg} ${cfg.text} ${cfg.border}`}
            >
              <span className="font-bold">{k}</span>
              <span className="font-normal opacity-70">= {tt(cfg.label)}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Main table */}
      {cast.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card flex flex-col items-center justify-center py-16">
          <Users className="w-10 h-10 opacity-20 mb-3" />
          <p className="text-sm text-muted-foreground/60">{tt(T.keineDarsteller)}</p>
        </div>
      ) : (
        <div data-einfuehrung="raster" className="rounded-xl border border-border/60 bg-card overflow-x-auto mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/40">
                  <th style={deckend(0.3)} className="sticky left-0 z-10 px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground min-w-[180px] border-r border-border/30">
                    {tt(T.darsteller)}
                  </th>
                  {days.map(d => (
                    <th key={d.shoot_day_id} className="px-1.5 py-3 text-center bg-muted/30 min-w-[52px]">
                      <div className="text-[11px] font-bold tabular-nums text-muted-foreground">{tt(T.dt).replace('{n}', String(d.day_number))}</div>
                      <div className="text-[9px] text-muted-foreground/50 font-semibold uppercase tracking-[0.05em] mt-0.5 tabular-nums">
                        {formatDate(d.date, gebietsschema)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cast.map((c, i) => (
                  <tr
                    key={c.cast_id}
                    className={`border-b border-border/30 transition-colors hover:bg-muted/20 ${i % 2 === 1 ? 'bg-muted/10' : ''}`}
                  >
                    <td style={deckend(i % 2 === 1 ? 0.1 : 0)} className="sticky left-0 z-10 px-5 py-2 border-r border-border/30">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-muted/60 flex items-center justify-center text-[10px] font-bold text-muted-foreground/70 shrink-0">
                          {c.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium leading-snug truncate">{c.name}</div>
                          {c.character && (
                            <div className="text-[10px] text-muted-foreground/50 truncate">{c.character}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    {days.map(d => {
                      const status = c.days[d.shoot_day_id]?.status ?? ''
                      return (
                        <td key={d.shoot_day_id} className="p-1 text-center">
                          <div className="h-8 w-full">{statusCell(status)}</div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary section */}
      {cast.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40 mb-3">{tt(T.zusammenfassung)}</p>
          <div className="rounded-xl border border-border/60 bg-card overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground bg-muted/30">
                    {tt(T.darsteller)}
                  </th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground bg-muted/30">
                    {tt(T.arbeitstage)}
                  </th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground bg-muted/30">
                    {tt(T.haltetage)}
                  </th>
                  {siehtGagen && (
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground bg-muted/30">
                    {tt(T.kosten)}
                  </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {cast.map((c, i) => (
                  <tr
                    key={c.cast_id}
                    className={`border-b border-border/30 transition-colors hover:bg-muted/20 ${i % 2 === 1 ? 'bg-muted/10' : ''}`}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-muted/60 flex items-center justify-center text-[10px] font-bold text-muted-foreground/70 shrink-0">
                          {c.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium">{c.name}</div>
                          {c.character && (
                            <div className="text-[10px] text-muted-foreground/50">{c.character}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center min-w-[28px] h-6 rounded-md bg-green-500/15 text-green-700 dark:text-green-300 border border-green-500/25 text-xs font-bold tabular-nums px-1.5">
                        {c.total_work}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center min-w-[28px] h-6 rounded-md bg-amber-400/15 text-amber-700 dark:text-amber-300 border border-amber-400/25 text-xs font-bold tabular-nums px-1.5">
                        {c.total_hold}
                      </span>
                    </td>
                    {siehtGagen && (
                    <td className="px-5 py-3 text-right font-mono text-sm tabular-nums">
                      {formatCurrency(c.estimated_cost_cents, gebietsschema)}
                    </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {/* Totals footer */}
              <tfoot>
                <tr className="border-t border-border/40 bg-muted/20">
                  <td className="px-5 py-3 text-xs font-bold uppercase tracking-[0.06em] text-muted-foreground/50">
                    {tt(T.gesamt)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center min-w-[28px] h-6 rounded-md bg-green-500/15 text-green-700 dark:text-green-300 border border-green-500/25 text-xs font-bold tabular-nums px-1.5">
                      {totalWork}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center min-w-[28px] h-6 rounded-md bg-amber-400/15 text-amber-700 dark:text-amber-300 border border-amber-400/25 text-xs font-bold tabular-nums px-1.5">
                      {totalHold}
                    </span>
                  </td>
                  {siehtGagen && (
                  <td className="px-5 py-3 text-right font-mono text-sm font-bold tabular-nums">
                    {formatCurrency(totalCost, gebietsschema)}
                  </td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
