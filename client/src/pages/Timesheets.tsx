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
import { useDownload } from '@/lib/useDownload'
import { api } from '@/lib/api'
import { Plus, Download, AlertTriangle, Clock, Users, FileText, CalendarDays } from 'lucide-react'
import { parseISO, addDays, format } from 'date-fns'
import { useSchreibrecht } from '@/lib/useSchreibrecht'

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
  call_time: number | null
  wrap_time: number | null
  meal_penalty: boolean
  notes: string
  overtime_hours: number | null
}

interface Person {
  id: number
  // Stab hat `name`, Besetzung `actor_name` - vorher stand jede Darstellerin
  // als leerer Eintrag in der Auswahl (gemessen am 01.11.2026)
  name?: string
  actor_name?: string
  person_type: 'cast' | 'crew'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function minutesToHHMM(minutes: number | null | undefined): string {
  if (minutes == null) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * "8", "830", "8:30", "08:30" → Minuten. Leer → null (Zeit bewusst gelöscht).
 * Unlesbar → undefined. Vorher wurde Unlesbares zu null und gespeichert -
 * gemessen am 01.11.2026: "8" getippt, der Call 14:00 auf dem Server gelöscht,
 * im Feld stand weiter "8".
 */
function parseHHMM(val: string): number | null | undefined {
  const trimmed = val.trim()
  if (!trimmed) return null
  const match = trimmed.match(/^(\d{1,2})(?::?(\d{2}))?$/)
  if (!match) return undefined
  const h = parseInt(match[1]), m = match[2] ? parseInt(match[2]) : 0
  if (h > 23 || m > 59) return undefined
  return h * 60 + m
}

/** Ruhezeit wie `ruhezeit()` im Server (lib/drehzeit.ts): Wrap vor dem Call heißt nach Mitternacht. */
function ruhezeit(wrap: number, callHeute: number | null, callMorgen: number): number {
  if (callHeute != null && wrap < callHeute) return Math.max(0, callMorgen - wrap)
  return 1440 - wrap + callMorgen
}

function calcOvertime(callMin: number | null, wrapMin: number | null): number {
  if (callMin == null || wrapMin == null) return 0
  const worked = wrapMin > callMin ? wrapMin - callMin : wrapMin + 1440 - callMin
  const standard = 10 * 60 // 10h standard day
  return Math.max(0, worked - standard)
}

function formatDate(iso: string) {
  if (!iso) return ''
  return parseISO(iso).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

function totalMinutesToH(mins: number) {
  return (mins / 60).toFixed(1) + 'h'
}

// ─── Timesheet row ────────────────────────────────────────────────────────────

function TimesheetRow({ ts, dayId, darf }: { ts: Timesheet; dayId: number; darf: boolean }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [callVal, setCallVal] = useState(minutesToHHMM(ts.call_time))
  const [wrapVal, setWrapVal] = useState(minutesToHHMM(ts.wrap_time))
  const [mealPenalty, setMealPenalty] = useState(ts.meal_penalty)
  const [notes, setNotes] = useState(ts.notes ?? '')

  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Timesheet>) => {
      const res = await fetch(`/api/timesheets/${ts.id}`, {
        method: 'PUT',
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
  const overtime = calcOvertime(callMin ?? null, wrapMin ?? null)

  // Unlesbare Zeit: nicht speichern, gespeicherten Wert zurück ins Feld
  const zeitSpeichern = (feld: 'call_time' | 'wrap_time', wert: number | null | undefined, setze: (v: string) => void) => {
    if (wert === undefined) {
      toast({ variant: 'destructive', title: 'Uhrzeit nicht erkannt', description: 'Bitte als HH:MM eingeben, z. B. 08:30.' })
      setze(minutesToHHMM(ts[feld]))
      return
    }
    setze(minutesToHHMM(wert))
    if (wert !== ts[feld]) updateMutation.mutate({ [feld]: wert })
  }
  const saveCall = () => zeitSpeichern('call_time', callMin, setCallVal)
  const saveWrap = () => zeitSpeichern('wrap_time', wrapMin, setWrapVal)
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
          disabled={!darf}
          aria-label={`Call ${ts.person_name}`}
          placeholder="08:00"
          className="h-8 text-xs font-mono w-full bg-muted/30 border-border/40 focus:bg-background"
        />
      </td>
      <td className="px-4 py-3 w-28">
        <Input
          value={wrapVal}
          onChange={e => setWrapVal(e.target.value)}
          onBlur={saveWrap}
          disabled={!darf}
          aria-label={`Wrap ${ts.person_name}`}
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
          <span className="text-muted-foreground/40 text-sm">-</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <Checkbox
          checked={!!mealPenalty}
          onCheckedChange={v => saveMeal(Boolean(v))}
          disabled={!darf}
          aria-label={`Mahlzeit-Penalty ${ts.person_name}`}
          className="data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
        />
      </td>
      <td className="px-4 py-3 min-w-[160px]">
        <Input
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onBlur={saveNotes}
          disabled={!darf}
          aria-label={`Notizen ${ts.person_name}`}
          placeholder="Notizen…"
          className="h-8 text-xs w-full bg-muted/30 border-border/40 focus:bg-background"
        />
      </td>
      <td className="px-4 py-3">
        {/* Timesheets gehen nicht über den Papierkorb - endgültig, deshalb die Rückfrage */}
        {darf && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive/60 hover:text-destructive hover:bg-destructive/10 text-xs active:scale-[0.97]"
            onClick={() => window.confirm(`Eintrag von ${ts.person_name} löschen? Das lässt sich nicht rückgängig machen.`) && deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            aria-label={`Eintrag von ${ts.person_name} löschen`}
          >
            Löschen
          </Button>
        )}
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

  const callMin = parseHHMM(callVal)
  const wrapMin = parseHHMM(wrapVal)
  const zeitFalsch = callMin === undefined || wrapMin === undefined

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/shoot-days/${dayId}/timesheets`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          person_id: Number(personId),
          person_type: personType,
          call_time: callMin,
          wrap_time: wrapMin,
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
              <SelectTrigger aria-label="Typ">
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
              <SelectTrigger aria-label="Person">
                <SelectValue placeholder="Person auswählen…" />
              </SelectTrigger>
              <SelectContent>
                {persons.map(p => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name ?? p.actor_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Call (HH:MM)</label>
              <Input value={callVal} onChange={e => setCallVal(e.target.value)} placeholder="08:00" aria-label="Call" aria-invalid={callMin === undefined} className="font-mono" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Wrap (HH:MM)</label>
              <Input value={wrapVal} onChange={e => setWrapVal(e.target.value)} placeholder="18:00" aria-label="Wrap" aria-invalid={wrapMin === undefined} className="font-mono" />
            </div>
          </div>
          {zeitFalsch && <p className="text-xs text-destructive">Uhrzeit bitte als HH:MM eingeben, z. B. 08:30.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="active:scale-[0.97]">Abbrechen</Button>
          <Button onClick={() => createMutation.mutate()} disabled={!personId || zeitFalsch || createMutation.isPending} className="active:scale-[0.97]">
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
  const download = useDownload()
  const { darfSchreiben } = useSchreibrecht()
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
  const selectedDay = (shootDays ?? []).find(d => d.id === selectedDayId)

  // Ruhezeit aus den Stammdaten (Turnaround-Mindestzeit), wie im Konfliktradar
  const { data: projekt } = useQuery({ queryKey: ['project', pid], queryFn: () => api.projects.get(pid) })
  const mindestRuhe = ((projekt as any)?.settings?.turnaround_hours ?? 11) * 60
  // Der Drehtag am folgenden Kalendertag, falls es einen gibt
  const folgetag = selectedDay?.date
    ? (shootDays ?? []).find(d => d.date === format(addDays(parseISO(selectedDay.date), 1), 'yyyy-MM-dd'))
    : undefined
  const { data: folgeSheets } = useQuery<Timesheet[]>({
    queryKey: ['timesheets', folgetag?.id ?? null],
    queryFn: async () => {
      const res = await fetch(`/api/shoot-days/${folgetag!.id}/timesheets`, { headers })
      if (!res.ok) throw new Error('Fehler')
      return (await res.json()).data
    },
    enabled: !!folgetag,
  })

  // Summary stats
  const totalOvertimeMins = sheets.reduce((sum, ts) => {
    return sum + calcOvertime(ts.call_time, ts.wrap_time)
  }, 0)
  const countWithOT = sheets.filter(ts => calcOvertime(ts.call_time, ts.wrap_time) > 0).length

  /**
   * Ruhezeit je Person. Vorher: "Wrap ab 22:00" als Faustregel - ein Wrap nach
   * Mitternacht (01:00 steht als 60) fiel nie darunter, gemessen am 01.11.2026:
   * Wrap 22:30 wurde gemeldet, Wrap 01:00 nicht. Jetzt mit dem echten Call am
   * Folgetag, sonst der früheste erlaubte Call.
   */
  const ruheWarnungen = sheets.flatMap(ts => {
    if (ts.wrap_time == null) return []
    const morgen = (folgeSheets ?? []).find(f => f.person_type === ts.person_type && f.person_id === ts.person_id && f.call_time != null)
    if (morgen) {
      const ruhe = ruhezeit(ts.wrap_time, ts.call_time, morgen.call_time!)
      return ruhe < mindestRuhe
        ? [`${ts.person_name}: ${(ruhe / 60).toFixed(1).replace('.', ',')} h zwischen Wrap ${minutesToHHMM(ts.wrap_time)} und Call ${minutesToHHMM(morgen.call_time)} am Folgetag`]
        : []
    }
    // Ohne Call am Folgetag: spät heißt, die Ruhezeit reicht in den Vormittag
    const nachMitternacht = ts.call_time != null && ts.wrap_time < ts.call_time
    const fruehesterCall = (ts.wrap_time + mindestRuhe) % 1440
    return nachMitternacht || ts.wrap_time >= 22 * 60
      ? [`${ts.person_name}: Wrap ${minutesToHHMM(ts.wrap_time)}, frühester Call am Folgetag ${minutesToHHMM(fruehesterCall)}`]
      : []
  })

  return (
    <div className="px-5 py-6 sm:p-7 max-w-6xl mx-auto animate-fade-up">
      {/* Page hero */}
      <div className="mb-8 pb-7 border-b border-border/40 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] sm:text-[34px]">Timesheets</h1>
          <p className="text-sm text-muted-foreground/60 mt-1.5">Call- & Wrap-Zeiten, Überstunden und Mahlzeit-Penalties</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0 justify-end">
          {/* Über useDownload mit Token: der frühere direkte Link lief ohne
              Anmeldung und endete immer mit 401 */}
          <Button
            variant="outline"
            size="sm"
            className="active:scale-[0.97]"
            onClick={() => download(`/api/projects/${pid}/timesheets/export.csv`, 'timesheets.csv')}
          >
            <Download className="mr-2 h-4 w-4" />
            CSV exportieren
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="active:scale-[0.97]"
            title="Drehtage laut Dispo × Tagesgage, plus Überstunden - für die Lohnbuchhaltung"
            onClick={() => download(api.payroll.export(pid), 'lohnexport.csv')}
          >
            <FileText className="mr-2 h-4 w-4" />
            Lohnexport
          </Button>
        </div>
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
              <SelectTrigger className="w-full sm:w-72 bg-muted/30 border-border/40" aria-label="Drehtag">
                <SelectValue placeholder="Drehtag auswählen…" />
              </SelectTrigger>
              <SelectContent>
                {(shootDays ?? []).map(d => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    DT {d.day_number} - {formatDate(d.date)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedDayId && darfSchreiben && (
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
          {ruheWarnungen.length > 0 && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
              <div className="text-sm pt-0.5">
                <span className="font-semibold text-red-600 dark:text-red-400">Turnaround-Warnung (Minimum {mindestRuhe / 60} h):</span>
                <ul className="text-muted-foreground mt-1 space-y-0.5">
                  {ruheWarnungen.map(w => <li key={w}>{w}</li>)}
                </ul>
              </div>
            </div>
          )}

          {/* Table */}
          {sheets.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground/40">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Keine Timesheets für diesen Drehtag</p>
              {darfSchreiben && (
                <Button size="sm" className="mt-4 active:scale-[0.97]" onClick={() => setShowAdd(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Ersten Eintrag hinzufügen
                </Button>
              )}
            </div>
          ) : (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40 mb-3">
                Einträge{selectedDay ? ` - DT ${selectedDay.day_number} · ${formatDate(selectedDay.date)}` : ''}
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
                        <TimesheetRow key={ts.id} ts={ts} dayId={selectedDayId} darf={darfSchreiben} />
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
