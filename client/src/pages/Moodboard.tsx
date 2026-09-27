import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { Image, StickyNote, Palette, X, Upload, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface MoodItem {
  id: number
  title: string
  image_url: string
  category: string
  notes: string
  position_x: number
  position_y: number
  width: number
}

type ItemType = 'image' | 'note' | 'color'

function getType(item: MoodItem): ItemType {
  if (!item.image_url || item.image_url === '') return 'note'
  if (item.image_url.startsWith('#') || item.image_url.startsWith('rgb')) return 'color'
  return 'image'
}

// Notizfarben als Farbton — Hintergrund und Schrift folgen dem Hell/Dunkel-Modus
const NOTE_COLORS = [
  { hue: 38, label: 'Amber' },
  { hue: 211, label: 'Blau' },
  { hue: 140, label: 'Grün' },
  { hue: 280, label: 'Lila' },
  { hue: 3, label: 'Rot' },
].map(({ hue, label }) => ({
  bg: `hsl(${hue} 80% var(--note-bg-l))`,
  border: `hsl(${hue} 70% var(--note-border-l))`,
  text: `hsl(${hue} 60% var(--note-text-l))`,
  label,
}))

const CANVAS_W = 3200
const CANVAS_H = 2400

// ─── API helpers ──────────────────────────────────────────────────────────────

function authHeaders() {
  const t = localStorage.getItem('token')
  return { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }
}

// ─── Card components ──────────────────────────────────────────────────────────

function ImageCard({ item, onDelete }: { item: MoodItem; onDelete: () => void }) {
  const [imgError, setImgError] = useState(false)
  return (
    <div className="relative group">
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onDelete() }}
        className="absolute -top-2.5 -right-2.5 z-20 w-6 h-6 rounded-full bg-destructive text-foreground flex items-center justify-center opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity shadow-lg active:scale-90"
      >
        <X className="w-3 h-3" />
      </button>

      <div className="rounded-xl overflow-hidden border border-foreground/[0.08] bg-card shadow-xl" style={{ width: item.width }}>
        {imgError ? (
          <div className="flex items-center justify-center bg-foreground/[0.05] text-muted-foreground/70" style={{ height: 140 }}>
            <Image className="w-8 h-8" />
          </div>
        ) : (
          <img
            src={item.image_url}
            alt={item.title}
            className="w-full object-cover block"
            style={{ maxHeight: 280, minHeight: 80 }}
            onError={() => setImgError(true)}
            draggable={false}
          />
        )}
        {(item.title || item.notes) && (
          <div className="px-3 py-2.5">
            {item.title && <p className="text-[13px] font-medium text-foreground/90 leading-snug">{item.title}</p>}
            {item.notes && <p className="text-[11px] text-foreground/40 mt-0.5 leading-relaxed line-clamp-2">{item.notes}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

function NoteCard({ item, onDelete }: { item: MoodItem; onDelete: () => void }) {
  const colorIdx = Math.abs((item.id || 0) * 7) % NOTE_COLORS.length
  const c = NOTE_COLORS[colorIdx]
  return (
    <div className="relative group">
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onDelete() }}
        className="absolute -top-2.5 -right-2.5 z-20 w-6 h-6 rounded-full bg-destructive text-foreground flex items-center justify-center opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity shadow-lg active:scale-90"
      >
        <X className="w-3 h-3" />
      </button>
      <div
        className="rounded-xl border shadow-xl p-4"
        style={{ width: item.width, backgroundColor: c.bg, borderColor: c.border }}
      >
        {item.title && (
          <p className="text-[13px] font-semibold mb-1.5 leading-snug" style={{ color: c.text }}>{item.title}</p>
        )}
        {item.notes && (
          <p className="text-[12px] leading-relaxed" style={{ color: c.text, opacity: 0.8 }}>{item.notes}</p>
        )}
        {!item.title && !item.notes && (
          <p className="text-[12px] italic" style={{ color: c.text, opacity: 0.4 }}>Leere Notiz…</p>
        )}
      </div>
    </div>
  )
}

function ColorCard({ item, onDelete }: { item: MoodItem; onDelete: () => void }) {
  return (
    <div className="relative group">
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onDelete() }}
        className="absolute -top-2.5 -right-2.5 z-20 w-6 h-6 rounded-full bg-destructive text-foreground flex items-center justify-center opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity shadow-lg active:scale-90"
      >
        <X className="w-3 h-3" />
      </button>
      <div className="rounded-xl border border-foreground/[0.1] shadow-xl overflow-hidden" style={{ width: item.width }}>
        <div className="flex items-center justify-center" style={{ backgroundColor: item.image_url, height: 100 }} />
        <div className="px-3 py-2 bg-card">
          {item.title && <p className="text-[12px] font-medium text-foreground/80">{item.title}</p>}
          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{item.image_url}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Canvas card (draggable wrapper) ─────────────────────────────────────────

function CanvasCard({
  item,
  onDelete,
  onMoveEnd,
}: {
  item: MoodItem
  onDelete: () => void
  onMoveEnd: (id: number, x: number, y: number) => void
}) {
  const posRef = useRef({ x: item.position_x, y: item.position_y })
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const elRef = useRef<HTMLDivElement>(null)

  // Keep pos in sync when server data changes (but not while dragging)
  useEffect(() => {
    if (!dragRef.current) {
      posRef.current = { x: item.position_x, y: item.position_y }
      if (elRef.current) {
        elRef.current.style.left = `${item.position_x}px`
        elRef.current.style.top = `${item.position_y}px`
      }
    }
  }, [item.position_x, item.position_y])

  function handlePointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: posRef.current.x,
      origY: posRef.current.y,
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragRef.current || !elRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    const nx = Math.max(0, dragRef.current.origX + dx)
    const ny = Math.max(0, dragRef.current.origY + dy)
    posRef.current = { x: nx, y: ny }
    elRef.current.style.left = `${nx}px`
    elRef.current.style.top = `${ny}px`
  }

  function handlePointerUp() {
    if (!dragRef.current) return
    const moved = Math.abs(posRef.current.x - dragRef.current.origX) + Math.abs(posRef.current.y - dragRef.current.origY)
    dragRef.current = null
    if (moved > 4) {
      onMoveEnd(item.id, posRef.current.x, posRef.current.y)
    }
  }

  const type = getType(item)

  return (
    <div
      ref={elRef}
      className="absolute cursor-grab active:cursor-grabbing select-none touch-none"
      style={{ left: item.position_x, top: item.position_y, zIndex: 10 }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {type === 'image' && <ImageCard item={item} onDelete={onDelete} />}
      {type === 'note'  && <NoteCard  item={item} onDelete={onDelete} />}
      {type === 'color' && <ColorCard item={item} onDelete={onDelete} />}
    </div>
  )
}

// ─── Add panel ────────────────────────────────────────────────────────────────

type AddMode = null | 'image-url' | 'image-file' | 'note' | 'color'

function AddPanel({
  pid,
  scrollRef,
  onAdded,
}: {
  pid: number
  scrollRef: React.RefObject<HTMLDivElement>
  onAdded: () => void
}) {
  const { toast } = useToast()
  const [mode, setMode] = useState<AddMode>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [color, setColor] = useState('#3b82f6')
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileBase64, setFileBase64] = useState('')

  function getDropPosition() {
    const el = scrollRef.current
    const cx = el ? el.scrollLeft + el.clientWidth / 2 : 400
    const cy = el ? el.scrollTop + el.clientHeight / 3 : 200
    return {
      x: Math.round(cx - 140 + (Math.random() - 0.5) * 120),
      y: Math.round(cy + (Math.random() - 0.5) * 80),
    }
  }

  const saveMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await fetch(`/api/projects/${pid}/moodboard`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Fehler')
      return (await res.json()).data
    },
    onSuccess: () => { onAdded(); reset() },
    onError: () => toast({ variant: 'destructive', title: 'Fehler beim Hinzufügen' }),
  })

  function reset() {
    setMode(null); setImageUrl(''); setTitle(''); setNotes(''); setFileBase64('')
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const r = new FileReader()
    r.onload = ev => setFileBase64(ev.target?.result as string)
    r.readAsDataURL(f)
    e.target.value = ''
  }

  function submit() {
    const pos = getDropPosition()
    if (mode === 'image-url') {
      saveMutation.mutate({ title, image_url: imageUrl, notes, category: 'allgemein', ...pos, width: 280 })
    } else if (mode === 'image-file') {
      saveMutation.mutate({ title, image_url: fileBase64, notes, category: 'allgemein', ...pos, width: 280 })
    } else if (mode === 'note') {
      saveMutation.mutate({ title, image_url: '', notes, category: 'notiz', ...pos, width: 240 })
    } else if (mode === 'color') {
      saveMutation.mutate({ title: title || color, image_url: color, notes, category: 'farbe', ...pos, width: 160 })
    }
  }

  const canSubmit = mode === 'image-url' ? imageUrl.trim() !== ''
    : mode === 'image-file' ? fileBase64 !== ''
    : mode === 'note' ? (title.trim() !== '' || notes.trim() !== '')
    : mode === 'color' ? true
    : false

  if (mode === null) {
    return (
      <div className="flex items-center gap-2 bg-popover/90 backdrop-blur border border-foreground/[0.1] rounded-2xl px-4 py-2.5 shadow-2xl">
        <span className="text-[11px] text-muted-foreground font-medium mr-1">Hinzufügen</span>
        {[
          { icon: Image,      label: 'Bild URL',   m: 'image-url'  as AddMode },
          { icon: Upload,     label: 'Bild Datei', m: 'image-file' as AddMode },
          { icon: StickyNote, label: 'Notiz',      m: 'note'       as AddMode },
          { icon: Palette,    label: 'Farbe',      m: 'color'      as AddMode },
        ].map(({ icon: Icon, label, m }) => (
          <button
            key={label}
            onClick={() => setMode(m)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] text-foreground/60 hover:text-foreground hover:bg-foreground/[0.08] transition-colors"
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="bg-popover/95 backdrop-blur border border-foreground/[0.1] rounded-2xl px-5 py-4 shadow-2xl w-[340px]">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] font-medium text-foreground/80">
          {mode === 'image-url' ? 'Bild via URL' : mode === 'image-file' ? 'Bild hochladen' : mode === 'note' ? 'Notiz' : 'Farbe'}
        </p>
        <button onClick={reset} className="text-muted-foreground hover:text-foreground/60 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2.5">
        {(mode === 'image-url' || mode === 'image-file' || mode === 'note') && (
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Titel…"
            className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
            style={{ background: 'hsl(var(--foreground) / 0.07)', border: '1px solid hsl(var(--foreground) / 0.12)', color: 'hsl(var(--foreground) / 0.85)' }}
          />
        )}

        {mode === 'image-url' && (
          <input
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-lg px-3 py-2 text-[11px] font-mono outline-none"
            style={{ background: 'hsl(var(--foreground) / 0.07)', border: '1px solid hsl(var(--foreground) / 0.12)', color: 'hsl(var(--foreground) / 0.85)' }}
          />
        )}

        {mode === 'image-file' && (
          <>
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-colors"
              style={{ borderColor: fileBase64 ? 'hsl(var(--success) / 0.4)' : 'hsl(var(--foreground) / 0.12)', color: fileBase64 ? 'hsl(var(--success))' : 'hsl(var(--foreground) / 0.35)' }}
            >
              <Upload className="w-5 h-5" />
              <span className="text-[11px]">{fileBase64 ? 'Datei ausgewählt ✓' : 'Klicken zum Auswählen'}</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </>
        )}

        {mode === 'note' && (
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notizinhalt…"
            rows={3}
            className="w-full rounded-lg px-3 py-2 text-[13px] outline-none resize-none"
            style={{ background: 'hsl(var(--foreground) / 0.07)', border: '1px solid hsl(var(--foreground) / 0.12)', color: 'hsl(var(--foreground) / 0.85)' }}
          />
        )}

        {mode === 'color' && (
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="w-12 h-10 rounded-lg cursor-pointer"
              style={{ border: '1px solid hsl(var(--foreground) / 0.12)', background: 'transparent' }}
            />
            <input
              value={color}
              onChange={e => setColor(e.target.value)}
              placeholder="#3b82f6"
              className="flex-1 rounded-lg px-3 py-2 text-[13px] font-mono outline-none"
              style={{ background: 'hsl(var(--foreground) / 0.07)', border: '1px solid hsl(var(--foreground) / 0.12)', color: 'hsl(var(--foreground) / 0.85)' }}
            />
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={reset}
          className="flex-1 py-1.5 rounded-lg text-[12px] text-foreground/40 hover:text-foreground/60 transition-colors border border-foreground/[0.08] hover:border-foreground/[0.15]"
        >
          Abbrechen
        </button>
        <button
          onClick={submit}
          disabled={!canSubmit || saveMutation.isPending}
          className="flex-1 py-1.5 rounded-lg text-[12px] font-medium bg-foreground/[0.1] hover:bg-foreground/[0.15] disabled:opacity-40 text-foreground transition-colors active:scale-[0.97]"
        >
          Hinzufügen
        </button>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function Component() {
  const { projectId: id } = useParams<{ projectId: string }>()
  const pid = Number(id)
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: items = [], isLoading } = useQuery<MoodItem[]>({
    queryKey: ['moodboard', pid],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${pid}/moodboard`, { headers: authHeaders() })
      if (!res.ok) throw new Error('Fehler')
      return (await res.json()).data ?? []
    },
  })

  // Auto-scroll to item cluster on first load
  useEffect(() => {
    if (!items.length || !scrollRef.current) return
    const minX = Math.min(...items.map(i => i.position_x))
    const minY = Math.min(...items.map(i => i.position_y))
    scrollRef.current.scrollTo({ left: Math.max(0, minX - 80), top: Math.max(0, minY - 80), behavior: 'smooth' })
  }, [items.length > 0])

  const deleteMutation = useMutation({
    mutationFn: async (itemId: number) => {
      const res = await fetch(`/api/moodboard/${itemId}`, { method: 'DELETE', headers: authHeaders() })
      if (!res.ok) throw new Error()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['moodboard', pid] }),
    onError: () => toast({ variant: 'destructive', title: 'Fehler beim Löschen' }),
  })

  const moveMutation = useMutation({
    mutationFn: async ({ id: itemId, x, y }: { id: number; x: number; y: number }) => {
      const res = await fetch(`/api/moodboard/${itemId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ position_x: x, position_y: y }),
      })
      if (!res.ok) throw new Error()
      return (await res.json()).data
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<MoodItem[]>(['moodboard', pid], old =>
        old?.map(i => i.id === updated.id ? updated : i) ?? []
      )
    },
  })

  const handleMoveEnd = useCallback((itemId: number, x: number, y: number) => {
    moveMutation.mutate({ id: itemId, x, y })
  }, [])

  // Count by type for the mini legend
  const imageCount = items.filter(i => getType(i) === 'image').length
  const noteCount  = items.filter(i => getType(i) === 'note').length
  const colorCount = items.filter(i => getType(i) === 'color').length

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'hsl(var(--canvas))' }}>

      {/* Top bar */}
      <div className="flex items-center gap-4 px-5 py-3 border-b shrink-0" style={{ borderColor: 'hsl(var(--foreground) / 0.06)', background: 'hsl(var(--background))' }}>
        <p className="text-[13px] font-semibold text-foreground/80">Moodboard</p>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {imageCount > 0 && <span className="flex items-center gap-1"><Image className="w-3 h-3" />{imageCount}</span>}
          {noteCount  > 0 && <span className="flex items-center gap-1"><StickyNote className="w-3 h-3" />{noteCount}</span>}
          {colorCount > 0 && <span className="flex items-center gap-1"><Palette className="w-3 h-3" />{colorCount}</span>}
        </div>
        <div className="flex-1" />
        <span className="text-[11px] text-muted-foreground/70">Drag zum Verschieben</span>
      </div>

      {/* Canvas */}
      <div ref={scrollRef} className="flex-1 overflow-auto relative" style={{ cursor: 'default' }}>
        <div className="relative" style={{ width: CANVAS_W, height: CANVAS_H }}>

          {/* Dot grid background */}
          <svg className="absolute inset-0 pointer-events-none" width={CANVAS_W} height={CANVAS_H} style={{ opacity: 0.15 }}>
            <defs>
              <pattern id="dots" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="currentColor" className="text-foreground" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>

          {/* Loading */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-muted-foreground text-[13px]">Lädt…</div>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && items.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
              <div className="w-16 h-16 rounded-2xl bg-foreground/[0.04] flex items-center justify-center">
                <Image className="w-7 h-7 text-muted-foreground/70" />
              </div>
              <p className="text-[13px] text-muted-foreground">Board ist leer</p>
              <p className="text-[11px] text-muted-foreground/70">Füge Bilder, Notizen und Farben hinzu</p>
            </div>
          )}

          {/* Cards */}
          {items.map(item => (
            <CanvasCard
              key={item.id}
              item={item}
              onDelete={() => deleteMutation.mutate(item.id)}
              onMoveEnd={handleMoveEnd}
            />
          ))}
        </div>
      </div>

      {/* Canvas navigation arrows */}
      {[
        { dir: 'up',    Icon: ChevronUp,    style: { top: 72, left: '50%', transform: 'translateX(-50%)' } },
        { dir: 'down',  Icon: ChevronDown,  style: { bottom: 72, left: '50%', transform: 'translateX(-50%)' } },
        { dir: 'left',  Icon: ChevronLeft,  style: { left: 8, top: '50%', transform: 'translateY(-50%)' } },
        { dir: 'right', Icon: ChevronRight, style: { right: 8, top: '50%', transform: 'translateY(-50%)' } },
      ].map(({ dir, Icon, style }) => (
        <button
          key={dir}
          className="absolute z-40 w-8 h-8 rounded-full flex items-center justify-center transition-opacity opacity-30 hover:opacity-80"
          style={{ ...style, background: 'hsl(var(--foreground) / 0.1)', color: 'hsl(var(--foreground))' }}
          onClick={() => {
            const el = scrollRef.current
            if (!el) return
            const d = 200
            if (dir === 'up')    el.scrollBy({ top: -d, behavior: 'smooth' })
            if (dir === 'down')  el.scrollBy({ top:  d, behavior: 'smooth' })
            if (dir === 'left')  el.scrollBy({ left: -d, behavior: 'smooth' })
            if (dir === 'right') el.scrollBy({ left:  d, behavior: 'smooth' })
          }}
        >
          <Icon className="w-4 h-4" />
        </button>
      ))}

      {/* Floating add panel */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100%-1rem)] overflow-x-auto">
        <AddPanel pid={pid} scrollRef={scrollRef} onAdded={() => queryClient.invalidateQueries({ queryKey: ['moodboard', pid] })} />
      </div>
    </div>
  )
}
