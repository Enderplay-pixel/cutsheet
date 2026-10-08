import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useSchreibrecht } from '@/lib/useSchreibrecht'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Mail, Users, Send, Clock, RotateCcw, Trash2, Check, AlertTriangle,
  FileText, Inbox, PenLine, Plus, Eye,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

/** Lesbare Beschriftung für den Zustand einer Mail im Postausgang. */
const STATUS_TEXT: Record<string, { label: string; klasse: string }> = {
  wartet:         { label: 'wartet',        klasse: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  gesendet:       { label: 'gesendet',      klasse: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  fehlgeschlagen: { label: 'fehlgeschlagen', klasse: 'bg-destructive/15 text-destructive' },
  ohne_versand:   { label: 'nicht versendet', klasse: 'bg-muted text-muted-foreground' },
}

const REGEL_TEXT: Record<string, string> = {
  manuell: 'feste Liste',
  crew_alle: 'ganzer Stab',
  crew_abteilung: 'eine Abteilung',
  cast_alle: 'ganze Besetzung',
  komparsen: 'Komparsen',
  mitglieder: 'Projektmitglieder',
  drehtag: 'Beteiligte eines Drehtags',
}

function zeit(wert: string | null) {
  if (!wert) return ''
  return new Date(wert).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const { toast } = useToast()
  const qc = useQueryClient()
  const { darfSchreiben } = useSchreibrecht()

  const { data: crew } = useQuery({ queryKey: ['crew', pid], queryFn: () => api.crew.list(pid) })
  const { data: cast } = useQuery({ queryKey: ['cast', pid], queryFn: () => api.cast.list(pid) })
  const { data: status } = useQuery({ queryKey: ['email-status', pid], queryFn: () => api.emailSend.status(pid) })
  const { data: vorlagen } = useQuery({ queryKey: ['email-templates', pid], queryFn: () => api.emailSend.templates(pid) })
  const { data: verteiler } = useQuery({ queryKey: ['email-groups', pid], queryFn: () => api.emailSend.groups(pid) })
  const { data: postausgang } = useQuery({
    queryKey: ['email-outbox', pid],
    queryFn: () => api.emailSend.outbox(pid),
    refetchInterval: 20_000,
  })
  const { data: absender } = useQuery({ queryKey: ['email-identity', pid], queryFn: () => api.emailSend.identity(pid) })

  const [betreff, setBetreff] = useState('')
  const [text, setText] = useState('')
  const [ausgewaehlt, setAusgewaehlt] = useState<Set<string>>(new Set())
  const [verteilerId, setVerteilerId] = useState<string>('')
  const [zeitpunkt, setZeitpunkt] = useState('')
  const [mitQuittung, setMitQuittung] = useState(false)

  const eingerichtet = status?.configured === true

  const adressen = useMemo(() => {
    const stab = (crew || []).filter((c: any) => c.email).map((c: any) => ({ email: c.email, name: c.name, gruppe: c.department || 'Stab' }))
    const besetzung = (cast || []).filter((c: any) => c.email).map((c: any) => ({ email: c.email, name: c.actor_name, gruppe: 'Besetzung' }))
    return [...stab, ...besetzung]
  }, [crew, cast])

  const nachGruppe = useMemo(() => {
    return adressen.reduce((acc: Record<string, any[]>, person) => {
      ;(acc[person.gruppe] ||= []).push(person)
      return acc
    }, {})
  }, [adressen])

  const gewaehlteAdressen = Array.from(ausgewaehlt)

  const umschalten = (email: string) => {
    const naechste = new Set(ausgewaehlt)
    naechste.has(email) ? naechste.delete(email) : naechste.add(email)
    setAusgewaehlt(naechste)
  }

  const gruppeUmschalten = (emails: string[]) => {
    const naechste = new Set(ausgewaehlt)
    const alleDrin = emails.every(e => naechste.has(e))
    emails.forEach(e => (alleDrin ? naechste.delete(e) : naechste.add(e)))
    setAusgewaehlt(naechste)
  }

  const senden = useMutation({
    mutationFn: () =>
      api.emailSend.send(pid, {
        subject: betreff,
        text,
        recipients: verteilerId ? undefined : gewaehlteAdressen.map(email => {
          const person = adressen.find(a => a.email === email)
          return { email, name: person?.name || '' }
        }),
        group_id: verteilerId ? Number(verteilerId) : undefined,
        scheduled_for: zeitpunkt ? new Date(zeitpunkt).toISOString() : undefined,
        mit_quittung: mitQuittung,
      }),
    onSuccess: (ergebnis: any) => {
      qc.invalidateQueries({ queryKey: ['email-outbox', pid] })
      qc.invalidateQueries({ queryKey: ['email-status', pid] })
      if (ergebnis.scheduled_for) {
        toast({ title: `${ergebnis.queued} Mails eingeplant`, description: `Versand am ${zeit(ergebnis.scheduled_for)}` })
      } else {
        const teile = [`${ergebnis.sent} versendet`]
        if (ergebnis.queued) teile.push(`${ergebnis.queued} in der Warteschlange`)
        if (ergebnis.ohne_versand) teile.push(`${ergebnis.ohne_versand} ohne Mailserver`)
        toast({ title: teile.join(', ') })
      }
      setText('')
      setBetreff('')
      setAusgewaehlt(new Set())
      setZeitpunkt('')
    },
    onError: (fehler: any) => toast({ title: 'Versand abgelehnt', description: fehler.message, variant: 'destructive' }),
  })

  const test = useMutation({
    mutationFn: () => api.emailSend.test(pid),
    onSuccess: (ergebnis: any) => {
      qc.invalidateQueries({ queryKey: ['email-outbox', pid] })
      toast({
        title: ergebnis.sent > 0 ? 'Test-Mail ist raus' : 'Nichts versendet',
        description: ergebnis.sent > 0 ? 'Schau in dein Postfach.' : 'Es ist kein Mailserver eingerichtet.',
      })
    },
  })

  const erneut = useMutation({
    mutationFn: (id: number) => api.emailSend.retry(pid, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-outbox', pid] })
      toast({ title: 'Erneut in die Warteschlange gelegt' })
    },
  })

  const zurueckziehen = useMutation({
    mutationFn: (id: number) => api.emailSend.withdraw(pid, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-outbox', pid] })
      toast({ title: 'Mail zurückgezogen' })
    },
  })

  const vorlageEinsetzen = (vorlage: any) => {
    setBetreff(vorlage.subject)
    setText(vorlage.body)
    toast({ title: `Vorlage „${vorlage.name}" übernommen`, description: 'Platzhalter werden beim Senden gefüllt.' })
  }

  const empfaengerAnzahl = verteilerId
    ? (verteiler || []).find((v: any) => String(v.id) === verteilerId)?.anzahl ?? 0
    : gewaehlteAdressen.length

  return (
    <div className="px-5 py-6 sm:p-6 max-w-6xl mx-auto space-y-4">
      <PageHeader
        title="E-Mail"
        subtitle="Vorlagen, Verteiler und Versand - mit Protokoll"
      />

      {!eingerichtet && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 py-4 text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="font-medium">Kein Mailserver eingerichtet</p>
              <p className="text-muted-foreground mt-1">
                Ohne SMTP-Zugang geht nichts raus. Du kannst trotzdem Vorlagen und Verteiler
                anlegen - sie liegen bereit, sobald der Zugang steht. Die Zugangsdaten setzt
                der Betreiber in den Umgebungsvariablen SMTP_HOST, SMTP_USER und SMTP_PASS.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="verfassen">
        <TabsList>
          <TabsTrigger value="verfassen"><PenLine className="w-3.5 h-3.5 mr-1.5" />Verfassen</TabsTrigger>
          <TabsTrigger value="vorlagen"><FileText className="w-3.5 h-3.5 mr-1.5" />Vorlagen</TabsTrigger>
          <TabsTrigger value="verteiler"><Users className="w-3.5 h-3.5 mr-1.5" />Verteiler</TabsTrigger>
          <TabsTrigger value="postausgang"><Inbox className="w-3.5 h-3.5 mr-1.5" />Postausgang</TabsTrigger>
          <TabsTrigger value="absender"><Mail className="w-3.5 h-3.5 mr-1.5" />Absender</TabsTrigger>
        </TabsList>

        {/* ── Verfassen ───────────────────────────────────────────────────── */}
        <TabsContent value="verfassen" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1 space-y-3">
              <Card>
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="text-sm flex items-center justify-between">
                    Empfänger
                    <Badge variant="secondary">{empfaengerAnzahl}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs">Verteiler</Label>
                    <Select value={verteilerId || 'keiner'} onValueChange={v => setVerteilerId(v === 'keiner' ? '' : v)}>
                      <SelectTrigger className="h-8 text-xs mt-1">
                        <SelectValue placeholder="Einzeln auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="keiner">Einzeln auswählen</SelectItem>
                        {(verteiler || []).map((v: any) => (
                          <SelectItem key={v.id} value={String(v.id)}>
                            {v.name} ({v.anzahl})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {!verteilerId && (
                    <>
                      <Separator />
                      {Object.entries(nachGruppe).map(([gruppe, personen]) => (
                        <div key={gruppe}>
                          <button
                            className="text-xs font-semibold text-muted-foreground hover:text-primary w-full text-left mb-1 py-1.5"
                            onClick={() => gruppeUmschalten((personen as any[]).map(p => p.email))}
                          >
                            {gruppe} ({(personen as any[]).length})
                          </button>
                          {(personen as any[]).map(person => (
                            <label key={person.email} className="flex items-center gap-2 cursor-pointer py-0.5 hover:text-primary">
                              <Checkbox
                                checked={ausgewaehlt.has(person.email)}
                                onCheckedChange={() => umschalten(person.email)}
                                className="h-3.5 w-3.5"
                              />
                              <span className="text-xs truncate">{person.name}</span>
                            </label>
                          ))}
                        </div>
                      ))}
                      {adressen.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Niemand im Stab oder in der Besetzung hat eine E-Mail-Adresse hinterlegt.
                        </p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {status && (
                <Card>
                  <CardContent className="py-3 text-xs text-muted-foreground space-y-1">
                    <p>In der letzten Stunde: {status.verbraucht_letzte_stunde} von {status.limit_pro_stunde} Mails</p>
                    {status.wartend > 0 && <p>{status.wartend} warten auf den Versand</p>}
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="lg:col-span-2 space-y-3">
              {(vorlagen || []).length > 0 && (
                <Card>
                  <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">Vorlage übernehmen</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex gap-2 flex-wrap">
                      {(vorlagen || []).map((v: any) => (
                        <Button key={v.id} variant="outline" size="sm" className="text-xs h-7" onClick={() => vorlageEinsetzen(v)}>
                          {v.name}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">Nachricht</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs" htmlFor="betreff">Betreff</Label>
                    <Input id="betreff" value={betreff} onChange={e => setBetreff(e.target.value)}
                      className="mt-1 h-8 text-sm" placeholder="Betreff" />
                  </div>
                  <div>
                    <Label className="text-xs" htmlFor="nachricht">Text</Label>
                    <Textarea id="nachricht" value={text} onChange={e => setText(e.target.value)}
                      rows={12} className="mt-1 text-sm resize-none" placeholder="Hallo {{vorname}}, …" />
                    <p className="text-xs text-muted-foreground mt-1">
                      Platzhalter in doppelten geschweiften Klammern werden je Empfänger gefüllt:
                      {' '}
                      {(status?.platzhalter || []).slice(0, 6).map((p: any) => `{{${p.schluessel}}}`).join(', ')}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs" htmlFor="zeitpunkt">Später senden</Label>
                      <Input id="zeitpunkt" type="datetime-local" value={zeitpunkt}
                        onChange={e => setZeitpunkt(e.target.value)} className="mt-1 h-8 text-sm" />
                    </div>
                    <label className="flex items-center gap-2 text-xs mt-5 cursor-pointer">
                      <Checkbox checked={mitQuittung} onCheckedChange={v => setMitQuittung(!!v)} className="h-3.5 w-3.5" />
                      Empfang bestätigen lassen
                    </label>
                  </div>

                  <div className="flex gap-2 pt-1 flex-wrap">
                    <Button
                      size="sm"
                      disabled={!darfSchreiben || senden.isPending || empfaengerAnzahl === 0 || !betreff.trim() || !text.trim()}
                      onClick={() => senden.mutate()}
                    >
                      {zeitpunkt ? <Clock className="w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                      {zeitpunkt ? 'Einplanen' : `An ${empfaengerAnzahl} senden`}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => test.mutate()} disabled={test.isPending}>
                      Test an mich
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── Vorlagen ────────────────────────────────────────────────────── */}
        <TabsContent value="vorlagen" className="mt-4">
          <VorlagenBereich pid={pid} vorlagen={vorlagen || []} darfSchreiben={darfSchreiben} />
        </TabsContent>

        {/* ── Verteiler ───────────────────────────────────────────────────── */}
        <TabsContent value="verteiler" className="mt-4">
          <VerteilerBereich pid={pid} verteiler={verteiler || []} crew={crew || []} darfSchreiben={darfSchreiben} />
        </TabsContent>

        {/* ── Postausgang ─────────────────────────────────────────────────── */}
        <TabsContent value="postausgang" className="mt-4">
          <Card>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm flex items-center gap-2">
                Postausgang
                {(postausgang?.nach_status || []).map((s: any) => (
                  <Badge key={s.status} variant="secondary" className="text-xs font-normal">
                    {STATUS_TEXT[s.status]?.label || s.status}: {s.anzahl}
                  </Badge>
                ))}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(postausgang?.mails || []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Noch keine Mail aus diesem Projekt.
                </p>
              ) : (
                <div className="space-y-1">
                  {(postausgang?.mails || []).map((mail: any) => (
                    <div key={mail.id} className="flex items-start gap-3 py-2 border-b border-border/60 last:border-0 text-sm">
                      <span className={`px-2 py-0.5 rounded text-xs shrink-0 mt-0.5 ${STATUS_TEXT[mail.status]?.klasse || ''}`}>
                        {STATUS_TEXT[mail.status]?.label || mail.status}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{mail.subject}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {mail.recipient_name ? `${mail.recipient_name} · ` : ''}{mail.recipient_email}
                          {mail.sent_at ? ` · ${zeit(mail.sent_at)}` : mail.scheduled_for ? ` · geplant ${zeit(mail.scheduled_for)}` : ''}
                          {mail.read_at ? ' · Empfang bestätigt' : ''}
                        </p>
                        {mail.last_error && (
                          <p className="text-xs text-destructive mt-0.5 break-words">{mail.last_error}</p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {mail.read_at && <Check className="w-4 h-4 text-emerald-500 mt-1" aria-label="Empfang bestätigt" />}
                        {(mail.status === 'fehlgeschlagen' || mail.status === 'ohne_versand') && darfSchreiben && (
                          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => erneut.mutate(mail.id)}>
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />Erneut
                          </Button>
                        )}
                        {mail.status === 'wartet' && darfSchreiben && (
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => zurueckziehen.mutate(mail.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Absender ────────────────────────────────────────────────────── */}
        <TabsContent value="absender" className="mt-4">
          <AbsenderBereich pid={pid} absender={absender} darfSchreiben={darfSchreiben} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/** Vorlagen anlegen, ändern, löschen und als fertige Mail ansehen. */
function VorlagenBereich({ pid, vorlagen, darfSchreiben }: { pid: number; vorlagen: any[]; darfSchreiben: boolean }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [offen, setOffen] = useState<number | null>(null)
  const [entwurf, setEntwurf] = useState<{ name: string; subject: string; body: string }>({ name: '', subject: '', body: '' })
  const [vorschau, setVorschau] = useState<{ subject: string; html: string } | null>(null)

  const speichern = useMutation({
    mutationFn: (id: number | null) =>
      id ? api.emailSend.updateTemplate(pid, id, entwurf) : api.emailSend.createTemplate(pid, entwurf),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-templates', pid] })
      setOffen(null)
      toast({ title: 'Vorlage gespeichert' })
    },
  })

  const loeschen = useMutation({
    mutationFn: (id: number) => api.emailSend.deleteTemplate(pid, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-templates', pid] })
      toast({ title: 'Vorlage gelöscht' })
    },
  })

  const zeigeVorschau = useMutation({
    mutationFn: (id: number) => api.emailSend.previewTemplate(pid, id),
    onSuccess: (daten: any) => setVorschau(daten),
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2 pt-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Vorlagen</CardTitle>
          {darfSchreiben && (
            <Button variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => { setOffen(0); setEntwurf({ name: '', subject: '', body: '' }) }}>
              <Plus className="w-3.5 h-3.5 mr-1" />Neu
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-1">
          {vorlagen.map(v => (
            <div key={v.id} className="flex items-center gap-2 py-1.5 border-b border-border/60 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{v.name}</p>
                <p className="text-xs text-muted-foreground truncate">{v.subject}</p>
              </div>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => zeigeVorschau.mutate(v.id)}>
                <Eye className="w-3.5 h-3.5" />
              </Button>
              {darfSchreiben && (
                <>
                  <Button variant="ghost" size="sm" className="h-7 px-2"
                    onClick={() => { setOffen(v.id); setEntwurf({ name: v.name, subject: v.subject, body: v.body }) }}>
                    <PenLine className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => loeschen.mutate(v.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
            </div>
          ))}
          {vorlagen.length === 0 && <p className="text-sm text-muted-foreground py-4">Noch keine Vorlage.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-sm">{offen !== null ? 'Vorlage bearbeiten' : 'Vorschau'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {offen !== null ? (
            <>
              <div>
                <Label className="text-xs" htmlFor="v-name">Name</Label>
                <Input id="v-name" value={entwurf.name} onChange={e => setEntwurf({ ...entwurf, name: e.target.value })}
                  className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs" htmlFor="v-betreff">Betreff</Label>
                <Input id="v-betreff" value={entwurf.subject} onChange={e => setEntwurf({ ...entwurf, subject: e.target.value })}
                  className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs" htmlFor="v-text">Text</Label>
                <Textarea id="v-text" value={entwurf.body} onChange={e => setEntwurf({ ...entwurf, body: e.target.value })}
                  rows={10} className="mt-1 text-sm resize-none" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => speichern.mutate(offen || null)} disabled={!entwurf.name.trim()}>
                  Speichern
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setOffen(null)}>Abbrechen</Button>
              </div>
            </>
          ) : vorschau ? (
            <>
              <p className="text-sm font-medium">{vorschau.subject}</p>
              <Separator />
              <div className="text-sm [&_p]:mb-2" dangerouslySetInnerHTML={{ __html: vorschau.html }} />
              <p className="text-xs text-muted-foreground">
                Beispielwerte. Beim Versand stehen hier die echten Namen und Zeiten.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-4">
              Wähle eine Vorlage aus, um sie als fertige Mail zu sehen.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/** Verteiler anlegen: feste Listen oder Regeln, die sich selbst aktuell halten. */
function VerteilerBereich({ pid, verteiler, crew, darfSchreiben }: { pid: number; verteiler: any[]; crew: any[]; darfSchreiben: boolean }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [regel, setRegel] = useState('crew_alle')
  const [parameter, setParameter] = useState('')

  const abteilungen = useMemo(
    () => Array.from(new Set((crew || []).map((c: any) => c.department).filter(Boolean))) as string[],
    [crew]
  )

  const anlegen = useMutation({
    mutationFn: () => api.emailSend.createGroup(pid, { name, rule: regel, parameter }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-groups', pid] })
      setName('')
      toast({ title: 'Verteiler angelegt' })
    },
  })

  const loeschen = useMutation({
    mutationFn: (id: number) => api.emailSend.deleteGroup(pid, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-groups', pid] })
      toast({ title: 'Verteiler gelöscht' })
    },
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">Verteiler</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {verteiler.map(v => (
            <div key={v.id} className="flex items-center gap-2 py-1.5 border-b border-border/60 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{v.name}</p>
                <p className="text-xs text-muted-foreground">
                  {REGEL_TEXT[v.rule] || v.rule}{v.parameter ? ` · ${v.parameter}` : ''} · {v.anzahl} Adressen
                </p>
              </div>
              {darfSchreiben && (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => loeschen.mutate(v.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          ))}
          {verteiler.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">
              Noch kein Verteiler. Ein Verteiler nach Regel bleibt von allein aktuell.
            </p>
          )}
        </CardContent>
      </Card>

      {darfSchreiben && (
        <Card>
          <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">Neuer Verteiler</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs" htmlFor="g-name">Name</Label>
              <Input id="g-name" value={name} onChange={e => setName(e.target.value)}
                className="mt-1 h-8 text-sm" placeholder="Kamera-Team" />
            </div>
            <div>
              <Label className="text-xs">Wer gehört dazu</Label>
              <Select value={regel} onValueChange={setRegel}>
                <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(REGEL_TEXT).filter(([k]) => k !== 'manuell' && k !== 'drehtag').map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {regel === 'crew_abteilung' && (
              <div>
                <Label className="text-xs">Abteilung</Label>
                <Select value={parameter} onValueChange={setParameter}>
                  <SelectTrigger className="h-8 text-sm mt-1"><SelectValue placeholder="Abteilung wählen" /></SelectTrigger>
                  <SelectContent>
                    {abteilungen.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button size="sm" onClick={() => anlegen.mutate()}
              disabled={!name.trim() || (regel === 'crew_abteilung' && !parameter)}>
              Anlegen
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/** Absendername, Antwortadresse und Signatur - die Mail trägt den Namen der Produktion. */
function AbsenderBereich({ pid, absender, darfSchreiben }: { pid: number; absender: any; darfSchreiben: boolean }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [entwurf, setEntwurf] = useState<any>(null)
  const werte = entwurf ?? absender ?? {}

  const speichern = useMutation({
    mutationFn: () => api.emailSend.saveIdentity(pid, werte),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-identity', pid] })
      toast({ title: 'Absender gespeichert' })
    },
    onError: (fehler: any) => toast({ title: 'Nicht gespeichert', description: fehler.message, variant: 'destructive' }),
  })

  const setze = (feld: string, wert: string) => setEntwurf({ ...werte, [feld]: wert })

  return (
    <Card className="max-w-2xl">
      <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">Absender und Signatur</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs" htmlFor="a-name">Absendername</Label>
          <Input id="a-name" value={werte.sender_name || ''} onChange={e => setze('sender_name', e.target.value)}
            className="mt-1 h-8 text-sm" placeholder="Produktion Sprachlos" disabled={!darfSchreiben} />
          <p className="text-xs text-muted-foreground mt-1">
            Steht als Name vor der Absenderadresse des Servers.
          </p>
        </div>
        <div>
          <Label className="text-xs" htmlFor="a-antwort">Antwortadresse</Label>
          <Input id="a-antwort" type="email" value={werte.reply_to || ''} onChange={e => setze('reply_to', e.target.value)}
            className="mt-1 h-8 text-sm" placeholder="produktion@beispiel.de" disabled={!darfSchreiben} />
          <p className="text-xs text-muted-foreground mt-1">
            Hierhin geht die Antwort, wenn jemand auf „Antworten" drückt.
          </p>
        </div>
        <div>
          <Label className="text-xs" htmlFor="a-signatur">Signatur</Label>
          <Textarea id="a-signatur" value={werte.signature || ''} onChange={e => setze('signature', e.target.value)}
            rows={5} className="mt-1 text-sm resize-none" disabled={!darfSchreiben}
            placeholder={'Produktion Sprachlos\nTelefon 0123 456789'} />
        </div>
        <div>
          <Label className="text-xs" htmlFor="a-fuss">Hinweis im Fuß</Label>
          <Input id="a-fuss" value={werte.footer_note || ''} onChange={e => setze('footer_note', e.target.value)}
            className="mt-1 h-8 text-sm" disabled={!darfSchreiben}
            placeholder="Diese Mail enthält Drehunterlagen und ist nicht für Dritte bestimmt." />
        </div>
        {darfSchreiben && (
          <Button size="sm" onClick={() => speichern.mutate()} disabled={speichern.isPending}>Speichern</Button>
        )}
      </CardContent>
    </Card>
  )
}
