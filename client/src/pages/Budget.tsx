import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/components/ui/use-toast'
import { useDownload } from '@/lib/useDownload'
import { formatCurrency, debounce } from '@/lib/utils'
import { Plus, Trash2, TrendingUp, PieChart, List, CheckCircle, Circle, Download, Wand2 } from 'lucide-react'

const UNITS = ['Pauschal', 'Tage', 'Stunden', 'Wochen', 'Monate', 'Stück']
const CATEGORIES = [
  '1000 - Stab', '2000 - Kamera', '3000 - Ton', '4000 - Maske/Kostüm',
  '5000 - Darst.', '6000 - Motiv', '7000 - Verwaltung', '8000 - Sonst.',
  '9000 - Post-Produktion', '10000 - Musik'
]

function BudgetLineRow({ line, onDelete }: { line: any; onDelete: () => void }) {
  const [form, setForm] = useState(line)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (data: any) => api.budget.updateLine(line.id, data),
    onSuccess: (updated: any) => {
      queryClient.invalidateQueries({ queryKey: ['budget-lines'] })
      queryClient.invalidateQueries({ queryKey: ['budget-versions'] })
    },
  })

  const debouncedUpdate = useRef(debounce((data: any) => mutation.mutate(data), 500)).current
  const update = (key: string, value: any) => {
    const next = { ...form, [key]: value, total_cents: key === 'quantity' || key === 'unit_price_cents'
      ? Math.round((key === 'quantity' ? value : form.quantity) * (key === 'unit_price_cents' ? value : form.unit_price_cents))
      : form.total_cents
    }
    setForm(next)
    debouncedUpdate(next)
  }

  const total = Math.round(form.quantity * form.unit_price_cents)

  return (
    <tr className="border-b border-border/20 hover:bg-muted/10 group">
      <td className="py-1.5 pl-4 pr-2 w-8 text-xs text-muted-foreground font-mono">{line.account_code}</td>
      <td className="py-1.5 px-2 flex-1">
        <Input value={form.description || ''} onChange={e => update('description', e.target.value)}
          aria-label="Beschreibung der Position"
          className="h-7 text-sm border-0 bg-transparent focus-visible:ring-1" />
      </td>
      <td className="py-1.5 px-2 w-24">
        <Select value={form.unit || 'Pauschal'} onValueChange={v => update('unit', v)}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u} className="text-xs">{u}</SelectItem>)}</SelectContent>
        </Select>
      </td>
      <td className="py-1.5 px-2 w-16">
        <Input type="number" value={form.quantity || 1} onChange={e => update('quantity', Number(e.target.value))}
          aria-label={`Menge${form.description ? ` für ${form.description}` : ''}`}
          className="h-7 text-xs text-right" step="0.5" min="0" />
      </td>
      <td className="py-1.5 px-2 w-28">
        <div className="relative">
          <Input type="number" value={(form.unit_price_cents || 0) / 100}
            aria-label={`Einzelpreis in Euro${form.description ? ` für ${form.description}` : ''}`}
            onChange={e => update('unit_price_cents', Math.round(Number(e.target.value) * 100))}
            className="h-7 text-xs text-right pr-5" step="0.01" />
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
        </div>
      </td>
      <td className="py-1.5 px-2 w-28 text-right font-mono text-sm font-medium">
        {formatCurrency(total)}
      </td>
      <td className="py-1.5 pr-3 w-8">
        <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  )
}

function FinancingRow({ entry, total, onDelete }: { entry: any; total: number; onDelete: () => void }) {
  const [form, setForm] = useState(entry)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (data: any) => api.financing.updateEntry(entry.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['financing-entries'] }),
  })

  const debouncedUpdate = useRef(debounce((data: any) => mutation.mutate(data), 500)).current
  const update = (key: string, value: any) => {
    const next = { ...form, [key]: value }
    setForm(next)
    debouncedUpdate(next)
  }

  const pct = total > 0 ? ((form.amount_cents || 0) / total * 100).toFixed(1) : '0'

  return (
    <tr className="border-b border-border/20 hover:bg-muted/10 group">
      <td className="py-2 pl-4 pr-2">
        <Input value={form.source || ''} onChange={e => update('source', e.target.value)}
          aria-label="Geldgeber oder Quelle"
          className="h-7 text-sm border-0 bg-transparent focus-visible:ring-1" />
      </td>
      <td className="py-2 px-2 w-32">
        <Select value={form.type || 'Förderung'} onValueChange={v => update('type', v)}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {['Förderung regional', 'Förderung national', 'Sender', 'Eigenmittel', 'Co-Produktion', 'Vertrieb', 'Sonstiges'].map(t => (
              <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="py-2 px-2 w-36">
        <div className="relative">
          <Input type="number" value={(form.amount_cents || 0) / 100}
            aria-label={`Betrag in Euro${form.source ? ` von ${form.source}` : ''}`}
            onChange={e => update('amount_cents', Math.round(Number(e.target.value) * 100))}
            className="h-7 text-sm text-right font-mono pr-5" />
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
        </div>
      </td>
      <td className="py-2 px-2 w-16 text-right text-sm text-muted-foreground font-mono">{pct}%</td>
      <td className="py-2 px-2 w-20">
        <button onClick={() => update('confirmed', !form.confirmed)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
          {form.confirmed ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4" />}
          {form.confirmed ? 'Bestätigt' : 'Offen'}
        </button>
      </td>
      <td className="py-2 pr-3 w-8">
        <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  )
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const download = useDownload()
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null)
  const [selectedFinVersionId, setSelectedFinVersionId] = useState<number | null>(null)
  const [newCategory, setNewCategory] = useState(CATEGORIES[0])

  const { data: versions } = useQuery({
    queryKey: ['budget-versions', pid],
    queryFn: () => api.budget.listVersions(pid),
  })

  const { data: finVersions } = useQuery({
    queryKey: ['financing-versions', pid],
    queryFn: () => api.financing.listVersions(pid),
  })

  useEffect(() => {
    if (versions?.length && !selectedVersionId) setSelectedVersionId(versions[0].id)
    if (finVersions?.length && !selectedFinVersionId) setSelectedFinVersionId(finVersions[0].id)
  }, [versions, finVersions])

  const { data: lines, isLoading: linesLoading } = useQuery({
    queryKey: ['budget-lines', selectedVersionId],
    queryFn: () => api.budget.listLines(selectedVersionId!),
    enabled: !!selectedVersionId,
  })

  const { data: finEntries, isLoading: finLoading } = useQuery({
    queryKey: ['financing-entries', selectedFinVersionId],
    queryFn: () => api.financing.listEntries(selectedFinVersionId!),
    enabled: !!selectedFinVersionId,
  })

  const createLine = useMutation({
    mutationFn: (category: string) => api.budget.createLine(selectedVersionId!, {
      category, description: 'Neue Position', unit: 'Pauschal', quantity: 1, unit_price_cents: 0
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-lines', selectedVersionId] })
      queryClient.invalidateQueries({ queryKey: ['budget-versions', pid] })
    },
  })

  const deleteLine = useMutation({
    mutationFn: (id: number) => api.budget.deleteLine(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-lines', selectedVersionId] })
      queryClient.invalidateQueries({ queryKey: ['budget-versions', pid] })
    },
  })

  const createFinEntry = useMutation({
    mutationFn: () => api.financing.createEntry(selectedFinVersionId!, { source: 'Neuer Geldgeber', type: 'Förderung', amount_cents: 0 }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['financing-entries', selectedFinVersionId] }),
  })

  const deleteFinEntry = useMutation({
    mutationFn: (id: number) => api.financing.deleteEntry(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['financing-entries', selectedFinVersionId] }),
  })

  const currentVersion = versions?.find((v: any) => v.id === selectedVersionId)
  const totalBudget = currentVersion?.total_cents || 0

  const grouped = (lines || []).reduce((acc: Record<string, any[]>, line: any) => {
    const cat = line.category || 'Sonstiges'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(line)
    return acc
  }, {} as Record<string, any[]>)

  const catTotals = Object.fromEntries(
    Object.entries(grouped).map(([cat, items]) => [
      cat,
      (items as any[]).reduce((sum, l) => sum + (l.total_cents || 0), 0)
    ])
  )

  const finTotal = (finEntries || []).reduce((sum: number, e: any) => sum + (e.amount_cents || 0), 0)

  // Kosten aus Besetzung, Stab, Equipment und Versicherungen holen.
  // Erst zeigen, was passieren wuerde - eine Kalkulation, die sich unter der
  // Hand aendert, ist schlimmer als eine, die man selbst fuellt.
  const [vorschau, setVorschau] = useState<any>(null)
  const kostenVorschau = useMutation({
    mutationFn: () => api.budget.kostenUebernehmen(selectedVersionId!, true),
    onSuccess: setVorschau,
    onError: (e: any) => toast({ variant: 'destructive', title: 'Fehler', description: e.message }),
  })
  const kostenUebernehmen = useMutation({
    mutationFn: () => api.budget.kostenUebernehmen(selectedVersionId!, false),
    onSuccess: (r: any) => {
      setVorschau(null)
      queryClient.invalidateQueries({ queryKey: ['budget-lines', selectedVersionId] })
      queryClient.invalidateQueries({ queryKey: ['budget-versions', pid] })
      toast({ title: 'Kosten übernommen',
        description: `${r.neu} neu, ${r.geaendert} aktualisiert, ${r.entfallen} entfernt.` })
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Fehler', description: e.message }),
  })

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <PageHeader title="Kalkulation & Finanzierung" subtitle="Budget und Finanzierungsplan" />

      {vorschau && (
        <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="font-semibold text-sm">Das würde sich ändern</p>
          <p className="text-[13px] text-muted-foreground mt-1">
            {vorschau.neu} neue {vorschau.neu === 1 ? 'Position' : 'Positionen'},{' '}
            {vorschau.geaendert} aktualisiert, {vorschau.entfallen} entfernt,{' '}
            {vorschau.unveraendert} unverändert. Summe aus den Quellen:{' '}
            <b>{formatCurrency(vorschau.summe_cent)}</b>.
          </p>
          <p className="text-[12px] text-muted-foreground/80 mt-2 leading-relaxed">
            Von Hand eingetragene Positionen bleiben unangetastet. Übernommene Positionen
            werden beim nächsten Lauf aktualisiert statt doppelt angelegt.
          </p>
          {vorschau.ohne_drehtag?.length > 0 && (
            <p className="text-[12px] text-warning mt-2 leading-relaxed">
              Ohne Position, weil auf keiner Tagesdispo:{' '}
              {vorschau.ohne_drehtag.join(', ')}. Erst eintragen, dann erneut übernehmen.
            </p>
          )}
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={() => kostenUebernehmen.mutate()} disabled={kostenUebernehmen.isPending}>
              Übernehmen
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setVorschau(null)}>Abbrechen</Button>
          </div>
        </div>
      )}

      <Tabs defaultValue="kalkulation">
        <TabsList>
          <TabsTrigger value="kalkulation" className="gap-2"><List className="w-4 h-4" />Kalkulation</TabsTrigger>
          <TabsTrigger value="finanzierung" className="gap-2"><PieChart className="w-4 h-4" />Finanzierungsplan</TabsTrigger>
        </TabsList>

        {/* ── KALKULATION ── */}
        <TabsContent value="kalkulation" className="space-y-4 mt-4">
          {/* Fassungswahl links, Summe und Werkzeuge rechts — am Telefon
              untereinander, sonst beginnt die Werkzeugleiste bei x=232 */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {versions && versions.length > 0 && (
                <Select value={String(selectedVersionId)} onValueChange={v => setSelectedVersionId(Number(v))}>
                  <SelectTrigger className="w-full sm:w-52 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{versions.map((v: any) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-lg font-bold">{formatCurrency(totalBudget)}</span>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" onClick={() => createLine.mutate(newCategory)} disabled={!selectedVersionId || createLine.isPending}>
                  <Plus className="w-4 h-4 mr-1" />Position
                </Button>
                {selectedVersionId && (
                  <Button variant="outline" size="sm" onClick={() => kostenVorschau.mutate()}
                    disabled={kostenVorschau.isPending || kostenUebernehmen.isPending}>
                    <Wand2 className="w-4 h-4 mr-1" />Kosten übernehmen
                  </Button>
                )}
                {selectedVersionId && (
                  <Button variant="outline" size="sm" onClick={() => download(api.pdf.kalkulation(pid, selectedVersionId), 'kalkulation.pdf')}>
                      <Download className="w-4 h-4 mr-1" />PDF
                    </Button>
                )}
              </div>
            </div>
          </div>

          {/* Nebeneinander ab lg, am Telefon untereinander: die Summen-Spalte
              liess der Tabelle sonst 119 px */}
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Category totals sidebar */}
            <div className="w-full lg:w-52 lg:shrink-0 space-y-1">
              {Object.entries(catTotals).sort().map(([cat, total]) => (
                <div key={cat} className="flex items-center justify-between text-xs p-2 rounded bg-muted/30">
                  <span className="truncate text-muted-foreground">{cat.split(' - ')[1] || cat}</span>
                  <span className="font-mono font-medium shrink-0 ml-1">{formatCurrency(total as number)}</span>
                </div>
              ))}
              {totalBudget > 0 && (
                <div className="flex items-center justify-between text-sm p-2 rounded bg-primary/20 font-bold mt-2">
                  <span>Gesamt</span>
                  <span className="font-mono">{formatCurrency(totalBudget)}</span>
                </div>
              )}
            </div>

            {/* Main table */}
            <div className="flex-1 overflow-x-auto">
              {linesLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <table className="w-full border rounded-lg overflow-hidden min-w-[560px]">
                  <thead className="bg-muted/30">
                    <tr className="text-xs text-muted-foreground">
                      <th className="text-left py-2 pl-4 w-8">Kto</th>
                      <th className="text-left py-2 px-2">Beschreibung</th>
                      <th className="text-left py-2 px-2 w-24">Einheit</th>
                      <th className="text-right py-2 px-2 w-16">Menge</th>
                      <th className="text-right py-2 px-2 w-28">Einzelpreis</th>
                      <th className="text-right py-2 px-2 w-28">Gesamt</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {CATEGORIES.filter(cat => grouped[cat]?.length > 0).map(cat => (
                      <>
                        <tr key={`header-${cat}`} className="bg-muted/50">
                          <td colSpan={5} className="py-1.5 pl-4 text-xs font-semibold text-muted-foreground">{cat}</td>
                          <td className="py-1.5 pr-4 text-right text-xs font-mono font-semibold">{formatCurrency(catTotals[cat] || 0)}</td>
                          <td />
                        </tr>
                        {(grouped[cat] || []).map((line: any) => (
                          <BudgetLineRow key={line.id} line={line} onDelete={() => deleteLine.mutate(line.id)} />
                        ))}
                      </>
                    ))}
                    {(!lines || lines.length === 0) && (
                      <tr><td colSpan={7} className="py-8 text-center text-muted-foreground text-sm">Noch keine Positionen. Wähle eine Kategorie und klicke „Position".</td></tr>
                    )}
                  </tbody>
                  {lines && lines.length > 0 && (
                    <tfoot className="sticky bottom-0 bg-card border-t-2 border-border shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
                      <tr>
                        <td colSpan={5} className="py-2.5 pl-4 text-sm font-bold uppercase tracking-wide">Gesamtbudget</td>
                        <td className="py-2.5 pr-4 text-right font-mono text-base font-black text-primary">{formatCurrency(totalBudget)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── FINANZIERUNGSPLAN ── */}
        <TabsContent value="finanzierung" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            {finVersions && finVersions.length > 0 && (
              <Select value={String(selectedFinVersionId)} onValueChange={v => setSelectedFinVersionId(Number(v))}>
                <SelectTrigger className="w-52 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>{finVersions.map((v: any) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold">{formatCurrency(finTotal)}</span>
              <Button size="sm" onClick={() => createFinEntry.mutate()} disabled={!selectedFinVersionId || createFinEntry.isPending}>
                <Plus className="w-4 h-4 mr-1" />Geldgeber
              </Button>
            </div>
          </div>

          {/* Visual breakdown */}
          {finEntries && finEntries.length > 0 && (
            <div className="grid grid-cols-2 gap-4 mb-2">
              {(finEntries as any[]).map((e: any) => {
                const pct = finTotal > 0 ? (e.amount_cents / finTotal * 100) : 0
                return (
                  <div key={e.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card/30">
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium truncate">{e.source}</span>
                        <span className="font-mono shrink-0 ml-2">{formatCurrency(e.amount_cents)}</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                      <p className="text-xs text-muted-foreground mt-0.5">{pct.toFixed(1)}% · {e.type}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {finLoading ? <Skeleton className="h-48" /> : (
            <div className="overflow-x-auto">
              <table className="w-full border rounded-lg overflow-hidden min-w-[560px]">
                <thead className="bg-muted/30">
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-left py-2 pl-4">Geldgeber / Quelle</th>
                    <th className="text-left py-2 px-2 w-40">Typ</th>
                    <th className="text-right py-2 px-2 w-36">Betrag</th>
                    <th className="text-right py-2 px-2 w-16">Anteil</th>
                    <th className="text-left py-2 px-2 w-24">Status</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {(finEntries || []).map((e: any) => (
                    <FinancingRow key={e.id} entry={e} total={finTotal} onDelete={() => deleteFinEntry.mutate(e.id)} />
                  ))}
                  {(!finEntries || finEntries.length === 0) && (
                    <tr><td colSpan={6} className="py-8 text-center text-muted-foreground text-sm">Noch keine Einträge.</td></tr>
                  )}
                </tbody>
                {finEntries && finEntries.length > 0 && (
                  <tfoot className="bg-muted/30">
                    <tr>
                      <td colSpan={2} className="py-2 pl-4 text-sm font-semibold">Gesamt</td>
                      <td className="py-2 px-2 text-right font-mono font-bold">{formatCurrency(finTotal)}</td>
                      <td className="py-2 px-2 text-right text-sm font-mono">100%</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
