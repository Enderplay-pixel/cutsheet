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
import { AlertTriangle, Plus, Trash2, Package, CalendarDays } from 'lucide-react'
import { useT } from '@/lib/useT'
import { equipmentKalenderT as T, MONATE_KURZ } from '@/lib/texte/EquipmentKalender'
import { formatDate } from '@/lib/utils'
import { useSchreibrecht } from '@/lib/useSchreibrecht'

const API_BASE = '/api'
async function req<T>(path: string, options?: RequestInit): Promise<T> { // texte-ok
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}${path}`, { headers: { ...headers, ...options?.headers }, ...options })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Fehler')
  return json.data
}

/**
 * Deckender Hintergrund der festen Namensspalte im Farbton der Zeile - mit
 * `bg-inherit` auf durchsichtigen Zeilen schienen beim Scrollen die
 * Wochenzellen durch (wie Fund 205 im DOOD).
 */
const deckend = (tönung: number, rot = false) => ({
  background: rot
    ? 'linear-gradient(hsl(var(--destructive) / 0.05), hsl(var(--destructive) / 0.05)), hsl(var(--card))'
    : `linear-gradient(hsl(var(--muted) / ${tönung}), hsl(var(--muted) / ${tönung})), hsl(var(--card))`,
})

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

function blockedInWeek(weekStart: Date, boStart: string, boEnd: string): boolean {
  const s = parseDate(boStart)
  const e = parseDate(boEnd)
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i)
    if (d >= s && d <= e) return true
  }
  return false
}

export function Component() {
  const { projectId: id } = useParams<{ projectId: string }>()
  const pid = Number(id)
  const queryClient = useQueryClient()
  const tt = useT()
  const { darfSchreiben } = useSchreibrecht()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ equipment_item_id: '', start_date: '', end_date: '', notes: '' })

  const { data: equipmentLists, isLoading: listsLoading } = useQuery({
    queryKey: ['equipment-lists', pid],
    queryFn: () => req<any[]>(`/projects/${pid}/equipment-lists`), // texte-ok
  })

  const listIds = (equipmentLists || []).map((l: any) => l.id)
  const itemQueries = useQuery({
    queryKey: ['equipment-all-items', pid, listIds],
    queryFn: async () => {
      const results = await Promise.all(listIds.map((lid: number) => req<any[]>(`/equipment-lists/${lid}/items`))) // texte-ok
      return results.flat()
    },
    enabled: listIds.length > 0,
  })

  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ['equipment-bookings', pid],
    queryFn: () => req<any[]>(`/projects/${pid}/equipment-bookings`), // texte-ok
  })

  const { data: conflicts } = useQuery({
    queryKey: ['equipment-booking-conflicts', pid],
    queryFn: () => req<any[]>(`/projects/${pid}/equipment-bookings/conflicts`), // texte-ok
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => req<any>(`/projects/${pid}/equipment-bookings`, { method: 'POST', body: JSON.stringify(data) }), // texte-ok
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-bookings', pid] })
      queryClient.invalidateQueries({ queryKey: ['equipment-booking-conflicts', pid] })
      setDialogOpen(false)
      setForm({ equipment_item_id: '', start_date: '', end_date: '', notes: '' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => req<any>(`/equipment-bookings/${id}`, { method: 'DELETE' }), // texte-ok
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-bookings', pid] })
      queryClient.invalidateQueries({ queryKey: ['equipment-booking-conflicts', pid] })
    },
  })

  const allItems = itemQueries.data || []

  // Der Server meldet Paare { booking_a, booking_b } (routes/equipmentCalendar.ts).
  // Die Seite las sie wie einzelne Buchungen: "Equipment #undefined: Überlappung
  // undefined - undefined", und die rote Markierung erschien nie (gemessen am
  // 31.10.2026). Hier die Überlappung je Paar.
  const konflikte = (conflicts || []).map((c: any) => ({
    equipment_item_id: c.booking_a?.equipment_item_id,
    von: [c.booking_a?.start_date, c.booking_b?.start_date].sort().pop() as string,
    bis: [c.booking_a?.end_date, c.booking_b?.end_date].sort()[0] as string,
  }))

  // Eine Buchung gibt Equipment frei, das ein anderer womöglich schon
  // eingeplant hat - nicht auf einen Klick
  const loeschen = (b: any, name?: string) => {
    const frage = tt(T.loeschenFrage).replace('{name}', name || tt(T.equipmentNr).replace('{id}', String(b.equipment_item_id)))
      .replace('{von}', formatDate(b.start_date)).replace('{bis}', formatDate(b.end_date))
    if (confirm(frage)) deleteMutation.mutate(b.id)
  }
  const endeVorBeginn = !!form.start_date && !!form.end_date && form.end_date < form.start_date

  const allDates: Date[] = []
  ;(bookings || []).forEach((b: any) => {
    if (b.start_date) allDates.push(parseDate(b.start_date))
    if (b.end_date) allDates.push(parseDate(b.end_date))
  })
  const timelineStart = allDates.length ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date()
  const timelineEnd = allDates.length ? new Date(Math.max(...allDates.map(d => d.getTime()))) : addDays(new Date(), 30)
  const weeks = buildWeeks(timelineStart, timelineEnd)

  const isLoading = listsLoading || bookingsLoading

  const bookedItemIds = new Set((bookings || []).map((b: any) => b.equipment_item_id))
  const displayItems = allItems.filter((item: any) => bookedItemIds.has(item.id))

  return (
    <div className="px-5 py-6 sm:p-7 max-w-6xl mx-auto animate-fade-up">
      {/* Page hero */}
      <div className="mb-8 pb-7 border-b border-border/40">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-[28px] sm:text-[34px]">{tt(T.titel)}</h1>
            <p className="text-sm text-muted-foreground/60 mt-1.5">
              {tt(T.untertitel)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="flex items-center gap-5">
              <div className="text-right">
                <div className="text-[2.25rem] font-bold tabular-nums tracking-tight leading-none">{allItems.length}</div>
                <div className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40 mt-1">{tt(T.positionen)}</div>
              </div>
              <div className="text-right">
                <div className="text-[2.25rem] font-bold tabular-nums tracking-tight leading-none">{weeks.length}</div>
                <div className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40 mt-1">{tt(T.wochen)}</div>
              </div>
            </div>
            {darfSchreiben && (
              <Button
                size="sm"
                data-einfuehrung="neu"
                onClick={() => setDialogOpen(true)}
                className="active:scale-[0.97] ml-4"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                {tt(T.neueBuchung)}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Conflicts */}
      {konflikte.length > 0 && (
        <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-2">
          <div className="flex items-center gap-2.5 text-destructive font-semibold text-sm">
            <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            {tt(konflikte.length !== 1 ? T.doppelbuchungen : T.doppelbuchung).replace('{n}', String(konflikte.length))}
          </div>
          {konflikte.map((c, i) => (
            <div key={i} className="text-xs text-destructive/70 pl-11">
              {allItems.find((it: any) => it.id === c.equipment_item_id)?.item || tt(T.equipmentNr).replace('{id}', String(c.equipment_item_id))}: {tt(T.ueberlappung)} {formatDate(c.von)} - {formatDate(c.bis)}
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
        <div data-einfuehrung="kalender" className="rounded-xl border border-border/60 bg-card overflow-x-auto mb-6">
          <table className="w-full text-xs border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-border/40">
                <th style={deckend(0.3)} className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground w-48 min-w-[192px] sticky left-0 z-10">
                  {tt(T.equipment)}
                </th>
                {weeks.map((w, i) => (
                  <th key={i} className="p-1.5 text-center text-muted-foreground min-w-[52px] bg-muted/30">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/50 leading-none mb-0.5">
                      {tt(MONATE_KURZ[w.getMonth()])}
                    </div>
                    <div className="text-[11px] font-semibold tabular-nums">
                      {w.getDate()}.-{addDays(w, 6).getDate()}.
                    </div>
                  </th>
                ))}
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground bg-muted/30 w-24 text-center">
                  {tt(T.aktionen)}
                </th>
              </tr>
            </thead>
            <tbody>
              {displayItems.length === 0 && (
                <tr>
                  <td colSpan={weeks.length + 2} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Package className="w-10 h-10 opacity-20" />
                      <p className="text-sm text-muted-foreground">{tt(T.keineBuchungen)}</p>
                    </div>
                  </td>
                </tr>
              )}
              {displayItems.map((item: any, rowIdx: number) => {
                const itemBookings = (bookings || []).filter((b: any) => b.equipment_item_id === item.id)
                const hasConflict = konflikte.some(c => c.equipment_item_id === item.id)
                return (
                  <tr
                    key={item.id}
                    className={`border-b border-border/30 transition-colors ${
                      rowIdx % 2 === 1 ? 'bg-muted/10' : ''
                    } ${hasConflict ? 'bg-destructive/5' : 'hover:bg-muted/20'}`}
                  >
                    <td style={deckend(rowIdx % 2 === 1 ? 0.1 : 0, hasConflict)} className="px-5 py-3 sticky left-0 z-10 border-r border-border/30">
                      <div className="font-medium flex items-center gap-2 text-sm">
                        <div className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
                          <Package className="w-4 h-4 text-muted-foreground/60" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            {item.item}
                            {hasConflict && <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />}
                          </div>
                          {item.supplier && (
                            <div className="text-[10px] text-muted-foreground/50 font-normal">{item.supplier}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    {weeks.map((w, wi) => {
                      const isBooked = itemBookings.some((b: any) => blockedInWeek(w, b.start_date, b.end_date))
                      const isConflicted = hasConflict && isBooked
                      return (
                        <td key={wi} className="p-1 text-center">
                          <div className={`h-7 rounded-lg mx-0.5 transition-colors ${isConflicted
                              ? 'bg-destructive/60 border border-destructive/70'
                              : isBooked
                              ? 'bg-blue-500/40 border border-blue-500/50'
                              : 'bg-transparent'
                          }`} />
                        </td>
                      )
                    })}
                    <td className="px-2 py-2">
                      <div className="flex flex-col gap-1">
                        {darfSchreiben && itemBookings.map((b: any) => (
                          <button
                            key={b.id}
                            onClick={() => loeschen(b, item.item)}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-destructive transition-colors active:scale-[0.97] group"
                            title={`${formatDate(b.start_date)} - ${formatDate(b.end_date)}${b.notes ? ': ' + b.notes : ''}`}
                            aria-label={tt(T.buchungLoeschen).replace('{von}', formatDate(b.start_date)).replace('{bis}', formatDate(b.end_date))}
                          >
                            <div className="w-5 h-5 rounded-md flex items-center justify-center group-hover:bg-destructive/10 transition-colors">
                              <Trash2 className="w-3 h-3" />
                            </div>
                            <span className="truncate max-w-[56px]">{formatDate(b.start_date)}</span>
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
            <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40">{tt(T.legende)}</p>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded bg-blue-500/40 border border-blue-500/50" />
              <span className="text-[11px] text-muted-foreground">{tt(T.gebucht)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded bg-destructive/60 border border-destructive/70" />
              <span className="text-[11px] text-muted-foreground">{tt(T.konflikt)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Bookings list */}
      {(bookings || []).length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40">
            <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40 mb-0.5">{tt(T.uebersicht)}</p>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">{tt(T.alleBuchungen)}</h2>
              <span className="text-[11px] text-muted-foreground/50 tabular-nums">({bookings!.length})</span>
            </div>
          </div>
          <div className="divide-y divide-border/30">
            {(bookings || []).map((b: any) => {
              const item = allItems.find((it: any) => it.id === b.equipment_item_id)
              const isConflicted = konflikte.some(c => c.equipment_item_id === b.equipment_item_id)
              return (
                <div
                  key={b.id}
                  className={`flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors ${isConflicted ? 'bg-destructive/5' : ''}`}
                >
                  <div className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-blue-500/70" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium flex items-center gap-2">
                      {item?.item || tt(T.equipmentNr).replace('{id}', String(b.equipment_item_id))}
                      {isConflicted && (
                        <Badge variant="destructive" className="text-[10px] h-4 px-1.5">{tt(T.konflikt)}</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground/60 mt-0.5 tabular-nums">
                      {formatDate(b.start_date)} - {formatDate(b.end_date)}
                      {b.notes && <span className="ml-2 not-italic">· {b.notes}</span>}
                    </div>
                  </div>
                  {darfSchreiben && (
                    <button
                      onClick={() => loeschen(b, item?.item)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground/30 hover:text-destructive transition-colors active:scale-[0.97]"
                      aria-label={tt(T.buchungLoeschen).replace('{von}', formatDate(b.start_date)).replace('{bis}', formatDate(b.end_date))}
                      title={tt(T.buchungLoeschen).replace('{von}', formatDate(b.start_date)).replace('{bis}', formatDate(b.end_date))}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
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
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
              </div>
              <DialogTitle>{tt(T.hinzufuegen)}</DialogTitle>
            </div>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-sm font-medium">{tt(T.position)}</Label>
              <Select value={form.equipment_item_id} onValueChange={v => setForm(f => ({ ...f, equipment_item_id: v }))}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder={tt(T.positionWaehlen)} />
                </SelectTrigger>
                <SelectContent>
                  {allItems.map((item: any) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.item}{item.supplier ? ` (${item.supplier})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">{tt(T.von)}</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">{tt(T.bis)}</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                  className="mt-1.5"
                />
              </div>
            </div>
            {endeVorBeginn && <p role="alert" className="text-xs text-destructive">{tt(T.endeVorBeginn)}</p>}
            <div>
              <Label className="text-sm font-medium">{tt(T.notizen)} <span className="text-muted-foreground/50 font-normal">{tt(T.optional)}</span></Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="mt-1.5 resize-none"
                placeholder={tt(T.notizenPlatz)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="active:scale-[0.97]">
                {tt(T.abbrechen)}
              </Button>
              <Button
                onClick={() => addMutation.mutate({
                  equipment_item_id: Number(form.equipment_item_id),
                  start_date: form.start_date,
                  end_date: form.end_date,
                  notes: form.notes,
                })}
                disabled={!form.equipment_item_id || !form.start_date || !form.end_date || endeVorBeginn || addMutation.isPending}
                className="active:scale-[0.97]"
              >
                {tt(T.speichern)}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
