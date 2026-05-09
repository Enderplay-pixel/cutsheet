import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Trash2, Pencil, Check, X, Shield, AlertTriangle } from 'lucide-react'
import { useProjectPerms } from '@/contexts/ProjectRoleContext'
import { cn } from '@/lib/utils'

interface Insurance {
  id: number
  ins_type: string
  provider: string
  policy_number: string
  coverage_amount_cents: number
  premium_cents: number
  start_date: string
  end_date: string
  notes: string
}

const INS_TYPES = ['Filmversicherung', 'Betriebshaftpflicht', 'Unfallversicherung', 'Ausrüstungsversicherung', 'Sonstiges']

const EMPTY: Omit<Insurance, 'id'> = {
  ins_type: 'Filmversicherung',
  provider: '',
  policy_number: '',
  coverage_amount_cents: 0,
  premium_cents: 0,
  start_date: '',
  end_date: '',
  notes: '',
}

function formatEuro(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function parseEuro(val: string): number {
  const num = parseFloat(val.replace(',', '.')) || 0
  return Math.round(num * 100)
}

function getExpiryStatus(end_date: string): 'expired' | 'soon' | 'ok' | 'none' {
  if (!end_date) return 'none'
  const end = new Date(end_date).getTime()
  const now = Date.now()
  if (end < now) return 'expired'
  if (end - now < 30 * 24 * 60 * 60 * 1000) return 'soon'
  return 'ok'
}

function ExpiryBadge({ end_date }: { end_date: string }) {
  const status = getExpiryStatus(end_date)
  if (status === 'none' || status === 'ok') return null
  return (
    <span className={cn(
      'text-xs font-medium px-2 py-0.5 rounded-full',
      status === 'expired' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
    )}>
      {status === 'expired' ? 'Abgelaufen' : 'Läuft bald ab'}
    </span>
  )
}

function InsuranceCard({ ins, pid, canEdit }: { ins: Insurance; pid: number; canEdit: boolean }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ ...ins })
  const [coverageInput, setCoverageInput] = useState(String(ins.coverage_amount_cents / 100))
  const [premiumInput, setPremiumInput] = useState(String(ins.premium_cents / 100))

  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }))

  const updateMutation = useMutation({
    mutationFn: () => api.insurances.update(pid, ins.id, {
      ...form,
      coverage_amount_cents: parseEuro(coverageInput),
      premium_cents: parseEuro(premiumInput),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurances', pid] })
      toast({ title: 'Versicherung aktualisiert' })
      setEditing(false)
    },
    onError: () => toast({ variant: 'destructive', title: 'Fehler beim Speichern' }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.insurances.delete(pid, ins.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurances', pid] })
      toast({ title: 'Versicherung gelöscht' })
    },
    onError: () => toast({ variant: 'destructive', title: 'Fehler beim Löschen' }),
  })

  const expiryStatus = getExpiryStatus(ins.end_date)
  const borderColor =
    expiryStatus === 'expired' ? 'border-red-500/40' :
    expiryStatus === 'soon' ? 'border-amber-500/40' :
    'border-border/60'

  const i = 'h-7 text-sm'
  const sel = 'h-7 text-sm w-full rounded-md border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring'

  if (editing) {
    return (
      <div className={cn('border rounded-xl p-4 bg-card', borderColor)}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Versicherungsart</label>
            <select className={sel} value={form.ins_type} onChange={e => set('ins_type', e.target.value)}>
              {INS_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Versicherungsgesellschaft</label>
            <Input className={i} value={form.provider} onChange={e => set('provider', e.target.value)} placeholder="Allianz, AXA…" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Policennummer</label>
            <Input className={i} value={form.policy_number} onChange={e => set('policy_number', e.target.value)} placeholder="POL-2024-001" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Deckungssumme (€)</label>
            <Input className={i} type="number" step="0.01" value={coverageInput} onChange={e => setCoverageInput(e.target.value)} placeholder="1000000" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Prämie (€)</label>
            <Input className={i} type="number" step="0.01" value={premiumInput} onChange={e => setPremiumInput(e.target.value)} placeholder="1200" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Beginn</label>
            <Input className={i} type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Ende</label>
            <Input className={i} type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">Notizen</label>
            <Input className={i} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Besondere Konditionen, Ausschlüsse…" />
          </div>
        </div>
        <div className="flex gap-2 mt-3 justify-end">
          <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Abbrechen</Button>
          <Button size="sm" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>Speichern</Button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('border rounded-xl p-4 bg-card hover:border-border transition-colors group', borderColor)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Shield className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-semibold">{ins.ins_type}</span>
            {ins.provider && <span className="text-sm text-muted-foreground">· {ins.provider}</span>}
            <ExpiryBadge end_date={ins.end_date} />
            {(expiryStatus === 'expired' || expiryStatus === 'soon') && (
              <AlertTriangle className={cn('w-3.5 h-3.5', expiryStatus === 'expired' ? 'text-red-400' : 'text-amber-400')} />
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 mt-2">
            {ins.policy_number && (
              <div>
                <p className="text-xs text-muted-foreground">Policennummer</p>
                <p className="text-sm font-mono">{ins.policy_number}</p>
              </div>
            )}
            {ins.coverage_amount_cents > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">Deckungssumme</p>
                <p className="text-sm font-medium">{formatEuro(ins.coverage_amount_cents)}</p>
              </div>
            )}
            {ins.premium_cents > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">Prämie</p>
                <p className="text-sm font-medium">{formatEuro(ins.premium_cents)}</p>
              </div>
            )}
            {(ins.start_date || ins.end_date) && (
              <div>
                <p className="text-xs text-muted-foreground">Laufzeit</p>
                <p className="text-sm">{ins.start_date || '?'} – {ins.end_date || '?'}</p>
              </div>
            )}
          </div>
          {ins.notes && (
            <p className="text-xs text-muted-foreground mt-2 italic">{ins.notes}</p>
          )}
        </div>
        {canEdit && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={() => { setForm({ ...ins }); setCoverageInput(String(ins.coverage_amount_cents / 100)); setPremiumInput(String(ins.premium_cents / 100)); setEditing(true) }}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Bearbeiten"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-destructive"
              title="Löschen"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function NewInsuranceForm({ pid, onDone }: { pid: number; onDone: () => void }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [form, setForm] = useState({ ...EMPTY })
  const [coverageInput, setCoverageInput] = useState('0')
  const [premiumInput, setPremiumInput] = useState('0')
  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }))

  const createMutation = useMutation({
    mutationFn: () => api.insurances.create(pid, {
      ...form,
      coverage_amount_cents: parseEuro(coverageInput),
      premium_cents: parseEuro(premiumInput),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurances', pid] })
      toast({ title: 'Versicherung hinzugefügt' })
      onDone()
    },
    onError: () => toast({ variant: 'destructive', title: 'Fehler beim Speichern' }),
  })

  const i = 'h-7 text-sm'
  const sel = 'h-7 text-sm w-full rounded-md border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring'

  return (
    <div className="border border-primary/30 bg-primary/5 rounded-xl p-4 mb-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Versicherungsart</label>
          <select className={sel} value={form.ins_type} onChange={e => set('ins_type', e.target.value)}>
            {INS_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Versicherungsgesellschaft</label>
          <Input className={i} value={form.provider} onChange={e => set('provider', e.target.value)} placeholder="Allianz, AXA…" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Policennummer</label>
          <Input className={i} value={form.policy_number} onChange={e => set('policy_number', e.target.value)} placeholder="POL-2024-001" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Deckungssumme (€)</label>
          <Input className={i} type="number" step="0.01" value={coverageInput} onChange={e => setCoverageInput(e.target.value)} placeholder="1000000" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Prämie (€)</label>
          <Input className={i} type="number" step="0.01" value={premiumInput} onChange={e => setPremiumInput(e.target.value)} placeholder="1200" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Beginn</label>
          <Input className={i} type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Ende</label>
          <Input className={i} type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground mb-1 block">Notizen</label>
          <Input className={i} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Besondere Konditionen, Ausschlüsse…" />
        </div>
      </div>
      <div className="flex gap-2 mt-3 justify-end">
        <Button variant="outline" size="sm" onClick={onDone}>Abbrechen</Button>
        <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.ins_type.trim()}>
          <Check className="w-3.5 h-3.5 mr-1.5" /> Hinzufügen
        </Button>
      </div>
    </div>
  )
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const { canEdit } = useProjectPerms()
  const [adding, setAdding] = useState(false)

  const { data: insurances = [], isLoading } = useQuery({
    queryKey: ['insurances', pid],
    queryFn: () => api.insurances.list(pid),
  })

  const allIns = insurances as Insurance[]
  const totalPremium = allIns.reduce((sum, i) => sum + (i.premium_cents || 0), 0)
  const expiredCount = allIns.filter(i => getExpiryStatus(i.end_date) === 'expired').length
  const soonCount = allIns.filter(i => getExpiryStatus(i.end_date) === 'soon').length

  return (
    <div className="p-7 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Versicherungen</h1>
            <p className="text-sm text-muted-foreground">
              {allIns.length} Versicherungen
              {totalPremium > 0 && ` · Gesamtprämie: ${formatEuro(totalPremium)}`}
            </p>
          </div>
        </div>
        {canEdit && (
          <Button onClick={() => setAdding(a => !a)}>
            <Plus className="w-4 h-4 mr-2" /> Neue Versicherung
          </Button>
        )}
      </div>

      {/* Warning banners */}
      {expiredCount > 0 && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span><strong>{expiredCount}</strong> Versicherung{expiredCount !== 1 ? 'en' : ''} ist abgelaufen</span>
        </div>
      )}
      {soonCount > 0 && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span><strong>{soonCount}</strong> Versicherung{soonCount !== 1 ? 'en' : ''} läuft in weniger als 30 Tagen ab</span>
        </div>
      )}

      {/* New insurance form */}
      {adding && <NewInsuranceForm pid={pid} onDone={() => setAdding(false)} />}

      {/* Cards */}
      <div className="space-y-3">
        {isLoading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="border border-border/40 rounded-xl p-4 bg-card">
              <div className="h-4 bg-muted rounded animate-pulse w-1/3 mb-2" />
              <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
            </div>
          ))
        ) : allIns.length === 0 && !adding ? (
          <div className="py-16 text-center">
            <Shield className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Noch keine Versicherungen erfasst</p>
          </div>
        ) : (
          allIns.map(ins => (
            <InsuranceCard key={ins.id} ins={ins} pid={pid} canEdit={canEdit} />
          ))
        )}
      </div>
    </div>
  )
}
