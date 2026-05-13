import { useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Download, AlertTriangle, Clock } from 'lucide-react'

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
      return res.json()
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
    <tr className="border-b border-border hover:bg-muted/10">
      <td className="px-3 py-2 font-medium">{ts.person_name}</td>
      <td className="px-3 py-2">
        <Badge variant={ts.person_type === 'cast' ? 'purple' : 'blue'} className="text-[10px]">
          {ts.person_type === 'cast' ? 'Darsteller' : 'Crew'}
        </Badge>
      </td>
      <td className="px-3 py-2 w-28">
        <Input
          value={callVal}
          onChange={e => setCallVal(e.target.value)}
          onBlur={saveCall}
          placeholder="08:00"
          className="h-8 text-xs font-mono w-full"
        />
      </td>
      <td className="px-3 py-2 w-28">
        <Input
          value={wrapVal}
          onChange={e => setWrapVal(e.target.value)}
          onBlur={saveWrap}
          placeholder="18:00"
          className="h-8 text-xs font-mono w-full"
        />
      </td>
      <td className="px-3 py-2 text-center">
        {overtime > 0 ? (
          <span className="text-red-500 font-semibold text-sm">{totalMinutesToH(overtime)}</span>
        ) : (
          <span className="text-muted-foreground text-sm">–</span>
        )}
      </td>
      <td className="px-3 py-2 text-center">
        <Checkbox
          checked={mealPenalty}
          onCheckedChange={v => saveMeal(Boolean(v))}
        />
      </td>
      <td className="px-3 py-2 min-w-[160px]">
        <Input
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onBlur={saveNotes}
          placeholder="Notizen…"
          className="h-8 text-xs w-full"
        />
      </td>
      <td className="px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
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
      return res.json()
    },
  })

  const { data: crew } = useQuery<Person[]>({
    queryKey: ['crew', pid],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${pid}/crew`, { headers })
      if (!res.ok) throw new Error('Fehler')
      return res.json()
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
      return res.json()
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
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={() => createMutation.mutate()} disabled={!personId || createMutation.isPending}>
            Erstellen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Timesheets() {
  const { id } = useParams<{ id: string }>()
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
      return res.json()
    },
  })

  const { data: timesheets, isLoading } = useQuery<Timesheet[]>({
    queryKey: ['timesheets', selectedDayId],
    queryFn: async () => {
      if (!selectedDayId) return []
      const res = await fetch(`/api/shoot-days/${selectedDayId}/timesheets`, { headers })
      if (!res.ok) throw new Error('Fehler')
      return res.json()
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Timesheets</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.href = `/api/projects/${pid}/timesheets/export.csv`}
          >
            <Download className="mr-2 h-4 w-4" />
            CSV exportieren
          </Button>
        </div>
      </div>

      {/* Day selector */}
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
        {selectedDayId && (
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Eintrag hinzufügen
          </Button>
        )}
      </div>

      {!selectedDayId && (
        <p className="text-muted-foreground">Bitte einen Drehtag auswählen.</p>
      )}

      {selectedDayId && isLoading && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      )}

      {selectedDayId && !isLoading && (
        <>
          {/* Turnaround warnings */}
          {turnaroundWarnings.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <span className="font-semibold text-red-600 dark:text-red-400">Turnaround-Warnung:</span>{' '}
                {turnaroundWarnings.map(w => w.person_name).join(', ')} — spätes Wrap, bitte 11h Ruhezeit prüfen.
              </div>
            </div>
          )}

          {/* Table */}
          {sheets.length === 0 ? (
            <p className="text-muted-foreground">Keine Timesheets für diesen Drehtag.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="px-3 py-2 font-semibold">Name</th>
                    <th className="px-3 py-2 font-semibold">Typ</th>
                    <th className="px-3 py-2 font-semibold">Call</th>
                    <th className="px-3 py-2 font-semibold">Wrap</th>
                    <th className="px-3 py-2 font-semibold text-center">Überstunden</th>
                    <th className="px-3 py-2 font-semibold text-center">Mahlzeit-Penalty</th>
                    <th className="px-3 py-2 font-semibold">Notizen</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {sheets.map(ts => (
                    <TimesheetRow key={ts.id} ts={ts} dayId={selectedDayId} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Summary */}
          {sheets.length > 0 && (
            <div className="flex flex-wrap gap-4">
              <Card className="flex-1 min-w-[160px]">
                <CardContent className="py-4 px-5">
                  <div className="text-xs text-muted-foreground mb-1">Gesamt Überstunden</div>
                  <div className="text-2xl font-bold text-red-500">{totalMinutesToH(totalOvertimeMins)}</div>
                </CardContent>
              </Card>
              <Card className="flex-1 min-w-[160px]">
                <CardContent className="py-4 px-5">
                  <div className="text-xs text-muted-foreground mb-1">Personen mit Überstunden</div>
                  <div className="text-2xl font-bold">{countWithOT}</div>
                </CardContent>
              </Card>
              <Card className="flex-1 min-w-[160px]">
                <CardContent className="py-4 px-5">
                  <div className="text-xs text-muted-foreground mb-1">Einträge gesamt</div>
                  <div className="text-2xl font-bold">{sheets.length}</div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
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
