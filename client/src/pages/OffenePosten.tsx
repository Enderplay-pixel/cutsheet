import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useDownload } from '@/lib/useDownload'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import {
  Download, AlertTriangle, Clock, BellRing, Euro as EuroIcon, Plus, Trash2,
  FileText, ArrowLeft, Info,
} from 'lucide-react'

const euro = (cents: number) =>
  (Number(cents || 0) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })

const datum = (wert: string | null | undefined) =>
  wert ? new Date(String(wert).slice(0, 10)).toLocaleDateString('de-DE') : '—'

const heute = () => new Date().toISOString().slice(0, 10)

/** Basispunkte als Prozentsatz: 1052 wird zu "10,52 %". */
const prozent = (bp: number) =>
  `${(Number(bp || 0) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`

/**
 * Die Farben der Altersklassen.
 *
 * Grün für das, was noch läuft, und Rot erst ab 90 Tagen. Eine Liste, in der
 * alles rot leuchtet, sagt nichts mehr - und eine Rechnung, die fünf Tage über
 * der Frist liegt, ist kein Notfall.
 */
const KLASSENFARBE: Record<string, string> = {
  'nicht fällig': 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  'bis 30 Tage': 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  '31 bis 60 Tage': 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  '61 bis 90 Tage': 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  'über 90 Tage': 'bg-destructive/15 text-destructive',
}

export function Component() {
  const { companyId } = useParams()
  const firmaId = Number(companyId)
  const { data: firma } = useQuery({ queryKey: ['firma', firmaId], queryFn: () => api.firmen.lesen(firmaId) })

  return (
    <div className="px-5 py-6 sm:p-6 max-w-6xl mx-auto space-y-4">
      <PageHeader
        title="Offene Posten"
        subtitle={firma?.name || ''}
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/firma/${firmaId}/rechnungen`}>
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Rechnungen
            </Link>
          </Button>
        }
      />

      <Tabs defaultValue="posten">
        <TabsList>
          <TabsTrigger value="posten">
            <EuroIcon className="w-3.5 h-3.5 mr-1.5" />
            Liste
          </TabsTrigger>
          <TabsTrigger value="mahnlauf">
            <BellRing className="w-3.5 h-3.5 mr-1.5" />
            Mahnlauf
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posten" className="mt-4">
          <PostenListe firmaId={firmaId} />
        </TabsContent>
        <TabsContent value="mahnlauf" className="mt-4">
          <Mahnlauf firmaId={firmaId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Die Liste ───────────────────────────────────────────────────────────────

function PostenListe({ firmaId }: { firmaId: number }) {
  const download = useDownload()
  const [zahlungFuer, setZahlungFuer] = useState<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['opos', firmaId],
    queryFn: () => api.mahnwesen.opos(firmaId),
  })

  const posten: any[] = data?.posten ?? []

  if (isLoading) return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Lade…</CardContent></Card>

  return (
    <div className="space-y-4">
      {/* Die beiden Zahlen, um die es geht */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Offen</div>
            <div className="text-2xl font-semibold mt-1">{euro(data?.offen_cents ?? 0)}</div>
            <div className="text-xs text-muted-foreground mt-1">{posten.length} Rechnungen</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Davon überfällig</div>
            <div className="text-2xl font-semibold mt-1 text-amber-600 dark:text-amber-400">
              {euro(data?.ueberfaellig_cents ?? 0)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {posten.filter((p) => p.tage_ueberfaellig > 0).length} Rechnungen
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Verzugszins</div>
            <div className="text-2xl font-semibold mt-1">
              {prozent((data?.basiszins_bp ?? 0) + 900)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Basiszins {prozent(data?.basiszins_bp ?? 0)}, Stand {datum(data?.basiszins_stand)}
            </div>
          </CardContent>
        </Card>
      </div>

      {data?.basiszins_veraltet && (
        <div className="flex items-start gap-2 text-xs p-3 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Der Basiszinssatz ist seit dem {datum(data.basiszins_stand)} eingetragen. Die Bundesbank
            prüft ihn zum 1. Januar und zum 1. Juli - bitte nachsehen und in den
            Buchhaltungseinstellungen eintragen. Ein veralteter Satz macht die Zinsforderung
            angreifbar.
          </span>
        </div>
      )}

      {/* Altersstruktur */}
      <Card>
        <CardContent className="pt-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Altersstruktur</div>
          <div className="space-y-1.5">
            {(data?.struktur ?? []).map((s: any) => {
              const anteil = (data?.offen_cents ?? 0) > 0
                ? Math.round((s.summe_cents / data.offen_cents) * 100)
                : 0
              return (
                <div key={s.klasse} className="flex items-center gap-3 text-sm">
                  <span className={`text-xs px-2 py-0.5 rounded-full w-32 text-center shrink-0 ${KLASSENFARBE[s.klasse] ?? ''}`}>
                    {s.klasse}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-foreground/30 rounded-full"
                      style={{ width: `${anteil}%` }}
                    />
                  </div>
                  <span className="tabular-nums w-28 text-right">{euro(s.summe_cents)}</span>
                  <span className="text-xs text-muted-foreground w-10 text-right">{s.anzahl}</span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Die Rechnungen */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
            <span className="text-sm font-medium">Rechnungen</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => download(api.mahnwesen.oposCsvUrl(firmaId), `offene-posten-${heute()}.csv`)}
              disabled={posten.length === 0}
            >
              <Download className="w-4 h-4 mr-1.5" />
              Als CSV
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="text-left py-2.5 px-4">Nummer</th>
                  <th className="text-left py-2.5 px-4">Auftraggeber</th>
                  <th className="text-left py-2.5 px-4">Fällig</th>
                  <th className="text-right py-2.5 px-4">Offen</th>
                  <th className="text-left py-2.5 px-4">Alter</th>
                  <th className="text-left py-2.5 px-4">Mahnung</th>
                  <th className="py-2.5 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {posten.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-14 text-center text-muted-foreground">
                      Nichts offen. Alle festgeschriebenen Rechnungen sind bezahlt.
                    </td>
                  </tr>
                ) : (
                  posten.map((p) => (
                    <tr key={p.id} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="py-2.5 px-4 font-mono text-xs">
                        <Link to={`/firma/${firmaId}/rechnungen/${p.id}`} className="hover:underline">
                          {p.number}
                        </Link>
                      </td>
                      <td className="py-2.5 px-4">
                        {p.client_name}
                        {p.project_title && (
                          <span className="text-xs text-muted-foreground block">{p.project_title}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {datum(p.due_date)}
                        {p.tage_ueberfaellig > 0 && (
                          <span className="text-xs text-muted-foreground block">
                            {p.tage_ueberfaellig} Tage
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums whitespace-nowrap">
                        {euro(p.offen_cents)}
                        {p.bezahlt_cents > 0 && (
                          <span className="text-xs text-muted-foreground block">
                            von {euro(p.gross_cents)}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${KLASSENFARBE[p.klasse] ?? ''}`}>
                          {p.klasse}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-muted-foreground whitespace-nowrap">
                        {p.reminder_level > 0 ? (
                          <>
                            Stufe {p.reminder_level}
                            <span className="block">Frist {datum(p.reminder_due_on)}</span>
                          </>
                        ) : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setZahlungFuer(p)}>
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Zahlung
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {zahlungFuer && (
        <ZahlungenDialog
          firmaId={firmaId}
          posten={zahlungFuer}
          schliessen={() => setZahlungFuer(null)}
        />
      )}
    </div>
  )
}

// ─── Zahlungen ───────────────────────────────────────────────────────────────

const ZAHLWEGE = [
  { wert: 'ueberweisung', label: 'Überweisung' },
  { wert: 'bar', label: 'Bar' },
  { wert: 'karte', label: 'Karte' },
  { wert: 'verrechnung', label: 'Verrechnung' },
]

function ZahlungenDialog({ firmaId, posten, schliessen }: { firmaId: number; posten: any; schliessen: () => void }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  // Voreingestellt ist der offene Restbetrag: Der häufigste Fall ist, dass
  // genau der Rest überwiesen wurde.
  const [betrag, setBetrag] = useState(((posten.offen_cents ?? 0) / 100).toFixed(2).replace('.', ','))
  const [am, setAm] = useState(heute())
  const [weg, setWeg] = useState('ueberweisung')
  const [vermerk, setVermerk] = useState('')

  const { data: zahlungen } = useQuery({
    queryKey: ['zahlungen', firmaId, posten.id],
    queryFn: () => api.mahnwesen.zahlungen(firmaId, posten.id),
  })

  const neuLaden = () => {
    qc.invalidateQueries({ queryKey: ['zahlungen', firmaId, posten.id] })
    qc.invalidateQueries({ queryKey: ['opos', firmaId] })
    qc.invalidateQueries({ queryKey: ['mahnlauf', firmaId] })
    qc.invalidateQueries({ queryKey: ['rechnungen', firmaId] })
  }

  const erfassen = useMutation({
    mutationFn: () => {
      // Ganzzahlig aus dem Text: parseFloat und × 100 verliert Cent.
      const sauber = betrag.replace(/\s/g, '').replace(',', '.')
      const stellen = sauber.split('.')
      const cents = Math.round(Number(stellen[0] || 0)) * 100
        + (stellen[1] ? Math.round(Number((stellen[1] + '00').slice(0, 2))) : 0)
      const vorzeichen = sauber.trimStart().startsWith('-') ? -1 : 1
      return api.mahnwesen.zahlungErfassen(firmaId, posten.id, {
        amount_cents: vorzeichen * Math.abs(cents),
        paid_on: am,
        method: weg,
        note: vermerk,
      })
    },
    onSuccess: (ergebnis: any) => {
      neuLaden()
      setVermerk('')
      toast({
        title: ergebnis?.stand === 'bezahlt' ? 'Rechnung ist bezahlt' : 'Zahlung erfasst',
        description: `Bezahlt: ${euro(ergebnis?.bezahlt_cents ?? 0)} von ${euro(posten.gross_cents)}`,
      })
      if (ergebnis?.stand === 'bezahlt') schliessen()
    },
    onError: (fehler: any) =>
      toast({ title: 'Nicht erfasst', description: fehler.message, variant: 'destructive' }),
  })

  const loeschen = useMutation({
    mutationFn: (id: number) => api.mahnwesen.zahlungLoeschen(firmaId, posten.id, id),
    onSuccess: () => { neuLaden(); toast({ title: 'Zahlung entfernt' }) },
    onError: (fehler: any) =>
      toast({ title: 'Nicht entfernt', description: fehler.message, variant: 'destructive' }),
  })

  return (
    <Dialog open onOpenChange={(offen) => { if (!offen) schliessen() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Zahlungen zu {posten.number}</DialogTitle>
          <DialogDescription>
            {posten.client_name} · offen {euro(posten.offen_cents)} von {euro(posten.gross_cents)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="zahlung-betrag">Betrag</Label>
              <Input
                id="zahlung-betrag"
                value={betrag}
                onChange={(e) => setBetrag(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div>
              <Label htmlFor="zahlung-datum">Eingegangen am</Label>
              <Input id="zahlung-datum" type="date" value={am} onChange={(e) => setAm(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="zahlung-weg">Weg</Label>
              <Select value={weg} onValueChange={setWeg}>
                <SelectTrigger id="zahlung-weg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ZAHLWEGE.map((w) => (
                    <SelectItem key={w.wert} value={w.wert}>{w.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="zahlung-vermerk">Vermerk</Label>
              <Input
                id="zahlung-vermerk"
                value={vermerk}
                onChange={(e) => setVermerk(e.target.value)}
                placeholder="freiwillig"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Ein negativer Betrag bildet eine Rücklastschrift ab. Die ursprüngliche Zahlung bleibt
            dabei stehen - was eingegangen war, war eingegangen.
          </p>
          <Button onClick={() => erfassen.mutate()} disabled={erfassen.isPending} className="w-full">
            <Plus className="w-4 h-4 mr-1.5" />
            Zahlung erfassen
          </Button>
        </div>

        {(zahlungen ?? []).length > 0 && (
          <div className="border-t border-border/60 pt-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Erfasst</div>
            <div className="space-y-1">
              {(zahlungen ?? []).map((z: any) => (
                <div key={z.id} className="flex items-center gap-2 text-sm">
                  <span className="text-xs text-muted-foreground font-mono w-20">{datum(z.paid_on)}</span>
                  <span className="tabular-nums w-24 text-right">{euro(z.amount_cents)}</span>
                  <span className="text-xs text-muted-foreground flex-1 truncate">
                    {ZAHLWEGE.find((w) => w.wert === z.method)?.label ?? z.method}
                    {z.note ? ` · ${z.note}` : ''}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => loeschen.mutate(z.id)}
                    aria-label="Zahlung entfernen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Entfernen ist für Erfassungsfehler gedacht - ein Tippfehler ist kein Geschäftsvorfall.
              Jede Löschung steht im Protokoll.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={schliessen}>Schließen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Mahnlauf ────────────────────────────────────────────────────────────────

function Mahnlauf({ firmaId }: { firmaId: number }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const download = useDownload()
  const [stichtag, setStichtag] = useState(heute())
  const [frage, setFrage] = useState<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['mahnlauf', firmaId, stichtag],
    queryFn: () => api.mahnwesen.mahnlauf(firmaId, stichtag),
  })

  const mahnen = useMutation({
    mutationFn: ({ id, mail }: { id: number; mail: boolean }) => api.mahnwesen.mahnen(firmaId, id, mail),
    onSuccess: (ergebnis: any) => {
      qc.invalidateQueries({ queryKey: ['mahnlauf', firmaId] })
      qc.invalidateQueries({ queryKey: ['opos', firmaId] })
      setFrage(null)
      toast({
        title: `Stufe ${ergebnis.stufe} festgeschrieben`,
        description: `Frist bis ${datum(ergebnis.frist)} · Mail: ${ergebnis.mail}`,
      })
    },
    onError: (fehler: any) =>
      toast({ title: 'Nicht gemahnt', description: fehler.message, variant: 'destructive' }),
  })

  const vorschlaege: any[] = data?.vorschlaege ?? []

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="mahnlauf-stichtag">Stichtag</Label>
              <Input
                id="mahnlauf-stichtag"
                type="date"
                value={stichtag}
                onChange={(e) => setStichtag(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="text-sm text-muted-foreground pb-2">
              {isLoading
                ? 'Lade…'
                : vorschlaege.length === 0
                  ? 'Nichts zu mahnen.'
                  : `${vorschlaege.length} ${vorschlaege.length === 1 ? 'Rechnung' : 'Rechnungen'}`}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Diese Ansicht berechnet nur. Verschickt wird je Rechnung einzeln und nach Rückfrage -
            wer vier Mahnungen schickt, soll vier Entscheidungen getroffen haben.
          </p>
          {data?.aus && (
            <div className="flex items-start gap-2 text-xs p-3 rounded-lg bg-muted">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Das Mahnwesen ist für diese Firma abgeschaltet. Vorschläge werden trotzdem
                berechnet, damit sichtbar bleibt, was anstünde.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {vorschlaege.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            {isLoading ? 'Lade…' : (
              <>
                Zum {datum(stichtag)} steht keine Mahnung an.
                <span className="block text-xs mt-1">
                  Gründe: bezahlt, noch nicht fällig, oder die Frist der letzten Mahnung läuft noch.
                </span>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {vorschlaege.map((v) => (
            <Card key={v.invoice_id}>
              <CardContent className="pt-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400">
                        {v.stufe_name}
                      </span>
                      <Link
                        to={`/firma/${firmaId}/rechnungen/${v.invoice_id}`}
                        className="font-mono text-sm hover:underline"
                      >
                        {v.number}
                      </Link>
                    </div>
                    <div className="text-sm mt-1">{v.client_name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      {v.tage_verzug} Tage über der Frist vom {datum(v.due_date)}
                      {!v.client_email && (
                        <span className="text-destructive flex items-center gap-1 ml-1">
                          <AlertTriangle className="w-3 h-3" />
                          keine Mailadresse
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold tabular-nums">{euro(v.gesamt_cents)}</div>
                    <div className="text-xs text-muted-foreground">
                      neue Frist {datum(v.neue_frist)}
                    </div>
                  </div>
                </div>

                {/* Die Aufstellung - der Betrag muss nachrechenbar sein */}
                <div className="mt-3 pt-3 border-t border-border/60 grid gap-1 text-sm max-w-md">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Offener Betrag</span>
                    <span className="tabular-nums">{euro(v.offen_cents)}</span>
                  </div>
                  {v.zinsen_cents > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Verzugszinsen ({prozent(v.is_business
                          ? (data?.verzugssatz_unternehmer_bp ?? 0)
                          : (data?.verzugssatz_verbraucher_bp ?? 0))} für {v.tage_verzug} Tage)
                      </span>
                      <span className="tabular-nums">{euro(v.zinsen_cents)}</span>
                    </div>
                  )}
                  {v.gebuehr_cents > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Mahnkosten</span>
                      <span className="tabular-nums">{euro(v.gebuehr_cents)}</span>
                    </div>
                  )}
                  {v.pauschale_cents > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pauschale nach § 288 Abs. 5 BGB</span>
                      <span className="tabular-nums">{euro(v.pauschale_cents)}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      download(
                        `${api.mahnwesen.mahnungPdfUrl(firmaId, v.invoice_id)}?stichtag=${stichtag}`,
                        `mahnung-${v.number}.pdf`
                      )
                    }
                  >
                    <FileText className="w-4 h-4 mr-1.5" />
                    Schreiben ansehen
                  </Button>
                  <Button size="sm" onClick={() => setFrage(v)}>
                    <BellRing className="w-4 h-4 mr-1.5" />
                    {v.client_email ? 'Mahnen und senden' : 'Mahnen'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {frage && (
        <Dialog open onOpenChange={(offen) => { if (!offen) setFrage(null) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{frage.stufe_name} an {frage.client_name}</DialogTitle>
              <DialogDescription>
                {frage.client_email
                  ? `Die Mahnung wird festgeschrieben und als Mail mit Schreiben im Anhang an ${frage.client_email} eingereiht.`
                  : 'Die Mahnung wird festgeschrieben. Eine Mail geht nicht raus - für diesen Auftraggeber ist keine Adresse hinterlegt.'}
              </DialogDescription>
            </DialogHeader>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rechnung</span>
                <span className="font-mono">{frage.number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gefordert</span>
                <span className="tabular-nums font-semibold">{euro(frage.gesamt_cents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Neue Frist</span>
                <span>{datum(frage.neue_frist)}</span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setFrage(null)}>Abbrechen</Button>
              {frage.client_email && (
                <Button
                  variant="outline"
                  onClick={() => mahnen.mutate({ id: frage.invoice_id, mail: false })}
                  disabled={mahnen.isPending}
                >
                  Nur festschreiben
                </Button>
              )}
              <Button
                onClick={() => mahnen.mutate({ id: frage.invoice_id, mail: !!frage.client_email })}
                disabled={mahnen.isPending}
              >
                {frage.client_email ? 'Festschreiben und senden' : 'Festschreiben'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
