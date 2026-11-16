import { Fragment, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, cn, betragInCent, heuteISO } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { Receipt, Plus, Trash2, TrendingDown, TrendingUp, Wallet, AlertTriangle } from 'lucide-react'
import { useSchreibrecht } from '@/lib/useSchreibrecht'
import { useT, useGebietsschema } from '@/lib/useT'
import { kostenstandT as T } from '@/lib/texte/Kostenstand'
import { parseISO } from 'date-fns'
import { NurProduktion } from '@/components/shared/NurProduktion'
import { kalkT as K, KOSTENART_TEXT, KOSTENARTEN } from '@/lib/texte/Kalkulation'
import { ChevronRight } from 'lucide-react'

// Kostenstand: Ist-Kosten (Belege) gegen die aktive Kalkulation - Soll/Ist je Kategorie

/**
 * "Noch zu erwarten" einer Zeile (AP E1): Vorgabe Kalkulation minus Ist,
 * die Produktion überschreibt; abgeschlossen heißt, es kommt nichts mehr.
 */
function Prognose({ z, darf, onGespeichert }: { z: any; darf: boolean; onGespeichert: () => void }) {
  const tt = useT()
  const gs = useGebietsschema()
  const { toast } = useToast()
  const [text, setText] = useState(String((z.rest_cents ?? 0) / 100))
  useEffect(() => setText(String((z.rest_cents ?? 0) / 100)), [z.rest_cents])
  const speichern = useMutation({
    mutationFn: (daten: { rest_cents?: number | null; abgeschlossen?: boolean }) => api.budget.prognose(z.id, daten),
    onSuccess: onGespeichert,
    onError: (e: any) => toast({ variant: 'destructive', title: tt(T.nichtGespeichert), description: e?.message }),
  })
  const verlassen = () => {
    const cent = betragInCent(text)
    if (Number.isNaN(cent) || cent < 0) { setText(String((z.rest_cents ?? 0) / 100)); return }
    if (cent !== z.rest_cents) speichern.mutate({ rest_cents: cent })
  }
  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className="flex items-center gap-1">
        <Input value={text} onChange={e => setText(e.target.value)} onBlur={verlassen} disabled={!darf || z.abgeschlossen}
          inputMode="decimal" aria-label={tt(K.restVon).replace('{name}', z.description || '')}
          title={z.rest_gesetzt ? '' : tt(K.restVorgabe)}
          className={cn('h-7 w-28 text-right text-[13px] tabular-nums', z.rest_gesetzt && 'border-primary/50')} />
        <span className="text-xs text-muted-foreground">€</span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        {z.rest_gesetzt && z.gesetzt_von && (
          <span>{tt(K.gesetztVon).replace('{name}', z.gesetzt_von).replace('{datum}', new Date(z.gesetzt_am).toLocaleDateString(gs))}</span>
        )}
        {z.rest_gesetzt && darf && (
          <button type="button" className="underline hover:text-primary" title={tt(K.restZurueckLang)}
            onClick={() => speichern.mutate({ rest_cents: null })}>{tt(K.restZurueck)}</button>
        )}
        <label className="inline-flex items-center gap-1">
          <input type="checkbox" checked={!!z.abgeschlossen} disabled={!darf}
            aria-label={tt(K.abgeschlossenLang).replace('{name}', z.description || '')}
            onChange={e => speichern.mutate({ abgeschlossen: e.target.checked })} />
          {tt(K.abgeschlossen)}
        </label>
      </div>
    </div>
  )
}

/** Abweichung des Endstands: Betrag und Prozent, Überschreitung markiert. */
function Abweichung({ r }: { r: any }) {
  const tt = useT()
  return (
    <span className={cn('tabular-nums', r.ueber ? 'text-danger font-semibold' : 'text-success')} title={r.ueber ? tt(K.ueberKalkulation) : undefined}>
      {r.abweichung_cents > 0 ? '+' : r.abweichung_cents < 0 ? '−' : '±'}{formatCurrency(Math.abs(r.abweichung_cents))}
      {r.abweichung_prozent !== null && r.abweichung_prozent !== undefined && <span className="text-[11px] ml-1">({r.abweichung_prozent > 0 ? '+' : ''}{String(r.abweichung_prozent).replace('.', ',')} %)</span>}
      {r.ueber && <span className="sr-only"> {tt(K.ueberKalkulation)}</span>}
    </span>
  )
}

function KostenstandSeite() {
  const { darfSchreiben } = useSchreibrecht()
  const { projectId } = useParams()
  const pid = Number(projectId)
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const tt = useT()
  const gs = useGebietsschema()

  const [desc, setDesc] = useState('')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [receiptNo, setReceiptNo] = useState('')
  // Ein Beleg ohne Datum zählte in keiner Auswertung - vorbelegt mit heute
  const [date, setDate] = useState(heuteISO())
  // FFA-Schema (AP B1): Kostenart aus der Liste statt freiem Text, Zeile freiwillig
  const [kostenart, setKostenart] = useState('')
  const [zeileId, setZeileId] = useState('')
  const [offen, setOffen] = useState<Record<string, boolean>>({})

  const { data: kostenstand, isLoading } = useQuery({
    queryKey: ['kostenstand', pid],
    queryFn: () => api.expenses.kostenstand(pid),
  })
  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', pid],
    queryFn: () => api.expenses.list(pid),
  })

  /**
   * Frühwarnung. Der Kostenstand zeigt bisher erst die Überziehung - da ist
   * das Geld schon weg. Die Schwelle lag als Einstellung samt Route in der
   * Anwendung, wurde aber von keiner Seite aufgerufen (nachgezählt am
   * 26.09.2026: eine von sieben Routen ohne Oberfläche).
   */
  const { data: warnung } = useQuery({
    queryKey: ['budget-alerts', pid],
    queryFn: () => api.budgetAlerts.get(pid),
  })
  const [schwelleBearbeiten, setSchwelleBearbeiten] = useState(false)
  const warnungSpeichern = useMutation({
    mutationFn: (daten: any) => api.budgetAlerts.update(pid, daten),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-alerts', pid] })
      setSchwelleBearbeiten(false)
    },
    onError: (e: any) => toast({ variant: 'destructive', title: tt(T.nichtGespeichert), description: e.message }),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['kostenstand', pid] })
    queryClient.invalidateQueries({ queryKey: ['expenses', pid] })
  }

  const createMutation = useMutation({
    mutationFn: () => api.expenses.create(pid, {
      description: desc,
      category: ffa ? (kostenart ? `${kostenart} ${tt(KOSTENART_TEXT[Number(kostenart)])}` : '') : category,
      amount_cents: betragInCent(amount),
      receipt_no: receiptNo,
      expense_date: date || null,
      ...(ffa ? { cost_group: kostenart ? Number(kostenart) : null, budget_line_id: zeileId ? Number(zeileId) : null } : {}),
    }),
    onSuccess: () => { setDesc(''); setAmount(''); setReceiptNo(''); setZeileId(''); invalidate() },
    onError: (e: any) => toast({ variant: 'destructive', title: tt(T.fehler), description: e.message }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.expenses.delete(id),
    onSuccess: invalidate,
  })

  if (isLoading) {
    return (
      <div className="page-container space-y-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  const totals = kostenstand?.totals ?? { soll_cents: 0, ist_cents: 0, diff_cents: 0 }
  const rows = kostenstand?.rows ?? []
  const ffa = kostenstand?.budget_version?.schema === 'ffa'
  // Im FFA-Schema stehen alle elf Kostenarten; ohne Soll und Ist bleiben sie in der Tabelle weg
  const sichtbar = ffa ? rows.filter((r: any) => r.soll_cents !== 0 || r.ist_cents !== 0) : rows
  const zeilenDerArt = ffa && kostenart ? (rows.find((r: any) => r.cost_group === Number(kostenart))?.zeilen ?? []).filter((z: any) => z.id) : []
  const overBudget = totals.diff_cents < 0
  const usedPct = totals.soll_cents > 0 ? Math.round((totals.ist_cents / totals.soll_cents) * 100) : 0

  return (
    <div className="page-container animate-fade-up">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Wallet className="w-[17px] h-[17px] text-primary" />
        </div>
        <div>
          <h1 className="font-display text-[28px] sm:text-[34px]">{tt(T.titel)}</h1>
          <p className="text-[12px] text-muted-foreground mt-1">
            {kostenstand?.budget_version ? tt(T.istGegenVersion).replace('{name}', kostenstand.budget_version.name) : tt(T.istGegen)}
            {kostenstand?.budget_version && kostenstand.budget_version.status !== 'Aktiv' && (
              <> ({tt(T.nichtAktiv).replace('{status}', kostenstand.budget_version.status)})</>
            )}
          </p>
        </div>
      </div>

      {/* Frühwarnung */}
      {(() => {
        const schwelle = Number(warnung?.threshold_percent ?? 80)
        const an = !!warnung?.enabled
        const erreicht = an && totals.soll_cents > 0 && usedPct >= schwelle
        return (
          <div data-einfuehrung="warnung" className="mb-5 space-y-3">
            {erreicht && (
              <div className={cn(
                'flex items-start gap-3 rounded-xl border p-3.5',
                overBudget ? 'border-danger/40 bg-danger/5' : 'border-warning/40 bg-warning/5',
              )}>
                <AlertTriangle className={cn('w-4 h-4 mt-0.5 shrink-0', overBudget ? 'text-danger' : 'text-warning')} />
                <div className="text-[13px] leading-relaxed">
                  <p className="font-semibold">
                    {overBudget
                      ? tt(T.ueberzogen).replace('{p}', String(usedPct))
                      : tt(T.schwelleErreicht).replace('{p}', String(usedPct)).replace('{s}', String(schwelle))}
                  </p>
                  <p className="text-muted-foreground">
                    {tt(T.gezaehlt).replace('{ist}', formatCurrency(totals.ist_cents)).replace('{soll}', formatCurrency(totals.soll_cents))}
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
              <span>{tt(T.warnungBei)}</span>
              {schwelleBearbeiten ? (
                <>
                  <Input disabled={!darfSchreiben}
                    type="number" min={1} max={200} defaultValue={schwelle}
                    className="h-7 w-20 text-[12px]"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        warnungSpeichern.mutate({ threshold_percent: Number((e.target as HTMLInputElement).value) || 80, enabled: true })
                      }
                    }}
                    id="warnschwelle"
                  />
                  <span>{tt(T.prozentKalk)}</span>
                  <Button size="sm" variant="outline" className="h-7 text-[12px]"
                    onClick={() => {
                      const feld = document.getElementById('warnschwelle') as HTMLInputElement | null
                      warnungSpeichern.mutate({ threshold_percent: Number(feld?.value) || 80, enabled: true })
                    }}>{tt(T.speichern)}</Button>
                </>
              ) : (
                <>
                  <span className="font-semibold text-foreground">{an ? `${schwelle} %` : tt(T.aus)}</span>
                  {darfSchreiben && (
                    <Button size="sm" variant="ghost" className="h-7 text-[12px]"
                      onClick={() => setSchwelleBearbeiten(true)}>{tt(T.aendern)}</Button>
                  )}
                  {an && darfSchreiben && (
                    <Button size="sm" variant="ghost" className="h-7 text-[12px]"
                      onClick={() => warnungSpeichern.mutate({ threshold_percent: schwelle, enabled: false })}>
                      {tt(T.abschalten)}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        )
      })()}

      {/* Summen */}
      <div data-einfuehrung="summen" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-7 stagger-sm">
        <div className="stat-card">
          <p className="section-label mb-2">{tt(T.kalkuliert)}</p>
          <p className="text-2xl font-bold tabular-nums tracking-tight">{formatCurrency(totals.soll_cents)}</p>
          {ffa && kostenstand?.rechenwerk && (
            <p className="text-[11px] text-muted-foreground mt-1">{tt(K.kalkuliertFk).replace('{hk}', formatCurrency(kostenstand.rechenwerk.herstellungskosten))}</p>
          )}
        </div>
        <div className="stat-card">
          <p className="section-label mb-2">{tt(T.ausgegeben)}</p>
          <p className="text-2xl font-bold tabular-nums tracking-tight">{formatCurrency(totals.ist_cents)}</p>
          <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden mt-3">
            <div
              className={cn('h-full rounded-full transition-[width] duration-700', overBudget ? 'bg-danger' : 'bg-success')}
              style={{ width: `${Math.min(100, usedPct)}%` }}
            />
          </div>
        </div>
        <div className={cn('stat-card', overBudget ? 'border-danger/30' : 'border-success/25')}>
          <p className="section-label mb-2">{overBudget ? tt(T.ueberzogenKurz) : tt(T.verbleibend)}</p>
          <p className={cn('text-2xl font-bold tabular-nums tracking-tight flex items-center gap-2', overBudget ? 'text-danger' : 'text-success')}>
            {overBudget ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            {formatCurrency(Math.abs(totals.diff_cents))}
          </p>
        </div>
        {/* Reicht das Geld? Ist plus noch zu erwarten (AP E1) */}
        <div data-einfuehrung="endstand" className={cn('stat-card', totals.ueber ? 'border-danger/30' : '')}>
          <p className="section-label mb-2">{tt(K.endstandLang)}</p>
          <p className="text-2xl font-bold tabular-nums tracking-tight">{formatCurrency(totals.endstand_cents ?? totals.ist_cents)}</p>
          {totals.abweichung_cents !== undefined && <p className="text-[12px] mt-1"><Abweichung r={totals} /></p>}
        </div>
      </div>

      {/* Soll/Ist je Kategorie - im FFA-Schema je Kostenart, aufklappbar je Zeile (AP B1) */}
      {sichtbar.length > 0 && (
        <div className="mb-8">
          <p className="section-label mb-3">{ffa ? `${tt(T.soll)}/${tt(T.ist)} · ${tt(K.kostenart)}` : tt(T.sollIstJe)}</p>
          {(kostenstand?.hinweise ?? []).length > 0 && (
            <p role="status" className="text-xs text-amber-700 dark:text-amber-300 mb-2">{kostenstand.hinweise.join(' · ')}</p>
          )}
          <div className="overflow-x-auto">
            <table className="data-table min-w-[760px]">
              <thead>
                <tr>
                  <th>{ffa ? tt(K.kostenart) : tt(T.kategorie)}</th>
                  <th className="text-right">{tt(K.kalkulation)}</th><th className="text-right">{tt(K.ist)}</th>
                  <th className="text-right">{tt(K.nochZuErwarten)}</th><th className="text-right">{tt(K.endstand)}</th>
                  <th className="text-right">{tt(K.abweichung)}</th>
                </tr>
              </thead>
              <tbody>
                {sichtbar.map((r: any) => {
                  const name = ffa && r.cost_group ? `${r.cost_group} ${tt(KOSTENART_TEXT[r.cost_group])}` : ffa && r.cost_group === null ? tt(K.ohneKostenart) : (r.category || tt(T.ohneKategorie))
                  const auf = !!offen[r.category]
                  const mitZeilen = (r.zeilen ?? []).length > 0
                  return (
                    <Fragment key={r.category}>
                      <tr>
                        <td className="font-medium">
                          {mitZeilen ? (
                            <button type="button" onClick={() => setOffen(o => ({ ...o, [r.category]: !auf }))} aria-expanded={auf}
                              aria-label={tt(K.aufklappen).replace('{name}', name)} className="inline-flex items-center gap-1 hover:text-primary">
                              <ChevronRight className={cn('w-3.5 h-3.5 transition-transform', auf && 'rotate-90')} />{name}
                            </button>
                          ) : name}
                        </td>
                        <td className="text-right tabular-nums">{r.cost_group === 11 && r.soll_cents ? '− ' : ''}{formatCurrency(r.soll_cents)}</td>
                        <td className="text-right tabular-nums">{formatCurrency(r.ist_cents)}</td>
                        <td className="text-right tabular-nums">{formatCurrency(r.rest_cents ?? 0)}</td>
                        <td className="text-right tabular-nums font-semibold">{formatCurrency(r.endstand_cents ?? r.ist_cents)}</td>
                        <td className="text-right"><Abweichung r={r} /></td>
                      </tr>
                      {auf && (r.zeilen ?? []).map((z: any, i: number) => (
                        <tr key={`${r.category}-${z.id}-${i}`} className="text-muted-foreground text-[13px] align-top">
                          <td className="pl-8">
                            {z.description || '-'}
                            {/* Rückstellung und Beistellung (AP E4): kein Beleg, aber im Endstand */}
                            {(z.zurueckgestellt_cents > 0 || z.beigestellt_cents > 0) && (
                              <span className="block text-[11px] text-primary">{tt(K.anteileHinweis).replace('{betrag}', formatCurrency((z.zurueckgestellt_cents ?? 0) + (z.beigestellt_cents ?? 0)))}</span>
                            )}
                          </td>
                          <td className="text-right tabular-nums">{formatCurrency(z.soll_cents)}</td>
                          <td className="text-right tabular-nums">{formatCurrency(z.ist_cents)}</td>
                          <td className="text-right">
                            {z.id ? <Prognose z={z} darf={darfSchreiben} onGespeichert={invalidate} /> : <span className="tabular-nums">{formatCurrency(z.rest_cents ?? 0)}</span>}
                          </td>
                          <td className="text-right tabular-nums">{formatCurrency(z.endstand_cents ?? z.ist_cents)}</td>
                          <td className="text-right"><Abweichung r={z} /></td>
                        </tr>
                      ))}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Beleg erfassen */}
      <p className="section-label mb-3">{tt(T.belegErfassen)}</p>
      <form
        data-einfuehrung="beleg"
        onSubmit={e => {
          e.preventDefault()
          if (!desc.trim() || !amount) return
          if (Number.isNaN(betragInCent(amount))) {
            toast({ variant: 'destructive', title: tt(T.betragUnlesbar), description: amount })
            return
          }
          createMutation.mutate()
        }}
        className="grid grid-cols-2 lg:grid-cols-6 gap-2 mb-6"
      >
        <Input disabled={!darfSchreiben} value={desc} onChange={e => setDesc(e.target.value)} placeholder={tt(T.beschreibung)} className="col-span-2" required />
        {ffa ? (
          <select disabled={!darfSchreiben} value={kostenart} onChange={e => { setKostenart(e.target.value); setZeileId('') }}
            aria-label={tt(K.kostenart)} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">{tt(K.ohneKostenart)}</option>
            {KOSTENARTEN.map(nr => <option key={nr} value={nr}>{nr} {tt(KOSTENART_TEXT[nr])}</option>)}
          </select>
        ) : (
          <>
            <Input disabled={!darfSchreiben} value={category} onChange={e => setCategory(e.target.value)} placeholder={tt(T.kategorie)} list="kostenstand-categories" />
            <datalist id="kostenstand-categories">
              {rows.map((r: any) => <option key={r.category} value={r.category} />)}
            </datalist>
          </>
        )}
        {ffa && zeilenDerArt.length > 0 && (
          <select disabled={!darfSchreiben} value={zeileId} onChange={e => setZeileId(e.target.value)}
            aria-label={tt(K.zeileFrei)} className="h-10 rounded-md border border-input bg-background px-2 text-sm col-span-2 lg:col-span-1">
            <option value="">{tt(K.ohneZeile)}</option>
            {zeilenDerArt.map((z: any) => <option key={z.id} value={z.id}>{z.description}</option>)}
          </select>
        )}
        <Input disabled={!darfSchreiben} value={amount} onChange={e => setAmount(e.target.value)} placeholder={tt(T.betragEuro)} inputMode="decimal" required />
        <Input disabled={!darfSchreiben} value={date} onChange={e => setDate(e.target.value)} type="date" aria-label={tt(T.belegdatum)} />
        <div className="flex gap-2">
          <Input disabled={!darfSchreiben} value={receiptNo} onChange={e => setReceiptNo(e.target.value)} placeholder={tt(T.belegNr)} className="flex-1" />
          <Button type="submit" size="icon" disabled={!darfSchreiben || createMutation.isPending}
            title={tt(T.belegHinzufuegen)} aria-label={tt(T.belegHinzufuegen)}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </form>

      {/* Belegliste */}
      {expenses.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Receipt className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">{tt(T.keineBelege)}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table min-w-[560px]">
            <thead>
              <tr><th>{tt(T.datum)}</th><th>{tt(T.belegNr)}</th><th>{tt(T.beschreibung)}</th><th>{tt(T.kategorie)}</th><th className="text-right">{tt(T.betrag)}</th><th></th></tr>
            </thead>
            <tbody>
              {expenses.map((e: any) => (
                <tr key={e.id} className="group">
                  <td className="tabular-nums text-muted-foreground">
                    {e.expense_date ? parseISO(e.expense_date).toLocaleDateString(gs) : '-'}
                  </td>
                  <td className="text-muted-foreground">{e.receipt_no || '-'}</td>
                  <td className="font-medium">{e.description}</td>
                  <td className="text-muted-foreground">{e.cost_group ? `${e.cost_group} ${tt(KOSTENART_TEXT[e.cost_group])}` : (e.category || '-')}</td>
                  <td className="text-right tabular-nums font-semibold">{formatCurrency(e.amount_cents)}</td>
                  <td className="w-8">
                    {darfSchreiben && <button
                      onClick={() => deleteMutation.mutate(e.id)}
                      className="p-1.5 rounded-md text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-[color,background-color,opacity] duration-150 active:scale-[0.88]"
                      title={tt(T.belegLoeschen)} aria-label={tt(T.belegLoeschen)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** Gagen und Kalkulation sieht nur die Produktion (server/src/lib/gagenschutz.ts). */
export function Component() {
  const { rolle, siehtGagen } = useSchreibrecht()
  if (rolle && !siehtGagen) return <NurProduktion />
  return <KostenstandSeite />
}
