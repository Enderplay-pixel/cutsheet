import { useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent, type DragOverEvent,
} from '@dnd-kit/core'
import { zielUnterDemZeiger } from '@/lib/zielUnterDemZeiger'
import { arrayMove } from '@dnd-kit/sortable'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { ShootDayColumn } from '@/components/drehplan/ShootDayColumn'
import { ScenePool } from '@/components/drehplan/ScenePool'
import { SceneStrip } from '@/components/drehplan/SceneStrip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { formatDate } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { useDownload } from '@/lib/useDownload'
import { Plus, Camera, Save, Download, RotateCcw, Trash2, History, FileText, Sparkles } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useT, useGebietsschema } from '@/lib/useT'
import { drehplanT as T } from '@/lib/texte/Drehplan'
import { useProjectPerms } from '@/contexts/ProjectRoleContext'
import { useUnits, tageNachUnit, tagNummer, type Unit } from '@/lib/units'
import { unitsT as U } from '@/lib/texte/Units'
import { UnitWaehler, UnitsDialog } from '@/components/drehplan/Units'

function AddDayDialog({ open, onClose, projectId, units, vorgabeUnit }: {
  open: boolean; onClose: () => void; projectId: number; units: Unit[] | undefined; vorgabeUnit: number | 'alle'
}) {
  const [mode, setMode] = useState<'single' | 'range'>('single')
  // Die Unit des neuen Tages (AP C2): die gerade gezeigte, sonst die Haupteinheit
  const haupt = units?.find((u) => u.is_main)?.id
  const [unitWahl, setUnitWahl] = useState<number | 'alle'>('alle')
  const unitId = unitWahl !== 'alle' ? unitWahl : vorgabeUnit !== 'alle' ? vorgabeUnit : haupt
  const [date, setDate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [wochenenden, setWochenenden] = useState(false)
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const tt = useT()

  const mutation = useMutation({
    mutationFn: (d: string) => api.drehplan.createDay(projectId, { date: d, ...(unitId ? { unit_id: unitId } : {}) }),
  })

  // Welche Tage der Zeitraum ergibt, rechnet der Server: Arbeitstage des
  // Projekts ohne Feiertage des Bundeslands, wie beim automatischen Einteilen
  // im Stäbchenplan (Plan Kino-Ausbau, Nachtrag zu AP A2). Vorher legte der
  // Dialog jeden Kalendertag an, auch Samstag und Sonntag.
  const zeitraumGueltig = mode === 'range' && !!startDate && !!endDate && endDate >= startDate
  const { data: vorschlag, error: vorschlagFehler } = useQuery({
    queryKey: ['arbeitstage', projectId, startDate, endDate, wochenenden],
    queryFn: () => api.drehplan.arbeitstage(projectId, startDate, endDate, wochenenden),
    enabled: zeitraumGueltig,
  })
  const dates: string[] = zeitraumGueltig ? (vorschlag ?? []) : []

  const handleAdd = async () => {
    setLoading(true)
    try {
      if (mode === 'single') {
        if (!date) return
        await mutation.mutateAsync(date) // texte-ok
      } else {
        if (dates.length === 0) return
        if (dates.length > 60) { toast({ title: tt(T.max60), variant: 'destructive' }); return }
        // Ein Aufruf statt einer Schleife: Der Server legt alle Tage an und nummeriert einmal
        await api.drehplan.createDaysBatch(projectId, dates, unitId)
        toast({ title: tt(T.tageHinzugefuegt).replace('{n}', String(dates.length)) })
      }
      queryClient.invalidateQueries({ queryKey: ['shoot-days', projectId] })
      queryClient.invalidateQueries({ queryKey: ['units', projectId] })
      onClose(); setDate(''); setStartDate(''); setEndDate(''); setUnitWahl('alle')
    } catch (e: any) {
      toast({ title: tt(T.fehler), description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const rangeCount = dates.length

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{tt(T.dialogTitel)}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <UnitWaehler units={units} wert={unitId ?? 'alle'} onChange={setUnitWahl} mitAlle={false} />
          <div className="flex gap-1 p-0.5 bg-muted rounded-md">
            <button onClick={() => setMode('single')} className={`flex-1 text-xs py-1 rounded transition-colors ${mode === 'single' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`}>{tt(T.einzelnerTag)}</button>
            <button onClick={() => setMode('range')} className={`flex-1 text-xs py-1 rounded transition-colors ${mode === 'range' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`}>{tt(T.zeitraum)}</button>
          </div>
          {mode === 'single' ? (
            <div>
              <label className="text-sm font-medium block mb-1">{tt(T.datum)}</label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <label className="text-sm font-medium block mb-1">{tt(T.von)}</label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">{tt(T.bis)}</label>
                <Input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Switch id="zeitraum-wochenenden" checked={wochenenden} onCheckedChange={setWochenenden} />
                <Label htmlFor="zeitraum-wochenenden" className="text-sm">{tt(T.wochenendenMitnehmen)}</Label>
              </div>
              <p className="text-xs text-muted-foreground">{tt(T.arbeitstageHinweis)}</p>
              {rangeCount > 0 && (
                <p className="text-xs font-medium" role="status">
                  {tt(T.ergibtTage).replace('{n}', String(rangeCount)).replace('{von}', formatDate(dates[0])).replace('{bis}', formatDate(dates[dates.length - 1]))}
                </p>
              )}
              {zeitraumGueltig && vorschlag && rangeCount === 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-400" role="status">{tt(T.keineArbeitstage)}</p>
              )}
              {vorschlagFehler && <p className="text-xs text-destructive" role="alert">{(vorschlagFehler as Error).message}</p>}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tt(T.abbrechen)}</Button>
          <Button onClick={handleAdd} disabled={loading || (mode === 'single' ? !date : !startDate || !endDate || rangeCount === 0)}>
            {loading ? tt(T.wirdAngelegt) : mode === 'range' ? tt(T.tageAnlegen).replace('{n}', String(rangeCount || 0)) : tt(T.hinzufuegen)}
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
  const tt = useT()
  const gebietsschema = useGebietsschema()
  const download = useDownload()
  // Drehtage und Szenen ab Abteilungsleitung, Versionen und KI ab Produktion -
  // so prüft es der Server (middleware/projectAuth.ts)
  const { canEdit, canEditBudget: darfVersionen } = useProjectPerms()
  const [addDayOpen, setAddDayOpen] = useState(false)
  const [activeDrag, setActiveDrag] = useState<any>(null)
  const [showVersions, setShowVersions] = useState(false)
  const [showAiOptimize, setShowAiOptimize] = useState(false)
  const [aiOptimizing, setAiOptimizing] = useState(false)
  // Unit-Wähler (AP C2): alle Units, jede als eigene Folge, oder eine
  const [unitFilter, setUnitFilter] = useState<number | 'alle'>('alle')
  const [unitsOffen, setUnitsOffen] = useState(false)
  const { data: units } = useUnits(pid)

  const { data: shootDays, isLoading: daysLoading } = useQuery({
    queryKey: ['shoot-days', pid],
    queryFn: () => api.drehplan.listDays(pid),
  })

  const { data: allScenes, isLoading: scenesLoading } = useQuery({
    queryKey: ['scenes', pid],
    queryFn: () => api.scenes.list(pid),
  })

  // Maus und Finger getrennt: Mit einem Abstandsschwellwert fuer beide wird
  // am Touchscreen jede Wischgeste, die auf einer Szene beginnt, zum Ziehen -
  // das Brett liesse sich dann nicht mehr scrollen. Am Finger hebt erst kurzes
  // Halten die Szene an; wer sofort wischt, scrollt.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  const removeSceneMutation = useMutation({
    mutationFn: ({ dayId, sceneId }: { dayId: number; sceneId: number }) => api.drehplan.removeScene(dayId, sceneId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shoot-days', pid] }),
    onError: (e: any) => toast({ title: tt(T.fehler), description: e.message, variant: 'destructive' }),
  })

  const deleteDayMutation = useMutation({
    mutationFn: (dayId: number) => api.drehplan.deleteDay(dayId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shoot-days', pid] }),
    onError: (e: any) => toast({ title: tt(T.fehler), description: e.message, variant: 'destructive' }),
  })

  const statusMutation = useMutation({
    mutationFn: ({ dayId, status }: { dayId: number; status: string }) => api.drehplan.updateDay(dayId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoot-days', pid] })
      // Sperr-, Ausfall- und Reservetage zählen für niemanden: DOOD und Drehtage ändern sich
      queryClient.invalidateQueries({ queryKey: ['dood-report', pid] })
      queryClient.invalidateQueries({ queryKey: ['drehtage', pid] })
    },
    onError: (e: any) => toast({ title: tt(T.fehler), description: e.message, variant: 'destructive' }),
  })

  const moveSceneMutation = useMutation({
    mutationFn: (data: any) => api.drehplan.moveScene(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shoot-days', pid] }),
    onError: (e: any) => toast({ title: tt(T.fehler), description: e.message, variant: 'destructive' }),
  })

  // Reihenfolge innerhalb eines Drehtags. Server und Schnittstelle konnten
  // das schon, die Seite verwarf das Ablegen im selben Tag (Fund 265). Die
  // neue Reihenfolge steht sofort da; scheitert das Speichern, kommt die
  // alte vom Server zurück.
  const reorderMutation = useMutation({
    mutationFn: ({ dayId, sceneIds }: { dayId: number; sceneIds: number[] }) =>
      api.drehplan.reorderScenes(dayId, sceneIds.map((sceneId, sortOrder) => ({ sceneId, sortOrder }))),
    onMutate: ({ dayId, sceneIds }) => {
      queryClient.setQueryData<any[]>(['shoot-days', pid], tage => (tage || []).map((tag: any) => {
        if (tag.id !== dayId) return tag
        const nachId = new Map((tag.scenes || []).map((sz: any) => [sz.scene_id ?? sz.id, sz]))
        return { ...tag, scenes: sceneIds.map(id => nachId.get(id)).filter(Boolean) }
      }))
    },
    onError: (e: any) => toast({ title: tt(T.fehler), description: e.message, variant: 'destructive' }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['shoot-days', pid] }),
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
      toast({ title: tt(T.versionGespeichert) })
    },
  })

  const restoreMutation = useMutation({
    mutationFn: (versionId: number) => api.drehplan.restore(pid, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoot-days', pid] })
      // Die Sicherung des alten Stands ist eine neue Version
      queryClient.invalidateQueries({ queryKey: ['drehplan-versions', pid] })
      setShowVersions(false)
      toast({ title: tt(T.wiederhergestellt) })
    },
    onError: (e: any) => toast({ title: tt(T.fehler), description: e.message, variant: 'destructive' }),
  })

  const deleteVersionMutation = useMutation({
    mutationFn: (versionId: number) => api.drehplan.deleteVersion(versionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['drehplan-versions', pid] }),
  })

  const gezeigteTage = tageNachUnit(shootDays || [], units, unitFilter)

  const scheduledSceneIds = new Set<number>()
  shootDays?.forEach((day: any) => day.scenes?.forEach((s: any) => scheduledSceneIds.add(s.scene_id)))
  // Entfallene Szenen (AP A3) stehen nicht in der Ablage
  const unscheduledScenes = (allScenes || []).filter((s: any) => !scheduledSceneIds.has(s.id) && !s.omitted)

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDrag(event.active.data.current)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
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

    // Im selben Tag: umsortieren
    if (fromDayId === toDayId) {
      const ziel = overData?.type === 'scene' ? overData.scene : null
      const tag = (shootDays || []).find((d: any) => d.id === fromDayId)
      if (!fromDayId || !ziel || !tag) return
      const ids: number[] = (tag.scenes || []).map((sz: any) => sz.scene_id ?? sz.id)
      const von = ids.indexOf(scene.scene_id ?? scene.id)
      const nach = ids.indexOf(ziel.scene_id ?? ziel.id)
      if (von < 0 || nach < 0 || von === nach) return
      reorderMutation.mutate({ dayId: fromDayId, sceneIds: arrayMove(ids, von, nach) })
      return
    }

    if (toDayId && (shootDays || []).find((d: any) => d.id === toDayId)?.status === 'Sperrtag') {
      toast({ title: tt(T.sperrtagZiel), variant: 'destructive' })
      return
    }

    const sceneId = scene.scene_id || scene.id

    // Ein Reservetag zählt für niemanden. Nicht still umstellen - sonst ändern
    // sich Drehtage, DOOD und Kalkulation ohne Ansage (Plan AP A1).
    const zielTag = toDayId ? (shootDays || []).find((d: any) => d.id === toDayId) : null
    if (zielTag?.status === 'Reserve') {
      if (!confirm(tt(T.reserveZiel).replace('{n}', tagNummer(zielTag)))) return
      await statusMutation.mutateAsync({ dayId: zielTag.id, status: 'Geplant' })
    }

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
          title={tt(T.titel)}
          subtitle={tt(T.untertitel).replace('{tage}', String(shootDays?.length || 0)).replace('{geplant}', String(scheduledSceneIds.size)).replace('{gesamt}', String(allScenes?.length || 0))}
          actions={
            <div className="flex gap-2 flex-wrap items-center">
              <UnitWaehler units={units} wert={unitFilter} onChange={setUnitFilter} />
              <Button data-einfuehrung="units" variant="outline" size="sm" onClick={() => setUnitsOffen(true)}>{tt(U.verwalten)}</Button>
              <Button variant="outline" size="sm" onClick={() => download(api.pdf.drehplan(pid), 'drehplan.pdf')}>
                  <Download className="w-4 h-4 mr-2" />PDF
                </Button>
              {darfVersionen && <>
                <Button variant="outline" size="sm" onClick={() => setShowAiOptimize(true)}>
                  <Sparkles className="w-4 h-4 mr-2" />{tt(T.kiOptimierung)}
                </Button>
                <Button variant="outline" size="sm" onClick={() => { snapshotMutation.mutate(); setShowVersions(true) }}>
                  <Save className="w-4 h-4 mr-2" />{tt(T.versionSpeichern)}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowVersions(v => !v)}>
                  <History className="w-4 h-4 mr-2" />{tt(T.versionen)}
                </Button>
              </>}
              {canEdit && (
                <Button size="sm" onClick={() => setAddDayOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />{tt(T.drehtag)}
                </Button>
              )}
            </div>
          }
        />
      </div>

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full w-full">
          <div className="flex gap-4 p-4 sm:p-6 pt-0 min-h-full">
            <DndContext
              sensors={canEdit ? sensors : []}
              collisionDetection={zielUnterDemZeiger}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              {/* Unscheduled scene pool */}
              <ScenePool scenes={unscheduledScenes} />

              {/* Shoot day columns */}
              {gezeigteTage.map((day: any) => (
                <ShootDayColumn
                  key={day.id}
                  day={day}
                  onRemoveScene={(dayId, sceneId) => removeSceneMutation.mutate({ dayId, sceneId })}
                  onDeleteDay={(dayId) => deleteDayMutation.mutate(dayId)}
                  onStatusChange={(dayId, status) => statusMutation.mutate({ dayId, status })}
                  darfAendern={canEdit}
                />
              ))}

              {/* Add day button inline */}
              {canEdit && <div className="flex items-start">
                <button
                  onClick={() => setAddDayOpen(true)}
                  className="w-[200px] h-full min-h-[120px] border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                >
                  <Plus className="w-6 h-6" />
                  <span className="text-sm">{tt(T.drehtag)}</span>
                </button>
              </div>}

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
              {tt(T.gespeicherteVersionen)}
            </h3>
            <button onClick={() => setShowVersions(false)} className="text-xs text-muted-foreground hover:text-foreground">{tt(T.schliessen)}</button>
          </div>
          {!versions || versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tt(T.keineVersionen)}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {versions.map((v: any) => (
                <div key={v.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/60 bg-muted/20 text-sm">
                  <span className="font-medium">{v.name}</span>
                  <span className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleDateString(gebietsschema)}</span>
                  <button
                    onClick={() => { if (confirm(tt(T.wiederherstellenFrage).replace('{name}', v.name))) restoreMutation.mutate(v.id) }}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                    title={tt(T.wiederherstellen)}
                  >
                    <RotateCcw className="w-3 h-3" />{tt(T.wiederherstellen)}
                  </button>
                  <button
                    onClick={() => deleteVersionMutation.mutate(v.id)}
                    className="text-muted-foreground/40 hover:text-destructive transition-colors"
                    title={tt(T.loeschen)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <AddDayDialog open={addDayOpen} onClose={() => setAddDayOpen(false)} projectId={pid} units={units} vorgabeUnit={unitFilter} />
      <UnitsDialog offen={unitsOffen} onSchliessen={() => setUnitsOffen(false)} pid={pid} units={units} darf={canEdit} />

      {/* AI Optimize confirm dialog */}
      <Dialog open={showAiOptimize} onOpenChange={v => !v && setShowAiOptimize(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {tt(T.kiDialogTitel)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">
              {tt(T.kiText)}
            </p>
            <p className="text-sm text-muted-foreground">
              {tt(T.kiSicherungVor)}<span className="font-medium text-foreground">{tt(T.kiSicherungFett)}</span>{tt(T.kiSicherungNach)}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAiOptimize(false)} disabled={aiOptimizing}>{tt(T.abbrechen)}</Button>
            <Button
              disabled={aiOptimizing}
              onClick={async () => {
                setAiOptimizing(true)
                try {
                  const result = await api.aiScheduling.optimize(pid)
                  toast({ title: tt(T.optAbgeschlossen), description: tt(T.szenenNeu).replace('{n}', String(result.moved ?? 0)) })
                  queryClient.invalidateQueries({ queryKey: ['shoot-days', pid] })
                  queryClient.invalidateQueries({ queryKey: ['drehplan-versions', pid] })
                  setShowAiOptimize(false)
                } catch (e: any) {
                  // Der Dialog schließt auch beim Fehler - offen sah er aus, als
                  // hinge die KI noch (Testbericht SALZWIND: "über 60 s offen")
                  setShowAiOptimize(false)
                  toast({ title: tt(T.optFehler), description: e.message, variant: 'destructive' })
                } finally {
                  setAiOptimizing(false)
                }
              }}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {aiOptimizing ? tt(T.optimiere) : tt(T.jetztOptimieren)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
