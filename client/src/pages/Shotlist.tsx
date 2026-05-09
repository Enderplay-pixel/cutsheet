import { useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { debounce, getStripClass, eighthsToString, cn } from '@/lib/utils'
import { Plus, Trash2, Camera, Film, Clock, Download, Check, Copy } from 'lucide-react'

const SHOT_SIZES = ['ECU', 'CU', 'MCU', 'MS', 'MWS', 'WS', 'EWS', 'Totale', 'Vogelperspektive', 'Froschperspektive']
const MOVEMENTS = ['Statisch', 'Pan', 'Tilt', 'Pan + Tilt', 'Dolly', 'Fahrt', 'Gimbal', 'Handheld', 'Kran', 'Drohne', 'Zoom']

function ShotRow({ shot, onDelete, onDuplicate }: { shot: any; onDelete: () => void; onDuplicate: () => void }) {
  const [form, setForm] = useState(shot)
  const [isDone, setIsDone] = useState(!!shot.done)
  const queryClient = useQueryClient()
  const { projectId } = useParams()
  const pid = Number(projectId)

  const mutation = useMutation({
    mutationFn: (data: any) => api.shots.update(shot.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shots', pid] }),
  })

  const toggleDone = useMutation({
    mutationFn: () => api.shots.toggleDone(shot.id),
    onSuccess: (data: any) => {
      setIsDone(!!data.done)
      queryClient.invalidateQueries({ queryKey: ['shots', pid] })
    },
  })

  const debouncedUpdate = useRef(debounce((data: any) => mutation.mutate(data), 500)).current
  const update = (key: string, value: any) => {
    const next = { ...form, [key]: value }
    setForm(next)
    debouncedUpdate(next)
  }

  return (
    <div className="flex items-center gap-2 border rounded p-2 bg-card/30 hover:bg-card/50 transition-colors">
      <span className="font-mono text-xs text-muted-foreground w-8 shrink-0">{shot.shot_number}</span>

      <Select value={form.size || 'MS'} onValueChange={v => update('size', v)}>
        <SelectTrigger className="w-20 h-7 text-xs shrink-0"><SelectValue /></SelectTrigger>
        <SelectContent>{SHOT_SIZES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
      </Select>

      <Select value={form.movement || 'Statisch'} onValueChange={v => update('movement', v)}>
        <SelectTrigger className="w-24 h-7 text-xs shrink-0"><SelectValue /></SelectTrigger>
        <SelectContent>{MOVEMENTS.map(m => <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>)}</SelectContent>
      </Select>

      <div className="flex items-center gap-1 shrink-0">
        <Input value={form.lens_mm || ''} onChange={e => update('lens_mm', e.target.value)}
          className="h-7 w-16 text-xs" placeholder="mm" />
        <span className="text-xs text-muted-foreground">mm</span>
      </div>

      <Input value={form.description || ''} onChange={e => update('description', e.target.value)}
        className="h-7 text-xs flex-1" placeholder="Beschreibung / Inhalt" />

      <div className="flex items-center gap-1 shrink-0">
        <Input type="number" value={form.duration_seconds || ''} onChange={e => update('duration_seconds', Number(e.target.value))}
          className="h-7 w-14 text-xs" placeholder="Sek" />
        <Clock className="w-3 h-3 text-muted-foreground" />
      </div>

      <button
        onClick={() => toggleDone.mutate()}
        className={cn(
          'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0',
          isDone ? 'bg-green-500 border-green-500 text-white' : 'border-muted-foreground/40 hover:border-green-500/60'
        )}
        title={isDone ? 'Als offen markieren' : 'Als erledigt markieren'}
      >
        {isDone && <Check className="w-3 h-3" />}
      </button>
      <button onClick={onDuplicate} className="text-muted-foreground hover:text-primary shrink-0" title="Einstellung duplizieren">
        <Copy className="w-3.5 h-3.5" />
      </button>
      <button onClick={onDelete} className="text-muted-foreground hover:text-destructive shrink-0">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: scenes, isLoading: scenesLoading } = useQuery({
    queryKey: ['scenes', pid],
    queryFn: () => api.scenes.list(pid),
  })

  const { data: shots, isLoading: shotsLoading } = useQuery({
    queryKey: ['shots', pid],
    queryFn: () => api.shots.list(pid),
  })

  const { data: shootDays } = useQuery({
    queryKey: ['shoot-days', pid],
    queryFn: () => api.drehplan.listDays(pid),
  })

  const createShot = useMutation({
    mutationFn: (sceneId: number) => {
      const existingShots = (shots || []).filter((s: any) => s.scene_id === sceneId)
      return api.shots.create(sceneId, {
        shot_number: String(existingShots.length + 1),
        size: 'MS',
        movement: 'Statisch',
        description: '',
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shots', pid] }),
  })

  const deleteShot = useMutation({
    mutationFn: (id: number) => api.shots.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shots', pid] }),
  })

  const duplicateShot = useMutation({
    mutationFn: (shot: any) => {
      const sceneShots = (shots || []).filter((s: any) => s.scene_id === shot.scene_id)
      return api.shots.create(shot.scene_id, {
        shot_number: String(sceneShots.length + 1),
        size: shot.size,
        movement: shot.movement,
        lens_mm: shot.lens_mm,
        description: shot.description ? `${shot.description} (Kopie)` : '',
        duration_seconds: shot.duration_seconds,
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shots', pid] }),
  })

  const isLoading = scenesLoading || shotsLoading

  const shotsByScene = (shots || []).reduce((acc: Record<number, any[]>, shot: any) => {
    const key = shot.scene_id || 0
    if (!acc[key]) acc[key] = []
    acc[key].push(shot)
    return acc
  }, {} as Record<number, any[]>)

  const totalShots = shots?.length || 0
  const totalDuration = (shots || []).reduce((sum: number, s: any) => sum + (s.duration_seconds || 0), 0)
  const totalDone = (shots || []).filter((s: any) => s.done).length
  const scenesWithNoShots = (scenes || []).filter((s: any) => !shotsByScene[s.id]?.length)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <PageHeader
        title="Auflösung & Shotlist"
        subtitle={`${totalShots} Einstellungen · ${totalDone} erledigt · ${Math.round(totalDuration / 60)} Min.`}
        actions={
          <a href={api.pdf.shotlist(pid)} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />PDF
            </Button>
          </a>
        }
      />

      {scenesWithNoShots.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-400">
          <Camera className="w-4 h-4 shrink-0" />
          <span>{scenesWithNoShots.length} Szene(n) ohne Einstellungen: {scenesWithNoShots.map(s => `Sz. ${s.scene_number}`).join(', ')}</span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}</div>
      ) : (
        <Accordion type="multiple" defaultValue={(scenes || []).map((s: any) => String(s.id))} className="space-y-2">
          {(scenes || []).map((scene: any) => {
            const sceneShots = shotsByScene[scene.id] || []
            const sceneDuration = sceneShots.reduce((s: number, sh: any) => s + (sh.duration_seconds || 0), 0)
            const doneCount = sceneShots.filter((sh: any) => sh.done).length

            return (
              <AccordionItem key={scene.id} value={String(scene.id)} className="border rounded-lg overflow-hidden">
                <AccordionTrigger className={`px-4 py-3 hover:no-underline ${
                  scene.int_ext === 'INT' && scene.day_night === 'TAG' ? 'bg-amber-500/5 hover:bg-amber-500/10' :
                  scene.int_ext === 'EXT' && scene.day_night === 'TAG' ? 'bg-blue-500/5 hover:bg-blue-500/10' :
                  scene.int_ext === 'INT' && scene.day_night === 'NACHT' ? 'bg-indigo-900/10 hover:bg-indigo-900/15' :
                  'bg-teal-900/10 hover:bg-teal-900/15'
                }`}>
                  <div className="flex items-center gap-3 w-full mr-4">
                    <span className="font-mono text-sm font-bold w-8">{scene.scene_number}</span>
                    <div className="flex gap-1">
                      <Badge variant="outline" className="text-xs px-1.5 py-0">{scene.int_ext}</Badge>
                      <Badge variant="outline" className="text-xs px-1.5 py-0">{scene.day_night}</Badge>
                    </div>
                    <span className="font-medium text-sm flex-1 text-left truncate">{scene.title}</span>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Camera className="w-3 h-3" />
                        {sceneShots.filter((sh: any) => sh.done).length}/{sceneShots.length}
                      </span>
                      {sceneDuration > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{sceneDuration}s</span>}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 space-y-2">
                  {/* Header row */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground px-2 pb-1 border-b border-border/50">
                    <span className="w-8">Nr.</span>
                    <span className="w-20">Größe</span>
                    <span className="w-24">Bewegung</span>
                    <span className="w-20">Objektiv</span>
                    <span className="flex-1">Beschreibung</span>
                    <span className="w-16">Dauer</span>
                    <span className="w-6" />
                  </div>
                  {sceneShots.map((shot: any) => (
                    <ShotRow key={shot.id} shot={shot} onDelete={() => deleteShot.mutate(shot.id)} onDuplicate={() => duplicateShot.mutate(shot)} />
                  ))}
                  <Button variant="ghost" size="sm" className="text-xs w-full mt-1"
                    onClick={() => createShot.mutate(scene.id)} disabled={createShot.isPending}>
                    <Plus className="w-3 h-3 mr-1" />Einstellung hinzufügen
                  </Button>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      )}
    </div>
  )
}
