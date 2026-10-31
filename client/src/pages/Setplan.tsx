import { useEffect, useRef, useState } from 'react'
import { useSchreibrecht } from '@/lib/useSchreibrecht'
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
import { useDownload, useGeschuetztesBild } from '@/lib/useDownload'
import { Plus, Trash2, Upload, Download, RotateCw, LayoutGrid, ImageOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/useT'
import { setplanT, setplanArtenT } from '@/lib/texte/Setplan'

/** Muss zur Liste im Server (lib/floorplan.ts) passen. */
const ITEM_TYPES = [
  { kind: 'kamera', label: setplanArtenT.kamera, directional: true, color: '#2563eb', glyph: 'CAM' },
  { kind: 'licht', label: setplanArtenT.licht, directional: true, color: '#f59e0b', glyph: 'LI' },
  { kind: 'praktikable', label: setplanArtenT.praktikable, directional: false, color: '#eab308', glyph: 'PR' },
  { kind: 'ton', label: setplanArtenT.ton, directional: true, color: '#10b981', glyph: 'MIC' },
  { kind: 'darsteller', label: setplanArtenT.darsteller, directional: false, color: '#ef4444', glyph: 'D' },
  { kind: 'requisite', label: setplanArtenT.requisite, directional: false, color: '#8b5cf6', glyph: 'RQ' },
  { kind: 'moebel', label: setplanArtenT.moebel, directional: false, color: '#78716c', glyph: 'MB' },
  { kind: 'tuer', label: setplanArtenT.tuer, directional: false, color: '#0891b2', glyph: 'TÜR' },
  { kind: 'fenster', label: setplanArtenT.fenster, directional: false, color: '#06b6d4', glyph: 'FEN' },
  { kind: 'monitor', label: setplanArtenT.monitor, directional: false, color: '#64748b', glyph: 'MON' },
  { kind: 'marker', label: setplanArtenT.marker, directional: false, color: '#db2777', glyph: '×' },
]
const typeOf = (kind: string) => ITEM_TYPES.find(t => t.kind === kind) ?? ITEM_TYPES[ITEM_TYPES.length - 1]

const buchstaben = (n: number) => {
  let label = ''
  let rest = n
  do {
    label = String.fromCharCode(65 + (rest % 26)) + label
    rest = Math.floor(rest / 26) - 1
  } while (rest >= 0)
  return label
}

/**
 * Nächste Beschriftung: Kameras den ersten freien Buchstaben, alles andere die
 * höchste Zahl plus eins. Vorher die Anzahl - nach dem Löschen von Kamera B aus
 * A, B, C hieß die neue wieder C (gemessen am 31.10.2026).
 */
function nextLabel(kind: string, items: any[]): string {
  const vergeben = new Set(items.filter(i => i.kind === kind).map(i => String(i.label ?? '')))
  if (kind === 'kamera') {
    let n = 0
    while (vergeben.has(buchstaben(n))) n++
    return buchstaben(n)
  }
  const hoechste = [...vergeben].reduce((m, l) => Math.max(m, parseInt(l, 10) || 0), 0)
  return String(hoechste + 1)
}

/**
 * Schieberegler, der erst beim Loslassen speichert. Vorher ging jeder Schritt
 * als eigene Anfrage hinaus: zehn Schritte, zehn Anfragen (gemessen am
 * 31.10.2026), ein Zug über die Blickrichtung leicht dreihundert.
 */
function Regler({ wert, min, max, step, onFertig, beschriftung, disabled }: {
  wert: number; min: number; max: number; step?: number
  onFertig: (wert: number) => void
  beschriftung: (wert: number) => React.ReactNode
  disabled?: boolean
}) {
  const [lokal, setLokal] = useState(wert)
  useEffect(() => setLokal(wert), [wert])
  const fertig = () => { if (lokal !== wert) onFertig(lokal) }
  return (
    <div>
      {beschriftung(lokal)}
      <input
        type="range" min={min} max={max} step={step} value={lokal} disabled={disabled} className="w-full mt-1"
        onChange={e => setLokal(Number(e.target.value))}
        onPointerUp={fertig} onKeyUp={fertig} onBlur={fertig}
      />
    </div>
  )
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const download = useDownload()
  const tt = useT()
  const { darfSchreiben } = useSchreibrecht()

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
  // Das Bild liegt hinter der geschützten Dateiablage - mit Token laden
  const bildQuelle = useGeschuetztesBild(plan?.image_url)

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['floorplan', planId] })
    queryClient.invalidateQueries({ queryKey: ['floorplans', pid] })
  }
  const fail = (title: string) => (err: any) =>
    toast({ title, description: err?.message, variant: 'destructive' })

  const createPlan = useMutation({
    mutationFn: () => api.floorplans.create(pid, { name: tt(setplanT.neuerSetPlan) }),
    onSuccess: (p: any) => { setActiveId(p.id); refresh() },
    onError: fail(tt(setplanT.planNichtAngelegt)),
  })
  const updatePlan = useMutation({
    mutationFn: (patch: any) => api.floorplans.update(planId as number, patch),
    onSuccess: refresh, onError: fail(tt(setplanT.nichtGespeichert)),
  })
  const deletePlan = useMutation({
    mutationFn: () => api.floorplans.remove(planId as number),
    onSuccess: () => { setActiveId(null); refresh() },
    onError: fail(tt(setplanT.loeschenFehlgeschlagen)),
  })
  const addItem = useMutation({
    mutationFn: (kind: string) => api.floorplans.addItem(planId as number, {
      kind, label: nextLabel(kind, items), x: 0.5, y: 0.5, rotation: 0, size: 100,
    }),
    onSuccess: (i: any) => { setSelected(i.id); refresh() },
    onError: fail(tt(setplanT.elementNichtAngelegt)),
  })
  const updateItem = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: any }) => api.floorplans.updateItem(id, patch),
    onSuccess: refresh, onError: fail(tt(setplanT.nichtGespeichert)),
  })
  const removeItem = useMutation({
    mutationFn: (id: number) => api.floorplans.deleteItem(id),
    onSuccess: () => { setSelected(null); refresh() },
    onError: fail(tt(setplanT.loeschenFehlgeschlagen)),
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
      return toast({ title: tt(setplanT.bildNichtHochgeladen), description: msg, variant: 'destructive' })
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
        title={tt(setplanT.titel)}
        subtitle={tt(setplanT.untertitel)}
        actions={
          <div className="flex gap-2">
            {planId != null && (
              <Button variant="outline" size="sm"
                onClick={() => download(api.floorplans.pdfUrl(planId), 'set-plan.pdf')}>
                <Download className="w-3.5 h-3.5 mr-1.5" />PDF
              </Button>
            )}
            {darfSchreiben && (
              <Button size="sm" onClick={() => createPlan.mutate()}>
                <Plus className="w-4 h-4 mr-1.5" />{tt(setplanT.neuerPlan)}
              </Button>
            )}
          </div>
        }
      />

      {list.length === 0 ? (
        <div className="border border-dashed border-border/60 rounded-lg py-16 text-center">
          <LayoutGrid className="w-9 h-9 mx-auto text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium">{tt(setplanT.nochKeiner)}</p>
          <p className="mt-1 text-xs text-muted-foreground/70 max-w-md mx-auto">
            {tt(setplanT.nochKeinerText)}
          </p>
          {darfSchreiben && (
            <Button size="sm" className="mt-4" onClick={() => createPlan.mutate()}>
              <Plus className="w-4 h-4 mr-1.5" />{tt(setplanT.erstenPlanAnlegen)}
            </Button>
          )}
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
                  {p.scene_number ? tt(setplanT.szene).replace('{n}', String(p.scene_number)) : ''}{tt(p.item_count === 1 ? setplanT.element : setplanT.elemente).replace('{n}', String(p.item_count))}
                </div>
              </button>
            ))}
          </div>

          {/* Plan */}
          <div>
            {/* Die Bezugsflaeche fuer die Positionen muss genau das Bild sein -
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
                <img src={bildQuelle} alt="" className="block max-w-full max-h-[70vh] w-auto pointer-events-none" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/50">
                  <ImageOff className="w-8 h-8" />
                  <p className="mt-2 text-xs">{tt(setplanT.keinGrundriss)}</p>
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
                      setSelected(i.id)
                      if (!darfSchreiben) return
                      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
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
            {darfSchreiben && <div className="flex flex-wrap gap-1.5 mt-3">
              {ITEM_TYPES.map(t => (
                <button
                  key={t.kind}
                  onClick={() => addItem.mutate(t.kind)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border/50 text-xs hover:bg-muted/50"
                >
                  <span className="w-3 h-3 rounded-full" style={{ background: t.color }} />
                  {tt(t.label)}
                </button>
              ))}
            </div>}
            {darfSchreiben && (
              <p className="mt-2 text-xs text-muted-foreground/70">
                {tt(setplanT.symbolHinweis)}
              </p>
            )}
          </div>

          {/* Einstellungen - ohne Schreibrecht gesperrt */}
          <fieldset disabled={!darfSchreiben} className="space-y-4 border-0 p-0 m-0 min-w-0">
            <div>
              <Label className="text-xs text-muted-foreground">{tt(setplanT.name)}</Label>
              <Input
                key={plan?.id} defaultValue={plan?.name} className="mt-1 text-sm"
                onBlur={e => e.target.value !== plan?.name && updatePlan.mutate({ name: e.target.value })}
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">{tt(setplanT.grundriss)}</Label>
              <input
                ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = '' }}
              />
              <Button variant="outline" size="sm" className="mt-1 w-full" onClick={() => fileRef.current?.click()}>
                <Upload className="w-3.5 h-3.5 mr-1.5" />{plan?.image_url ? tt(setplanT.bildErsetzen) : tt(setplanT.bildHochladen)}
              </Button>
            </div>

            {selectedItem ? (
              <div className="pt-3 border-t border-border/50 space-y-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground/70">
                  {tt(typeOf(selectedItem.kind).label)}
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">{tt(setplanT.beschriftung)}</Label>
                  <Input
                    key={selectedItem.id} defaultValue={selectedItem.label} className="mt-1 text-sm"
                    onBlur={e => e.target.value !== selectedItem.label &&
                      updateItem.mutate({ id: selectedItem.id, patch: { label: e.target.value } })}
                  />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">{tt(setplanT.typ)}</Label>
                  <Select value={selectedItem.kind}
                    onValueChange={k => updateItem.mutate({ id: selectedItem.id, patch: { kind: k } })}>
                    <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ITEM_TYPES.map(t => <SelectItem key={t.kind} value={t.kind} className="text-xs">{tt(t.label)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {typeOf(selectedItem.kind).directional && (
                  <Regler
                    key={`r-${selectedItem.id}`}
                    wert={selectedItem.rotation ?? 0} min={0} max={359}
                    onFertig={w => updateItem.mutate({ id: selectedItem.id, patch: { rotation: w } })}
                    beschriftung={w => (
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <RotateCw className="w-3 h-3" />{tt(setplanT.blickrichtung).replace('{n}', String(w))}
                      </Label>
                    )}
                  />
                )}

                <Regler
                  key={`g-${selectedItem.id}`}
                  wert={selectedItem.size ?? 100} min={40} max={300} step={10}
                  onFertig={w => updateItem.mutate({ id: selectedItem.id, patch: { size: w } })}
                  beschriftung={w => <Label className="text-xs text-muted-foreground">{tt(setplanT.groesse).replace('{n}', String(w))}</Label>}
                />

                <Button variant="ghost" size="sm" className="w-full text-muted-foreground hover:text-destructive"
                  onClick={() => removeItem.mutate(selectedItem.id)}>
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />{tt(setplanT.elementEntfernen)}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/70 pt-3 border-t border-border/50">
                {tt(setplanT.elementHinweis)}
              </p>
            )}

            <div className="pt-3 border-t border-border/50">
              <Label className="text-xs text-muted-foreground">{tt(setplanT.notizen)}</Label>
              <Textarea
                key={plan?.id} defaultValue={plan?.notes} rows={4} className="mt-1 text-sm"
                placeholder={tt(setplanT.notizenBeispiel)}
                onBlur={e => e.target.value !== plan?.notes && updatePlan.mutate({ notes: e.target.value })}
              />
            </div>

            <Button variant="ghost" size="sm" className="w-full text-muted-foreground hover:text-destructive"
              onClick={() => { if (confirm(tt(setplanT.loeschenFrage).replace('{name}', plan?.name ?? ''))) deletePlan.mutate() }}>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />{tt(setplanT.planLoeschen)}
            </Button>
          </fieldset>
        </div>
      )}
    </div>
  )
}
