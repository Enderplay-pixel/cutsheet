import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Download, AlertTriangle, Clock, Users, FileText, CalendarDays } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ShootDay {
  id: number
  day_number: number
  date: string
}

interface Timesheet {
  id: number
  person_id: number
  person_name: string
  person_type: 'cast' | 'crew'
  call_minutes: number | null
  wrap_minutes: number | null
  meal_penalty: boolean
  notes: string
  overtime_minutes: number | null
}

interface Person {
  id: number
  name: string
  person_type: 'cast' | 'crew'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function minutesToHHMM(minutes: number | null | undefined): string {
  if (minutes == null) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function parseHHMM(val: string): number | null {
  const trimmed = val.trim()
  if (!trimmed) return null
  const match = trimmed.match(/^(\d{1,2}):?(\d{2})$/)
  if (!match) return null
  return parseInt(match[1]) * 60 + parseInt(match[2])
}

function calcOvertime(callMin: number | null, wrapMin: number | null): number {
  if (callMin == null || wrapMin == null) return 0
  const worked = wrapMin > callMin ? wrapMin - callMin : wrapMin + 1440 - callMin
  const standard = 10 * 60 // 10h standard day
  return Math.max(0, worked - standard)
}

function formatDate(iso: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

function totalMinutesToH(mins: number) {
  return (mins / 60).toFixed(1) + 'h'
}

// ─── Timesheet row ────────────────────────────────────────────────────────────

function TimesheetRow({ ts, dayId }: { ts: Timesheet; dayId: number }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [callVal, setCallVal] = useState(minutesToHHMM(ts.call_minutes))
  const [wrapVal, setWrapVal] = useState(minutesToHHMM(ts.wrap_minutes))
  const [mealPenalty, setMealPenalty] = useState(ts.meal_penalty)
  const [notes, setNotes] = useState(ts.notes ?? '')

  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Timesheet>) => {
      const res = await fetch(`/api/timesheets/${ts.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Fehler')
      return (await res.json()).data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['timesheets', dayId] }),
    onError: () => toast({ variant: 'destructive', title: 'Fehler beim Speichern' }),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/timesheets/${ts.id}`, { method: 'DELETE', headers })
      if (!res.ok) throw new Error('Fehler')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets', dayId] })
      toast({ title: 'Eintrag gelöscht' })
    },
    onError: () => toast({ variant: 'destructive', title: 'Fehler beim Löschen' }),
  })

  const callMin = parseHHMM(callVal)
  const wrapMin = parseHHMM(wrapVal)
  const overtime = calcOvertime(callMin, wrapMin)

  const saveCall = () => updateMutation.mutate({ call_minutes: callMin })
  const saveWrap = () => updateMutation.mutate({ wrap_minutes: wrapMin })
  const saveNotes = () => updateMutation.mutate({ notes })
  const saveMeal = (val: boolean) => {
    setMealPenalty(val)
    updateMutation.mutate({ meal_penalty: val })
  }

  return (
    <tr className="border-b border-border/30 hover:bg-muted/20 transition-colors">
      <td className="px-4 py-3 font-medium text-sm">{ts.person_name}</td>
      <td className="px-4 py-3">
        <Badge variant={ts.person_type === 'cast' ? 'purple' : 'blue'} className="text-[10px] font-semibold uppercase tracking-wide">
          {ts.person_type === 'cast' ? 'Darsteller' : 'Crew'}
        </Badge>
      </td>
      <td className="px-4 py-3 w-28">
        <Input
          value={callVal}
          onChange={e => setCallVal(e.target.value)}
          onBlur={saveCall}
          placeholder="08:00"
          className="h-8 text-xs font-mono w-full bg-muted/30 border-border/40 focus:bg-background"
        />
      </td>
      <td className="px-4 py-3 w-28">
        <Input
          value={wrapVal}
          onChange={e => setWrapVal(e.target.value)}
          onBlur={saveWrap}
          placeholder="18:00"
          className="h-8 text-xs font-mono w-full bg-muted/30 border-border/40 focus:bg-background"
        />
      </td>
      <td className="px-4 py-3 text-center">
        {overtime > 0 ? (
          <span className="inline-flex items-center gap-1 text-red-500 font-bold text-sm tabular-nums">
            <Clock className="w-3 h-3" />
            {totalMinutesToH(overtime)}
          </span>
        ) : (
          <span className="text-muted-foreground/40 text-sm">–</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <Checkbox
          checked={mealPenalty}
          onCheckedChange={v => saveMeal(Boolean(v))}
          className="data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
        />
      </td>
      <td className="px-4 py-3 min-w-[160px]">
        <Input
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onBlur={saveNotes}
          placeholder="Notizen…"
          className="h-8 text-xs w-full bg-muted/30 border-border/40 focus:bg-background"
        />
      </td>
      <td className="px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive/60 hover:text-destructive hover:bg-destructive/10 text-xs active:scale-[0.97]"
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
        >
          Löschen
        </Button>
      </td>
    </tr>
  )
}

// ─── Add dialog ───────────────────────────────────────────────────────────────

function AddTimesheetDialog({
  open,
  onClose,
  dayId,
  pid,
}: {
  open: boolean
  onClose: () => void
  dayId: number
  pid: number
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [personId, setPersonId] = useState('')
  const [personType, setPersonType] = useState<'cast' | 'crew'>('crew')
  const [callVal, setCallVal] = useState('')
  const [wrapVal, setWrapVal] = useState('')

  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const { data: cast } = useQuery<Person[]>({
    queryKey: ['cast', pid],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${pid}/cast`, { headers })
      if (!res.ok) throw new Error('Fehler')
      return (await res.json()).data
    },
  })

  const { data: crew } = useQuery<Person[]>({
    queryKey: ['crew', pid],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${pid}/crew`, { headers })
      if (!res.ok) throw new Error('Fehler')
      return (await res.json()).data
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/shoot-days/${dayId}/timesheets`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          person_id: Number(personId),
          person_type: personType,
          call_minutes: parseHHMM(callVal),
          wrap_minutes: parseHHMM(wrapVal),
        }),
      })
      if (!res.ok) throw new Error('Fehler')
      return (await res.json()).data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets', dayId] })
      toast({ title: 'Eintrag erstellt' })
      onClose()
    },
    onError: () => toast({ variant: 'destructive', title: 'Fehler beim Erstellen' }),
  })

  const persons = personType === 'cast' ? (cast ?? []) : (crew ?? [])

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Timesheet hinzufügen</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Typ</label>
            <Select value={personType} onValueChange={v => { setPersonType(v as 'cast' | 'crew'); setPersonId('') }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cast">Darsteller</SelectItem>
                <SelectItem value="crew">Crew</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Person</label>
            <Select value={personId} onValueChange={setPersonId}>
              <SelectTrigger>
                <SelectValue placeholder="Person auswählen…" />
              </SelectTrigger>
              <SelectContent>
                {persons.map(p => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Call (HH:MM)</label>
              <Input value={callVal} onChange={e => setCallVal(e.target.value)} placeholder="08:00" className="font-mono" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Wrap (HH:MM)</label>
              <Input value={wrapVal} onChange={e => setWrapVal(e.target.value)} placeholder="18:00" className="font-mono" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="active:scale-[0.97]">Abbrechen</Button>
          <Button onClick={() => createMutation.mutate()} disabled={!personId || createMutation.isPending} className="active:scale-[0.97]">
            Erstellen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function Component() {
  const { projectId: id } = useParams<{ projectId: string }>()
  const pid = Number(id)
  const [selectedDayId, setSelectedDayId] = useState<number | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const { data: shootDays } = useQuery<ShootDay[]>({
    queryKey: ['shoot-days', pid],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${pid}/shoot-days`, { headers })
      if (!res.ok) throw new Error('Fehler')
      return (await res.json()).data
    },
  })

  const { data: timesheets, isLoading } = useQuery<Timesheet[]>({
    queryKey: ['timesheets', selectedDayId],
    queryFn: async () => {
      if (!selectedDayId) return []
      const res = await fetch(`/api/shoot-days/${selectedDayId}/timesheets`, { headers })
      if (!res.ok) throw new Error('Fehler')
      return (await res.json()).data
    },
    enabled: !!selectedDayId,
  })

  const sheets = timesheets ?? []

  // Summary stats
  const totalOvertimeMins = sheets.reduce((sum, ts) => {
    return sum + calcOvertime(ts.call_minutes, ts.wrap_minutes)
  }, 0)
  const countWithOT = sheets.filter(ts => calcOvertime(ts.call_minutes, ts.wrap_minutes) > 0).length

  // Turnaround warnings: wrap + 11h > next day's call
  // We detect within the same day's sheet if any wrap is very late (>= 21:00 = 1260min) as a heuristic
  const turnaroundWarnings = sheets.filter(ts => {
    if (ts.wrap_minutes == null) return false
    return ts.wrap_minutes >= 22 * 60 // wrap after 22:00 → potential turnaround issue
  })

  const selectedDay = (shootDays ?? []).find(d => d.id === selectedDayId)

  return (
    <div className="px-5 py-6 sm:p-7 max-w-6xl mx-auto animate-fade-up">
      {/* Page hero */}
      <div className="mb-8 pb-7 border-b border-border/40 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] sm:text-[34px]">Timesheets</h1>
          <p className="text-sm text-muted-foreground/60 mt-1.5">Call- & Wrap-Zeiten, Überstunden und Mahlzeit-Penalties</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 active:scale-[0.97]"
          onClick={() => window.location.href = `/api/projects/${pid}/timesheets/export.csv`}
        >
          <Download className="mr-2 h-4 w-4" />
          CSV exportieren
        </Button>
      </div>

      {/* Day selector card */}
      <div className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40 mb-3">Drehtag auswählen</p>
        <div className="rounded-xl border border-border/60 bg-card p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
            <CalendarDays className="w-4 h-4 text-muted-foreground/70" />
          </div>
          <div className="flex-1 min-w-0">
            <Select
              value={selectedDayId ? String(selectedDayId) : ''}
              onValueChange={v => setSelectedDayId(Number(v))}
            >
              <SelectTrigger className="w-full sm:w-72 bg-muted/30 border-border/40">
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
          </div>
          {selectedDayId && (
            <Button size="sm" onClick={() => setShowAdd(true)} className="active:scale-[0.97]">
              <Plus className="mr-2 h-4 w-4" />
              Eintrag hinzufügen
            </Button>
          )}
        </div>
      </div>

      {!selectedDayId && (
        <div className="text-center py-20 text-muted-foreground/40">
          <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Bitte einen Drehtag auswählen</p>
        </div>
      )}

      {selectedDayId && isLoading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
        </div>
      )}

      {selectedDayId && !isLoading && (
        <div className="space-y-6">
          {/* Stat cards */}
          {sheets.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40 mb-3">Übersicht</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-border/60 bg-card p-5 card-lift group">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-red-500" />
                    </div>
                  </div>
                  <div className="text-[2.25rem] font-bold tabular-nums text-red-500 leading-none mb-1">
                    {totalMinutesToH(totalOvertimeMins)}
                  </div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
                    Gesamt Überstunden
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-card p-5 card-lift group">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center">
                      <Users className="w-4 h-4 text-muted-foreground/70" />
                    </div>
                  </div>
                  <div className="text-[2.25rem] font-bold tabular-nums leading-none mb-1">
                    {countWithOT}
                  </div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
                    Personen mit Überstunden
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-card p-5 card-lift group">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-muted-foreground/70" />
                    </div>
                  </div>
                  <div className="text-[2.25rem] font-bold tabular-nums leading-none mb-1">
                    {sheets.length}
                  </div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
                    Einträge gesamt
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Turnaround warnings */}
          {turnaroundWarnings.length > 0 && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
              <div className="text-sm pt-0.5">
                <span className="font-semibold text-red-600 dark:text-red-400">Turnaround-Warnung:</span>{' '}
                <span className="text-muted-foreground">
                  {turnaroundWarnings.map(w => w.person_name).join(', ')} — spätes Wrap, bitte 11h Ruhezeit prüfen.
                </span>
              </div>
            </div>
          )}

          {/* Table */}
          {sheets.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground/40">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Keine Timesheets für diesen Drehtag</p>
              <Button size="sm" className="mt-4 active:scale-[0.97]" onClick={() => setShowAdd(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Ersten Eintrag hinzufügen
              </Button>
            </div>
          ) : (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40 mb-3">
                Einträge{selectedDay ? ` — DT ${selectedDay.day_number} · ${formatDate(selectedDay.date)}` : ''}
              </p>
              <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border/40">
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Name</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Typ</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Call</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Wrap</th>
                        <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Überstunden</th>
                        <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Mahlzeit-Penalty</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Notizen</th>
                        <th className="px-4 py-3 w-20" />
                      </tr>
                    </thead>
                    <tbody>
                      {sheets.map(ts => (
                        <TimesheetRow key={ts.id} ts={ts} dayId={selectedDayId} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {showAdd && selectedDayId && (
        <AddTimesheetDialog
          open={showAdd}
          onClose={() => setShowAdd(false)}
          dayId={selectedDayId}
          pid={pid}
        />
      )}
    </div>
  )
}
