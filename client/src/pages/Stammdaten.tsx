import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { debounce, formatDate, cn } from '@/lib/utils'
import { ALL_FORMATS } from '@/lib/projectKind'
import { Film, Calendar, Building2, Check, Settings2, Link2, Plus, Trash2, Copy, Users, QrCode, Send, Clock } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { TimeInput } from '@/components/ui/time-input'
import { useAuth } from '@/contexts/AuthContext'
import { useProjectPerms } from '@/contexts/ProjectRoleContext'
import { Button } from '@/components/ui/button'
import { useT, useGebietsschema } from '@/lib/useT'
import { masterT, navT, projectsT } from '@/lib/i18n'
import { onboardingFormatT } from '@/lib/texte/komponenten/OnboardingWizard'
import { BUNDESLAENDER } from '@/lib/texte/Bundeslaender'
import { arbeitszeitT as AZ } from '@/lib/texte/Arbeitszeit'
import { useSchreibrecht } from '@/lib/useSchreibrecht'

const FORMATS = ALL_FORMATS
const STATUSES = ['Entwicklung', 'Vorproduktion', 'Produktion', 'Postproduktion', 'Abgeschlossen', 'Archiviert']
const WAEHRUNGEN = ['EUR', 'USD', 'GBP', 'CHF']

function FormSection({ icon: Icon, title, anker, children }: { icon: any; title: string; anker?: string; children: React.ReactNode }) {
  return (
    <div data-einfuehrung={anker} className="bg-card border border-border/60 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-5">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {children}
      </div>
    </div>
  )
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  )
}

const ROLLEN = ['read_only', 'dept_head', 'director', 'producer', 'admin'] as const

/**
 * Einladungen und Mitglieder. Einladungen sehen und anlegen, Mitglieder
 * entfernen darf der Server nur Projekt-Admins (`ROUTE_OVERRIDES`, `isProjectOwner`).
 * Gemessen am 01.11.2026 mit einem Produktionskonto: Der Abschnitt stand offen,
 * zeigte "Keine aktiven Einladungen", obwohl es eine gab (Antwort 403), und
 * "Link erstellen" war anklickbar. Die Mitgliederliste dürfen alle lesen.
 */
function InviteSection({ pid }: { pid: number }) {
  const { canAdmin } = useProjectPerms()
  const tt = useT()
  const qc = useQueryClient()
  const { toast } = useToast()
  const { user } = useAuth()
  const [newRole, setNewRole] = useState('read_only')
  const [newLabel, setNewLabel] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [copied, setCopied] = useState<number | null>(null)
  const [qrOpen, setQrOpen] = useState<string | null>(null)

  const { data: invites = [], isLoading: invLoading } = useQuery({
    queryKey: ['invites', pid],
    queryFn: () => api.invites.list(pid),
    enabled: canAdmin,
    retry: false,
  })
  const { data: members = [] } = useQuery({
    queryKey: ['members', pid],
    queryFn: () => api.members.list(pid),
    retry: false,
  })

  const createMutation = useMutation({
    mutationFn: () => api.invites.create(pid, { role: newRole, label: newLabel, email: newEmail }),
    onSuccess: (inv: any) => {
      qc.invalidateQueries({ queryKey: ['invites', pid] })
      setNewLabel('')
      setNewEmail('')
      if (newEmail) {
        toast(inv?.email_sent
          ? { title: tt(masterT.versendet).replace('{email}', newEmail) }
          : { title: tt(masterT.linkErstellt), description: tt(masterT.keinMailserver) })
      }
    },
    onError: (e: any) => toast({ variant: 'destructive', title: e.message }),
  })
  /**
   * Einladung noch einmal schicken. Die Route gab es, einen Knopf nicht -
   * nachgezählt am 26.09.2026. Eine Einladung landet oft im Spam, und der
   * einzige Ausweg war bisher: löschen, neu anlegen, neuen Link schicken.
   */
  const erneutSenden = useMutation({
    mutationFn: (id: number) => api.invites.resend(pid, id),
    onSuccess: (_d, id) => {
      const inv = (invites as any[]).find((i: any) => i.id === id)
      qc.invalidateQueries({ queryKey: ['invites', pid] })
      toast({ title: inv?.email ? tt(masterT.erneutAn).replace('{email}', inv.email) : tt(masterT.erneut) })
    },
    onError: (e: any) => toast({ variant: 'destructive', title: tt(masterT.nichtGesendet), description: e.message }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.invites.delete(pid, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites', pid] }),
  })
  const removeMemberMutation = useMutation({
    mutationFn: (userId: number) => api.members.remove(pid, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members', pid] }),
  })
  // Entfernen ging bisher mit einem Klick auf ein blasses Mülleimer-Symbol,
  // ohne Rückfrage - wer danach wieder rein soll, braucht eine neue Einladung.
  const mitgliedEntfernen = (m: any) => {
    if (!window.confirm(tt(masterT.entfernenFrage).replace('{name}', m.name || m.email))) return
    removeMemberMutation.mutate(m.user_id)
  }

  const inviteUrl = (token: string) => `${window.location.origin}/invite/${token}`

  const copyLink = (id: number, token: string) => {
    navigator.clipboard.writeText(inviteUrl(token))
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const roleLabel = (r: string) => (navT.roles as Record<string, any>)[r] ? tt((navT.roles as Record<string, any>)[r]) : r

  return (
    <div data-einfuehrung="team" className="bg-card border border-border/60 rounded-xl overflow-hidden">
      {canAdmin && (
        <>
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border/60">
            <Link2 className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">{tt(masterT.einladen)}</h2>
          </div>

          {/* Create new invite */}
          <div className="p-5 border-b border-border/60">
            <p className="text-xs text-muted-foreground mb-3">{tt(masterT.einladenText)}</p>
            <div className="flex gap-2 flex-wrap">
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger className="h-8 w-44 text-xs" aria-label={tt(masterT.inviteRole)}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLLEN.map(r => <SelectItem key={r} value={r} className="text-xs">{roleLabel(r)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                className="h-8 text-xs flex-1 min-w-32"
                aria-label={tt(masterT.beschriftung)}
                placeholder={tt(masterT.phBeschriftung)}
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
              />
              <Input
                type="email"
                className="h-8 text-xs flex-1 min-w-40"
                aria-label={tt(masterT.emailFeld)}
                placeholder={tt(masterT.phEmail)}
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
              />
              <Button size="sm" className="h-8 text-xs" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                <Plus className="w-3.5 h-3.5 mr-1" /> {tt(masterT.createInvite)}
              </Button>
            </div>
          </div>

          {/* Existing invite links */}
          {invLoading ? (
            <div className="p-5 text-xs text-muted-foreground">{tt(masterT.laedt)}</div>
          ) : (invites as any[]).length === 0 ? (
            <div className="p-5 text-xs text-muted-foreground text-center py-8">{tt(masterT.noInvites)}</div>
          ) : (
            <div className="divide-y divide-border/40">
              {(invites as any[]).map((inv: any) => (
                <div key={inv.id} className="relative flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium">{roleLabel(inv.role)}</span>
                      {inv.label && <span className="text-xs text-muted-foreground italic">- {inv.label}</span>}
                      {inv.email && (
                        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                          inv.email_sent_at ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground')}>
                          {inv.email_sent_at ? `✓ ${inv.email}` : inv.email}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">{inviteUrl(inv.token)}</p>
                  </div>
                  <button
                    onClick={() => copyLink(inv.id, inv.token)}
                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title={tt(masterT.copyLink)}
                  >
                    {copied === inv.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => setQrOpen(qrOpen === inv.token ? null : inv.token)}
                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title={tt(masterT.showQr)}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                  </button>
                  {qrOpen === inv.token && (
                    <div className="absolute right-0 top-full mt-1 z-10 bg-background border border-border rounded-xl p-3 shadow-lg">
                      <QRCodeSVG value={inviteUrl(inv.token)} size={140} />
                      <p className="text-[10px] text-muted-foreground text-center mt-2">{roleLabel(inv.role)}</p>
                    </div>
                  )}
                  {inv.email && (
                    <button
                      onClick={() => erneutSenden.mutate(inv.id)}
                      disabled={erneutSenden.isPending}
                      className="shrink-0 w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                      title={tt(masterT.erneutSenden)}
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => deleteMutation.mutate(inv.id)}
                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                    title={tt(masterT.deleteInvite)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Members */}
      {(members as any[]).length > 0 && (
        <div className={canAdmin ? 'border-t border-border/60' : ''}>
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border/40">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{tt(masterT.mitglieder)}</span>
          </div>
          <div className="divide-y divide-border/40">
            {(members as any[]).map((m: any) => (
              <div key={m.user_id ?? m.id} className="flex items-center gap-3 px-5 py-2.5">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{m.name || m.email}</span>
                  <span className="text-xs text-muted-foreground ml-2">{m.email}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{roleLabel(m.role)}</span>
                {canAdmin && m.user_id !== user?.id && (
                  <button
                    onClick={() => mitgliedEntfernen(m)}
                    className="shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground/40 hover:text-destructive transition-colors"
                    title={tt(masterT.removeMember)}
                    aria-label={`${tt(masterT.removeMember)}: ${m.name || m.email}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function Component() {
  const { darfSchreiben } = useSchreibrecht()
  const { canAdmin } = useProjectPerms()
  const tt = useT()
  const { projectId } = useParams()
  const pid = Number(projectId)
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [saved, setSaved] = useState(false)
  const [formData, setFormData] = useState<any>(null)

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', pid],
    queryFn: () => api.projects.get(pid),
  })

  useEffect(() => {
    if (project && !formData) {
      setFormData({ ...project })
    }
  }, [project])

  const gespeichert = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const mutation = useMutation({
    mutationFn: (data: any) => api.projects.update(pid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', pid] })
      // Titel, Status und Format stehen auch in der Projektliste. Gemessen am
      // 01.11.2026: 4,8 s nach dem Umbenennen zeigte sie noch den alten Titel.
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      gespeichert()
    },
    // Der Server sagt, was nicht stimmt (Laufzeit, Drehzeitraum) - das steht in der Meldung
    onError: (e: any) => toast({ title: tt(masterT.speicherFehler), description: e?.message, variant: 'destructive' }),
  })

  const debouncedSave = useRef(debounce((data: any) => mutation.mutate(data), 600)).current
  const update = (key: string, value: any) => {
    const next = { ...formData, [key]: value }
    setFormData(next)
    // Ein Datumsfeld meldet beim Tippen der Jahreszahl "0002-…", "0020-…" -
    // erst ein vollständiges Jahr wird gespeichert (der Server prüft es auch)
    if ((key === 'shoot_start' || key === 'shoot_end') && value) {
      const jahr = Number(String(value).slice(0, 4))
      if (!(jahr >= 1900 && jahr <= 2200)) return
    }
    debouncedSave(next)
  }

  const [settingsData, setSettingsData] = useState<any>(null)
  useEffect(() => {
    if (project?.settings && !settingsData) setSettingsData({ ...project.settings })
  }, [project])

  // Die Antwort wird nicht ins Formular zurückgeschrieben: Kam sie, während
  // weiter getippt wurde, sprang das Feld auf den älteren Stand zurück -
  // gemessen am 01.11.2026, "Österr" wurde wieder "Ös".
  const settingsMutation = useMutation({
    mutationFn: (data: any) => api.projects.updateSettings(pid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', pid] })
      gespeichert()
    },
    // Seit dem 14.11.2026 prüft der Server Arbeitstage und Bundesland. Ohne
    // diese Zeile wäre eine Ablehnung still geblieben (Falle "Stille Antworten").
    onError: (e: any) => toast({ title: tt(masterT.speicherFehler), description: e?.message, variant: 'destructive' }),
  })
  const gebietsschema = useGebietsschema()
  // Wochentage nach ISO, Montag 1. Die Namen aus dem 16.11.2026, einem Montag.
  const wochentagName = (i: number) =>
    new Date(Date.UTC(2026, 10, 15 + i, 12)).toLocaleDateString(gebietsschema, { weekday: 'short', timeZone: 'UTC' })
  const arbeitstage = new Set(String(settingsData?.work_weekdays ?? '1,2,3,4,5').split(',').map(Number))
  const arbeitstagUmschalten = (i: number) => {
    const neu = new Set(arbeitstage)
    if (neu.has(i)) neu.delete(i)
    else neu.add(i)
    // Mindestens ein Arbeitstag bleibt - so verlangt es auch der Server
    if (neu.size === 0) return
    updateSetting('work_weekdays', [...neu].sort((a, b) => a - b).join(','))
  }
  const debouncedSettingsSave = useRef(debounce((data: any) => settingsMutation.mutate(data), 600)).current
  const updateSetting = (key: string, value: any) => {
    const next = { ...settingsData, [key]: value }
    setSettingsData(next)
    debouncedSettingsSave(next)
  }

  if (isLoading || !formData) {
    return (
      <div className="px-5 py-6 sm:p-7 max-w-3xl mx-auto">
        <div className="h-7 w-48 bg-muted animate-pulse rounded mb-6" />
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />)}
        </div>
      </div>
    )
  }

  const shootDays = formData.shoot_start && formData.shoot_end
    ? Math.ceil((new Date(formData.shoot_end).getTime() - new Date(formData.shoot_start).getTime()) / 86400000) + 1
    : null
  const formatName = (f: string) => onboardingFormatT[f] ? tt(onboardingFormatT[f]) : f
  const statusName = (s: string) => projectsT.status[s] ? tt(projectsT.status[s]) : s

  return (
    <div className="px-5 py-6 sm:p-7 max-w-3xl mx-auto animate-fade-up space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-7">
        <div>
          <h1 className="font-display text-[28px] sm:text-[34px]">{tt(masterT.title)}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{tt(masterT.untertitel)}</p>
        </div>
        <div className={cn(
          'flex items-center gap-1.5 text-xs transition-all',
          saved ? 'text-green-400' : 'text-muted-foreground/40'
        )}>
          <Check className="w-3.5 h-3.5" />
          {saved ? tt(masterT.gespeichert) : tt(masterT.autoGespeichert)}
        </div>
      </div>

      <FormSection icon={Film} title={tt(masterT.basisdaten)} anker="basisdaten">
        <Field label={tt(masterT.labelTitle)} full>
          <Input disabled={!darfSchreiben} value={formData.title || ''} onChange={e => update('title', e.target.value)}
            aria-label={tt(masterT.labelTitle)} placeholder={tt(masterT.phTitel)} className="h-9 text-base font-medium" />
        </Field>
        <Field label={tt(masterT.labelFormat)}>
          <Select value={formData.format || 'Kurzfilm'} onValueChange={v => update('format', v)} disabled={!darfSchreiben}>
            <SelectTrigger className="h-9" aria-label={tt(masterT.labelFormat)}><SelectValue /></SelectTrigger>
            <SelectContent>{FORMATS.map(f => <SelectItem key={f} value={f}>{formatName(f)}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label={tt(masterT.labelStatus)}>
          <Select value={formData.status || 'Vorproduktion'} onValueChange={v => update('status', v)} disabled={!darfSchreiben}>
            <SelectTrigger className="h-9" aria-label={tt(masterT.labelStatus)}><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{statusName(s)}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label={tt(masterT.labelGenre)}>
          <Input disabled={!darfSchreiben} value={formData.genre || ''} onChange={e => update('genre', e.target.value)}
            aria-label={tt(masterT.labelGenre)} placeholder={tt(masterT.phGenre)} className="h-9" />
        </Field>
        <Field label={tt(masterT.labelMinutes)}>
          <Input disabled={!darfSchreiben} type="number" min={0} max={10000} value={formData.length_minutes || ''}
            onChange={e => update('length_minutes', Number(e.target.value))}
            aria-label={tt(masterT.labelMinutes)} placeholder={tt(masterT.phMinuten)} className="h-9" />
        </Field>
        <Field label={tt(masterT.labelSynopsis)} full>
          <Textarea disabled={!darfSchreiben} value={formData.synopsis || ''} onChange={e => update('synopsis', e.target.value)}
            aria-label={tt(masterT.labelSynopsis)} rows={3} className="resize-none text-sm" placeholder={tt(masterT.phSynopsis)} />
        </Field>
      </FormSection>

      <FormSection icon={Building2} title={tt(masterT.kreativteam)} anker="kreativteam">
        <Field label={tt(masterT.regie)}>
          <Input disabled={!darfSchreiben} value={formData.director || ''} onChange={e => update('director', e.target.value)}
            aria-label={tt(masterT.regie)} placeholder={tt(masterT.phRegie)} className="h-9" />
        </Field>
        <Field label={tt(masterT.produktion)}>
          <Input disabled={!darfSchreiben} value={formData.producer || ''} onChange={e => update('producer', e.target.value)}
            aria-label={tt(masterT.produktion)} placeholder={tt(masterT.phProduktion)} className="h-9" />
        </Field>
        <Field label={tt(masterT.kamera)}>
          <Input disabled={!darfSchreiben} value={formData.dop || ''} onChange={e => update('dop', e.target.value)}
            aria-label={tt(masterT.kamera)} placeholder={tt(masterT.phKamera)} className="h-9" />
        </Field>
        <Field label={tt(masterT.firma)}>
          <Input disabled={!darfSchreiben} value={formData.production_company || ''} onChange={e => update('production_company', e.target.value)}
            aria-label={tt(masterT.firma)} placeholder={tt(masterT.phFirma)} className="h-9" />
        </Field>
      </FormSection>

      <FormSection icon={Calendar} title={tt(masterT.zeitraum)} anker="zeitraum">
        <Field label={tt(masterT.drehbeginn)}>
          <Input disabled={!darfSchreiben} type="date" min="1900-01-01" max="2200-12-31" value={formData.shoot_start || ''} onChange={e => update('shoot_start', e.target.value)} aria-label={tt(masterT.drehbeginn)} className="h-9" />
        </Field>
        <Field label={tt(masterT.drehschluss)}>
          <Input disabled={!darfSchreiben} type="date" min={formData.shoot_start || '1900-01-01'} max="2200-12-31" value={formData.shoot_end || ''} onChange={e => update('shoot_end', e.target.value)} aria-label={tt(masterT.drehschluss)} className="h-9" />
        </Field>
        {shootDays !== null && (shootDays > 0 ? (
          <div className="col-span-2 flex items-center gap-3 p-3 bg-primary/8 rounded-lg border border-primary/20">
            <Calendar className="w-4 h-4 text-primary shrink-0" />
            <p className="text-sm text-primary">
              <span className="font-semibold">{tt(masterT.drehtage).replace('{n}', String(shootDays))}</span>
              <span className="text-primary/70"> · {formatDate(formData.shoot_start)} - {formatDate(formData.shoot_end)}</span>
            </p>
          </div>
        ) : (
          // Vorher stand hier eine negative Zahl ("-2 Drehtage" bei drei Tagen Rückstand)
          <p className="col-span-2 text-sm text-destructive">{tt(masterT.endeVorBeginn)}</p>
        ))}
      </FormSection>

      {settingsData && (
        <FormSection icon={Settings2} title={tt(masterT.einstellungen)} anker="grundeinstellungen">
          {/* Der Server nimmt Einstellungen nur von Projekt-Admins an. Vorher
              waren die Felder für alle mit Schreibrecht offen, gespeichert
              wurde nichts (403) - gemessen am 01.11.2026 mit einem Produktionskonto. */}
          {!canAdmin && <p className="col-span-2 text-xs text-muted-foreground">{tt(masterT.nurAdmins)}</p>}
          <Field label={tt(masterT.labelDefaultCall)}>
            <TimeInput disabled={!canAdmin}
              value={settingsData.default_call_time}
              onChange={v => updateSetting('default_call_time', v)}
              label={tt(masterT.labelDefaultCall)}
              className="h-9 w-full"
            />
          </Field>
          <Field label={tt(masterT.wrap)}>
            <TimeInput disabled={!canAdmin}
              value={settingsData.default_wrap_time}
              onChange={v => updateSetting('default_wrap_time', v)}
              label={tt(masterT.wrap)}
              className="h-9 w-full"
            />
          </Field>
          <Field label={tt(masterT.turnaround)}>
            <Input disabled={!canAdmin}
              type="number"
              min={8}
              max={24}
              value={settingsData.turnaround_hours ?? 11}
              onChange={e => updateSetting('turnaround_hours', Number(e.target.value))}
              aria-label={tt(masterT.turnaround)}
              className="h-9"
              placeholder="11"
            />
          </Field>
          <Field label={tt(masterT.waehrung)}>
            <Select value={settingsData.currency || 'EUR'} onValueChange={v => updateSetting('currency', v)} disabled={!canAdmin}>
              <SelectTrigger className="h-9" aria-label={tt(masterT.waehrung)}><SelectValue /></SelectTrigger>
              <SelectContent>
                {WAEHRUNGEN.map(w => <SelectItem key={w} value={w}>{tt(masterT.waehrungen[w])}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label={tt(masterT.land)}>
            <Input disabled={!canAdmin}
              value={settingsData.country ?? 'Deutschland'}
              onChange={e => updateSetting('country', e.target.value)}
              aria-label={tt(masterT.land)}
              className="h-9"
              placeholder={tt(masterT.phLand)}
            />
          </Field>
          <Field label={tt(masterT.bundesland)}>
            <Select value={settingsData.state || 'keins'} onValueChange={v => updateSetting('state', v === 'keins' ? '' : v)} disabled={!canAdmin}>
              <SelectTrigger className="h-9" aria-label={tt(masterT.bundesland)}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="keins">{tt(masterT.bundeslandKeins)}</SelectItem>
                {BUNDESLAENDER.map(([kuerzel, name]) => <SelectItem key={kuerzel} value={kuerzel}>{tt(name)}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label={tt(masterT.arbeitstage)}>
            <div className="flex flex-wrap gap-1" role="group" aria-label={tt(masterT.arbeitstage)}>
              {[1, 2, 3, 4, 5, 6, 7].map(i => (
                <button
                  key={i}
                  type="button"
                  disabled={!canAdmin}
                  aria-pressed={arbeitstage.has(i)}
                  aria-label={tt(masterT.arbeitstagName).replace('{tag}', wochentagName(i))}
                  onClick={() => arbeitstagUmschalten(i)}
                  className={`h-9 min-w-[2.5rem] px-2 rounded-md border text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${arbeitstage.has(i) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground'}`}
                >
                  {wochentagName(i)}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">{tt(masterT.arbeitstageHinweis)}</p>
          </Field>
          <Field label={tt(masterT.akzent)}>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={accentOf(settingsData.header_color)}
                onChange={e => updateSetting('header_color', e.target.value)}
                aria-label={tt(masterT.akzentWaehlen)}
                disabled={!canAdmin}
                className="h-9 w-12 rounded cursor-pointer border border-border/60 bg-transparent p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <Input disabled={!canAdmin}
                value={accentOf(settingsData.header_color)}
                onChange={e => updateSetting('header_color', e.target.value)}
                className="h-9 font-mono"
                aria-label={tt(masterT.akzentHex)}
                placeholder="#0071E3"
              />
            </div>
          </Field>
        </FormSection>
      )}

      {/* Arbeitszeit-Prüfung (Plan Kino-Ausbau, AP B3) */}
      {settingsData && (() => {
        let saetze: Record<string, number> = {}
        try { saetze = JSON.parse(settingsData.surcharges || '{}') || {} } catch { saetze = {} }
        const satzSetzen = (art: string, text: string) => {
          const neu = { ...saetze }
          const n = Number(text.replace(',', '.'))
          if (text.trim() === '' || !Number.isFinite(n)) delete neu[art]
          else neu[art] = n
          updateSetting('surcharges', JSON.stringify(neu))
        }
        const tarif = settingsData.worktime_rule === 'tarif'
        return (
          <FormSection icon={Clock} title={tt(AZ.abschnitt)} anker="arbeitszeit">
            <Field label={tt(AZ.regel)}>
              <Select value={settingsData.worktime_rule || 'gesetz'} onValueChange={v => updateSetting('worktime_rule', v)} disabled={!canAdmin}>
                <SelectTrigger className="h-9" aria-label={tt(AZ.regel)}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gesetz">{tt(AZ.gesetz)}</SelectItem>
                  <SelectItem value="tarif">{tt(AZ.tarif)}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={tt(AZ.stundenJeGage)}>
              <Input disabled={!canAdmin} type="number" min={1} max={24}
                value={settingsData.hours_per_day_rate ?? 10}
                onChange={e => updateSetting('hours_per_day_rate', Number(e.target.value))}
                aria-label={tt(AZ.stundenJeGage)} className="h-9" />
              <p className="text-[11px] text-muted-foreground mt-1">{tt(AZ.stundenJeGageHilfe)}</p>
            </Field>
            <Field label={tt(AZ.saetze)} full>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {(['elfte', 'ab_zwoelfte', 'nacht', 'sonntag', 'feiertag'] as const).map(art => (
                  <label key={art} className="text-[11px] text-muted-foreground space-y-1">
                    <span className="block">{tt(AZ[art])}</span>
                    <Input disabled={!canAdmin} inputMode="decimal" placeholder="0"
                      defaultValue={saetze[art] ?? ''}
                      onBlur={e => satzSetzen(art, e.target.value)}
                      aria-label={`${tt(AZ[art])} %`} className="h-9" />
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{tarif ? tt(AZ.tarifHinweis) : tt(AZ.gesetzHinweis)}</p>
            </Field>
            <Field label={tt(AZ.nachtVon)}>
              <TimeInput disabled={!canAdmin} value={settingsData.night_from ?? 1380} onChange={v => updateSetting('night_from', v)} label={tt(AZ.nachtVon)} className="h-9 w-full" />
            </Field>
            <Field label={tt(AZ.nachtBis)}>
              <TimeInput disabled={!canAdmin} value={settingsData.night_to ?? 360} onChange={v => updateSetting('night_to', v)} label={tt(AZ.nachtBis)} className="h-9 w-full" />
            </Field>
            {/* Beim Tarif die Nachtzeit vorschlagen, nicht still umstellen (Plan) */}
            {tarif && canAdmin && (settingsData.night_from ?? 1380) !== 1320 && (
              <Field label="" full>
                <p className="text-[11px] text-muted-foreground">
                  {tt(AZ.nachtVorschlag)}{' '}
                  <button type="button" className="text-primary hover:underline" onClick={() => { updateSetting('night_from', 1320); }}>
                    {tt(AZ.nachtUebernehmen)}
                  </button>
                </p>
              </Field>
            )}
            <p className="col-span-2 text-[11px] text-muted-foreground">{tt(AZ.quelle)}</p>
          </FormSection>
        )
      })()}

      <InviteSection pid={pid} />
    </div>
  )
}

// Frühere Voreinstellung (#f59e0b) gilt als „nicht gewählt“ - die PDFs
// verwenden dann das neue Standardblau, also zeigt die Einstellung es auch.
function accentOf(color: string | null | undefined): string {
  const c = String(color ?? '').trim()
  return !c || c.toLowerCase() === '#f59e0b' ? '#0071E3' : c
}
