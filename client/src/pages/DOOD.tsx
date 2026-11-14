import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Download, Users, AlertCircle, Info } from 'lucide-react'
import { useT, useGebietsschema } from '@/lib/useT'
import type { Lang } from '@/lib/i18n'
import { doodT as T } from '@/lib/texte/DOOD'
import { csvHerunterladen, betragCsv } from '@/lib/csv'
import { parseISO } from 'date-fns'
import { useSchreibrecht } from '@/lib/useSchreibrecht'

type Tt = (map: Record<Lang, string>) => string

// ─── Typen ───────────────────────────────────────────────────────────────────
//
// Der Bericht kommt aus server/src/lib/dood.ts. Spalten sind Kalendertage
// (seit 13.11.2026), damit freie Tage, Reise- und Probetage einen Platz haben;
// Drehtage ohne Datum stehen am Ende.

interface Spalte {
  datum: string
  day_number: number | null
  frei: boolean
  status: string
}

interface Zeile {
  id: number
  actor_name: string
  character_name: string
  days: Array<{ code: string; frei: boolean }>
  total_work_days: number
  total_worked_days: number
  total_hold_days: number
  total_travel_days: number
  total_cost_cents: number | null
}

interface Bericht {
  spalten: Spalte[]
  cast: Zeile[]
}

// ─── Kürzel ──────────────────────────────────────────────────────────────────
//
// Wie in der Branchensoftware (Movie Magic Scheduling, DOOD Rules). Bis zum
// 13.11.2026 hieß der letzte Arbeitstag F, und jeder Tag zwischen erstem und
// letztem Einsatz war ein Halt - auch ein Sperrtag.

type Stil = { label: Record<Lang, string>; farbe: string }
const GRUEN = 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30'
const KUERZEL: Record<string, Stil> = {
  SW:  { label: T.ersterArbeitstag,   farbe: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30' },
  W:   { label: T.arbeit,             farbe: GRUEN },
  WF:  { label: T.letzterArbeitstag,  farbe: 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/30' },
  SWF: { label: T.einzigerArbeitstag, farbe: 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30' },
  H:   { label: T.haltetag,           farbe: 'bg-amber-400/20 text-amber-700 dark:text-amber-300 border-amber-400/30' },
  SWD: { label: T.ersterDrop,         farbe: GRUEN },
  WD:  { label: T.arbeitDrop,         farbe: GRUEN },
  PW:  { label: T.pickup,             farbe: GRUEN },
  PWF: { label: T.pickupLetzter,      farbe: GRUEN },
  TR:  { label: T.reise,              farbe: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30' },
  R:   { label: T.probe,              farbe: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30' },
  FT:  { label: T.anprobe,            farbe: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30' },
}

function zelle(code: string, frei: boolean) {
  const stil = KUERZEL[code]
  if (!stil) {
    return <div className={`w-full h-full rounded-md ${frei ? 'bg-muted/50' : ''}`} aria-hidden="true" />
  }
  return (
    <div className={`w-full h-full flex items-center justify-center text-[11px] font-bold rounded-md border ${stil.farbe}`}>
      {code}
    </div>
  )
}

function kopf(s: Spalte, tt: Tt, gebietsschema: string) {
  const tag = s.day_number != null && !s.frei ? tt(T.dt).replace('{n}', String(s.day_number)) : ''
  if (!s.datum) return { tag, wochentag: '', datum: '' }
  const d = parseISO(s.datum)
  return {
    tag,
    wochentag: d.toLocaleDateString(gebietsschema, { weekday: 'short' }),
    datum: d.toLocaleDateString(gebietsschema, { day: '2-digit', month: '2-digit' }),
  }
}

/**
 * Deckender Hintergrund für die feste Namensspalte im Farbton der Zeile. Vorher
 * `bg-inherit` auf durchsichtigen Zeilen: Beim Waagerecht-Scrollen lagen die
 * Tageszellen ("SW", "W") über den Namen (gemessen am 31.10.2026).
 */
const deckend = (tönung: number) => ({
  background: `linear-gradient(hsl(var(--muted) / ${tönung}), hsl(var(--muted) / ${tönung})), hsl(var(--card))`,
})

function euro(cents: number | null, gebietsschema: string) {
  return ((cents ?? 0) / 100).toLocaleString(gebietsschema, { style: 'currency', currency: 'EUR' })
}

function csv(bericht: Bericht, pid: number, tt: Tt, gebietsschema: string, mitKosten: boolean) {
  const spalten = bericht.spalten.map(s => {
    const k = kopf(s, tt, gebietsschema)
    return [k.tag, k.wochentag, k.datum].filter(Boolean).join(' ')
  })
  const header = [tt(T.name), tt(T.figur), ...spalten, tt(T.arbeitstage), tt(T.gearbeitet), tt(T.haltetage), tt(T.reisetage), ...(mitKosten ? [tt(T.kosten)] : [])]
  const zeilen = bericht.cast.map(c => [
    c.actor_name || tt(T.nichtBesetzt),
    c.character_name,
    ...c.days.map(d => d.code),
    String(c.total_work_days),
    String(c.total_worked_days),
    String(c.total_hold_days),
    String(c.total_travel_days),
    // Wie alle CSV-Ausfuhren (Fund 180): Zahl mit Komma, ohne Währungszeichen.
    ...(mitKosten ? [betragCsv(c.total_cost_cents ?? 0)] : []),
  ])
  csvHerunterladen(tt(T.dateiname).replace('{n}', String(pid)), header, zeilen)
}

const Zahl = ({ wert, farbe }: { wert: number; farbe: string }) => (
  <span className={`inline-flex items-center justify-center min-w-[28px] h-6 rounded-md border text-xs font-bold tabular-nums px-1.5 ${farbe}`}>
    {wert}
  </span>
)
const GRUEN_ZAHL = 'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/25'
const BERNSTEIN_ZAHL = 'bg-amber-400/15 text-amber-700 dark:text-amber-300 border-amber-400/25'
const BLAU_ZAHL = 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25'

// ─── Seite ───────────────────────────────────────────────────────────────────

export function Component() {
  const { projectId: id } = useParams<{ projectId: string }>()
  const pid = Number(id)
  const tt = useT()
  const gebietsschema = useGebietsschema()
  const { siehtGagen } = useSchreibrecht()

  const { data: bericht, isLoading, isError } = useQuery<Bericht>({
    queryKey: ['dood-report', pid],
    queryFn: async () => {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/projects/${pid}/dood-report`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(tt(T.fehlerLaden))
      return (await res.json()).data as Bericht
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

  if (isError || !bericht) {
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

  const spalten = bericht.spalten ?? []
  const cast = bericht.cast ?? []
  const drehtage = spalten.filter(s => s.day_number != null && !s.frei).length
  const summe = (f: (c: Zeile) => number) => cast.reduce((s, c) => s + f(c), 0)
  const kuerzel = Object.entries(KUERZEL)

  return (
    <div className="p-4 sm:p-7 max-w-6xl mx-auto animate-fade-up">
      <div className="mb-8 pb-7 border-b border-border/40">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-[28px] sm:text-[34px]">{tt(T.titel)}</h1>
            <p className="text-sm text-muted-foreground/60 mt-1.5">{tt(T.untertitel)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="flex items-center gap-5">
              <div className="text-right">
                <div className="text-[2.25rem] font-bold tabular-nums tracking-tight leading-none">{cast.length}</div>
                <div className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40 mt-1">{tt(T.darsteller)}</div>
              </div>
              <div className="text-right">
                <div className="text-[2.25rem] font-bold tabular-nums tracking-tight leading-none">{drehtage}</div>
                <div className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40 mt-1">{tt(T.drehtage)}</div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => csv(bericht, pid, tt, gebietsschema, siehtGagen)} className="ml-4">
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {tt(T.csvExportieren)}
            </Button>
          </div>
        </div>
      </div>

      <div data-einfuehrung="legende" className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40 mb-3">{tt(T.legende)}</p>
        <div className="flex flex-wrap gap-2">
          {kuerzel.map(([k, stil]) => (
            <span key={k} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${stil.farbe}`}>
              <span className="font-bold">{k}</span>
              <span className="font-normal opacity-70">= {tt(stil.label)}</span>
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/50 text-xs">
            <span className="inline-block w-4 h-3 rounded-sm bg-muted/50" aria-hidden="true" />
            <span className="opacity-70">{tt(T.frei)}</span>
          </span>
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground/70">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {tt(T.haltHinweis)}
        </p>
      </div>

      {cast.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card flex flex-col items-center justify-center py-16">
          <Users className="w-10 h-10 opacity-20 mb-3" />
          <p className="text-sm text-muted-foreground/60">{tt(T.keineDarsteller)}</p>
        </div>
      ) : (
        <div data-einfuehrung="raster" className="rounded-xl border border-border/60 bg-card overflow-x-auto mb-6">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/40">
                <th style={deckend(0.3)} className="sticky left-0 z-10 px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground min-w-[180px] border-r border-border/30">
                  {tt(T.darsteller)}
                </th>
                {spalten.map((s, i) => {
                  const k = kopf(s, tt, gebietsschema)
                  return (
                    <th key={i} className={`px-1 py-2 text-center min-w-[46px] ${s.frei ? 'bg-muted/50' : 'bg-muted/20'}`}>
                      <div className="text-[11px] font-bold tabular-nums text-muted-foreground h-4">{k.tag}</div>
                      <div className="text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-[0.05em] mt-0.5">{k.wochentag}</div>
                      <div className="text-[9px] text-muted-foreground/50 tabular-nums">{k.datum}</div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {cast.map((c, i) => (
                <tr key={c.id} className={`border-b border-border/30 hover:bg-muted/20 ${i % 2 === 1 ? 'bg-muted/10' : ''}`}>
                  <td style={deckend(i % 2 === 1 ? 0.1 : 0)} className="sticky left-0 z-10 px-5 py-2 border-r border-border/30">
                    <div className="text-sm font-medium leading-snug truncate">{c.actor_name || tt(T.nichtBesetzt)}</div>
                    {c.character_name && <div className="text-[10px] text-muted-foreground/50 truncate">{c.character_name}</div>}
                  </td>
                  {c.days.map((d, j) => (
                    <td key={j} className="p-1 text-center">
                      <div className="h-8 w-full">{zelle(d.code, d.frei)}</div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cast.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40 mb-3">{tt(T.zusammenfassung)}</p>
          <div className="rounded-xl border border-border/60 bg-card overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border/40 bg-muted/30 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  <th className="px-5 py-3 text-left">{tt(T.darsteller)}</th>
                  <th className="px-4 py-3 text-center">{tt(T.arbeitstage)}</th>
                  <th className="px-4 py-3 text-center" title={tt(T.gearbeitetHilfe)}>{tt(T.gearbeitet)}</th>
                  <th className="px-4 py-3 text-center">{tt(T.haltetage)}</th>
                  <th className="px-4 py-3 text-center">{tt(T.reisetage)}</th>
                  {siehtGagen && <th className="px-5 py-3 text-right" title={tt(T.kostenHilfe)}>{tt(T.kosten)}</th>}
                </tr>
              </thead>
              <tbody>
                {cast.map((c, i) => (
                  <tr key={c.id} className={`border-b border-border/30 hover:bg-muted/20 ${i % 2 === 1 ? 'bg-muted/10' : ''}`}>
                    <td className="px-5 py-3">
                      <div className="text-sm font-medium">{c.actor_name || tt(T.nichtBesetzt)}</div>
                      {c.character_name && <div className="text-[10px] text-muted-foreground/50">{c.character_name}</div>}
                    </td>
                    <td className="px-4 py-3 text-center"><Zahl wert={c.total_work_days} farbe={GRUEN_ZAHL} /></td>
                    <td className="px-4 py-3 text-center"><Zahl wert={c.total_worked_days} farbe={GRUEN_ZAHL} /></td>
                    <td className="px-4 py-3 text-center"><Zahl wert={c.total_hold_days} farbe={BERNSTEIN_ZAHL} /></td>
                    <td className="px-4 py-3 text-center"><Zahl wert={c.total_travel_days} farbe={BLAU_ZAHL} /></td>
                    {siehtGagen && <td className="px-5 py-3 text-right font-mono text-sm tabular-nums">{euro(c.total_cost_cents, gebietsschema)}</td>}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border/40 bg-muted/20">
                  <td className="px-5 py-3 text-xs font-bold uppercase tracking-[0.06em] text-muted-foreground/50">{tt(T.gesamt)}</td>
                  <td className="px-4 py-3 text-center"><Zahl wert={summe(c => c.total_work_days)} farbe={GRUEN_ZAHL} /></td>
                  <td className="px-4 py-3 text-center"><Zahl wert={summe(c => c.total_worked_days)} farbe={GRUEN_ZAHL} /></td>
                  <td className="px-4 py-3 text-center"><Zahl wert={summe(c => c.total_hold_days)} farbe={BERNSTEIN_ZAHL} /></td>
                  <td className="px-4 py-3 text-center"><Zahl wert={summe(c => c.total_travel_days)} farbe={BLAU_ZAHL} /></td>
                  {siehtGagen && <td className="px-5 py-3 text-right font-mono text-sm font-bold tabular-nums">{euro(summe(c => c.total_cost_cents ?? 0), gebietsschema)}</td>}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
