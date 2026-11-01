import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Moon, Sun, Clock, Users, List, Camera, FileText, Check, CheckCircle2 } from 'lucide-react'
import { cn, heuteISO } from '@/lib/utils'
import { feiern, gespeichert } from '@/lib/belohnung'
import { useT, useGebietsschema } from '@/lib/useT'
import { setAppT as T } from '@/lib/texte/SetApp'
import { useProjectStore } from '@/store/useProjectStore'

const API_BASE = '/api'
async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}${path}`, { headers: { ...headers, ...options?.headers }, ...options })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Fehler')
  return json.data
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}


// ─── Tagesdispo Tab ───────────────────────────────────────────────────────────
function TagesdispoTab({ dayId }: { dayId: string }) {
  const tt = useT()
  const { data: callSheet, isLoading } = useQuery({
    networkMode: 'offlineFirst',
    queryKey: ['set-call-sheet', dayId],
    queryFn: () => req<any>(`/shoot-days/${dayId}/call-sheet`),
    enabled: !!dayId,
  })

  if (!dayId) return <EmptyState text={tt(T.drehtagAuswaehlen)} />
  if (isLoading) return <LoadingCards />

  const entries = callSheet?.entries || []
  const sorted = [...entries].sort((a: any, b: any) => (a.call_time ?? 0) - (b.call_time ?? 0))

  return (
    <div className="space-y-3">
      {sorted.length === 0 && <EmptyState text={tt(T.keineEintraege)} />}
      {sorted.map((entry: any, i: number) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-5 flex items-center gap-5">
          <div className="text-center min-w-[80px]">
            <div className="text-3xl font-bold tabular-nums text-primary">
              {entry.call_time != null ? formatMinutes(entry.call_time) : '-:--'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{tt(T.calltime)}</div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xl font-semibold truncate">{entry.person_name || entry.name || '-'}</div>
            <div className="text-base text-muted-foreground">{entry.role || entry.department || entry.person_type || ''}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Shotlist Tab ─────────────────────────────────────────────────────────────
function ShotlistTab({ projectId, dayId }: { projectId: string; dayId: string }) {
  const queryClient = useQueryClient()
  const tt = useT()

  const { data: shots, isLoading } = useQuery({
    networkMode: 'offlineFirst',
    queryKey: ['set-shots', projectId, dayId],
    queryFn: () => req<any[]>(`/projects/${projectId}/shots${dayId ? `?shootDayId=${dayId}` : ''}`),
    enabled: !!projectId,
  })

  const toggleDone = useMutation({
    meta: { stumm: true },
    mutationFn: (id: number) => req<any>(`/shots/${id}/done`, { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['set-shots', projectId, dayId] }),
  })

  if (isLoading) return <LoadingCards />
  if (!shots || shots.length === 0) return <EmptyState text={tt(T.keineShots)} />

  const done = shots.filter((s: any) => s.done).length
  const total = shots.length

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 py-2">
        <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-success rounded-full transition-[width] duration-700 ease-spring" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
        <span className="text-sm font-semibold text-muted-foreground">{done}/{total}</span>
      </div>
      {shots.map((shot: any) => (
        <button
          key={shot.id}
          onClick={(e) => {
            if (!shot.done) {
              const kreis = e.currentTarget.querySelector('[data-kreis]') ?? e.currentTarget
              feiern(kreis)
              // Letzter offener Shot des Tages: der große Moment
              if (done + 1 === total) {
                window.setTimeout(() => { feiern({ x: window.innerWidth / 2, y: window.innerHeight / 3 }, true); gespeichert(tt(T.imKasten)) }, 180)
              }
            }
            toggleDone.mutate(shot.id)
          }}
          className={cn(
            'w-full text-left rounded-2xl border p-5 flex items-center gap-4 transition-colors',
            shot.done ? 'border-success/30 bg-success/5' : 'border-border bg-card hover:border-primary/40'
          )}
        >
          <div data-kreis className={cn('w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-[background-color,border-color,transform] duration-300 ease-spring',
            shot.done ? 'border-success bg-success scale-110' : 'border-border'
          )}>
            {shot.done && <Check className="w-4 h-4 text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className={cn('text-lg font-semibold', shot.done && 'line-through text-muted-foreground')}>
              {shot.shot_number || shot.description || tt(T.shotNr).replace('{n}', String(shot.id))}
            </div>
            {shot.description && shot.shot_number && (
              <div className="text-sm text-muted-foreground truncate">{shot.description}</div>
            )}
          </div>
          {shot.done && <CheckCircle2 className="w-6 h-6 text-success shrink-0" />}
        </button>
      ))}
    </div>
  )
}

// ─── Check-in Tab ─────────────────────────────────────────────────────────────
// Check-ins werden serverseitig persistiert (call_sheet_entries.checked_in),
// damit Set-App und Check-in-Board dasselbe sehen.
function CheckInTab({ dayId }: { dayId: string }) {
  const queryClient = useQueryClient()
  const tt = useT()

  const { data: callSheet, isLoading } = useQuery({
    networkMode: 'offlineFirst',
    queryKey: ['set-call-sheet', dayId],
    queryFn: () => req<any>(`/shoot-days/${dayId}/call-sheet`),
    enabled: !!dayId,
  })

  const checkinMutation = useMutation({
    mutationFn: ({ entryId, checkedIn }: { entryId: number; checkedIn: boolean }) =>
      req<any>(`/call-sheet-entries/${entryId}/checkin`, {
        method: 'POST',
        body: JSON.stringify({ checked_in: checkedIn }),
      }),
    // Optimistic update: am Set zählt jede Sekunde
    onMutate: async ({ entryId, checkedIn }) => {
      await queryClient.cancelQueries({ queryKey: ['set-call-sheet', dayId] })
      const previous = queryClient.getQueryData<any>(['set-call-sheet', dayId])
      queryClient.setQueryData<any>(['set-call-sheet', dayId], (old: any) => old ? {
        ...old,
        entries: (old.entries || []).map((e: any) => e.id === entryId ? { ...e, checked_in: checkedIn } : e),
      } : old)
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['set-call-sheet', dayId], ctx.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['set-call-sheet', dayId] }),
  })

  if (!dayId) return <EmptyState text={tt(T.drehtagAuswaehlen)} />
  if (isLoading) return <LoadingCards />

  const entries = callSheet?.entries || []
  const done = entries.filter((e: any) => e.checked_in).length
  const total = entries.length

  return (
    <div className="space-y-3">
      <div className="text-base font-medium text-muted-foreground pb-1">
        {tt(T.eingechecktAnzahl).replace('{done}', String(done)).replace('{total}', String(total))}
      </div>
      {entries.length === 0 && <EmptyState text={tt(T.keinePersonen)} />}
      {entries.map((entry: any) => {
        // entry.id statt person_id: Cast- und Crew-IDs kollidieren sonst
        const isIn = !!entry.checked_in
        return (
          <button
            key={entry.id}
            onClick={() => checkinMutation.mutate({ entryId: entry.id, checkedIn: !isIn })}
            className={cn(
              'w-full text-left rounded-2xl border p-5 flex items-center gap-4 transition-colors',
              isIn ? 'border-green-500/40 bg-green-500/8' : 'border-border bg-card hover:border-primary/30'
            )}
          >
            <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-base font-bold transition-colors shrink-0',
              isIn ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
            )}>
              {(entry.person_name || entry.name || '?')[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xl font-semibold">{entry.person_name || entry.name}</div>
              <div className="text-sm text-muted-foreground">{entry.role || entry.department || ''}</div>
            </div>
            {isIn && (
              <Badge className="bg-green-500 text-white border-0 text-sm px-3 py-1">
                <Check className="w-3.5 h-3.5 mr-1" />
                {tt(T.eingecheckt)}
              </Badge>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Continuity Tab ───────────────────────────────────────────────────────────
function ContinuityTab({ projectId }: { projectId: string }) {
  const [selectedSceneId, setSelectedSceneId] = useState<string>('')
  const tt = useT()

  const { data: scenes } = useQuery({
    networkMode: 'offlineFirst',
    queryKey: ['set-scenes', projectId],
    queryFn: () => req<any[]>(`/projects/${projectId}/scenes`),
    enabled: !!projectId,
  })

  const selectedScene = (scenes || []).find((s: any) => String(s.id) === selectedSceneId)

  return (
    <div className="space-y-4">
      <Select value={selectedSceneId} onValueChange={setSelectedSceneId}>
        <SelectTrigger className="h-12 text-base">
          <SelectValue placeholder={tt(T.szeneAuswaehlen)} />
        </SelectTrigger>
        <SelectContent>
          {(scenes || []).map((s: any) => (
            <SelectItem key={s.id} value={String(s.id)} className="text-sm">
              {tt(T.szeneNr).replace('{n}', String(s.scene_number))}{s.title ? ` - ${s.title}` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedScene ? (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{tt(T.szeneNr).replace('{n}', String(selectedScene.scene_number))}</div>
            <div className="text-2xl font-bold">{selectedScene.title || selectedScene.location || '-'}</div>
          </div>
          {selectedScene.continuity_notes && (
            <div>
              <div className="text-sm font-semibold text-muted-foreground mb-2">{tt(T.continuityNotizen)}</div>
              <div className="text-base leading-relaxed whitespace-pre-wrap">{selectedScene.continuity_notes}</div>
            </div>
          )}
          {selectedScene.wardrobe_notes && (
            <div>
              <div className="text-sm font-semibold text-muted-foreground mb-2">{tt(T.kostuem)}</div>
              <div className="text-base leading-relaxed whitespace-pre-wrap">{selectedScene.wardrobe_notes}</div>
            </div>
          )}
          {selectedScene.hair_makeup_notes && (
            <div>
              <div className="text-sm font-semibold text-muted-foreground mb-2">{tt(T.maskeHaare)}</div>
              <div className="text-base leading-relaxed whitespace-pre-wrap">{selectedScene.hair_makeup_notes}</div>
            </div>
          )}
          {!selectedScene.continuity_notes && !selectedScene.wardrobe_notes && !selectedScene.hair_makeup_notes && (
            <div className="text-muted-foreground text-base">{tt(T.keineContinuity)}</div>
          )}
        </div>
      ) : (
        <EmptyState text={tt(T.szeneFuerContinuity)} />
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-16 text-muted-foreground text-lg">{text}</div>
  )
}

function LoadingCards() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const an = () => setOnline(true), aus = () => setOnline(false)
    window.addEventListener('online', an); window.addEventListener('offline', aus)
    return () => { window.removeEventListener('online', an); window.removeEventListener('offline', aus) }
  }, [])
  return online
}

export function Component() {
  // Die gespeicherte Einstellung der App - vorher ein eigener Zustand: Umschalten
  // am Set galt nur bis zum Neuladen (gemessen am 31.10.2026)
  const { darkMode, toggleDarkMode } = useProjectStore()
  // Auswahl merken: offline neu geöffnet, soll die App direkt den Tag zeigen
  const gemerkt = (() => { try { return JSON.parse(localStorage.getItem('set-auswahl') || '{}') } catch { return {} } })()
  const [selectedProjectId, setSelectedProjectId] = useState<string>(gemerkt.projekt ?? '')
  const [selectedDayId, setSelectedDayId] = useState<string>(gemerkt.tag ?? '')
  useEffect(() => {
    try { localStorage.setItem('set-auswahl', JSON.stringify({ projekt: selectedProjectId, tag: selectedDayId })) } catch { /* privat */ }
  }, [selectedProjectId, selectedDayId])
  const online = useOnline()
  const tt = useT()
  const gebietsschema = useGebietsschema()

  useEffect(() => { track('set_app_used') }, [])


  const { data: projects, isLoading: projectsLoading } = useQuery({
    networkMode: 'offlineFirst',
    queryKey: ['projects-set'],
    queryFn: () => req<any[]>('/projects'),
  })

  const { data: shootDays } = useQuery({
    networkMode: 'offlineFirst',
    queryKey: ['shoot-days-set', selectedProjectId],
    queryFn: () => req<any[]>(`/projects/${selectedProjectId}/shoot-days`),
    enabled: !!selectedProjectId,
  })

  // Den heutigen Drehtag von selbst wählen, wenn keiner (mehr) gewählt ist.
  // Der Kommentar versprach das schon, gebaut war nur die Markierung "Heute".
  const today = heuteISO()
  useEffect(() => {
    if (!shootDays?.length) return
    if (selectedDayId && shootDays.some((d: any) => String(d.id) === selectedDayId)) return
    const heutiger = shootDays.find((d: any) => d.date === today)
    if (heutiger) setSelectedDayId(String(heutiger.id))
  }, [shootDays, selectedDayId, today])

  return (
    <div className={cn('min-h-screen bg-background text-foreground', darkMode ? 'dark' : '')}>
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between py-2">
          <div>
            <h1 className="font-display text-[28px] sm:text-[34px]">{tt(T.titel)}</h1>
            <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString(gebietsschema, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          <button
            onClick={toggleDarkMode}
            aria-label={tt(darkMode ? T.hell : T.dunkel)} title={tt(darkMode ? T.hell : T.dunkel)}
            className="w-12 h-12 rounded-2xl border-2 border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
          >
            {darkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
          </button>
        </div>

        {!online && (
          <div role="status" className="rounded-2xl bg-warning/15 text-warning px-4 py-3 text-sm font-medium">
            {tt(T.offline)}
          </div>
        )}

        {/* Project + Day selectors */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">{tt(T.projekt)}</div>
            {projectsLoading ? (
              <Skeleton className="h-12 rounded-xl" />
            ) : (
              <Select value={selectedProjectId} onValueChange={v => { setSelectedProjectId(v); setSelectedDayId('') }}>
                <SelectTrigger className="h-12 text-base rounded-xl">
                  <SelectValue placeholder={tt(T.projektWaehlen)} />
                </SelectTrigger>
                <SelectContent>
                  {(projects || []).map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)} className="text-sm">{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">{tt(T.drehtag)}</div>
            <Select value={selectedDayId} onValueChange={setSelectedDayId} disabled={!selectedProjectId}>
              <SelectTrigger className="h-12 text-base rounded-xl">
                <SelectValue placeholder={tt(T.drehtagWaehlen)} />
              </SelectTrigger>
              <SelectContent>
                {(shootDays || []).map((d: any) => (
                  <SelectItem key={d.id} value={String(d.id)} className="text-sm">
                    {d.date === today ? tt(T.heute) : ''}
                    {d.date ? new Date(d.date + 'T00:00:00').toLocaleDateString(gebietsschema, { weekday: 'short', day: 'numeric', month: 'short' }) : tt(T.tagNr).replace('{n}', String(d.id))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Main tabs */}
        <Tabs defaultValue="dispo">
          <TabsList className="grid grid-cols-4 h-12 rounded-2xl">
            <TabsTrigger value="dispo" className="flex flex-col gap-0.5 text-xs rounded-xl">
              <Clock className="w-4 h-4" />
              {tt(T.tabDispo)}
            </TabsTrigger>
            <TabsTrigger value="shotlist" className="flex flex-col gap-0.5 text-xs rounded-xl">
              <List className="w-4 h-4" />
              {tt(T.tabShots)}
            </TabsTrigger>
            <TabsTrigger value="checkin" className="flex flex-col gap-0.5 text-xs rounded-xl">
              <Users className="w-4 h-4" />
              {tt(T.tabCheckin)}
            </TabsTrigger>
            <TabsTrigger value="continuity" className="flex flex-col gap-0.5 text-xs rounded-xl">
              <FileText className="w-4 h-4" />
              {tt(T.tabContinuity)}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dispo" className="mt-4">
            <TagesdispoTab dayId={selectedDayId} />
          </TabsContent>

          <TabsContent value="shotlist" className="mt-4">
            <ShotlistTab projectId={selectedProjectId} dayId={selectedDayId} />
          </TabsContent>

          <TabsContent value="checkin" className="mt-4">
            <CheckInTab dayId={selectedDayId} />
          </TabsContent>

          <TabsContent value="continuity" className="mt-4">
            <ContinuityTab projectId={selectedProjectId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
