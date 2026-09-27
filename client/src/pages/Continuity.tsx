import { useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Pencil, Trash2, Camera, X, ZoomIn, Film } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Scene {
  id: number
  scene_number: string
  title?: string
}

interface CastMember {
  id: number
  name: string
}

interface ContinuityEntry {
  id: number
  scene_id: number | null
  scene_number?: string
  cast_id: number | null
  cast_name?: string
  category: string
  description: string
  photos: string[] // base64 data URLs or URLs
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'kostüm',    label: 'Kostüm',    variant: 'purple' },
  { value: 'maske',     label: 'Maske',     variant: 'amber' },
  { value: 'props',     label: 'Props',     variant: 'blue' },
  { value: 'set',       label: 'Set',       variant: 'green' },
  { value: 'haare',     label: 'Haare',     variant: 'cyan' },
  { value: 'sonstiges', label: 'Sonstiges', variant: 'secondary' },
] as const

function categoryVariant(cat: string) {
  return CATEGORIES.find(c => c.value === cat)?.variant ?? 'secondary'
}
function categoryLabel(cat: string) {
  return CATEGORIES.find(c => c.value === cat)?.label ?? cat
}

// ─── Photo thumbnail ──────────────────────────────────────────────────────────

function PhotoThumb({ src, onClick }: { src: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative group/thumb rounded-lg overflow-hidden border border-border/60 w-16 h-16 shrink-0 active:scale-[0.97] transition-transform"
    >
      <img src={src} alt="" className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
        <ZoomIn className="h-4 w-4 text-white" />
      </div>
    </button>
  )
}

// ─── Entry card ───────────────────────────────────────────────────────────────

function ContinuityCard({
  entry,
  onEdit,
  onDelete,
  onPhotoClick,
}: {
  entry: ContinuityEntry
  onEdit: () => void
  onDelete: () => void
  onPhotoClick: (src: string) => void
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 hover:border-border transition-colors group flex flex-col gap-3">
      {/* Category + scene/cast */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={categoryVariant(entry.category) as any} className="text-[10px] font-bold uppercase tracking-[0.06em]">
            {categoryLabel(entry.category)}
          </Badge>
          {entry.scene_number && (
            <span className="text-xs text-muted-foreground/70">Szene {entry.scene_number}</span>
          )}
          {entry.cast_name && (
            <span className="text-xs text-muted-foreground/50">· {entry.cast_name}</span>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-foreground/80 leading-relaxed flex-1">{entry.description}</p>

      {/* Photos */}
      {entry.photos && entry.photos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {entry.photos.slice(0, 6).map((src, i) => (
            <PhotoThumb key={i} src={src} onClick={() => onPhotoClick(src)} />
          ))}
          {entry.photos.length > 6 && (
            <div className="w-16 h-16 rounded-lg border border-border/60 flex items-center justify-center text-xs text-muted-foreground/60 bg-muted/30">
              +{entry.photos.length - 6}
            </div>
          )}
        </div>
      )}

      {/* Actions (hover) */}
      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity pt-0.5 border-t border-border/30">
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="h-7 px-2.5 text-xs active:scale-[0.97]"
        >
          <Pencil className="h-3 w-3 mr-1.5" />
          Bearbeiten
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2.5 text-xs text-destructive hover:text-destructive active:scale-[0.97]"
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3 mr-1.5" />
          Löschen
        </Button>
      </div>
    </div>
  )
}

// ─── Entry form dialog ────────────────────────────────────────────────────────

interface EntryForm {
  scene_id: string
  cast_id: string
  category: string
  description: string
  photos: string[]
}

function EntryDialog({
  open,
  onClose,
  pid,
  entry,
  scenes,
  cast,
}: {
  open: boolean
  onClose: () => void
  pid: number
  entry?: ContinuityEntry
  scenes: Scene[]
  cast: CastMember[]
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<EntryForm>({
    scene_id: entry ? String(entry.scene_id ?? '') : '',
    cast_id: entry ? String(entry.cast_id ?? '') : '',
    category: entry?.category ?? 'kostüm',
    description: entry?.description ?? '',
    photos: entry?.photos ?? [],
  })

  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        scene_id: form.scene_id ? Number(form.scene_id) : null,
        cast_id: form.cast_id ? Number(form.cast_id) : null,
        category: form.category,
        description: form.description,
        photos: form.photos,
      }
      const url = entry
        ? `/api/projects/${pid}/continuity/${entry.id}`
        : `/api/projects/${pid}/continuity`
      const res = await fetch(url, {
        method: entry ? 'PATCH' : 'POST',
        headers,
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Fehler')
      return (await res.json()).data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['continuity', pid] })
      toast({ title: entry ? 'Eintrag aktualisiert' : 'Eintrag erstellt' })
      onClose()
    },
    onError: () => toast({ variant: 'destructive', title: 'Fehler beim Speichern' }),
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => {
        const dataUrl = ev.target?.result as string
        setForm(prev => ({ ...prev, photos: [...prev.photos, dataUrl] }))
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const removePhoto = (i: number) => {
    setForm(prev => ({ ...prev, photos: prev.photos.filter((_, idx) => idx !== i) }))
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entry ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Szene</label>
              <Select value={form.scene_id} onValueChange={v => setForm(p => ({ ...p, scene_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Szene wählen…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Keine</SelectItem>
                  {scenes.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.scene_number}{s.title ? ` – ${s.title}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Darsteller</label>
              <Select value={form.cast_id} onValueChange={v => setForm(p => ({ ...p, cast_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Keine</SelectItem>
                  {cast.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Kategorie</label>
            <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Beschreibung</label>
            <textarea
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Beschreibung…"
              rows={3}
              className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm focus:outline-none focus:border-ring/70 focus:ring-2 focus:ring-ring/20 resize-none"
            />
          </div>

          {/* Photos */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Fotos</label>
            <div className="flex flex-wrap gap-2">
              {form.photos.map((src, i) => (
                <div key={i} className="relative group/photo">
                  <img src={src} alt="" className="w-16 h-16 object-cover rounded-lg border border-border/60" />
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-opacity"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-16 h-16 rounded-lg border-2 border-dashed border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-colors"
              >
                <Camera className="h-5 w-5" />
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="active:scale-[0.97]">
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function Component() {
  const { projectId: id } = useParams<{ projectId: string }>()
  const pid = Number(id)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [filterScene, setFilterScene] = useState('all')
  const [filterCast, setFilterCast] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [showDialog, setShowDialog] = useState(false)
  const [editEntry, setEditEntry] = useState<ContinuityEntry | undefined>()
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // Build query params
  const params = new URLSearchParams()
  if (filterScene !== 'all') params.set('scene_id', filterScene)
  if (filterCast !== 'all') params.set('cast_id', filterCast)
  if (filterCategory !== 'all') params.set('category', filterCategory)

  const { data: entries, isLoading } = useQuery<ContinuityEntry[]>({
    queryKey: ['continuity', pid, filterScene, filterCast, filterCategory],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${pid}/continuity?${params}`, { headers })
      if (!res.ok) throw new Error('Fehler')
      return (await res.json()).data
    },
  })

  const { data: scenes } = useQuery<Scene[]>({
    queryKey: ['scenes', pid],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${pid}/scenes`, { headers })
      if (!res.ok) throw new Error('Fehler')
      return (await res.json()).data
    },
  })

  const { data: cast } = useQuery<CastMember[]>({
    queryKey: ['cast', pid],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${pid}/cast`, { headers })
      if (!res.ok) throw new Error('Fehler')
      return (await res.json()).data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (entryId: number) => {
      const res = await fetch(`/api/projects/${pid}/continuity/${entryId}`, {
        method: 'DELETE',
        headers,
      })
      if (!res.ok) throw new Error('Fehler')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['continuity', pid] })
      toast({ title: 'Eintrag gelöscht' })
    },
    onError: () => toast({ variant: 'destructive', title: 'Fehler beim Löschen' }),
  })

  const allEntries = entries ?? []

  // Category stats
  const categoryCounts = CATEGORIES.map(c => ({
    ...c,
    count: allEntries.filter(e => e.category === c.value).length,
  })).filter(c => c.count > 0)

  return (
    <div className="p-7 max-w-6xl mx-auto animate-fade-up">
      {/* Page hero */}
      <div className="mb-8 pb-7 border-b border-border/40">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-[34px] sm:text-[40px]">Continuity</h1>
            <p className="text-sm text-muted-foreground/60 mt-1.5">
              {allEntries.length === 0
                ? 'Keine Einträge vorhanden'
                : `${allEntries.length} ${allEntries.length === 1 ? 'Eintrag' : 'Einträge'}`}
            </p>
          </div>
          <Button
            onClick={() => { setEditEntry(undefined); setShowDialog(true) }}
            className="active:scale-[0.97] shrink-0"
          >
            <Plus className="mr-2 h-4 w-4" />
            Neuer Eintrag
          </Button>
        </div>

        {/* Category stats chips */}
        {categoryCounts.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-5">
            <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40 self-center mr-1">
              Kategorien
            </span>
            {categoryCounts.map(c => (
              <button
                key={c.value}
                onClick={() => setFilterCategory(filterCategory === c.value ? 'all' : c.value)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border active:scale-[0.97] ${
                  filterCategory === c.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/50 text-muted-foreground border-border/60 hover:border-border hover:text-foreground'
                }`}
              >
                {c.label}
                <span className={`rounded-full px-1.5 py-px text-[10px] font-bold ${
                  filterCategory === c.value ? 'bg-primary-foreground/20' : 'bg-muted-foreground/10'
                }`}>
                  {c.count}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40 mr-1">
          Filter
        </span>
        <Select value={filterScene} onValueChange={setFilterScene}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="Alle Szenen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Szenen</SelectItem>
            {(scenes ?? []).map(s => (
              <SelectItem key={s.id} value={String(s.id)}>Szene {s.scene_number}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterCast} onValueChange={setFilterCast}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="Alle Darsteller" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Darsteller</SelectItem>
            {(cast ?? []).map(c => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="Alle Kategorien" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Kategorien</SelectItem>
            {CATEGORIES.map(c => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(filterScene !== 'all' || filterCast !== 'all' || filterCategory !== 'all') && (
          <button
            onClick={() => { setFilterScene('all'); setFilterCast('all'); setFilterCategory('all') }}
            className="h-8 px-2.5 text-xs text-muted-foreground/60 hover:text-foreground flex items-center gap-1.5 rounded-lg border border-border/60 hover:border-border transition-colors active:scale-[0.97]"
          >
            <X className="h-3 w-3" />
            Zurücksetzen
          </button>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : allEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center">
            <Film className="h-5 w-5 opacity-20" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground/60">Keine Einträge gefunden</p>
            <p className="text-xs text-muted-foreground/40 mt-1">Erstelle deinen ersten Continuity-Eintrag</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {allEntries.map(e => (
            <ContinuityCard
              key={e.id}
              entry={e}
              onEdit={() => { setEditEntry(e); setShowDialog(true) }}
              onDelete={() => deleteMutation.mutate(e.id)}
              onPhotoClick={src => setLightboxSrc(src)}
            />
          ))}
        </div>
      )}

      {/* Form dialog */}
      {showDialog && (
        <EntryDialog
          open={showDialog}
          onClose={() => { setShowDialog(false); setEditEntry(undefined) }}
          pid={pid}
          entry={editEntry}
          scenes={scenes ?? []}
          cast={cast ?? []}
        />
      )}

      {/* Lightbox */}
      {lightboxSrc && (
        <Dialog open onOpenChange={() => setLightboxSrc(null)}>
          <DialogContent className="max-w-4xl p-2 bg-black border-0">
            <button
              onClick={() => setLightboxSrc(null)}
              className="absolute top-3 right-3 z-10 text-white bg-black/50 rounded-full p-1"
            >
              <X className="h-5 w-5" />
            </button>
            <img src={lightboxSrc} alt="" className="max-h-[85vh] w-full object-contain rounded" />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
