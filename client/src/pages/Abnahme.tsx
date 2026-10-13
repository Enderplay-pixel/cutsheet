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
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import {
  Film, Send, Plus, Trash2, Check, X, Clock, FileText, ExternalLink, AlertTriangle, Info,
} from 'lucide-react'

const datum = (wert: string | null | undefined) =>
  wert ? new Date(String(wert).slice(0, 10)).toLocaleDateString('de-DE') : '—'

const zeitpunkt = (wert: string | null | undefined) => {
  if (!wert) return '—'
  const d = new Date(wert)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('de-DE')
}

/** Sekunden als Zeitstelle: 734 wird zu "12:14". */
function alsZeitstelle(sekunden: number): string {
  const s = Math.max(0, Math.round(Number(sekunden) || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const rest = s % 60
  const zwei = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${zwei(m)}:${zwei(rest)}` : `${m}:${zwei(rest)}`
}

/** "12:14" wird zu 734. Null, wenn sich nichts lesen lässt. */
function ausZeitstelle(text: string): number {
  const roh = String(text || '').trim()
  if (!roh) return 0
  if (/^\d+$/.test(roh)) return Number(roh)
  const teile = roh.split(':').map((t) => Number(t.trim()))
  if (teile.some((t) => !Number.isFinite(t) || t < 0)) return 0
  if (teile.length === 2) return teile[0] * 60 + teile[1]
  if (teile.length === 3) return teile[0] * 3600 + teile[1] * 60 + teile[2]
  return 0
}

const STATUS: Record<string, { label: string; klasse: string }> = {
  entwurf:       { label: 'Entwurf',        klasse: 'bg-muted text-muted-foreground' },
  versendet:     { label: 'Beim Kunden',    klasse: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  nachbesserung: { label: 'Nachbesserung',  klasse: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  abgenommen:    { label: 'Abgenommen',     klasse: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
}

const NOTIZSTAND: Record<string, { label: string; klasse: string }> = {
  offen:     { label: 'offen',     klasse: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  erledigt:  { label: 'erledigt',  klasse: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  abgelehnt: { label: 'abgelehnt', klasse: 'bg-muted text-muted-foreground' },
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)

  return (
    <div className="px-5 py-6 sm:p-6 max-w-5xl mx-auto space-y-4">
      <PageHeader
        title="Abnahme"
        subtitle="Fassungen, Anmerkungen und die Freigabe des Auftraggebers"
      />

      <Tabs defaultValue="runden">
        <TabsList>
          <TabsTrigger value="runden">
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Abnahmerunden
          </TabsTrigger>
          <TabsTrigger value="fassungen">
            <Film className="w-3.5 h-3.5 mr-1.5" />
            Fassungen
          </TabsTrigger>
        </TabsList>
        <TabsContent value="runden" className="mt-4"><Runden pid={pid} /></TabsContent>
        <TabsContent value="fassungen" className="mt-4"><Fassungen pid={pid} /></TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Abnahmerunden ───────────────────────────────────────────────────────────

function Runden({ pid }: { pid: number }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [neu, setNeu] = useState(false)
  const [offen, setOffen] = useState<number | null>(null)

  const { data: runden, isLoading } = useQuery({
    queryKey: ['abnahmen', pid],
    queryFn: () => api.abnahmen.liste(pid),
  })

  const liste: any[] = runden ?? []

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 text-xs p-3 rounded-lg bg-muted">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Der Auftraggeber bekommt einen Link, sieht die Fassung, hinterlässt Anmerkungen mit
          Zeitstelle und nimmt ab - ohne Konto. Was abgenommen wurde, steht danach im Protokoll
          und nicht in einem Postfach.
        </span>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setNeu(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Zur Abnahme geben
        </Button>
      </div>

      {isLoading ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Lade…</CardContent></Card>
      ) : liste.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            Noch keine Abnahmerunde.
            <span className="block text-xs mt-1">
              Erst eine Fassung anlegen, dann zur Abnahme geben.
            </span>
          </CardContent>
        </Card>
      ) : (
        liste.map((r) => (
          <Card key={r.id} className={r.ueberfaellig ? 'border-amber-500/40' : ''}>
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS[r.status]?.klasse ?? ''}`}>
                      {STATUS[r.status]?.label ?? r.status}
                    </span>
                    <span className="font-medium">{r.fassung || `Fassung ${r.version}`}</span>
                    {r.ueberfaellig && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Frist war {datum(r.deadline)}
                      </span>
                    )}
                  </div>
                  <div className="text-sm mt-1">{r.kunde || r.recipient_name || '—'}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {Number(r.anmerkungen) > 0
                      ? `${r.anmerkungen} Anmerkungen, ${r.offen} offen`
                      : 'noch keine Anmerkungen'}
                    {r.sent_at && ` · verschickt ${datum(r.sent_at)}`}
                    {r.decided_at && ` · entschieden ${zeitpunkt(r.decided_at)}`}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setOffen(r.id)}>Öffnen</Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {neu && (
        <RundeAnlegen
          pid={pid}
          schliessen={() => setNeu(false)}
          angelegt={(id) => {
            qc.invalidateQueries({ queryKey: ['abnahmen', pid] })
            setNeu(false)
            setOffen(id)
          }}
        />
      )}
      {offen !== null && <RundeDialog pid={pid} id={offen} schliessen={() => setOffen(null)} />}
    </div>
  )
}

function RundeAnlegen({ pid, schliessen, angelegt }: {
  pid: number; schliessen: () => void; angelegt: (id: number) => void
}) {
  const { toast } = useToast()
  const [werte, setWerte] = useState({
    cut_id: '', recipient_name: '', recipient_email: '', message: '', deadline: '',
  })

  const { data } = useQuery({ queryKey: ['fassungen', pid], queryFn: () => api.fassungen.liste(pid) })

  const anlegen = useMutation({
    mutationFn: () => api.abnahmen.anlegen(pid, {
      ...werte,
      cut_id: Number(werte.cut_id),
      deadline: werte.deadline || null,
    }),
    onSuccess: (r: any) => angelegt(r.id),
    onError: (f: any) => toast({ title: 'Nicht angelegt', description: f.message, variant: 'destructive' }),
  })

  const fassungen: any[] = data?.fassungen ?? []

  return (
    <Dialog open onOpenChange={(o) => { if (!o) schliessen() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Zur Abnahme geben</DialogTitle>
          <DialogDescription>
            Der Auftraggeber bekommt einen Link - ohne Konto, mit Anmerkungen und Freigabe.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="abn-fassung">Fassung</Label>
            <Select value={werte.cut_id} onValueChange={(w) => setWerte({ ...werte, cut_id: w })}>
              <SelectTrigger id="abn-fassung"><SelectValue placeholder="wählen" /></SelectTrigger>
              <SelectContent>
                {fassungen.map((f: any) => (
                  <SelectItem key={f.id} value={String(f.id)}>
                    {f.label || `Fassung ${f.version}`} ({f.dauer})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fassungen.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Noch keine Fassung angelegt.
              </p>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="abn-name">Name</Label>
              <Input
                id="abn-name"
                value={werte.recipient_name}
                onChange={(e) => setWerte({ ...werte, recipient_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="abn-mail">Mailadresse</Label>
              <Input
                id="abn-mail"
                type="email"
                value={werte.recipient_email}
                onChange={(e) => setWerte({ ...werte, recipient_email: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="abn-frist">Rückmeldung bis</Label>
            <Input
              id="abn-frist"
              type="date"
              value={werte.deadline}
              onChange={(e) => setWerte({ ...werte, deadline: e.target.value })}
              className="w-44"
            />
          </div>
          <div>
            <Label htmlFor="abn-text">Nachricht</Label>
            <Textarea
              id="abn-text"
              value={werte.message}
              onChange={(e) => setWerte({ ...werte, message: e.target.value })}
              rows={3}
              placeholder="Worauf soll geachtet werden?"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={schliessen}>Abbrechen</Button>
          <Button onClick={() => anlegen.mutate()} disabled={!werte.cut_id || anlegen.isPending}>
            Anlegen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RundeDialog({ pid, id, schliessen }: { pid: number; id: number; schliessen: () => void }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const download = useDownload()

  const { data: runde } = useQuery({
    queryKey: ['abnahme', pid, id],
    queryFn: () => api.abnahmen.lesen(pid, id),
  })

  const neuLaden = () => {
    qc.invalidateQueries({ queryKey: ['abnahme', pid, id] })
    qc.invalidateQueries({ queryKey: ['abnahmen', pid] })
  }

  const senden = useMutation({
    mutationFn: () => api.abnahmen.senden(pid, id),
    onSuccess: (e: any) => { neuLaden(); toast({ title: 'Verschickt', description: `An ${e.an}` }) },
    onError: (f: any) => toast({ title: 'Nicht verschickt', description: f.message, variant: 'destructive' }),
  })

  const anmerkung = useMutation({
    mutationFn: ({ notizId, daten }: { notizId: number; daten: any }) =>
      api.abnahmen.anmerkung(pid, id, notizId, daten),
    onSuccess: neuLaden,
    onError: (f: any) => toast({ title: 'Nicht gespeichert', description: f.message, variant: 'destructive' }),
  })

  if (!runde) {
    return (
      <Dialog open onOpenChange={schliessen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Abnahmerunde</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Lade…</p>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) schliessen() }}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {runde.fassung || `Fassung ${runde.version}`}
            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full align-middle ${STATUS[runde.status]?.klasse ?? ''}`}>
              {STATUS[runde.status]?.label ?? runde.status}
            </span>
          </DialogTitle>
          <DialogDescription>
            {runde.kunde || runde.recipient_name || '—'}
            {runde.recipient_email && ` · ${runde.recipient_email}`}
            {runde.deadline && ` · bis ${datum(runde.deadline)}`}
          </DialogDescription>
        </DialogHeader>

        {runde.decided_at && (
          <div className={`text-sm p-3 rounded-lg ${
            runde.status === 'abgenommen'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
          }`}>
            <strong>{runde.status === 'abgenommen' ? 'Abgenommen' : 'Nachbesserung verlangt'}</strong>
            {' '}von {runde.decided_by} am {zeitpunkt(runde.decided_at)}
            {runde.decision && <div className="mt-1">{runde.decision}</div>}
          </div>
        )}

        {/* Anmerkungen */}
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
            Anmerkungen {runde.anmerkungen.length > 0 && `(${runde.offen} von ${runde.anmerkungen.length} offen)`}
          </div>
          {runde.anmerkungen.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">
              Noch keine Anmerkungen.
            </p>
          ) : (
            <div className="space-y-2">
              {runde.anmerkungen.map((a: any) => (
                <div key={a.id} className="border-b border-border/40 last:border-0 pb-2 last:pb-0">
                  <div className="flex flex-wrap items-start gap-2 text-sm">
                    <span className="font-mono text-xs text-muted-foreground w-14 shrink-0 pt-0.5">
                      {a.zeitstelle || '—'}
                    </span>
                    <span className="flex-1 min-w-0">{a.body}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${NOTIZSTAND[a.status]?.klasse ?? ''}`}>
                      {NOTIZSTAND[a.status]?.label ?? a.status}
                    </span>
                  </div>
                  {a.resolved_note && (
                    <div className="text-xs text-muted-foreground pl-16 mt-0.5">→ {a.resolved_note}</div>
                  )}
                  <div className="flex gap-1 pl-16 mt-1">
                    {a.status !== 'erledigt' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => anmerkung.mutate({ notizId: a.id, daten: { status: 'erledigt' } })}
                      >
                        <Check className="w-3 h-3 mr-1" />
                        erledigt
                      </Button>
                    )}
                    {a.status !== 'abgelehnt' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => anmerkung.mutate({ notizId: a.id, daten: { status: 'abgelehnt' } })}
                      >
                        <X className="w-3 h-3 mr-1" />
                        nicht umsetzen
                      </Button>
                    )}
                    {a.status !== 'offen' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => anmerkung.mutate({ notizId: a.id, daten: { status: 'offen' } })}
                      >
                        <Clock className="w-3 h-3 mr-1" />
                        wieder offen
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2">
          {runde.watch_url && (
            <Button
              variant="ghost"
              onClick={() => window.open(runde.watch_url, '_blank', 'noopener')}
              className="mr-auto"
            >
              <ExternalLink className="w-4 h-4 mr-1.5" />
              Fassung ansehen
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => download(api.abnahmen.protokollUrl(pid, id), `abnahme-${id}.pdf`)}
          >
            <FileText className="w-4 h-4 mr-1.5" />
            Protokoll
          </Button>
          <Button variant="ghost" onClick={schliessen}>Schließen</Button>
          {runde.status !== 'abgenommen' && (
            <Button onClick={() => senden.mutate()} disabled={senden.isPending}>
              <Send className="w-4 h-4 mr-1.5" />
              {runde.status === 'entwurf' ? 'Verschicken' : 'Erneut schicken'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Fassungen ───────────────────────────────────────────────────────────────

function Fassungen({ pid }: { pid: number }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [neu, setNeu] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['fassungen', pid],
    queryFn: () => api.fassungen.liste(pid),
  })

  const loeschen = useMutation({
    mutationFn: (id: number) => api.fassungen.loeschen(pid, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fassungen', pid] })
      toast({ title: 'Gelöscht' })
    },
    onError: (f: any) => toast({ title: 'Nicht gelöscht', description: f.message, variant: 'destructive' }),
  })

  const fassungen: any[] = data?.fassungen ?? []
  const stufen: any[] = data?.stufen ?? []

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setNeu(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Fassung
        </Button>
      </div>

      {isLoading ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Lade…</CardContent></Card>
      ) : fassungen.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            Noch keine Fassung.
            <span className="block text-xs mt-1">
              Die Datei bleibt, wo sie ist - hier steht nur der Link, unter dem sie zu sehen ist.
            </span>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="text-left py-2.5 px-4">Nr.</th>
                  <th className="text-left py-2.5 px-4">Fassung</th>
                  <th className="text-left py-2.5 px-4">Stufe</th>
                  <th className="text-right py-2.5 px-4">Länge</th>
                  <th className="text-right py-2.5 px-4">Runden</th>
                  <th className="py-2.5 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {fassungen.map((f) => (
                  <tr key={f.id} className="border-b border-border/40">
                    <td className="py-2.5 px-4 tabular-nums text-muted-foreground">{f.version}</td>
                    <td className="py-2.5 px-4">
                      {f.label || `Fassung ${f.version}`}
                      {f.format && <span className="text-xs text-muted-foreground block">{f.format}</span>}
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground">
                      {stufen.find((s: any) => s.stufe === f.stage)?.name ?? f.stage}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{f.dauer || '—'}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">{f.runden}</td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      {f.watch_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(f.watch_url, '_blank', 'noopener')}
                          aria-label="Fassung ansehen"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => loeschen.mutate(f.id)}
                        aria-label="Fassung löschen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {neu && (
        <FassungDialog
          pid={pid}
          stufen={stufen}
          schliessen={() => setNeu(false)}
          angelegt={() => {
            qc.invalidateQueries({ queryKey: ['fassungen', pid] })
            toast({ title: 'Fassung angelegt' })
          }}
        />
      )}
    </div>
  )
}

function FassungDialog({ pid, stufen, schliessen, angelegt }: {
  pid: number; stufen: any[]; schliessen: () => void; angelegt: () => void
}) {
  const { toast } = useToast()
  const [werte, setWerte] = useState({
    label: '', stage: 'rohschnitt', dauer: '', watch_url: '', format: '', notes: '',
  })

  const anlegen = useMutation({
    mutationFn: () => api.fassungen.anlegen(pid, {
      ...werte,
      duration_seconds: ausZeitstelle(werte.dauer),
    }),
    onSuccess: () => { angelegt(); schliessen() },
    onError: (f: any) => toast({ title: 'Nicht angelegt', description: f.message, variant: 'destructive' }),
  })

  return (
    <Dialog open onOpenChange={(o) => { if (!o) schliessen() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neue Fassung</DialogTitle>
          <DialogDescription>
            Die Nummer vergibt sich von selbst. Die Datei bleibt, wo sie ist - hier steht der Link.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="fass-name">Bezeichnung</Label>
            <Input
              id="fass-name"
              value={werte.label}
              onChange={(e) => setWerte({ ...werte, label: e.target.value })}
              placeholder="Rohschnitt 1"
            />
          </div>
          <div>
            <Label htmlFor="fass-stufe">Stufe</Label>
            <Select value={werte.stage} onValueChange={(w) => setWerte({ ...werte, stage: w })}>
              <SelectTrigger id="fass-stufe"><SelectValue /></SelectTrigger>
              <SelectContent>
                {stufen.map((s: any) => (
                  <SelectItem key={s.stufe} value={s.stufe}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="fass-dauer">Länge</Label>
            <Input
              id="fass-dauer"
              value={werte.dauer}
              onChange={(e) => setWerte({ ...werte, dauer: e.target.value })}
              placeholder="12:14"
            />
          </div>
          <div>
            <Label htmlFor="fass-format">Format</Label>
            <Input
              id="fass-format"
              value={werte.format}
              onChange={(e) => setWerte({ ...werte, format: e.target.value })}
              placeholder="h264 1080p"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="fass-link">Link zum Ansehen</Label>
            <Input
              id="fass-link"
              value={werte.watch_url}
              onChange={(e) => setWerte({ ...werte, watch_url: e.target.value })}
              placeholder="https://…"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Ohne diesen Link lässt sich die Fassung nicht zur Abnahme geben.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={schliessen}>Abbrechen</Button>
          <Button onClick={() => anlegen.mutate()} disabled={anlegen.isPending}>Anlegen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
