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
import { useT, useGebietsschema } from '@/lib/useT'
import { uiT, type Lang } from '@/lib/i18n'
import { emailCenterT as ec } from '@/lib/texte/EmailCenter'

/** Lesbare Beschriftung für den Zustand einer Mail im Postausgang. */
const STATUS_TEXT: Record<string, { label: Record<Lang, string>; klasse: string }> = {
  wartet:         { label: ec.statusWartet, klasse: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  gesendet:       { label: ec.statusGesendet, klasse: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  fehlgeschlagen: { label: ec.statusFehlgeschlagen, klasse: 'bg-destructive/15 text-destructive' },
  ohne_versand:   { label: ec.statusOhneVersand, klasse: 'bg-muted text-muted-foreground' },
}

const REGEL_TEXT: Record<string, Record<Lang, string>> = {
  manuell: ec.regelManuell,
  crew_alle: ec.regelCrewAlle,
  crew_abteilung: ec.regelCrewAbteilung,
  cast_alle: ec.regelCastAlle,
  komparsen: ec.regelKomparsen,
  mitglieder: ec.regelMitglieder,
  drehtag: ec.regelDrehtag,
}

function zeit(wert: string | null, gebietsschema: string) {
  if (!wert) return ''
  return new Date(wert).toLocaleString(gebietsschema, {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const { toast } = useToast()
  const qc = useQueryClient()
  const { darfSchreiben } = useSchreibrecht()
  const tt = useT()
  const gs = useGebietsschema()

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
    const stab = (crew || []).filter((c: any) => c.email).map((c: any) => ({ email: c.email, name: c.name, gruppe: c.department || tt(ec.gruppeStab) }))
    const besetzung = (cast || []).filter((c: any) => c.email).map((c: any) => ({ email: c.email, name: c.actor_name, gruppe: tt(ec.gruppeBesetzung) }))
    return [...stab, ...besetzung]
  }, [crew, cast, tt])

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
        toast({ title: tt(ec.eingeplant).replace('{n}', String(ergebnis.queued)), description: tt(ec.versandAm).replace('{zeit}', zeit(ergebnis.scheduled_for, gs)) })
      } else {
        const teile = [tt(ec.versendet).replace('{n}', String(ergebnis.sent))]
        if (ergebnis.queued) teile.push(tt(ec.warteschlange).replace('{n}', String(ergebnis.queued)))
        if (ergebnis.ohne_versand) teile.push(tt(ec.ohneMailserver).replace('{n}', String(ergebnis.ohne_versand)))
        toast({ title: teile.join(', ') })
      }
      setText('')
      setBetreff('')
      setAusgewaehlt(new Set())
      setZeitpunkt('')
    },
    onError: (fehler: any) => toast({ title: tt(ec.versandAbgelehnt), description: fehler.message, variant: 'destructive' }),
  })

  const test = useMutation({
    mutationFn: () => api.emailSend.test(pid),
    onSuccess: (ergebnis: any) => {
      qc.invalidateQueries({ queryKey: ['email-outbox', pid] })
      toast({
        title: ergebnis.sent > 0 ? tt(ec.testRaus) : tt(ec.nichtsVersendet),
        description: ergebnis.sent > 0 ? tt(ec.schauPostfach) : tt(ec.keinServerSatz),
      })
    },
  })

  const erneut = useMutation({
    mutationFn: (id: number) => api.emailSend.retry(pid, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-outbox', pid] })
      toast({ title: tt(ec.erneutWarteschlange) })
    },
  })

  const zurueckziehen = useMutation({
    mutationFn: (id: number) => api.emailSend.withdraw(pid, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-outbox', pid] })
      toast({ title: tt(ec.zurueckgezogen) })
    },
  })

  const vorlageEinsetzen = (vorlage: any) => {
    setBetreff(vorlage.subject)
    setText(vorlage.body)
    toast({ title: tt(ec.vorlageUebernommen).replace('{name}', vorlage.name), description: tt(ec.platzhalterGefuellt) })
  }

  const empfaengerAnzahl = verteilerId
    ? (verteiler || []).find((v: any) => String(v.id) === verteilerId)?.anzahl ?? 0
    : gewaehlteAdressen.length

  return (
    <div className="px-5 py-6 sm:p-6 max-w-6xl mx-auto space-y-4">
      <PageHeader
        title={tt(ec.titel)}
        subtitle={tt(ec.untertitel)}
      />

      {!eingerichtet && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 py-4 text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="font-medium">{tt(ec.keinMailserver)}</p>
              <p className="text-muted-foreground mt-1">
                {tt(ec.keinMailserverText)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="verfassen">
        <TabsList data-einfuehrung="reiter">
          <TabsTrigger value="verfassen"><PenLine className="w-3.5 h-3.5 mr-1.5" />{tt(ec.tabVerfassen)}</TabsTrigger>
          <TabsTrigger value="vorlagen"><FileText className="w-3.5 h-3.5 mr-1.5" />{tt(ec.tabVorlagen)}</TabsTrigger>
          <TabsTrigger value="verteiler"><Users className="w-3.5 h-3.5 mr-1.5" />{tt(ec.tabVerteiler)}</TabsTrigger>
          <TabsTrigger value="postausgang"><Inbox className="w-3.5 h-3.5 mr-1.5" />{tt(ec.tabPostausgang)}</TabsTrigger>
          <TabsTrigger value="absender"><Mail className="w-3.5 h-3.5 mr-1.5" />{tt(ec.tabAbsender)}</TabsTrigger>
        </TabsList>

        {/* ── Verfassen ───────────────────────────────────────────────────── */}
        <TabsContent value="verfassen" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1 space-y-3">
              <Card>
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="text-sm flex items-center justify-between">
                    {tt(ec.empfaenger)}
                    <Badge variant="secondary">{empfaengerAnzahl}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs">{tt(ec.verteiler)}</Label>
                    <Select value={verteilerId || 'keiner'} onValueChange={v => setVerteilerId(v === 'keiner' ? '' : v)}>
                      <SelectTrigger className="h-8 text-xs mt-1">
                        <SelectValue placeholder={tt(ec.einzelnAuswaehlen)} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="keiner">{tt(ec.einzelnAuswaehlen)}</SelectItem>
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
                            aria-label={tt(ec.gruppeAuswaehlen).replace('{gruppe}', gruppe)}
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
                          {tt(ec.niemandAdresse)}
                        </p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {status && (
                <Card>
                  <CardContent className="py-3 text-xs text-muted-foreground space-y-1">
                    <p>{tt(ec.letzteStunde).replace('{n}', String(status.verbraucht_letzte_stunde)).replace('{max}', String(status.limit_pro_stunde))}</p>
                    {status.wartend > 0 && <p>{tt(ec.wartenVersand).replace('{n}', String(status.wartend))}</p>}
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="lg:col-span-2 space-y-3">
              {(vorlagen || []).length > 0 && (
                <Card>
                  <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">{tt(ec.vorlageUebernehmen)}</CardTitle></CardHeader>
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
                <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">{tt(ec.nachricht)}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs" htmlFor="betreff">{tt(ec.betreff)}</Label>
                    <Input id="betreff" value={betreff} onChange={e => setBetreff(e.target.value)}
                      className="mt-1 h-8 text-sm" placeholder={tt(ec.betreff)} />
                  </div>
                  <div>
                    <Label className="text-xs" htmlFor="nachricht">{tt(ec.text)}</Label>
                    <Textarea id="nachricht" value={text} onChange={e => setText(e.target.value)}
                      rows={12} className="mt-1 text-sm resize-none" placeholder={tt(ec.textPlatzhalter)} />
                    <p className="text-xs text-muted-foreground mt-1">
                      {tt(ec.platzhalterHinweis)}
                      {' '}
                      {(status?.platzhalter || []).slice(0, 6).map((p: any) => `{{${p.schluessel}}}`).join(', ')}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs" htmlFor="zeitpunkt">{tt(ec.spaeterSenden)}</Label>
                      <Input id="zeitpunkt" type="datetime-local" value={zeitpunkt}
                        onChange={e => setZeitpunkt(e.target.value)} className="mt-1 h-8 text-sm" />
                    </div>
                    <label className="flex items-center gap-2 text-xs mt-5 cursor-pointer">
                      <Checkbox checked={mitQuittung} onCheckedChange={v => setMitQuittung(!!v)} className="h-3.5 w-3.5" />
                      {tt(ec.empfangBestaetigen)}
                    </label>
                  </div>

                  <div className="flex gap-2 pt-1 flex-wrap">
                    <Button
                      size="sm"
                      disabled={!darfSchreiben || senden.isPending || empfaengerAnzahl === 0 || !betreff.trim() || !text.trim()}
                      onClick={() => senden.mutate()}
                    >
                      {zeitpunkt ? <Clock className="w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                      {zeitpunkt ? tt(ec.einplanen) : tt(ec.anSenden).replace('{n}', String(empfaengerAnzahl))}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => test.mutate()} disabled={test.isPending}>
                      {tt(ec.testAnMich)}
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
                {tt(ec.tabPostausgang)}
                {(postausgang?.nach_status || []).map((s: any) => (
                  <Badge key={s.status} variant="secondary" className="text-xs font-normal">
                    {STATUS_TEXT[s.status] ? tt(STATUS_TEXT[s.status].label) : s.status}: {s.anzahl}
                  </Badge>
                ))}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(postausgang?.mails || []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  {tt(ec.postausgangLeer)}
                </p>
              ) : (
                <div className="space-y-1">
                  {(postausgang?.mails || []).map((mail: any) => (
                    <div key={mail.id} className="flex items-start gap-3 py-2 border-b border-border/60 last:border-0 text-sm">
                      <span className={`px-2 py-0.5 rounded text-xs shrink-0 mt-0.5 ${STATUS_TEXT[mail.status]?.klasse || ''}`}>
                        {STATUS_TEXT[mail.status] ? tt(STATUS_TEXT[mail.status].label) : mail.status}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{mail.subject}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {mail.recipient_name ? `${mail.recipient_name} · ` : ''}{mail.recipient_email}
                          {mail.sent_at ? ` · ${zeit(mail.sent_at, gs)}` : mail.scheduled_for ? ` · ${tt(ec.geplant).replace('{zeit}', zeit(mail.scheduled_for, gs))}` : ''}
                          {mail.read_at ? ` · ${tt(ec.empfangBestaetigt)}` : ''}
                        </p>
                        {mail.last_error && (
                          <p className="text-xs text-destructive mt-0.5 break-words">{mail.last_error}</p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {mail.read_at && <Check className="w-4 h-4 text-emerald-500 mt-1" aria-label={tt(ec.empfangBestaetigt)} />}
                        {(mail.status === 'fehlgeschlagen' || mail.status === 'ohne_versand') && darfSchreiben && (
                          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => erneut.mutate(mail.id)}>
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />{tt(ec.erneut)}
                          </Button>
                        )}
                        {mail.status === 'wartet' && darfSchreiben && (
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => zurueckziehen.mutate(mail.id)}
                            aria-label={tt(ec.zurueckziehenAn).replace('{name}', mail.recipient_name || mail.recipient_email)}>
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
  const tt = useT()

  const speichern = useMutation({
    mutationFn: (id: number | null) =>
      id ? api.emailSend.updateTemplate(pid, id, entwurf) : api.emailSend.createTemplate(pid, entwurf),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-templates', pid] })
      setOffen(null)
      toast({ title: tt(ec.vorlageGespeichert) })
    },
  })

  const loeschen = useMutation({
    mutationFn: (id: number) => api.emailSend.deleteTemplate(pid, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-templates', pid] })
      toast({ title: tt(ec.vorlageGeloescht) })
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
          <CardTitle className="text-sm">{tt(ec.tabVorlagen)}</CardTitle>
          {darfSchreiben && (
            <Button variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => { setOffen(0); setEntwurf({ name: '', subject: '', body: '' }) }}>
              <Plus className="w-3.5 h-3.5 mr-1" />{tt(ec.neu)}
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
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => zeigeVorschau.mutate(v.id)}
                aria-label={tt(ec.vorschauVon).replace('{name}', v.name)}>
                <Eye className="w-3.5 h-3.5" />
              </Button>
              {darfSchreiben && (
                <>
                  <Button variant="ghost" size="sm" className="h-7 px-2"
                    aria-label={tt(ec.bearbeitenVon).replace('{name}', v.name)}
                    onClick={() => { setOffen(v.id); setEntwurf({ name: v.name, subject: v.subject, body: v.body }) }}>
                    <PenLine className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive"
                    aria-label={tt(ec.loeschenVon).replace('{name}', v.name)}
                    onClick={() => { if (confirm(tt(ec.loeschenFrage).replace('{name}', v.name))) loeschen.mutate(v.id) }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
            </div>
          ))}
          {vorlagen.length === 0 && <p className="text-sm text-muted-foreground py-4">{tt(ec.keineVorlage)}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-sm">{offen !== null ? tt(ec.vorlageBearbeiten) : tt(ec.vorschau)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {offen !== null ? (
            <>
              <div>
                <Label className="text-xs" htmlFor="v-name">{tt(uiT.name)}</Label>
                <Input id="v-name" value={entwurf.name} onChange={e => setEntwurf({ ...entwurf, name: e.target.value })}
                  className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs" htmlFor="v-betreff">{tt(ec.betreff)}</Label>
                <Input id="v-betreff" value={entwurf.subject} onChange={e => setEntwurf({ ...entwurf, subject: e.target.value })}
                  className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs" htmlFor="v-text">{tt(ec.text)}</Label>
                <Textarea id="v-text" value={entwurf.body} onChange={e => setEntwurf({ ...entwurf, body: e.target.value })}
                  rows={10} className="mt-1 text-sm resize-none" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => speichern.mutate(offen || null)} disabled={!entwurf.name.trim()}>
                  {tt(uiT.save)}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setOffen(null)}>{tt(uiT.cancel)}</Button>
              </div>
            </>
          ) : vorschau ? (
            <>
              <p className="text-sm font-medium">{vorschau.subject}</p>
              <Separator />
              <div className="text-sm [&_p]:mb-2" dangerouslySetInnerHTML={{ __html: vorschau.html }} />
              <p className="text-xs text-muted-foreground">
                {tt(ec.beispielwerte)}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-4">
              {tt(ec.waehleVorlage)}
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
  const tt = useT()

  const abteilungen = useMemo(
    () => Array.from(new Set((crew || []).map((c: any) => c.department).filter(Boolean))) as string[],
    [crew]
  )

  const anlegen = useMutation({
    mutationFn: () => api.emailSend.createGroup(pid, { name, rule: regel, parameter }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-groups', pid] })
      setName('')
      toast({ title: tt(ec.verteilerAngelegt) })
    },
  })

  const loeschen = useMutation({
    mutationFn: (id: number) => api.emailSend.deleteGroup(pid, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-groups', pid] })
      toast({ title: tt(ec.verteilerGeloescht) })
    },
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">{tt(ec.tabVerteiler)}</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {verteiler.map(v => (
            <div key={v.id} className="flex items-center gap-2 py-1.5 border-b border-border/60 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{v.name}</p>
                <p className="text-xs text-muted-foreground">
                  {REGEL_TEXT[v.rule] ? tt(REGEL_TEXT[v.rule]) : v.rule}{v.parameter ? ` · ${v.parameter}` : ''} · {tt(ec.adressen).replace('{n}', String(v.anzahl))}
                </p>
              </div>
              {darfSchreiben && (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive"
                  aria-label={tt(ec.loeschenVon).replace('{name}', v.name)}
                  onClick={() => { if (confirm(tt(ec.loeschenFrage).replace('{name}', v.name))) loeschen.mutate(v.id) }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          ))}
          {verteiler.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">
              {tt(ec.keinVerteiler)}
            </p>
          )}
        </CardContent>
      </Card>

      {darfSchreiben && (
        <Card>
          <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">{tt(ec.neuerVerteiler)}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs" htmlFor="g-name">{tt(uiT.name)}</Label>
              <Input id="g-name" value={name} onChange={e => setName(e.target.value)}
                className="mt-1 h-8 text-sm" placeholder={tt(ec.teamPlatzhalter)} />
            </div>
            <div>
              <Label className="text-xs">{tt(ec.werGehoert)}</Label>
              <Select value={regel} onValueChange={setRegel}>
                <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(REGEL_TEXT).filter(([k]) => k !== 'manuell' && k !== 'drehtag').map(([k, label]) => (
                    <SelectItem key={k} value={k}>{tt(label)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {regel === 'crew_abteilung' && (
              <div>
                <Label className="text-xs">{tt(ec.abteilung)}</Label>
                <Select value={parameter} onValueChange={setParameter}>
                  <SelectTrigger className="h-8 text-sm mt-1"><SelectValue placeholder={tt(ec.abteilungWaehlen)} /></SelectTrigger>
                  <SelectContent>
                    {abteilungen.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button size="sm" onClick={() => anlegen.mutate()}
              disabled={!name.trim() || (regel === 'crew_abteilung' && !parameter)}>
              {tt(ec.anlegen)}
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
  const tt = useT()

  const speichern = useMutation({
    mutationFn: () => api.emailSend.saveIdentity(pid, werte),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-identity', pid] })
      toast({ title: tt(ec.absenderGespeichert) })
    },
    onError: (fehler: any) => toast({ title: tt(ec.nichtGespeichert), description: fehler.message, variant: 'destructive' }),
  })

  const setze = (feld: string, wert: string) => setEntwurf({ ...werte, [feld]: wert })

  return (
    <Card className="max-w-2xl">
      <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">{tt(ec.absenderSignatur)}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs" htmlFor="a-name">{tt(ec.absendername)}</Label>
          <Input id="a-name" value={werte.sender_name || ''} onChange={e => setze('sender_name', e.target.value)}
            className="mt-1 h-8 text-sm" placeholder={tt(ec.absenderPlatzhalter)} disabled={!darfSchreiben} />
          <p className="text-xs text-muted-foreground mt-1">
            {tt(ec.absendernameHinweis)}
          </p>
        </div>
        <div>
          <Label className="text-xs" htmlFor="a-antwort">{tt(ec.antwortadresse)}</Label>
          <Input id="a-antwort" type="email" value={werte.reply_to || ''} onChange={e => setze('reply_to', e.target.value)}
            className="mt-1 h-8 text-sm" placeholder={tt(ec.antwortPlatzhalter)} disabled={!darfSchreiben} />
          <p className="text-xs text-muted-foreground mt-1">
            {tt(ec.antwortHinweis)}
          </p>
        </div>
        <div>
          <Label className="text-xs" htmlFor="a-signatur">{tt(ec.signatur)}</Label>
          <Textarea id="a-signatur" value={werte.signature || ''} onChange={e => setze('signature', e.target.value)}
            rows={5} className="mt-1 text-sm resize-none" disabled={!darfSchreiben}
            placeholder={tt(ec.signaturPlatzhalter)} />
        </div>
        <div>
          <Label className="text-xs" htmlFor="a-fuss">{tt(ec.hinweisFuss)}</Label>
          <Input id="a-fuss" value={werte.footer_note || ''} onChange={e => setze('footer_note', e.target.value)}
            className="mt-1 h-8 text-sm" disabled={!darfSchreiben}
            placeholder={tt(ec.fussPlatzhalter)} />
        </div>
        {darfSchreiben && (
          <Button size="sm" onClick={() => speichern.mutate()} disabled={speichern.isPending}>{tt(uiT.save)}</Button>
        )}
      </CardContent>
    </Card>
  )
}
