import { useState, useRef, useLayoutEffect } from 'react'
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
import { useDownload } from '@/lib/useDownload'
import { debounce, getStripClass, eighthsToString, cn } from '@/lib/utils'
import { Plus, Trash2, Camera, Film, Clock, Download, Check, Copy, Star } from 'lucide-react'
import { feiern } from '@/lib/belohnung'

const SHOT_SIZES = ['ECU', 'CU', 'MCU', 'MS', 'MWS', 'WS', 'EWS', 'Totale', 'Vogelperspektive', 'Froschperspektive']
const MOVEMENTS = ['Statisch', 'Pan', 'Tilt', 'Pan + Tilt', 'Dolly', 'Fahrt', 'Gimbal', 'Handheld', 'Kran', 'Drohne', 'Zoom']

/**
 * Textfeld, das mit seinem Inhalt waechst.
 *
 * Die Beschreibung stand vorher in einer einzeiligen Eingabe: alles ab der
 * ersten Zeile war nur durch Scrollen im Feld zu erreichen. Am Set liest man
 * die Einstellung aber im Ganzen.
 */
const FIELD_SIZING = typeof CSS !== 'undefined' && CSS.supports?.('field-sizing', 'content')

function AutoTextarea({ value, onChange, placeholder, className }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // Wo der Browser mitwachsende Felder selbst kann (field-sizing), gar
    // nicht messen. Sonst die Messung gebündelt im nächsten Frame: vorher las
    // jedes Feld beim Einblenden sofort scrollHeight — bei einer Großproduktion
    // mit 1.400 Feldern zwang das 1.400 Layouts nacheinander, die Seite stand
    // minutenlang.
    if (FIELD_SIZING) return
    const resize = () => {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
    const raf = requestAnimationFrame(resize)
    // Neu messen, wenn sich die Breite aendert: beim Drehen des Tablets oder
    // Ein-/Ausklappen der Sidebar bricht der Text anders um.
    let width = el.clientWidth
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return
      width = el.clientWidth
      resize()
    })
    observer.observe(el)
    return () => { cancelAnimationFrame(raf); observer.disconnect() }
  }, [value])

  return (
    <Textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn('min-h-0 resize-none overflow-hidden py-1.5 leading-snug', className)}
      style={FIELD_SIZING ? ({ fieldSizing: 'content' } as React.CSSProperties) : undefined}
    />
  )
}

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
    meta: { stumm: true },
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
    <div className="border rounded p-2 bg-card/30 hover:bg-card/50 transition-colors space-y-1.5">
      {/* Kopfzeile: die kurzen, festen Angaben. Am Telefon umbrechend -
          nebeneinander braucht die Reihe rund 570 px. */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-xs text-muted-foreground w-8 shrink-0">{shot.shot_number}</span>

        <Select value={form.size || 'MS'} onValueChange={v => update('size', v)}>
          <SelectTrigger aria-label="Einstellungsgröße" className="w-20 h-7 text-xs shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>{SHOT_SIZES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
        </Select>

        <Select value={form.movement || 'Statisch'} onValueChange={v => update('movement', v)}>
          <SelectTrigger aria-label="Kamerabewegung" className="w-24 h-7 text-xs shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>{MOVEMENTS.map(m => <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>)}</SelectContent>
        </Select>

        <div className="flex items-center gap-1 shrink-0">
          <Input value={form.lens_mm || ''} onChange={e => update('lens_mm', e.target.value)}
            className="h-7 w-16 text-xs" placeholder="mm" />
          <span className="text-xs text-muted-foreground">mm</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Input type="number" value={form.duration_seconds || ''} onChange={e => update('duration_seconds', Number(e.target.value))}
            className="h-7 w-14 text-xs" placeholder="Sek" />
          <Clock className="w-3 h-3 text-muted-foreground" />
        </div>

        {/* Circle Take - Freitext, weil in der Praxis auch "3, 5" darin steht */}
        <div className="flex items-center gap-1 shrink-0" title="Bester Take (Circle Take)">
          <Star className={cn('w-3 h-3', form.best_take ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground')} />
          <Input value={form.best_take || ''} onChange={e => update('best_take', e.target.value)}
            className="h-7 w-16 text-xs" placeholder="Take" />
        </div>

        <div className="hidden md:block flex-1" />

        <button
          onClick={(e) => { if (!isDone) feiern(e.currentTarget); toggleDone.mutate() }}
          className={cn(
            'w-8 h-8 md:w-5 md:h-5 rounded-full border-2 flex items-center justify-center transition-[background-color,border-color,transform] duration-300 ease-spring shrink-0',
            isDone ? 'bg-success border-success text-success-foreground scale-110' : 'border-muted-foreground/40 hover:border-success/60'
          )}
          title={isDone ? 'Als offen markieren' : 'Als erledigt markieren'}
        >
          {isDone && <Check className="w-3 h-3" />}
        </button>
        <button onClick={onDuplicate} className="text-muted-foreground hover:text-primary shrink-0" title="Einstellung duplizieren">
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDelete} aria-label="Einstellung löschen" title="Einstellung löschen" className="text-muted-foreground hover:text-destructive shrink-0">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Beschreibung und Notiz auf voller Breite - hier steht der lange Text */}
      <AutoTextarea
        value={form.description || ''}
        onChange={v => update('description', v)}
        placeholder="Beschreibung / Inhalt"
        className="text-xs"
      />
      <AutoTextarea
        value={form.notes || ''}
        onChange={v => update('notes', v)}
        placeholder="Notiz (VFX, Requisite, Sicherheit) - erscheint im PDF"
        className="text-xs text-muted-foreground"
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

  // Bei einer Großproduktion (160 Szenen, 700 Einstellungen) nicht alles auf
  // einmal aufklappen: jede Einstellung hat sieben Eingabefelder. Zugeklappte
  // Szenen rendern ihren Inhalt nicht.
  const [offen, setOffen] = useState<string[] | null>(null)
  const [suche, setSuche] = useState('')
  const vieleSzenen = (scenes?.length ?? 0) > 20
  const offeneSzenen = offen ?? (vieleSzenen ? [] : (scenes || []).map((s: any) => String(s.id)))
  const sichtbareSzenen = (scenes || []).filter((s: any) => {
    const q = suche.trim().toLowerCase()
    return !q || String(s.scene_number).toLowerCase() === q || String(s.title || '').toLowerCase().includes(q)
  })

  const totalShots = shots?.length || 0
  const totalDuration = (shots || []).reduce((sum: number, s: any) => sum + (s.duration_seconds || 0), 0)
  const totalDone = (shots || []).filter((s: any) => s.done).length
  const scenesWithNoShots = (scenes || []).filter((s: any) => !shotsByScene[s.id]?.length)

  return (
    <div className="px-5 py-6 sm:p-6 max-w-5xl mx-auto space-y-4">
      <PageHeader
        title="Auflösung & Shotlist"
        subtitle={`${totalShots} Einstellungen · ${totalDone} erledigt · ${Math.round(totalDuration / 60)} Min.`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => download(api.pdf.shotlist(pid), 'shotlist-szenen.pdf')}>
              <Download className="w-4 h-4 mr-2" />PDF nach Szenen
            </Button>
            {/* Am Drehtag zaehlt nicht die Auflösung, sondern was heute ansteht */}
            <Button variant="outline" size="sm" onClick={() => download(api.pdf.shotlist(pid, 'drehtag'), 'shotlist-drehtage.pdf')}>
              <Download className="w-4 h-4 mr-2" />PDF nach Drehtagen
            </Button>
          </div>
        }
      />

      {scenesWithNoShots.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm text-warning">
          <Camera className="w-4 h-4 shrink-0" />
          <span>{scenesWithNoShots.length} Szene(n) ohne Einstellungen: {scenesWithNoShots.map(s => `Sz. ${s.scene_number}`).join(', ')}</span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}</div>
      ) : (
        <>
        {vieleSzenen && (
          <div className="flex flex-wrap items-center gap-2">
            <Input value={suche} onChange={e => setSuche(e.target.value)} placeholder="Szene suchen (Nummer oder Titel)" aria-label="Szene suchen" className="h-9 w-full sm:w-72" />
            <Button variant="outline" size="sm" onClick={() => setOffen(sichtbareSzenen.map((s: any) => String(s.id)))}>Alle aufklappen</Button>
            <Button variant="ghost" size="sm" onClick={() => setOffen([])}>Alle zuklappen</Button>
            <span className="text-xs text-muted-foreground">{sichtbareSzenen.length} Szenen</span>
          </div>
        )}
        <Accordion type="multiple" value={offeneSzenen} onValueChange={setOffen} className="space-y-2">
          {sichtbareSzenen.map((scene: any) => {
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
                  <div className="flex min-w-0 flex-wrap items-center gap-3 w-full mr-2">
                    <span className="font-mono text-sm font-bold w-8">{scene.scene_number}</span>
                    <div className="flex gap-1">
                      <Badge variant="outline" className="text-xs px-1.5 py-0">{scene.int_ext}</Badge>
                      <Badge variant="outline" className="text-xs px-1.5 py-0">{scene.day_night}</Badge>
                    </div>
                    <span className="font-medium text-sm min-w-0 basis-full sm:basis-auto sm:flex-1 text-left whitespace-normal break-words">{scene.title}</span>
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
                  {/* Spaltenkoepfe, ausgerichtet an der Kopfzeile von ShotRow. Die
                      Breiten entsprechen den Gruppen dort: Feld + Einheit bzw.
                      Symbol. Am Telefon umbrechen die Zeilen, dort gibt es
                      keine Spalten, an denen sich Koepfe ausrichten koennten. */}
                  <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground px-2.5 pb-1 border-b border-border/50">
                    <span className="w-8 shrink-0">Nr.</span>
                    <span className="w-20 shrink-0">Größe</span>
                    <span className="w-24 shrink-0">Bewegung</span>
                    <span className="w-[5.5rem] shrink-0">Objektiv</span>
                    <span className="w-[4.5rem] shrink-0">Dauer</span>
                    <span className="w-[5rem] shrink-0">Bester Take</span>
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
        </>
      )}
    </div>
  )
}
