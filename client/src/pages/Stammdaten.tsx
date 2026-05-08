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
import { Film, Calendar, Building2, Check, Settings2, Link2, Plus, Trash2, Copy, Users, QrCode } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { TimeInput } from '@/components/ui/time-input'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/useT'
import { masterT, uiT } from '@/lib/i18n'

const FORMATS = ['Kurzfilm', 'Spielfilm', 'Serie', 'Dokumentarfilm', 'Werbefilm', 'Imagefilm', 'Musikvideo']
const STATUSES = ['Entwicklung', 'Vorproduktion', 'Produktion', 'Postproduktion', 'Abgeschlossen', 'Archiviert']

function FormSection({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border/60 rounded-xl p-6">
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

const ROLE_OPTS = [
  { value: 'read_only', label: 'Lesezugriff' },
  { value: 'dept_head', label: 'Abteilungsleitung' },
  { value: 'director',  label: 'Regisseur' },
  { value: 'producer',  label: 'Produzent' },
  { value: 'admin',     label: 'Admin' },
]

function InviteSection({ pid }: { pid: number }) {
  const tt = useT()
  const qc = useQueryClient()
  const { toast } = useToast()
  const { user } = useAuth()
  const [newRole, setNewRole] = useState('read_only')
  const [newLabel, setNewLabel] = useState('')
  const [copied, setCopied] = useState<number | null>(null)
  const [qrOpen, setQrOpen] = useState<string | null>(null)

  const { data: invites = [], isLoading: invLoading } = useQuery({
    queryKey: ['invites', pid],
    queryFn: () => api.invites.list(pid),
    retry: false,
  })
  const { data: members = [] } = useQuery({
    queryKey: ['members', pid],
    queryFn: () => api.members.list(pid),
    retry: false,
  })

  const createMutation = useMutation({
    mutationFn: () => api.invites.create(pid, { role: newRole, label: newLabel }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invites', pid] }); setNewLabel('') },
    onError: (e: any) => toast({ variant: 'destructive', title: e.message }),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.invites.delete(pid, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites', pid] }),
  })
  const removeMemberMutation = useMutation({
    mutationFn: (userId: number) => api.members.remove(pid, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members', pid] }),
  })

  const inviteUrl = (token: string) => `${window.location.origin}/invite/${token}`

  const copyLink = (id: number, token: string) => {
    navigator.clipboard.writeText(inviteUrl(token))
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const roleLabel = (r: string) => ROLE_OPTS.find(o => o.value === r)?.label ?? r

  return (
    <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border/60">
        <Link2 className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Mitarbeiter einladen</h2>
      </div>

      {/* Create new invite */}
      <div className="p-5 border-b border-border/60">
        <p className="text-xs text-muted-foreground mb-3">
          Erstelle einen Einladungslink. Wer ihn öffnet, wird automatisch Mitglied dieses Projekts mit der gewählten Rolle.
        </p>
        <div className="flex gap-2 flex-wrap">
          <Select value={newRole} onValueChange={setNewRole}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLE_OPTS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            className="h-8 text-xs flex-1 min-w-32"
            placeholder="Beschriftung (optional)"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
          />
          <Button size="sm" className="h-8 text-xs" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            <Plus className="w-3.5 h-3.5 mr-1" /> {tt(masterT.createInvite)}
          </Button>
        </div>
      </div>

      {/* Existing invite links */}
      {invLoading ? (
        <div className="p-5 text-xs text-muted-foreground">Laden…</div>
      ) : (invites as any[]).length === 0 ? (
        <div className="p-5 text-xs text-muted-foreground text-center py-8">{tt(masterT.noInvites)}</div>
      ) : (
        <div className="divide-y divide-border/40">
          {(invites as any[]).map((inv: any) => (
            <div key={inv.id} className="relative flex items-center gap-3 px-5 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium">{roleLabel(inv.role)}</span>
                  {inv.label && <span className="text-xs text-muted-foreground italic">— {inv.label}</span>}
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

      {/* Members */}
      {(members as any[]).length > 0 && (
        <div className="border-t border-border/60">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border/40">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Projektmitglieder</span>
          </div>
          <div className="divide-y divide-border/40">
            {(members as any[]).map((m: any) => (
              <div key={m.id} className="flex items-center gap-3 px-5 py-2.5">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{m.name || m.email}</span>
                  <span className="text-xs text-muted-foreground ml-2">{m.email}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{roleLabel(m.role)}</span>
                {m.user_id !== user?.id && (
                  <button
                    onClick={() => removeMemberMutation.mutate(m.user_id)}
                    className="shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground/40 hover:text-destructive transition-colors"
                    title={tt(masterT.removeMember)}
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

  const mutation = useMutation({
    mutationFn: (data: any) => api.projects.update(pid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', pid] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
    onError: () => toast({ title: 'Fehler beim Speichern', variant: 'destructive' }),
  })

  const debouncedSave = useRef(debounce((data: any) => mutation.mutate(data), 600)).current
  const update = (key: string, value: any) => {
    const next = { ...formData, [key]: value }
    setFormData(next)
    debouncedSave(next)
  }

  const [settingsData, setSettingsData] = useState<any>(null)
  useEffect(() => {
    if (project?.settings && !settingsData) setSettingsData({ ...project.settings })
  }, [project])

  const settingsMutation = useMutation({
    mutationFn: (data: any) => api.projects.updateSettings(pid, data),
    onSuccess: (updated) => setSettingsData(updated),
  })
  const debouncedSettingsSave = useRef(debounce((data: any) => settingsMutation.mutate(data), 600)).current
  const updateSetting = (key: string, value: any) => {
    const next = { ...settingsData, [key]: value }
    setSettingsData(next)
    debouncedSettingsSave(next)
  }

  if (isLoading || !formData) {
    return (
      <div className="p-7 max-w-3xl mx-auto">
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

  return (
    <div className="p-7 max-w-3xl mx-auto animate-fade-up space-y-4">
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-xl font-semibold">{tt(masterT.title)}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Grundlegende Projektinformationen</p>
        </div>
        <div className={cn(
          'flex items-center gap-1.5 text-xs transition-all',
          saved ? 'text-green-400' : 'text-muted-foreground/40'
        )}>
          <Check className="w-3.5 h-3.5" />
          {saved ? tt(uiT.save) : 'Wird automatisch gespeichert'}
        </div>
      </div>

      <FormSection icon={Film} title="Basisdaten">
        <Field label={tt(masterT.labelTitle)} full>
          <Input value={formData.title || ''} onChange={e => update('title', e.target.value)}
            placeholder="Projekttitel" className="h-9 text-base font-medium" />
        </Field>
        <Field label={tt(masterT.labelFormat)}>
          <Select value={formData.format || 'Kurzfilm'} onValueChange={v => update('format', v)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{FORMATS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Status">
          <Select value={formData.status || 'Vorproduktion'} onValueChange={v => update('status', v)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label={tt(masterT.labelGenre)}>
          <Input value={formData.genre || ''} onChange={e => update('genre', e.target.value)}
            placeholder="z.B. Drama, Thriller, Komödie" className="h-9" />
        </Field>
        <Field label={tt(masterT.labelMinutes)}>
          <Input type="number" value={formData.length_minutes || ''}
            onChange={e => update('length_minutes', Number(e.target.value))}
            placeholder="z.B. 90" className="h-9" />
        </Field>
        <Field label={tt(masterT.labelSynopsis)} full>
          <Textarea value={formData.synopsis || ''} onChange={e => update('synopsis', e.target.value)}
            rows={3} className="resize-none text-sm" placeholder="Worum geht es in dem Film? (1–2 Sätze)" />
        </Field>
      </FormSection>

      <FormSection icon={Building2} title="Kreativteam">
        <Field label="Regie">
          <Input value={formData.director || ''} onChange={e => update('director', e.target.value)}
            placeholder="Name Regisseur/in" className="h-9" />
        </Field>
        <Field label="Produktion">
          <Input value={formData.producer || ''} onChange={e => update('producer', e.target.value)}
            placeholder="Name Produzent/in" className="h-9" />
        </Field>
        <Field label="Kamera / DoP">
          <Input value={formData.dop || ''} onChange={e => update('dop', e.target.value)}
            placeholder="Director of Photography" className="h-9" />
        </Field>
        <Field label="Produktionsfirma">
          <Input value={formData.production_company || ''} onChange={e => update('production_company', e.target.value)}
            placeholder="Firmenname" className="h-9" />
        </Field>
      </FormSection>

      <FormSection icon={Calendar} title="Produktionszeitraum">
        <Field label="Drehbeginn">
          <Input type="date" value={formData.shoot_start || ''} onChange={e => update('shoot_start', e.target.value)} className="h-9" />
        </Field>
        <Field label="Drehschluss">
          <Input type="date" value={formData.shoot_end || ''} onChange={e => update('shoot_end', e.target.value)} className="h-9" />
        </Field>
        {shootDays !== null && (
          <div className="col-span-2 flex items-center gap-3 p-3 bg-primary/8 rounded-lg border border-primary/20">
            <Calendar className="w-4 h-4 text-primary shrink-0" />
            <p className="text-sm text-primary">
              <span className="font-semibold">{shootDays} Drehtage</span>
              <span className="text-primary/70"> · {formatDate(formData.shoot_start)} – {formatDate(formData.shoot_end)}</span>
            </p>
          </div>
        )}
      </FormSection>

      {settingsData && (
        <FormSection icon={Settings2} title="Produktionseinstellungen">
          <Field label={tt(masterT.labelDefaultCall)}>
            <TimeInput
              value={settingsData.default_call_time}
              onChange={v => updateSetting('default_call_time', v)}
              className="h-9 w-full"
            />
          </Field>
          <Field label="Standard-Drehschluss (Wrap)">
            <TimeInput
              value={settingsData.default_wrap_time}
              onChange={v => updateSetting('default_wrap_time', v)}
              className="h-9 w-full"
            />
          </Field>
          <Field label="Turnaround-Mindestzeit (Stunden)">
            <Input
              type="number"
              min={8}
              max={24}
              value={settingsData.turnaround_hours ?? 11}
              onChange={e => updateSetting('turnaround_hours', Number(e.target.value))}
              className="h-9"
              placeholder="11"
            />
          </Field>
          <Field label="Währung">
            <Select value={settingsData.currency || 'EUR'} onValueChange={v => updateSetting('currency', v)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EUR">EUR – Euro</SelectItem>
                <SelectItem value="USD">USD – US-Dollar</SelectItem>
                <SelectItem value="GBP">GBP – Britisches Pfund</SelectItem>
                <SelectItem value="CHF">CHF – Schweizer Franken</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Produktionsland">
            <Input
              value={settingsData.country || 'Deutschland'}
              onChange={e => updateSetting('country', e.target.value)}
              className="h-9"
              placeholder="Deutschland"
            />
          </Field>
          <Field label="Akzentfarbe (Hex)">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settingsData.header_color || '#f59e0b'}
                onChange={e => updateSetting('header_color', e.target.value)}
                className="h-9 w-12 rounded cursor-pointer border border-border/60 bg-transparent p-0.5"
              />
              <Input
                value={settingsData.header_color || '#f59e0b'}
                onChange={e => updateSetting('header_color', e.target.value)}
                className="h-9 font-mono"
                placeholder="#f59e0b"
              />
            </div>
          </Field>
        </FormSection>
      )}

      {/* Invite section — always visible */}
      <InviteSection pid={pid} />
    </div>
  )
}
