import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Trash2, Pencil, Check, X, Layers } from 'lucide-react'
import { useProjectPerms } from '@/contexts/ProjectRoleContext'
import { cn } from '@/lib/utils'

interface VFXShot {
  id: number
  shot_number: string
  scene_id: number | null
  description: string
  vfx_type: string
  status: string
  complexity: string
  artist: string
  deadline: string
  notes: string
}

const VFX_TYPES = ['Compositing', 'CGI', 'Rotoscoping', 'Color Grading', 'Motion Graphics', 'De-aging', 'Environment', 'Sonstiges']
const STATUSES = ['Offen', 'In Arbeit', 'Review', 'Finalisiert', 'Abgelehnt']
const COMPLEXITIES = ['Niedrig', 'Mittel', 'Hoch', 'Sehr hoch']

const EMPTY: Omit<VFXShot, 'id'> = {
  shot_number: '',
  scene_id: null,
  description: '',
  vfx_type: 'Compositing',
  status: 'Offen',
  complexity: 'Mittel',
  artist: '',
  deadline: '',
  notes: '',
}

function statusBadgeClass(status: string) {
  switch (status) {
    case 'In Arbeit': return 'bg-blue-500/10 text-blue-400'
    case 'Review': return 'bg-amber-500/10 text-amber-400'
    case 'Finalisiert': return 'bg-green-500/10 text-green-400'
    case 'Abgelehnt': return 'bg-red-500/10 text-red-400'
    default: return 'bg-muted text-muted-foreground'
  }
}

function VFXFormRow({ initial, pid, onDone }: { initial?: VFXShot; pid: number; onDone: () => void }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [form, setForm] = useState<Omit<VFXShot, 'id'>>(initial ? { ...initial } : { ...EMPTY })
  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }))

  const saveMutation = useMutation({
    mutationFn: () => initial ? api.vfx.update(pid, initial.id, form) : api.vfx.create(pid, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vfx', pid] })
      toast({ title: initial ? 'VFX-Shot aktualisiert' : 'VFX-Shot hinzugefügt' })
      onDone()
    },
    onError: () => toast({ variant: 'destructive', title: 'Fehler beim Speichern' }),
  })

  const c = 'py-1.5 px-2'
  const i = 'h-7 text-sm'
  const sel = 'h-7 text-sm w-full rounded-md border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring'

  return (
    <tr className="border-b border-primary/20 bg-primary/5">
      <td className={c}><Input className={i} placeholder="VFX-001" value={form.shot_number} onChange={e => set('shot_number', e.target.value)} /></td>
      <td className={c}><Input className={i} placeholder="Szene #" type="number" value={form.scene_id ?? ''} onChange={e => set('scene_id', e.target.value ? Number(e.target.value) : null)} /></td>
      <td className={c}><Input className={i} placeholder="Beschreibung" value={form.description} onChange={e => set('description', e.target.value)} /></td>
      <td className={c}>
        <select className={sel} value={form.vfx_type} onChange={e => set('vfx_type', e.target.value)}>
          {VFX_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </td>
      <td className={c}>
        <select className={sel} value={form.status} onChange={e => set('status', e.target.value)}>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </td>
      <td className={c}>
        <select className={sel} value={form.complexity} onChange={e => set('complexity', e.target.value)}>
          {COMPLEXITIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </td>
      <td className={c}><Input className={i} placeholder="Artist" value={form.artist} onChange={e => set('artist', e.target.value)} /></td>
      <td className={c}><Input className={i} type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} /></td>
      <td className={c}><Input className={i} placeholder="Notizen" value={form.notes} onChange={e => set('notes', e.target.value)} /></td>
      <td className="py-1.5 px-2">
        <div className="flex items-center gap-1 justify-end">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !form.shot_number.trim()}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-green-500 disabled:opacity-40"
            title="Speichern"
          >
            <Check className="w-4 h-4" />
          </button>
          <button onClick={onDone} className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground" title="Abbrechen">
            <X className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}

function VFXRow({ shot, pid, onEdit }: { shot: VFXShot; pid: number; onEdit: (s: VFXShot) => void }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { canEdit } = useProjectPerms()

  const deleteMutation = useMutation({
    mutationFn: () => api.vfx.delete(pid, shot.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vfx', pid] })
      toast({ title: 'VFX-Shot gelöscht' })
    },
    onError: () => toast({ variant: 'destructive', title: 'Fehler beim Löschen' }),
  })

  return (
    <tr className="border-b border-border/40 hover:bg-muted/30 transition-colors group">
      <td className="py-2.5 px-3 text-sm font-mono font-medium">{shot.shot_number || '—'}</td>
      <td className="py-2.5 px-3 text-sm text-muted-foreground">{shot.scene_id ? `Szene ${shot.scene_id}` : '—'}</td>
      <td className="py-2.5 px-3 text-sm max-w-[200px] truncate" title={shot.description}>{shot.description || '—'}</td>
      <td className="py-2.5 px-3 text-sm text-muted-foreground">{shot.vfx_type || '—'}</td>
      <td className="py-2.5 px-3">
        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', statusBadgeClass(shot.status))}>
          {shot.status}
        </span>
      </td>
      <td className="py-2.5 px-3 text-sm text-muted-foreground">{shot.complexity || '—'}</td>
      <td className="py-2.5 px-3 text-sm text-muted-foreground">{shot.artist || '—'}</td>
      <td className="py-2.5 px-3 text-sm text-muted-foreground">{shot.deadline || '—'}</td>
      <td className="py-2.5 px-3 text-sm text-muted-foreground max-w-[120px] truncate" title={shot.notes}>{shot.notes || '—'}</td>
      <td className="py-2.5 px-3 text-right">
        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          {canEdit && (
            <>
              <button
                onClick={() => onEdit(shot)}
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
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const { canEdit } = useProjectPerms()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('Alle')

  const { data: shots = [], isLoading } = useQuery({
    queryKey: ['vfx', pid],
    queryFn: () => api.vfx.list(pid),
  })

  const allShots = shots as VFXShot[]
  const filtered = statusFilter === 'Alle' ? allShots : allShots.filter(s => s.status === statusFilter)

  const totalCount = allShots.length
  const finalizedCount = allShots.filter(s => s.status === 'Finalisiert').length
  const reviewCount = allShots.filter(s => s.status === 'Review').length
  const inProgressCount = allShots.filter(s => s.status === 'In Arbeit').length

  const filterTabs = ['Alle', ...STATUSES]

  return (
    <div className="p-7 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Layers className="w-5 h-5 text-muted-foreground" />
          <div>
            <h1 className="font-display text-[34px] sm:text-[40px]">VFX-Tracking</h1>
            <p className="text-sm text-muted-foreground">{totalCount} VFX-Shots insgesamt</p>
          </div>
        </div>
        {canEdit && (
          <Button onClick={() => { setAdding(true); setEditingId(null) }} disabled={adding}>
            <Plus className="w-4 h-4 mr-2" /> Neuer VFX-Shot
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {[
          { label: 'Gesamt', value: totalCount, cls: 'text-foreground' },
          { label: 'In Arbeit', value: inProgressCount, cls: 'text-blue-400' },
          { label: 'In Review', value: reviewCount, cls: 'text-amber-400' },
          { label: 'Finalisiert', value: finalizedCount, cls: 'text-green-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border/60 rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className={cn('text-2xl font-bold tabular-nums', stat.cls)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {filterTabs.map(tab => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={cn(
              'px-3 py-1 rounded-md text-sm font-medium transition-colors',
              statusFilter === tab
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            )}
          >
            {tab}
            {tab !== 'Alle' && (
              <span className="ml-1.5 text-xs opacity-70">
                {allShots.filter(s => s.status === tab).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                {['Shot', 'Szene', 'Beschreibung', 'Typ', 'Status', 'Komplexität', 'Artist', 'Deadline', 'Notizen', ''].map((h, i) => (
                  <th key={i} className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {adding && <VFXFormRow pid={pid} onDone={() => setAdding(false)} />}
              {isLoading ? (
                [1, 2, 3].map(i => (
                  <tr key={i} className="border-b border-border/40">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(j => (
                      <td key={j} className="py-2.5 px-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 && !adding ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <Layers className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {statusFilter !== 'Alle' ? `Keine VFX-Shots mit Status "${statusFilter}"` : 'Noch keine VFX-Shots erfasst'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map(s =>
                  editingId === s.id ? (
                    <VFXFormRow key={s.id} initial={s} pid={pid} onDone={() => setEditingId(null)} />
                  ) : (
                    <VFXRow key={s.id} shot={s} pid={pid} onEdit={shot => { setEditingId(shot.id); setAdding(false) }} />
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
