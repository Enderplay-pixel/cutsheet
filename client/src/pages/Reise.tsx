import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useDownload } from '@/lib/useDownload'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { BedDouble, Car, Plus, Trash2, Download, Info, Coffee } from 'lucide-react'

const euro = (cents: number) =>
  (Number(cents || 0) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })

const datum = (wert: string | null | undefined) =>
  wert ? new Date(String(wert).slice(0, 10)).toLocaleDateString('de-DE') : '—'

/** Betrag aus einem Textfeld in Cent - ganzzahlig. */
function alsCents(text: string): number {
  const sauber = String(text).replace(/\s|\./g, '').replace(',', '.')
  const teile = sauber.split('.')
  const ganz = Math.abs(Math.trunc(Number(teile[0] || 0)))
  const rest = teile[1] ? Math.round(Number((teile[1] + '00').slice(0, 2))) : 0
  return ganz * 100 + rest
}

const alsText = (cents: number) => (Number(cents || 0) / 100).toFixed(2).replace('.', ',')

const TAGESART: Record<string, string> = {
  einzeln: 'Eintägig',
  anreise: 'Anreise',
  zwischentag: 'Voller Tag',
  abreise: 'Abreise',
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)

  return (
    <div className="px-5 py-6 sm:p-6 max-w-5xl mx-auto space-y-4">
      <PageHeader
        title="Reise und Unterkunft"
        subtitle="Wo die Leute schlafen, und was ihnen dafür zusteht"
      />

      <Tabs defaultValue="reisen">
        <TabsList>
          <TabsTrigger value="reisen">
            <Car className="w-3.5 h-3.5 mr-1.5" />
            Reisekosten
          </TabsTrigger>
          <TabsTrigger value="unterkunft">
            <BedDouble className="w-3.5 h-3.5 mr-1.5" />
            Unterkünfte
          </TabsTrigger>
        </TabsList>
        <TabsContent value="reisen" className="mt-4"><Reisen pid={pid} /></TabsContent>
        <TabsContent value="unterkunft" className="mt-4"><Unterkuenfte pid={pid} /></TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Reisekosten ─────────────────────────────────────────────────────────────

function Reisen({ pid }: { pid: number }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const download = useDownload()
  const [neu, setNeu] = useState(false)
  const [offen, setOffen] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['reisen', pid],
    queryFn: () => api.reisen.liste(pid),
  })

  const liste: any[] = data?.reisen ?? []
  const saetze = data?.saetze

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 text-xs p-3 rounded-lg bg-muted">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Verpflegungsmehraufwand nach § 9 Abs. 4a EStG: {euro(saetze?.pauschale_8h_cents ?? 1400)} bei
          mehr als acht Stunden, {euro(saetze?.pauschale_24h_cents ?? 2800)} am vollen Tag,{' '}
          {euro(saetze?.pauschale_anreise_cents ?? 1400)} an An- und Abreisetagen. Gestellte Mahlzeiten
          kürzen - immer gerechnet vom vollen Tagessatz, auch an einem Tag mit dem halben.
          {saetze?.grundlage && (
            <span className="block mt-1 text-muted-foreground">
              Für Auslandsreisen gelten Ländersätze, die hier nicht hinterlegt sind.
            </span>
          )}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm">
          {liste.length > 0 && (
            <>Summe <strong className="tabular-nums">{euro(data?.summe_cents ?? 0)}</strong></>
          )}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => download(api.reisen.csvUrl(pid), `reisekosten-${pid}.csv`)}
            disabled={liste.length === 0}
          >
            <Download className="w-4 h-4 mr-1.5" />
            Als CSV
          </Button>
          <Button size="sm" onClick={() => setNeu(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Reise
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Lade…</CardContent></Card>
      ) : liste.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            Noch keine Reise erfasst.
            <span className="block text-xs mt-1">
              Aus dem Zeitraum entstehen die Tage von selbst - An- und Abreise zählen anders als die
              Tage dazwischen.
            </span>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="text-left py-2.5 px-4">Person</th>
                    <th className="text-left py-2.5 px-4">Zeitraum</th>
                    <th className="text-right py-2.5 px-4">Verpflegung</th>
                    <th className="text-right py-2.5 px-4">Fahrt</th>
                    <th className="text-right py-2.5 px-4">Übernachtung</th>
                    <th className="text-right py-2.5 px-4">Gesamt</th>
                    <th className="py-2.5 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {liste.map((r) => (
                    <tr key={r.id} className="border-b border-border/40">
                      <td className="py-2.5 px-4">
                        {r.person_name || '—'}
                        {r.purpose && <span className="text-xs text-muted-foreground block">{r.purpose}</span>}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {datum(r.from_date)}
                        {String(r.to_date).slice(0, 10) !== String(r.from_date).slice(0, 10) &&
                          ` – ${datum(r.to_date)}`}
                        <span className="text-xs text-muted-foreground block">{r.tage} Tage</span>
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums">{euro(r.verpflegung_cents)}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">
                        {euro(r.fahrt_cents)}
                        {r.kilometers > 0 && (
                          <span className="text-xs block">{r.kilometers} km</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">
                        {euro(r.uebernachtung_cents)}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums font-medium">{euro(r.gesamt_cents)}</td>
                      <td className="py-2.5 px-4 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setOffen(r.id)}>Öffnen</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {neu && (
        <ReiseAnlegen
          pid={pid}
          schliessen={() => setNeu(false)}
          angelegt={(id) => {
            qc.invalidateQueries({ queryKey: ['reisen', pid] })
            setNeu(false)
            setOffen(id)
          }}
        />
      )}
      {offen !== null && <ReiseDialog pid={pid} id={offen} schliessen={() => setOffen(null)} />}
    </div>
  )
}

function ReiseAnlegen({ pid, schliessen, angelegt }: {
  pid: number; schliessen: () => void; angelegt: (id: number) => void
}) {
  const { toast } = useToast()
  const heute = new Date().toISOString().slice(0, 10)
  const [werte, setWerte] = useState({
    person_type: 'crew',
    person_id: '',
    person_name: '',
    purpose: '',
    from_date: heute,
    to_date: heute,
    kilometers: '',
    lodging: '',
    accommodation_id: '',
  })

  const { data: stab } = useQuery({ queryKey: ['crew', pid], queryFn: () => api.crew.list(pid) })
  const { data: besetzung } = useQuery({ queryKey: ['cast', pid], queryFn: () => api.cast.list(pid) })
  const { data: haeuser } = useQuery({
    queryKey: ['unterkuenfte', pid],
    queryFn: () => api.unterkuenfte.liste(pid),
  })

  const personen = [
    ...(stab ?? []).map((p: any) => ({ art: 'crew', id: p.id, name: p.name })),
    ...(besetzung ?? []).map((p: any) => ({ art: 'cast', id: p.id, name: p.actor_name })),
  ].filter((p) => p.name)

  const anlegen = useMutation({
    mutationFn: () => api.reisen.anlegen(pid, {
      person_type: werte.person_type,
      person_id: werte.person_id ? Number(werte.person_id) : null,
      person_name: werte.person_name,
      purpose: werte.purpose,
      from_date: werte.from_date,
      to_date: werte.to_date,
      kilometers: Math.round(Number(werte.kilometers) || 0),
      lodging_cents: alsCents(werte.lodging),
      accommodation_id: werte.accommodation_id ? Number(werte.accommodation_id) : null,
    }),
    onSuccess: (r: any) => angelegt(r.id),
    onError: (f: any) => toast({ title: 'Nicht angelegt', description: f.message, variant: 'destructive' }),
  })

  return (
    <Dialog open onOpenChange={(o) => { if (!o) schliessen() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neue Reise</DialogTitle>
          <DialogDescription>
            Aus dem Zeitraum entstehen die Tage. Ist bei der Unterkunft Frühstück inklusive, wird
            die Kürzung gleich eingetragen - sie wird sonst am häufigsten vergessen.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="reise-person">Person</Label>
            <Select
              value={werte.person_id ? `${werte.person_type}:${werte.person_id}` : ''}
              onValueChange={(w) => {
                const [art, id] = w.split(':')
                const p = personen.find((x) => x.art === art && String(x.id) === id)
                setWerte({ ...werte, person_type: art, person_id: id, person_name: p?.name ?? '' })
              }}
            >
              <SelectTrigger id="reise-person"><SelectValue placeholder="wählen" /></SelectTrigger>
              <SelectContent>
                {personen.map((p) => (
                  <SelectItem key={`${p.art}:${p.id}`} value={`${p.art}:${p.id}`}>
                    {p.name} <span className="text-muted-foreground">({p.art === 'crew' ? 'Stab' : 'Besetzung'})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="reise-anlass">Anlass</Label>
            <Input
              id="reise-anlass"
              value={werte.purpose}
              onChange={(e) => setWerte({ ...werte, purpose: e.target.value })}
              placeholder="Dreh Bochum, Motivbesichtigung …"
            />
          </div>
          <div>
            <Label htmlFor="reise-von">Von</Label>
            <Input
              id="reise-von"
              type="date"
              value={werte.from_date}
              onChange={(e) => setWerte({ ...werte, from_date: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="reise-bis">Bis</Label>
            <Input
              id="reise-bis"
              type="date"
              value={werte.to_date}
              onChange={(e) => setWerte({ ...werte, to_date: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="reise-km">Kilometer</Label>
            <Input
              id="reise-km"
              value={werte.kilometers}
              onChange={(e) => setWerte({ ...werte, kilometers: e.target.value })}
              inputMode="numeric"
              placeholder="hin und zurück"
            />
          </div>
          <div>
            <Label htmlFor="reise-hotel">Übernachtung gesamt</Label>
            <Input
              id="reise-hotel"
              value={werte.lodging}
              onChange={(e) => setWerte({ ...werte, lodging: e.target.value })}
              inputMode="decimal"
              placeholder="tatsächliche Kosten"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="reise-unterkunft">Unterkunft</Label>
            <Select
              value={werte.accommodation_id}
              onValueChange={(w) => setWerte({ ...werte, accommodation_id: w })}
            >
              <SelectTrigger id="reise-unterkunft"><SelectValue placeholder="freiwillig" /></SelectTrigger>
              <SelectContent>
                {(haeuser ?? []).map((h: any) => (
                  <SelectItem key={h.id} value={String(h.id)}>
                    {h.name}{h.breakfast_included ? ' (mit Frühstück)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={schliessen}>Abbrechen</Button>
          <Button
            onClick={() => anlegen.mutate()}
            disabled={!werte.person_name.trim() || !werte.from_date || anlegen.isPending}
          >
            Anlegen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReiseDialog({ pid, id, schliessen }: { pid: number; id: number; schliessen: () => void }) {
  const qc = useQueryClient()
  const { toast } = useToast()

  const { data: reise } = useQuery({
    queryKey: ['reise', pid, id],
    queryFn: () => api.reisen.lesen(pid, id),
  })

  const neuLaden = () => {
    qc.invalidateQueries({ queryKey: ['reise', pid, id] })
    qc.invalidateQueries({ queryKey: ['reisen', pid] })
  }

  const tag = useMutation({
    mutationFn: ({ tagId, daten }: { tagId: number; daten: any }) => api.reisen.tag(pid, id, tagId, daten),
    onSuccess: neuLaden,
    onError: (f: any) => toast({ title: 'Nicht gespeichert', description: f.message, variant: 'destructive' }),
  })

  const speichern = useMutation({
    mutationFn: (daten: any) => api.reisen.speichern(pid, id, daten),
    onSuccess: neuLaden,
    onError: (f: any) => toast({ title: 'Nicht gespeichert', description: f.message, variant: 'destructive' }),
  })

  const loeschen = useMutation({
    mutationFn: () => api.reisen.loeschen(pid, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reisen', pid] }); schliessen() },
    onError: (f: any) => toast({ title: 'Nicht gelöscht', description: f.message, variant: 'destructive' }),
  })

  if (!reise) {
    return (
      <Dialog open onOpenChange={schliessen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reise</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Lade…</p>
        </DialogContent>
      </Dialog>
    )
  }

  const a = reise.abrechnung

  return (
    <Dialog open onOpenChange={(o) => { if (!o) schliessen() }}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{reise.person_name}</DialogTitle>
          <DialogDescription>
            {reise.purpose && `${reise.purpose} · `}
            {datum(reise.from_date)}
            {String(reise.to_date).slice(0, 10) !== String(reise.from_date).slice(0, 10) &&
              ` bis ${datum(reise.to_date)}`}
          </DialogDescription>
        </DialogHeader>

        {/* Die Tage */}
        <div className="space-y-1.5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Tage</div>
          {reise.tage.map((t: any) => {
            const zeile = a.tage.find((z: any) => z.datum === String(t.day_date).slice(0, 10))
            return (
              <div key={t.id} className="flex flex-wrap items-center gap-2 text-sm py-1 border-b border-border/40 last:border-0">
                <span className="font-mono text-xs w-20">{datum(t.day_date)}</span>
                <span className="text-xs text-muted-foreground w-20">{TAGESART[t.kind] ?? t.kind}</span>
                {t.kind === 'einzeln' && (
                  <Input
                    aria-label="Stunden abwesend"
                    className="w-16 h-7 text-xs"
                    defaultValue={Math.round((t.minutes_away / 60) * 10) / 10}
                    onBlur={(e) =>
                      tag.mutate({
                        tagId: t.id,
                        daten: { minutes_away: Math.round(Number(e.target.value.replace(',', '.')) * 60) || 0 },
                      })
                    }
                    inputMode="decimal"
                  />
                )}
                <div className="flex gap-1">
                  {([
                    ['breakfast', 'F', t.breakfast],
                    ['lunch', 'M', t.lunch],
                    ['dinner', 'A', t.dinner],
                  ] as const).map(([feld, kuerzel, an]) => (
                    <Button
                      key={feld}
                      variant={an ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 w-7 p-0 text-xs"
                      onClick={() => tag.mutate({ tagId: t.id, daten: { [feld]: !an } })}
                      aria-label={`${kuerzel === 'F' ? 'Frühstück' : kuerzel === 'M' ? 'Mittagessen' : 'Abendessen'} gestellt`}
                    >
                      {kuerzel}
                    </Button>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground ml-auto tabular-nums">
                  {euro(zeile?.pauschaleCents ?? 0)}
                  {(zeile?.kuerzungCents ?? 0) > 0 && ` − ${euro(zeile.kuerzungCents)}`}
                </span>
                <span className="tabular-nums w-16 text-right">{euro(zeile?.satzCents ?? 0)}</span>
              </div>
            )
          })}
          <p className="text-xs text-muted-foreground pt-1 flex items-center gap-1">
            <Coffee className="w-3 h-3" />
            F, M, A = gestelltes Frühstück, Mittag- oder Abendessen. Die Kürzung rechnet immer vom
            vollen Tagessatz.
          </p>
        </div>

        {/* Fahrt und Hotel */}
        <div className="grid gap-3 sm:grid-cols-2 border-t border-border/60 pt-3">
          <div>
            <Label htmlFor="reise-km-d">Kilometer</Label>
            <Input
              id="reise-km-d"
              defaultValue={reise.kilometers || ''}
              onBlur={(e) => speichern.mutate({ kilometers: Math.round(Number(e.target.value) || 0) })}
              inputMode="numeric"
            />
          </div>
          <div>
            <Label htmlFor="reise-hotel-d">Übernachtung gesamt</Label>
            <Input
              id="reise-hotel-d"
              defaultValue={reise.lodging_cents ? alsText(reise.lodging_cents) : ''}
              onBlur={(e) => speichern.mutate({ lodging_cents: alsCents(e.target.value) })}
              inputMode="decimal"
            />
          </div>
        </div>

        {/* Summe */}
        <div className="border-t border-border/60 pt-3 grid gap-1 text-sm max-w-xs ml-auto">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Verpflegung</span>
            <span className="tabular-nums">{euro(a.verpflegungCents)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fahrt</span>
            <span className="tabular-nums">{euro(a.fahrtCents)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Übernachtung</span>
            <span className="tabular-nums">{euro(a.uebernachtungCents)}</span>
          </div>
          <div className="flex justify-between font-semibold text-base">
            <span>Gesamt</span>
            <span className="tabular-nums">{euro(a.gesamtCents)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => loeschen.mutate()}
            className="text-destructive hover:text-destructive mr-auto"
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Löschen
          </Button>
          <Button variant="ghost" onClick={schliessen}>Schließen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Unterkünfte ─────────────────────────────────────────────────────────────

function Unterkuenfte({ pid }: { pid: number }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [bearbeite, setBearbeite] = useState<any>(null)

  const { data: haeuser, isLoading } = useQuery({
    queryKey: ['unterkuenfte', pid],
    queryFn: () => api.unterkuenfte.liste(pid),
  })

  const loeschen = useMutation({
    mutationFn: (id: number) => api.unterkuenfte.loeschen(pid, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unterkuenfte', pid] })
      toast({ title: 'Entfernt' })
    },
    onError: (f: any) => toast({ title: 'Nicht entfernt', description: f.message, variant: 'destructive' }),
  })

  const liste: any[] = haeuser ?? []

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setBearbeite({ neu: true })}>
          <Plus className="w-4 h-4 mr-1.5" />
          Unterkunft
        </Button>
      </div>

      {isLoading ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Lade…</CardContent></Card>
      ) : liste.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            Keine Unterkunft hinterlegt.
          </CardContent>
        </Card>
      ) : (
        liste.map((h) => (
          <Card key={h.id}>
            <CardHeader className="pb-2 flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base">{h.name}</CardTitle>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {[h.address, [h.zip, h.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
                  {h.phone && ` · ${h.phone}`}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setBearbeite(h)}>Ändern</Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => loeschen.mutate(h.id)}
                  aria-label="Unterkunft entfernen"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 text-sm">
                <span>
                  <span className="text-muted-foreground">Anreise </span>
                  {datum(h.check_in)}
                </span>
                <span>
                  <span className="text-muted-foreground">Abreise </span>
                  {datum(h.check_out)}
                </span>
                <span>
                  <span className="text-muted-foreground">Nacht </span>
                  {euro(h.price_per_night_cents)}
                </span>
                {h.breakfast_included && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Coffee className="w-3.5 h-3.5" />
                    Frühstück inklusive
                  </span>
                )}
                {h.booking_ref && (
                  <span className="text-muted-foreground">Buchung {h.booking_ref}</span>
                )}
              </div>
              {h.zimmer.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/60">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">
                    Belegung · {h.naechte_gesamt} Nächte · {euro(h.kosten_cents)}
                  </div>
                  <div className="grid gap-1 sm:grid-cols-2 text-sm">
                    {h.zimmer.map((z: any) => (
                      <div key={z.id} className="flex gap-2">
                        <span className="text-muted-foreground w-16 shrink-0">{z.room_label || '—'}</span>
                        <span className="flex-1 truncate">{z.person_name}</span>
                        <span className="text-xs text-muted-foreground">{z.nights} N.</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}

      {bearbeite && (
        <UnterkunftDialog
          pid={pid}
          haus={bearbeite}
          schliessen={() => setBearbeite(null)}
          gespeichert={() => {
            qc.invalidateQueries({ queryKey: ['unterkuenfte', pid] })
            toast({ title: 'Gespeichert' })
          }}
        />
      )}
    </div>
  )
}

function UnterkunftDialog({ pid, haus, schliessen, gespeichert }: {
  pid: number; haus: any; schliessen: () => void; gespeichert: () => void
}) {
  const { toast } = useToast()
  const [werte, setWerte] = useState({
    name: haus.name || '',
    address: haus.address || '',
    zip: haus.zip || '',
    city: haus.city || '',
    phone: haus.phone || '',
    check_in: haus.check_in ? String(haus.check_in).slice(0, 10) : '',
    check_out: haus.check_out ? String(haus.check_out).slice(0, 10) : '',
    preis: haus.price_per_night_cents ? alsText(haus.price_per_night_cents) : '',
    booking_ref: haus.booking_ref || '',
    breakfast_included: haus.breakfast_included === true,
    notes: haus.notes || '',
  })

  const speichern = useMutation({
    mutationFn: () => {
      const daten = {
        ...werte,
        price_per_night_cents: alsCents(werte.preis),
        check_in: werte.check_in || null,
        check_out: werte.check_out || null,
      }
      return haus.neu
        ? api.unterkuenfte.anlegen(pid, daten)
        : api.unterkuenfte.speichern(pid, haus.id, daten)
    },
    onSuccess: () => { gespeichert(); schliessen() },
    onError: (f: any) => toast({ title: 'Nicht gespeichert', description: f.message, variant: 'destructive' }),
  })

  const feld = (schluessel: keyof typeof werte) => ({
    value: werte[schluessel] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setWerte({ ...werte, [schluessel]: e.target.value }),
  })

  return (
    <Dialog open onOpenChange={(o) => { if (!o) schliessen() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{haus.neu ? 'Neue Unterkunft' : haus.name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="uk-name">Name</Label>
            <Input id="uk-name" {...feld('name')} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="uk-adresse">Adresse</Label>
            <Input id="uk-adresse" {...feld('address')} />
          </div>
          <div>
            <Label htmlFor="uk-plz">PLZ</Label>
            <Input id="uk-plz" {...feld('zip')} />
          </div>
          <div>
            <Label htmlFor="uk-ort">Ort</Label>
            <Input id="uk-ort" {...feld('city')} />
          </div>
          <div>
            <Label htmlFor="uk-telefon">Telefon</Label>
            <Input id="uk-telefon" {...feld('phone')} />
          </div>
          <div>
            <Label htmlFor="uk-buchung">Buchungsnummer</Label>
            <Input id="uk-buchung" {...feld('booking_ref')} />
          </div>
          <div>
            <Label htmlFor="uk-an">Anreise</Label>
            <Input id="uk-an" type="date" {...feld('check_in')} />
          </div>
          <div>
            <Label htmlFor="uk-ab">Abreise</Label>
            <Input id="uk-ab" type="date" {...feld('check_out')} />
          </div>
          <div>
            <Label htmlFor="uk-preis">Preis je Nacht</Label>
            <Input id="uk-preis" {...feld('preis')} inputMode="decimal" />
          </div>
          <div className="flex items-end pb-2">
            <div className="flex items-center gap-2">
              <input
                id="uk-fruehstueck"
                type="checkbox"
                checked={werte.breakfast_included}
                onChange={(e) => setWerte({ ...werte, breakfast_included: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="uk-fruehstueck" className="font-normal">Frühstück inklusive</Label>
            </div>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="uk-notizen">Notizen</Label>
            <Textarea id="uk-notizen" rows={2} {...feld('notes')} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Frühstück inklusive wird bei neuen Reisen zu dieser Unterkunft gleich als Kürzung
          eingetragen.
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={schliessen}>Abbrechen</Button>
          <Button onClick={() => speichern.mutate()} disabled={!werte.name.trim() || speichern.isPending}>
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
