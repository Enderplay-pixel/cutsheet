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
import {
  FileSignature, Send, FileText, Check, Clock, AlertTriangle, Baby,
  Plus, Trash2, Info, ShieldAlert,
} from 'lucide-react'

const datum = (wert: string | null | undefined) =>
  wert ? new Date(String(wert).slice(0, 10)).toLocaleDateString('de-DE') : '—'

const zeitpunkt = (wert: string | null | undefined) => {
  if (!wert) return '—'
  const d = new Date(wert)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('de-DE')
}

const STATUS: Record<string, { label: string; klasse: string }> = {
  entwurf:    { label: 'Entwurf',    klasse: 'bg-muted text-muted-foreground' },
  versendet:  { label: 'Versendet',  klasse: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  bestaetigt: { label: 'Bestätigt',  klasse: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  abgelehnt:  { label: 'Abgelehnt',  klasse: 'bg-destructive/15 text-destructive' },
}

const PERSONENART: Record<string, string> = { cast: 'Besetzung', crew: 'Stab', extra: 'Komparsen' }

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)

  return (
    <div className="px-5 py-6 sm:p-6 max-w-5xl mx-auto space-y-4">
      <PageHeader
        title="Verträge"
        subtitle="Das Papier, das vor dem ersten Drehtag da sein muss"
      />

      <Tabs defaultValue="personen">
        <TabsList>
          <TabsTrigger value="personen">
            <FileSignature className="w-3.5 h-3.5 mr-1.5" />
            Wer hat was
          </TabsTrigger>
          <TabsTrigger value="jugendschutz">
            <Baby className="w-3.5 h-3.5 mr-1.5" />
            Jugendschutz
          </TabsTrigger>
          <TabsTrigger value="vorlagen">
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            Vorlagen
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personen" className="mt-4"><Personen pid={pid} /></TabsContent>
        <TabsContent value="jugendschutz" className="mt-4"><Jugendschutz pid={pid} /></TabsContent>
        <TabsContent value="vorlagen" className="mt-4"><Vorlagen pid={pid} /></TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Wer hat was ─────────────────────────────────────────────────────────────

function Personen({ pid }: { pid: number }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const download = useDownload()
  const [neuFuer, setNeuFuer] = useState<any>(null)
  const [nurOffene, setNurOffene] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['vertraege', pid],
    queryFn: () => api.vertraege.uebersicht(pid),
  })

  const senden = useMutation({
    mutationFn: (id: number) => api.vertraege.senden(pid, id),
    onSuccess: (e: any) => {
      qc.invalidateQueries({ queryKey: ['vertraege', pid] })
      toast({ title: 'Verschickt', description: `An ${e.an}` })
    },
    onError: (f: any) => toast({ title: 'Nicht verschickt', description: f.message, variant: 'destructive' }),
  })

  const personen: any[] = data?.personen ?? []
  const gezeigt = nurOffene ? personen.filter((p) => p.vertraege.length === 0 || p.offen > 0) : personen
  const summe = data?.summe

  if (isLoading) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Lade…</CardContent></Card>
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: 'Personen', wert: summe?.personen ?? 0, klasse: '' },
          { label: 'Ohne Vertrag', wert: summe?.ohne_vertrag ?? 0, klasse: (summe?.ohne_vertrag ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : '' },
          { label: 'Wartet auf Antwort', wert: summe?.offen ?? 0, klasse: '' },
          { label: 'Bestätigt', wert: summe?.bestaetigt ?? 0, klasse: 'text-emerald-600 dark:text-emerald-400' },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="pt-5">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</div>
              <div className={`text-2xl font-semibold mt-1 ${k.klasse}`}>{k.wert}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={nurOffene ? 'default' : 'outline'}
          size="sm"
          onClick={() => setNurOffene((v) => !v)}
        >
          Nur offene zeigen
        </Button>
        <span className="text-xs text-muted-foreground">
          {gezeigt.length} von {personen.length}
        </span>
      </div>

      <div className="space-y-2">
        {gezeigt.length === 0 ? (
          <Card>
            <CardContent className="py-14 text-center text-sm text-muted-foreground">
              {nurOffene
                ? 'Alle haben einen Vertrag und alle haben bestätigt.'
                : 'Noch niemand im Projekt. Besetzung und Stab anlegen, dann erscheinen sie hier.'}
            </CardContent>
          </Card>
        ) : (
          gezeigt.map((p) => (
            <Card key={`${p.person_type}:${p.person_id}`}>
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{PERSONENART[p.person_type]}</span>
                      {p.kind && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center gap-1">
                          <Baby className="w-3 h-3" />
                          {p.alter} Jahre
                        </span>
                      )}
                      {p.minderjaehrig && !p.kind && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          minderjährig, {p.alter}
                        </span>
                      )}
                    </div>
                    {p.vertraege.length === 0 && (
                      <div className="text-xs text-muted-foreground mt-1">Noch kein Vertrag</div>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setNeuFuer(p)}>
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Vertrag
                  </Button>
                </div>

                {p.vertraege.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {p.vertraege.map((v: any) => (
                      <div key={v.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS[v.status]?.klasse ?? ''}`}>
                          {STATUS[v.status]?.label ?? v.status}
                        </span>
                        <span className="flex-1 min-w-0 truncate">{v.title}</span>
                        {v.confirmed_at && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            {v.confirmed_name} · {zeitpunkt(v.confirmed_at)}
                          </span>
                        )}
                        {v.status === 'versendet' && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            seit {zeitpunkt(v.sent_at)}
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => download(api.vertraege.pdfUrl(pid, v.id), `vertrag-${v.id}.pdf`)}
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </Button>
                        {v.status === 'entwurf' && (
                          <Button size="sm" onClick={() => senden.mutate(v.id)} disabled={senden.isPending}>
                            <Send className="w-3.5 h-3.5 mr-1" />
                            Senden
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {neuFuer && <VertragAnlegen pid={pid} person={neuFuer} schliessen={() => setNeuFuer(null)} />}
    </div>
  )
}

// ─── Vertrag anlegen ─────────────────────────────────────────────────────────

function VertragAnlegen({ pid, person, schliessen }: { pid: number; person: any; schliessen: () => void }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [gewaehlt, setGewaehlt] = useState('')
  const [titel, setTitel] = useState('')
  const [text, setText] = useState('')
  const [vorschau, setVorschau] = useState<any>(null)

  const { data } = useQuery({
    queryKey: ['vertragsvorlagen', pid],
    queryFn: () => api.vertraege.vorlagen(pid),
  })

  // Eigene Vorlagen zuerst: Wer sich welche angelegt hat, will die benutzen.
  const alle = [
    ...(data?.eigene ?? []).map((v: any) => ({ id: `e${v.id}`, kind: v.kind, name: v.name, body: v.body, templateId: v.id })),
    ...(data?.mitgeliefert ?? []).map((v: any, i: number) => ({ id: `s${i}`, kind: v.kind, name: v.name, body: v.body, templateId: null })),
  ]

  const waehle = async (id: string) => {
    setGewaehlt(id)
    const v = alle.find((x) => x.id === id)
    if (!v) return
    setTitel(v.name.replace(' (Entwurf)', ''))
    try {
      const p = await api.vertraege.vorschau(pid, {
        person_type: person.person_type, person_id: person.person_id, body: v.body,
      })
      setText(p.text)
      setVorschau(p)
    } catch (f: any) {
      toast({ title: 'Vorschau fehlgeschlagen', description: f.message, variant: 'destructive' })
    }
  }

  const anlegen = useMutation({
    mutationFn: () => {
      const v = alle.find((x) => x.id === gewaehlt)
      return api.vertraege.anlegen(pid, {
        person_type: person.person_type,
        person_id: person.person_id,
        kind: v?.kind ?? 'darsteller',
        template_id: v?.templateId ?? null,
        title: titel,
        // Der bereits gefüllte Text wird gespeichert, nicht die Vorlage: Was
        // hier steht, ist was verschickt wird.
        body: text,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vertraege', pid] })
      schliessen()
      toast({ title: 'Entwurf angelegt', description: 'Vor dem Senden einmal durchlesen.' })
    },
    onError: (f: any) => toast({ title: 'Nicht angelegt', description: f.message, variant: 'destructive' }),
  })

  return (
    <Dialog open onOpenChange={(offen) => { if (!offen) schliessen() }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vertrag für {person.name}</DialogTitle>
          <DialogDescription>
            {person.kind
              ? `${person.alter} Jahre - der Vertrag geht an die erziehungsberechtigte Person, nicht an das Kind.`
              : 'Die Vorlage wird mit den Daten aus dem Projekt gefüllt.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="vertrag-vorlage">Vorlage</Label>
            <Select value={gewaehlt} onValueChange={waehle}>
              <SelectTrigger id="vertrag-vorlage"><SelectValue placeholder="wählen" /></SelectTrigger>
              <SelectContent>
                {alle.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {vorschau && vorschau.fehlt.length > 0 && (
            <div className="flex items-start gap-2 text-xs p-3 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Ohne Wert geblieben: {vorschau.fehlt.join(', ')}. Diese Stellen sind im Text leer -
                entweder die Angabe im Projekt nachtragen oder den Text von Hand ergänzen.
              </span>
            </div>
          )}

          {gewaehlt && (
            <>
              <div>
                <Label htmlFor="vertrag-titel">Titel</Label>
                <Input id="vertrag-titel" value={titel} onChange={(e) => setTitel(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="vertrag-text">Text</Label>
                <Textarea
                  id="vertrag-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={18}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Ab dem Versand ist dieser Text eingefroren. Für eine andere Fassung einen neuen
                  Vertrag anlegen - so bleibt belegbar, wem was vorlag.
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={schliessen}>Abbrechen</Button>
          <Button onClick={() => anlegen.mutate()} disabled={!gewaehlt || !text.trim() || anlegen.isPending}>
            Entwurf anlegen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Jugendschutz ────────────────────────────────────────────────────────────

function Jugendschutz({ pid }: { pid: number }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [bearbeite, setBearbeite] = useState<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['jugendschutz', pid],
    queryFn: () => api.jugendschutz.pruefung(pid),
  })

  const personen: any[] = data?.personen ?? []

  if (isLoading) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Lade…</CardContent></Card>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-xs p-3 rounded-lg bg-muted">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Kinderarbeit ist nach § 5 JArbSchG verboten; § 6 ist die Ausnahme davon und verlangt eine
          Bewilligung der Aufsichtsbehörde <strong>vor</strong> dem Dreh. Der Antrag braucht je nach
          Bundesland ein bis zwei Wochen. Diese Prüfung rechnet die gesetzlichen Grenzen nach - was
          der Bescheid im Einzelfall festlegt, hat Vorrang.
        </span>
      </div>

      {(data?.verstoesse ?? 0) > 0 && (
        <div className="flex items-start gap-2 text-sm p-3 rounded-lg bg-destructive/10 text-destructive">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>{data.verstoesse}</strong>{' '}
            {data.verstoesse === 1 ? 'Punkt steht' : 'Punkte stehen'} der Mitwirkung entgegen.
          </span>
        </div>
      )}

      {(data?.ohne_geburtsdatum ?? 0) > 0 && (
        <div className="flex items-start gap-2 text-xs p-3 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Bei {data.ohne_geburtsdatum} Personen aus Besetzung und Komparserie fehlt das
            Geburtsdatum. Ohne Alter lässt sich nichts prüfen - solange könnte ein Kind dabei sein,
            von dem niemand weiß.
          </span>
        </div>
      )}

      {personen.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            Niemand unter 18 im Projekt - jedenfalls niemand mit eingetragenem Geburtsdatum.
          </CardContent>
        </Card>
      ) : (
        personen.map((p) => (
          <Card key={`${p.person_type}:${p.person_id}`}>
            <CardContent className="pt-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400">
                      {p.alter} Jahre
                    </span>
                    {p.permit_granted ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        Bewilligung liegt vor
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">
                        keine Bewilligung
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{p.grenze.grund}</div>
                  {p.guardian_name && (
                    <div className="text-xs text-muted-foreground">
                      Erziehungsberechtigt: {p.guardian_name}
                    </div>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => setBearbeite(p)}>
                  Angaben
                </Button>
              </div>

              {p.tage.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-3">
                  Steht auf keiner Tagesdisposition. Sobald eine Dispo da ist, wird hier gerechnet.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {p.tage.map((t: any) => (
                    <div key={t.datum} className="border-t border-border/60 pt-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-mono text-xs">{datum(t.datum)}</span>
                        {t.dauerMinuten > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {Math.round(t.dauerMinuten / 6) / 10} Stunden geplant
                          </span>
                        )}
                        {t.befunde.length === 0 && (
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            nichts zu beanstanden
                          </span>
                        )}
                      </div>
                      {t.befunde.map((b: any, i: number) => (
                        <div
                          key={i}
                          className={`text-xs mt-1 flex items-start gap-1.5 ${
                            b.art === 'verstoss' ? 'text-destructive' : 'text-muted-foreground'
                          }`}
                        >
                          {b.art === 'verstoss'
                            ? <ShieldAlert className="w-3 h-3 shrink-0 mt-0.5" />
                            : <Info className="w-3 h-3 shrink-0 mt-0.5" />}
                          <span>{b.text}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Was der Antrag braucht</CardTitle></CardHeader>
        <CardContent>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
            {(data?.unterlagen ?? []).map((u: string) => <li key={u}>{u}</li>)}
          </ul>
          <p className="text-xs text-muted-foreground mt-2">
            Zuständig ist je nach Bundesland die Bezirksregierung oder das Regierungspräsidium.
            Die Stellungnahmen von Schule und Jugendamt dauern am längsten - zuerst anfragen.
          </p>
        </CardContent>
      </Card>

      {bearbeite && (
        <AngabenDialog
          pid={pid}
          person={bearbeite}
          schliessen={() => setBearbeite(null)}
          gespeichert={() => {
            qc.invalidateQueries({ queryKey: ['jugendschutz', pid] })
            qc.invalidateQueries({ queryKey: ['vertraege', pid] })
            toast({ title: 'Gespeichert' })
          }}
        />
      )}
    </div>
  )
}

function AngabenDialog({ pid, person, schliessen, gespeichert }: {
  pid: number; person: any; schliessen: () => void; gespeichert: () => void
}) {
  const { toast } = useToast()
  const [werte, setWerte] = useState({
    guardian_name: person.guardian_name || '',
    guardian_email: person.guardian_email || '',
    permit_granted: person.permit_granted === true,
    permit_reference: person.permit_reference || '',
    permit_valid_until: person.permit_valid_until ? String(person.permit_valid_until).slice(0, 10) : '',
  })

  const speichern = useMutation({
    mutationFn: () => api.jugendschutz.speichern(pid, person.person_type, person.person_id, {
      ...werte,
      permit_valid_until: werte.permit_valid_until || null,
    }),
    onSuccess: () => { gespeichert(); schliessen() },
    onError: (f: any) => toast({ title: 'Nicht gespeichert', description: f.message, variant: 'destructive' }),
  })

  return (
    <Dialog open onOpenChange={(offen) => { if (!offen) schliessen() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{person.name}</DialogTitle>
          <DialogDescription>
            {person.alter} Jahre. Diese Angaben gehen in die Prüfung ein und in den Antrag.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="js-name">Erziehungsberechtigte Person</Label>
            <Input
              id="js-name"
              value={werte.guardian_name}
              onChange={(e) => setWerte({ ...werte, guardian_name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="js-mail">Mailadresse</Label>
            <Input
              id="js-mail"
              type="email"
              value={werte.guardian_email}
              onChange={(e) => setWerte({ ...werte, guardian_email: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              An diese Adresse gehen die Verträge - nicht an das Kind.
            </p>
          </div>
          <div className="flex items-center gap-2 border-t border-border/60 pt-3">
            <input
              id="js-bewilligung"
              type="checkbox"
              checked={werte.permit_granted}
              onChange={(e) => setWerte({ ...werte, permit_granted: e.target.checked })}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="js-bewilligung" className="font-normal">
              Bewilligung nach § 6 JArbSchG liegt vor
            </Label>
          </div>
          {person.person_type === 'cast' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="js-aktenzeichen">Aktenzeichen</Label>
                <Input
                  id="js-aktenzeichen"
                  value={werte.permit_reference}
                  onChange={(e) => setWerte({ ...werte, permit_reference: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="js-gueltig">Gültig bis</Label>
                <Input
                  id="js-gueltig"
                  type="date"
                  value={werte.permit_valid_until}
                  onChange={(e) => setWerte({ ...werte, permit_valid_until: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={schliessen}>Abbrechen</Button>
          <Button onClick={() => speichern.mutate()} disabled={speichern.isPending}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Vorlagen ────────────────────────────────────────────────────────────────

function Vorlagen({ pid }: { pid: number }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [bearbeite, setBearbeite] = useState<any>(null)

  const { data } = useQuery({
    queryKey: ['vertragsvorlagen', pid],
    queryFn: () => api.vertraege.vorlagen(pid),
  })

  const loeschen = useMutation({
    mutationFn: (id: number) => api.vertraege.vorlageLoeschen(pid, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vertragsvorlagen', pid] })
      toast({ title: 'Vorlage entfernt' })
    },
    onError: (f: any) => toast({ title: 'Nicht entfernt', description: f.message, variant: 'destructive' }),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-xs p-3 rounded-lg bg-muted">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Die mitgelieferten Texte sind <strong>Entwürfe</strong>, keine geprüften Verträge. Wer
          eine Produktion mit Sendeplatz macht, legt sie einmal einer Kanzlei vor und speichert das
          Ergebnis als eigene Vorlage - danach werden sie nie wieder angefasst.
        </span>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setBearbeite({ neu: true, kind: 'darsteller', name: '', body: '' })}>
          <Plus className="w-4 h-4 mr-1.5" />
          Eigene Vorlage
        </Button>
      </div>

      {(data?.eigene ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Eigene</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {data.eigene.map((v: any) => (
              <div key={v.id} className="flex items-center gap-2 text-sm">
                <span className="text-xs text-muted-foreground w-36 shrink-0">
                  {data.arten.find((a: any) => a.art === v.kind)?.name ?? v.kind}
                </span>
                <span className="flex-1 truncate">{v.name}</span>
                {v.company_id && (
                  <span className="text-xs text-muted-foreground">firmenweit</span>
                )}
                <Button variant="ghost" size="sm" onClick={() => setBearbeite(v)}>Ändern</Button>
                <Button variant="ghost" size="sm" onClick={() => loeschen.mutate(v.id)} aria-label="Vorlage entfernen">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Mitgeliefert</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(data?.mitgeliefert ?? []).map((v: any) => (
            <div key={v.kind} className="border-b border-border/40 last:border-0 pb-2 last:pb-0">
              <div className="flex items-center gap-2">
                <span className="text-sm">{v.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => setBearbeite({ neu: true, kind: v.kind, name: v.name.replace(' (Entwurf)', ''), body: v.body })}
                >
                  Als eigene übernehmen
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                {v.platzhalter.map((p: string) => `{{${p}}}`).join(' ')}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Platzhalter</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-1 sm:grid-cols-2 text-xs">
            {(data?.platzhalter ?? []).map((p: any) => (
              <div key={p.schluessel} className="flex gap-2">
                <code className="text-muted-foreground shrink-0">{`{{${p.schluessel}}}`}</code>
                <span className="text-muted-foreground truncate">{p.beschreibung}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {bearbeite && (
        <VorlageDialog
          pid={pid}
          vorlage={bearbeite}
          arten={data?.arten ?? []}
          schliessen={() => setBearbeite(null)}
          gespeichert={() => {
            qc.invalidateQueries({ queryKey: ['vertragsvorlagen', pid] })
            toast({ title: 'Gespeichert' })
          }}
        />
      )}
    </div>
  )
}

function VorlageDialog({ pid, vorlage, arten, schliessen, gespeichert }: {
  pid: number; vorlage: any; arten: any[]; schliessen: () => void; gespeichert: () => void
}) {
  const { toast } = useToast()
  const [werte, setWerte] = useState({
    kind: vorlage.kind || 'darsteller',
    name: vorlage.name || '',
    body: vorlage.body || '',
    fuer_firma: !!vorlage.company_id,
  })

  const speichern = useMutation({
    mutationFn: () => vorlage.neu
      ? api.vertraege.vorlageAnlegen(pid, werte)
      : api.vertraege.vorlageSpeichern(pid, vorlage.id, werte),
    onSuccess: () => { gespeichert(); schliessen() },
    onError: (f: any) => toast({ title: 'Nicht gespeichert', description: f.message, variant: 'destructive' }),
  })

  return (
    <Dialog open onOpenChange={(offen) => { if (!offen) schliessen() }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{vorlage.neu ? 'Neue Vorlage' : 'Vorlage ändern'}</DialogTitle>
          <DialogDescription>
            Platzhalter in doppelten geschweiften Klammern werden beim Anlegen eines Vertrags
            ersetzt.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="vorlage-name">Name</Label>
              <Input
                id="vorlage-name"
                value={werte.name}
                onChange={(e) => setWerte({ ...werte, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="vorlage-art">Art</Label>
              <Select value={werte.kind} onValueChange={(w) => setWerte({ ...werte, kind: w })}>
                <SelectTrigger id="vorlage-art"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {arten.map((a: any) => (
                    <SelectItem key={a.art} value={a.art}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {vorlage.neu && (
            <div className="flex items-center gap-2">
              <input
                id="vorlage-firma"
                type="checkbox"
                checked={werte.fuer_firma}
                onChange={(e) => setWerte({ ...werte, fuer_firma: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="vorlage-firma" className="font-normal">
                Für alle Projekte der Firma
              </Label>
            </div>
          )}
          <div>
            <Label htmlFor="vorlage-text">Text</Label>
            <Textarea
              id="vorlage-text"
              value={werte.body}
              onChange={(e) => setWerte({ ...werte, body: e.target.value })}
              rows={18}
              className="font-mono text-xs"
            />
          </div>
        </div>
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
