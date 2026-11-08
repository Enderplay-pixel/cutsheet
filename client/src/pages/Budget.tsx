import { Fragment, useState, useEffect, useRef } from 'react'
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
import { useT } from '@/lib/useT'
import { budgetT as T, EINHEIT_TEXT, FINANZIERUNGSART_TEXT } from '@/lib/texte/Budget'
import { useProjectPerms } from '@/contexts/ProjectRoleContext'

const UNITS = ['Pauschal', 'Tage', 'Stunden', 'Wochen', 'Monate', 'Stück']
const CATEGORIES = [
  '1000 - Stab', '2000 - Kamera', '3000 - Ton', '4000 - Maske/Kostüm',
  '5000 - Darst.', '6000 - Motiv', '7000 - Verwaltung', '8000 - Sonst.',
  '9000 - Post-Produktion', '10000 - Musik'
]
const FINANZIERUNGSARTEN = Object.keys(FINANZIERUNGSART_TEXT)

// Ein geleertes Zahlenfeld ist ein Zwischenstand beim Tippen. Vorher sprang die
// Menge sofort auf 1, aus "3" tippen wurde "13" (gemessen am 01.11.2026).
const zahl = (wert: string) => (wert === '' ? '' : Number(wert))
const cent = (wert: string) => (wert === '' ? '' : Math.round(Number(wert) * 100))
const euro = (c: any) => (c === '' || c == null ? '' : c / 100)
const loeschenBestaetigt = (frage: string, name: string) => window.confirm(frage.replace('{name}', name))

function BudgetLineRow({ line, onDelete, darf }: { line: any; onDelete: () => void; darf: boolean }) {
  const [form, setForm] = useState(line)
  const queryClient = useQueryClient()
  const tt = useT()
  const offen = useRef(false)

  const mutation = useMutation({
    mutationFn: (data: any) => api.budget.updateLine(line.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-lines'] })
      queryClient.invalidateQueries({ queryKey: ['budget-versions'] })
    },
  })

  // "Kosten übernehmen" ändert Zeilen auf dem Server. Vorher blieb das Formular
  // beim ersten Stand stehen und schickte ihn beim nächsten Tippen zurück -
  // gemessen am 01.11.2026: übernommene 2.500 € wurden wieder 1.200 €.
  // Übernommen wird nur, solange hier nichts auf das Speichern wartet.
  useEffect(() => {
    if (!offen.current && !mutation.isPending) setForm(line)
  }, [line])

  const debouncedUpdate = useRef(debounce((data: any) => {
    offen.current = false
    mutation.mutate(data)
  }, 500)).current
  const summe = (f: any) => Math.round((Number(f.quantity) || 0) * (Number(f.unit_price_cents) || 0))
  const update = (key: string, value: any) => {
    const next = { ...form, [key]: value }
    setForm(next)
    offen.current = true
    debouncedUpdate({ ...next, quantity: Number(next.quantity) || 0, unit_price_cents: Number(next.unit_price_cents) || 0, total_cents: summe(next) })
  }

  const total = summe(form)

  return (
    <tr className="border-b border-border/20 hover:bg-muted/10 group">
      <td className="py-1.5 pl-4 pr-2 w-8 text-xs text-muted-foreground font-mono">{line.account_code}</td>
      <td className="py-1.5 px-2 flex-1">
        <Input value={form.description || ''} onChange={e => update('description', e.target.value)}
          disabled={!darf} aria-label={tt(T.beschreibungPos)}
          className="h-7 text-sm border-0 bg-transparent focus-visible:ring-1" />
      </td>
      <td className="py-1.5 px-2 w-24">
        <Select value={form.unit || 'Pauschal'} onValueChange={v => update('unit', v)} disabled={!darf}>
          <SelectTrigger aria-label={tt(T.einheit)} className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u} className="text-xs">{EINHEIT_TEXT[u] ? tt(EINHEIT_TEXT[u]) : u}</SelectItem>)}</SelectContent>
        </Select>
      </td>
      <td className="py-1.5 px-2 w-16">
        <Input type="number" value={form.quantity ?? ''} onChange={e => update('quantity', zahl(e.target.value))}
          disabled={!darf} aria-label={form.description ? tt(T.mengeFuer).replace('{name}', form.description) : tt(T.menge)}
          className="h-7 text-xs text-right" step="0.5" min="0" />
      </td>
      <td className="py-1.5 px-2 w-28">
        <div className="relative">
          <Input type="number" value={euro(form.unit_price_cents)} disabled={!darf}
            aria-label={form.description ? tt(T.einzelpreisFuer).replace('{name}', form.description) : tt(T.einzelpreisEuro)}
            onChange={e => update('unit_price_cents', cent(e.target.value))}
            className="h-7 text-xs text-right pr-5" step="0.01" />
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
        </div>
      </td>
      <td className="py-1.5 px-2 w-28 text-right font-mono text-sm font-medium">
        {formatCurrency(total)}
      </td>
      <td className="py-1.5 pr-3 w-8">
        {darf && <button onClick={onDelete} aria-label={tt(T.positionLoeschenN).replace('{name}', line.description || line.account_code || '')} title={tt(T.positionLoeschen)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
          <Trash2 className="w-3.5 h-3.5" />
        </button>}
      </td>
    </tr>
  )
}

function FinancingRow({ entry, total, onDelete, darf }: { entry: any; total: number; onDelete: () => void; darf: boolean }) {
  const [form, setForm] = useState(entry)
  const queryClient = useQueryClient()
  const tt = useT()

  const mutation = useMutation({
    mutationFn: (data: any) => api.financing.updateEntry(entry.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['financing-entries'] }),
  })

  const debouncedUpdate = useRef(debounce((data: any) => mutation.mutate(data), 500)).current
  const update = (key: string, value: any) => {
    const next = { ...form, [key]: value }
    setForm(next)
    debouncedUpdate({ ...next, amount_cents: Number(next.amount_cents) || 0 })
  }

  const pct = total > 0 ? ((Number(form.amount_cents) || 0) / total * 100).toFixed(1) : '0'
  // Demo-Daten und der Server legen "Förderung" an, die Auswahl kannte nur
  // "Förderung regional" und "national" - das Feld stand leer da.
  const arten = FINANZIERUNGSARTEN.includes(form.type) || !form.type ? FINANZIERUNGSARTEN : [...FINANZIERUNGSARTEN, form.type]

  return (
    <tr className="border-b border-border/20 hover:bg-muted/10 group">
      <td className="py-2 pl-4 pr-2">
        <Input value={form.source || ''} onChange={e => update('source', e.target.value)}
          disabled={!darf} aria-label={tt(T.geldgeberQuelle)}
          className="h-7 text-sm border-0 bg-transparent focus-visible:ring-1" />
      </td>
      <td className="py-2 px-2 w-32">
        <Select value={form.type || 'Förderung'} onValueChange={v => update('type', v)} disabled={!darf}>
          <SelectTrigger aria-label={tt(T.typ)} className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {arten.map(t => (
              <SelectItem key={t} value={t} className="text-xs">{FINANZIERUNGSART_TEXT[t] ? tt(FINANZIERUNGSART_TEXT[t]) : t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="py-2 px-2 w-36">
        <div className="relative">
          <Input type="number" value={euro(form.amount_cents)} disabled={!darf}
            aria-label={form.source ? tt(T.betragVon).replace('{name}', form.source) : tt(T.betragEuro)}
            onChange={e => update('amount_cents', cent(e.target.value))}
            className="h-7 text-sm text-right font-mono pr-5" />
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
        </div>
      </td>
      <td className="py-2 px-2 w-16 text-right text-sm text-muted-foreground font-mono">{pct}%</td>
      <td className="py-2 px-2 w-20">
        <button onClick={() => update('confirmed', !form.confirmed)} disabled={!darf} aria-pressed={!!form.confirmed}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary disabled:hover:text-muted-foreground">
          {form.confirmed ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4" />}
          {form.confirmed ? tt(T.bestaetigt) : tt(T.offen)}
        </button>
      </td>
      <td className="py-2 pr-3 w-8">
        {darf && <button onClick={onDelete} aria-label={tt(T.finPostenLoeschen)} title={tt(T.postenLoeschen)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
          <Trash2 className="w-3.5 h-3.5" />
        </button>}
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
  const tt = useT()
  // Budget und Finanzierung schreibt der Server erst ab Produktion
  // (ROUTE_OVERRIDES). Gemessen am 01.11.2026 mit einer Abteilungsleitung:
  // alle Felder und Knöpfe offen, jede Änderung 403.
  const { canEditBudget: darf } = useProjectPerms()
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

  /**
   * Fassung bei Bedarf anlegen. Ein neues Projekt hat weder Kalkulation noch
   * Finanzierungsplan, und angelegt wurde beides nirgends - gemessen am
   * 01.11.2026 an einem frisch angelegten Projekt: "Position" gesperrt,
   * "Kosten übernehmen" fehlte, die Seite war nur für Demo-Projekte nutzbar.
   */
  const kalkulationsFassung = async (): Promise<number> => {
    if (selectedVersionId) return selectedVersionId
    const v = await api.budget.createVersion(pid, { name: tt(T.kalkulation) })
    setSelectedVersionId(v.id)
    queryClient.invalidateQueries({ queryKey: ['budget-versions', pid] })
    return v.id
  }
  const finanzierungsFassung = async (): Promise<number> => {
    if (selectedFinVersionId) return selectedFinVersionId
    const v = await api.financing.createVersion(pid, { name: tt(T.finanzierungsplan) })
    setSelectedFinVersionId(v.id)
    queryClient.invalidateQueries({ queryKey: ['financing-versions', pid] })
    return v.id
  }

  const createLine = useMutation({
    mutationFn: async (category: string) => api.budget.createLine(await kalkulationsFassung(), {
      category, description: 'Neue Position', unit: 'Pauschal', quantity: 1, unit_price_cents: 0 // texte-ok
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-lines'] })
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
    mutationFn: async () => api.financing.createEntry(await finanzierungsFassung(), { source: tt(T.neuerGeldgeber), type: 'Förderung', amount_cents: 0 }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['financing-entries'] }),
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
    acc[cat].push(line) // texte-ok
    return acc
  }, {} as Record<string, any[]>)

  /**
   * Erst die Standardgruppen des deutschen Kalkulationsschemas, dann alles
   * Weitere, was tatsächlich in den Zeilen steht.
   *
   * Vorher wurde nur über CATEGORIES gelaufen. Die Kostenübernahme legt aber
   * Zeilen in "Gagen Stab", "Gagen Besetzung", "Equipment" und
   * "Versicherungen" an - gemessen am 26.09.2026: die Summe zählte sie mit,
   * die Tabelle zeigte sie nicht. Geld, das dasteht und nirgends zu finden
   * ist, ist schlimmer als kein Geld.
   */
  const sichtbareGruppen = [
    ...CATEGORIES.filter(cat => grouped[cat]?.length > 0),
    ...Object.keys(grouped).filter(cat => !CATEGORIES.includes(cat) && grouped[cat].length > 0).sort(),
  ]

  const catTotals = Object.fromEntries(
    Object.entries(grouped).map(([cat, items]) => [
      cat,
      (items as any[]).reduce((sum, l) => sum + (l.total_cents || 0), 0)
    ])
  )

  const finTotal = (finEntries || []).reduce((sum: number, e: any) => sum + (e.amount_cents || 0), 0)

  // Positionen landen im Papierkorb (papierkorbWaechter, `budget-lines`) und
  // gehen ohne Rückfrage. Finanzierungsposten löscht der Server endgültig.
  const positionLoeschen = (line: any) => deleteLine.mutate(line.id)
  const postenLoeschen = (e: any) => {
    if (loeschenBestaetigt(tt(T.loeschenFrage), e.source || tt(T.geldgeber))) deleteFinEntry.mutate(e.id)
  }

  // Kosten aus Besetzung, Stab, Equipment und Versicherungen holen.
  // Erst zeigen, was passieren wuerde - eine Kalkulation, die sich unter der
  // Hand aendert, ist schlimmer als eine, die man selbst fuellt.
  const [vorschau, setVorschau] = useState<any>(null)
  const kostenVorschau = useMutation({
    mutationFn: async () => api.budget.kostenUebernehmen(await kalkulationsFassung(), true),
    onSuccess: setVorschau,
    onError: (e: any) => toast({ variant: 'destructive', title: tt(T.fehler), description: e.message }),
  })
  const kostenUebernehmen = useMutation({
    mutationFn: () => api.budget.kostenUebernehmen(selectedVersionId!, false),
    onSuccess: (r: any) => {
      setVorschau(null)
      queryClient.invalidateQueries({ queryKey: ['budget-lines'] })
      queryClient.invalidateQueries({ queryKey: ['budget-versions', pid] })
      toast({ title: tt(T.kostenUebernommen),
        description: tt(T.kostenErgebnis).replace('{neu}', String(r.neu)).replace('{geaendert}', String(r.geaendert)).replace('{entfallen}', String(r.entfallen)) })
    },
    onError: (e: any) => toast({ variant: 'destructive', title: tt(T.fehler), description: e.message }),
  })

  return (
    <div className="px-5 py-6 sm:p-6 max-w-6xl mx-auto space-y-4">
      <PageHeader title={tt(T.titel)} subtitle={tt(T.untertitel)} />
      {!darf && <p className="text-xs text-muted-foreground">{tt(T.nurProduktion)}</p>}

      {vorschau && (
        <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="font-semibold text-sm">{tt(T.vorschauTitel)}</p>
          <p className="text-[13px] text-muted-foreground mt-1">
            {tt(vorschau.neu === 1 ? T.vorschauEine : T.vorschauMehrere)
              .replace('{neu}', String(vorschau.neu))
              .replace('{geaendert}', String(vorschau.geaendert))
              .replace('{entfallen}', String(vorschau.entfallen))
              .replace('{unveraendert}', String(vorschau.unveraendert))}{' '}
            <b>{formatCurrency(vorschau.summe_cent)}</b>.
          </p>
          <p className="text-[12px] text-muted-foreground/80 mt-2 leading-relaxed">
            {tt(T.vorschauHinweis)}
          </p>
          {vorschau.ohne_drehtag?.length > 0 && (
            <p className="text-[12px] text-warning mt-2 leading-relaxed">
              {tt(T.ohneDrehtag).replace('{namen}', vorschau.ohne_drehtag.join(', '))}
            </p>
          )}
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={() => kostenUebernehmen.mutate()} disabled={kostenUebernehmen.isPending}>
              {tt(T.uebernehmen)}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setVorschau(null)}>{tt(T.abbrechen)}</Button>
          </div>
        </div>
      )}

      <Tabs defaultValue="kalkulation">
        <TabsList data-einfuehrung="reiter">
          <TabsTrigger value="kalkulation" className="gap-2"><List className="w-4 h-4" />{tt(T.kalkulation)}</TabsTrigger>
          <TabsTrigger value="finanzierung" className="gap-2"><PieChart className="w-4 h-4" />{tt(T.finanzierungsplan)}</TabsTrigger>
        </TabsList>

        {/* ── KALKULATION ── */}
        <TabsContent value="kalkulation" className="space-y-4 mt-4">
          {/* Fassungswahl links, Summe und Werkzeuge rechts - am Telefon
              untereinander, sonst beginnt die Werkzeugleiste bei x=232 */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {versions && versions.length > 0 && (
                <Select value={String(selectedVersionId)} onValueChange={v => setSelectedVersionId(Number(v))}>
                  <SelectTrigger aria-label={tt(T.fassungWaehlen)} className="w-full sm:w-52 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{versions.map((v: any) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-lg font-bold">{formatCurrency(totalBudget)}</span>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                {darf && (
                  <>
                    <Select value={newCategory} onValueChange={setNewCategory}>
                      <SelectTrigger aria-label={tt(T.kategorieWaehlen)} className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button size="sm" onClick={() => createLine.mutate(newCategory)} disabled={createLine.isPending}>
                      <Plus className="w-4 h-4 mr-1" />{tt(T.position)}
                    </Button>
                    <Button variant="outline" size="sm" data-einfuehrung="kosten" onClick={() => kostenVorschau.mutate()}
                      disabled={kostenVorschau.isPending || kostenUebernehmen.isPending}>
                      <Wand2 className="w-4 h-4 mr-1" />{tt(T.kostenUebernehmen)}
                    </Button>
                  </>
                )}
                {selectedVersionId && (
                  <Button variant="outline" size="sm" onClick={() => download(api.pdf.kalkulation(pid, selectedVersionId), 'kalkulation.pdf')}>
                      <Download className="w-4 h-4 mr-1" />PDF
                    </Button>
                )}
                <Button variant="outline" size="sm" title={tt(T.foerderTitel)}
                  onClick={() => download(api.foerderantrag.pdf(pid), 'foerderantrag.pdf')}>
                  <Download className="w-4 h-4 mr-1" />{tt(T.foerderantrag)}
                </Button>
              </div>
            </div>
          </div>

          {/* Nebeneinander ab lg, am Telefon untereinander: die Summen-Spalte
              liess der Tabelle sonst 119 px */}
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Category totals sidebar */}
            <div className="w-full lg:w-52 lg:shrink-0 space-y-1">
              {/* Reihenfolge wie die Tabelle - nach Text sortiert stand "10000 - Musik" an zweiter Stelle */}
              {sichtbareGruppen.map(cat => (
                <div key={cat} className="flex items-center justify-between text-xs p-2 rounded bg-muted/30">
                  <span className="truncate text-muted-foreground">{cat.split(' - ')[1] || cat}</span>
                  <span className="font-mono font-medium shrink-0 ml-1">{formatCurrency(catTotals[cat] || 0)}</span>
                </div>
              ))}
              {totalBudget > 0 && (
                <div className="flex items-center justify-between text-sm p-2 rounded bg-primary/20 font-bold mt-2">
                  <span>{tt(T.gesamt)}</span>
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
                      <th className="text-left py-2 pl-4 w-8">{tt(T.kto)}</th>
                      <th className="text-left py-2 px-2">{tt(T.beschreibung)}</th>
                      <th className="text-left py-2 px-2 w-24">{tt(T.einheit)}</th>
                      <th className="text-right py-2 px-2 w-16">{tt(T.menge)}</th>
                      <th className="text-right py-2 px-2 w-28">{tt(T.einzelpreis)}</th>
                      <th className="text-right py-2 px-2 w-28">{tt(T.gesamt)}</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {sichtbareGruppen.map(cat => (
                      <Fragment key={cat}>
                        <tr className="bg-muted/50">
                          <td colSpan={5} className="py-1.5 pl-4 text-xs font-semibold text-muted-foreground">{cat}</td>
                          <td className="py-1.5 pr-4 text-right text-xs font-mono font-semibold">{formatCurrency(catTotals[cat] || 0)}</td>
                          <td />
                        </tr>
                        {(grouped[cat] || []).map((line: any) => (
                          <BudgetLineRow key={line.id} line={line} darf={darf} onDelete={() => positionLoeschen(line)} />
                        ))}
                      </Fragment>
                    ))}
                    {(!lines || lines.length === 0) && (
                      <tr><td colSpan={7} className="py-8 text-center text-muted-foreground text-sm">{tt(T.keinePositionen)}</td></tr>
                    )}
                  </tbody>
                  {lines && lines.length > 0 && (
                    <tfoot className="sticky bottom-0 bg-card border-t-2 border-border shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
                      <tr>
                        <td colSpan={5} className="py-2.5 pl-4 text-sm font-bold uppercase tracking-wide">{tt(T.gesamtbudget)}</td>
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
                <SelectTrigger aria-label={tt(T.finFassungWaehlen)} className="w-52 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>{finVersions.map((v: any) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold">{formatCurrency(finTotal)}</span>
              {darf && (
                <Button size="sm" onClick={() => createFinEntry.mutate()} disabled={createFinEntry.isPending}>
                  <Plus className="w-4 h-4 mr-1" />{tt(T.geldgeber)}
                </Button>
              )}
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
                      <p className="text-xs text-muted-foreground mt-0.5">{pct.toFixed(1)}% · {FINANZIERUNGSART_TEXT[e.type] ? tt(FINANZIERUNGSART_TEXT[e.type]) : e.type}</p>
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
                    <th className="text-left py-2 pl-4">{tt(T.geldgeberSpalte)}</th>
                    <th className="text-left py-2 px-2 w-40">{tt(T.typ)}</th>
                    <th className="text-right py-2 px-2 w-36">{tt(T.betrag)}</th>
                    <th className="text-right py-2 px-2 w-16">{tt(T.anteil)}</th>
                    <th className="text-left py-2 px-2 w-24">{tt(T.status)}</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {(finEntries || []).map((e: any) => (
                    <FinancingRow key={e.id} entry={e} total={finTotal} darf={darf} onDelete={() => postenLoeschen(e)} />
                  ))}
                  {(!finEntries || finEntries.length === 0) && (
                    <tr><td colSpan={6} className="py-8 text-center text-muted-foreground text-sm">{tt(T.keineEintraege)}</td></tr>
                  )}
                </tbody>
                {finEntries && finEntries.length > 0 && (
                  <tfoot className="bg-muted/30">
                    <tr>
                      <td colSpan={2} className="py-2 pl-4 text-sm font-semibold">{tt(T.gesamt)}</td>
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
