import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
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
  Building2, Send, Plus, Trash2, Clock, Check, X, UserPlus, Bell, Info, AlertTriangle,
} from 'lucide-react'

const euro = (cents: number) =>
  (Number(cents || 0) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })

const datum = (wert: string | null | undefined) =>
  wert ? new Date(String(wert).slice(0, 10)).toLocaleDateString('de-DE') : '—'

const heute = () => new Date().toISOString().slice(0, 10)

/** Betrag aus einem Textfeld in Cent - ganzzahlig, ohne Fließkomma. */
function alsCents(text: string): number {
  const sauber = String(text).replace(/\s|\./g, '').replace(',', '.')
  const teile = sauber.split('.')
  const ganz = Math.abs(Math.trunc(Number(teile[0] || 0)))
  const rest = teile[1] ? Math.round(Number((teile[1] + '00').slice(0, 2))) : 0
  return ganz * 100 + rest
}

const alsText = (cents: number) => (Number(cents || 0) / 100).toFixed(2).replace('.', ',')

const STATUS: Record<string, { label: string; klasse: string }> = {
  entwurf:     { label: 'Entwurf',     klasse: 'bg-muted text-muted-foreground' },
  versendet:   { label: 'Wartet',      klasse: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  beantwortet: { label: 'Beantwortet', klasse: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const { data: projekt } = useQuery({ queryKey: ['project', pid], queryFn: () => api.projects.get(pid) })
  const firmaId = projekt?.company_id ?? null

  return (
    <div className="px-5 py-6 sm:p-6 max-w-5xl mx-auto space-y-4">
      <PageHeader
        title="Agenturen"
        subtitle="Rollen ausschreiben und Vorschläge einsammeln"
      />

      {!firmaId ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            Dieses Projekt gehört zu keiner Firma. Agenturen werden auf Firmenebene geführt, damit
            sie beim nächsten Projekt noch da sind - bitte das Projekt einer Firma zuordnen.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="anfragen">
          <TabsList>
            <TabsTrigger value="anfragen">
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Anfragen
            </TabsTrigger>
            <TabsTrigger value="adressen">
              <Building2 className="w-3.5 h-3.5 mr-1.5" />
              Adressen
            </TabsTrigger>
          </TabsList>
          <TabsContent value="anfragen" className="mt-4">
            <Anfragen pid={pid} firmaId={firmaId} />
          </TabsContent>
          <TabsContent value="adressen" className="mt-4">
            <Adressen firmaId={firmaId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

// ─── Anfragen ────────────────────────────────────────────────────────────────

function Anfragen({ pid, firmaId }: { pid: number; firmaId: number }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [offen, setOffen] = useState<number | null>(null)

  const { data: anfragen, isLoading } = useQuery({
    queryKey: ['casting-anfragen', pid],
    queryFn: () => api.casting.anfragen(pid),
  })

  const anlegen = useMutation({
    mutationFn: () => api.casting.anlegen(pid, { subject: '', body: '' }),
    onSuccess: (a: any) => {
      qc.invalidateQueries({ queryKey: ['casting-anfragen', pid] })
      setOffen(a.id)
    },
    onError: (f: any) => toast({ title: 'Nicht angelegt', description: f.message, variant: 'destructive' }),
  })

  const nachfassen = useMutation({
    mutationFn: (id: number) => api.casting.nachfassen(pid, id),
    onSuccess: (e: any) => {
      qc.invalidateQueries({ queryKey: ['casting-anfragen', pid] })
      toast({ title: 'Erinnerung eingereiht', description: `An ${e.an}` })
    },
    onError: (f: any) => toast({ title: 'Nicht verschickt', description: f.message, variant: 'destructive' }),
  })

  const liste: any[] = anfragen ?? []

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => anlegen.mutate()} disabled={anlegen.isPending}>
          <Plus className="w-4 h-4 mr-1.5" />
          Neue Anfrage
        </Button>
      </div>

      {isLoading ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Lade…</CardContent></Card>
      ) : liste.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            Noch keine Anfrage.
            <span className="block text-xs mt-1">
              Eine Anfrage kann mehrere Rollen tragen - eine Agentur bekommt lieber ein Schreiben
              mit vier Rollen als vier Schreiben.
            </span>
          </CardContent>
        </Card>
      ) : (
        liste.map((a) => (
          <Card key={a.id} className={a.ueberfaellig ? 'border-amber-500/40' : ''}>
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS[a.status]?.klasse ?? ''}`}>
                      {STATUS[a.status]?.label ?? a.status}
                    </span>
                    <span className="font-medium">{a.agentur || 'ohne Agentur'}</span>
                    {a.ueberfaellig && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Frist war {datum(a.deadline)}
                      </span>
                    )}
                  </div>
                  <div className="text-sm mt-1">{a.subject || 'ohne Betreff'}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {a.rollen} {Number(a.rollen) === 1 ? 'Rolle' : 'Rollen'}
                    {Number(a.vorschlaege) > 0 && ` · ${a.vorschlaege} Vorschläge`}
                    {a.sent_at && ` · verschickt ${datum(a.sent_at)}`}
                    {a.reminded_at && ' · nachgefasst'}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {a.status === 'versendet' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => nachfassen.mutate(a.id)}
                      disabled={nachfassen.isPending}
                    >
                      <Bell className="w-3.5 h-3.5 mr-1" />
                      Nachfassen
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setOffen(a.id)}>
                    Öffnen
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {offen !== null && (
        <AnfrageDialog pid={pid} firmaId={firmaId} id={offen} schliessen={() => setOffen(null)} />
      )}
    </div>
  )
}

// ─── Eine Anfrage bearbeiten ─────────────────────────────────────────────────

function AnfrageDialog({ pid, firmaId, id, schliessen }: {
  pid: number; firmaId: number; id: number; schliessen: () => void
}) {
  const qc = useQueryClient()
  const { toast } = useToast()

  const { data: anfrage } = useQuery({
    queryKey: ['casting-anfrage', pid, id],
    queryFn: () => api.casting.lesen(pid, id),
  })
  const { data: agenturen } = useQuery({
    queryKey: ['agenturen', firmaId],
    queryFn: () => api.agenturen.liste(firmaId),
  })
  const { data: figuren } = useQuery({
    queryKey: ['characters', pid],
    queryFn: () => api.characters.list(pid),
  })

  const neuLaden = () => {
    qc.invalidateQueries({ queryKey: ['casting-anfrage', pid, id] })
    qc.invalidateQueries({ queryKey: ['casting-anfragen', pid] })
  }

  const speichern = useMutation({
    mutationFn: (daten: any) => api.casting.speichern(pid, id, daten),
    onSuccess: neuLaden,
    onError: (f: any) => toast({ title: 'Nicht gespeichert', description: f.message, variant: 'destructive' }),
  })

  const rollen = useMutation({
    mutationFn: (liste: any[]) => api.casting.rollen(pid, id, liste),
    onSuccess: neuLaden,
    onError: (f: any) => toast({ title: 'Nicht gespeichert', description: f.message, variant: 'destructive' }),
  })

  const senden = useMutation({
    mutationFn: () => api.casting.senden(pid, id),
    onSuccess: (e: any) => {
      neuLaden()
      toast({ title: 'Verschickt', description: `An ${e.an}` })
    },
    onError: (f: any) => toast({ title: 'Nicht verschickt', description: f.message, variant: 'destructive' }),
  })

  const uebernehmen = useMutation({
    mutationFn: (vorschlagId: number) => api.casting.uebernehmen(pid, vorschlagId),
    onSuccess: () => {
      neuLaden()
      qc.invalidateQueries({ queryKey: ['cast', pid] })
      toast({ title: 'In die Besetzung übernommen' })
    },
    onError: (f: any) => toast({ title: 'Nicht übernommen', description: f.message, variant: 'destructive' }),
  })

  const loeschen = useMutation({
    mutationFn: () => api.casting.loeschen(pid, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['casting-anfragen', pid] })
      schliessen()
    },
    onError: (f: any) => toast({ title: 'Nicht gelöscht', description: f.message, variant: 'destructive' }),
  })

  if (!anfrage) {
    return (
      <Dialog open onOpenChange={schliessen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Anfrage</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Lade…</p>
        </DialogContent>
      </Dialog>
    )
  }

  const bearbeitbar = anfrage.status === 'entwurf'
  const liste: any[] = anfrage.rollen ?? []

  const aendere = (index: number, feld: string, wert: any) =>
    rollen.mutate(liste.map((r, i) => (i === index ? { ...r, [feld]: wert } : r)))

  return (
    <Dialog open onOpenChange={(o) => { if (!o) schliessen() }}>
      <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {anfrage.agentur || 'Besetzungsanfrage'}
            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full align-middle ${STATUS[anfrage.status]?.klasse ?? ''}`}>
              {STATUS[anfrage.status]?.label ?? anfrage.status}
            </span>
          </DialogTitle>
          <DialogDescription>
            {bearbeitbar
              ? 'Rollen, Zeitraum und Gage. Ab dem Versand ist der Text eingefroren.'
              : 'Verschickt - der Text bleibt, wie er war. Für eine neue Fassung eine neue Anfrage anlegen.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="anfrage-agentur">Agentur</Label>
              <Select
                value={anfrage.agency_id ? String(anfrage.agency_id) : ''}
                onValueChange={(w) => speichern.mutate({ agency_id: Number(w) })}
                disabled={!bearbeitbar}
              >
                <SelectTrigger id="anfrage-agentur"><SelectValue placeholder="wählen" /></SelectTrigger>
                <SelectContent>
                  {(agenturen ?? []).map((a: any) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="anfrage-frist">Rückmeldung bis</Label>
              <Input
                id="anfrage-frist"
                type="date"
                defaultValue={anfrage.deadline ? String(anfrage.deadline).slice(0, 10) : ''}
                onBlur={(e) => speichern.mutate({ deadline: e.target.value })}
                disabled={!bearbeitbar}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="anfrage-betreff">Betreff</Label>
            <Input
              id="anfrage-betreff"
              defaultValue={anfrage.subject || ''}
              onBlur={(e) => speichern.mutate({ subject: e.target.value })}
              disabled={!bearbeitbar}
              placeholder={`Besetzungsanfrage ${anfrage.projekt}`}
            />
          </div>
          <div>
            <Label htmlFor="anfrage-text">Anschreiben</Label>
            <Textarea
              id="anfrage-text"
              defaultValue={anfrage.body || ''}
              onBlur={(e) => speichern.mutate({ body: e.target.value })}
              disabled={!bearbeitbar}
              rows={3}
              placeholder="Ein, zwei Sätze zum Projekt. Die Rollen stehen darunter als Tabelle."
            />
          </div>
        </div>

        {/* Rollen */}
        <div className="border-t border-border/60 pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Rollen</span>
            {bearbeitbar && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => rollen.mutate([...liste, {
                  role_name: '', description: '', shoot_days: 0, fee_per_day_cents: 0,
                }])}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Rolle
              </Button>
            )}
          </div>

          {liste.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">
              Ohne Rolle lässt sich die Anfrage nicht verschicken.
            </p>
          ) : (
            <div className="space-y-2">
              {liste.map((r, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-12 items-end">
                  <div className="sm:col-span-3">
                    {i === 0 && <Label htmlFor={`rolle-name-${i}`}>Rolle</Label>}
                    <Input
                      id={`rolle-name-${i}`}
                      aria-label="Rolle"
                      defaultValue={r.role_name || r.figur || ''}
                      onBlur={(e) => aendere(i, 'role_name', e.target.value)}
                      disabled={!bearbeitbar}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    {i === 0 && <Label htmlFor={`rolle-figur-${i}`}>Figur im Drehbuch</Label>}
                    <Select
                      value={r.character_id ? String(r.character_id) : ''}
                      onValueChange={(w) => aendere(i, 'character_id', Number(w))}
                      disabled={!bearbeitbar}
                    >
                      <SelectTrigger id={`rolle-figur-${i}`}><SelectValue placeholder="freiwillig" /></SelectTrigger>
                      <SelectContent>
                        {(figuren ?? []).map((f: any) => (
                          <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    {i === 0 && <Label htmlFor={`rolle-von-${i}`}>Von</Label>}
                    <Input
                      id={`rolle-von-${i}`}
                      aria-label="Erster Drehtag"
                      type="date"
                      defaultValue={r.shoot_from ? String(r.shoot_from).slice(0, 10) : ''}
                      onBlur={(e) => aendere(i, 'shoot_from', e.target.value)}
                      disabled={!bearbeitbar}
                    />
                  </div>
                  <div className="sm:col-span-1">
                    {i === 0 && <Label htmlFor={`rolle-tage-${i}`}>Tage</Label>}
                    <Input
                      id={`rolle-tage-${i}`}
                      aria-label="Drehtage"
                      defaultValue={r.shoot_days || ''}
                      onBlur={(e) => aendere(i, 'shoot_days', Math.round(Number(e.target.value) || 0))}
                      disabled={!bearbeitbar}
                      inputMode="numeric"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    {i === 0 && <Label htmlFor={`rolle-gage-${i}`}>Gage / Tag</Label>}
                    <Input
                      id={`rolle-gage-${i}`}
                      aria-label="Gage je Tag"
                      defaultValue={r.fee_per_day_cents ? alsText(r.fee_per_day_cents) : ''}
                      onBlur={(e) => aendere(i, 'fee_per_day_cents', alsCents(e.target.value))}
                      disabled={!bearbeitbar}
                      inputMode="decimal"
                    />
                  </div>
                  <div className="sm:col-span-1 flex justify-end">
                    {bearbeitbar && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => rollen.mutate(liste.filter((_, j) => j !== i))}
                        aria-label="Rolle entfernen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vorschläge */}
        {(anfrage.vorschlaege ?? []).length > 0 && (
          <div className="border-t border-border/60 pt-3">
            <div className="text-sm font-medium mb-2">Vorschläge der Agentur</div>
            <div className="space-y-1.5">
              {anfrage.vorschlaege.map((v: any) => {
                const rolle = liste.find((r) => r.id === v.role_id)
                return (
                  <div key={v.id} className="flex flex-wrap items-center gap-2 text-sm">
                    {v.available === true && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                    {v.available === false && <X className="w-3.5 h-3.5 text-destructive" />}
                    {v.available === null && <Clock className="w-3.5 h-3.5 text-muted-foreground" />}
                    <span className="font-medium">{v.actor_name}</span>
                    {rolle && <span className="text-xs text-muted-foreground">für {rolle.role_name || rolle.figur}</span>}
                    {v.fee_per_day_cents > 0 && (
                      <span className="text-xs text-muted-foreground">{euro(v.fee_per_day_cents)} / Tag</span>
                    )}
                    {v.showreel_url && (
                      <a
                        href={v.showreel_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs underline text-muted-foreground"
                      >
                        Material
                      </a>
                    )}
                    {v.note && <span className="text-xs text-muted-foreground flex-1 truncate">{v.note}</span>}
                    {v.taken_cast_id ? (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 ml-auto">übernommen</span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-auto"
                        onClick={() => uebernehmen.mutate(v.id)}
                        disabled={uebernehmen.isPending || v.available === false}
                      >
                        <UserPlus className="w-3.5 h-3.5 mr-1" />
                        Übernehmen
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          {bearbeitbar && (
            <Button
              variant="ghost"
              onClick={() => loeschen.mutate()}
              className="text-destructive hover:text-destructive mr-auto"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Löschen
            </Button>
          )}
          <Button variant="ghost" onClick={schliessen}>Schließen</Button>
          {bearbeitbar && (
            <Button onClick={() => senden.mutate()} disabled={senden.isPending || liste.length === 0}>
              <Send className="w-4 h-4 mr-1.5" />
              Verschicken
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Adressen ────────────────────────────────────────────────────────────────

function Adressen({ firmaId }: { firmaId: number }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [bearbeite, setBearbeite] = useState<any>(null)

  const { data: agenturen, isLoading } = useQuery({
    queryKey: ['agenturen', firmaId],
    queryFn: () => api.agenturen.liste(firmaId),
  })

  const liste: any[] = agenturen ?? []

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 text-xs p-3 rounded-lg bg-muted">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Agenturen gehören zur Firma, nicht zum Projekt - sie sind beim nächsten Projekt noch da.
        </span>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setBearbeite({ neu: true })}>
          <Plus className="w-4 h-4 mr-1.5" />
          Agentur
        </Button>
      </div>

      {isLoading ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Lade…</CardContent></Card>
      ) : liste.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            Noch keine Agentur eingetragen.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="text-left py-2.5 px-4">Agentur</th>
                  <th className="text-left py-2.5 px-4">Kontakt</th>
                  <th className="text-left py-2.5 px-4">Mail</th>
                  <th className="text-right py-2.5 px-4">Anfragen</th>
                  <th className="py-2.5 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {liste.map((a) => (
                  <tr key={a.id} className="border-b border-border/40">
                    <td className="py-2.5 px-4">{a.name}</td>
                    <td className="py-2.5 px-4 text-muted-foreground">{a.contact_name || '—'}</td>
                    <td className="py-2.5 px-4 text-muted-foreground">
                      {a.email || <span className="text-amber-600 dark:text-amber-400">fehlt</span>}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">{a.anfragen}</td>
                    <td className="py-2.5 px-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setBearbeite(a)}>Ändern</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {bearbeite && (
        <AgenturDialog
          firmaId={firmaId}
          agentur={bearbeite}
          schliessen={() => setBearbeite(null)}
          gespeichert={() => {
            qc.invalidateQueries({ queryKey: ['agenturen', firmaId] })
            toast({ title: 'Gespeichert' })
          }}
        />
      )}
    </div>
  )
}

function AgenturDialog({ firmaId, agentur, schliessen, gespeichert }: {
  firmaId: number; agentur: any; schliessen: () => void; gespeichert: () => void
}) {
  const { toast } = useToast()
  const [werte, setWerte] = useState({
    name: agentur.name || '',
    contact_name: agentur.contact_name || '',
    email: agentur.email || '',
    phone: agentur.phone || '',
    city: agentur.city || '',
    website: agentur.website || '',
    notes: agentur.notes || '',
  })

  const speichern = useMutation({
    mutationFn: () => agentur.neu
      ? api.agenturen.anlegen(firmaId, werte)
      : api.agenturen.speichern(firmaId, agentur.id, werte),
    onSuccess: () => { gespeichert(); schliessen() },
    onError: (f: any) => toast({ title: 'Nicht gespeichert', description: f.message, variant: 'destructive' }),
  })

  const feld = (schluessel: keyof typeof werte) => ({
    value: werte[schluessel],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setWerte({ ...werte, [schluessel]: e.target.value }),
  })

  return (
    <Dialog open onOpenChange={(o) => { if (!o) schliessen() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{agentur.neu ? 'Neue Agentur' : agentur.name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="ag-name">Name</Label>
            <Input id="ag-name" {...feld('name')} />
          </div>
          <div>
            <Label htmlFor="ag-kontakt">Ansprechpartner</Label>
            <Input id="ag-kontakt" {...feld('contact_name')} />
          </div>
          <div>
            <Label htmlFor="ag-mail">Mail</Label>
            <Input id="ag-mail" type="email" {...feld('email')} />
          </div>
          <div>
            <Label htmlFor="ag-telefon">Telefon</Label>
            <Input id="ag-telefon" {...feld('phone')} />
          </div>
          <div>
            <Label htmlFor="ag-ort">Ort</Label>
            <Input id="ag-ort" {...feld('city')} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="ag-web">Website</Label>
            <Input id="ag-web" {...feld('website')} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="ag-notizen">Notizen</Label>
            <Textarea id="ag-notizen" rows={2} {...feld('notes')} />
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
