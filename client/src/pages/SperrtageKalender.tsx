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
import { AlertTriangle, Plus, Trash2, CalendarOff, Users } from 'lucide-react'

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

function buildWeeks(start: Date, end: Date): Date[] {
  const days: Date[] = []
  let cur = new Date(start)
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
  const { projectId: id } = useParams<{ projectId: string }>()
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
  const totalBlackouts = (blackouts || []).length
  const castCount = (cast || []).length

  return (
    <div className="p-7 max-w-6xl mx-auto animate-fade-up">
      {/* Page hero */}
      <div className="mb-8 pb-7 border-b border-border/40">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[1.85rem] font-bold tracking-tight leading-tight">Sperrtage-Kalender</h1>
            <p className="text-sm text-muted-foreground/60 mt-1.5">
              Nicht-Verfügbarkeiten der Darsteller
            </p>
          </div>
          <div className="flex items-center gap-3 pt-1 flex-wrap">
            <div className="flex items-center gap-5">
              <div className="text-right">
                <div className="text-[2.25rem] font-bold tabular-nums tracking-tight leading-none">{castCount}</div>
                <div className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40 mt-1">Darsteller</div>
              </div>
              <div className="text-right">
                <div className="text-[2.25rem] font-bold tabular-nums tracking-tight leading-none">{totalBlackouts}</div>
                <div className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40 mt-1">Sperrtage</div>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="active:scale-[0.97] ml-4"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Sperrtag hinzufügen
            </Button>
          </div>
        </div>
      </div>

      {/* Conflicts panel */}
      {conflicts && conflicts.length > 0 && (
        <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-2">
          <div className="flex items-center gap-2.5 text-destructive font-semibold text-sm">
            <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            {conflicts.length} Konflikt{conflicts.length !== 1 ? 'e' : ''} gefunden
          </div>
          {conflicts.map((c: any, i: number) => (
            <div key={i} className="text-xs text-destructive/70 pl-11">
              {c.cast_name || c.actor_name}: Drehtag {c.shoot_date} kollidiert mit Sperrtag ({c.start_date} – {c.end_date})
            </div>
          ))}
        </div>
      )}

      {/* Calendar grid */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card overflow-x-auto mb-6">
          <table className="w-full text-xs border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-border/40">
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground bg-muted/30 w-44 min-w-[176px] sticky left-0 z-10">
                  Darsteller
                </th>
                {weeks.map((w, i) => (
                  <th key={i} className="p-1.5 text-center text-muted-foreground min-w-[52px] bg-muted/30">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/50 leading-none mb-0.5">
                      {MONTH_NAMES[w.getMonth()]}
                    </div>
                    <div className="text-[11px] font-semibold tabular-nums">
                      {w.getDate()}.–{addDays(w, 6).getDate()}.
                    </div>
                  </th>
                ))}
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground bg-muted/30 w-24 text-center">
                  Aktionen
                </th>
              </tr>
            </thead>
            <tbody>
              {(cast || []).length === 0 && (
                <tr>
                  <td colSpan={weeks.length + 2} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <CalendarOff className="w-10 h-10 opacity-20" />
                      <p className="text-sm text-muted-foreground">Keine Darsteller vorhanden</p>
                    </div>
                  </td>
                </tr>
              )}
              {(cast || []).map((member: any, rowIdx: number) => {
                const memberBlackouts = (blackouts || []).filter((b: any) => b.cast_id === member.id)
                const name = member.actor_name || member.name
                const initials = name.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()
                return (
                  <tr
                    key={member.id}
                    className={`border-b border-border/30 transition-colors ${rowIdx % 2 === 1 ? 'bg-muted/10' : ''} hover:bg-muted/20`}
                  >
                    <td className="px-5 py-3 sticky left-0 z-10 bg-inherit border-r border-border/30">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center shrink-0 text-[11px] font-bold text-muted-foreground/70">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{name}</div>
                          {memberBlackouts.length > 0 && (
                            <div className="text-[10px] text-muted-foreground/50 mt-0.5">
                              {memberBlackouts.length} Sperrtag{memberBlackouts.length !== 1 ? 'e' : ''}
                            </div>
                          )}
                        </div>
                      </div>
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
                          <div
                            className={`h-7 rounded-lg mx-0.5 transition-colors ${
                              isBlocked
                                ? 'bg-destructive/60 border border-destructive/70'
                                : isShootDay
                                ? 'bg-primary/15 border border-primary/25'
                                : 'bg-transparent'
                            }`}
                            title={isBlocked ? 'Gesperrt' : isShootDay ? 'Drehtag' : ''}
                          />
                        </td>
                      )
                    })}
                    <td className="px-2 py-2">
                      <div className="flex flex-col gap-1">
                        {memberBlackouts.map((b: any) => (
                          <button
                            key={b.id}
                            onClick={() => deleteMutation.mutate(b.id)}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-destructive transition-colors active:scale-[0.97] group"
                            title={`${b.start_date} – ${b.end_date}${b.reason ? ': ' + b.reason : ''}`}
                          >
                            <div className="w-5 h-5 rounded-md flex items-center justify-center group-hover:bg-destructive/10 transition-colors">
                              <Trash2 className="w-3 h-3" />
                            </div>
                            <span className="truncate max-w-[56px] tabular-nums">{b.start_date}</span>
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Legend */}
          <div className="flex items-center gap-5 px-5 py-3 border-t border-border/30 bg-muted/20">
            <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40">Legende</p>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded bg-destructive/60 border border-destructive/70" />
              <span className="text-[11px] text-muted-foreground">Sperrtag</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded bg-primary/15 border border-primary/25" />
              <span className="text-[11px] text-muted-foreground">Drehtag</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded border border-border/30" />
              <span className="text-[11px] text-muted-foreground">Frei</span>
            </div>
          </div>
        </div>
      )}

      {/* Blackout list */}
      {(blackouts || []).length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40">
            <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40 mb-0.5">Übersicht</p>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Alle Sperrtage</h2>
              <span className="text-[11px] text-muted-foreground/50 tabular-nums">({(blackouts || []).length})</span>
            </div>
          </div>
          <div className="divide-y divide-border/30">
            {(blackouts || []).map((b: any) => {
              const castMember = (cast || []).find((c: any) => c.id === b.cast_id)
              const name = castMember?.actor_name || castMember?.name || `Darsteller #${b.cast_id}`
              const initials = name.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()
              return (
                <div key={b.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center shrink-0 text-[11px] font-bold text-muted-foreground/70">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{name}</div>
                    <div className="text-xs text-muted-foreground/60 mt-0.5 tabular-nums">
                      {b.start_date} – {b.end_date}
                      {b.reason && <span className="ml-2 not-italic">· {b.reason}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(b.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground/30 hover:text-destructive transition-colors active:scale-[0.97]"
                    title="Sperrtag löschen"
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
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center">
                <CalendarOff className="w-4 h-4 text-muted-foreground" />
              </div>
              <DialogTitle>Sperrtag hinzufügen</DialogTitle>
            </div>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-sm font-medium">Darsteller</Label>
              <Select value={form.cast_id} onValueChange={v => setForm(f => ({ ...f, cast_id: v }))}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Darsteller wählen" />
                </SelectTrigger>
                <SelectContent>
                  {(cast || []).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.actor_name || c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Von</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Bis</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                  className="mt-1.5"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">
                Grund <span className="text-muted-foreground/50 font-normal">(optional)</span>
              </Label>
              <Textarea
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                rows={2}
                className="mt-1.5 resize-none"
                placeholder="z.B. anderes Projekt, Urlaub..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="active:scale-[0.97]">
                Abbrechen
              </Button>
              <Button
                onClick={() => addMutation.mutate({
                  cast_id: Number(form.cast_id),
                  start_date: form.start_date,
                  end_date: form.end_date,
                  reason: form.reason,
                })}
                disabled={!form.cast_id || !form.start_date || !form.end_date || addMutation.isPending}
                className="active:scale-[0.97]"
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
