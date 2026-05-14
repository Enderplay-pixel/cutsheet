import { useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Trash2, X, Image } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface MoodboardItem {
  id: number
  title: string
  image_url: string
  category: string
  notes: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'allgemein',  label: 'Allgemein' },
  { value: 'kamera',     label: 'Kamera' },
  { value: 'licht',      label: 'Licht' },
  { value: 'kostüm',     label: 'Kostüm' },
  { value: 'set',        label: 'Set' },
  { value: 'maske',      label: 'Maske' },
  { value: 'referenz',   label: 'Referenz' },
]

const CATEGORY_VARIANTS: Record<string, string> = {
  allgemein: 'secondary',
  kamera:    'blue',
  licht:     'amber',
  kostüm:    'purple',
  set:       'green',
  maske:     'cyan',
  referenz:  'red',
}

function catLabel(val: string) {
  return CATEGORIES.find(c => c.value === val)?.label ?? val
}
function catVariant(val: string): any {
  return CATEGORY_VARIANTS[val] ?? 'secondary'
}

// ─── Add image dialog ─────────────────────────────────────────────────────────

function AddImageDialog({ open, onClose, pid }: { open: boolean; onClose: () => void; pid: number }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [tab, setTab] = useState('url')
  const [imageUrl, setImageUrl] = useState('')
  const [imageBase64, setImageBase64] = useState('')
  const [previewSrc, setPreviewSrc] = useState('')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('allgemein')
  const [notes, setNotes] = useState('')

  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const finalUrl = tab === 'url' ? imageUrl : imageBase64
      const res = await fetch(`/api/projects/${pid}/moodboard`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ title, image_url: finalUrl, category, notes }),
      })
      if (!res.ok) throw new Error('Fehler')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moodboard', pid] })
      toast({ title: 'Bild hinzugefügt' })
      onClose()
    },
    onError: () => toast({ variant: 'destructive', title: 'Fehler beim Speichern' }),
  })

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string
      setImageBase64(dataUrl)
      setPreviewSrc(dataUrl)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const canSave = title.trim() !== '' && (tab === 'url' ? imageUrl.trim() !== '' : imageBase64 !== '')

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bild hinzufügen</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="url" className="flex-1">URL eingeben</TabsTrigger>
              <TabsTrigger value="datei" className="flex-1">Datei hochladen</TabsTrigger>
            </TabsList>
            <TabsContent value="url" className="mt-3">
              <Input
                value={imageUrl}
                onChange={e => { setImageUrl(e.target.value); setPreviewSrc(e.target.value) }}
                placeholder="https://…"
              />
            </TabsContent>
            <TabsContent value="datei" className="mt-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-32 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                <Image className="h-6 w-6" />
                <span className="text-sm">Klicken zum Hochladen</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFile}
              />
            </TabsContent>
          </Tabs>

          {/* Preview */}
          {previewSrc && (
            <div className="relative">
              <img
                src={previewSrc}
                alt=""
                className="w-full max-h-40 object-cover rounded-lg border border-border"
                onError={() => setPreviewSrc('')}
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium">Titel *</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titel…" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Kategorie</label>
            <Select value={category} onValueChange={setCategory}>
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
            <label className="text-sm font-medium">Notizen</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notizen…"
              rows={2}
              className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm focus:outline-none focus:border-ring/70 focus:ring-2 focus:ring-ring/20 resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!canSave || saveMutation.isPending}>
            Hinzufügen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Moodboard card ───────────────────────────────────────────────────────────

function MoodboardCard({
  item,
  onDelete,
  onClick,
}: {
  item: MoodboardItem
  onDelete: () => void
  onClick: () => void
}) {
  return (
    <div className="relative group break-inside-avoid mb-4 rounded-xl overflow-hidden border border-border cursor-pointer" onClick={onClick}>
      <img
        src={item.image_url}
        alt={item.title}
        className="w-full object-cover block"
        style={{ minHeight: '80px' }}
      />

      {/* Category badge always visible */}
      <div className="absolute top-2 left-2">
        <Badge variant={catVariant(item.category)} className="text-[10px] shadow">
          {catLabel(item.category)}
        </Badge>
      </div>

      {/* Delete button */}
      <button
        onClick={e => { e.stopPropagation(); onDelete() }}
        className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {/* Hover overlay with title + notes */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-8 translate-y-full group-hover:translate-y-0 transition-transform">
        <p className="text-white text-sm font-semibold leading-snug">{item.title}</p>
        {item.notes && (
          <p className="text-white/70 text-xs mt-0.5 line-clamp-2">{item.notes}</p>
        )}
      </div>

      {/* Title strip always */}
      <div className="bg-card px-3 py-2 group-hover:hidden">
        <p className="text-sm font-medium truncate">{item.title}</p>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function Component() {
  const { id } = useParams<{ id: string }>()
  const pid = Number(id)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [filterCategory, setFilterCategory] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [lightboxItem, setLightboxItem] = useState<MoodboardItem | null>(null)

  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const { data: items, isLoading } = useQuery<MoodboardItem[]>({
    queryKey: ['moodboard', pid],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${pid}/moodboard`, { headers })
      if (!res.ok) throw new Error('Fehler')
      return res.json()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (itemId: number) => {
      const res = await fetch(`/api/projects/${pid}/moodboard/${itemId}`, {
        method: 'DELETE',
        headers,
      })
      if (!res.ok) throw new Error('Fehler')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moodboard', pid] })
      toast({ title: 'Bild entfernt' })
    },
    onError: () => toast({ variant: 'destructive', title: 'Fehler beim Löschen' }),
  })

  const allItems = items ?? []
  const filtered = filterCategory === 'all'
    ? allItems
    : allItems.filter(i => i.category === filterCategory)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Moodboard</h1>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Bild hinzufügen
        </Button>
      </div>

      {/* Category filter tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterCategory('all')}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${filterCategory === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
        >
          Alle
        </button>
        {CATEGORIES.map(c => (
          <button
            key={c.value}
            onClick={() => setFilterCategory(c.value)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${filterCategory === c.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div style={{ columns: '1 300px', gap: '1rem' }}>
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="mb-4 break-inside-avoid" style={{ height: `${140 + (i % 3) * 60}px` }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Image className="h-12 w-12 opacity-30" />
          <p>Keine Bilder vorhanden. Füge dein erstes Bild hinzu!</p>
        </div>
      ) : (
        <div style={{ columns: '1 280px', gap: '1rem' }}>
          {filtered.map(item => (
            <MoodboardCard
              key={item.id}
              item={item}
              onDelete={() => deleteMutation.mutate(item.id)}
              onClick={() => setLightboxItem(item)}
            />
          ))}
        </div>
      )}

      {/* Add dialog */}
      {showAdd && (
        <AddImageDialog open={showAdd} onClose={() => setShowAdd(false)} pid={pid} />
      )}

      {/* Lightbox */}
      {lightboxItem && (
        <Dialog open onOpenChange={() => setLightboxItem(null)}>
          <DialogContent className="max-w-5xl p-0 overflow-hidden border-0 bg-black">
            <button
              onClick={() => setLightboxItem(null)}
              className="absolute top-3 right-3 z-10 text-white bg-black/60 rounded-full p-1.5 hover:bg-black/80 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={lightboxItem.image_url}
              alt={lightboxItem.title}
              className="max-h-[85vh] w-full object-contain"
            />
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-6 py-4">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={catVariant(lightboxItem.category)}>
                  {catLabel(lightboxItem.category)}
                </Badge>
                <span className="text-white font-semibold">{lightboxItem.title}</span>
              </div>
              {lightboxItem.notes && (
                <p className="text-white/70 text-sm">{lightboxItem.notes}</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
