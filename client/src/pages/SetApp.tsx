import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Moon, Sun, Clock, Users, List, Camera, FileText, Check, CheckCircle2 } from 'lucide-react'
import { cn, heuteISO } from '@/lib/utils'

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
  const { data: callSheet, isLoading } = useQuery({
    queryKey: ['set-call-sheet', dayId],
    queryFn: () => req<any>(`/shoot-days/${dayId}/call-sheet`),
    enabled: !!dayId,
  })

  if (!dayId) return <EmptyState text="Drehtag auswählen" />
  if (isLoading) return <LoadingCards />

  const entries = callSheet?.entries || []
  const sorted = [...entries].sort((a: any, b: any) => (a.call_time ?? 0) - (b.call_time ?? 0))

  return (
    <div className="space-y-3">
      {sorted.length === 0 && <EmptyState text="Keine Einträge in der Disposition" />}
      {sorted.map((entry: any, i: number) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-5 flex items-center gap-5">
          <div className="text-center min-w-[80px]">
            <div className="text-3xl font-bold tabular-nums text-primary">
              {entry.call_time != null ? formatMinutes(entry.call_time) : '–:––'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Calltime</div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xl font-semibold truncate">{entry.person_name || entry.name || '–'}</div>
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

  const { data: shots, isLoading } = useQuery({
    queryKey: ['set-shots', projectId, dayId],
    queryFn: () => req<any[]>(`/projects/${projectId}/shots${dayId ? `?shootDayId=${dayId}` : ''}`),
    enabled: !!projectId,
  })

  const toggleDone = useMutation({
    mutationFn: (id: number) => req<any>(`/shots/${id}/done`, { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['set-shots', projectId, dayId] }),
  })

  if (isLoading) return <LoadingCards />
  if (!shots || shots.length === 0) return <EmptyState text="Keine Shots für diesen Tag" />

  const done = shots.filter((s: any) => s.done).length
  const total = shots.length

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 py-2">
        <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
        <span className="text-sm font-semibold text-muted-foreground">{done}/{total}</span>
      </div>
      {shots.map((shot: any) => (
        <button
          key={shot.id}
          onClick={() => toggleDone.mutate(shot.id)}
          className={cn(
            'w-full text-left rounded-2xl border p-5 flex items-center gap-4 transition-colors',
            shot.done ? 'border-green-500/30 bg-green-500/5' : 'border-border bg-card hover:border-primary/40'
          )}
        >
          <div className={cn('w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
            shot.done ? 'border-green-500 bg-green-500' : 'border-border'
          )}>
            {shot.done && <Check className="w-4 h-4 text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className={cn('text-lg font-semibold', shot.done && 'line-through text-muted-foreground')}>
              {shot.shot_number || shot.description || `Shot #${shot.id}`}
            </div>
            {shot.description && shot.shot_number && (
              <div className="text-sm text-muted-foreground truncate">{shot.description}</div>
            )}
          </div>
          {shot.done && <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />}
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

  const { data: callSheet, isLoading } = useQuery({
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

  if (!dayId) return <EmptyState text="Drehtag auswählen" />
  if (isLoading) return <LoadingCards />

  const entries = callSheet?.entries || []
  const done = entries.filter((e: any) => e.checked_in).length
  const total = entries.length

  return (
    <div className="space-y-3">
      <div className="text-base font-medium text-muted-foreground pb-1">
        {done}/{total} eingecheckt
      </div>
      {entries.length === 0 && <EmptyState text="Keine Personen in der Disposition" />}
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
                Eingecheckt
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

  const { data: scenes } = useQuery({
    queryKey: ['set-scenes', projectId],
    queryFn: () => req<any[]>(`/projects/${projectId}/scenes`),
    enabled: !!projectId,
  })

  const selectedScene = (scenes || []).find((s: any) => String(s.id) === selectedSceneId)

  return (
    <div className="space-y-4">
      <Select value={selectedSceneId} onValueChange={setSelectedSceneId}>
        <SelectTrigger className="h-12 text-base">
          <SelectValue placeholder="Szene auswählen" />
        </SelectTrigger>
        <SelectContent>
          {(scenes || []).map((s: any) => (
            <SelectItem key={s.id} value={String(s.id)} className="text-sm">
              Szene {s.scene_number}{s.title ? ` – ${s.title}` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedScene ? (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Szene {selectedScene.scene_number}</div>
            <div className="text-2xl font-bold">{selectedScene.title || selectedScene.location || '–'}</div>
          </div>
          {selectedScene.continuity_notes && (
            <div>
              <div className="text-sm font-semibold text-muted-foreground mb-2">Continuity-Notizen</div>
              <div className="text-base leading-relaxed whitespace-pre-wrap">{selectedScene.continuity_notes}</div>
            </div>
          )}
          {selectedScene.wardrobe_notes && (
            <div>
              <div className="text-sm font-semibold text-muted-foreground mb-2">Kostüm</div>
              <div className="text-base leading-relaxed whitespace-pre-wrap">{selectedScene.wardrobe_notes}</div>
            </div>
          )}
          {selectedScene.hair_makeup_notes && (
            <div>
              <div className="text-sm font-semibold text-muted-foreground mb-2">Maske / Haare</div>
              <div className="text-base leading-relaxed whitespace-pre-wrap">{selectedScene.hair_makeup_notes}</div>
            </div>
          )}
          {!selectedScene.continuity_notes && !selectedScene.wardrobe_notes && !selectedScene.hair_makeup_notes && (
            <div className="text-muted-foreground text-base">Keine Continuity-Notizen vorhanden.</div>
          )}
        </div>
      ) : (
        <EmptyState text="Szene auswählen um Continuity anzuzeigen" />
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
export function Component() {
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'))
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [selectedDayId, setSelectedDayId] = useState<string>('')

  useEffect(() => { track('set_app_used') }, [])

  const toggleDark = () => {
    setDarkMode(d => {
      document.documentElement.classList.toggle('dark', !d)
      document.documentElement.classList.toggle('light', d)
      return !d
    })
  }

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects-set'],
    queryFn: () => req<any[]>('/projects'),
  })

  const { data: shootDays } = useQuery({
    queryKey: ['shoot-days-set', selectedProjectId],
    queryFn: () => req<any[]>(`/projects/${selectedProjectId}/shoot-days`),
    enabled: !!selectedProjectId,
  })

  // Auto-select today's shoot day
  const today = heuteISO()

  return (
    <div className={cn('min-h-screen bg-background text-foreground', darkMode ? 'dark' : '')}>
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between py-2">
          <div>
            <h1 className="text-2xl font-bold">Set-App</h1>
            <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          <button
            onClick={toggleDark}
            className="w-12 h-12 rounded-2xl border-2 border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
          >
            {darkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
          </button>
        </div>

        {/* Project + Day selectors */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Projekt</div>
            {projectsLoading ? (
              <Skeleton className="h-12 rounded-xl" />
            ) : (
              <Select value={selectedProjectId} onValueChange={v => { setSelectedProjectId(v); setSelectedDayId('') }}>
                <SelectTrigger className="h-12 text-base rounded-xl">
                  <SelectValue placeholder="Projekt wählen" />
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
            <div className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Drehtag</div>
            <Select value={selectedDayId} onValueChange={setSelectedDayId} disabled={!selectedProjectId}>
              <SelectTrigger className="h-12 text-base rounded-xl">
                <SelectValue placeholder="Drehtag wählen" />
              </SelectTrigger>
              <SelectContent>
                {(shootDays || []).map((d: any) => (
                  <SelectItem key={d.id} value={String(d.id)} className="text-sm">
                    {d.date === today ? '● Heute – ' : ''}
                    {d.date ? new Date(d.date + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }) : `Tag #${d.id}`}
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
              Dispo
            </TabsTrigger>
            <TabsTrigger value="shotlist" className="flex flex-col gap-0.5 text-xs rounded-xl">
              <List className="w-4 h-4" />
              Shots
            </TabsTrigger>
            <TabsTrigger value="checkin" className="flex flex-col gap-0.5 text-xs rounded-xl">
              <Users className="w-4 h-4" />
              Check-in
            </TabsTrigger>
            <TabsTrigger value="continuity" className="flex flex-col gap-0.5 text-xs rounded-xl">
              <FileText className="w-4 h-4" />
              Continuity
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
