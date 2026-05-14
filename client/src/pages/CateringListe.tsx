import { useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Download, UtensilsCrossed } from 'lucide-react'

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

function PrefRow({ person, pref, pid }: { person: Person; pref: CateringPref | undefined; pid: number }) {
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
      return res.json()
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
    <tr className="border-b border-border hover:bg-muted/20">
      <td className="px-3 py-2 font-medium">{person.name}</td>
      <td className="px-3 py-2">
        <Badge variant={person.person_type === 'cast' ? 'purple' : 'blue'} className="text-[10px]">
          {person.person_type === 'cast' ? 'Darsteller' : 'Crew'}
        </Badge>
      </td>
      <td className="px-3 py-2 min-w-[160px]">
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
      <td className="px-3 py-2 min-w-[180px]">
        <Input
          value={allergies}
          onChange={e => handleAllergies(e.target.value)}
          placeholder="Allergien…"
          className="h-8 text-xs"
        />
      </td>
      <td className="px-3 py-2 min-w-[180px]">
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
      return res.json()
    },
  })

  // Cast
  const { data: cast } = useQuery<Person[]>({
    queryKey: ['cast', pid],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${pid}/cast`, { headers })
      if (!res.ok) throw new Error('Fehler')
      return res.json()
    },
  })

  // Crew
  const { data: crew } = useQuery<Person[]>({
    queryKey: ['crew', pid],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${pid}/crew`, { headers })
      if (!res.ok) throw new Error('Fehler')
      return res.json()
    },
  })

  // Shoot days
  const { data: shootDays } = useQuery<ShootDay[]>({
    queryKey: ['shoot-days', pid],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${pid}/shoot-days`, { headers })
      if (!res.ok) throw new Error('Fehler')
      return res.json()
    },
  })

  // Catering list for selected day
  const { data: cateringList, isLoading: loadingList } = useQuery<CateringListEntry[]>({
    queryKey: ['catering-list', selectedDayId],
    queryFn: async () => {
      if (!selectedDayId) return []
      const res = await fetch(`/api/shoot-days/${selectedDayId}/catering-list`, { headers })
      if (!res.ok) throw new Error('Fehler')
      return res.json()
    },
    enabled: !!selectedDayId,
  })

  const allPersons: Person[] = [
    ...(cast ?? []).map(p => ({ ...p, person_type: 'cast' as const })),
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Catering</h1>
      </div>

      <Tabs defaultValue="praeferenzen">
        <TabsList>
          <TabsTrigger value="praeferenzen">Präferenzen</TabsTrigger>
          <TabsTrigger value="tagesliste">Tagesliste</TabsTrigger>
        </TabsList>

        {/* ── Präferenzen ── */}
        <TabsContent value="praeferenzen" className="mt-4">
          {loadingPrefs ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : allPersons.length === 0 ? (
            <p className="text-muted-foreground">Keine Personen gefunden.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="px-3 py-2 font-semibold">Name</th>
                    <th className="px-3 py-2 font-semibold">Typ</th>
                    <th className="px-3 py-2 font-semibold">Diät</th>
                    <th className="px-3 py-2 font-semibold">Allergien</th>
                    <th className="px-3 py-2 font-semibold">Notizen</th>
                  </tr>
                </thead>
                <tbody>
                  {allPersons.map(p => (
                    <PrefRow
                      key={`${p.person_type}-${p.id}`}
                      person={p}
                      pref={prefMap.get(`${p.person_type}-${p.id}`)}
                      pid={pid}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Tagesliste ── */}
        <TabsContent value="tagesliste" className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <span className="text-sm font-medium text-muted-foreground w-24">Drehtag:</span>
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
            <Button variant="outline" size="sm" disabled>
              <Download className="mr-2 h-4 w-4" />
              PDF exportieren
            </Button>
          </div>

          {!selectedDayId && (
            <p className="text-muted-foreground">Bitte einen Drehtag auswählen.</p>
          )}

          {selectedDayId && loadingList && (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          )}

          {selectedDayId && !loadingList && (
            <>
              {/* Summary chips */}
              {Object.keys(dietarySummary).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(dietarySummary).map(([diet, count]) => (
                    <Badge
                      key={diet}
                      variant={(DIETARY_COLORS[diet] as any) ?? 'secondary'}
                    >
                      {count}× {diet}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Table */}
              {(cateringList ?? []).length === 0 ? (
                <p className="text-muted-foreground">Keine Personen für diesen Drehtag.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-left">
                        <th className="px-3 py-2 font-semibold">Name</th>
                        <th className="px-3 py-2 font-semibold">Typ</th>
                        <th className="px-3 py-2 font-semibold">Diät</th>
                        <th className="px-3 py-2 font-semibold">Allergien</th>
                        <th className="px-3 py-2 font-semibold">Notizen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(cateringList ?? []).map((e, i) => (
                        <tr key={`${e.person_type}-${e.person_id}`} className={`border-b border-border ${i % 2 === 0 ? '' : 'bg-muted/20'}`}>
                          <td className="px-3 py-2 font-medium">{e.name}</td>
                          <td className="px-3 py-2">
                            <Badge variant={e.person_type === 'cast' ? 'purple' : 'blue'} className="text-[10px]">
                              {e.person_type === 'cast' ? 'Darsteller' : 'Crew'}
                            </Badge>
                          </td>
                          <td className="px-3 py-2">
                            {e.dietary && e.dietary !== 'keine' ? (
                              <Badge variant={(DIETARY_COLORS[e.dietary] as any) ?? 'secondary'}>
                                {e.dietary}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">–</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{e.allergies || '–'}</td>
                          <td className="px-3 py-2 text-muted-foreground">{e.notes || '–'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
