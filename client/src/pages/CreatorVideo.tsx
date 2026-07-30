import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { useDownload } from '@/lib/useDownload'
import {
  ArrowLeft, Plus, Trash2, Download, Clock, Type, ChevronUp, ChevronDown,
  AlertTriangle, Check, Copy,
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

function timecode(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds || 0))
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const two = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${two(m % 60)}:${two(s % 60)}` : `${m}:${two(s % 60)}`
}

/** Textfeld, das erst nach kurzer Pause speichert — wie im Drehbuch-Editor. */
function useDebouncedSave<T>(save: (value: T) => void, delay = 600) {
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => timer.current && clearTimeout(timer.current), [])
  return (value: T) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => save(value), delay)
  }
}

// React Router laedt die Seiten per `lazy` und erwartet einen Export namens
// `Component` — wie alle anderen Seiten hier.
export function Component() {
  const { projectId, videoId } = useParams()
  const pid = Number(projectId)
  const vid = Number(videoId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const download = useDownload()

  const { data, isLoading } = useQuery({
    queryKey: ['creator-video', vid],
    queryFn: () => api.creator.video(vid),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['creator-video', vid] })
    queryClient.invalidateQueries({ queryKey: ['creator-videos', pid] })
  }

  const updateVideo = useMutation({
    mutationFn: (patch: any) => api.creator.updateVideo(vid, patch),
    onSuccess: invalidate,
    onError: (err: any) => toast({ title: 'Nicht gespeichert', description: err?.message, variant: 'destructive' }),
  })

  const updateSection = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: any }) => api.creator.updateSection(id, patch),
    onSuccess: invalidate,
    onError: (err: any) => toast({ title: 'Abschnitt nicht gespeichert', description: err?.message, variant: 'destructive' }),
  })

  const addSection = useMutation({
    mutationFn: (sortOrder: number) => api.creator.createSection(vid, { kind: 'segment', heading: 'Neuer Abschnitt', sort_order: sortOrder }),
    onSuccess: invalidate,
    onError: (err: any) => toast({ title: 'Abschnitt nicht angelegt', description: err?.message, variant: 'destructive' }),
  })

  const removeSection = useMutation({
    mutationFn: (id: number) => api.creator.deleteSection(id),
    onSuccess: invalidate,
    onError: (err: any) => toast({ title: 'Löschen fehlgeschlagen', description: err?.message, variant: 'destructive' }),
  })

  const reorder = useMutation({
    mutationFn: (sections: Array<{ id: number; sort_order: number }>) => api.creator.reorderSections(vid, sections),
    onSuccess: invalidate,
  })

  const video = data?.video
  const sections = useMemo(() => (data?.sections || []) as any[], [data])

  const saveTitle = useDebouncedSave<string>(t => updateVideo.mutate({ title: t }))
  const saveHook = useDebouncedSave<string>(h => updateVideo.mutate({ hook: h }))

  const [copied, setCopied] = useState(false)
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

  return (
    <div className="p-6 max-w-[1400px]">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => navigate(`/projects/${pid}/creator`)}>
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />Videos
        </Button>
        <div className="flex-1" />
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

      {/* Kennzahlen */}
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

      <Tabs defaultValue="script">
        <TabsList>
          <TabsTrigger value="script" className="text-xs">Skript</TabsTrigger>
          <TabsTrigger value="upload" className="text-xs">Upload-Paket</TabsTrigger>
        </TabsList>

        {/* ── Skript ── */}
        <TabsContent value="script" className="mt-5">
          <div className="mb-5">
            <Label className="text-xs text-muted-foreground">Hook — die ersten Sekunden entscheiden</Label>
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
                  <Button
                    variant="ghost" size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeSection.mutate(s.id)}
                  >
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

        {/* ── Upload-Paket ── */}
        <TabsContent value="upload" className="mt-5">
          <div className="grid md:grid-cols-2 gap-6 max-w-5xl">
            <div>
              <Label className="text-xs text-muted-foreground">Titel-Varianten <span className="opacity-60">— eine pro Zeile</span></Label>
              <Textarea
                defaultValue={video.title_variants} rows={5} className="mt-1 text-sm"
                placeholder={'Ich habe 30 Tage lang …\nWarum niemand über … spricht'}
                onBlur={e => e.target.value !== video.title_variants && updateVideo.mutate({ title_variants: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Thumbnail-Ideen <span className="opacity-60">— eine pro Zeile</span></Label>
              <Textarea
                defaultValue={video.thumbnail_ideas} rows={5} className="mt-1 text-sm"
                placeholder={'Großes Gesicht links, Pfeil rechts\nVorher/Nachher gesplittet'}
                onBlur={e => e.target.value !== video.thumbnail_ideas && updateVideo.mutate({ thumbnail_ideas: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Kapitelmarken <span className="opacity-60">— aus den Abschnitts-Überschriften</span></Label>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={copyChapters} disabled={!(data.chapters?.lines || []).length}>
                  {copied ? <><Check className="w-3 h-3 mr-1" />Kopiert</> : <><Copy className="w-3 h-3 mr-1" />Kopieren</>}
                </Button>
              </div>
              <pre className="mt-1 p-3 rounded-md bg-muted/40 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                {(data.chapters?.lines || []).join('\n') || '— noch keine Abschnitte mit Überschrift —'}
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
              <Label className="text-xs text-muted-foreground">Tags <span className="opacity-60">— kommagetrennt</span></Label>
              <Input
                defaultValue={video.tags} className="mt-1 text-sm"
                placeholder="schnitt, workflow, tutorial"
                onBlur={e => e.target.value !== video.tags && updateVideo.mutate({ tags: e.target.value })}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
