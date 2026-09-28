import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Trash2, CalendarClock } from 'lucide-react'
import { useProjectPerms } from '@/contexts/ProjectRoleContext'
import { cn } from '@/lib/utils'

interface PostPhase {
  id: number
  phase: string
  start_date: string
  end_date: string
  status: 'Ausstehend' | 'In Arbeit' | 'Abgeschlossen'
  responsible: string
  notes: string
}

const QUICK_PHASES = [
  'Rohschnitt', 'Feinschnitt', 'VFX-Abnahme', 'Color Grading',
  'Sounddesign', 'Tonmischung', 'DCP/Master', 'Ablieferung',
]

const STATUSES: PostPhase['status'][] = ['Ausstehend', 'In Arbeit', 'Abgeschlossen']

function statusBadgeClass(status: string) {
  switch (status) {
    case 'In Arbeit': return 'bg-blue-500/10 text-blue-400'
    case 'Abgeschlossen': return 'bg-green-500/10 text-green-400'
    default: return 'bg-muted text-muted-foreground'
  }
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a).getTime()
  const db = new Date(b).getTime()
  return Math.max(0, Math.round((db - da) / 86400000))
}

function GanttBar({ phase, minDate, totalDays }: { phase: PostPhase; minDate: Date; totalDays: number }) {
  if (!phase.start_date || !phase.end_date || totalDays === 0) return null
  const start = new Date(phase.start_date).getTime()
  const end = new Date(phase.end_date).getTime()
  const minTs = minDate.getTime()
  const left = ((start - minTs) / (totalDays * 86400000)) * 100
  const width = Math.max(1, ((end - start) / (totalDays * 86400000)) * 100)

  const colorClass =
    phase.status === 'Abgeschlossen' ? 'bg-green-500/60' :
    phase.status === 'In Arbeit' ? 'bg-blue-500/60' :
    'bg-muted-foreground/30'

  return (
    <div className="relative h-4 w-full rounded overflow-hidden bg-muted/40 mt-1">
      <div
        className={cn('absolute h-full rounded', colorClass)}
        style={{ left: `${Math.min(left, 99)}%`, width: `${Math.min(width, 100 - Math.min(left, 99))}%` }}
      />
    </div>
  )
}

function PhaseRow({
  phase, pid, minDate, totalDays, canEdit,
}: {
  phase: PostPhase
  pid: number
  minDate: Date
  totalDays: number
  canEdit: boolean
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ ...phase })
  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }))

  const updateMutation = useMutation({
    mutationFn: () => api.postplan.update(pid, phase.id, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['postplan', pid] })
      toast({ title: 'Phase aktualisiert' })
      setEditing(false)
    },
    onError: () => toast({ variant: 'destructive', title: 'Fehler beim Speichern' }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.postplan.delete(pid, phase.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['postplan', pid] })
      toast({ title: 'Phase gelöscht' })
    },
    onError: () => toast({ variant: 'destructive', title: 'Fehler beim Löschen' }),
  })

  const i = 'h-7 text-sm'
  const sel = 'h-7 text-sm w-full rounded-md border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring'

  if (editing) {
    return (
      <div className="border border-border bg-foreground/[0.025] rounded-lg p-3 mb-2">
        <div className="grid grid-cols-12 gap-2 items-center">
          <div className="col-span-3">
            <Input className={i} value={form.phase} onChange={e => set('phase', e.target.value)} placeholder="Phasenname" />
          </div>
          <div className="col-span-2">
            <Input className={i} type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
          </div>
          <div className="col-span-2">
            <Input className={i} type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
          </div>
          <div className="col-span-2">
            <select className={sel} value={form.status} onChange={e => set('status', e.target.value)}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <Input className={i} value={form.responsible} onChange={e => set('responsible', e.target.value)} placeholder="Verantwortlich" />
          </div>
          <div className="col-span-1 flex gap-1 justify-end">
            <button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="px-2 h-7 text-xs rounded bg-primary text-primary-foreground disabled:opacity-50"
            >
              OK
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-2 h-7 text-xs rounded hover:bg-muted text-muted-foreground"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="mt-2">
          <Input className="h-7 text-sm" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Notizen…" />
        </div>
      </div>
    )
  }

  const duration = phase.start_date && phase.end_date ? daysBetween(phase.start_date, phase.end_date) : null

  return (
    <div className="border border-border/60 rounded-lg p-3 mb-2 hover:border-border transition-colors group bg-card">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{phase.phase || '—'}</span>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusBadgeClass(phase.status))}>
              {phase.status}
            </span>
            {duration !== null && (
              <span className="text-xs text-muted-foreground">{duration} Tage</span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
            {phase.start_date && <span>Von: {phase.start_date}</span>}
            {phase.end_date && <span>Bis: {phase.end_date}</span>}
            {phase.responsible && <span>Verantwortlich: {phase.responsible}</span>}
            {phase.notes && <span className="italic truncate max-w-[200px]">{phase.notes}</span>}
          </div>
          <GanttBar phase={phase} minDate={minDate} totalDays={totalDays} />
        </div>
        {canEdit && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={() => { setForm({ ...phase }); setEditing(true) }}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground text-xs"
              title="Bearbeiten"
            >
              ✎
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

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const { canEdit } = useProjectPerms()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [newForm, setNewForm] = useState<Omit<PostPhase, 'id'>>({
    phase: '', start_date: '', end_date: '', status: 'Ausstehend', responsible: '', notes: '',
  })

  const { data: phases = [], isLoading } = useQuery({
    queryKey: ['postplan', pid],
    queryFn: () => api.postplan.list(pid),
  })

  const allPhases = phases as PostPhase[]

  const createMutation = useMutation({
    mutationFn: (data: Omit<PostPhase, 'id'>) => api.postplan.create(pid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['postplan', pid] })
      toast({ title: 'Phase hinzugefügt' })
      setAdding(false)
      setNewForm({ phase: '', start_date: '', end_date: '', status: 'Ausstehend', responsible: '', notes: '' })
    },
    onError: () => toast({ variant: 'destructive', title: 'Fehler beim Speichern' }),
  })

  // Compute overall date range for Gantt
  const { minDate, totalDays } = useMemo(() => {
    const dates = allPhases
      .flatMap(p => [p.start_date, p.end_date])
      .filter(Boolean)
      .map(d => new Date(d).getTime())
      .filter(t => !isNaN(t))

    if (dates.length < 2) return { minDate: new Date(), totalDays: 0 }
    const min = Math.min(...dates)
    const max = Math.max(...dates)
    return { minDate: new Date(min), totalDays: Math.max(1, Math.round((max - min) / 86400000)) }
  }, [allPhases])

  // Total post duration
  const totalPostDays = useMemo(() => {
    const starts = allPhases.filter(p => p.start_date).map(p => new Date(p.start_date).getTime()).filter(t => !isNaN(t))
    const ends = allPhases.filter(p => p.end_date).map(p => new Date(p.end_date).getTime()).filter(t => !isNaN(t))
    if (!starts.length || !ends.length) return null
    return Math.round((Math.max(...ends) - Math.min(...starts)) / 86400000)
  }, [allPhases])

  const i = 'h-7 text-sm'
  const sel = 'h-7 text-sm w-full rounded-md border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring'

  return (
    <div className="px-5 py-6 sm:p-7 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="font-display text-[28px] sm:text-[34px]">Postproduktionsplan</h1>
            <p className="text-sm text-muted-foreground">
              {allPhases.length} Phasen
              {totalPostDays !== null && ` · Gesamtdauer: ${totalPostDays} Tage`}
            </p>
          </div>
        </div>
        {canEdit && (
          <Button onClick={() => setAdding(a => !a)}>
            <Plus className="w-4 h-4 mr-2" /> Neue Phase
          </Button>
        )}
      </div>

      {/* Quick-add standard phases */}
      {canEdit && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <span className="text-xs text-muted-foreground self-center mr-1">Schnell hinzufügen:</span>
          {QUICK_PHASES.map(p => (
            <button
              key={p}
              onClick={() => createMutation.mutate({ phase: p, start_date: '', end_date: '', status: 'Ausstehend', responsible: '', notes: '' })}
              disabled={createMutation.isPending}
              className="px-2.5 py-1 text-xs rounded-full border border-border/60 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              + {p}
            </button>
          ))}
        </div>
      )}

      {/* New phase form */}
      {adding && (
        <div className="border border-border bg-foreground/[0.025] rounded-lg p-3 mb-4">
          <div className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-3">
              <Input className={i} value={newForm.phase} onChange={e => setNewForm(f => ({ ...f, phase: e.target.value }))} placeholder="Phasenname" />
            </div>
            <div className="col-span-2">
              <Input className={i} type="date" value={newForm.start_date} onChange={e => setNewForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Input className={i} type="date" value={newForm.end_date} onChange={e => setNewForm(f => ({ ...f, end_date: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <select className={sel} value={newForm.status} onChange={e => setNewForm(f => ({ ...f, status: e.target.value as PostPhase['status'] }))}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <Input className={i} value={newForm.responsible} onChange={e => setNewForm(f => ({ ...f, responsible: e.target.value }))} placeholder="Verantwortlich" />
            </div>
            <div className="col-span-1 flex gap-1 justify-end">
              <button
                onClick={() => createMutation.mutate(newForm)}
                disabled={createMutation.isPending || !newForm.phase.trim()}
                className="px-2 h-7 text-xs rounded bg-primary text-primary-foreground disabled:opacity-50"
              >
                OK
              </button>
              <button
                onClick={() => setAdding(false)}
                className="px-2 h-7 text-xs rounded hover:bg-muted text-muted-foreground"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="mt-2">
            <Input className="h-7 text-sm" value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notizen…" />
          </div>
        </div>
      )}

      {/* Phase list */}
      <div>
        {isLoading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="border border-border/40 rounded-lg p-3 mb-2">
              <div className="h-4 bg-muted rounded animate-pulse w-1/3 mb-2" />
              <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
            </div>
          ))
        ) : allPhases.length === 0 && !adding ? (
          <div className="py-16 text-center">
            <CalendarClock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Noch keine Postproduktionsphasen erfasst</p>
          </div>
        ) : (
          allPhases.map(phase => (
            <PhaseRow
              key={phase.id}
              phase={phase}
              pid={pid}
              minDate={minDate}
              totalDays={totalDays}
              canEdit={canEdit}
            />
          ))
        )}
      </div>
    </div>
  )
}
