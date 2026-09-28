import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Trash2, StickyNote } from 'lucide-react'

const NOTE_COLORS = [
  { id: 'yellow', label: 'Gelb', bg: 'bg-yellow-100 dark:bg-yellow-900/40', border: 'border-yellow-300 dark:border-yellow-700', ring: 'ring-yellow-400' },
  { id: 'pink',   label: 'Pink',  bg: 'bg-pink-100 dark:bg-pink-900/40',   border: 'border-pink-300 dark:border-pink-700',   ring: 'ring-pink-400' },
  { id: 'green',  label: 'Grün',  bg: 'bg-green-100 dark:bg-green-900/40', border: 'border-green-300 dark:border-green-700', ring: 'ring-green-400' },
  { id: 'blue',   label: 'Blau',  bg: 'bg-blue-100 dark:bg-blue-900/40',   border: 'border-blue-300 dark:border-blue-700',   ring: 'ring-blue-400' },
]

function colorStyles(colorId: string) {
  return NOTE_COLORS.find(c => c.id === colorId) ?? NOTE_COLORS[0]
}

function StickyNoteCard({ note, pid }: { note: any; pid: number }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [content, setContent] = useState(note.content || '')
  const [color, setColor] = useState(note.color || 'yellow')
  const [saveTimer, setSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.stickyNotes.update(pid, note.id, data),
    onError: () => toast({ variant: 'destructive', title: 'Fehler beim Speichern' }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.stickyNotes.delete(pid, note.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sticky-notes', pid] })
      toast({ title: 'Notiz gelöscht' })
    },
    onError: () => toast({ variant: 'destructive', title: 'Fehler beim Löschen' }),
  })

  const scheduleUpdate = (newContent: string, newColor: string) => {
    if (saveTimer) clearTimeout(saveTimer)
    setSaveTimer(setTimeout(() => {
      updateMutation.mutate({ content: newContent, color: newColor })
    }, 600))
  }

  const handleContentChange = (val: string) => {
    setContent(val)
    scheduleUpdate(val, color)
  }

  const handleColorChange = (c: string) => {
    setColor(c)
    updateMutation.mutate({ content, color: c })
  }

  const styles = colorStyles(color)

  return (
    <div className={`relative rounded-xl border-2 ${styles.bg} ${styles.border} p-4 flex flex-col gap-3 shadow-sm group`}>
      {/* Delete button */}
      <button
        onClick={() => deleteMutation.mutate()}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-destructive"
        title="Notiz löschen"
        disabled={deleteMutation.isPending}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* Content */}
      <textarea
        className={`w-full flex-1 resize-none bg-transparent text-sm leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none min-h-[120px]`}
        placeholder="Notiz eingeben…"
        value={content}
        onChange={e => handleContentChange(e.target.value)}
      />

      {/* Color picker */}
      <div className="flex items-center gap-1.5 pt-1 border-t border-black/10 dark:border-white/10">
        {NOTE_COLORS.map(c => (
          <button
            key={c.id}
            onClick={() => handleColorChange(c.id)}
            title={c.label}
            className={`w-4 h-4 rounded-full border-2 transition-all ${
              color === c.id
                ? `ring-2 ring-offset-1 ${c.ring} border-white/80`
                : 'border-transparent'
            } ${c.bg}`}
          />
        ))}
      </div>
    </div>
  )
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['sticky-notes', pid],
    queryFn: () => api.stickyNotes.list(pid),
  })

  const createMutation = useMutation({
    mutationFn: () => api.stickyNotes.create(pid, { content: '', color: 'yellow' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sticky-notes', pid] }),
    onError: () => toast({ variant: 'destructive', title: 'Fehler beim Erstellen der Notiz' }),
  })

  return (
    <div className="px-5 py-6 sm:p-7 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="font-display text-[28px] sm:text-[34px]">Pinboard</h1>
            <p className="text-sm text-muted-foreground">{notes.length} Notiz{notes.length !== 1 ? 'en' : ''}</p>
          </div>
        </div>
        <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
          <Plus className="w-4 h-4 mr-2" />
          Neue Notiz
        </Button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-52 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
          <StickyNote className="w-12 h-12 text-muted-foreground/30" />
          <div>
            <p className="text-muted-foreground font-medium">Noch keine Notizen</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Klicke auf "Neue Notiz" um zu starten</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {notes.map((note: any) => (
            <StickyNoteCard key={note.id} note={note} pid={pid} />
          ))}
        </div>
      )}
    </div>
  )
}
