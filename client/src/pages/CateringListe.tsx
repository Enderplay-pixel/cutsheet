import { useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { Download, UtensilsCrossed, Users } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Person {
  id: number
  name: string
  person_type: 'cast' | 'crew'
}

interface CateringPref {
  person_id: number
  person_type: 'cast' | 'crew'
  dietary: string
  allergies: string
  notes: string
}

interface ShootDay {
  id: number
  day_number: number
  date: string
}

interface CateringListEntry {
  person_id: number
  name: string
  person_type: 'cast' | 'crew'
  dietary: string
  allergies: string
  notes: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DIETARY_OPTIONS = [
  { value: 'keine', label: 'Keine' },
  { value: 'vegetarisch', label: 'Vegetarisch' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'glutenfrei', label: 'Glutenfrei' },
  { value: 'laktosefrei', label: 'Laktosefrei' },
  { value: 'halal', label: 'Halal' },
  { value: 'koscher', label: 'Koscher' },
]

const DIETARY_COLORS: Record<string, string> = {
  vegetarisch: 'green',
  vegan:        'cyan',
  glutenfrei:   'amber',
  laktosefrei:  'blue',
  halal:        'purple',
  koscher:      'red',
}

function formatDate(iso: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

// ─── Debounce hook ────────────────────────────────────────────────────────────

function useDebounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  return useCallback((...args: Parameters<T>) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => fn(...args), delay)
  }, [fn, delay])
}

// ─── Präferenzen row ─────────────────────────────────────────────────────────

function PrefRow({ person, pref, pid, isEven }: { person: Person; pref: CateringPref | undefined; pid: number; isEven: boolean }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [dietary, setDietary] = useState(pref?.dietary ?? 'keine')
  const [allergies, setAllergies] = useState(pref?.allergies ?? '')
  const [notes, setNotes] = useState(pref?.notes ?? '')

  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<CateringPref>) => {
      const res = await fetch(`/api/projects/${pid}/catering-preferences`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ person_id: person.id, person_type: person.person_type, ...data }),
      })
      if (!res.ok) throw new Error('Fehler')
      return (await res.json()).data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catering-prefs', pid] }),
    onError: () => toast({ variant: 'destructive', title: 'Fehler beim Speichern' }),
  })

  const debouncedSave = useDebounce((data: Partial<CateringPref>) => saveMutation.mutate(data), 500)

  const handleDietary = (val: string) => {
    setDietary(val)
    debouncedSave({ dietary: val, allergies, notes })
  }
  const handleAllergies = (val: string) => {
    setAllergies(val)
    debouncedSave({ dietary, allergies: val, notes })
  }
  const handleNotes = (val: string) => {
    setNotes(val)
    debouncedSave({ dietary, allergies, notes: val })
  }

  return (
    <tr className={`border-b border-border/40 hover:bg-muted/20 transition-colors ${isEven ? '' : 'bg-muted/10'}`}>
      <td className="px-4 py-2.5 font-medium text-sm">{person.name}</td>
      <td className="px-4 py-2.5">
        <Badge variant={person.person_type === 'cast' ? 'purple' : 'blue'} className="text-[10px]">
          {person.person_type === 'cast' ? 'Darsteller' : 'Crew'}
        </Badge>
      </td>
      <td className="px-4 py-2.5 min-w-[160px]">
        <Select value={dietary} onValueChange={handleDietary}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DIETARY_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-4 py-2.5 min-w-[180px]">
        <Input
          value={allergies}
          onChange={e => handleAllergies(e.target.value)}
          placeholder="Allergien…"
          className="h-8 text-xs"
        />
      </td>
      <td className="px-4 py-2.5 min-w-[180px]">
        <Input
          value={notes}
          onChange={e => handleNotes(e.target.value)}
          placeholder="Notizen…"
          className="h-8 text-xs"
        />
      </td>
    </tr>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Component() {
  const { projectId: id } = useParams<{ projectId: string }>()
  const pid = Number(id)
  const [selectedDayId, setSelectedDayId] = useState<number | null>(null)

  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // Catering preferences
  const { data: prefs, isLoading: loadingPrefs } = useQuery<CateringPref[]>({
    queryKey: ['catering-prefs', pid],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${pid}/catering-preferences`, { headers })
      if (!res.ok) throw new Error('Fehler')
      return (await res.json()).data
    },
  })

  // Cast
  const { data: cast } = useQuery<Person[]>({
    queryKey: ['cast', pid],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${pid}/cast`, { headers })
      if (!res.ok) throw new Error('Fehler')
      return (await res.json()).data
    },
  })

  // Crew
  const { data: crew } = useQuery<Person[]>({
    queryKey: ['crew', pid],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${pid}/crew`, { headers })
      if (!res.ok) throw new Error('Fehler')
      return (await res.json()).data
    },
  })

  // Shoot days
  const { data: shootDays } = useQuery<ShootDay[]>({
    queryKey: ['shoot-days', pid],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${pid}/shoot-days`, { headers })
      if (!res.ok) throw new Error('Fehler')
      return (await res.json()).data
    },
  })

  // Catering list for selected day
  const { data: cateringList, isLoading: loadingList } = useQuery<CateringListEntry[]>({
    queryKey: ['catering-list', selectedDayId],
    queryFn: async () => {
      if (!selectedDayId) return []
      const res = await fetch(`/api/shoot-days/${selectedDayId}/catering-list`, { headers })
      if (!res.ok) throw new Error('Fehler')
      // Der Server liefert { entries: [...] } mit person_name — die Tabelle
      // erwartet eine Liste mit name
      const data = (await res.json()).data
      const entries: any[] = Array.isArray(data) ? data : (data?.entries ?? [])
      return entries.map(e => ({ ...e, name: e.name ?? e.person_name ?? '' }))
    },
    enabled: !!selectedDayId,
  })

  const allPersons: Person[] = [
    // Darsteller fuehren ihren Namen als actor_name
    ...(cast ?? []).map((p: any) => ({ ...p, name: p.actor_name || p.name || '', person_type: 'cast' as const })),
    ...(crew ?? []).map(p => ({ ...p, person_type: 'crew' as const })),
  ]

  const prefMap = new Map<string, CateringPref>()
  for (const p of prefs ?? []) {
    prefMap.set(`${p.person_type}-${p.person_id}`, p)
  }

  // Summary chips for Tagesliste
  const dietarySummary = (cateringList ?? []).reduce((acc, e) => {
    if (e.dietary && e.dietary !== 'keine') {
      acc[e.dietary] = (acc[e.dietary] ?? 0) + 1
    }
    return acc
  }, {} as Record<string, number>)

  const totalPersons = allPersons.length

  return (
    <div className="px-5 py-6 sm:p-7 max-w-6xl mx-auto animate-fade-up">
      {/* Page hero */}
      <div className="mb-8 pb-7 border-b border-border/40">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-[28px] sm:text-[34px]">Catering</h1>
            <p className="text-sm text-muted-foreground/60 mt-1.5">Ernährungspräferenzen und Tageslisten verwalten</p>
          </div>
          {/* Stat card */}
          <div className="rounded-xl border border-border/60 bg-card p-5 card-lift group flex items-start gap-4 min-w-[160px]">
            <div className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <div className="text-[2.25rem] font-bold tabular-nums leading-none">{totalPersons}</div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] mt-2 text-muted-foreground">Personen</div>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="praeferenzen">
        <TabsList className="mb-6">
          <TabsTrigger value="praeferenzen" className="active:scale-[0.97]">Präferenzen</TabsTrigger>
          <TabsTrigger value="tagesliste" className="active:scale-[0.97]">Tagesliste</TabsTrigger>
        </TabsList>

        {/* ── Präferenzen ── */}
        <TabsContent value="praeferenzen">
          <div className="mb-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40">
              Alle Personen
            </span>
          </div>

          {loadingPrefs ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}
            </div>
          ) : allPersons.length === 0 ? (
            <div className="rounded-xl border border-border/60 bg-card p-16 flex flex-col items-center justify-center gap-3">
              <UtensilsCrossed className="h-10 w-10 opacity-20" />
              <p className="text-sm text-muted-foreground">Keine Personen gefunden.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border/40">
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Name</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Typ</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Diät</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Allergien</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Notizen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allPersons.map((p, i) => (
                      <PrefRow
                        key={`${p.person_type}-${p.id}`}
                        person={p}
                        pref={prefMap.get(`${p.person_type}-${p.id}`)}
                        pid={pid}
                        isEven={i % 2 === 0}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Tagesliste ── */}
        <TabsContent value="tagesliste" className="space-y-5">
          {/* Day selector card */}
          <div className="rounded-xl border border-border/60 bg-card p-5">
            <div className="mb-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40">Drehtag auswählen</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <Select
                value={selectedDayId ? String(selectedDayId) : ''}
                onValueChange={v => setSelectedDayId(Number(v))}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Drehtag auswählen…" />
                </SelectTrigger>
                <SelectContent>
                  {(shootDays ?? []).map(d => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      DT {d.day_number} – {formatDate(d.date)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" disabled className="active:scale-[0.97]">
                <Download className="mr-2 h-4 w-4" />
                PDF exportieren
              </Button>
            </div>
          </div>

          {!selectedDayId && (
            <div className="rounded-xl border border-border/60 bg-card p-16 flex flex-col items-center justify-center gap-3">
              <UtensilsCrossed className="h-10 w-10 opacity-20" />
              <p className="text-sm text-muted-foreground">Bitte einen Drehtag auswählen.</p>
            </div>
          )}

          {selectedDayId && loadingList && (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}
            </div>
          )}

          {selectedDayId && !loadingList && (
            <>
              {/* Dietary summary chips banner */}
              {Object.keys(dietarySummary).length > 0 && (
                <div className="rounded-xl border border-border/60 bg-card p-4">
                  <div className="mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40">Ernährungsübersicht</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(dietarySummary).map(([diet, count]) => (
                      <Badge
                        key={diet}
                        variant={(DIETARY_COLORS[diet] as any) ?? 'secondary'}
                        className="px-3 py-1 text-xs font-semibold"
                      >
                        {count}× {diet}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Table */}
              {(cateringList ?? []).length === 0 ? (
                <div className="rounded-xl border border-border/60 bg-card p-16 flex flex-col items-center justify-center gap-3">
                  <UtensilsCrossed className="h-10 w-10 opacity-20" />
                  <p className="text-sm text-muted-foreground">Keine Personen für diesen Drehtag.</p>
                </div>
              ) : (
                <>
                  <div className="mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40">
                      {(cateringList ?? []).length} Personen
                    </span>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/30 border-b border-border/40">
                            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Name</th>
                            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Typ</th>
                            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Diät</th>
                            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Allergien</th>
                            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Notizen</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(cateringList ?? []).map((e, i) => (
                            <tr
                              key={`${e.person_type}-${e.person_id}`}
                              className={`border-b border-border/40 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}
                            >
                              <td className="px-4 py-2.5 font-medium">{e.name}</td>
                              <td className="px-4 py-2.5">
                                <Badge variant={e.person_type === 'cast' ? 'purple' : 'blue'} className="text-[10px]">
                                  {e.person_type === 'cast' ? 'Darsteller' : 'Crew'}
                                </Badge>
                              </td>
                              <td className="px-4 py-2.5">
                                {e.dietary && e.dietary !== 'keine' ? (
                                  <Badge variant={(DIETARY_COLORS[e.dietary] as any) ?? 'secondary'}>
                                    {e.dietary}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground/40">–</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-muted-foreground text-sm">{e.allergies || <span className="text-muted-foreground/40">–</span>}</td>
                              <td className="px-4 py-2.5 text-muted-foreground text-sm">{e.notes || <span className="text-muted-foreground/40">–</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
