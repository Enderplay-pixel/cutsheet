import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { csvHerunterladen } from '@/lib/csv'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Trash2, Pencil, Check, X, Music, Download } from 'lucide-react'
import { useProjectPerms } from '@/contexts/ProjectRoleContext'
import { useT } from '@/lib/useT'
import { uiT, type Lang } from '@/lib/i18n'
import { musiklisteT } from '@/lib/texte/Musikliste'

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
  /** Vom Server dazugeladen - scene_id ist die Kennung, nicht die Nummer */
  scene_number?: string | null
  notes: string
}

const CUE_TYPES = ['Original', 'Lizenz', 'Gemeinfreiheit', 'GEMA-frei', 'Eigenkomposition']
const USAGE_TYPES = ['Unterlegt', 'Quelle', 'Thema', 'Jingle']

/** Beschriftung je gespeichertem Wert - der Wert selbst bleibt deutsch. */
const TYP_LABEL: Record<string, Record<Lang, string>> = {
  Original: musiklisteT.typOriginal,
  Lizenz: musiklisteT.typLizenz,
  Gemeinfreiheit: musiklisteT.typGemeinfrei,
  'GEMA-frei': musiklisteT.typGemaFrei,
  Eigenkomposition: musiklisteT.typEigen,
  Unterlegt: musiklisteT.nutzUnterlegt,
  Quelle: musiklisteT.nutzQuelle,
  Thema: musiklisteT.nutzThema,
  Jingle: musiklisteT.nutzJingle,
}

type Tt = (map: Record<Lang, string>) => string

const beschriftung = (wert: string, tt: Tt) => (TYP_LABEL[wert] ? tt(TYP_LABEL[wert]) : wert)

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
  const tt = useT()
  const [form, setForm] = useState<Omit<MusicCue, 'id'>>(initial ? { ...initial } : { ...EMPTY })
  const [durationInput, setDurationInput] = useState(initial ? formatDuration(initial.duration_seconds) : '00:00')
  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }))
  const { data: szenen = [] } = useQuery({
    queryKey: ['scenes', pid],
    queryFn: () => api.scenes.list(pid),
  })

  const saveMutation = useMutation({
    mutationFn: () => {
      const data = { ...form, duration_seconds: parseMMSS(durationInput) }
      return initial ? api.musicCues.update(pid, initial.id, data) : api.musicCues.create(pid, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['musicCues', pid] })
      toast({ title: initial ? tt(musiklisteT.aktualisiert) : tt(musiklisteT.hinzugefuegt) })
      onDone()
    },
    onError: () => toast({ variant: 'destructive', title: tt(musiklisteT.fehlerSpeichern) }),
  })

  const c = 'py-1.5 px-2'
  const i = 'h-7 text-sm'
  const sel = 'h-7 text-sm w-full rounded-md border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring'

  return (
    <tr className="border-b border-primary/20 bg-primary/5">
      <td className={c}><Input className={i} placeholder={tt(musiklisteT.titel)} value={form.title} onChange={e => set('title', e.target.value)} /></td>
      <td className={c}><Input className={i} placeholder={tt(musiklisteT.komponist)} value={form.composer} onChange={e => set('composer', e.target.value)} /></td>
      <td className={c}><Input className={i} placeholder={tt(musiklisteT.verlag)} value={form.publisher} onChange={e => set('publisher', e.target.value)} /></td>
      <td className={c}><Input className={i} placeholder={tt(musiklisteT.textdichter)} value={form.lyrics_author} onChange={e => set('lyrics_author', e.target.value)} /></td>
      <td className={c}><Input className={i} placeholder={tt(musiklisteT.mmss)} value={durationInput} onChange={e => setDurationInput(e.target.value)} /></td>
      <td className={c}>
        <select className={sel} value={form.cue_type} onChange={e => set('cue_type', e.target.value)}>
          {CUE_TYPES.map(t => <option key={t} value={t}>{beschriftung(t, tt)}</option>)}
        </select>
      </td>
      <td className={c}>
        <select aria-label={tt(musiklisteT.artDerNutzung)} className={sel} value={form.usage_type} onChange={e => set('usage_type', e.target.value)}>
          {USAGE_TYPES.map(t => <option key={t} value={t}>{beschriftung(t, tt)}</option>)}
        </select>
      </td>
      <td className={c}>
        {/* Auswahl statt Zahlenfeld: Eingetippt wurde die Szenennummer, gespeichert
            wird die Kennung der Szene - "12" fand nie Szene 12. */}
        <select aria-label={tt(musiklisteT.szene)} className={sel} value={form.scene_id ?? ''} onChange={e => set('scene_id', e.target.value ? Number(e.target.value) : null)}>
          <option value="">-</option>
          {(szenen as any[]).map(sz => <option key={sz.id} value={sz.id}>{[sz.scene_number, sz.title].filter(Boolean).join(' ') || sz.id}</option>)}
        </select>
      </td>
      <td className={c}><Input className={i} placeholder={tt(uiT.notes)} value={form.notes} onChange={e => set('notes', e.target.value)} /></td>
      <td className="py-1.5 px-2">
        <div className="flex items-center gap-1 justify-end">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !form.title.trim()}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-green-500 disabled:opacity-40"
            title={tt(uiT.save)}
          >
            <Check className="w-4 h-4" />
          </button>
          <button onClick={onDone} className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground" title={tt(uiT.cancel)}>
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
  const tt = useT()

  const deleteMutation = useMutation({
    mutationFn: () => api.musicCues.delete(pid, cue.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['musicCues', pid] })
      toast({ title: tt(musiklisteT.geloescht) })
    },
    onError: () => toast({ variant: 'destructive', title: tt(musiklisteT.fehlerLoeschen) }),
  })

  return (
    <tr className="border-b border-border/40 hover:bg-muted/30 transition-colors group">
      <td className="py-2.5 px-3 text-sm font-medium">{cue.title || '-'}</td>
      <td className="py-2.5 px-3 text-sm text-muted-foreground">{cue.composer || '-'}</td>
      <td className="py-2.5 px-3 text-sm text-muted-foreground">{cue.publisher || '-'}</td>
      <td className="py-2.5 px-3 text-sm text-muted-foreground">{cue.lyrics_author || '-'}</td>
      <td className="py-2.5 px-3 text-sm font-mono text-muted-foreground">{formatDuration(cue.duration_seconds)}</td>
      <td className="py-2.5 px-3 text-sm text-muted-foreground">{cue.cue_type ? beschriftung(cue.cue_type, tt) : '-'}</td>
      <td className="py-2.5 px-3 text-sm text-muted-foreground">{cue.usage_type ? beschriftung(cue.usage_type, tt) : '-'}</td>
      <td className="py-2.5 px-3 text-sm text-muted-foreground">{cue.scene_number ? tt(musiklisteT.szeneN).replace('{n}', cue.scene_number) : '-'}</td>
      <td className="py-2.5 px-3 text-sm text-muted-foreground max-w-[120px] truncate" title={cue.notes}>{cue.notes || '-'}</td>
      <td className="py-2.5 px-3 text-right">
        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          {canEdit && (
            <>
              <button
                onClick={() => onEdit(cue)}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                title={tt(uiT.edit)}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                title={tt(uiT.delete)}
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

function exportCSV(cues: MusicCue[], tt: Tt) {
  const headers = [musiklisteT.titel, musiklisteT.komponist, musiklisteT.verlag, musiklisteT.textdichter, musiklisteT.dauerMmss, musiklisteT.lizenzart, musiklisteT.verwendungsart, musiklisteT.szene, uiT.notes].map(tt)
  const rows = cues.map(c => [
    c.title,
    c.composer,
    c.publisher,
    c.lyrics_author,
    formatDuration(c.duration_seconds),
    c.cue_type ? beschriftung(c.cue_type, tt) : c.cue_type,
    c.usage_type ? beschriftung(c.usage_type, tt) : c.usage_type,
    c.scene_number ? tt(musiklisteT.szeneN).replace('{n}', c.scene_number) : '',
    c.notes,
  ])
  csvHerunterladen('musikliste-gema.csv', headers, rows)
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const { canEdit } = useProjectPerms()
  const tt = useT()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const { data: cues = [], isLoading } = useQuery({
    queryKey: ['musicCues', pid],
    queryFn: () => api.musicCues.list(pid),
  })

  const allCues = cues as MusicCue[]
  const totalSeconds = allCues.reduce((sum, c) => sum + (c.duration_seconds || 0), 0)

  return (
    <div className="px-5 py-6 sm:p-7 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Music className="w-5 h-5 text-muted-foreground" />
          <div>
            <h1 className="font-display text-[28px] sm:text-[34px]">{tt(musiklisteT.seitentitel)}</h1>
            <p className="text-sm text-muted-foreground">
              {tt(musiklisteT.untertitel).replace('{n}', String(allCues.length)).replace('{dauer}', formatTotalDuration(totalSeconds))}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => exportCSV(allCues, tt)} disabled={allCues.length === 0}>
            <Download className="w-4 h-4 mr-2" /> {tt(musiklisteT.csvExport)}
          </Button>
          {canEdit && (
            <Button onClick={() => { setAdding(true); setEditingId(null) }} disabled={adding}>
              <Plus className="w-4 h-4 mr-2" /> {tt(musiklisteT.neuerCue)}
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
                  {[tt(musiklisteT.titel), tt(musiklisteT.komponist), tt(musiklisteT.verlag), tt(musiklisteT.textdichter), tt(musiklisteT.dauer), tt(musiklisteT.lizenzart), tt(musiklisteT.verwendung), tt(musiklisteT.szene), tt(uiT.notes), ''].map((h, i) => (
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
                      <p className="text-sm text-muted-foreground">{tt(musiklisteT.leer)}</p>
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
