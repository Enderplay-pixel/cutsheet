import { useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Building2, Users, BookUser, Euro, Plus, Trash2, PenLine,
  CalendarDays, ArrowRight, Search, Download, Mail,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

const FIRMENROLLEN: Record<string, string> = {
  inhaber: 'Inhaberin oder Inhaber',
  produktion: 'Produktion',
  mitarbeiter: 'Mitarbeit',
}

const euro = (cents: number) =>
  (Number(cents || 0) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

/** Übersicht aller Firmen, zu denen das Konto gehört. */
export function Component() {
  const { companyId } = useParams()
  if (companyId) return <FirmenSeite id={Number(companyId)} />
  return <FirmenListe />
}

function FirmenListe() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [name, setName] = useState('')

  const { data: firmen, isLoading } = useQuery({ queryKey: ['firmen'], queryFn: () => api.firmen.liste() })

  const anlegen = useMutation({
    mutationFn: () => api.firmen.anlegen(name.trim()),
    onSuccess: (ergebnis: any) => {
      qc.invalidateQueries({ queryKey: ['firmen'] })
      setName('')
      toast({ title: 'Firma angelegt' })
      navigate(`/firma/${ergebnis.id}`)
    },
    onError: (fehler: any) => toast({ title: 'Nicht angelegt', description: fehler.message, variant: 'destructive' }),
  })

  return (
    <div className="px-5 py-6 sm:p-6 max-w-4xl mx-auto space-y-4">
      <PageHeader
        title="Firma"
        subtitle="Adressbuch, Gagensätze und Projekte an einem Ort"
      />

      <Card>
        <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">Deine Firmen</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {isLoading && <p className="text-sm text-muted-foreground py-2">Wird geladen …</p>}
          {(firmen || []).map((firma: any) => (
            <Link
              key={firma.id}
              to={`/firma/${firma.id}`}
              className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg hover:bg-muted/50 border-b border-border/60 last:border-0"
            >
              <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{firma.name}</p>
                <p className="text-xs text-muted-foreground">
                  {firma.projekte} {Number(firma.projekte) === 1 ? 'Projekt' : 'Projekte'} · {firma.kontakte} im Adressbuch
                </p>
              </div>
              <Badge variant="secondary" className="text-xs font-normal">
                {FIRMENROLLEN[firma.meine_rolle] || firma.meine_rolle}
              </Badge>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </Link>
          ))}
          {!isLoading && (firmen || []).length === 0 && (
            <p className="text-sm text-muted-foreground py-4">
              Noch keine Firma. Eine Firma sammelt, was über ein einzelnes Projekt hinaus gilt:
              die Leute, mit denen du immer wieder drehst, und was sie kosten.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">Neue Firma</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nordlicht Film"
            className="h-8 text-sm"
            onKeyDown={e => { if (e.key === 'Enter' && name.trim()) anlegen.mutate() }}
          />
          <Button size="sm" onClick={() => anlegen.mutate()} disabled={!name.trim() || anlegen.isPending}>
            <Plus className="w-4 h-4 mr-1" />Anlegen
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function FirmenSeite({ id }: { id: number }) {
  const qc = useQueryClient()
  const { toast } = useToast()

  const { data: firma } = useQuery({ queryKey: ['firma', id], queryFn: () => api.firmen.lesen(id) })
  const { data: mitglieder } = useQuery({ queryKey: ['firma-mitglieder', id], queryFn: () => api.firmen.mitglieder(id) })
  const { data: saetze } = useQuery({ queryKey: ['firma-saetze', id], queryFn: () => api.firmen.saetze(id) })
  const { data: projekte } = useQuery({ queryKey: ['projects'], queryFn: () => api.projects.list() })

  const darfVerwalten = firma?.meine_rolle === 'inhaber' || firma?.meine_rolle === 'produktion'
  const eigeneProjekte = (projekte || []).filter((p: any) => p.company_id === id)
  const freieProjekte = (projekte || []).filter((p: any) => !p.company_id)

  const [profil, setProfil] = useState<any>(null)
  const werte = profil ?? firma ?? {}

  const speichern = useMutation({
    mutationFn: () => api.firmen.speichern(id, werte),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['firma', id] })
      qc.invalidateQueries({ queryKey: ['firmen'] })
      toast({ title: 'Firma gespeichert' })
    },
    onError: (fehler: any) => toast({ title: 'Nicht gespeichert', description: fehler.message, variant: 'destructive' }),
  })

  const setze = (feld: string, wert: string) => setProfil({ ...werte, [feld]: wert })

  return (
    <div className="px-5 py-6 sm:p-6 max-w-5xl mx-auto space-y-4">
      <PageHeader
        title={firma?.name || 'Firma'}
        subtitle={`${eigeneProjekte.length} ${eigeneProjekte.length === 1 ? 'Projekt' : 'Projekte'} · ${FIRMENROLLEN[firma?.meine_rolle] || ''}`}
      />

      <Tabs defaultValue="adressbuch">
        <TabsList>
          <TabsTrigger value="adressbuch"><BookUser className="w-3.5 h-3.5 mr-1.5" />Adressbuch</TabsTrigger>
          <TabsTrigger value="projekte"><Building2 className="w-3.5 h-3.5 mr-1.5" />Projekte</TabsTrigger>
          <TabsTrigger value="saetze"><Euro className="w-3.5 h-3.5 mr-1.5" />Gagensätze</TabsTrigger>
          <TabsTrigger value="vorlagen"><Mail className="w-3.5 h-3.5 mr-1.5" />Mailvorlagen</TabsTrigger>
          <TabsTrigger value="mitglieder"><Users className="w-3.5 h-3.5 mr-1.5" />Mitglieder</TabsTrigger>
          <TabsTrigger value="profil"><PenLine className="w-3.5 h-3.5 mr-1.5" />Profil</TabsTrigger>
        </TabsList>

        <TabsContent value="adressbuch" className="mt-4">
          <Adressbuch firmaId={id} projekte={eigeneProjekte} />
        </TabsContent>

        <TabsContent value="projekte" className="mt-4">
          <Projekte firmaId={id} eigene={eigeneProjekte} freie={freieProjekte} darfVerwalten={darfVerwalten} />
        </TabsContent>

        <TabsContent value="saetze" className="mt-4">
          <Gagensaetze firmaId={id} saetze={saetze || []} darfVerwalten={darfVerwalten} />
        </TabsContent>

        <TabsContent value="vorlagen" className="mt-4">
          <Firmenvorlagen firmaId={id} darfVerwalten={darfVerwalten} />
        </TabsContent>

        <TabsContent value="mitglieder" className="mt-4">
          <Mitglieder firmaId={id} mitglieder={mitglieder || []} istInhaber={firma?.meine_rolle === 'inhaber'} />
        </TabsContent>

        <TabsContent value="profil" className="mt-4">
          <Card className="max-w-2xl">
            <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">Angaben der Firma</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Feld id="f-name" label="Name" wert={werte.name} setze={v => setze('name', v)} aus={!darfVerwalten} />
                <Feld id="f-firma" label="Rechtlicher Name" wert={werte.legal_name} setze={v => setze('legal_name', v)} aus={!darfVerwalten} />
                <Feld id="f-adresse" label="Straße" wert={werte.address} setze={v => setze('address', v)} aus={!darfVerwalten} />
                <Feld id="f-plz" label="PLZ" wert={werte.zip} setze={v => setze('zip', v)} aus={!darfVerwalten} />
                <Feld id="f-ort" label="Ort" wert={werte.city} setze={v => setze('city', v)} aus={!darfVerwalten} />
                <Feld id="f-land" label="Land" wert={werte.country} setze={v => setze('country', v)} aus={!darfVerwalten} />
                <Feld id="f-steuer" label="Steuernummer" wert={werte.tax_number} setze={v => setze('tax_number', v)} aus={!darfVerwalten} />
                <Feld id="f-ust" label="Umsatzsteuer-ID" wert={werte.vat_id} setze={v => setze('vat_id', v)} aus={!darfVerwalten} />
                <Feld id="f-tel" label="Telefon" wert={werte.phone} setze={v => setze('phone', v)} aus={!darfVerwalten} />
                <Feld id="f-mail" label="E-Mail" wert={werte.email} setze={v => setze('email', v)} aus={!darfVerwalten} />
                <Feld id="f-web" label="Website" wert={werte.website} setze={v => setze('website', v)} aus={!darfVerwalten} />
              </div>
              {darfVerwalten && (
                <Button size="sm" onClick={() => speichern.mutate()} disabled={speichern.isPending}>Speichern</Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Feld({ id, label, wert, setze, aus }: { id: string; label: string; wert: any; setze: (v: string) => void; aus?: boolean }) {
  return (
    <div>
      <Label className="text-xs" htmlFor={id}>{label}</Label>
      <Input id={id} value={wert || ''} onChange={e => setze(e.target.value)} className="mt-1 h-8 text-sm" disabled={aus} />
    </div>
  )
}

/** Das Adressbuch: einmal gepflegt, in jedes Projekt übernehmbar. */
function Adressbuch({ firmaId, projekte }: { firmaId: number; projekte: any[] }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [suche, setSuche] = useState('')
  const [gewaehlt, setGewaehlt] = useState<Set<number>>(new Set())
  const [zielProjekt, setZielProjekt] = useState('')
  const [entwurf, setEntwurf] = useState<any | null>(null)
  const [verfuegbarkeitVon, setVerfuegbarkeitVon] = useState<number | null>(null)

  const { data: kontakte } = useQuery({
    queryKey: ['firma-kontakte', firmaId, suche],
    queryFn: () => api.firmen.kontakte(firmaId, suche || undefined),
  })

  const { data: termine } = useQuery({
    queryKey: ['firma-verfuegbarkeit', firmaId, verfuegbarkeitVon],
    queryFn: () => api.firmen.verfuegbarkeit(firmaId, verfuegbarkeitVon!),
    enabled: verfuegbarkeitVon !== null,
  })

  const speichern = useMutation({
    mutationFn: () =>
      entwurf?.id
        ? api.firmen.kontaktSpeichern(firmaId, entwurf.id, entwurf)
        : api.firmen.kontaktAnlegen(firmaId, entwurf),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['firma-kontakte', firmaId] })
      setEntwurf(null)
      toast({ title: 'Eintrag gespeichert' })
    },
    onError: (fehler: any) => toast({ title: 'Nicht gespeichert', description: fehler.message, variant: 'destructive' }),
  })

  const archivieren = useMutation({
    mutationFn: (kontaktId: number) => api.firmen.kontaktArchivieren(firmaId, kontaktId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['firma-kontakte', firmaId] })
      toast({ title: 'Eintrag archiviert' })
    },
  })

  const uebernehmen = useMutation({
    mutationFn: () => api.firmen.insProjekt(firmaId, Number(zielProjekt), Array.from(gewaehlt)),
    onSuccess: (ergebnis: any) => {
      setGewaehlt(new Set())
      toast({
        title: `${ergebnis.stab + ergebnis.besetzung} übernommen`,
        description: ergebnis.uebersprungen > 0
          ? `${ergebnis.uebersprungen} waren schon im Projekt.`
          : 'Stab und Besetzung des Projekts sind aktualisiert.',
      })
    },
    onError: (fehler: any) => toast({ title: 'Nicht übernommen', description: fehler.message, variant: 'destructive' }),
  })

  const einsammeln = useMutation({
    mutationFn: () => api.firmen.ausProjekt(firmaId, Number(zielProjekt)),
    onSuccess: (ergebnis: any) => {
      qc.invalidateQueries({ queryKey: ['firma-kontakte', firmaId] })
      toast({
        title: `${ergebnis.uebernommen} neu im Adressbuch`,
        description: `${ergebnis.verknuepft} Einträge aus dem Projekt wurden verknüpft.`,
      })
    },
    onError: (fehler: any) => toast({ title: 'Nicht übernommen', description: fehler.message, variant: 'destructive' }),
  })

  const umschalten = (kontaktId: number) => {
    const naechste = new Set(gewaehlt)
    naechste.has(kontaktId) ? naechste.delete(kontaktId) : naechste.add(kontaktId)
    setGewaehlt(naechste)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-3">
        <Card>
          <CardHeader className="pb-2 pt-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">
              Adressbuch
              {gewaehlt.size > 0 && <Badge variant="secondary" className="ml-2 text-xs font-normal">{gewaehlt.size} gewählt</Badge>}
            </CardTitle>
            <Button variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => setEntwurf({ name: '', role: '', department: '', email: '', phone: '', day_rate_cents: 0, kind: 'crew' })}>
              <Plus className="w-3.5 h-3.5 mr-1" />Person
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input value={suche} onChange={e => setSuche(e.target.value)}
                placeholder="Name, Funktion, Abteilung, Stichwort" className="h-8 text-sm pl-8" />
            </div>

            <div className="space-y-0.5">
              {(kontakte || []).map((kontakt: any) => (
                <div key={kontakt.id} className="flex items-center gap-2.5 py-1.5 border-b border-border/60 last:border-0">
                  <Checkbox checked={gewaehlt.has(kontakt.id)} onCheckedChange={() => umschalten(kontakt.id)} className="h-3.5 w-3.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {kontakt.name}
                      {kontakt.kind === 'cast' && <Badge variant="secondary" className="ml-2 text-[10px] font-normal">Besetzung</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[kontakt.role, kontakt.department, kontakt.email].filter(Boolean).join(' · ')}
                      {kontakt.day_rate_cents > 0 && ` · ${euro(kontakt.day_rate_cents)}/Tag`}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 px-2"
                    onClick={() => setVerfuegbarkeitVon(kontakt.id)} title="Wann ist diese Person gebucht?">
                    <CalendarDays className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEntwurf({ ...kontakt })}>
                    <PenLine className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => archivieren.mutate(kontakt.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              {(kontakte || []).length === 0 && (
                <p className="text-sm text-muted-foreground py-4">
                  {suche ? 'Kein Treffer.' : 'Noch niemand im Adressbuch. Du kannst den Stab eines Projekts auf einmal übernehmen.'}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {verfuegbarkeitVon !== null && (
          <Card>
            <CardHeader className="pb-2 pt-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">Gebuchte Drehtage</CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setVerfuegbarkeitVon(null)}>Schließen</Button>
            </CardHeader>
            <CardContent>
              {(termine || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  In keinem Projekt dieser Firma auf einem Drehtag eingeteilt.
                </p>
              ) : (
                <div className="space-y-1">
                  {(termine || []).map((termin: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 text-sm py-1 border-b border-border/60 last:border-0">
                      <span className="tabular-nums text-muted-foreground w-24 shrink-0">
                        {termin.date ? new Date(termin.date).toLocaleDateString('de-DE') : ''}
                      </span>
                      <span className="truncate flex-1">{termin.title}</span>
                      <span className="text-xs text-muted-foreground">Drehtag {termin.day_number}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-3">
        {entwurf && (
          <Card>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm">{entwurf.id ? 'Eintrag bearbeiten' : 'Neue Person'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Feld id="k-name" label="Name" wert={entwurf.name} setze={v => setEntwurf({ ...entwurf, name: v })} />
              <Feld id="k-rolle" label="Funktion" wert={entwurf.role} setze={v => setEntwurf({ ...entwurf, role: v })} />
              <Feld id="k-abt" label="Abteilung" wert={entwurf.department} setze={v => setEntwurf({ ...entwurf, department: v })} />
              <Feld id="k-mail" label="E-Mail" wert={entwurf.email} setze={v => setEntwurf({ ...entwurf, email: v })} />
              <Feld id="k-tel" label="Telefon" wert={entwurf.phone} setze={v => setEntwurf({ ...entwurf, phone: v })} />
              <div>
                <Label className="text-xs" htmlFor="k-satz">Tagessatz in Euro</Label>
                <Input id="k-satz" type="number" min={0} className="mt-1 h-8 text-sm"
                  value={Math.round((entwurf.day_rate_cents || 0) / 100)}
                  onChange={e => setEntwurf({ ...entwurf, day_rate_cents: Math.round(Number(e.target.value || 0) * 100) })} />
              </div>
              <div>
                <Label className="text-xs">Art</Label>
                <Select value={entwurf.kind || 'crew'} onValueChange={v => setEntwurf({ ...entwurf, kind: v })}>
                  <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="crew">Stab</SelectItem>
                    <SelectItem value="cast">Besetzung</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs" htmlFor="k-notiz">Notiz</Label>
                <Textarea id="k-notiz" rows={3} className="mt-1 text-sm resize-none"
                  value={entwurf.notes || ''} onChange={e => setEntwurf({ ...entwurf, notes: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => speichern.mutate()} disabled={!entwurf.name?.trim()}>Speichern</Button>
                <Button variant="ghost" size="sm" onClick={() => setEntwurf(null)}>Abbrechen</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">Mit einem Projekt austauschen</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Projekt</Label>
              <Select value={zielProjekt} onValueChange={setZielProjekt}>
                <SelectTrigger className="h-8 text-sm mt-1"><SelectValue placeholder="Projekt wählen" /></SelectTrigger>
                <SelectContent>
                  {projekte.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
              {projekte.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Diese Firma hat noch kein Projekt.
                </p>
              )}
            </div>
            <Button size="sm" className="w-full" disabled={!zielProjekt || gewaehlt.size === 0 || uebernehmen.isPending}
              onClick={() => uebernehmen.mutate()}>
              <ArrowRight className="w-4 h-4 mr-1.5" />
              {gewaehlt.size} ins Projekt
            </Button>
            <Button variant="outline" size="sm" className="w-full" disabled={!zielProjekt || einsammeln.isPending}
              onClick={() => einsammeln.mutate()}>
              <Download className="w-4 h-4 mr-1.5" />
              Stab des Projekts übernehmen
            </Button>
            <p className="text-xs text-muted-foreground">
              Die Übernahme legt niemanden doppelt an: Wer schon im Projekt steht, bleibt unberührt.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Gagensaetze({ firmaId, saetze, darfVerwalten }: { firmaId: number; saetze: any[]; darfVerwalten: boolean }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [neu, setNeu] = useState({ role: '', department: '', euro: 0, note: '' })

  const anlegen = useMutation({
    mutationFn: () => api.firmen.satzAnlegen(firmaId, {
      role: neu.role, department: neu.department, day_rate_cents: Math.round(neu.euro * 100), note: neu.note,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['firma-saetze', firmaId] })
      setNeu({ role: '', department: '', euro: 0, note: '' })
      toast({ title: 'Satz gespeichert' })
    },
  })

  const loeschen = useMutation({
    mutationFn: (rateId: number) => api.firmen.satzLoeschen(firmaId, rateId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['firma-saetze', firmaId] }),
  })

  const summe = useMemo(() => saetze.reduce((s, z) => s + Number(z.day_rate_cents || 0), 0), [saetze])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">Gagensätze</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {saetze.map(satz => (
            <div key={satz.id} className="flex items-center gap-3 py-1.5 border-b border-border/60 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{satz.role}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[satz.department, satz.note].filter(Boolean).join(' · ')}
                </p>
              </div>
              <span className="text-sm tabular-nums">{euro(satz.day_rate_cents)}</span>
              {darfVerwalten && (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => loeschen.mutate(satz.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          ))}
          {saetze.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">
              Noch keine Sätze. Ein Satz je Funktion erspart das Nachschlagen bei jeder Kalkulation.
            </p>
          )}
          {saetze.length > 1 && (
            <p className="text-xs text-muted-foreground pt-2">
              Ein Drehtag mit allen {saetze.length} Funktionen: {euro(summe)}
            </p>
          )}
        </CardContent>
      </Card>

      {darfVerwalten && (
        <Card>
          <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">Neuer Satz</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Feld id="s-rolle" label="Funktion" wert={neu.role} setze={v => setNeu({ ...neu, role: v })} />
            <Feld id="s-abt" label="Abteilung" wert={neu.department} setze={v => setNeu({ ...neu, department: v })} />
            <div>
              <Label className="text-xs" htmlFor="s-satz">Tagessatz in Euro</Label>
              <Input id="s-satz" type="number" min={0} className="mt-1 h-8 text-sm"
                value={neu.euro} onChange={e => setNeu({ ...neu, euro: Number(e.target.value || 0) })} />
            </div>
            <Feld id="s-notiz" label="Notiz" wert={neu.note} setze={v => setNeu({ ...neu, note: v })} />
            <Button size="sm" onClick={() => anlegen.mutate()} disabled={!neu.role.trim()}>Anlegen</Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Mitglieder({ firmaId, mitglieder, istInhaber }: { firmaId: number; mitglieder: any[]; istInhaber: boolean }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [rolle, setRolle] = useState('mitarbeiter')

  const aufnehmen = useMutation({
    mutationFn: () => api.firmen.aufnehmen(firmaId, email.trim(), rolle),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['firma-mitglieder', firmaId] })
      setEmail('')
      toast({ title: 'Aufgenommen' })
    },
    onError: (fehler: any) => toast({ title: 'Nicht aufgenommen', description: fehler.message, variant: 'destructive' }),
  })

  const entfernen = useMutation({
    mutationFn: (memberId: number) => api.firmen.entfernen(firmaId, memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['firma-mitglieder', firmaId] })
      toast({ title: 'Entfernt' })
    },
    onError: (fehler: any) => toast({ title: 'Nicht entfernt', description: fehler.message, variant: 'destructive' }),
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">Mitglieder</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {mitglieder.map(person => (
            <div key={person.id} className="flex items-center gap-3 py-1.5 border-b border-border/60 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{person.name || person.email}</p>
                <p className="text-xs text-muted-foreground truncate">{person.email}</p>
              </div>
              <Badge variant="secondary" className="text-xs font-normal">{FIRMENROLLEN[person.role] || person.role}</Badge>
              {istInhaber && (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => entfernen.mutate(person.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {istInhaber && (
        <Card>
          <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">Person aufnehmen</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Feld id="m-mail" label="E-Mail des bestehenden Kontos" wert={email} setze={setEmail} />
            <div>
              <Label className="text-xs">Rolle in der Firma</Label>
              <Select value={rolle} onValueChange={setRolle}>
                <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FIRMENROLLEN).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={() => aufnehmen.mutate()} disabled={!email.trim()}>Aufnehmen</Button>
            <p className="text-xs text-muted-foreground">
              Die Zugehörigkeit zur Firma öffnet das Adressbuch und die Sätze - keine fremden
              Projekte. Projektzugriff wird weiterhin im Projekt vergeben.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}


/** Projekte der Firma - und die, die noch zu keiner gehören. */
function Projekte({ firmaId, eigene, freie, darfVerwalten }: {
  firmaId: number; eigene: any[]; freie: any[]; darfVerwalten: boolean
}) {
  const qc = useQueryClient()
  const { toast } = useToast()

  const zuordnen = useMutation({
    mutationFn: ({ projektId, firma }: { projektId: number; firma: number | null }) =>
      api.projects.firmaSetzen(projektId, firma),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['firmen'] })
      toast({ title: 'Zuordnung gespeichert' })
    },
    onError: (fehler: any) => toast({ title: 'Nicht gespeichert', description: fehler.message, variant: 'destructive' }),
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">Projekte dieser Firma</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {eigene.map((projekt: any) => (
            <div key={projekt.id} className="flex items-center gap-3 py-2 border-b border-border/60 last:border-0">
              <Link to={`/projects/${projekt.id}`} className="min-w-0 flex-1 hover:text-primary">
                <p className="text-sm font-medium truncate">{projekt.title}</p>
                <p className="text-xs text-muted-foreground">{projekt.status} · {projekt.format}</p>
              </Link>
              {darfVerwalten && (
                <Button variant="ghost" size="sm" className="h-7 text-xs"
                  onClick={() => zuordnen.mutate({ projektId: projekt.id, firma: null })}>
                  Lösen
                </Button>
              )}
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
          ))}
          {eigene.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">
              Noch kein Projekt zugeordnet.
            </p>
          )}
        </CardContent>
      </Card>

      {darfVerwalten && (
        <Card>
          <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">Projekte ohne Firma</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {freie.map((projekt: any) => (
              <div key={projekt.id} className="flex items-center gap-3 py-2 border-b border-border/60 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{projekt.title}</p>
                  <p className="text-xs text-muted-foreground">{projekt.status} · {projekt.format}</p>
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs"
                  onClick={() => zuordnen.mutate({ projektId: projekt.id, firma: firmaId })}>
                  Zur Firma
                </Button>
              </div>
            ))}
            {freie.length === 0 && (
              <p className="text-sm text-muted-foreground py-4">
                Alle deine Projekte gehören bereits zu einer Firma.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}


/**
 * Mailvorlagen der Firma. Sie werden in jedes neue Projekt der Firma kopiert -
 * was dort geändert wird, bleibt dort und wirkt nicht zurück.
 */
function Firmenvorlagen({ firmaId, darfVerwalten }: { firmaId: number; darfVerwalten: boolean }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [entwurf, setEntwurf] = useState<any | null>(null)

  const { data: vorlagen } = useQuery({
    queryKey: ['firma-vorlagen', firmaId],
    queryFn: () => api.firmen.vorlagen(firmaId),
  })

  const speichern = useMutation({
    mutationFn: () =>
      entwurf?.id
        ? api.firmen.vorlageSpeichern(firmaId, entwurf.id, entwurf)
        : api.firmen.vorlageAnlegen(firmaId, entwurf),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['firma-vorlagen', firmaId] })
      setEntwurf(null)
      toast({ title: 'Vorlage gespeichert' })
    },
    onError: (fehler: any) => toast({ title: 'Nicht gespeichert', description: fehler.message, variant: 'destructive' }),
  })

  const loeschen = useMutation({
    mutationFn: (vorlageId: number) => api.firmen.vorlageLoeschen(firmaId, vorlageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['firma-vorlagen', firmaId] }),
  })

  const standard = useMutation({
    mutationFn: () => api.firmen.standardvorlagen(firmaId),
    onSuccess: (ergebnis: any) => {
      qc.invalidateQueries({ queryKey: ['firma-vorlagen', firmaId] })
      toast({ title: `${ergebnis.angelegt} Vorlagen übernommen`, description: 'Jetzt anpassen, bis der Ton stimmt.' })
    },
    onError: (fehler: any) => toast({ title: 'Nicht übernommen', description: fehler.message, variant: 'destructive' }),
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2 pt-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Vorlagen der Firma</CardTitle>
          {darfVerwalten && (
            <Button variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => setEntwurf({ name: '', subject: '', body: '' })}>
              <Plus className="w-3.5 h-3.5 mr-1" />Neu
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-1">
          {(vorlagen || []).map((vorlage: any) => (
            <div key={vorlage.id} className="flex items-center gap-2 py-1.5 border-b border-border/60 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{vorlage.name}</p>
                <p className="text-xs text-muted-foreground truncate">{vorlage.subject}</p>
              </div>
              {darfVerwalten && (
                <>
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEntwurf({ ...vorlage })}>
                    <PenLine className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => loeschen.mutate(vorlage.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
            </div>
          ))}
          {(vorlagen || []).length === 0 && (
            <div className="py-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Noch keine Vorlagen der Firma. Neue Projekte bekommen dann die mitgelieferten
                Standardvorlagen.
              </p>
              {darfVerwalten && (
                <Button variant="outline" size="sm" onClick={() => standard.mutate()}>
                  Standardvorlagen übernehmen und anpassen
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {entwurf && (
        <Card>
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm">{entwurf.id ? 'Vorlage bearbeiten' : 'Neue Vorlage'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Feld id="fv-name" label="Name" wert={entwurf.name} setze={v => setEntwurf({ ...entwurf, name: v })} />
            <Feld id="fv-betreff" label="Betreff" wert={entwurf.subject} setze={v => setEntwurf({ ...entwurf, subject: v })} />
            <div>
              <Label className="text-xs" htmlFor="fv-text">Text</Label>
              <Textarea id="fv-text" rows={10} className="mt-1 text-sm resize-none"
                value={entwurf.body || ''} onChange={e => setEntwurf({ ...entwurf, body: e.target.value })} />
              <p className="text-xs text-muted-foreground mt-1">
                Platzhalter wie {'{{vorname}}'} oder {'{{call}}'} werden beim Versand je Person gefüllt.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => speichern.mutate()} disabled={!entwurf.name?.trim()}>Speichern</Button>
              <Button variant="ghost" size="sm" onClick={() => setEntwurf(null)}>Abbrechen</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
