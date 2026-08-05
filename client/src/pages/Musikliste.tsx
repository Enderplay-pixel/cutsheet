import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Trash2, Pencil, Check, X, Music, Download } from 'lucide-react'
import { useProjectPerms } from '@/contexts/ProjectRoleContext'

interface MusicCue {
  id: number
  title: string
  composer: string
  publisher: string
  lyrics_author: string
  duration_seconds: number
  cue_type: string
  usage_type: string
  scene_id: number | null
  notes: string
}

const CUE_TYPES = ['Original', 'Lizenz', 'Gemeinfreiheit', 'GEMA-frei', 'Eigenkomposition']
const USAGE_TYPES = ['Unterlegt', 'Quelle', 'Thema', 'Jingle']

const EMPTY: Omit<MusicCue, 'id'> = {
  title: '',
  composer: '',
  publisher: '',
  lyrics_author: '',
  duration_seconds: 0,
  cue_type: 'Lizenz',
  usage_type: 'Unterlegt',
  scene_id: null,
  notes: '',
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const mm = Math.floor(s / 60).toString().padStart(2, '0')
  const ss = (s % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

function formatTotalDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const hh = Math.floor(s / 3600).toString().padStart(2, '0')
  const mm = Math.floor((s % 3600) / 60).toString().padStart(2, '0')
  const ss = (s % 60).toString().padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

function parseMMSS(val: string): number {
  const parts = val.split(':')
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10) || 0
    const s = parseInt(parts[1], 10) || 0
    return m * 60 + s
  }
  return parseInt(val, 10) || 0
}

function CueFormRow({ initial, pid, onDone }: { initial?: MusicCue; pid: number; onDone: () => void }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [form, setForm] = useState<Omit<MusicCue, 'id'>>(initial ? { ...initial } : { ...EMPTY })
  const [durationInput, setDurationInput] = useState(initial ? formatDuration(initial.duration_seconds) : '00:00')
  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }))

  const saveMutation = useMutation({
    mutationFn: () => {
      const data = { ...form, duration_seconds: parseMMSS(durationInput) }
      return initial ? api.musicCues.update(pid, initial.id, data) : api.musicCues.create(pid, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['musicCues', pid] })
      toast({ title: initial ? 'Musikcue aktualisiert' : 'Musikcue hinzugefügt' })
      onDone()
    },
    onError: () => toast({ variant: 'destructive', title: 'Fehler beim Speichern' }),
  })

  const c = 'py-1.5 px-2'
  const i = 'h-7 text-sm'
  const sel = 'h-7 text-sm w-full rounded-md border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring'

  return (
    <tr className="border-b border-primary/20 bg-primary/5">
      <td className={c}><Input className={i} placeholder="Titel" value={form.title} onChange={e => set('title', e.target.value)} /></td>
      <td className={c}><Input className={i} placeholder="Komponist" value={form.composer} onChange={e => set('composer', e.target.value)} /></td>
      <td className={c}><Input className={i} placeholder="Verlag" value={form.publisher} onChange={e => set('publisher', e.target.value)} /></td>
      <td className={c}><Input className={i} placeholder="Textdichter" value={form.lyrics_author} onChange={e => set('lyrics_author', e.target.value)} /></td>
      <td className={c}><Input className={i} placeholder="MM:SS" value={durationInput} onChange={e => setDurationInput(e.target.value)} /></td>
      <td className={c}>
        <select className={sel} value={form.cue_type} onChange={e => set('cue_type', e.target.value)}>
          {CUE_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </td>
      <td className={c}>
        <select className={sel} value={form.usage_type} onChange={e => set('usage_type', e.target.value)}>
          {USAGE_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </td>
      <td className={c}><Input className={i} type="number" placeholder="Szene #" value={form.scene_id ?? ''} onChange={e => set('scene_id', e.target.value ? Number(e.target.value) : null)} /></td>
      <td className={c}><Input className={i} placeholder="Notizen" value={form.notes} onChange={e => set('notes', e.target.value)} /></td>
      <td className="py-1.5 px-2">
        <div className="flex items-center gap-1 justify-end">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !form.title.trim()}
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

function CueRow({ cue, pid, onEdit }: { cue: MusicCue; pid: number; onEdit: (c: MusicCue) => void }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { canEdit } = useProjectPerms()

  const deleteMutation = useMutation({
    mutationFn: () => api.musicCues.delete(pid, cue.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['musicCues', pid] })
      toast({ title: 'Musikcue gelöscht' })
    },
    onError: () => toast({ variant: 'destructive', title: 'Fehler beim Löschen' }),
  })

  return (
    <tr className="border-b border-border/40 hover:bg-muted/30 transition-colors group">
      <td className="py-2.5 px-3 text-sm font-medium">{cue.title || '—'}</td>
      <td className="py-2.5 px-3 text-sm text-muted-foreground">{cue.composer || '—'}</td>
      <td className="py-2.5 px-3 text-sm text-muted-foreground">{cue.publisher || '—'}</td>
      <td className="py-2.5 px-3 text-sm text-muted-foreground">{cue.lyrics_author || '—'}</td>
      <td className="py-2.5 px-3 text-sm font-mono text-muted-foreground">{formatDuration(cue.duration_seconds)}</td>
      <td className="py-2.5 px-3 text-sm text-muted-foreground">{cue.cue_type || '—'}</td>
      <td className="py-2.5 px-3 text-sm text-muted-foreground">{cue.usage_type || '—'}</td>
      <td className="py-2.5 px-3 text-sm text-muted-foreground">{cue.scene_id ? `Szene ${cue.scene_id}` : '—'}</td>
      <td className="py-2.5 px-3 text-sm text-muted-foreground max-w-[120px] truncate" title={cue.notes}>{cue.notes || '—'}</td>
      <td className="py-2.5 px-3 text-right">
        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          {canEdit && (
            <>
              <button
                onClick={() => onEdit(cue)}
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

function exportCSV(cues: MusicCue[]) {
  const headers = ['Titel', 'Komponist', 'Verlag', 'Textdichter', 'Dauer (MM:SS)', 'Lizenzart', 'Verwendungsart', 'Szene', 'Notizen']
  const rows = cues.map(c => [
    c.title,
    c.composer,
    c.publisher,
    c.lyrics_author,
    formatDuration(c.duration_seconds),
    c.cue_type,
    c.usage_type,
    c.scene_id ? `Szene ${c.scene_id}` : '',
    c.notes,
  ])
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'musikliste-gema.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const { canEdit } = useProjectPerms()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const { data: cues = [], isLoading } = useQuery({
    queryKey: ['musicCues', pid],
    queryFn: () => api.musicCues.list(pid),
  })

  const allCues = cues as MusicCue[]
  const totalSeconds = allCues.reduce((sum, c) => sum + (c.duration_seconds || 0), 0)

  return (
    <div className="p-7 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Music className="w-5 h-5 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Musikliste / GEMA-Cuesheet</h1>
            <p className="text-sm text-muted-foreground">
              {allCues.length} Cues · Gesamtdauer: {formatTotalDuration(totalSeconds)}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => exportCSV(allCues)} disabled={allCues.length === 0}>
            <Download className="w-4 h-4 mr-2" /> CSV-Export (GEMA)
          </Button>
          {canEdit && (
            <Button onClick={() => { setAdding(true); setEditingId(null) }} disabled={adding}>
              <Plus className="w-4 h-4 mr-2" /> Neuer Cue
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  {['Titel', 'Komponist', 'Verlag', 'Textdichter', 'Dauer', 'Lizenzart', 'Verwendung', 'Szene', 'Notizen', ''].map((h, i) => (
                    <th key={i} className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {adding && <CueFormRow pid={pid} onDone={() => setAdding(false)} />}
                {isLoading ? (
                  [1, 2, 3].map(i => (
                    <tr key={i} className="border-b border-border/40">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(j => (
                        <td key={j} className="py-2.5 px-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : allCues.length === 0 && !adding ? (
                  <tr>
                    <td colSpan={10} className="py-16 text-center">
                      <Music className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Noch keine Musikcues erfasst</p>
                    </td>
                  </tr>
                ) : (
                  allCues.map(c =>
                    editingId === c.id ? (
                      <CueFormRow key={c.id} initial={c} pid={pid} onDone={() => setEditingId(null)} />
                    ) : (
                      <CueRow key={c.id} cue={c} pid={pid} onEdit={cue => { setEditingId(cue.id); setAdding(false) }} />
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
