import { Fragment, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDownload } from '@/lib/useDownload'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency } from '@/lib/utils'
import { useT } from '@/lib/useT'
import { kalkT as K, KOSTENART_TEXT, KOSTENARTEN } from '@/lib/texte/Kalkulation'

/** "10,5" → 10.5; leer → null; Unsinn → NaN */
function deZahl(text: string): number | null {
  const t = text.trim().replace(/\./g, '').replace(',', '.')
  if (!t) return null
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN
}
const deText = (n: number, stellen = 2) => n.toLocaleString('de-DE', { maximumFractionDigits: stellen })

/**
 * Ein Feld für einen Satz (gespeichert in Basispunkten) oder einen Betrag
 * (gespeichert in Cent). Gespeichert wird beim Verlassen; Unsinn springt
 * zurück. `leerErlaubt` nur für die Zusatzkosten Gagen - ohne Satz gibt es
 * die Zeile nicht.
 */
function Feld({ wert, art, label, onSpeichern, darf, leerErlaubt = false }: {
  wert: number | null; art: 'satz' | 'betrag'; label: string; darf: boolean; leerErlaubt?: boolean
  onSpeichern: (neu: number | null) => void
}) {
  const anzeige = (w: number | null) => (w === null ? '' : deText(w / 100))
  const [text, setText] = useState(anzeige(wert))
  useEffect(() => setText(anzeige(wert)), [wert])
  const verlassen = () => {
    const n = deZahl(text)
    if (n === null && leerErlaubt) { if (wert !== null) onSpeichern(null); return }
    if (n === null || Number.isNaN(n) || n < 0 || (art === 'satz' && n >= 100)) { setText(anzeige(wert)); return }
    const neu = Math.round(n * 100)
    if (neu !== wert) onSpeichern(neu)
  }
  return (
    <span className="inline-flex items-center gap-1">
      <Input value={text} onChange={e => setText(e.target.value)} onBlur={verlassen} disabled={!darf} inputMode="decimal"
        aria-label={label} className={`h-7 text-xs text-right font-mono ${art === 'satz' ? 'w-16' : 'w-28'}`} />
      <span className="text-xs text-muted-foreground">{art === 'satz' ? '%' : '€'}</span>
    </span>
  )
}

/** Das Rechenwerk unter den Kostenarten, mit den Sätzen als Feldern (AP B1). */
export function Rechenwerk({ version, auswertung, darf }: { version: any; auswertung: any; darf: boolean }) {
  const tt = useT()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const speichern = useMutation({
    mutationFn: (daten: Record<string, number | null>) => api.budget.updateVersion(version.id, daten),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-versions'] })
      queryClient.invalidateQueries({ queryKey: ['budget-auswertung'] })
    },
    onError: (e: any) => toast({ variant: 'destructive', title: e?.message }),
  })
  const feld = (k: string, art: 'satz' | 'betrag', label: string, leer = false) => (
    <Feld key={k} wert={version[k] ?? null} art={art} label={label} darf={darf} leerErlaubt={leer} onSpeichern={(n) => speichern.mutate({ [k]: n })} />
  )
  const rw = auswertung?.rechenwerk
  if (!rw) return null
  const hinweis = (ueber: boolean, gedeckelt = false) => (
    <span className="text-[11px]">
      {ueber && <span className="text-amber-700 dark:text-amber-300">{tt(K.ueber)}</span>}
      {ueber && gedeckelt && ', '}
      {gedeckelt && <span className="text-muted-foreground">{tt(K.gedeckelt)}</span>}
    </span>
  )
  const zeile = (titel: string, felder: React.ReactNode, betrag: number, extra?: React.ReactNode, fett = false) => (
    <tr className={`border-b border-border/30 ${fett ? 'bg-primary/10' : ''}`}>
      <td className={`py-2 pl-4 pr-2 text-sm ${fett ? 'font-bold' : 'font-medium'}`}>{titel}</td>
      <td className="py-2 px-2"><div className="flex flex-wrap items-center gap-x-3 gap-y-1">{felder}{extra}</div></td>
      <td className={`py-2 pr-4 text-right font-mono ${fett ? 'font-black text-primary' : 'text-sm'}`}>{formatCurrency(betrag)}</td>
    </tr>
  )
  return (
    <div data-einfuehrung="rechenwerk" className="rounded-lg border overflow-hidden">
      <div className="px-4 py-2 bg-muted/40 text-xs font-semibold">{tt(K.rechenwerk)}</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <tbody>
            {zeile(tt(K.fertigungskosten), <span className="text-xs text-muted-foreground">{tt(K.fertigungHilfe)}</span>, rw.fertigungskosten)}
            {zeile(tt(K.handlungskosten), <>
              <span className="text-[11px] text-muted-foreground">{tt(K.satzBis)}</span>{feld('hu_percent_bp', 'satz', `${tt(K.handlungskosten)}: ${tt(K.satzBis)}`)}
              <span className="text-[11px] text-muted-foreground">{tt(K.schwelle)}</span>{feld('hu_threshold_cents', 'betrag', `${tt(K.handlungskosten)}: ${tt(K.schwelle)}`)}
              <span className="text-[11px] text-muted-foreground">{tt(K.satzDarueber)}</span>{feld('hu_percent_above_bp', 'satz', `${tt(K.handlungskosten)}: ${tt(K.satzDarueber)}`)}
              <span className="text-[11px] text-muted-foreground">{tt(K.hoechstens)}</span>{feld('hu_cap_cents', 'betrag', `${tt(K.handlungskosten)}: ${tt(K.hoechstens)}`)}
            </>, rw.handlungskosten, hinweis(rw.ueber.handlungskosten, rw.gedeckelt.handlungskosten))}
            {zeile(tt(K.reserve), feld('reserve_percent_bp', 'satz', `${tt(K.reserve)}: ${tt(K.satz)}`), rw.reserve, hinweis(rw.ueber.reserve))}
            {zeile(tt(K.honorar), <>
              {feld('producer_fee_percent_bp', 'satz', `${tt(K.honorar)}: ${tt(K.satz)}`)}
              <span className="text-[11px] text-muted-foreground">{tt(K.hoechstens)}</span>{feld('producer_fee_cap_cents', 'betrag', `${tt(K.honorar)}: ${tt(K.hoechstens)}`)}
            </>, rw.honorar, hinweis(rw.ueber.honorar, rw.gedeckelt.honorar))}
            {zeile(tt(K.herstellungskosten), null, rw.herstellungskosten, undefined, true)}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-xs font-medium">{tt(K.zusatzkosten)}: {tt(K.zusatzSatz)}</Label>
          {feld('social_percent_bp', 'satz', tt(K.zusatzSatz), true)}
          {auswertung.zusatzkosten_gagen_cent !== null && <span className="text-xs font-mono">{formatCurrency(auswertung.zusatzkosten_gagen_cent)}</span>}
        </div>
        <p className="text-[11px] text-muted-foreground">{tt(K.zusatzHilfe)}</p>
        {(auswertung.hinweise ?? []).length > 0 && (
          <p role="status" className="text-xs text-amber-700 dark:text-amber-300">{auswertung.hinweise.join(' · ')}</p>
        )}
        <p className="text-[11px] text-muted-foreground">{tt(K.quelle)}</p>
      </div>
    </div>
  )
}

/** Neue Fassung mit Wahl des Schemas (AP B1). */
export function NeueFassungDialog({ pid, offen, onClose, onAngelegt }: { pid: number; offen: boolean; onClose: () => void; onAngelegt: (id: number) => void }) {
  const tt = useT()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [schema, setSchema] = useState<'ffa' | 'frei'>('ffa')
  const anlegen = useMutation({
    mutationFn: () => api.budget.createVersion(pid, { name: name.trim() || tt(K.neueFassung), schema }),
    onSuccess: (v: any) => {
      queryClient.invalidateQueries({ queryKey: ['budget-versions', pid] })
      onAngelegt(v.id)
      onClose()
    },
    onError: (e: any) => toast({ variant: 'destructive', title: e?.message }),
  })
  return (
    <Dialog open={offen} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{tt(K.neueFassung)}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="fassung-name">{tt(K.fassungName)}</Label>
            <Input id="fassung-name" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>{tt(K.schema)}</Label>
            <Select value={schema} onValueChange={v => setSchema(v as 'ffa' | 'frei')}>
              <SelectTrigger aria-label={tt(K.schema)}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ffa">{tt(K.schemaFfa)}</SelectItem>
                <SelectItem value="frei">{tt(K.schemaFrei)}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tt(K.abbrechen)}</Button>
          <Button onClick={() => anlegen.mutate()} disabled={anlegen.isPending}>{tt(K.anlegen)}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Kategorien, deren Kostenart der Plan festlegt (Kosten übernehmen, AP B1 Soll 5). */
const VORSCHLAG: Record<string, number> = {
  'Gagen Besetzung': 3, 'Gagen Stab': 3, 'Equipment': 5, 'Motivmieten': 4, 'Reisekosten': 6, 'Unterkünfte': 6, 'Versicherungen': 9,
}

/** Eine freie Fassung auf das FFA-Schema umstellen: jede Kategorie einer Kostenart zuordnen. */
export function UmstellenDialog({ version, lines, offen, onClose }: { version: any; lines: any[]; offen: boolean; onClose: () => void }) {
  const tt = useT()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const kategorien = [...new Set(lines.filter(l => l.cost_group == null).map(l => String(l.category || '').trim()).filter(Boolean))]
  const [zuordnung, setZuordnung] = useState<Record<string, string>>({})
  useEffect(() => {
    if (offen) setZuordnung(Object.fromEntries(kategorien.map(k => [k, VORSCHLAG[k] ? String(VORSCHLAG[k]) : ''])))
  }, [offen])
  const umstellen = useMutation({
    mutationFn: () => api.budget.umstellen(version.id, {
      schema: 'ffa',
      zuordnung: Object.fromEntries(Object.entries(zuordnung).filter(([, v]) => v).map(([k, v]) => [k, Number(v)])),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-versions'] })
      queryClient.invalidateQueries({ queryKey: ['budget-lines'] })
      queryClient.invalidateQueries({ queryKey: ['budget-auswertung'] })
      toast({ title: tt(K.umgestellt) })
      onClose()
    },
    onError: (e: any) => toast({ variant: 'destructive', title: e?.message }),
  })
  return (
    <Dialog open={offen} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{tt(K.umstellen)}</DialogTitle>
          <DialogDescription>{tt(K.umstellenText)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2 max-h-[50vh] overflow-y-auto">
          {kategorien.map(k => (
            <div key={k} className="flex items-center justify-between gap-3">
              <span className="text-sm truncate">{k}</span>
              <Select value={zuordnung[k] || '__ohne'} onValueChange={v => setZuordnung(z => ({ ...z, [k]: v === '__ohne' ? '' : v }))}>
                <SelectTrigger aria-label={`${tt(K.kostenart)} ${k}`} className="w-64 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ohne">{tt(K.ohneKostenart)}</SelectItem>
                  {KOSTENARTEN.map(nr => <SelectItem key={nr} value={String(nr)}>{nr} {tt(KOSTENART_TEXT[nr])}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tt(K.abbrechen)}</Button>
          <Button onClick={() => umstellen.mutate()} disabled={umstellen.isPending}>{tt(K.umstellen)}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Zwei Fassungen nebeneinander, mit CSV und PDF (AP E1). */
export function VergleichDialog({ pid, versionen, offen, onClose }: { pid: number; versionen: any[]; offen: boolean; onClose: () => void }) {
  const tt = useT()
  const download = useDownload()
  const [a, setA] = useState<string>('')
  const [b, setB] = useState<string>('')
  useEffect(() => {
    if (!offen) return
    // Vorbelegt: die älteste gegen die neueste Fassung
    if (versionen.length >= 2) { setA(String(versionen[versionen.length - 1].id)); setB(String(versionen[0].id)) }
  }, [offen])
  const bereit = !!a && !!b && a !== b
  const { data: v, isLoading } = useQuery({
    queryKey: ['budget-vergleich', pid, a, b],
    queryFn: () => api.budget.vergleich(pid, Number(a), Number(b)),
    enabled: offen && bereit,
  })
  const betrag = (c: number | null) => (c === null ? '-' : formatCurrency(c))
  const wahl = (wert: string, setze: (v: string) => void, label: string) => (
    <Select value={wert} onValueChange={setze}>
      <SelectTrigger aria-label={label} className="h-8 w-56 text-xs"><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent>{versionen.map((x: any) => <SelectItem key={x.id} value={String(x.id)} className="text-xs">{x.name}</SelectItem>)}</SelectContent>
    </Select>
  )
  return (
    <Dialog open={offen} onOpenChange={x => !x && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{tt(K.vergleichen)}</DialogTitle>
          {v && <DialogDescription>{v.unterschiede === 1 ? tt(K.einUnterschied) : tt(K.unterschiede).replace('{n}', String(v.unterschiede))}</DialogDescription>}
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          {wahl(a, setA, tt(K.fassungA))}
          <span className="text-xs text-muted-foreground">↔</span>
          {wahl(b, setB, tt(K.fassungB))}
          {bereit && (
            <>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => download(api.budget.vergleichCsv(pid, Number(a), Number(b)), 'vergleich.csv')}>{tt(K.csv)}</Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => download(api.budget.vergleichPdf(pid, Number(a), Number(b)), 'vergleich.pdf')}>PDF</Button>
            </>
          )}
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading && <p className="text-xs text-muted-foreground py-4">…</p>}
          {v && (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left py-1.5">{tt(K.kostenart)}</th>
                  <th className="text-right py-1.5">{v.a.name}</th><th className="text-right py-1.5">{v.b.name}</th>
                  <th className="text-right py-1.5">{tt(K.differenz)}</th><th className="w-24" />
                </tr>
              </thead>
              <tbody>
                {v.gruppen.map((g: any) => (
                  <Fragment key={g.name}>
                    <tr className="bg-muted/40 font-semibold text-xs">
                      <td className="py-1.5 pl-1">{g.name}</td>
                      <td className="text-right font-mono">{formatCurrency(g.a_cents)}</td><td className="text-right font-mono">{formatCurrency(g.b_cents)}</td>
                      <td className={`text-right font-mono ${g.diff_cents > 0 ? 'text-danger' : g.diff_cents < 0 ? 'text-success' : ''}`}>{formatCurrency(g.diff_cents)}</td><td />
                    </tr>
                    {g.zeilen.map((z: any, i: number) => (
                      <tr key={i} className={`border-b border-border/20 text-xs ${z.art === 'beide' && z.diff_cents === 0 ? 'text-muted-foreground' : ''}`}>
                        <td className="py-1 pl-4">{z.description}</td>
                        <td className="text-right font-mono">{betrag(z.a_cents)}</td><td className="text-right font-mono">{betrag(z.b_cents)}</td>
                        <td className="text-right font-mono">{z.diff_cents ? formatCurrency(z.diff_cents) : ''}</td>
                        <td className="text-right text-[10px] font-semibold">{z.art === 'nur_a' ? tt(K.nurInA) : z.art === 'nur_b' ? tt(K.nurInB) : ''}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
                <tr className="font-bold text-sm">
                  <td className="py-2 pl-1">{tt(K.gesamt)}</td>
                  <td className="text-right font-mono">{formatCurrency(v.summe.a_cents)}</td><td className="text-right font-mono">{formatCurrency(v.summe.b_cents)}</td>
                  <td className="text-right font-mono">{formatCurrency(v.summe.diff_cents)}</td><td />
                </tr>
              </tbody>
            </table>
          )}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>{tt(K.schliessen)}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
