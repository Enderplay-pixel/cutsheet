import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, Banknote, CheckCircle2, Flag } from 'lucide-react'
import { useSchreibrecht } from '@/lib/useSchreibrecht'
import { useT, useGebietsschema } from '@/lib/useT'
import { useDownload } from '@/lib/useDownload'
import { NurProduktion } from '@/components/shared/NurProduktion'
import { cashflowT as T } from '@/lib/texte/Cashflow'

/**
 * Cashflowplan (Plan Kino-Ausbau, AP E2): Einnahmen aus den Raten, Ausgaben
 * aus den Budgetzeilen mit Zeitraum und aus den Belegen, je Woche oder Monat.
 * Gerechnet wird auf dem Server (lib/cashflow.ts).
 */
type Raster = 'woche' | 'monat'

const datum = (iso: string) => new Date(`${iso}T12:00:00Z`)

/** ISO-Kalenderwoche eines Montags "JJJJ-MM-TT". */
function kalenderwoche(iso: string): number {
  const d = datum(iso)
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7))
  const jahr = d.getUTCFullYear()
  return 1 + Math.floor((d.getTime() - Date.UTC(jahr, 0, 1)) / (7 * 86_400_000))
}

function CashflowSeite() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const tt = useT()
  const gs = useGebietsschema()
  const download = useDownload()
  const [raster, setRaster] = useState<Raster>('woche')

  const { data: cf, isLoading } = useQuery({
    queryKey: ['cashflow', pid, raster],
    queryFn: () => api.cashflow.get(pid, raster),
  })

  const tag = (iso: string, mitJahr = false) =>
    datum(iso).toLocaleDateString(gs, { day: '2-digit', month: '2-digit', ...(mitJahr ? { year: 'numeric' } : {}), timeZone: 'UTC' })
  const zeitraumText = (p: any) => raster === 'woche'
    ? `${tt(T.kw).replace('{n}', String(kalenderwoche(p.von)))} · ${tt(T.bis).replace('{von}', tag(p.von)).replace('{bis}', tag(p.bis, true))}`
    : datum(p.von).toLocaleDateString(gs, { month: 'long', year: 'numeric', timeZone: 'UTC' })

  if (isLoading || !cf) {
    return (
      <div className="page-container space-y-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  const perioden: any[] = cf.perioden ?? []
  const nt = cf.nicht_terminiert
  const ereignisse: any[] = perioden.flatMap((p) => p.ereignisse)
  const ersteUnterdeckung = perioden.find((p) => p.unterdeckung)
  const tiefster = perioden.reduce((m, p) => Math.min(m, p.saldo_aufgelaufen_cents), 0)
  const nichtsTerminiert = nt.einnahmen.length + nt.ausgaben.length + nt.belege.length > 0

  return (
    <div className="page-container animate-fade-up">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Banknote className="w-[17px] h-[17px] text-primary" />
          </div>
          <div>
            <h1 className="font-display text-[28px] sm:text-[34px]">{tt(T.titel)}</h1>
            <p className="text-[12px] text-muted-foreground mt-1">
              {cf.kalkulation ? tt(T.gegen).replace('{name}', cf.kalkulation.name) : tt(T.ohneKalkulation)}
            </p>
          </div>
        </div>
        <div data-einfuehrung="aktionen" className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label={tt(T.raster)} className="inline-flex rounded-md border border-border p-0.5">
            {(['woche', 'monat'] as const).map((r) => (
              <button key={r} type="button" aria-pressed={raster === r} onClick={() => setRaster(r)}
                className={cn('px-3 h-7 text-xs rounded-[5px] transition-colors', raster === r ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {tt(r === 'woche' ? T.woche : T.monat)}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => download(api.cashflow.csv(pid, raster), `cashflow-${raster}.csv`)}>{tt(T.csv)}</Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => download(api.cashflow.pdf(pid, raster), `cashflow-${raster}.pdf`)}>PDF</Button>
        </div>
      </div>

      {/* Summen */}
      <div data-einfuehrung="summen" className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5 stagger-sm">
        {([
          [T.einnahmen, cf.summen.einnahmen_cents],
          [T.ausgabenPlan, cf.summen.ausgaben_plan_cents],
          [T.ausgabenIst, cf.summen.ausgaben_ist_cents],
          [T.saldo, cf.summen.saldo_cents],
        ] as const).map(([text, wert], i) => (
          <div key={i} className={cn('stat-card', i === 3 && wert < 0 && 'border-danger/30')}>
            <p className="section-label mb-2">{tt(text)}</p>
            <p className={cn('text-xl sm:text-2xl font-bold tabular-nums tracking-tight', i === 3 && wert < 0 && 'text-danger')}>{formatCurrency(wert)}</p>
          </div>
        ))}
      </div>

      {perioden.length > 0 && (
        <div data-einfuehrung="unterdeckung" role="status" className={cn(
          'flex items-start gap-3 rounded-xl border p-3.5 mb-5 text-sm',
          ersteUnterdeckung ? 'border-danger/40 bg-danger/5' : 'border-success/30 bg-success/5',
        )}>
          {ersteUnterdeckung
            ? <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-danger" aria-hidden />
            : <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-success" aria-hidden />}
          <p>
            {ersteUnterdeckung
              ? tt(T.unterdeckungAb).replace('{zeitraum}', zeitraumText(ersteUnterdeckung)).replace('{betrag}', formatCurrency(tiefster))
              : tt(T.keineUnterdeckung)}
          </p>
        </div>
      )}

      {/* Ereignisse als Marken über der Tabelle */}
      {ereignisse.length > 0 && (
        <div data-einfuehrung="ereignisse" className="flex flex-wrap items-center gap-2 mb-3" title={tt(T.meilensteinHilfe)}>
          <span className="section-label mr-1">{tt(T.ereignisse)}</span>
          {ereignisse.map((x, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/30 px-2 py-0.5 text-[11px]">
              <Flag className="w-3 h-3 text-primary" aria-hidden />{x.titel} · {tag(x.datum, true)}
            </span>
          ))}
        </div>
      )}

      {perioden.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-12 px-6 text-center mb-8">
          <Banknote className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">{tt(T.leer)}</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">{tt(T.leerText)}</p>
          <Button asChild variant="outline" size="sm" className="mt-4"><Link to={`/projects/${pid}/budget`}>{tt(T.zurKalkulation)}</Link></Button>
        </div>
      ) : (
        <div data-einfuehrung="tabelle" className="overflow-x-auto mb-8">
          <table className="data-table min-w-[760px]">
            <thead>
              <tr>
                <th>{tt(T.zeitraum)}</th>
                <th className="text-right">{tt(T.einnahmen)}</th>
                <th className="text-right">{tt(T.ausgabenPlan)}</th>
                <th className="text-right">{tt(T.ausgabenIst)}</th>
                <th className="text-right">{tt(T.saldo)}</th>
                <th className="text-right">{tt(T.aufgelaufen)}</th>
              </tr>
            </thead>
            <tbody>
              {perioden.map((p) => (
                <tr key={p.schluessel} className={cn(p.unterdeckung && 'bg-danger/5')}>
                  <td>
                    <span className="tabular-nums">{zeitraumText(p)}</span>
                    {p.ereignisse.length > 0 && (
                      <span className="flex flex-wrap gap-1 mt-0.5">
                        {p.ereignisse.map((x: any, i: number) => (
                          <span key={i} className="inline-flex items-center gap-1 text-[10px] text-primary"><Flag className="w-2.5 h-2.5" aria-hidden />{x.titel} {tag(x.datum)}</span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="text-right tabular-nums">{p.einnahmen_cents ? formatCurrency(p.einnahmen_cents) : <span className="text-muted-foreground">-</span>}</td>
                  <td className="text-right tabular-nums">{p.ausgaben_plan_cents ? formatCurrency(p.ausgaben_plan_cents) : <span className="text-muted-foreground">-</span>}</td>
                  <td className="text-right tabular-nums text-muted-foreground">{p.ausgaben_ist_cents ? formatCurrency(p.ausgaben_ist_cents) : '-'}</td>
                  <td className={cn('text-right tabular-nums', p.saldo_cents < 0 && 'text-danger')}>{formatCurrency(p.saldo_cents)}</td>
                  <td className={cn('text-right tabular-nums font-semibold', p.unterdeckung ? 'text-danger' : 'text-success')}>
                    {formatCurrency(p.saldo_aufgelaufen_cents)}
                    {p.unterdeckung && <span className="block text-[10px] font-medium">{tt(T.unterdeckung)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td>{tt(T.summe)}</td>
                <td className="text-right tabular-nums">{formatCurrency(cf.summen.einnahmen_cents)}</td>
                <td className="text-right tabular-nums">{formatCurrency(cf.summen.ausgaben_plan_cents)}</td>
                <td className="text-right tabular-nums text-muted-foreground">{formatCurrency(cf.summen.ausgaben_ist_cents)}</td>
                <td className={cn('text-right tabular-nums', cf.summen.saldo_cents < 0 && 'text-danger')}>{formatCurrency(cf.summen.saldo_cents)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Was kein Datum hat, verschwindet nicht */}
      {nichtsTerminiert && (
        <div data-einfuehrung="nicht-terminiert" className="mb-8">
          <p className="section-label mb-1">{tt(T.nichtTerminiert)}</p>
          <p className="text-xs text-muted-foreground mb-3 max-w-2xl">{tt(T.nichtTerminiertHilfe)}</p>
          <div className="grid gap-3 md:grid-cols-3">
            {([
              [T.einnahmenOhne, nt.einnahmen, nt.einnahmen_cents],
              [T.ausgabenOhne, nt.ausgaben, nt.ausgaben_cents],
              [T.belegeOhne, nt.belege, nt.belege_cents],
            ] as const).filter(([, liste]) => liste.length > 0).map(([text, liste, summe], i) => (
              <div key={i} className="rounded-xl border border-border/60 p-3">
                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <p className="text-sm font-medium">{tt(text)}</p>
                  <p className="text-sm font-semibold tabular-nums">{formatCurrency(summe)}</p>
                </div>
                <ul className="space-y-1">
                  {liste.map((x: any, j: number) => (
                    <li key={j} className="flex justify-between gap-3 text-xs">
                      <span className="text-muted-foreground truncate">{x.bezeichnung}</span>
                      <span className="tabular-nums shrink-0">{formatCurrency(x.cents)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Gagen und Kalkulation sieht nur die Produktion (server/src/lib/gagenschutz.ts). */
export function Component() {
  const { rolle, siehtGagen } = useSchreibrecht()
  if (rolle && !siehtGagen) return <NurProduktion />
  return <CashflowSeite />
}
