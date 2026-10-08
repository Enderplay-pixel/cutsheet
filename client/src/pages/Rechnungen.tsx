import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  FileText, Users, BarChart3, Plus, Trash2, PenLine, Download,
  CheckCircle2, AlertTriangle, Ban, ArrowLeft, Euro as EuroIcon,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

const STATUS: Record<string, { label: string; klasse: string }> = {
  entwurf:    { label: 'Entwurf',    klasse: 'bg-muted text-muted-foreground' },
  versendet:  { label: 'Versendet',  klasse: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  bezahlt:    { label: 'Bezahlt',    klasse: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  storniert:  { label: 'Storniert',  klasse: 'bg-destructive/15 text-destructive' },
}

const euro = (cents: number) =>
  (Number(cents || 0) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })

const datum = (wert: string | null) =>
  wert ? new Date(String(wert).slice(0, 10)).toLocaleDateString('de-DE') : ''

const heute = () => new Date().toISOString().slice(0, 10)

export function Component() {
  const { companyId, invoiceId } = useParams()
  const firmaId = Number(companyId)
  if (invoiceId) return <RechnungBearbeiten firmaId={firmaId} id={Number(invoiceId)} />
  return <Uebersicht firmaId={firmaId} />
}

function Uebersicht({ firmaId }: { firmaId: number }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [filter, setFilter] = useState('')

  const { data: firma } = useQuery({ queryKey: ['firma', firmaId], queryFn: () => api.firmen.lesen(firmaId) })
  const { data: daten } = useQuery({
    queryKey: ['rechnungen', firmaId, filter],
    queryFn: () => api.rechnungen.liste(firmaId, filter || undefined),
  })
  const { data: kunden } = useQuery({ queryKey: ['kunden', firmaId], queryFn: () => api.rechnungen.kunden(firmaId) })
  const { data: projekte } = useQuery({ queryKey: ['projects'], queryFn: () => api.projects.list() })

  const anlegen = useMutation({
    mutationFn: () => api.rechnungen.anlegen(firmaId, { issue_date: heute() }),
    onSuccess: (ergebnis: any) => {
      qc.invalidateQueries({ queryKey: ['rechnungen', firmaId] })
      toast({ title: 'Entwurf angelegt' })
      window.location.href = `/firma/${firmaId}/rechnungen/${ergebnis.id}`
    },
    onError: (fehler: any) => toast({ title: 'Nicht angelegt', description: fehler.message, variant: 'destructive' }),
  })

  const offen = daten?.offene_posten

  return (
    <div className="px-5 py-6 sm:p-6 max-w-6xl mx-auto space-y-4">
      <PageHeader
        title="Rechnungen"
        subtitle={firma?.name || 'Rechnungsausgang und Auftraggeber'}
      />

      <div className="flex items-center gap-2">
        <Link to={`/firma/${firmaId}`}>
          <Button variant="ghost" size="sm"><ArrowLeft className="w-3.5 h-3.5 mr-1" />Zur Firma</Button>
        </Link>
      </div>

      {offen && offen.anzahl > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Offene Posten</p>
              <p className="text-2xl font-display tabular-nums mt-1">{euro(offen.summe_cents)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {offen.anzahl} {offen.anzahl === 1 ? 'Rechnung' : 'Rechnungen'}
              </p>
            </CardContent>
          </Card>
          <Card className={offen.ueberfaellig_anzahl > 0 ? 'border-destructive/40' : ''}>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Davon überfällig</p>
              <p className={`text-2xl font-display tabular-nums mt-1 ${offen.ueberfaellig_anzahl > 0 ? 'text-destructive' : ''}`}>
                {euro(offen.ueberfaellig_cents)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {offen.ueberfaellig_anzahl} {offen.ueberfaellig_anzahl === 1 ? 'Rechnung' : 'Rechnungen'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="rechnungen">
        <TabsList>
          <TabsTrigger value="rechnungen"><FileText className="w-3.5 h-3.5 mr-1.5" />Rechnungen</TabsTrigger>
          <TabsTrigger value="kunden"><Users className="w-3.5 h-3.5 mr-1.5" />Auftraggeber</TabsTrigger>
          <TabsTrigger value="auswertung"><BarChart3 className="w-3.5 h-3.5 mr-1.5" />Auswertung</TabsTrigger>
        </TabsList>

        <TabsContent value="rechnungen" className="mt-4">
          <Card>
            <CardHeader className="pb-2 pt-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">Rechnungsausgang</CardTitle>
              <div className="flex items-center gap-2">
                <Select value={filter || 'alle'} onValueChange={v => setFilter(v === 'alle' ? '' : v)}>
                  <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alle">Alle</SelectItem>
                    {Object.entries(STATUS).map(([k, s]) => (
                      <SelectItem key={k} value={k}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" className="h-7 text-xs" onClick={() => anlegen.mutate()} disabled={anlegen.isPending}>
                  <Plus className="w-3.5 h-3.5 mr-1" />Neue Rechnung
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-0.5">
              {(daten?.rechnungen || []).map((r: any) => (
                <Link key={r.id} to={`/firma/${firmaId}/rechnungen/${r.id}`}
                  className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-muted/50 border-b border-border/60 last:border-0">
                  <span className={`px-2 py-0.5 rounded text-xs shrink-0 ${STATUS[r.status]?.klasse || ''}`}>
                    {STATUS[r.status]?.label || r.status}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {r.number || 'ohne Nummer'}
                      {r.kunde_name ? ` · ${r.kunde_name}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {datum(r.issue_date)}
                      {r.projekt_titel ? ` · ${r.projekt_titel}` : ''}
                      {r.due_date ? ` · fällig ${datum(r.due_date)}` : ''}
                    </p>
                  </div>
                  {r.ueberfaellig && (
                    <Badge variant="destructive" className="text-xs font-normal shrink-0">
                      {r.tage_ueberfaellig} Tage über
                    </Badge>
                  )}
                  <span className="text-sm tabular-nums shrink-0">{euro(r.gross_cents)}</span>
                </Link>
              ))}
              {(daten?.rechnungen || []).length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Noch keine Rechnung. Eine neue beginnt als Entwurf und bekommt ihre Nummer erst
                  beim Festschreiben - so bleibt die Nummernfolge lückenlos.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kunden" className="mt-4">
          <Auftraggeber firmaId={firmaId} kunden={kunden || []} />
        </TabsContent>

        <TabsContent value="auswertung" className="mt-4">
          <Auswertung firmaId={firmaId} />
        </TabsContent>
      </Tabs>

      {(projekte || []).length === 0 && null}
    </div>
  )
}

function Auftraggeber({ firmaId, kunden }: { firmaId: number; kunden: any[] }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [entwurf, setEntwurf] = useState<any | null>(null)

  const speichern = useMutation({
    mutationFn: () =>
      entwurf?.id
        ? api.rechnungen.kundeSpeichern(firmaId, entwurf.id, entwurf)
        : api.rechnungen.kundeAnlegen(firmaId, entwurf),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kunden', firmaId] })
      setEntwurf(null)
      toast({ title: 'Auftraggeber gespeichert' })
    },
    onError: (fehler: any) => toast({ title: 'Nicht gespeichert', description: fehler.message, variant: 'destructive' }),
  })

  const archivieren = useMutation({
    mutationFn: (id: number) => api.rechnungen.kundeArchivieren(firmaId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kunden', firmaId] })
      toast({ title: 'Archiviert' })
    },
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2 pt-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Auftraggeber</CardTitle>
          <Button variant="outline" size="sm" className="h-7 text-xs"
            onClick={() => setEntwurf({ name: '', contact_name: '', address: '', zip: '', city: '', vat_id: '', email: '' })}>
            <Plus className="w-3.5 h-3.5 mr-1" />Neu
          </Button>
        </CardHeader>
        <CardContent className="space-y-1">
          {kunden.map(kunde => (
            <div key={kunde.id} className="flex items-center gap-2 py-1.5 border-b border-border/60 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{kunde.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[kunde.contact_name, [kunde.zip, kunde.city].filter(Boolean).join(' '), kunde.vat_id].filter(Boolean).join(' · ')}
                </p>
              </div>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEntwurf({ ...kunde })}>
                <PenLine className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => archivieren.mutate(kunde.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          {kunden.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">
              Noch kein Auftraggeber. Ohne Auftraggeber lässt sich keine Rechnung festschreiben.
            </p>
          )}
        </CardContent>
      </Card>

      {entwurf && (
        <Card>
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm">{entwurf.id ? 'Auftraggeber bearbeiten' : 'Neuer Auftraggeber'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              ['name', 'Name'], ['contact_name', 'Ansprechperson'], ['address', 'Straße'],
              ['zip', 'PLZ'], ['city', 'Ort'], ['vat_id', 'Umsatzsteuer-ID'], ['email', 'E-Mail'],
            ].map(([feld, label]) => (
              <div key={feld}>
                <Label className="text-xs" htmlFor={`k-${feld}`}>{label}</Label>
                <Input id={`k-${feld}`} value={entwurf[feld] || ''} className="mt-1 h-8 text-sm"
                  onChange={e => setEntwurf({ ...entwurf, [feld]: e.target.value })} />
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={() => speichern.mutate()} disabled={!entwurf.name?.trim()}>Speichern</Button>
              <Button variant="ghost" size="sm" onClick={() => setEntwurf(null)}>Abbrechen</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Auswertung({ firmaId }: { firmaId: number }) {
  const jahr = new Date().getFullYear()
  const [von, setVon] = useState(`${jahr}-01-01`)
  const [bis, setBis] = useState(heute())

  const { data } = useQuery({
    queryKey: ['ust', firmaId, von, bis],
    queryFn: () => api.rechnungen.umsatzsteuer(firmaId, von, bis),
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">Zeitraum</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs" htmlFor="a-von">Von</Label>
              <Input id="a-von" type="date" value={von} onChange={e => setVon(e.target.value)} className="mt-1 h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs" htmlFor="a-bis">Bis</Label>
              <Input id="a-bis" type="date" value={bis} onChange={e => setBis(e.target.value)} className="mt-1 h-8 text-sm" />
            </div>
          </div>
          <a href={api.rechnungen.exportUrl(firmaId, von, bis)} download>
            <Button variant="outline" size="sm" className="w-full">
              <Download className="w-4 h-4 mr-1.5" />Für die Buchhaltung ausgeben
            </Button>
          </a>
          <p className="text-xs text-muted-foreground">
            Semikolon getrennt, Beträge mit Komma - so liest es jedes deutsche Buchhaltungsprogramm.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">Umsatzsteuer</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data ? (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Rechnungen</span>
                <span className="tabular-nums">{data.anzahl}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Netto</span>
                <span className="tabular-nums">{euro(data.netto_cents)}</span>
              </div>
              {(data.nach_satz || []).map((zeile: any) => (
                <div key={zeile.satz} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {zeile.satz === 0 ? 'ohne Umsatzsteuer' : `Umsatzsteuer ${zeile.satz} %`}
                    {zeile.satz > 0 && ` auf ${euro(zeile.netto)}`}
                  </span>
                  <span className="tabular-nums">{euro(zeile.steuer)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-medium pt-2 border-t border-border">
                <span>Brutto</span>
                <span className="tabular-nums">{euro(data.brutto_cents)}</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-4">Wird geladen …</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function RechnungBearbeiten({ firmaId, id }: { firmaId: number; id: number }) {
  const qc = useQueryClient()
  const { toast } = useToast()

  const { data: rechnung } = useQuery({
    queryKey: ['rechnung', firmaId, id],
    queryFn: () => api.rechnungen.lesen(firmaId, id),
  })
  const { data: kunden } = useQuery({ queryKey: ['kunden', firmaId], queryFn: () => api.rechnungen.kunden(firmaId) })
  const { data: projekte } = useQuery({ queryKey: ['projects'], queryFn: () => api.projects.list() })

  const [kopf, setKopf] = useState<any>(null)
  const [positionen, setPositionen] = useState<any[] | null>(null)

  const werte = kopf ?? rechnung ?? {}
  const zeilen = positionen ?? rechnung?.positionen ?? []
  const istEntwurf = rechnung?.status === 'entwurf'
  const firmenProjekte = (projekte || []).filter((p: any) => p.company_id === firmaId)

  const summe = useMemo(
    () => zeilen.reduce((s: number, z: any) => s + Math.round((Number(z.quantity_milli || 0) * Number(z.unit_price_cents || 0)) / 1000), 0),
    [zeilen]
  )

  const speichern = useMutation({
    mutationFn: async () => {
      await api.rechnungen.speichern(firmaId, id, werte)
      await api.rechnungen.positionen(firmaId, id, zeilen)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rechnung', firmaId, id] })
      qc.invalidateQueries({ queryKey: ['rechnungen', firmaId] })
      setKopf(null)
      setPositionen(null)
      toast({ title: 'Gespeichert' })
    },
    onError: (fehler: any) => toast({ title: 'Nicht gespeichert', description: fehler.message, variant: 'destructive' }),
  })

  const festschreiben = useMutation({
    mutationFn: async () => {
      await api.rechnungen.speichern(firmaId, id, werte)
      await api.rechnungen.positionen(firmaId, id, zeilen)
      return api.rechnungen.festschreiben(firmaId, id)
    },
    onSuccess: (ergebnis: any) => {
      qc.invalidateQueries({ queryKey: ['rechnung', firmaId, id] })
      qc.invalidateQueries({ queryKey: ['rechnungen', firmaId] })
      toast({
        title: `Rechnung ${ergebnis.number}`,
        description: 'Festgeschrieben. Ab jetzt unveränderlich - Änderungen gehen nur noch über eine Stornierung.',
      })
    },
    onError: (fehler: any) => toast({ title: 'Nicht festgeschrieben', description: fehler.message, variant: 'destructive' }),
  })

  const zahlung = useMutation({
    mutationFn: () => api.rechnungen.zahlung(firmaId, id, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rechnung', firmaId, id] })
      qc.invalidateQueries({ queryKey: ['rechnungen', firmaId] })
      toast({ title: 'Zahlung erfasst' })
    },
  })

  const stornieren = useMutation({
    mutationFn: () => api.rechnungen.stornieren(firmaId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rechnung', firmaId, id] })
      toast({ title: 'Storniert', description: 'Die Nummer bleibt vergeben - eine Lücke wäre ein Fehler.' })
    },
    onError: (fehler: any) => toast({ title: 'Nicht storniert', description: fehler.message, variant: 'destructive' }),
  })

  const setzeZeile = (index: number, feld: string, wert: any) => {
    const naechste = [...zeilen]
    naechste[index] = { ...naechste[index], [feld]: wert }
    setPositionen(naechste)
  }

  if (!rechnung) {
    return <div className="px-5 py-6 sm:p-6 max-w-5xl mx-auto"><p className="text-sm text-muted-foreground">Wird geladen …</p></div>
  }

  return (
    <div className="px-5 py-6 sm:p-6 max-w-5xl mx-auto space-y-4">
      <PageHeader
        title={rechnung.number || 'Rechnungsentwurf'}
        subtitle={rechnung.kunde?.name || 'Noch kein Auftraggeber gewählt'}
      />

      <div className="flex items-center gap-2 flex-wrap">
        <Link to={`/firma/${firmaId}/rechnungen`}>
          <Button variant="ghost" size="sm"><ArrowLeft className="w-3.5 h-3.5 mr-1" />Übersicht</Button>
        </Link>
        <span className={`px-2 py-0.5 rounded text-xs ${STATUS[rechnung.status]?.klasse || ''}`}>
          {STATUS[rechnung.status]?.label || rechnung.status}
        </span>
        {rechnung.ueberfaellig && (
          <Badge variant="destructive" className="text-xs font-normal">
            <AlertTriangle className="w-3 h-3 mr-1" />{rechnung.tage_ueberfaellig} Tage überfällig
          </Badge>
        )}
        <div className="flex-1" />
        <a href={api.rechnungen.pdfUrl(firmaId, id)} target="_blank" rel="noreferrer">
          <Button variant="outline" size="sm"><FileText className="w-3.5 h-3.5 mr-1" />PDF</Button>
        </a>
        {istEntwurf && (
          <>
            <Button variant="outline" size="sm" onClick={() => speichern.mutate()} disabled={speichern.isPending}>
              Speichern
            </Button>
            <Button size="sm" onClick={() => festschreiben.mutate()} disabled={festschreiben.isPending}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Festschreiben
            </Button>
          </>
        )}
        {rechnung.status === 'versendet' && (
          <>
            <Button variant="outline" size="sm" onClick={() => zahlung.mutate()}>
              <EuroIcon className="w-3.5 h-3.5 mr-1" />Als bezahlt erfassen
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => stornieren.mutate()}>
              <Ban className="w-3.5 h-3.5 mr-1" />Stornieren
            </Button>
          </>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">Angaben</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Auftraggeber</Label>
              <Select value={werte.client_id ? String(werte.client_id) : 'keiner'}
                onValueChange={v => setKopf({ ...werte, client_id: v === 'keiner' ? null : Number(v) })}
                disabled={!istEntwurf}>
                <SelectTrigger className="h-8 text-sm mt-1"><SelectValue placeholder="Wählen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="keiner">Keiner</SelectItem>
                  {(kunden || []).map((k: any) => <SelectItem key={k.id} value={String(k.id)}>{k.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Projekt</Label>
              <Select value={werte.project_id ? String(werte.project_id) : 'keines'}
                onValueChange={v => setKopf({ ...werte, project_id: v === 'keines' ? null : Number(v) })}
                disabled={!istEntwurf}>
                <SelectTrigger className="h-8 text-sm mt-1"><SelectValue placeholder="Ohne Projekt" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="keines">Ohne Projekt</SelectItem>
                  {firmenProjekte.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs" htmlFor="r-datum">Rechnungsdatum</Label>
              <Input id="r-datum" type="date" className="mt-1 h-8 text-sm" disabled={!istEntwurf}
                value={String(werte.issue_date || '').slice(0, 10)}
                onChange={e => setKopf({ ...werte, issue_date: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs" htmlFor="r-faellig">Fällig am</Label>
              <Input id="r-faellig" type="date" className="mt-1 h-8 text-sm" disabled={!istEntwurf}
                value={String(werte.due_date || '').slice(0, 10)}
                onChange={e => setKopf({ ...werte, due_date: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs" htmlFor="r-von">Leistung von</Label>
              <Input id="r-von" type="date" className="mt-1 h-8 text-sm" disabled={!istEntwurf}
                value={String(werte.service_from || '').slice(0, 10)}
                onChange={e => setKopf({ ...werte, service_from: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs" htmlFor="r-bis">Leistung bis</Label>
              <Input id="r-bis" type="date" className="mt-1 h-8 text-sm" disabled={!istEntwurf}
                value={String(werte.service_to || '').slice(0, 10)}
                onChange={e => setKopf({ ...werte, service_to: e.target.value })} />
            </div>
          </div>
          <div>
            <Label className="text-xs" htmlFor="r-intro">Einleitung</Label>
            <Textarea id="r-intro" rows={2} className="mt-1 text-sm resize-none" disabled={!istEntwurf}
              value={werte.intro || ''} onChange={e => setKopf({ ...werte, intro: e.target.value })}
              placeholder="für die Produktion … stellen wir Ihnen in Rechnung:" />
          </div>
          <div>
            <Label className="text-xs" htmlFor="r-outro">Schlusstext</Label>
            <Textarea id="r-outro" rows={2} className="mt-1 text-sm resize-none" disabled={!istEntwurf}
              value={werte.outro || ''} onChange={e => setKopf({ ...werte, outro: e.target.value })}
              placeholder="Vielen Dank für die Zusammenarbeit." />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 pt-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Positionen</CardTitle>
          {istEntwurf && (
            <Button variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => setPositionen([...zeilen, { description: '', quantity_milli: 1000, unit: 'Tag', unit_price_cents: 0, tax_percent: 19 }])}>
              <Plus className="w-3.5 h-3.5 mr-1" />Zeile
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {zeilen.map((zeile: any, i: number) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-12 sm:col-span-5">
                {i === 0 && <Label className="text-xs">Leistung</Label>}
                <Input className="mt-1 h-8 text-sm" disabled={!istEntwurf} value={zeile.description || ''}
                  onChange={e => setzeZeile(i, 'description', e.target.value)} />
              </div>
              <div className="col-span-3 sm:col-span-2">
                {i === 0 && <Label className="text-xs">Menge</Label>}
                <Input className="mt-1 h-8 text-sm tabular-nums" type="number" step="0.5" min="0" disabled={!istEntwurf}
                  value={Number(zeile.quantity_milli || 0) / 1000}
                  onChange={e => setzeZeile(i, 'quantity_milli', Math.round(Number(e.target.value || 0) * 1000))} />
              </div>
              <div className="col-span-3 sm:col-span-1">
                {i === 0 && <Label className="text-xs">Einheit</Label>}
                <Input className="mt-1 h-8 text-sm" disabled={!istEntwurf} value={zeile.unit || ''}
                  onChange={e => setzeZeile(i, 'unit', e.target.value)} />
              </div>
              <div className="col-span-3 sm:col-span-2">
                {i === 0 && <Label className="text-xs">Einzelpreis</Label>}
                <Input className="mt-1 h-8 text-sm tabular-nums" type="number" step="0.01" min="0" disabled={!istEntwurf}
                  value={Number(zeile.unit_price_cents || 0) / 100}
                  onChange={e => setzeZeile(i, 'unit_price_cents', Math.round(Number(e.target.value || 0) * 100))} />
              </div>
              <div className="col-span-2 sm:col-span-1">
                {i === 0 && <Label className="text-xs">USt.</Label>}
                <Input className="mt-1 h-8 text-sm tabular-nums" type="number" min="0" max="25" disabled={!istEntwurf}
                  value={zeile.tax_percent ?? 19}
                  onChange={e => setzeZeile(i, 'tax_percent', Number(e.target.value || 0))} />
              </div>
              <div className="col-span-1 flex justify-end">
                {istEntwurf && (
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-destructive"
                    onClick={() => setPositionen(zeilen.filter((_: any, j: number) => j !== i))}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {zeilen.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">
              Noch keine Position. Ohne Position lässt sich die Rechnung nicht festschreiben.
            </p>
          )}

          <div className="flex justify-end gap-8 pt-3 border-t border-border text-sm">
            <div className="text-right space-y-1">
              <p className="text-muted-foreground">Netto</p>
              <p className="text-muted-foreground">Umsatzsteuer</p>
              <p className="font-medium">Gesamt</p>
            </div>
            <div className="text-right space-y-1 tabular-nums">
              <p>{euro(positionen ? summe : rechnung.net_cents)}</p>
              <p>{euro(rechnung.tax_cents)}</p>
              <p className="font-medium">{euro(rechnung.gross_cents)}</p>
            </div>
          </div>
          {positionen && (
            <p className="text-xs text-muted-foreground text-right">
              Steuer und Gesamtbetrag rechnet der Server beim Speichern.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
