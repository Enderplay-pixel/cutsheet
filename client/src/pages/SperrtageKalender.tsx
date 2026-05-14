import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, Plus, Trash2, CalendarOff } from 'lucide-react'

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

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function parseDate(s: string): Date {
  return new Date(s + 'T00:00:00')
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function buildWeeks(start: Date, end: Date): Date[] {
  const days: Date[] = []
  let cur = new Date(start)
  // align to Monday
  const dow = cur.getDay()
  const offset = dow === 0 ? -6 : 1 - dow
  cur = addDays(cur, offset)
  while (cur <= end) {
    days.push(new Date(cur))
    cur = addDays(cur, 7)
  }
  return days
}

function isInRange(d: Date, start: string, end: string): boolean {
  const s = parseDate(start)
  const e = parseDate(end)
  return d >= s && d <= e
}

function blockedInWeek(weekStart: Date, boStart: string, boEnd: string): boolean {
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i)
    if (isInRange(d, boStart, boEnd)) return true
  }
  return false
}

export function Component() {
  const { id } = useParams<{ id: string }>()
  const pid = Number(id)
  const queryClient = useQueryClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ cast_id: '', start_date: '', end_date: '', reason: '' })

  const { data: cast, isLoading: castLoading } = useQuery({
    queryKey: ['cast', pid],
    queryFn: () => req<any[]>(`/projects/${pid}/cast`),
  })

  const { data: blackouts, isLoading: blackoutsLoading } = useQuery({
    queryKey: ['blackout-dates', pid],
    queryFn: () => req<any[]>(`/projects/${pid}/blackout-dates`),
  })

  const { data: conflicts } = useQuery({
    queryKey: ['blackout-conflicts', pid],
    queryFn: () => req<any[]>(`/projects/${pid}/blackout-dates/conflicts`),
  })

  const { data: shootDays } = useQuery({
    queryKey: ['shoot-days', pid],
    queryFn: () => req<any[]>(`/projects/${pid}/shoot-days`),
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => req<any>(`/projects/${pid}/blackout-dates`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blackout-dates', pid] })
      queryClient.invalidateQueries({ queryKey: ['blackout-conflicts', pid] })
      setDialogOpen(false)
      setForm({ cast_id: '', start_date: '', end_date: '', reason: '' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => req<any>(`/blackout-dates/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blackout-dates', pid] })
      queryClient.invalidateQueries({ queryKey: ['blackout-conflicts', pid] })
    },
  })

  // Compute timeline range
  const allDates: Date[] = []
  ;(shootDays || []).forEach((d: any) => { if (d.date) allDates.push(parseDate(d.date)) })
  ;(blackouts || []).forEach((b: any) => {
    if (b.start_date) allDates.push(parseDate(b.start_date))
    if (b.end_date) allDates.push(parseDate(b.end_date))
  })
  const timelineStart = allDates.length ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date()
  const timelineEnd = allDates.length ? new Date(Math.max(...allDates.map(d => d.getTime()))) : addDays(new Date(), 30)
  const weeks = buildWeeks(timelineStart, timelineEnd)

  const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

  const isLoading = castLoading || blackoutsLoading

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Sperrtage-Kalender</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Nicht-Verfügbarkeiten der Darsteller</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Sperrtag hinzufügen
        </Button>
      </div>

      {/* Conflicts panel */}
      {conflicts && conflicts.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
            <AlertTriangle className="w-4 h-4" />
            {conflicts.length} Konflikt{conflicts.length !== 1 ? 'e' : ''} gefunden
          </div>
          {conflicts.map((c: any, i: number) => (
            <div key={i} className="text-xs text-destructive/80 pl-6">
              {c.cast_name || c.actor_name}: Drehtag {c.shoot_date} kollidiert mit Sperrtag ({c.start_date} – {c.end_date})
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left p-3 font-medium w-40 min-w-[160px]">Darsteller</th>
                {weeks.map((w, i) => (
                  <th key={i} className="p-1 text-center font-normal text-muted-foreground min-w-[52px]">
                    <div className="text-[10px] leading-none">{MONTH_NAMES[w.getMonth()]}</div>
                    <div className="font-semibold">{w.getDate()}.–{addDays(w, 6).getDate()}.</div>
                  </th>
                ))}
                <th className="p-3 w-20">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {(cast || []).length === 0 && (
                <tr>
                  <td colSpan={weeks.length + 2} className="text-center py-12 text-muted-foreground">
                    <CalendarOff className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    Keine Darsteller vorhanden
                  </td>
                </tr>
              )}
              {(cast || []).map((member: any) => {
                const memberBlackouts = (blackouts || []).filter((b: any) => b.cast_id === member.id)
                return (
                  <tr key={member.id} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="p-3 font-medium">
                      <div>{member.actor_name || member.name}</div>
                      {memberBlackouts.length > 0 && (
                        <Badge variant="secondary" className="mt-0.5 text-[10px] h-4">
                          {memberBlackouts.length} Sperrtag{memberBlackouts.length !== 1 ? 'e' : ''}
                        </Badge>
                      )}
                    </td>
                    {weeks.map((w, wi) => {
                      const isBlocked = memberBlackouts.some((b: any) => blockedInWeek(w, b.start_date, b.end_date))
                      const isShootDay = (shootDays || []).some((sd: any) => {
                        if (!sd.date) return false
                        const sdDate = parseDate(sd.date)
                        return sdDate >= w && sdDate <= addDays(w, 6)
                      })
                      return (
                        <td key={wi} className="p-1 text-center">
                          <div className={`h-7 rounded mx-0.5 ${
                            isBlocked
                              ? 'bg-destructive/70 border border-destructive/80'
                              : isShootDay
                              ? 'bg-primary/15 border border-primary/25'
                              : 'bg-muted/20'
                          }`} title={isBlocked ? 'Gesperrt' : isShootDay ? 'Drehtag' : ''} />
                        </td>
                      )
                    })}
                    <td className="p-2">
                      {memberBlackouts.map((b: any) => (
                        <button
                          key={b.id}
                          onClick={() => deleteMutation.mutate(b.id)}
                          className="block w-full text-left text-[10px] text-muted-foreground hover:text-destructive mb-1 truncate"
                          title={`${b.start_date} – ${b.end_date}${b.reason ? ': ' + b.reason : ''}`}
                        >
                          <Trash2 className="w-3 h-3 inline mr-1" />
                          {b.start_date}
                        </button>
                      ))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Legend */}
          <div className="flex items-center gap-4 p-3 border-t border-border/40 bg-muted/20 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded bg-destructive/70" /> Sperrtag
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded bg-primary/15 border border-primary/25" /> Drehtag
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded bg-muted/20" /> Frei
            </div>
          </div>
        </div>
      )}

      {/* Blackout list */}
      {(blackouts || []).length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <h2 className="font-semibold text-sm">Alle Sperrtage</h2>
          </div>
          <div className="divide-y divide-border/40">
            {(blackouts || []).map((b: any) => {
              const castMember = (cast || []).find((c: any) => c.id === b.cast_id)
              return (
                <div key={b.id} className="flex items-center gap-3 p-3 hover:bg-muted/20">
                  <CalendarOff className="w-4 h-4 text-destructive/60 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{castMember?.actor_name || castMember?.name || `Darsteller #${b.cast_id}`}</div>
                    <div className="text-xs text-muted-foreground">
                      {b.start_date} – {b.end_date}
                      {b.reason && <span className="ml-2">· {b.reason}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(b.id)}
                    className="w-7 h-7 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sperrtag hinzufügen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-sm">Darsteller</Label>
              <Select value={form.cast_id} onValueChange={v => setForm(f => ({ ...f, cast_id: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Darsteller wählen" />
                </SelectTrigger>
                <SelectContent>
                  {(cast || []).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.actor_name || c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Von</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Bis</Label>
                <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-sm">Grund (optional)</Label>
              <Textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={2} className="mt-1 resize-none" placeholder="z.B. anderes Projekt, Urlaub..." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
              <Button
                onClick={() => addMutation.mutate({ cast_id: Number(form.cast_id), start_date: form.start_date, end_date: form.end_date, reason: form.reason })}
                disabled={!form.cast_id || !form.start_date || !form.end_date || addMutation.isPending}
              >
                Hinzufügen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
