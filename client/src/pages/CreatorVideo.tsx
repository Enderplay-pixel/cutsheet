import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/use-toast'
import { useDownload } from '@/lib/useDownload'
import { RetentionChart } from '@/components/creator/RetentionChart'
import {
  ArrowLeft, Plus, Trash2, Download, Clock, Type, ChevronUp, ChevronDown,
  AlertTriangle, Check, Copy, Presentation, X, Play, Pause, ShieldAlert, Scissors,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const SECTION_KINDS = [
  { value: 'hook', label: 'Hook' },
  { value: 'intro', label: 'Intro' },
  { value: 'sponsor', label: 'Sponsor' },
  { value: 'segment', label: 'Segment' },
  { value: 'broll', label: 'B-Roll' },
  { value: 'cta', label: 'Call to Action' },
  { value: 'outro', label: 'Outro' },
]

const KIND_COLOR: Record<string, string> = {
  hook: 'text-red-400',
  intro: 'text-blue-400',
  sponsor: 'text-amber-400',
  segment: 'text-foreground',
  broll: 'text-violet-400',
  cta: 'text-cyan-400',
  outro: 'text-emerald-400',
}

const ASSET_KINDS = ['musik', 'stock', 'grafik', 'sfx', 'schrift']
const CLAIM_RISKS = [
  { value: 'keins', label: 'kein Risiko', style: 'text-emerald-400' },
  { value: 'moeglich', label: 'möglich', style: 'text-amber-400' },
  { value: 'hoch', label: 'hoch', style: 'text-red-400' },
]
const CLIP_PLATFORMS = ['YouTube Shorts', 'TikTok', 'Instagram Reel', 'YouTube']
const CLIP_STATUS = ['offen', 'geschnitten', 'veröffentlicht']

function timecode(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds || 0))
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const two = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${two(m % 60)}:${two(s % 60)}` : `${m}:${two(s % 60)}`
}

/** Speichert erst nach kurzer Pause - wie im Drehbuch-Editor. */
function useDebouncedSave<T>(save: (value: T) => void, delay = 600) {
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  return (value: T) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => save(value), delay)
  }
}

// ─── Teleprompter ─────────────────────────────────────────────────────────────

/**
 * Vollbild-Ablauf des Sprechtexts fuer die Aufnahme. Die Scrollgeschwindigkeit
 * ergibt sich aus dem eingestellten Sprechtempo, laesst sich aber live regeln -
 * kein Creator spricht exakt im Schnitt.
 */
function Teleprompter({ sections, wpm, onClose }: { sections: any[]; wpm: number; onClose: () => void }) {
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [fontSize, setFontSize] = useState(44)
  const boxRef = useRef<HTMLDivElement>(null)

  // Pixel pro Sekunde aus Sprechtempo und Schriftgroesse: eine Zeile fasst grob
  // sieben Woerter, eine Zeile ist etwa 1.4 Zeilenhoehen hoch.
  const pxPerSecond = ((wpm / 60) / 7) * (fontSize * 1.4) * speed

  useEffect(() => {
    if (!running) return
    let raf = 0
    let last = performance.now()
    // Position als Fließkommawert mitführen statt aus dem DOM zurückzulesen:
    // scrollTop schneidet Nachkommastellen ab. Bei normalem Sprechtempo sind
    // das rund 0,37 px pro Frame - jede Zuweisung würde auf 0 abgeschnitten und
    // der Prompter stünde still.
    let position = boxRef.current?.scrollTop ?? 0

    const step = (now: number) => {
      // Auf höchstens 100 ms begrenzen: wechselt man den Tab, pausiert der
      // Browser requestAnimationFrame. Ohne Deckel wäre der erste Zeitschritt
      // danach mehrere Sekunden groß und der Text würde weit vorspringen.
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      position += pxPerSecond * dt
      if (boxRef.current) boxRef.current.scrollTop = position
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [running, pxPerSecond])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === ' ') { e.preventDefault(); setRunning(r => !r) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const spoken = sections.filter(s => s.kind !== 'broll' && String(s.spoken || '').trim())

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-white/10 text-sm shrink-0">
        <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={() => setRunning(r => !r)}>
          {running ? <><Pause className="w-4 h-4 mr-1.5" />Pause</> : <><Play className="w-4 h-4 mr-1.5" />Start</>}
        </Button>
        <label className="flex items-center gap-2">
          Tempo
          <input type="range" min="0.3" max="2.5" step="0.1" value={speed}
            onChange={e => setSpeed(Number(e.target.value))} className="w-32" />
          <span className="tabular-nums w-9">{speed.toFixed(1)}×</span>
        </label>
        <label className="flex items-center gap-2">
          Schrift
          <input type="range" min="24" max="80" step="2" value={fontSize}
            onChange={e => setFontSize(Number(e.target.value))} className="w-28" />
        </label>
        <span className="text-white/50 text-xs">Leertaste startet und pausiert, Esc schließt</span>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div ref={boxRef} className="flex-1 overflow-y-auto px-[12%] py-[40vh]" style={{ fontSize, lineHeight: 1.4 }}>
        {spoken.length === 0 ? (
          <p className="text-white/40">Noch kein Sprechtext vorhanden.</p>
        ) : spoken.map(s => (
          <div key={s.id} className="mb-16">
            {s.heading && <div className="text-white/40 mb-3" style={{ fontSize: fontSize * 0.45 }}>{s.heading}</div>}
            <p className="whitespace-pre-wrap">{s.spoken}</p>
          </div>
        ))}
      </div>

      {/* Lesemarke auf Augenhoehe */}
      <div className="pointer-events-none absolute left-0 right-0 top-[40%] border-t-2 border-red-500/40" />
    </div>
  )
}

// ─── Seite ────────────────────────────────────────────────────────────────────

export function Component() {
  const { projectId, videoId } = useParams()
  const pid = Number(projectId)
  const vid = Number(videoId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const download = useDownload()
  const [prompterOpen, setPrompterOpen] = useState(false)

  // Reiter in der URL halten: so ueberlebt die Auswahl einen Reload und laesst
  // sich verlinken - praktisch, wenn man jemandem eine bestimmte Ansicht zeigt
  const [searchParams, setSearchParams] = useSearchParams()
  const TABS = ['script', 'upload', 'rights', 'clips', 'checklist', 'numbers']
  const activeTab = TABS.includes(searchParams.get('tab') || '') ? (searchParams.get('tab') as string) : 'script'
  const setActiveTab = (value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value === 'script') next.delete('tab')
    else next.set('tab', value)
    setSearchParams(next, { replace: true })
  }

  const { data, isLoading } = useQuery({
    queryKey: ['creator-video', vid],
    queryFn: () => api.creator.video(vid),
  })

  // Retention gegen das Skript - nur sinnvoll, wenn YouTube abgeglichen wurde
  const { data: retention } = useQuery({
    queryKey: ['creator-retention', vid],
    queryFn: () => api.creator.retention(vid),
  })

  // Videos des verbundenen Kanals fuer die Auswahlliste. Schlaegt fehl, wenn
  // kein Kanal verbunden ist - dann bleibt es beim Link-Feld.
  const { data: ytVideoList } = useQuery({
    queryKey: ['yt-videos', pid],
    queryFn: () => api.creator.ytVideos(pid),
    retry: false,
  })
  const ytVideos = (ytVideoList || []) as any[]

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['creator-video', vid] })
    queryClient.invalidateQueries({ queryKey: ['creator-videos', pid] })
    queryClient.invalidateQueries({ queryKey: ['creator-overview', pid] })
  }
  const fail = (title: string) => (err: any) =>
    toast({ title, description: err?.message, variant: 'destructive' })

  const updateVideo = useMutation({
    mutationFn: (patch: any) => api.creator.updateVideo(vid, patch),
    onSuccess: invalidate, onError: fail('Nicht gespeichert'),
  })
  const updateSection = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: any }) => api.creator.updateSection(id, patch),
    onSuccess: invalidate, onError: fail('Abschnitt nicht gespeichert'),
  })
  const addSection = useMutation({
    mutationFn: (sortOrder: number) => api.creator.createSection(vid, { kind: 'segment', heading: 'Neuer Abschnitt', sort_order: sortOrder }),
    onSuccess: invalidate, onError: fail('Abschnitt nicht angelegt'),
  })
  const removeSection = useMutation({
    mutationFn: (id: number) => api.creator.deleteSection(id),
    onSuccess: invalidate, onError: fail('Löschen fehlgeschlagen'),
  })
  const reorder = useMutation({
    mutationFn: (sections: Array<{ id: number; sort_order: number }>) => api.creator.reorderSections(vid, sections),
    onSuccess: invalidate,
  })
  const addAsset = useMutation({
    mutationFn: () => api.creator.createAsset(vid, { kind: 'musik', name: '' }),
    onSuccess: invalidate, onError: fail('Eintrag nicht angelegt'),
  })
  const updateAsset = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: any }) => api.creator.updateAsset(id, patch),
    onSuccess: invalidate, onError: fail('Nicht gespeichert'),
  })
  const removeAsset = useMutation({
    mutationFn: (id: number) => api.creator.deleteAsset(id),
    onSuccess: invalidate, onError: fail('Löschen fehlgeschlagen'),
  })
  const addClip = useMutation({
    mutationFn: () => api.creator.createClip(vid, { title: 'Neue Auskopplung' }),
    onSuccess: invalidate, onError: fail('Clip nicht angelegt'),
  })
  const updateClip = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: any }) => api.creator.updateClip(id, patch),
    onSuccess: invalidate, onError: fail('Nicht gespeichert'),
  })
  const removeClip = useMutation({
    mutationFn: (id: number) => api.creator.deleteClip(id),
    onSuccess: invalidate, onError: fail('Löschen fehlgeschlagen'),
  })
  const toggleCheck = useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) => api.creator.updateChecklistItem(id, { done }),
    onSuccess: invalidate, onError: fail('Nicht gespeichert'),
  })
  const addCheck = useMutation({
    mutationFn: (label: string) => api.creator.addChecklistItem(vid, label),
    onSuccess: invalidate, onError: fail('Punkt nicht angelegt'),
  })
  const removeCheck = useMutation({
    mutationFn: (id: number) => api.creator.deleteChecklistItem(id),
    onSuccess: invalidate, onError: fail('Löschen fehlgeschlagen'),
  })

  const video = data?.video
  const sections = useMemo(() => (data?.sections || []) as any[], [data])
  const assets = useMemo(() => (data?.assets || []) as any[], [data])
  const clips = useMemo(() => (data?.clips || []) as any[], [data])
  const checklist = useMemo(() => (data?.checklist || []) as any[], [data])

  const saveTitle = useDebouncedSave<string>(t => updateVideo.mutate({ title: t }))
  const saveHook = useDebouncedSave<string>(h => updateVideo.mutate({ hook: h }))

  const [copied, setCopied] = useState(false)
  const [newCheck, setNewCheck] = useState('')

  function copyChapters() {
    const text = (data?.chapters?.lines || []).join('\n')
    if (!text) return
    navigator.clipboard.writeText(text).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 1800) },
      () => toast({ title: 'Kopieren nicht möglich', variant: 'destructive' })
    )
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= sections.length) return
    const next = [...sections]
    ;[next[index], next[target]] = [next[target], next[index]]
    reorder.mutate(next.map((s, i) => ({ id: s.id, sort_order: i })))
  }

  if (isLoading) {
    return <div className="p-6 space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-64 w-full" /></div>
  }
  if (!video) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Video nicht gefunden.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate(`/projects/${pid}/creator`)}>
          <ArrowLeft className="w-4 h-4 mr-1.5" />Zurück zur Übersicht
        </Button>
      </div>
    )
  }

  const totalSeconds = data.total_seconds || 0
  const targetSeconds = video.target_seconds || 0
  const delta = targetSeconds > 0 ? totalSeconds - targetSeconds : null
  const rights = data.rights || { risk: 'keins', problems: [] }
  const perf = data.performance || {}
  const doneCount = data.checklist_done ?? 0

  const riskStyle = rights.risk === 'hoch' ? 'text-red-400'
    : rights.risk === 'moeglich' ? 'text-amber-400' : 'text-emerald-400'

  return (
    <div className="p-6 max-w-[1400px]">
      {prompterOpen && (
        <Teleprompter sections={sections} wpm={video.wpm || 150} onClose={() => setPrompterOpen(false)} />
      )}

      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => navigate(`/projects/${pid}/creator`)}>
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />Videos
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => setPrompterOpen(true)}>
          <Presentation className="w-3.5 h-3.5 mr-1.5" />Teleprompter
        </Button>
        <Button
          variant="outline" size="sm"
          onClick={() => download(api.creator.scriptPdfUrl(vid), `skript-${(video.title || 'video').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`)}
        >
          <Download className="w-3.5 h-3.5 mr-1.5" />Skript als PDF
        </Button>
      </div>

      <Input
        defaultValue={video.title}
        onChange={e => saveTitle(e.target.value)}
        placeholder="Arbeitstitel des Videos"
        className="h-auto border-0 bg-transparent px-0 text-2xl font-bold tracking-tight focus-visible:ring-0"
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-3 mb-6 pb-5 border-b border-border/50 text-sm">
        <span className="flex items-center gap-1.5" title="Aus dem Sprechtext geschätzt">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <b>{timecode(totalSeconds)}</b>
          {delta !== null && (
            <span className={cn('text-xs', delta > 0 ? 'text-amber-400' : delta < 0 ? 'text-blue-400' : 'text-emerald-400')}>
              {delta > 0 ? '+' : ''}{delta}s ggü. Ziel {timecode(targetSeconds)}
            </span>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          <Type className="w-4 h-4 text-muted-foreground" /><b>{data.total_words}</b>
          <span className="text-xs text-muted-foreground">Wörter</span>
        </span>
        <span className="flex items-center gap-1.5" title="Content-ID-Risiko aus dem verwendeten Material">
          <ShieldAlert className={cn('w-4 h-4', riskStyle)} />
          <span className={cn('text-xs', riskStyle)}>Rechte: {rights.risk}</span>
        </span>
        <span className="text-xs text-muted-foreground">
          Checkliste <b className="text-foreground">{doneCount}/{checklist.length}</b>
        </span>
        <span className="text-xs text-muted-foreground">
          Sprechtempo
          <Input
            type="number" min="80" max="260" defaultValue={video.wpm}
            onBlur={e => updateVideo.mutate({ wpm: Math.max(80, Math.min(260, Number(e.target.value) || 150)) })}
            className="inline-block h-6 w-16 mx-1.5 px-1.5 text-center text-xs"
          />
          W/min
        </span>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="script" className="text-xs">Skript</TabsTrigger>
          <TabsTrigger value="upload" className="text-xs">Upload</TabsTrigger>
          <TabsTrigger value="rights" className="text-xs">Rechte</TabsTrigger>
          <TabsTrigger value="clips" className="text-xs">Auskopplungen</TabsTrigger>
          <TabsTrigger value="checklist" className="text-xs">Checkliste</TabsTrigger>
          <TabsTrigger value="numbers" className="text-xs">Zahlen</TabsTrigger>
        </TabsList>

        {/* ── Skript ── */}
        <TabsContent value="script" className="mt-5">
          <div className="mb-5">
            <Label className="text-xs text-muted-foreground">Hook - die ersten Sekunden entscheiden</Label>
            <Textarea
              defaultValue={video.hook} rows={2}
              onChange={e => saveHook(e.target.value)}
              placeholder="Womit hältst du die Leute in den ersten fünf Sekunden?"
              className="mt-1 text-sm border-l-2 border-l-red-500/60"
            />
          </div>

          <div className="hidden md:grid grid-cols-[92px_1fr_1fr_auto] gap-3 px-1 pb-2 text-[10px] uppercase tracking-wider text-muted-foreground/70">
            <div>Zeit / Typ</div><div>Gesprochener Text</div><div>Bild / B-Roll</div><div />
          </div>

          <div className="space-y-2">
            {sections.map((s, i) => (
              <div key={s.id} className="grid grid-cols-1 md:grid-cols-[92px_1fr_1fr_auto] gap-3 p-3 rounded-lg border border-border/50 bg-card">
                <div className="space-y-1.5">
                  <div className="font-mono text-sm font-bold">{s.timecode}</div>
                  <Select value={s.kind} onValueChange={k => updateSection.mutate({ id: s.id, patch: { kind: k } })}>
                    <SelectTrigger className={cn('h-6 text-[10px] px-1.5', KIND_COLOR[s.kind])}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SECTION_KINDS.map(k => <SelectItem key={k.value} value={k.value} className="text-xs">{k.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="text-[10px] text-muted-foreground">
                    {s.estimatedSeconds}s{s.words > 0 ? ` · ${s.words} W.` : ''}
                  </div>
                  {s.deltaSeconds !== null && s.deltaSeconds !== 0 && (
                    <div className={cn('text-[10px]', s.deltaSeconds > 0 ? 'text-amber-400' : 'text-blue-400')}>
                      {s.deltaSeconds > 0 ? '+' : ''}{s.deltaSeconds}s
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Input
                    defaultValue={s.heading} placeholder="Überschrift (wird zur Kapitelmarke)"
                    onBlur={e => e.target.value !== s.heading && updateSection.mutate({ id: s.id, patch: { heading: e.target.value } })}
                    className="h-7 text-xs font-semibold"
                  />
                  <Textarea
                    defaultValue={s.spoken} rows={4}
                    placeholder={s.kind === 'broll' ? 'B-Roll braucht keinen Sprechtext' : 'Was sagst du hier? [Regieanweisungen in Klammern zählen nicht mit]'}
                    onBlur={e => e.target.value !== s.spoken && updateSection.mutate({ id: s.id, patch: { spoken: e.target.value } })}
                    className="text-sm leading-relaxed"
                  />
                </div>

                <div className="space-y-1.5">
                  <Input
                    type="number" min="0" defaultValue={s.target_seconds} placeholder="Soll-Sekunden"
                    onBlur={e => Number(e.target.value) !== s.target_seconds && updateSection.mutate({ id: s.id, patch: { target_seconds: Math.max(0, Number(e.target.value) || 0) } })}
                    className="h-7 text-xs"
                  />
                  <Textarea
                    defaultValue={s.visuals} rows={4}
                    placeholder="Was ist zu sehen? Einblendungen, Screencast, Schnittnotizen"
                    onBlur={e => e.target.value !== s.visuals && updateSection.mutate({ id: s.id, patch: { visuals: e.target.value } })}
                    className="text-xs leading-relaxed text-muted-foreground"
                  />
                </div>

                <div className="flex md:flex-col items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ChevronUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={i === sections.length - 1} onClick={() => move(i, 1)}>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeSection.mutate(s.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Button variant="outline" size="sm" className="mt-3" onClick={() => addSection.mutate(sections.length)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />Abschnitt hinzufügen
          </Button>
        </TabsContent>

        {/* ── Upload ── */}
        <TabsContent value="upload" className="mt-5">
          <div className="grid md:grid-cols-2 gap-6 max-w-5xl">
            <div>
              <Label className="text-xs text-muted-foreground">Titel-Varianten <span className="opacity-60">- eine pro Zeile</span></Label>
              <Textarea
                defaultValue={video.title_variants} rows={5} className="mt-1 text-sm"
                placeholder={'Ich habe 30 Tage lang …\nWarum niemand über … spricht'}
                onBlur={e => e.target.value !== video.title_variants && updateVideo.mutate({ title_variants: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Thumbnail-Ideen <span className="opacity-60">- eine pro Zeile</span></Label>
              <Textarea
                defaultValue={video.thumbnail_ideas} rows={5} className="mt-1 text-sm"
                placeholder={'Großes Gesicht links, Pfeil rechts\nVorher/Nachher gesplittet'}
                onBlur={e => e.target.value !== video.thumbnail_ideas && updateVideo.mutate({ thumbnail_ideas: e.target.value })}
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Serie / Format</Label>
              <Input defaultValue={video.series} className="mt-1 text-sm" placeholder="z. B. Studio-Tour, Q&A"
                onBlur={e => e.target.value !== video.series && updateVideo.mutate({ series: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Such-Keyword</Label>
              <Input defaultValue={video.keyword} className="mt-1 text-sm" placeholder="Wonach wird gesucht?"
                onBlur={e => e.target.value !== video.keyword && updateVideo.mutate({ keyword: e.target.value })} />
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Kapitelmarken <span className="opacity-60">- aus den Abschnitts-Überschriften</span></Label>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={copyChapters} disabled={!(data.chapters?.lines || []).length}>
                  {copied ? <><Check className="w-3 h-3 mr-1" />Kopiert</> : <><Copy className="w-3 h-3 mr-1" />Kopieren</>}
                </Button>
              </div>
              <pre className="mt-1 p-3 rounded-md bg-muted/40 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                {(data.chapters?.lines || []).join('\n') || '- noch keine Abschnitte mit Überschrift -'}
              </pre>
              {(data.chapters?.problems || []).length > 0 && (
                <ul className="mt-2 space-y-1">
                  {data.chapters.problems.map((p: string, i: number) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-amber-400">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />{p}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground">Videobeschreibung</Label>
              <Textarea
                defaultValue={video.description} rows={7} className="mt-1 text-sm"
                placeholder="Was steht unter dem Video? Links, Kapitel, Quellen."
                onBlur={e => e.target.value !== video.description && updateVideo.mutate({ description: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground">Tags <span className="opacity-60">- kommagetrennt</span></Label>
              <Input defaultValue={video.tags} className="mt-1 text-sm" placeholder="schnitt, workflow, tutorial"
                onBlur={e => e.target.value !== video.tags && updateVideo.mutate({ tags: e.target.value })} />
            </div>

            {/* Sponsoring: Deals werden bei Creators je Video verhandelt */}
            <div className="md:col-span-2 pt-4 mt-2 border-t border-border/50">
              <div className="text-xs uppercase tracking-wider text-muted-foreground/70 mb-3">Sponsoring</div>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Marke</Label>
                  <Input defaultValue={video.sponsor_brand} className="mt-1 text-sm"
                    onBlur={e => e.target.value !== video.sponsor_brand && updateVideo.mutate({ sponsor_brand: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Honorar (€)</Label>
                  <Input type="number" min="0" step="0.01" defaultValue={(video.sponsor_fee_cents || 0) / 100} className="mt-1 text-sm"
                    onBlur={e => updateVideo.mutate({ sponsor_fee_cents: Math.max(0, Math.round((Number(e.target.value) || 0) * 100)) })} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Deadline</Label>
                  <Input type="date" defaultValue={video.sponsor_deadline || ''} className="mt-1 text-sm"
                    onBlur={e => updateVideo.mutate({ sponsor_deadline: e.target.value || null })} />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs text-muted-foreground">Zugesagte Leistungen</Label>
                  <Textarea defaultValue={video.sponsor_deliverables} rows={2} className="mt-1 text-sm"
                    placeholder="60s Integration, Link in der Beschreibung, ein Story-Post"
                    onBlur={e => e.target.value !== video.sponsor_deliverables && updateVideo.mutate({ sponsor_deliverables: e.target.value })} />
                </div>
                <label className="flex items-end gap-2 pb-2 cursor-pointer">
                  <Checkbox
                    checked={Boolean(video.sponsor_disclosed)}
                    onCheckedChange={v => updateVideo.mutate({ sponsor_disclosed: Boolean(v) })}
                  />
                  <span className="text-sm">Werbung gekennzeichnet</span>
                </label>
              </div>
              {video.sponsor_brand && !video.sponsor_disclosed && (
                <div className="flex items-start gap-1.5 mt-3 text-xs text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                  Bezahlte Inhalte müssen gekennzeichnet werden - im Video und in der YouTube-Einstellung.
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Rechte ── */}
        <TabsContent value="rights" className="mt-5">
          <p className="text-xs text-muted-foreground/80 mb-4 max-w-2xl">
            Musik, Stockmaterial und Grafiken mit ihrer Lizenz. Ein einziger ungeklärter Track kann
            die Monetarisierung des ganzen Videos kosten - fehlt die Lizenzangabe, zählt das hier als Risiko.
          </p>

          {rights.problems.length > 0 && (
            <ul className="mb-4 space-y-1">
              {rights.problems.map((p: string, i: number) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />{p}
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2">
            {assets.map(a => (
              <div key={a.id} className="grid grid-cols-1 md:grid-cols-[110px_1fr_1fr_1fr_130px_auto] gap-2 p-2.5 rounded-lg border border-border/50 bg-card items-center">
                <Select value={a.kind} onValueChange={k => updateAsset.mutate({ id: a.id, patch: { kind: k } })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASSET_KINDS.map(k => <SelectItem key={k} value={k} className="text-xs">{k}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input defaultValue={a.name} placeholder="Titel / Bezeichnung" className="h-7 text-xs"
                  onBlur={e => e.target.value !== a.name && updateAsset.mutate({ id: a.id, patch: { name: e.target.value } })} />
                <Input defaultValue={a.source} placeholder="Quelle (Epidemic, Artlist …)" className="h-7 text-xs"
                  onBlur={e => e.target.value !== a.source && updateAsset.mutate({ id: a.id, patch: { source: e.target.value } })} />
                <Input defaultValue={a.license} placeholder="Lizenz / Nachweis" className="h-7 text-xs"
                  onBlur={e => e.target.value !== a.license && updateAsset.mutate({ id: a.id, patch: { license: e.target.value } })} />
                <Select value={a.claim_risk} onValueChange={r => updateAsset.mutate({ id: a.id, patch: { claim_risk: r } })}>
                  <SelectTrigger className={cn('h-7 text-xs', CLAIM_RISKS.find(r => r.value === a.claim_risk)?.style)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLAIM_RISKS.map(r => <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeAsset.mutate(a.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <Button variant="outline" size="sm" className="mt-3" onClick={() => addAsset.mutate()}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />Material hinzufügen
          </Button>
        </TabsContent>

        {/* ── Auskopplungen ── */}
        <TabsContent value="clips" className="mt-5">
          <p className="text-xs text-muted-foreground/80 mb-4 max-w-2xl">
            Welche Stellen werden zu Shorts, Reels oder TikToks? Zeiten beziehen sich auf das fertige Video.
          </p>

          <div className="space-y-2">
            {clips.map(c => (
              <div key={c.id} className="p-3 rounded-lg border border-border/50 bg-card">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_90px_90px_150px_130px_auto] gap-2 items-center">
                  <Input defaultValue={c.title} placeholder="Worum geht es im Clip?" className="h-7 text-xs font-medium"
                    onBlur={e => e.target.value !== c.title && updateClip.mutate({ id: c.id, patch: { title: e.target.value } })} />
                  <Input type="number" min="0" defaultValue={c.start_seconds} placeholder="von (s)" className="h-7 text-xs"
                    onBlur={e => Number(e.target.value) !== c.start_seconds && updateClip.mutate({ id: c.id, patch: { start_seconds: e.target.value } })} />
                  <Input type="number" min="0" defaultValue={c.end_seconds} placeholder="bis (s)" className="h-7 text-xs"
                    onBlur={e => Number(e.target.value) !== c.end_seconds && updateClip.mutate({ id: c.id, patch: { end_seconds: e.target.value } })} />
                  <Select value={c.platform} onValueChange={p => updateClip.mutate({ id: c.id, patch: { platform: p } })}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CLIP_PLATFORMS.map(p => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={c.status} onValueChange={s => updateClip.mutate({ id: c.id, patch: { status: s } })}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CLIP_STATUS.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeClip.mutate(c.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Scissors className="w-3 h-3" />{c.check?.durationSeconds ?? 0}s
                  </span>
                  {(c.check?.problems || []).map((p: string, i: number) => (
                    <span key={i} className="flex items-center gap-1 text-amber-400">
                      <AlertTriangle className="w-3 h-3" />{p}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Button variant="outline" size="sm" className="mt-3" onClick={() => addClip.mutate()}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />Auskopplung planen
          </Button>
        </TabsContent>

        {/* ── Checkliste ── */}
        <TabsContent value="checklist" className="mt-5">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${checklist.length ? (doneCount / checklist.length) * 100 : 0}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{doneCount} von {checklist.length}</span>
            </div>

            <div className="space-y-1">
              {checklist.map(item => (
                <label key={item.id} className="group flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-muted/40 cursor-pointer">
                  <Checkbox
                    checked={Boolean(item.done)}
                    onCheckedChange={v => toggleCheck.mutate({ id: item.id, done: Boolean(v) })}
                  />
                  <span className={cn('text-sm flex-1', item.done && 'line-through text-muted-foreground')}>{item.label}</span>
                  <Button variant="ghost" size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    onClick={e => { e.preventDefault(); removeCheck.mutate(item.id) }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </label>
              ))}
            </div>

            <div className="flex gap-2 mt-4">
              <Input
                value={newCheck} onChange={e => setNewCheck(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newCheck.trim()) { addCheck.mutate(newCheck.trim()); setNewCheck('') }
                }}
                placeholder="Eigenen Punkt ergänzen"
                className="h-8 text-sm"
              />
              <Button variant="outline" size="sm" disabled={!newCheck.trim()}
                onClick={() => { addCheck.mutate(newCheck.trim()); setNewCheck('') }}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ── Zahlen ── */}
        <TabsContent value="numbers" className="mt-5">
          <div className="max-w-4xl">
            <p className="text-xs text-muted-foreground/80 mb-4">
              Werte aus YouTube Studio von Hand eintragen - es gibt keine automatische Anbindung.
              Die Einordnung darunter richtet sich nach den üblichen Richtwerten.
            </p>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Geplante Veröffentlichung</Label>
                <Input type="date" defaultValue={video.publish_at || ''} className="mt-1 text-sm"
                  onBlur={e => updateVideo.mutate({ publish_at: e.target.value || null })} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Tatsächlich veröffentlicht</Label>
                <Input type="date" defaultValue={video.published_at || ''} className="mt-1 text-sm"
                  onBlur={e => updateVideo.mutate({ published_at: e.target.value || null })} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">YouTube-Video</Label>
                {ytVideos.length > 0 ? (
                  // Ist der Kanal verbunden, direkt aus seinen Videos waehlen -
                  // Links heraussuchen und einfuegen ist unnoetige Fleissarbeit
                  <Select
                    value={video.youtube_video_id || 'keins'}
                    onValueChange={v => updateVideo.mutate({ youtube_video_id: v === 'keins' ? '' : v })}
                  >
                    <SelectTrigger className="mt-1 text-xs"><SelectValue placeholder="Video auswählen" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keins" className="text-xs">- nicht verknüpft -</SelectItem>
                      {ytVideos.map((v: any) => (
                        <SelectItem key={v.videoId} value={v.videoId} className="text-xs">{v.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input defaultValue={video.video_url} className="mt-1 text-sm" placeholder="https://youtu.be/…"
                    onBlur={e => e.target.value !== video.video_url && updateVideo.mutate({ video_url: e.target.value })} />
                )}
              </div>

              {([
                ['views', 'Aufrufe'],
                ['impressions', 'Impressionen'],
                ['avg_view_seconds', 'Ø gesehen (Sekunden)'],
                ['likes', 'Likes'],
                ['comments', 'Kommentare'],
                ['subs_gained', 'Abos gewonnen'],
              ] as const).map(([field, label]) => (
                <div key={field}>
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  <Input type="number" min="0" defaultValue={video[field]} className="mt-1 text-sm"
                    onBlur={e => updateVideo.mutate({ [field]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
              {[
                ['Klickrate', perf.ctr !== null && perf.ctr !== undefined ? `${perf.ctr} %` : '—'],
                ['Gesehene Laufzeit', perf.retention !== null && perf.retention !== undefined ? `${perf.retention} %` : '—'],
                ['Likes je 1000', perf.engagementPer1000 ?? '—'],
                ['Aufrufe je Abo', perf.viewsPerSub ?? '—'],
              ].map(([label, value]) => (
                <div key={String(label)} className="px-3.5 py-2.5 rounded-lg border border-border/50 bg-card">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{label}</div>
                  <div className="text-lg font-semibold">{value}</div>
                </div>
              ))}
            </div>

            {(perf.notes || []).length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {perf.notes.map((n: string, i: number) => (
                  <li key={i} className="text-sm text-muted-foreground">{n}</li>
                ))}
              </ul>
            )}

            {/* Retention gegen das Skript: die Auswertung, die Studio nicht
                liefern kann, weil YouTube das Skript nicht kennt */}
            {retention?.has_curve && (
              <div className="mt-8 pt-6 border-t border-border/50">
                <div className="text-xs uppercase tracking-wider text-muted-foreground/70 mb-1">
                  Wo die Leute abspringen
                </div>
                <p className="text-xs text-muted-foreground/80 mb-4 max-w-2xl">
                  Die Retention-Kurve von YouTube über deine Skript-Abschnitte gelegt. Der Verlust ist
                  auf eine Minute normiert, sonst wäre der längste Abschnitt immer der scheinbar schlechteste.
                </p>

                <RetentionChart
                  curve={retention.curve || []}
                  sections={retention.analysis?.sections || []}
                  videoSeconds={totalSeconds}
                />

                <div className="mt-4">
                  {(retention.analysis?.notes || []).map((n: string, i: number) => (
                    <div key={i} className="text-sm mb-1.5">{n}</div>
                  ))}
                </div>

                <div className="mt-4 space-y-1.5">
                  {(retention.analysis?.sections || []).map((s: any) => {
                    const worst = retention.analysis?.worst?.id === s.id
                    const perMin = s.dropPerMinute ?? 0
                    return (
                      <div key={s.id} className={cn(
                        'flex items-center gap-3 p-2.5 rounded-lg border',
                        worst ? 'border-amber-500/40 bg-amber-500/5' : 'border-border/50 bg-card'
                      )}>
                        <span className="font-mono text-xs w-12 shrink-0 text-muted-foreground">
                          {timecode(s.startSeconds)}
                        </span>
                        <span className="text-sm min-w-0 flex-1 truncate">
                          {s.heading || s.kind}
                          <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground/60">{s.kind}</span>
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                          {s.watchStart}% → {s.watchEnd}%
                        </span>
                        <span className={cn(
                          'text-xs shrink-0 tabular-nums w-24 text-right',
                          perMin > 8 ? 'text-red-400' : perMin > 4 ? 'text-amber-400' : 'text-emerald-400'
                        )}>
                          −{perMin}/min
                        </span>
                        {/* Balken: sichtbarer Anteil zu Beginn des Abschnitts */}
                        <span className="hidden md:block w-28 h-1.5 rounded-full bg-muted overflow-hidden shrink-0">
                          <span className="block h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, s.watchStart ?? 0))}%` }} />
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
