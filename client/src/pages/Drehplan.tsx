import { useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent, type DragOverEvent, closestCenter
} from '@dnd-kit/core'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { ShootDayColumn } from '@/components/drehplan/ShootDayColumn'
import { ScenePool } from '@/components/drehplan/ScenePool'
import { SceneStrip } from '@/components/drehplan/SceneStrip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Camera, Save, Download, RotateCcw, Trash2, History } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'

function AddDayDialog({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId: number }) {
  const [mode, setMode] = useState<'single' | 'range'>('single')
  const [date, setDate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const mutation = useMutation({
    mutationFn: (d: string) => api.drehplan.createDay(projectId, { date: d }),
  })

  const getDatesInRange = (start: string, end: string): string[] => {
    const dates: string[] = []
    const cur = new Date(start)
    const last = new Date(end)
    while (cur <= last) {
      dates.push(cur.toISOString().slice(0, 10))
      cur.setDate(cur.getDate() + 1)
    }
    return dates
  }

  const handleAdd = async () => {
    setLoading(true)
    try {
      if (mode === 'single') {
        if (!date) return
        await mutation.mutateAsync(date)
      } else {
        if (!startDate || !endDate) return
        const dates = getDatesInRange(startDate, endDate)
        if (dates.length > 60) { toast({ title: 'Maximal 60 Tage auf einmal', variant: 'destructive' }); return }
        for (const d of dates) await mutation.mutateAsync(d)
        toast({ title: `${dates.length} Drehtage hinzugefügt` })
      }
      queryClient.invalidateQueries({ queryKey: ['shoot-days', projectId] })
      onClose(); setDate(''); setStartDate(''); setEndDate('')
    } catch (e: any) {
      toast({ title: 'Fehler', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const rangeCount = startDate && endDate ? getDatesInRange(startDate, endDate).length : 0

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Drehtag(e) hinzufügen</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-1 p-0.5 bg-muted rounded-md">
            <button onClick={() => setMode('single')} className={`flex-1 text-xs py-1 rounded transition-colors ${mode === 'single' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`}>Einzelner Tag</button>
            <button onClick={() => setMode('range')} className={`flex-1 text-xs py-1 rounded transition-colors ${mode === 'range' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`}>Zeitraum</button>
          </div>
          {mode === 'single' ? (
            <div>
              <label className="text-sm font-medium block mb-1">Datum</label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <label className="text-sm font-medium block mb-1">Von</label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Bis</label>
                <Input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} />
              </div>
              {rangeCount > 0 && (
                <p className="text-xs text-muted-foreground">{rangeCount} Drehtage werden angelegt</p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleAdd} disabled={loading || (mode === 'single' ? !date : !startDate || !endDate || rangeCount === 0)}>
            {loading ? 'Wird angelegt…' : mode === 'range' ? `${rangeCount || 0} Tage anlegen` : 'Hinzufügen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [addDayOpen, setAddDayOpen] = useState(false)
  const [activeDrag, setActiveDrag] = useState<any>(null)
  const [showVersions, setShowVersions] = useState(false)

  const { data: shootDays, isLoading: daysLoading } = useQuery({
    queryKey: ['shoot-days', pid],
    queryFn: () => api.drehplan.listDays(pid),
  })

  const { data: allScenes, isLoading: scenesLoading } = useQuery({
    queryKey: ['scenes', pid],
    queryFn: () => api.scenes.list(pid),
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const removeSceneMutation = useMutation({
    mutationFn: ({ dayId, sceneId }: { dayId: number; sceneId: number }) => api.drehplan.removeScene(dayId, sceneId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shoot-days', pid] }),
    onError: (e: any) => toast({ title: 'Fehler', description: e.message, variant: 'destructive' }),
  })

  const deleteDayMutation = useMutation({
    mutationFn: (dayId: number) => api.drehplan.deleteDay(dayId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shoot-days', pid] }),
    onError: (e: any) => toast({ title: 'Fehler', description: e.message, variant: 'destructive' }),
  })

  const statusMutation = useMutation({
    mutationFn: ({ dayId, status }: { dayId: number; status: string }) => api.drehplan.updateDay(dayId, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shoot-days', pid] }),
  })

  const moveSceneMutation = useMutation({
    mutationFn: (data: any) => api.drehplan.moveScene(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shoot-days', pid] }),
    onError: (e: any) => toast({ title: 'Fehler', description: e.message, variant: 'destructive' }),
  })

  const { data: versions } = useQuery({
    queryKey: ['drehplan-versions', pid],
    queryFn: () => api.drehplan.listVersions(pid),
    enabled: showVersions,
  })

  const snapshotMutation = useMutation({
    mutationFn: () => api.drehplan.snapshot(pid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drehplan-versions', pid] })
      toast({ title: 'Version gespeichert' })
    },
  })

  const restoreMutation = useMutation({
    mutationFn: (versionId: number) => api.drehplan.restore(pid, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoot-days', pid] })
      setShowVersions(false)
      toast({ title: 'Drehplan wiederhergestellt' })
    },
    onError: (e: any) => toast({ title: 'Fehler', description: e.message, variant: 'destructive' }),
  })

  const deleteVersionMutation = useMutation({
    mutationFn: (versionId: number) => api.drehplan.deleteVersion(versionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['drehplan-versions', pid] }),
  })

  const scheduledSceneIds = new Set<number>()
  shootDays?.forEach((day: any) => day.scenes?.forEach((s: any) => scheduledSceneIds.add(s.scene_id)))
  const unscheduledScenes = (allScenes || []).filter((s: any) => !scheduledSceneIds.has(s.id))

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDrag(event.active.data.current)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null)
    const { active, over } = event
    if (!over) return

    const dragData = active.data.current as any
    const overData = over.data.current as any

    if (!dragData) return

    const scene = dragData.scene
    const fromDayId = dragData.shootDayId

    let toDayId: number | null = null

    if (overData?.type === 'day') {
      toDayId = overData.dayId
    } else if (overData?.type === 'scene') {
      toDayId = overData.shootDayId
    } else if (over.id === 'scene-pool') {
      toDayId = null
    } else {
      // Try to find which column by prefix
      const overId = String(over.id)
      if (overId.startsWith('day-')) {
        toDayId = parseInt(overId.replace('day-', ''))
      }
    }

    // Same location, no-op
    if (fromDayId === toDayId) return

    const sceneId = scene.scene_id || scene.id

    moveSceneMutation.mutate({
      sceneId,
      fromDayId: fromDayId || null,
      toDayId: toDayId || null,
      sortOrder: 0,
    })
  }

  if (daysLoading || scenesLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="flex gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-96 w-48" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 shrink-0">
        <PageHeader
          title="Drehplan"
          subtitle={`${shootDays?.length || 0} Drehtage · ${scheduledSceneIds.size} von ${allScenes?.length || 0} Szenen geplant`}
          actions={
            <div className="flex gap-2">
              <a href={api.pdf.drehplan(pid)} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />PDF
                </Button>
              </a>
              <Button variant="outline" size="sm" onClick={() => { snapshotMutation.mutate(); setShowVersions(true) }}>
                <Save className="w-4 h-4 mr-2" />Version speichern
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowVersions(v => !v)}>
                <History className="w-4 h-4 mr-2" />Versionen
              </Button>
              <Button size="sm" onClick={() => setAddDayOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />Drehtag
              </Button>
            </div>
          }
        />
      </div>

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full w-full">
          <div className="flex gap-4 p-6 pt-0 min-h-full">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              {/* Unscheduled scene pool */}
              <ScenePool scenes={unscheduledScenes} />

              {/* Shoot day columns */}
              {(shootDays || []).map((day: any) => (
                <ShootDayColumn
                  key={day.id}
                  day={day}
                  onRemoveScene={(dayId, sceneId) => removeSceneMutation.mutate({ dayId, sceneId })}
                  onDeleteDay={(dayId) => deleteDayMutation.mutate(dayId)}
                  onStatusChange={(dayId, status) => statusMutation.mutate({ dayId, status })}
                />
              ))}

              {/* Add day button inline */}
              <div className="flex items-start">
                <button
                  onClick={() => setAddDayOpen(true)}
                  className="w-[200px] h-full min-h-[120px] border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                >
                  <Plus className="w-6 h-6" />
                  <span className="text-sm">Drehtag</span>
                </button>
              </div>

              <DragOverlay>
                {activeDrag?.scene && (
                  <div className="opacity-90">
                    <SceneStrip scene={activeDrag.scene} shootDayId={activeDrag.shootDayId || 0} draggable={false} />
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          </div>
        </ScrollArea>
      </div>

      {/* Version history panel */}
      {showVersions && (
        <div className="shrink-0 border-t border-border/60 bg-card px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <History className="w-4 h-4 text-muted-foreground" />
              Gespeicherte Versionen
            </h3>
            <button onClick={() => setShowVersions(false)} className="text-xs text-muted-foreground hover:text-foreground">Schließen</button>
          </div>
          {!versions || versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Versionen gespeichert.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {versions.map((v: any) => (
                <div key={v.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/60 bg-muted/20 text-sm">
                  <span className="font-medium">{v.name}</span>
                  <span className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleDateString('de-DE')}</span>
                  <button
                    onClick={() => restoreMutation.mutate(v.id)}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                    title="Wiederherstellen"
                  >
                    <RotateCcw className="w-3 h-3" />Wiederherstellen
                  </button>
                  <button
                    onClick={() => deleteVersionMutation.mutate(v.id)}
                    className="text-muted-foreground/40 hover:text-destructive transition-colors"
                    title="Löschen"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <AddDayDialog open={addDayOpen} onClose={() => setAddDayOpen(false)} projectId={pid} />
    </div>
  )
}
