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
import { Plus, Trash2, TrendingUp, PieChart, List, CheckCircle, Circle, Download, Wand2, MapPin } from 'lucide-react'
import { useT } from '@/lib/useT'
import { budgetT as T, EINHEIT_TEXT, FINANZIERUNGSART_TEXT } from '@/lib/texte/Budget'
import { useProjectPerms } from '@/contexts/ProjectRoleContext'
import { useSchreibrecht } from '@/lib/useSchreibrecht'
import { NurProduktion } from '@/components/shared/NurProduktion'
import { Checkbox } from '@/components/ui/checkbox'
import { Rechenwerk, NeueFassungDialog, UmstellenDialog, VergleichDialog } from '@/components/budget/Kalkulation'
import { kalkT as K, KOSTENART_TEXT, KOSTENARTEN } from '@/lib/texte/Kalkulation'
import { finT as F, STAND_TEXT, STAENDE } from '@/lib/texte/Finanzierung'
import { ChevronRight } from 'lucide-react'
import { heuteISO } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useGebietsschema } from '@/lib/useT'
import { zeitraumT as Z } from '@/lib/texte/Cashflow'
import { regionT as R } from '@/lib/texte/Regionen'
import { betragInCent } from '@/lib/utils'

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
// Ein leeres Zahlenfeld wird nicht gespeichert, sondern beim Verlassen auf den
// gespeicherten Wert zurückgesetzt. Gemessen am 13.11.2026: "-" getippt, kurz
// gewartet - das Feld ist in diesem Moment leer, nach 500 ms stand Menge 0 auf
// dem Server, das Feld zeigte "0", und die folgende 5 wurde zu "05". Aus
// gewollten -5 wurden still +5, die Zeile kostete 100 Mio. € statt einer
// Fehlermeldung.
const leer = (...werte: any[]) => werte.some(w => w === '')
const loeschenBestaetigt = (frage: string, name: string) => window.confirm(frage.replace('{name}', name))

/** Ein Tag kurz: "02.03.26", ohne Jahr "02.03.". */
function kurzDatum(iso: string, gs: string, mitJahr = true) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(gs, { day: '2-digit', month: '2-digit', ...(mitJahr ? { year: '2-digit' } : {}), timeZone: 'UTC' })
}

/**
 * Zeitraum einer Budgetzeile (AP E2): über ihn verteilt sich der Betrag im
 * Cashflow. Gespeichert wird mit "Speichern" - ein halber Zeitraum ist kein
 * Zwischenstand, den der Server annimmt.
 */
function ZeitraumFeld({ line, darf, speichern }: { line: any; darf: boolean; speichern: (von: string | null, bis: string | null) => Promise<void> }) {
  const tt = useT()
  const gs = useGebietsschema()
  const [offen, setOffen] = useState(false)
  const [von, setVon] = useState('')
  const [bis, setBis] = useState('')
  const [fehler, setFehler] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const oeffnen = (o: boolean) => {
    if (o) { setVon(line.spend_from ?? ''); setBis(line.spend_until ?? ''); setFehler('') }
    setOffen(o)
  }
  const sichern = async (a: string | null, b: string | null) => {
    if ((a === null) !== (b === null)) { setFehler(tt(Z.beideEnden)); return }
    if (a && b && b < a) { setFehler(tt(Z.endeVorAnfang)); return }
    setLaeuft(true)
    try { await speichern(a, b); setOffen(false) } catch (e: any) { setFehler(String(e?.message || '')) } finally { setLaeuft(false) }
  }
  // In der Spalte ohne Jahr - sie ist schmal, damit die Beschreibung Platz
  // behält (gemessen am 16.11.2026 bei 1280 px: 98 px); der volle Zeitraum
  // steht im Titel und im Feld
  const gesetzt = line.spend_from && line.spend_until
  const text = gesetzt
    ? `${kurzDatum(line.spend_from, gs)} ${tt(Z.bis).toLowerCase()} ${kurzDatum(line.spend_until, gs)}`
    : tt(Z.nichtTerminiert)
  const kurz = gesetzt
    ? `${kurzDatum(line.spend_from, gs, false)} ${tt(Z.bis).toLowerCase()} ${kurzDatum(line.spend_until, gs, false)}`
    : text
  return (
    <Popover open={offen} onOpenChange={oeffnen}>
      <PopoverTrigger asChild>
        <button type="button" disabled={!darf} aria-label={`${tt(Z.zeitraumVon).replace('{name}', line.description || '')}: ${text}`} title={text}
          className={`h-7 w-full rounded-md px-1 text-left text-[11px] tabular-nums whitespace-nowrap hover:bg-muted/40 disabled:hover:bg-transparent ${line.spend_from ? '' : 'text-muted-foreground italic'}`}>
          {kurz}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-2">
        <p className="text-xs font-medium">{tt(Z.zeitraumVon).replace('{name}', line.description || '')}</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] text-muted-foreground space-y-1">
            <span>{tt(Z.von)}</span>
            <Input type="date" value={von} onChange={e => setVon(e.target.value)} className="h-8 text-xs" />
          </label>
          <label className="text-[11px] text-muted-foreground space-y-1">
            <span>{tt(Z.bis)}</span>
            <Input type="date" value={bis} onChange={e => setBis(e.target.value)} className="h-8 text-xs" />
          </label>
        </div>
        <p className="text-[11px] text-muted-foreground">{tt(Z.hilfe)}</p>
        {fehler && <p role="alert" className="text-[11px] text-destructive">{fehler}</p>}
        <div className="flex justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" disabled={laeuft || !line.spend_from} onClick={() => sichern(null, null)}>{tt(Z.entfernen)}</Button>
          <Button type="button" size="sm" className="h-7 text-xs" disabled={laeuft} onClick={() => sichern(von || null, bis || null)}>{tt(Z.speichern)}</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Prozent als Text "60" oder "12,5" in Basispunkten; NaN, wenn unlesbar. */
const prozentInBp = (text: string) => {
  const n = Number(String(text).trim().replace(',', '.'))
  return text.trim() === '' || !Number.isFinite(n) ? NaN : Math.round(n * 100)
}
const bpAlsText = (bp: number) => String(bp / 100).replace('.', ',')

/**
 * Zuordnung einer Zeile, unter ihrem Betrag: Rückstellung und Beistellung
 * (AP E4), Anteile an bis zu vier Regionen und die Kennzeichen "deutsche
 * Herstellungskosten" und "interne Kosten" (AP E3). Gespeichert mit
 * "Speichern"; an der Zeile steht, was gesetzt ist.
 */
function ZuordnungFeld({ line, darf, summe, regionen, speichern, regionenSpeichern }: {
  line: any; darf: boolean; summe: number; regionen: any[]
  speichern: (felder: Record<string, unknown>) => Promise<void>
  regionenSpeichern: (anteile: Array<{ region_id: number; share_bp: number }>) => Promise<void>
}) {
  const tt = useT()
  const [offen, setOffen] = useState(false)
  const [zurueck, setZurueck] = useState('')
  const [bei, setBei] = useState('')
  const [anteile, setAnteile] = useState<Array<{ region_id: string; prozent: string }>>([])
  const [deutsch, setDeutsch] = useState(true)
  const [intern, setIntern] = useState(false)
  const [fehler, setFehler] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const z = Number(line.deferred_cents) || 0
  const b = Number(line.in_kind_cents) || 0
  const zeilenAnteile: any[] = line.regionen ?? []
  const istDeutsch = line.german_spend !== false
  const istIntern = line.internal === true
  const alsText = (c: number) => (c ? String(c / 100).replace('.', ',') : '')
  const regionsName = (id: number) => regionen.find((r: any) => r.id === id)?.name ?? '?'
  const oeffnen = (o: boolean) => {
    if (o) {
      setZurueck(alsText(z)); setBei(alsText(b)); setFehler('')
      setAnteile(zeilenAnteile.map((a) => ({ region_id: String(a.region_id), prozent: bpAlsText(a.share_bp) })))
      setDeutsch(istDeutsch); setIntern(istIntern)
    }
    setOffen(o)
  }
  const sichern = async () => {
    const zc = betragInCent(zurueck)
    const bc = betragInCent(bei)
    if (Number.isNaN(zc) || Number.isNaN(bc) || zc < 0 || bc < 0) { setFehler(tt(K.anteileUnlesbar)); return }
    if (zc + bc > summe) { setFehler(tt(K.anteileZuViel).replace('{summe}', formatCurrency(summe))); return }
    const neu = anteile.map((a) => ({ region_id: Number(a.region_id), share_bp: prozentInBp(a.prozent) }))
    if (neu.some((a) => Number.isNaN(a.share_bp) || a.share_bp <= 0 || a.share_bp > 10_000)) { setFehler(tt(R.anteilUnlesbar)); return }
    if (neu.some((a) => !a.region_id) || new Set(neu.map((a) => a.region_id)).size !== neu.length) { setFehler(tt(R.anteilOhneRegion)); return }
    const gesamt = neu.reduce((s, a) => s + a.share_bp, 0)
    if (gesamt > 10_000) { setFehler(tt(R.anteileZuViel).replace('{summe}', bpAlsText(gesamt))); return }
    setLaeuft(true)
    try {
      if (zc !== z || bc !== b || deutsch !== istDeutsch || intern !== istIntern) {
        await speichern({ deferred_cents: zc, in_kind_cents: bc, german_spend: deutsch, internal: intern })
      }
      const vorher = JSON.stringify(zeilenAnteile.map((a) => [a.region_id, a.share_bp]))
      if (JSON.stringify(neu.map((a) => [a.region_id, a.share_bp])) !== vorher) await regionenSpeichern(neu)
      setOffen(false)
    } catch (e: any) { setFehler(String(e?.message || '')) } finally { setLaeuft(false) }
  }
  const gesetzt = z > 0 || b > 0 || zeilenAnteile.length > 0 || !istDeutsch || istIntern
  if (!darf && !gesetzt) return null
  const name = line.description || line.account_code || ''
  const regionenText = zeilenAnteile.map((a) => `${regionsName(a.region_id)} ${bpAlsText(a.share_bp)} %`).join(' · ')
  return (
    <Popover open={offen} onOpenChange={oeffnen}>
      <PopoverTrigger asChild>
        <button type="button" disabled={!darf} aria-label={tt(R.zuordnung).replace('{name}', name)} title={gesetzt ? [regionenText, tt(K.anteileHilfe)].filter(Boolean).join(' - ') : tt(K.anteileTitel)}
          className={`block ml-auto max-w-[7rem] text-[10px] leading-tight font-sans font-normal text-right ${gesetzt ? 'text-primary' : 'text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}`}>
          {gesetzt ? (
            <>
              {z > 0 && <span className="block">{tt(K.zurueckKurz).replace('{betrag}', formatCurrency(z))}</span>}
              {b > 0 && <span className="block">{tt(K.beiKurz).replace('{betrag}', formatCurrency(b))}</span>}
              {regionenText && <span className="block truncate">{regionenText}</span>}
              {(!istDeutsch || istIntern) && <span className="block">{[!istDeutsch ? tt(R.nichtDeutschKurz) : '', istIntern ? tt(R.internKurz) : ''].filter(Boolean).join(' · ')}</span>}
            </>
          ) : tt(R.zuordnungKurz)}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <p className="text-xs font-medium">{tt(R.zuordnung).replace('{name}', name)}</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] text-muted-foreground space-y-1">
            <span>{tt(K.zurueckgestellt)}</span>
            <Input value={zurueck} onChange={e => setZurueck(e.target.value)} inputMode="decimal" className="h-8 text-xs text-right" />
          </label>
          <label className="text-[11px] text-muted-foreground space-y-1">
            <span>{tt(K.beigestellt)}</span>
            <Input value={bei} onChange={e => setBei(e.target.value)} inputMode="decimal" className="h-8 text-xs text-right" />
          </label>
        </div>
        <p className="text-[11px] text-muted-foreground">{tt(K.anteileHilfe)}</p>
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground">{tt(R.anteile)}</p>
          {regionen.length === 0 ? <p className="text-[11px] italic text-muted-foreground">{tt(R.keineRegionenZeile)}</p> : (
            <>
              {anteile.map((a, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <select value={a.region_id} aria-label={tt(R.regionWaehlen).replace('{n}', String(i + 1))}
                    onChange={e => setAnteile(alt => alt.map((x, j) => j === i ? { ...x, region_id: e.target.value } : x))}
                    className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs">
                    <option value="">-</option>
                    {regionen.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <Input value={a.prozent} inputMode="decimal" aria-label={tt(R.anteilVon).replace('{n}', String(i + 1))}
                    onChange={e => setAnteile(alt => alt.map((x, j) => j === i ? { ...x, prozent: e.target.value } : x))}
                    className="h-8 w-16 text-xs text-right" />
                  <span className="text-xs text-muted-foreground">%</span>
                  <button type="button" aria-label={tt(R.anteilWeg)} onClick={() => setAnteile(alt => alt.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              {anteile.length < 4 && (
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAnteile(alt => [...alt, { region_id: '', prozent: '' }])}>
                  <Plus className="w-3.5 h-3.5 mr-1" />{tt(R.regionDazu)}
                </Button>
              )}
            </>
          )}
        </div>
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={deutsch} onCheckedChange={v => setDeutsch(v === true)} />{tt(R.deutsch)}
          </label>
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={intern} onCheckedChange={v => setIntern(v === true)} />{tt(R.intern)}
          </label>
        </div>
        {fehler && <p role="alert" className="text-[11px] text-destructive">{fehler}</p>}
        <div className="flex justify-end">
          <Button type="button" size="sm" className="h-7 text-xs" disabled={laeuft} onClick={sichern}>{tt(K.anteileSpeichern)}</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function BudgetLineRow({ line, onDelete, darf, ffa = false, markiert, onMarkieren, hervor = false, regionen }: {
  line: any; onDelete: () => void; darf: boolean; ffa?: boolean; markiert: boolean; onMarkieren: (an: boolean) => void; hervor?: boolean; regionen: any[]
}) {
  const [form, setForm] = useState(line)
  const queryClient = useQueryClient()
  const tt = useT()
  const offen = useRef(false)
  // Was der Server abgelehnt hat, steht an der Zeile. Bis zum 12.11.2026
  // fehlte die Fehlerbehandlung: Eine Menge von -5 blieb im Feld stehen und
  // sah gespeichert aus, die Antwort 400 sah niemand.
  const [fehler, setFehler] = useState('')

  const mutation = useMutation({
    mutationFn: (data: any) => api.budget.updateLine(line.id, data),
    onSuccess: () => {
      setFehler('')
      queryClient.invalidateQueries({ queryKey: ['budget-lines'] })
      queryClient.invalidateQueries({ queryKey: ['budget-versions'] })
      queryClient.invalidateQueries({ queryKey: ['budget-auswertung'] })
    },
    onError: (e: any) => setFehler(String(e?.message || '')),
  })

  // "Kosten übernehmen" ändert Zeilen auf dem Server. Vorher blieb das Formular
  // beim ersten Stand stehen und schickte ihn beim nächsten Tippen zurück -
  // gemessen am 01.11.2026: übernommene 2.500 € wurden wieder 1.200 €.
  // Übernommen wird nur, solange hier nichts auf das Speichern wartet.
  useEffect(() => {
    if (!offen.current && !mutation.isPending) setForm(line)
  }, [line])

  const debouncedUpdate = useRef(debounce((data: any | null) => {
    if (data === null) return
    offen.current = false
    mutation.mutate(data)
  }, 500)).current
  const summe = (f: any) => Math.round((Number(f.quantity) || 0) * (Number(f.unit_price_cents) || 0))
  const update = (key: string, value: any) => {
    const next = { ...form, [key]: value }
    setForm(next)
    offen.current = true
    debouncedUpdate(leer(next.quantity, next.unit_price_cents)
      ? null
      : ohneEigeneFelder({ ...next, quantity: Number(next.quantity), unit_price_cents: Number(next.unit_price_cents), total_cents: summe(next) }))
  }
  // Zeitraum (AP E2), Rückstellung und Beistellung (AP E4) schickt nur ihr
  // eigenes Feld. Sonst schriebe eine Eingabe, die vor dem Neuladen der Liste
  // losgeht, den alten Wert zurück.
  const ohneEigeneFelder = ({ spend_from: _von, spend_until: _bis, deferred_cents: _z, in_kind_cents: _b, german_spend: _d, internal: _i, regionen: _r, ...rest }: any) => rest
  const speichernMit = async (felder: Record<string, unknown>) => {
    const basis = leer(form.quantity, form.unit_price_cents) ? line : form
    await api.budget.updateLine(line.id, {
      ...ohneEigeneFelder(basis), quantity: Number(basis.quantity), unit_price_cents: Number(basis.unit_price_cents), total_cents: summe(basis),
      ...felder,
    })
    queryClient.invalidateQueries({ queryKey: ['budget-lines'] })
    queryClient.invalidateQueries({ queryKey: ['financing-stand'] })
    queryClient.invalidateQueries({ queryKey: ['regionen'] })
  }
  const zeitraumSpeichern = (von: string | null, bis: string | null) => speichernMit({ spend_from: von, spend_until: bis })
  const regionenSpeichern = async (anteile: Array<{ region_id: number; share_bp: number }>) => {
    await api.budget.zeilenRegionen(line.id, anteile)
    queryClient.invalidateQueries({ queryKey: ['budget-lines'] })
    queryClient.invalidateQueries({ queryKey: ['regionen'] })
  }
  const zuruecksetzenWennLeer = () => {
    if (!leer(form.quantity, form.unit_price_cents)) return
    offen.current = false
    setForm(line)
  }

  const total = summe(form)
  // Erzeugte Zeilen tragen "Tag", "Woche" oder "Nacht" - die Auswahl kannte
  // sie nicht und stand leer da
  const einheiten = UNITS.includes(form.unit) || !form.unit ? UNITS : [...UNITS, form.unit]

  return (
    <Fragment>
    <tr data-anteile={Number(line.deferred_cents) > 0 || Number(line.in_kind_cents) > 0 ? `${Number(line.deferred_cents) > 0 ? 'rueckstellungen' : ''} ${Number(line.in_kind_cents) > 0 ? 'beistellungen' : ''}` : undefined}
      className={`hover:bg-muted/10 group ${fehler ? '' : 'border-b border-border/20'} ${markiert ? 'bg-primary/5' : ''} ${hervor ? 'outline outline-2 outline-primary/60 -outline-offset-2' : ''}`}>
      {darf && (
        <td className="py-1.5 pl-3 w-6">
          <Checkbox checked={markiert} onCheckedChange={v => onMarkieren(v === true)} aria-label={tt(Z.markieren).replace('{name}', line.description || line.account_code || '')} />
        </td>
      )}
      <td className="py-1.5 pl-4 pr-2 w-8 text-xs text-muted-foreground font-mono">{line.account_code}</td>
      <td className="py-1.5 px-2 flex-1 min-w-[150px]">
        <Input value={form.description || ''} onChange={e => update('description', e.target.value)}
          disabled={!darf} aria-label={tt(T.beschreibungPos)}
          className="h-7 text-sm border-0 bg-transparent focus-visible:ring-1" />
      </td>
      <td className="py-1.5 px-2 w-24">
        <Select value={form.unit || 'Pauschal'} onValueChange={v => update('unit', v)} disabled={!darf}>
          <SelectTrigger aria-label={tt(T.einheit)} className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{einheiten.map(u => <SelectItem key={u} value={u} className="text-xs">{EINHEIT_TEXT[u] ? tt(EINHEIT_TEXT[u]) : u}</SelectItem>)}</SelectContent>
        </Select>
      </td>
      <td className="py-1.5 px-2 w-16">
        <Input type="number" value={form.quantity ?? ''} onChange={e => update('quantity', zahl(e.target.value))} onBlur={zuruecksetzenWennLeer}
          disabled={!darf} aria-invalid={fehler ? true : undefined} aria-label={form.description ? tt(T.mengeFuer).replace('{name}', form.description) : tt(T.menge)}
          className="h-7 text-xs text-right" step="0.5" min="0" />
      </td>
      <td className="py-1.5 px-2 w-28">
        <div className="relative">
          <Input type="number" value={euro(form.unit_price_cents)} disabled={!darf} aria-invalid={fehler ? true : undefined}
            aria-label={form.description ? tt(T.einzelpreisFuer).replace('{name}', form.description) : tt(T.einzelpreisEuro)}
            onChange={e => update('unit_price_cents', cent(e.target.value))} onBlur={zuruecksetzenWennLeer}
            className="h-7 text-xs text-right pr-5" step="0.01" />
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
        </div>
      </td>
      {/* Abgelehnt heißt: Diese Summe gilt nicht. Durchgestrichen, damit sie
          niemand für den gespeicherten Stand hält. */}
      <td className={`py-1.5 px-2 w-28 text-right font-mono text-sm font-medium ${fehler ? 'line-through text-muted-foreground' : ''}`}>
        {formatCurrency(total)}
        <ZuordnungFeld line={line} darf={darf} summe={total} regionen={regionen} speichern={speichernMit} regionenSpeichern={regionenSpeichern} />
      </td>
      <td className="py-1.5 px-1 w-24">
        <ZeitraumFeld line={line} darf={darf} speichern={zeitraumSpeichern} />
      </td>
      {/* FFA-Schema (AP B1): Kostenart der Zeile, bei Gagen der Haken SV */}
      {ffa && (
        <td className="py-1.5 px-2 w-28">
          <div className="flex items-center gap-1.5">
            <Select value={form.cost_group ? String(form.cost_group) : '__ohne'} disabled={!darf}
              onValueChange={v => update('cost_group', v === '__ohne' ? null : Number(v))}>
              <SelectTrigger aria-label={`${tt(K.kostenart)} ${form.description || ''}`} className="h-7 w-14 text-xs px-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__ohne" className="text-xs">{tt(K.ohneKostenart)}</SelectItem>
                {KOSTENARTEN.map(nr => <SelectItem key={nr} value={String(nr)} className="text-xs">{nr} {tt(KOSTENART_TEXT[nr])}</SelectItem>)}
              </SelectContent>
            </Select>
            {Number(form.cost_group) === 3 && (
              <label className="inline-flex items-center gap-1 text-[10px] text-muted-foreground" title={tt(K.svLang)}>
                <Checkbox checked={form.social === true} disabled={!darf} onCheckedChange={v => update('social', v === true)}
                  aria-label={`${tt(K.svLang)}: ${form.description || ''}`} />
                {tt(K.sv)}
              </label>
            )}
          </div>
        </td>
      )}
      <td className="py-1.5 pr-3 w-8">
        {darf && <button onClick={onDelete} aria-label={tt(T.positionLoeschenN).replace('{name}', line.description || line.account_code || '')} title={tt(T.positionLoeschen)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
          <Trash2 className="w-3.5 h-3.5" />
        </button>}
      </td>
    </tr>
    {fehler && (
      <tr className="border-b border-border/20">
        <td colSpan={(ffa ? 9 : 8) + (darf ? 1 : 0)} role="alert" className="pb-2 pl-4 pr-3 text-xs text-destructive">
          {tt(T.nichtGespeichert)}: {fehler}
        </td>
      </tr>
    )}
    </Fragment>
  )
}

/**
 * Raten eines Geldgebers (AP B2): Anlass, Fälligkeit, Betrag, Eingang.
 *
 * Jedes Feld speichert beim Verlassen. Gemessen am 15.11.2026: Speichern
 * lädt die Liste neu, und das setzte das ganze Formular zurück - wer schon im
 * nächsten Feld tippte, verlor Betrag und Datum; die Datumsfelder speicherten
 * zudem bei jedem Tastendruck Zwischenwerte (Jahr 0002). Ungespeicherte
 * Eingaben überstehen das Neuladen jetzt. Ein Datum speichert, sobald es
 * vollständig dasteht - Tab bleibt in Chrome im Datumsfeld, ein Verlassen
 * kommt dann womöglich nie (gemessen am 16.11.2026).
 */
function RateRow({ rate, darf }: { rate: any; darf: boolean }) {
  const tt = useT()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const offen = useRef<Record<string, any>>({})
  const aktuell = useRef(rate)
  aktuell.current = rate
  const [form, setForm] = useState(rate)
  useEffect(() => setForm({ ...rate, ...offen.current }), [rate])
  const neuLaden = () => {
    queryClient.invalidateQueries({ queryKey: ['financing-entries'] })
    queryClient.invalidateQueries({ queryKey: ['financing-stand'] })
  }
  const speichern = useMutation({
    mutationFn: (data: any) => api.financing.updateRate(rate.id, data),
    onSuccess: neuLaden,
    onError: (e: any) => toast({ variant: 'destructive', title: tt(T.nichtGespeichert), description: e?.message }),
  })
  const loeschen = useMutation({ mutationFn: () => api.financing.deleteRate(rate.id), onSuccess: neuLaden })
  /** Tippen: nur lokal, als offen gemerkt */
  const setze = (k: string, wert: any) => {
    offen.current = { ...offen.current, [k]: wert }
    setForm((f: any) => ({ ...f, [k]: wert }))
  }
  /** Verlassen: speichern, wenn anders als auf dem Server; danach nicht mehr offen */
  const verlassen = (k: string, wert: any) => {
    const { [k]: _weg, ...rest } = offen.current
    offen.current = rest
    if (wert === (aktuell.current[k] ?? (k === 'label' ? '' : null))) return
    speichern.mutate({ [k]: wert })
  }
  /** Ein vollständiges Datum (oder geleert) kurz nach dem letzten Tastendruck speichern */
  const verlassenRef = useRef(verlassen)
  verlassenRef.current = verlassen
  // Je Feld ein eigener Verzögerer - sonst verschluckt das zweite Datum das erste
  const spaeter = useRef<Record<string, (wert: string | null) => void>>({}).current
  const datumGetippt = (k: string, wert: string) => {
    setze(k, wert || null)
    spaeter[k] ??= debounce((w: string | null) => verlassenRef.current(k, w), 600)
    if (!wert || /^(19|20)\d{2}-\d{2}-\d{2}$/.test(wert)) spaeter[k](wert || null)
  }
  const datum = (w: any) => (w ? String(w).slice(0, 10) : '')
  const ueberfaellig = !!form.due_on && datum(form.due_on) < heuteISO() && !form.received_on
  return (
    <tr className="text-xs">
      <td className="py-1 pr-2">
        <Input value={form.label || ''} disabled={!darf} placeholder={tt(F.anlassBeispiel)} aria-label={tt(F.anlass)}
          onChange={e => setze('label', e.target.value)} onBlur={e => verlassen('label', e.target.value)}
          className="h-7 text-xs" />
      </td>
      <td className="py-1 pr-2">
        <Input type="date" value={datum(form.due_on)} disabled={!darf} aria-label={tt(F.faelligAm)}
          onChange={e => datumGetippt('due_on', e.target.value)} onBlur={e => verlassen('due_on', e.target.value || null)}
          className={`h-7 text-xs w-36 ${ueberfaellig ? 'border-destructive text-destructive' : ''}`} />
        {ueberfaellig && <span className="ml-1 text-[10px] font-semibold text-destructive">{tt(F.ueberfaellig)}</span>}
      </td>
      <td className="py-1 pr-2">
        <div className="relative w-32">
          <Input type="number" value={euro(form.amount_cents)} disabled={!darf} aria-label={`${tt(F.betrag)} ${form.label || ''}`.trim()}
            onChange={e => setze('amount_cents', cent(e.target.value))}
            onBlur={() => {
              if (leer(form.amount_cents)) { offen.current = {}; setForm(rate); return }
              verlassen('amount_cents', Number(form.amount_cents))
            }}
            className="h-7 text-xs text-right font-mono pr-5" />
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
        </div>
      </td>
      <td className="py-1 pr-2">
        <Input type="date" value={datum(form.received_on)} disabled={!darf} aria-label={tt(F.eingangAm)}
          onChange={e => datumGetippt('received_on', e.target.value)} onBlur={e => verlassen('received_on', e.target.value || null)}
          className="h-7 text-xs w-36" />
      </td>
      <td className="py-1 w-8">
        {darf && <button onClick={() => loeschen.mutate()} aria-label={tt(F.rateLoeschen)} title={tt(F.rateLoeschen)} className="text-muted-foreground hover:text-destructive">
          <Trash2 className="w-3.5 h-3.5" />
        </button>}
      </td>
    </tr>
  )
}

function FinancingRow({ entry, total, onDelete, darf, regionen }: { entry: any; total: number; onDelete: () => void; darf: boolean; regionen: any[] }) {
  const [form, setForm] = useState(entry)
  const queryClient = useQueryClient()
  const tt = useT()
  const [auf, setAuf] = useState(false)

  const [fehler, setFehler] = useState('')

  const mutation = useMutation({
    mutationFn: (data: any) => api.financing.updateEntry(entry.id, data),
    onSuccess: () => {
      setFehler('')
      queryClient.invalidateQueries({ queryKey: ['financing-entries'] })
      queryClient.invalidateQueries({ queryKey: ['financing-stand'] })
      queryClient.invalidateQueries({ queryKey: ['regionen'] })
    },
    onError: (e: any) => setFehler(String(e?.message || '')),
  })
  // Raten und ihre Summe kommen vom Server - nach jeder Änderung neu in die Zeile
  useEffect(() => { setForm((f: any) => ({ ...f, raten: entry.raten, raten_summe_cents: entry.raten_summe_cents, raten_ueber_betrag: entry.raten_ueber_betrag })) }, [entry])
  const rateNeu = useMutation({
    mutationFn: () => api.financing.createRate(entry.id, { label: '', amount_cents: 0 }),
    onSuccess: () => { setAuf(true); queryClient.invalidateQueries({ queryKey: ['financing-entries'] }); queryClient.invalidateQueries({ queryKey: ['financing-stand'] }) },
  })

  const debouncedUpdate = useRef(debounce((data: any | null) => { if (data !== null) mutation.mutate(data) }, 500)).current
  const update = (key: string, value: any) => {
    const next = { ...form, [key]: value }
    setForm(next)
    debouncedUpdate(leer(next.amount_cents) ? null : { ...next, amount_cents: Number(next.amount_cents) })
  }

  const pct = total > 0 ? ((Number(form.amount_cents) || 0) / total * 100).toFixed(1) : '0'
  // Demo-Daten und der Server legen "Förderung" an, die Auswahl kannte nur
  // "Förderung regional" und "national" - das Feld stand leer da.
  const arten = FINANZIERUNGSARTEN.includes(form.type) || !form.type ? FINANZIERUNGSARTEN : [...FINANZIERUNGSARTEN, form.type]

  return (
    <Fragment>
    <tr className={`hover:bg-muted/10 group ${fehler ? '' : 'border-b border-border/20'}`}>
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
          <Input type="number" value={euro(form.amount_cents)} disabled={!darf} aria-invalid={fehler ? true : undefined}
            aria-label={form.source ? tt(T.betragVon).replace('{name}', form.source) : tt(T.betragEuro)}
            onChange={e => update('amount_cents', cent(e.target.value))}
            onBlur={() => { if (leer(form.amount_cents)) setForm(entry) }}
            className="h-7 text-sm text-right font-mono pr-5" />
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
        </div>
      </td>
      <td className="py-2 px-2 w-16 text-right text-sm text-muted-foreground font-mono">{pct}%</td>
      {/* Stand statt Schalter "bestätigt" (AP B2) */}
      <td className="py-2 px-2 w-32">
        <Select value={form.status || 'geplant'} onValueChange={v => update('status', v)} disabled={!darf}>
          <SelectTrigger aria-label={tt(F.standVon).replace('{name}', form.source || '')}
            className={`h-7 text-xs ${form.status === 'ausgezahlt' || form.status === 'zugesagt' ? 'text-green-700 dark:text-green-400' : ''}`}><SelectValue /></SelectTrigger>
          <SelectContent>{STAENDE.map(s => <SelectItem key={s} value={s} className="text-xs">{tt(STAND_TEXT[s])}</SelectItem>)}</SelectContent>
        </Select>
      </td>
      <td className="py-2 pr-3 w-20">
        <div className="flex items-center gap-1">
          <button onClick={() => setAuf(!auf)} aria-expanded={auf} aria-label={tt(F.details).replace('{name}', form.source || '')}
            className="text-muted-foreground hover:text-primary inline-flex items-center gap-0.5 text-[10px]">
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${auf ? 'rotate-90' : ''}`} />
            {(form.raten ?? []).length > 0 && <span>{form.raten.length}</span>}
          </button>
          {form.recoupment_rank && <span className="text-[10px] text-muted-foreground whitespace-nowrap" title={form.recoupment_terms || tt(F.rang)}>{tt(F.rangKurz).replace('{n}', String(form.recoupment_rank))}</span>}
          {darf && <button onClick={onDelete} aria-label={tt(T.finPostenLoeschen)} title={tt(T.postenLoeschen)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
            <Trash2 className="w-3.5 h-3.5" />
          </button>}
        </div>
      </td>
    </tr>
    {form.raten_ueber_betrag && (
      <tr><td colSpan={6} role="alert" className="pb-1.5 pl-4 text-xs text-amber-700 dark:text-amber-300">
        {tt(F.ratenUeber).replace('{summe}', formatCurrency(form.raten_summe_cents)).replace('{betrag}', formatCurrency(Number(form.amount_cents) || 0))}
      </td></tr>
    )}
    {auf && (
      <tr className="border-b border-border/20 bg-muted/10">
        <td colSpan={6} className="px-4 py-3 space-y-3">
          <div className="flex flex-wrap items-end gap-3 text-xs">
            <label className="space-y-1"><span className="block text-muted-foreground">{tt(F.antragAm)}</span>
              <Input type="date" value={form.applied_on ? String(form.applied_on).slice(0, 10) : ''} disabled={!darf} onChange={e => update('applied_on', e.target.value || null)} className="h-7 text-xs w-36" />
            </label>
            <label className="space-y-1"><span className="block text-muted-foreground">{tt(F.zusageAm)}</span>
              <Input type="date" value={form.granted_on ? String(form.granted_on).slice(0, 10) : ''} disabled={!darf} onChange={e => update('granted_on', e.target.value || null)} className="h-7 text-xs w-36" />
            </label>
            <label className="space-y-1 flex-1 min-w-[10rem]"><span className="block text-muted-foreground">{tt(F.aktenzeichen)}</span>
              <Input value={form.reference || ''} disabled={!darf} onChange={e => update('reference', e.target.value)} className="h-7 text-xs" />
            </label>
          </div>
          {/* Regionaleffekt (AP E3): Region und geforderter Effekt in Prozent des Betrags */}
          <div className="flex flex-wrap items-end gap-3 text-xs">
            <label className="space-y-1"><span className="block text-muted-foreground">{tt(R.regionDesGeldgebers)}</span>
              <select value={form.region_id ?? ''} disabled={!darf} onChange={e => update('region_id', e.target.value ? Number(e.target.value) : null)}
                className="h-7 rounded-md border border-input bg-background px-2 text-xs w-40">
                <option value="">{tt(R.keineRegion)}</option>
                {regionen.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
            <label className="space-y-1"><span className="block text-muted-foreground">{tt(R.effektProzent)}</span>
              <Input type="number" min={0} step="any" disabled={!darf}
                value={form.regional_effect_bp === null || form.regional_effect_bp === undefined ? '' : form.regional_effect_bp / 100}
                onChange={e => update('regional_effect_bp', e.target.value === '' ? null : Math.round(Number(e.target.value) * 100))} className="h-7 text-xs w-28" />
            </label>
            {form.region_id && form.regional_effect_bp != null && (
              <span className="pb-1.5 text-muted-foreground">{tt(R.effektSumme).replace('{betrag}', formatCurrency(Math.round((Number(form.amount_cents) || 0) * form.regional_effect_bp / 10_000)))}</span>
            )}
          </div>
          {/* Rückflussrang (AP E4): nur eine Angabe, gerechnet wird damit nicht */}
          <div className="flex flex-wrap items-end gap-3 text-xs">
            <label className="space-y-1"><span className="block text-muted-foreground">{tt(F.rang)}</span>
              <Input type="number" min={1} step={1} value={form.recoupment_rank ?? ''} disabled={!darf}
                onChange={e => update('recoupment_rank', e.target.value === '' ? null : Number(e.target.value))} className="h-7 text-xs w-24" />
            </label>
            <label className="space-y-1 flex-1 min-w-[12rem]"><span className="block text-muted-foreground">{tt(F.rangBedingungen)}</span>
              <Input value={form.recoupment_terms || ''} disabled={!darf} onChange={e => update('recoupment_terms', e.target.value)} className="h-7 text-xs" />
            </label>
          </div>
          <div>
            <p className="text-xs font-semibold mb-1">{tt(F.raten)}</p>
            {(form.raten ?? []).length === 0 ? <p className="text-xs text-muted-foreground">{tt(F.keineRaten)}</p> : (
              <table className="w-full">
                <thead><tr className="text-[10px] text-muted-foreground text-left">
                  <th className="font-medium pb-1">{tt(F.anlass)}</th><th className="font-medium pb-1">{tt(F.faelligAm)}</th>
                  <th className="font-medium pb-1">{tt(F.betrag)}</th><th className="font-medium pb-1">{tt(F.eingangAm)}</th><th />
                </tr></thead>
                <tbody>{form.raten.map((r: any) => <RateRow key={r.id} rate={r} darf={darf} />)}</tbody>
              </table>
            )}
            {darf && (
              <Button variant="ghost" size="sm" className="h-7 text-xs mt-1" onClick={() => rateNeu.mutate()} disabled={rateNeu.isPending}>
                <Plus className="w-3.5 h-3.5 mr-1" />{tt(F.rateNeu)}
              </Button>
            )}
          </div>
        </td>
      </tr>
    )}
    {fehler && (
      <tr className="border-b border-border/20">
        <td colSpan={6} role="alert" className="pb-2 pl-4 pr-3 text-xs text-destructive">
          {tt(T.nichtGespeichert)}: {fehler}
        </td>
      </tr>
    )}
    </Fragment>
  )
}

/**
 * Regionaleffekt (AP E3): Regionen des Projekts, je Region geplant, bisher,
 * gefordert und die Differenz; darunter die Forderungen je Geldgeber. Der
 * Server rechnet gegen die maßgebliche Kalkulation und den maßgeblichen
 * Finanzierungsplan.
 */
function RegionenReiter({ pid, darf }: { pid: number; darf: boolean }) {
  const tt = useT()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [neu, setNeu] = useState('')
  const { data } = useQuery({ queryKey: ['regionen', pid], queryFn: () => api.regionen.list(pid), staleTime: 0 })
  const neuLaden = () => { queryClient.invalidateQueries({ queryKey: ['regionen', pid] }); queryClient.invalidateQueries({ queryKey: ['budget-lines'] }) }
  const fehler = (e: any) => toast({ variant: 'destructive', title: tt(T.nichtGespeichert), description: e.message })
  const anlegen = useMutation({ mutationFn: () => api.regionen.create(pid, neu), onSuccess: () => { setNeu(''); neuLaden() }, onError: fehler })
  const umbenennen = useMutation({ mutationFn: ({ id, name }: { id: number; name: string }) => api.regionen.rename(id, name), onSuccess: neuLaden, onError: fehler })
  const loeschen = useMutation({ mutationFn: (id: number) => api.regionen.delete(id), onSuccess: () => { neuLaden(); queryClient.invalidateQueries({ queryKey: ['financing-entries'] }) }, onError: fehler })
  const regionen: any[] = data?.regionen ?? []
  const u = data?.uebersicht
  const name = (id: number) => regionen.find((r) => r.id === id)?.name ?? '?'
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-muted-foreground max-w-3xl">{tt(R.erklaerung)}</p>
        {data?.kalkulation && <p className="text-xs text-muted-foreground mt-1">{tt(R.gegen).replace('{name}', data.kalkulation.name)}</p>}
      </div>
      <div data-einfuehrung="regionen" className="space-y-2">
        <p className="section-label">{tt(R.regionen)}</p>
        {regionen.length === 0 && <p className="text-xs text-muted-foreground">{tt(R.keineRegionen)}</p>}
        <div className="flex flex-wrap gap-2">
          {regionen.map((r) => (
            <div key={r.id} className="flex items-center gap-1 rounded-md border px-1.5 py-1">
              <Input defaultValue={r.name} disabled={!darf} aria-label={tt(R.umbenennen).replace('{name}', r.name)}
                onBlur={e => { const v = e.target.value.trim(); if (v && v !== r.name) umbenennen.mutate({ id: r.id, name: v }); else e.target.value = r.name }}
                className="h-7 w-32 text-xs border-0 bg-transparent focus-visible:ring-1" />
              {darf && (
                <button type="button" aria-label={tt(R.loeschen).replace('{name}', r.name)} className="text-muted-foreground hover:text-destructive"
                  onClick={() => { if (window.confirm(tt(R.loeschenFrage).replace('{name}', r.name))) loeschen.mutate(r.id) }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        {darf && (
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (neu.trim()) anlegen.mutate() }}>
            <Input value={neu} onChange={e => setNeu(e.target.value)} placeholder={tt(R.neueRegion)} aria-label={tt(R.neueRegion)} className="h-8 w-56 text-sm" />
            <Button type="submit" size="sm" disabled={!neu.trim() || anlegen.isPending}><Plus className="w-4 h-4 mr-1" />{tt(R.anlegen)}</Button>
          </form>
        )}
      </div>

      {u && regionen.length > 0 && (
        <div data-einfuehrung="regionaleffekt" className="overflow-x-auto">
          <table className="w-full border rounded-lg overflow-hidden min-w-[640px]">
            <thead className="bg-muted/30">
              <tr className="text-xs text-muted-foreground">
                <th className="text-left py-2 pl-4">{tt(R.region)}</th>
                <th className="text-right py-2 px-2">{tt(R.geplant)}</th>
                <th className="text-right py-2 px-2">{tt(R.bisher)}</th>
                <th className="text-right py-2 px-2">{tt(R.gefordert)}</th>
                <th className="text-right py-2 px-2">{tt(R.differenz)}</th>
                <th className="text-left py-2 px-3">{tt(R.erfuellt)}</th>
              </tr>
            </thead>
            <tbody>
              {u.regionen.map((r: any) => (
                <tr key={r.id} className="border-b border-border/20 text-sm">
                  <td className="py-2 pl-4 font-medium">{r.name}</td>
                  <td className="py-2 px-2 text-right font-mono">{formatCurrency(r.geplant_cents)}</td>
                  <td className="py-2 px-2 text-right font-mono text-muted-foreground">{formatCurrency(r.bisher_cents)}</td>
                  <td className="py-2 px-2 text-right font-mono">{r.gefordert_cents ? formatCurrency(r.gefordert_cents) : '-'}</td>
                  <td className={`py-2 px-2 text-right font-mono ${r.erfuellt === false ? 'text-destructive' : ''}`}>{r.gefordert_cents ? formatCurrency(r.differenz_cents) : '-'}</td>
                  <td className={`py-2 px-3 text-xs font-semibold ${r.erfuellt === true ? 'text-green-700 dark:text-green-400' : r.erfuellt === false ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {r.erfuellt === true ? tt(R.ja) : r.erfuellt === false ? tt(R.nein) : '-'}
                  </td>
                </tr>
              ))}
              <tr className="text-sm text-muted-foreground">
                <td className="py-2 pl-4 italic">{tt(R.ohneRegion)}</td>
                <td className="py-2 px-2 text-right font-mono">{formatCurrency(u.ohne_region.geplant_cents)}</td>
                <td className="py-2 px-2 text-right font-mono">{formatCurrency(u.ohne_region.bisher_cents)}</td>
                <td colSpan={3} />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {u && regionen.length > 0 && (
        <div className="space-y-2">
          <p className="section-label">{tt(R.foerderungen)}</p>
          {u.geldgeber.length === 0 ? <p className="text-xs text-muted-foreground">{tt(R.keineForderung)}</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-muted-foreground text-left">
                <th className="font-medium pb-1">{tt(R.geldgeber)}</th><th className="font-medium pb-1">{tt(R.region)}</th>
                <th className="font-medium pb-1 text-right">{tt(R.betrag)}</th><th className="font-medium pb-1 text-right">{tt(R.effekt)}</th>
                <th className="font-medium pb-1 text-right">{tt(R.gefordert)}</th>
              </tr></thead>
              <tbody>{u.geldgeber.map((g: any) => (
                <tr key={g.id}>
                  <td className="py-1">{g.source}</td><td className="py-1">{name(g.region_id)}</td>
                  <td className="py-1 text-right font-mono">{formatCurrency(g.amount_cents)}</td>
                  <td className="py-1 text-right font-mono">{bpAlsText(g.effekt_bp)} %</td>
                  <td className="py-1 text-right font-mono">{formatCurrency(g.gefordert_cents)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

function BudgetSeite() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const download = useDownload()
  const tt = useT()
  const gs = useGebietsschema()
  // Budget und Finanzierung schreibt der Server erst ab Produktion
  // (ROUTE_OVERRIDES). Gemessen am 01.11.2026 mit einer Abteilungsleitung:
  // alle Felder und Knöpfe offen, jede Änderung 403.
  const { canEditBudget: darf } = useProjectPerms()
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null)
  const [selectedFinVersionId, setSelectedFinVersionId] = useState<number | null>(null)
  const [newCategory, setNewCategory] = useState(CATEGORIES[0])
  const [neueKostenart, setNeueKostenart] = useState('3')
  const [neueFassungOffen, setNeueFassungOffen] = useState(false)
  const [umstellenOffen, setUmstellenOffen] = useState(false)
  const [vergleichOffen, setVergleichOffen] = useState(false)
  // Reiter gesteuert: Der Finanzierungsplan springt zu den Zeilen (AP E4)
  const [reiter, setReiter] = useState('kalkulation')
  const [hervor, setHervor] = useState<string | null>(null)
  const zuDenZeilen = (art: string) => {
    setReiter('kalkulation')
    setHervor(art)
    setTimeout(() => document.querySelector(`tr[data-anteile~="${art}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 150)
    setTimeout(() => setHervor(null), 4000)
  }
  // Markierte Zeilen für "Zeitraum: Drehzeit" (AP E2); gelten je Fassung
  const [markiert, setMarkiert] = useState<Set<number>>(new Set())
  useEffect(() => setMarkiert(new Set()), [selectedVersionId])
  const markieren = (ids: number[], an: boolean) => setMarkiert(alt => {
    const neu = new Set(alt)
    for (const id of ids) { if (an) neu.add(id); else neu.delete(id) }
    return neu
  })
  // Fassung kopieren, etwa als Grundlage der Abschlusskalkulation (AP E1)
  const kopieren = useMutation({
    mutationFn: () => api.budget.kopie(selectedVersionId!),
    onSuccess: (v: any) => {
      queryClient.invalidateQueries({ queryKey: ['budget-versions', pid] })
      setSelectedVersionId(v.id)
      toast({ title: tt(K.kopiert), description: v.name })
    },
    onError: (e: any) => toast({ variant: 'destructive', title: tt(T.fehler), description: e.message }),
  })

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

  // Regionen des Projekts für die Zuordnung der Zeilen und die Geldgeber (AP E3)
  const { data: regionenDaten } = useQuery({ queryKey: ['regionen', pid], queryFn: () => api.regionen.list(pid) })
  const regionen: any[] = regionenDaten?.regionen ?? []

  const { data: lines, isLoading: linesLoading } = useQuery({
    queryKey: ['budget-lines', selectedVersionId],
    queryFn: () => api.budget.listLines(selectedVersionId!),
    enabled: !!selectedVersionId,
  })

  // Kostenarten, Rechenwerk und Hinweise der Fassung (AP B1) - der Server rechnet
  const { data: auswertung } = useQuery({
    queryKey: ['budget-auswertung', selectedVersionId],
    queryFn: () => api.budget.auswertung(selectedVersionId!),
    enabled: !!selectedVersionId,
  })

  const { data: finEntries, isLoading: finLoading } = useQuery({
    queryKey: ['financing-entries', selectedFinVersionId],
    queryFn: () => api.financing.listEntries(selectedFinVersionId!),
    enabled: !!selectedFinVersionId,
  })
  // Kopf des Plans: Herstellungskosten, Summe, zugesagt, ausgezahlt, Lücke (AP B2)
  const { data: finStand } = useQuery({
    queryKey: ['financing-stand', selectedFinVersionId],
    queryFn: () => api.financing.stand(selectedFinVersionId!),
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
      category, description: 'Neue Position', unit: 'Pauschal', quantity: 1, unit_price_cents: 0, // texte-ok
      // Im FFA-Schema mit der gewählten Kostenart (AP B1)
      ...(ffa ? { cost_group: Number(neueKostenart) } : {}),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-lines'] })
      queryClient.invalidateQueries({ queryKey: ['budget-versions', pid] })
      queryClient.invalidateQueries({ queryKey: ['budget-auswertung'] })
    },
    onError: (e: any) => toast({ variant: 'destructive', title: tt(T.nichtGespeichert), description: e.message }),
  })

  const aufDrehzeit = useMutation({
    mutationFn: () => api.budget.zeitraum(selectedVersionId!, [...markiert]),
    onSuccess: (r) => {
      setMarkiert(new Set())
      queryClient.invalidateQueries({ queryKey: ['budget-lines'] })
      toast({ title: tt(Z.gesetzt).replace('{n}', String(r.geaendert)).replace('{von}', kurzDatum(r.von, gs)).replace('{bis}', kurzDatum(r.bis, gs)) })
    },
    onError: (e: any) => toast({ variant: 'destructive', title: tt(Z.fehler), description: e.message }),
  })

  const deleteLine = useMutation({
    mutationFn: (id: number) => api.budget.deleteLine(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-lines', selectedVersionId] })
      queryClient.invalidateQueries({ queryKey: ['budget-versions', pid] })
      queryClient.invalidateQueries({ queryKey: ['budget-auswertung'] })
    },
  })

  const createFinEntry = useMutation({
    mutationFn: async () => api.financing.createEntry(await finanzierungsFassung(), { source: tt(T.neuerGeldgeber), type: 'Förderung', amount_cents: 0 }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['financing-entries'] }); queryClient.invalidateQueries({ queryKey: ['financing-stand'] }) },
    onError: (e: any) => toast({ variant: 'destructive', title: tt(T.nichtGespeichert), description: e.message }),
  })

  const deleteFinEntry = useMutation({
    mutationFn: (id: number) => api.financing.deleteEntry(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['financing-entries', selectedFinVersionId] }); queryClient.invalidateQueries({ queryKey: ['financing-stand'] }) },
  })

  const currentVersion = versions?.find((v: any) => v.id === selectedVersionId)
  const totalBudget = currentVersion?.total_cents || 0
  // FFA-Schema (AP B1): Gruppen sind die elf Kostenarten, auch leere - wie im
  // Formular. Die Summe der Fassung sind dann die Herstellungskosten.
  const ffa = currentVersion?.schema === 'ffa'
  const OHNE = 'ohne-kostenart'
  const gruppeVon = (line: any) => ffa
    ? (line.cost_group >= 1 && line.cost_group <= 11 ? `k${line.cost_group}` : OHNE)
    : (line.category || 'Sonstiges')
  const gruppenName = (g: string) => g === OHNE ? tt(K.ohneKostenart) : ffa ? `${g.slice(1)} ${tt(KOSTENART_TEXT[Number(g.slice(1))])}` : g

  const grouped = (lines || []).reduce((acc: Record<string, any[]>, line: any) => {
    const cat = gruppeVon(line)
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
  const sichtbareGruppen = ffa
    ? [...KOSTENARTEN.map(nr => `k${nr}`), ...(grouped[OHNE]?.length ? [OHNE] : [])]
    : [
      ...CATEGORIES.filter(cat => grouped[cat]?.length > 0),
      ...Object.keys(grouped).filter(cat => !CATEGORIES.includes(cat) && grouped[cat].length > 0).sort(),
    ]

  const catTotals: Record<string, number> = Object.fromEntries(
    Object.entries(grouped).map(([cat, items]) => [
      cat,
      (items as any[]).reduce((sum, l) => sum + (l.total_cents || 0), 0)
    ])
  )
  // Kostenart 3 enthält die Zusatzkosten Gagen - die Summen kommen vom Server
  if (ffa) for (const a of auswertung?.arten ?? []) catTotals[`k${a.nr}`] = a.summe_cent

  // Rückstellungen und Beistellungen der Kalkulation zählen mit (AP E4)
  const ausKalk: any[] = finStand?.aus_kalkulation ?? []
  const finTotal = [...(finEntries || []), ...ausKalk].reduce((sum: number, e: any) => sum + (Number(e.amount_cents) || 0), 0)

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
      queryClient.invalidateQueries({ queryKey: ['budget-auswertung'] })
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
          {vorschau.leere_drehtage?.length > 0 && (
            <p className="text-[12px] text-warning mt-2 leading-relaxed">
              {tt(T.leereDrehtage).replace('{tage}', vorschau.leere_drehtage.join(', '))}
            </p>
          )}
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

      <Tabs value={reiter} onValueChange={setReiter}>
        <TabsList data-einfuehrung="reiter">
          <TabsTrigger value="kalkulation" data-einfuehrung="reiter-kalkulation" className="gap-2"><List className="w-4 h-4" />{tt(T.kalkulation)}</TabsTrigger>
          <TabsTrigger value="finanzierung" data-einfuehrung="reiter-finanzierung" className="gap-2"><PieChart className="w-4 h-4" />{tt(T.finanzierungsplan)}</TabsTrigger>
          <TabsTrigger value="regionen" data-einfuehrung="reiter-regionen" className="gap-2"><MapPin className="w-4 h-4" />{tt(R.reiter)}</TabsTrigger>
        </TabsList>

        {/* ── KALKULATION ── */}
        <TabsContent value="kalkulation" className="space-y-4 mt-4">
          {/* Fassungswahl links, Summe und Werkzeuge rechts - am Telefon
              untereinander, sonst beginnt die Werkzeugleiste bei x=232 */}
          <div data-einfuehrung="kalkulation" className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {versions && versions.length > 0 && (
                <Select value={String(selectedVersionId)} onValueChange={v => setSelectedVersionId(Number(v))}>
                  <SelectTrigger aria-label={tt(T.fassungWaehlen)} className="w-full sm:w-52 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{versions.map((v: any) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
              {currentVersion && <Badge variant="outline" className="text-[10px]">{ffa ? tt(K.schemaFfa) : tt(K.schemaFrei)}</Badge>}
              {darf && (
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setNeueFassungOffen(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" />{tt(K.neueFassung)}
                </Button>
              )}
              {darf && currentVersion && !ffa && (
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setUmstellenOffen(true)}>{tt(K.umstellen)}</Button>
              )}
              {darf && currentVersion && (
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => kopieren.mutate()} disabled={kopieren.isPending}>{tt(K.fassungKopieren)}</Button>
              )}
              {(versions?.length ?? 0) >= 2 && (
                <Button variant="ghost" size="sm" className="h-8 text-xs" data-einfuehrung="vergleich" onClick={() => setVergleichOffen(true)}>{tt(K.vergleichen)}</Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-lg font-bold">{formatCurrency(totalBudget)}</span>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                {darf && (
                  <>
                    {ffa ? (
                      <Select value={neueKostenart} onValueChange={setNeueKostenart}>
                        <SelectTrigger aria-label={tt(K.kostenart)} className="w-52 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{KOSTENARTEN.map(nr => <SelectItem key={nr} value={String(nr)} className="text-xs">{nr} {tt(KOSTENART_TEXT[nr])}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <Select value={newCategory} onValueChange={setNewCategory}>
                        <SelectTrigger aria-label={tt(T.kategorieWaehlen)} className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent>
                      </Select>
                    )}
                    <Button size="sm" onClick={() => createLine.mutate(ffa ? tt(KOSTENART_TEXT[Number(neueKostenart)]) : newCategory)} disabled={createLine.isPending}>
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
                {selectedVersionId && (
                  <Button variant="outline" size="sm" onClick={() => download(api.budget.csv(selectedVersionId), 'kalkulation.csv')}>
                    <Download className="w-4 h-4 mr-1" />{tt(K.csv)}
                  </Button>
                )}
                <Button variant="outline" size="sm" data-einfuehrung="foerderantrag" title={tt(T.foerderTitel)}
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
              {sichtbareGruppen.filter(cat => !ffa || (catTotals[cat] || 0) !== 0).map(cat => (
                <div key={cat} className="flex items-center justify-between text-xs p-2 rounded bg-muted/30">
                  <span className="truncate text-muted-foreground">{ffa ? gruppenName(cat) : (cat.split(' - ')[1] || cat)}</span>
                  <span className="font-mono font-medium shrink-0 ml-1">{cat === 'k11' && catTotals[cat] ? '- ' : ''}{formatCurrency(catTotals[cat] || 0)}</span>
                </div>
              ))}
              {totalBudget > 0 && (
                <div className="flex items-center justify-between text-sm p-2 rounded bg-primary/20 font-bold mt-2">
                  <span>{ffa ? tt(K.herstellungskosten) : tt(T.gesamt)}</span>
                  <span className="font-mono">{formatCurrency(totalBudget)}</span>
                </div>
              )}
              {/* Deutsche Herstellungskosten und interne Kosten (AP E3): aus den Zeilen,
                  ohne die mindernden Erträge */}
              {(() => {
                const kosten = (lines ?? []).filter((l: any) => !(ffa && Number(l.cost_group) === 11))
                const alle = kosten.reduce((s: number, l: any) => s + (Number(l.total_cents) || 0), 0)
                if (!alle) return null
                const deutsch = kosten.filter((l: any) => l.german_spend !== false).reduce((s: number, l: any) => s + (Number(l.total_cents) || 0), 0)
                const intern = kosten.filter((l: any) => l.internal === true).reduce((s: number, l: any) => s + (Number(l.total_cents) || 0), 0)
                return (
                  <div data-einfuehrung="deutsch" className="text-xs p-2 rounded bg-muted/30 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">{tt(R.deutsch)}</span>
                      <span className="font-mono font-medium shrink-0">{formatCurrency(deutsch)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground text-right">{tt(R.deutschAnteil).replace('{anteil}', String(Math.round((deutsch / alle) * 1000) / 10).replace('.', ','))}</p>
                    {intern > 0 && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">{tt(R.intern)}</span>
                        <span className="font-mono font-medium shrink-0">{formatCurrency(intern)}</span>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Main table */}
            <div className="flex-1 overflow-x-auto">
              {darf && (lines?.length ?? 0) > 0 && (
                <div data-einfuehrung="zeitraum" className="flex flex-wrap items-center gap-2 mb-2 text-xs">
                  <span className="text-muted-foreground tabular-nums">{tt(Z.markiert).replace('{n}', String(markiert.size))}</span>
                  <Button variant="outline" size="sm" className="h-7 text-xs" title={tt(Z.aufDrehzeitLang)}
                    disabled={markiert.size === 0 || aufDrehzeit.isPending} onClick={() => aufDrehzeit.mutate()}>{tt(Z.aufDrehzeit)}</Button>
                  {markiert.size > 0 && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setMarkiert(new Set())}>{tt(Z.aufheben)}</Button>
                  )}
                </div>
              )}
              {linesLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <table className="w-full border rounded-lg overflow-hidden min-w-[720px]">
                  <thead className="bg-muted/30">
                    <tr className="text-xs text-muted-foreground">
                      {darf && (
                        <th className="py-2 pl-3 w-6">
                          <Checkbox checked={(lines?.length ?? 0) > 0 && markiert.size === lines!.length}
                            onCheckedChange={v => v === true ? setMarkiert(new Set(lines!.map((l: any) => l.id))) : setMarkiert(new Set())}
                            aria-label={tt(Z.alleMarkieren)} />
                        </th>
                      )}
                      <th className="text-left py-2 pl-4 w-8">{tt(T.kto)}</th>
                      <th className="text-left py-2 px-2">{tt(T.beschreibung)}</th>
                      <th className="text-left py-2 px-2 w-24">{tt(T.einheit)}</th>
                      <th className="text-right py-2 px-2 w-16">{tt(T.menge)}</th>
                      <th className="text-right py-2 px-2 w-28">{tt(T.einzelpreis)}</th>
                      <th className="text-right py-2 px-2 w-28">{tt(T.gesamt)}</th>
                      <th className="text-left py-2 px-2 w-24">{tt(Z.spalte)}</th>
                      {ffa && <th className="text-left py-2 px-2 w-28">{tt(K.kostenart)}</th>}
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {sichtbareGruppen.map(cat => (
                      <Fragment key={cat}>
                        <tr className="bg-muted/50">
                          {darf && (
                            <td className="py-1.5 pl-3 w-6">
                              {(grouped[cat] || []).length > 0 && (
                                <Checkbox checked={(grouped[cat] || []).every((l: any) => markiert.has(l.id))}
                                  onCheckedChange={v => markieren((grouped[cat] || []).map((l: any) => l.id), v === true)}
                                  aria-label={tt(Z.markieren).replace('{name}', ffa ? gruppenName(cat) : cat)} />
                              )}
                            </td>
                          )}
                          <td colSpan={5} className="py-1.5 pl-4 text-xs font-semibold text-muted-foreground">{ffa ? gruppenName(cat) : cat}</td>
                          <td className="py-1.5 pr-4 text-right text-xs font-mono font-semibold">{cat === 'k11' && catTotals[cat] ? '- ' : ''}{formatCurrency(catTotals[cat] || 0)}</td>
                          <td colSpan={ffa ? 3 : 2} />
                        </tr>
                        {(grouped[cat] || []).map((line: any) => (
                          <BudgetLineRow key={line.id} line={line} darf={darf} ffa={ffa} onDelete={() => positionLoeschen(line)}
                            markiert={markiert.has(line.id)} onMarkieren={an => markieren([line.id], an)} regionen={regionen}
                            hervor={hervor === 'rueckstellungen' ? Number(line.deferred_cents) > 0 : hervor === 'beistellungen' ? Number(line.in_kind_cents) > 0 : false} />
                        ))}
                        {ffa && cat === 'k3' && auswertung?.zusatzkosten_gagen_cent != null && (
                          <tr className="border-b border-border/20 text-muted-foreground">
                            {darf && <td />}
                            <td />
                            <td colSpan={4} className="py-1.5 px-2 text-sm italic">{tt(K.zusatzkosten)}</td>
                            <td className="py-1.5 px-2 text-right font-mono text-sm">{formatCurrency(auswertung.zusatzkosten_gagen_cent)}</td>
                            <td colSpan={3} />
                          </tr>
                        )}
                      </Fragment>
                    ))}
                    {(!lines || lines.length === 0) && (
                      <tr><td colSpan={(ffa ? 9 : 8) + (darf ? 1 : 0)} className="py-8 text-center text-muted-foreground text-sm">{tt(T.keinePositionen)}</td></tr>
                    )}
                  </tbody>
                  {lines && lines.length > 0 && (
                    <tfoot className="sticky bottom-0 bg-card border-t-2 border-border shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
                      <tr>
                        <td colSpan={5 + (darf ? 1 : 0)} className="py-2.5 pl-4 text-sm font-bold uppercase tracking-wide">{ffa ? tt(K.herstellungskosten) : tt(T.gesamtbudget)}</td>
                        <td className="py-2.5 pr-4 text-right font-mono text-base font-black text-primary">{formatCurrency(totalBudget)}</td>
                        <td colSpan={ffa ? 3 : 2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}
            </div>
          </div>

          {/* Rechenwerk unter den Kostenarten (AP B1) */}
          {ffa && currentVersion && <Rechenwerk version={currentVersion} auswertung={auswertung} darf={darf} />}
          <NeueFassungDialog pid={pid} offen={neueFassungOffen} onClose={() => setNeueFassungOffen(false)} onAngelegt={setSelectedVersionId} />
          {currentVersion && <UmstellenDialog version={currentVersion} lines={lines ?? []} offen={umstellenOffen} onClose={() => setUmstellenOffen(false)} />}
          <VergleichDialog pid={pid} versionen={versions ?? []} offen={vergleichOffen} onClose={() => setVergleichOffen(false)} />
        </TabsContent>

        {/* ── FINANZIERUNGSPLAN ── */}
        <TabsContent value="finanzierung" className="space-y-4 mt-4">
          <div data-einfuehrung="finanzierung" className="flex items-center justify-between">
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

          {/* Kopf des Plans (AP B2): die Lücke gegen die Summe, daneben "noch nicht zugesagt" */}
          {finStand && (
            <div data-einfuehrung="finanzstand" className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {([
                [F.herstellungskosten, finStand.herstellungskosten_cents, finStand.kalkulation ? tt(F.ausKalkulation).replace('{name}', finStand.kalkulation.name) : tt(F.ohneKalkulation)],
                [F.finanzierung, finStand.summe_cents, ''],
                [F.zugesagt, finStand.zugesagt_cents, ''],
                [F.ausgezahlt, finStand.ausgezahlt_cents, ''],
                [F.luecke, finStand.luecke_cents, tt(F.nichtZugesagt).replace('{betrag}', formatCurrency(finStand.nicht_zugesagt_cents))],
              ] as const).map(([titel, betrag, zusatz], i) => (
                <div key={i} className={`rounded-lg border p-3 ${i === 4 && finStand.luecke_cents > 0 ? 'border-destructive/40 bg-destructive/5' : 'bg-card/30'}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{tt(titel)}</p>
                  <p className="text-lg font-bold font-mono tabular-nums">{formatCurrency(betrag)}</p>
                  {zusatz && <p className="text-[11px] text-muted-foreground">{zusatz}</p>}
                </div>
              ))}
              {finStand.ueberfinanziert_cents > 0 && (
                <p role="status" className="col-span-full text-xs text-amber-700 dark:text-amber-300">
                  {tt(F.ueberfinanziert).replace('{betrag}', formatCurrency(finStand.ueberfinanziert_cents))}
                </p>
              )}
            </div>
          )}

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
                    <th className="text-left py-2 px-2 w-32">{tt(F.stand)}</th>
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody>
                  {(finEntries || []).map((e: any) => (
                    <FinancingRow key={e.id} entry={e} total={finTotal} darf={darf} onDelete={() => postenLoeschen(e)} regionen={regionen} />
                  ))}
                  {/* Rechnen sich aus der Kalkulation (AP E4) - hier nicht änderbar */}
                  {ausKalk.map((z: any) => (
                    <tr key={z.art} data-einfuehrung="aus-kalkulation" className="border-b border-border/20 bg-muted/10" title={tt(F.selbstGerechnet)}>
                      <td className="py-2 pl-4 pr-2 text-sm">
                        {tt(z.art === 'rueckstellungen' ? F.rueckstellungen : F.beistellungen)}
                        <button type="button" onClick={() => zuDenZeilen(z.art)} className="ml-2 text-xs text-primary underline underline-offset-2">{tt(F.zuDenZeilen)}</button>
                      </td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">{tt(F.ausDerKalkulation)}</td>
                      <td className="py-2 px-2 text-right text-sm font-mono">{formatCurrency(z.amount_cents)}</td>
                      <td className="py-2 px-2 text-right text-sm text-muted-foreground font-mono">{finTotal > 0 ? (z.amount_cents / finTotal * 100).toFixed(1) : '0'}%</td>
                      <td className="py-2 px-2 text-xs text-green-700 dark:text-green-400">{tt(STAND_TEXT.zugesagt)}</td>
                      <td />
                    </tr>
                  ))}
                  {(!finEntries || finEntries.length === 0) && ausKalk.length === 0 && (
                    <tr><td colSpan={6} className="py-8 text-center text-muted-foreground text-sm">{tt(T.keineEintraege)}</td></tr>
                  )}
                </tbody>
                {((finEntries?.length ?? 0) > 0 || ausKalk.length > 0) && (
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

        {/* ── REGIONALEFFEKT (AP E3) ── */}
        <TabsContent value="regionen" className="mt-4">
          <RegionenReiter pid={pid} darf={darf} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/** Gagen und Kalkulation sieht nur die Produktion (server/src/lib/gagenschutz.ts). */
export function Component() {
  const { rolle, siehtGagen } = useSchreibrecht()
  if (rolle && !siehtGagen) return <NurProduktion />
  return <BudgetSeite />
}
