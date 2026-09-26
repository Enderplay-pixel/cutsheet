import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { Receipt, Plus, Trash2, TrendingDown, TrendingUp, Wallet, AlertTriangle } from 'lucide-react'

// Kostenstand: Ist-Kosten (Belege) gegen die aktive Kalkulation — Soll/Ist je Kategorie

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [desc, setDesc] = useState('')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [receiptNo, setReceiptNo] = useState('')
  const [date, setDate] = useState('')

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
    onError: (e: any) => toast({ variant: 'destructive', title: 'Nicht gespeichert', description: e.message }),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['kostenstand', pid] })
    queryClient.invalidateQueries({ queryKey: ['expenses', pid] })
  }

  const createMutation = useMutation({
    mutationFn: () => api.expenses.create(pid, {
      description: desc,
      category,
      amount_cents: Math.round(parseFloat(amount.replace(',', '.')) * 100),
      receipt_no: receiptNo,
      expense_date: date || null,
    }),
    onSuccess: () => { setDesc(''); setAmount(''); setReceiptNo(''); invalidate() },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Fehler', description: e.message }),
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
  const overBudget = totals.diff_cents < 0
  const usedPct = totals.soll_cents > 0 ? Math.round((totals.ist_cents / totals.soll_cents) * 100) : 0

  return (
    <div className="page-container animate-fade-up">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Wallet className="w-[17px] h-[17px] text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight leading-none">Kostenstand</h1>
          <p className="text-[12px] text-muted-foreground mt-1">
            Ist-Kosten gegen {kostenstand?.budget_version ? `Kalkulation „${kostenstand.budget_version.name}"` : 'die Kalkulation'}
          </p>
        </div>
      </div>

      {/* Frühwarnung */}
      {(() => {
        const schwelle = Number(warnung?.threshold_percent ?? 80)
        const an = !!warnung?.enabled
        const erreicht = an && totals.soll_cents > 0 && usedPct >= schwelle
        return (
          <div className="mb-5 space-y-3">
            {erreicht && (
              <div className={cn(
                'flex items-start gap-3 rounded-xl border p-3.5',
                overBudget ? 'border-danger/40 bg-danger/5' : 'border-warning/40 bg-warning/5',
              )}>
                <AlertTriangle className={cn('w-4 h-4 mt-0.5 shrink-0', overBudget ? 'text-danger' : 'text-warning')} />
                <div className="text-[13px] leading-relaxed">
                  <p className="font-semibold">
                    {overBudget
                      ? `Budget überzogen: ${usedPct} % der Kalkulation ausgegeben.`
                      : `${usedPct} % der Kalkulation ausgegeben - Warnschwelle bei ${schwelle} %.`}
                  </p>
                  <p className="text-muted-foreground">
                    {formatCurrency(totals.ist_cents)} von {formatCurrency(totals.soll_cents)}. Gezählt werden die
                    erfassten Belege, nicht die Kalkulationszeilen.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
              <span>Warnung bei</span>
              {schwelleBearbeiten ? (
                <>
                  <Input
                    type="number" min={1} max={200} defaultValue={schwelle}
                    className="h-7 w-20 text-[12px]"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        warnungSpeichern.mutate({ threshold_percent: Number((e.target as HTMLInputElement).value) || 80, enabled: true })
                      }
                    }}
                    id="warnschwelle"
                  />
                  <span>% der Kalkulation</span>
                  <Button size="sm" variant="outline" className="h-7 text-[12px]"
                    onClick={() => {
                      const feld = document.getElementById('warnschwelle') as HTMLInputElement | null
                      warnungSpeichern.mutate({ threshold_percent: Number(feld?.value) || 80, enabled: true })
                    }}>Speichern</Button>
                </>
              ) : (
                <>
                  <span className="font-semibold text-foreground">{an ? `${schwelle} %` : 'aus'}</span>
                  <Button size="sm" variant="ghost" className="h-7 text-[12px]"
                    onClick={() => setSchwelleBearbeiten(true)}>ändern</Button>
                  {an && (
                    <Button size="sm" variant="ghost" className="h-7 text-[12px]"
                      onClick={() => warnungSpeichern.mutate({ threshold_percent: schwelle, enabled: false })}>
                      abschalten
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        )
      })()}

      {/* Summen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-7 stagger-sm">
        <div className="stat-card">
          <p className="section-label mb-2">Kalkuliert (Soll)</p>
          <p className="text-2xl font-bold tabular-nums tracking-tight">{formatCurrency(totals.soll_cents)}</p>
        </div>
        <div className="stat-card">
          <p className="section-label mb-2">Ausgegeben (Ist)</p>
          <p className="text-2xl font-bold tabular-nums tracking-tight">{formatCurrency(totals.ist_cents)}</p>
          <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden mt-3">
            <div
              className={cn('h-full rounded-full transition-[width] duration-700', overBudget ? 'bg-danger' : 'bg-success')}
              style={{ width: `${Math.min(100, usedPct)}%` }}
            />
          </div>
        </div>
        <div className={cn('stat-card', overBudget ? 'border-danger/30' : 'border-success/25')}>
          <p className="section-label mb-2">{overBudget ? 'Überzogen' : 'Verbleibend'}</p>
          <p className={cn('text-2xl font-bold tabular-nums tracking-tight flex items-center gap-2', overBudget ? 'text-danger' : 'text-success')}>
            {overBudget ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            {formatCurrency(Math.abs(totals.diff_cents))}
          </p>
        </div>
      </div>

      {/* Soll/Ist je Kategorie */}
      {rows.length > 0 && (
        <div className="mb-8">
          <p className="section-label mb-3">Soll / Ist je Kategorie</p>
          <div className="overflow-x-auto">
            <table className="data-table min-w-[480px]">
              <thead>
                <tr><th>Kategorie</th><th className="text-right">Soll</th><th className="text-right">Ist</th><th className="text-right">Differenz</th></tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.category}>
                    <td className="font-medium">{r.category || 'Ohne Kategorie'}</td>
                    <td className="text-right tabular-nums">{formatCurrency(r.soll_cents)}</td>
                    <td className="text-right tabular-nums">{formatCurrency(r.ist_cents)}</td>
                    <td className={cn('text-right tabular-nums font-semibold', r.diff_cents < 0 ? 'text-danger' : 'text-success')}>
                      {r.diff_cents < 0 ? '−' : '+'}{formatCurrency(Math.abs(r.diff_cents))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Beleg erfassen */}
      <p className="section-label mb-3">Beleg erfassen</p>
      <form
        onSubmit={e => { e.preventDefault(); if (desc.trim() && amount) createMutation.mutate() }}
        className="grid grid-cols-2 lg:grid-cols-6 gap-2 mb-6"
      >
        <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Beschreibung" className="col-span-2" required />
        <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="Kategorie" list="kostenstand-categories" />
        <datalist id="kostenstand-categories">
          {rows.map((r: any) => <option key={r.category} value={r.category} />)}
        </datalist>
        <Input value={amount} onChange={e => setAmount(e.target.value)} placeholder="Betrag €" inputMode="decimal" required />
        <Input value={date} onChange={e => setDate(e.target.value)} type="date" aria-label="Belegdatum" />
        <div className="flex gap-2">
          <Input value={receiptNo} onChange={e => setReceiptNo(e.target.value)} placeholder="Beleg-Nr." className="flex-1" />
          <Button type="submit" size="icon" disabled={createMutation.isPending} title="Beleg hinzufügen">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </form>

      {/* Belegliste */}
      {expenses.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Receipt className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">Noch keine Belege erfasst</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table min-w-[560px]">
            <thead>
              <tr><th>Datum</th><th>Beleg-Nr.</th><th>Beschreibung</th><th>Kategorie</th><th className="text-right">Betrag</th><th></th></tr>
            </thead>
            <tbody>
              {expenses.map((e: any) => (
                <tr key={e.id} className="group">
                  <td className="tabular-nums text-muted-foreground">
                    {e.expense_date ? new Date(e.expense_date).toLocaleDateString('de-DE') : '—'}
                  </td>
                  <td className="text-muted-foreground">{e.receipt_no || '—'}</td>
                  <td className="font-medium">{e.description}</td>
                  <td className="text-muted-foreground">{e.category || '—'}</td>
                  <td className="text-right tabular-nums font-semibold">{formatCurrency(e.amount_cents)}</td>
                  <td className="w-8">
                    <button
                      onClick={() => deleteMutation.mutate(e.id)}
                      className="p-1.5 rounded-md text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-[color,background-color,opacity] duration-150 active:scale-[0.88]"
                      title="Beleg löschen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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
