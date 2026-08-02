import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { useDownload } from '@/lib/useDownload'
import { Plus, Trash2, Upload, Download, RotateCw, LayoutGrid, ImageOff } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Muss zur Liste im Server (lib/floorplan.ts) passen. */
const ITEM_TYPES = [
  { kind: 'kamera', label: 'Kamera', directional: true, color: '#2563eb', glyph: 'CAM' },
  { kind: 'licht', label: 'Licht', directional: true, color: '#f59e0b', glyph: 'LI' },
  { kind: 'praktikable', label: 'Praktikable', directional: false, color: '#eab308', glyph: 'PR' },
  { kind: 'ton', label: 'Mikrofon', directional: true, color: '#10b981', glyph: 'MIC' },
  { kind: 'darsteller', label: 'Darsteller', directional: false, color: '#ef4444', glyph: 'D' },
  { kind: 'requisite', label: 'Requisite', directional: false, color: '#8b5cf6', glyph: 'RQ' },
  { kind: 'moebel', label: 'Möbel', directional: false, color: '#78716c', glyph: 'MB' },
  { kind: 'tuer', label: 'Tür', directional: false, color: '#0891b2', glyph: 'TÜR' },
  { kind: 'fenster', label: 'Fenster', directional: false, color: '#06b6d4', glyph: 'FEN' },
  { kind: 'monitor', label: 'Monitor', directional: false, color: '#64748b', glyph: 'MON' },
  { kind: 'marker', label: 'Markierung', directional: false, color: '#db2777', glyph: '×' },
]
const typeOf = (kind: string) => ITEM_TYPES.find(t => t.kind === kind) ?? ITEM_TYPES[ITEM_TYPES.length - 1]

/** Nächste Beschriftung: Kameras bekommen Buchstaben, alles andere Zahlen. */
function nextLabel(kind: string, items: any[]): string {
  const n = items.filter(i => i.kind === kind).length
  if (kind !== 'kamera') return String(n + 1)
  let label = ''
  let rest = n
  do {
    label = String.fromCharCode(65 + (rest % 26)) + label
    rest = Math.floor(rest / 26) - 1
  } while (rest >= 0)
  return label
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const download = useDownload()

  const [activeId, setActiveId] = useState<number | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: plans, isLoading } = useQuery({
    queryKey: ['floorplans', pid],
    queryFn: () => api.floorplans.list(pid),
  })

  const planId = activeId ?? (plans?.[0]?.id ?? null)

  const { data: detail } = useQuery({
    queryKey: ['floorplan', planId],
    queryFn: () => api.floorplans.get(planId as number),
    enabled: planId != null,
  })

  const plan = detail?.plan
  const items: any[] = detail?.items ?? []

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['floorplan', planId] })
    queryClient.invalidateQueries({ queryKey: ['floorplans', pid] })
  }
  const fail = (title: string) => (err: any) =>
    toast({ title, description: err?.message, variant: 'destructive' })

  const createPlan = useMutation({
    mutationFn: () => api.floorplans.create(pid, { name: 'Neuer Set-Plan' }),
    onSuccess: (p: any) => { setActiveId(p.id); refresh() },
    onError: fail('Plan nicht angelegt'),
  })
  const updatePlan = useMutation({
    mutationFn: (patch: any) => api.floorplans.update(planId as number, patch),
    onSuccess: refresh, onError: fail('Nicht gespeichert'),
  })
  const deletePlan = useMutation({
    mutationFn: () => api.floorplans.remove(planId as number),
    onSuccess: () => { setActiveId(null); refresh() },
    onError: fail('Löschen fehlgeschlagen'),
  })
  const addItem = useMutation({
    mutationFn: (kind: string) => api.floorplans.addItem(planId as number, {
      kind, label: nextLabel(kind, items), x: 0.5, y: 0.5, rotation: 0, size: 100,
    }),
    onSuccess: (i: any) => { setSelected(i.id); refresh() },
    onError: fail('Element nicht angelegt'),
  })
  const updateItem = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: any }) => api.floorplans.updateItem(id, patch),
    onSuccess: refresh, onError: fail('Nicht gespeichert'),
  })
  const removeItem = useMutation({
    mutationFn: (id: number) => api.floorplans.deleteItem(id),
    onSuccess: () => { setSelected(null); refresh() },
    onError: fail('Löschen fehlgeschlagen'),
  })

  async function uploadImage(file: File) {
    const form = new FormData()
    form.append('image', file)
    const token = localStorage.getItem('token')
    const res = await fetch(`/api/floorplans/${planId}/image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    if (!res.ok) {
      let msg = `HTTP ${res.status}`
      try { const j = await res.json(); if (j?.error) msg = j.error } catch { /* kein JSON */ }
      return toast({ title: 'Bild nicht hochgeladen', description: msg, variant: 'destructive' })
    }
    refresh()
  }

  /** Zeigerposition auf relative Koordinaten zwischen 0 und 1 umrechnen. */
  function relativePosition(e: React.PointerEvent) {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0 || rect.height <= 0) return null
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (dragging === null) return
    const pos = relativePosition(e)
    if (!pos) return
    // Nur lokal verschieben; gespeichert wird beim Loslassen, sonst entsteht
    // pro Mausbewegung ein Request
    const el = document.getElementById(`sym-${dragging}`)
    if (el) {
      el.style.left = `${pos.x * 100}%`
      el.style.top = `${pos.y * 100}%`
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    if (dragging === null) return
    const pos = relativePosition(e)
    if (pos) updateItem.mutate({ id: dragging, patch: pos })
    setDragging(null)
  }

  const selectedItem = items.find(i => i.id === selected) ?? null
  const list = (plans ?? []) as any[]

  if (isLoading) {
    return <div className="p-6 space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-96 w-full" /></div>
  }

  return (
    <div className="p-6 max-w-[1400px]">
      <PageHeader
        title="Set-Plan"
        subtitle="Grundriss hochladen, dann Kamera, Licht und Ton daraufziehen"
        actions={
          <div className="flex gap-2">
            {planId != null && (
              <Button variant="outline" size="sm"
                onClick={() => download(api.floorplans.pdfUrl(planId), 'set-plan.pdf')}>
                <Download className="w-3.5 h-3.5 mr-1.5" />PDF
              </Button>
            )}
            <Button size="sm" onClick={() => createPlan.mutate()}>
              <Plus className="w-4 h-4 mr-1.5" />Neuer Plan
            </Button>
          </div>
        }
      />

      {list.length === 0 ? (
        <div className="border border-dashed border-border/60 rounded-lg py-16 text-center">
          <LayoutGrid className="w-9 h-9 mx-auto text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium">Noch kein Set-Plan angelegt</p>
          <p className="mt-1 text-xs text-muted-foreground/70 max-w-md mx-auto">
            Lade einen Grundriss oder ein Foto des Raums hoch und stelle Kamera, Licht und Ton
            an ihre Position. Der Plan lässt sich als PDF drucken und zur Tagesdispo legen.
          </p>
          <Button size="sm" className="mt-4" onClick={() => createPlan.mutate()}>
            <Plus className="w-4 h-4 mr-1.5" />Ersten Plan anlegen
          </Button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[210px_1fr_230px] gap-4">
          {/* Pläne */}
          <div className="space-y-1">
            {list.map(p => (
              <button
                key={p.id}
                onClick={() => { setActiveId(p.id); setSelected(null) }}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors',
                  p.id === planId ? 'border-primary bg-primary/5' : 'border-border/50 hover:bg-muted/40'
                )}
              >
                <div className="font-medium truncate">{p.name}</div>
                <div className="text-[11px] text-muted-foreground/70">
                  {p.scene_number ? `Szene ${p.scene_number} · ` : ''}{p.item_count} Element{p.item_count === 1 ? '' : 'e'}
                </div>
              </button>
            ))}
          </div>

          {/* Plan */}
          <div>
            {/* Die Bezugsflaeche fuer die Positionen muss genau das Bild sein —
                im PDF ist sie es auch. Waere sie hier der breitere Container,
                saessen dieselben Koordinaten im Druck an anderer Stelle. */}
            <div className="text-center">
            <div
              ref={stageRef}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
              className={cn(
                'relative inline-block max-w-full rounded-lg border border-border/60 bg-muted/20 overflow-hidden select-none align-top',
                !plan?.image_url && 'w-full min-h-[420px]'
              )}
            >
              {plan?.image_url ? (
                // Hoehe mitbegrenzen: Ein hochformatiger Grundriss wuerde sonst
                // den halben Bildschirm einnehmen
                <img src={plan.image_url} alt="" className="block max-w-full max-h-[70vh] w-auto pointer-events-none" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/50">
                  <ImageOff className="w-8 h-8" />
                  <p className="mt-2 text-xs">Noch kein Grundriss hochgeladen</p>
                </div>
              )}

              {items.map(i => {
                const t = typeOf(i.kind)
                const scale = (i.size ?? 100) / 100
                return (
                  <div
                    key={i.id}
                    id={`sym-${i.id}`}
                    onPointerDown={e => {
                      e.preventDefault()
                      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
                      setSelected(i.id)
                      setDragging(i.id)
                    }}
                    style={{ left: `${i.x * 100}%`, top: `${i.y * 100}%` }}
                    className={cn(
                      'absolute -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none',
                      dragging === i.id && 'cursor-grabbing'
                    )}
                  >
                    {t.directional && (
                      <div
                        className="absolute left-1/2 top-1/2 origin-bottom pointer-events-none"
                        style={{
                          width: 30 * scale, height: 46 * scale,
                          transform: `translate(-50%,-100%) rotate(${i.rotation ?? 0}deg)`,
                          background: `linear-gradient(to top, ${t.color}66, transparent)`,
                          clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
                        }}
                      />
                    )}
                    <div
                      className={cn(
                        'relative rounded-full text-white font-bold flex items-center justify-center border-2 border-white',
                        selected === i.id && 'ring-2 ring-offset-1 ring-primary'
                      )}
                      style={{
                        width: 22 * scale, height: 22 * scale,
                        fontSize: 8 * scale, background: t.color,
                      }}
                    >
                      {t.glyph}
                    </div>
                    {i.label && (
                      <div
                        className="absolute left-1/2 top-full -translate-x-1/2 mt-0.5 whitespace-nowrap
                                   bg-background border rounded px-1 font-bold pointer-events-none"
                        style={{ fontSize: 8 * scale, borderColor: t.color }}
                      >
                        {i.label}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            </div>

            {/* Symbolpalette */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {ITEM_TYPES.map(t => (
                <button
                  key={t.kind}
                  onClick={() => addItem.mutate(t.kind)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border/50 text-xs hover:bg-muted/50"
                >
                  <span className="w-3 h-3 rounded-full" style={{ background: t.color }} />
                  {t.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground/70">
              Symbol anklicken, um es hinzuzufügen — dann auf dem Plan an die richtige Stelle ziehen.
            </p>
          </div>

          {/* Einstellungen */}
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input
                key={plan?.id} defaultValue={plan?.name} className="mt-1 text-sm"
                onBlur={e => e.target.value !== plan?.name && updatePlan.mutate({ name: e.target.value })}
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Grundriss</Label>
              <input
                ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = '' }}
              />
              <Button variant="outline" size="sm" className="mt-1 w-full" onClick={() => fileRef.current?.click()}>
                <Upload className="w-3.5 h-3.5 mr-1.5" />{plan?.image_url ? 'Bild ersetzen' : 'Bild hochladen'}
              </Button>
            </div>

            {selectedItem ? (
              <div className="pt-3 border-t border-border/50 space-y-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground/70">
                  {typeOf(selectedItem.kind).label}
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Beschriftung</Label>
                  <Input
                    key={selectedItem.id} defaultValue={selectedItem.label} className="mt-1 text-sm"
                    onBlur={e => e.target.value !== selectedItem.label &&
                      updateItem.mutate({ id: selectedItem.id, patch: { label: e.target.value } })}
                  />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Typ</Label>
                  <Select value={selectedItem.kind}
                    onValueChange={k => updateItem.mutate({ id: selectedItem.id, patch: { kind: k } })}>
                    <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ITEM_TYPES.map(t => <SelectItem key={t.kind} value={t.kind} className="text-xs">{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {typeOf(selectedItem.kind).directional && (
                  <div>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <RotateCw className="w-3 h-3" />Blickrichtung: {selectedItem.rotation ?? 0}°
                    </Label>
                    <input
                      type="range" min="0" max="359" value={selectedItem.rotation ?? 0} className="w-full mt-1"
                      onChange={e => updateItem.mutate({ id: selectedItem.id, patch: { rotation: Number(e.target.value) } })}
                    />
                  </div>
                )}

                <div>
                  <Label className="text-xs text-muted-foreground">Größe: {selectedItem.size ?? 100} %</Label>
                  <input
                    type="range" min="40" max="300" step="10" value={selectedItem.size ?? 100} className="w-full mt-1"
                    onChange={e => updateItem.mutate({ id: selectedItem.id, patch: { size: Number(e.target.value) } })}
                  />
                </div>

                <Button variant="ghost" size="sm" className="w-full text-muted-foreground hover:text-destructive"
                  onClick={() => removeItem.mutate(selectedItem.id)}>
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />Element entfernen
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/70 pt-3 border-t border-border/50">
                Ein Element auf dem Plan anklicken, um Beschriftung, Richtung und Größe zu ändern.
              </p>
            )}

            <div className="pt-3 border-t border-border/50">
              <Label className="text-xs text-muted-foreground">Notizen</Label>
              <Textarea
                key={plan?.id} defaultValue={plan?.notes} rows={4} className="mt-1 text-sm"
                placeholder="Fenster abkleben, Steckdose links defekt …"
                onBlur={e => e.target.value !== plan?.notes && updatePlan.mutate({ notes: e.target.value })}
              />
            </div>

            <Button variant="ghost" size="sm" className="w-full text-muted-foreground hover:text-destructive"
              onClick={() => { if (confirm(`„${plan?.name}“ löschen?`)) deletePlan.mutate() }}>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />Plan löschen
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
