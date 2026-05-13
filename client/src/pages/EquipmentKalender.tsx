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
import { AlertTriangle, Plus, Trash2, Package } from 'lucide-react'

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

function blockedInWeek(weekStart: Date, boStart: string, boEnd: string): boolean {
  const s = parseDate(boStart)
  const e = parseDate(boEnd)
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i)
    if (d >= s && d <= e) return true
  }
  return false
}

export default function EquipmentKalender() {
  const { id } = useParams<{ id: string }>()
  const pid = Number(id)
  const queryClient = useQueryClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ equipment_item_id: '', start_date: '', end_date: '', notes: '' })

  const { data: equipmentLists, isLoading: listsLoading } = useQuery({
    queryKey: ['equipment-lists', pid],
    queryFn: () => req<any[]>(`/projects/${pid}/equipment-lists`),
  })

  // Fetch items for all lists
  const listIds = (equipmentLists || []).map((l: any) => l.id)
  const itemQueries = useQuery({
    queryKey: ['equipment-all-items', pid, listIds],
    queryFn: async () => {
      const results = await Promise.all(listIds.map((lid: number) => req<any[]>(`/equipment-lists/${lid}/items`)))
      return results.flat()
    },
    enabled: listIds.length > 0,
  })

  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ['equipment-bookings', pid],
    queryFn: () => req<any[]>(`/projects/${pid}/equipment-bookings`),
  })

  const { data: conflicts } = useQuery({
    queryKey: ['equipment-booking-conflicts', pid],
    queryFn: () => req<any[]>(`/projects/${pid}/equipment-bookings/conflicts`),
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => req<any>(`/projects/${pid}/equipment-bookings`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-bookings', pid] })
      queryClient.invalidateQueries({ queryKey: ['equipment-booking-conflicts', pid] })
      setDialogOpen(false)
      setForm({ equipment_item_id: '', start_date: '', end_date: '', notes: '' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => req<any>(`/equipment-bookings/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-bookings', pid] })
      queryClient.invalidateQueries({ queryKey: ['equipment-booking-conflicts', pid] })
    },
  })

  const allItems = itemQueries.data || []

  // Build timeline range
  const allDates: Date[] = []
  ;(bookings || []).forEach((b: any) => {
    if (b.start_date) allDates.push(parseDate(b.start_date))
    if (b.end_date) allDates.push(parseDate(b.end_date))
  })
  const timelineStart = allDates.length ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date()
  const timelineEnd = allDates.length ? new Date(Math.max(...allDates.map(d => d.getTime()))) : addDays(new Date(), 30)
  const weeks = buildWeeks(timelineStart, timelineEnd)

  const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

  const isLoading = listsLoading || bookingsLoading

  // Items that have at least one booking
  const bookedItemIds = new Set((bookings || []).map((b: any) => b.equipment_item_id))
  const displayItems = allItems.filter((item: any) => bookedItemIds.has(item.id))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Equipment-Kalender</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Buchungszeiträume für Equipment-Positionen</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Buchung hinzufügen
        </Button>
      </div>

      {/* Conflicts */}
      {conflicts && conflicts.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
            <AlertTriangle className="w-4 h-4" />
            {conflicts.length} Doppelbuchung{conflicts.length !== 1 ? 'en' : ''} gefunden
          </div>
          {conflicts.map((c: any, i: number) => (
            <div key={i} className="text-xs text-destructive/80 pl-6">
              {c.item_name || `Equipment #${c.equipment_item_id}`}: Überlappung {c.start_date} – {c.end_date}
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
                <th className="text-left p-3 font-medium w-48 min-w-[192px]">Equipment</th>
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
              {displayItems.length === 0 && (
                <tr>
                  <td colSpan={weeks.length + 2} className="text-center py-12 text-muted-foreground">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    Noch keine Buchungen vorhanden
                  </td>
                </tr>
              )}
              {displayItems.map((item: any) => {
                const itemBookings = (bookings || []).filter((b: any) => b.equipment_item_id === item.id)
                const hasConflict = (conflicts || []).some((c: any) => c.equipment_item_id === item.id)
                return (
                  <tr key={item.id} className={`border-b border-border/40 hover:bg-muted/20 ${hasConflict ? 'bg-destructive/5' : ''}`}>
                    <td className="p-3">
                      <div className="font-medium flex items-center gap-2">
                        {item.item}
                        {hasConflict && <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
                      </div>
                      {item.supplier && <div className="text-[10px] text-muted-foreground">{item.supplier}</div>}
                    </td>
                    {weeks.map((w, wi) => {
                      const isBooked = itemBookings.some((b: any) => blockedInWeek(w, b.start_date, b.end_date))
                      const isConflicted = hasConflict && isBooked
                      return (
                        <td key={wi} className="p-1 text-center">
                          <div className={`h-7 rounded mx-0.5 ${
                            isConflicted
                              ? 'bg-destructive/70 border border-destructive/80'
                              : isBooked
                              ? 'bg-blue-500/50 border border-blue-500/60'
                              : 'bg-muted/20'
                          }`} />
                        </td>
                      )
                    })}
                    <td className="p-2">
                      {itemBookings.map((b: any) => (
                        <button
                          key={b.id}
                          onClick={() => deleteMutation.mutate(b.id)}
                          className="block w-full text-left text-[10px] text-muted-foreground hover:text-destructive mb-1 truncate"
                          title={`${b.start_date} – ${b.end_date}${b.notes ? ': ' + b.notes : ''}`}
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

          <div className="flex items-center gap-4 p-3 border-t border-border/40 bg-muted/20 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded bg-blue-500/50 border border-blue-500/60" /> Gebucht
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded bg-destructive/70" /> Konflikt
            </div>
          </div>
        </div>
      )}

      {/* Bookings list */}
      {(bookings || []).length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <h2 className="font-semibold text-sm">Alle Buchungen ({bookings!.length})</h2>
          </div>
          <div className="divide-y divide-border/40">
            {(bookings || []).map((b: any) => {
              const item = allItems.find((it: any) => it.id === b.equipment_item_id)
              const isConflicted = (conflicts || []).some((c: any) => c.equipment_item_id === b.equipment_item_id)
              return (
                <div key={b.id} className={`flex items-center gap-3 p-3 hover:bg-muted/20 ${isConflicted ? 'bg-destructive/5' : ''}`}>
                  <Package className="w-4 h-4 text-blue-500/60 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium flex items-center gap-2">
                      {item?.item || `Equipment #${b.equipment_item_id}`}
                      {isConflicted && <Badge variant="destructive" className="text-[10px] h-4">Konflikt</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {b.start_date} – {b.end_date}
                      {b.notes && <span className="ml-2">· {b.notes}</span>}
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
            <DialogTitle>Buchung hinzufügen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-sm">Equipment-Position</Label>
              <Select value={form.equipment_item_id} onValueChange={v => setForm(f => ({ ...f, equipment_item_id: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Position wählen" />
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
                <Label className="text-sm">Von</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Bis</Label>
                <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-sm">Notizen (optional)</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="mt-1 resize-none" placeholder="Lieferdetails, Abholung, ..." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
              <Button
                onClick={() => addMutation.mutate({ equipment_item_id: Number(form.equipment_item_id), start_date: form.start_date, end_date: form.end_date, notes: form.notes })}
                disabled={!form.equipment_item_id || !form.start_date || !form.end_date || addMutation.isPending}
              >
                Buchung speichern
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
