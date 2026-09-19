import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { formatDate, formatDateLong } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameDay, isSameMonth, parseISO, isToday } from 'date-fns'
import { de } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Trash2, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

const EVENT_TYPES = [
  { value: 'Drehtag', color: '#f59e0b' },
  { value: 'Casting', color: '#3b82f6' },
  { value: 'Locationscout', color: '#10b981' },
  { value: 'Probe', color: '#8b5cf6' },
  { value: 'Meeting', color: '#6366f1' },
  { value: 'Sperrtag', color: '#ef4444' },
  { value: 'Reise', color: '#ec4899' },
  { value: 'Sonstiges', color: '#6b7280' },
]

function EventDot({ color }: { color: string }) {
  return <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
}

function AddEventDialog({ open, onClose, projectId, defaultDate }: { open: boolean; onClose: () => void; projectId: number; defaultDate?: Date }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [form, setForm] = useState({
    title: '',
    start_date: defaultDate ? format(defaultDate, 'yyyy-MM-dd') : '',
    end_date: '',
    type: 'Meeting',
    color: '#6366f1',
    notes: '',
  })

  const mutation = useMutation({
    mutationFn: (data: any) => api.calendar.create(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', projectId] })
      toast({ title: 'Termin hinzugefügt' })
      onClose()
      setForm({ title: '', start_date: '', end_date: '', type: 'Meeting', color: '#6366f1', notes: '' })
    },
    onError: () => toast({ title: 'Fehler', variant: 'destructive' }),
  })

  const updateType = (type: string) => {
    const et = EVENT_TYPES.find(e => e.value === type)
    setForm(f => ({ ...f, type, color: et?.color || '#6b7280' }))
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Neuer Termin</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Titel</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="mt-1" placeholder="Terminbezeichnung" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Datum (von)</Label>
              <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Datum (bis, optional)</Label>
              <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Termintyp</Label>
            <Select value={form.type} onValueChange={updateType}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map(et => (
                  <SelectItem key={et.value} value={et.value}>
                    <div className="flex items-center gap-2"><EventDot color={et.color} />{et.value}</div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Notizen</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="mt-1 resize-none" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={() => form.title && form.start_date && mutation.mutate(form)} disabled={!form.title || !form.start_date || mutation.isPending}>
            Hinzufügen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [addOpen, setAddOpen] = useState(false)
  const [addDate, setAddDate] = useState<Date | undefined>()
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const { data: events, isLoading } = useQuery({
    queryKey: ['events', pid],
    queryFn: () => api.calendar.list(pid),
  })

  const { data: shootDays } = useQuery({
    queryKey: ['shoot-days', pid],
    queryFn: () => api.drehplan.listDays(pid),
  })

  const deleteEvent = useMutation({
    mutationFn: (id: number) => api.calendar.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events', pid] }),
  })

  // Build calendar grid
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days: Date[] = []
  let d = calStart
  while (d <= calEnd) { days.push(d); d = addDays(d, 1) }

  const getEventsForDate = (date: Date) => {
    return (events || []).filter((e: any) => {
      try { return isSameDay(parseISO(e.start_date), date) } catch { return false }
    })
  }

  const getShootDayForDate = (date: Date) => {
    return (shootDays || []).find((sd: any) => {
      try { return isSameDay(parseISO(sd.date), date) } catch { return false }
    })
  }

  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : []
  const selectedShootDay = selectedDate ? getShootDayForDate(selectedDate) : null

  const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <PageHeader
        title="Terminkalender"
        subtitle={format(currentMonth, 'MMMM yyyy', { locale: de })}
        actions={
          <Button size="sm" onClick={() => { setAddDate(new Date()); setAddOpen(true) }}>
            <Plus className="w-4 h-4 mr-2" />Termin
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <CardTitle className="text-base">{format(currentMonth, 'MMMM yyyy', { locale: de })}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {/* Weekday headers */}
              <div className="grid grid-cols-7 mb-1">
                {WEEKDAYS.map(w => (
                  <div key={w} className="text-center text-xs font-medium text-muted-foreground py-1">{w}</div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-0.5">
                {days.map((day, idx) => {
                  const dayEvents = getEventsForDate(day)
                  const shootDay = getShootDayForDate(day)
                  const inMonth = isSameMonth(day, currentMonth)
                  const isSelected = selectedDate && isSameDay(day, selectedDate)
                  const today = isToday(day)

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedDate(isSameDay(day, selectedDate!) ? null : day)}
                      className={cn(
                        'min-h-[70px] p-1 rounded cursor-pointer transition-colors border border-transparent',
                        !inMonth && 'opacity-30',
                        isSelected ? 'bg-primary/20 border-primary/40' : 'hover:bg-muted/30',
                        today && !isSelected && 'border-primary/30'
                      )}
                    >
                      <div className={cn(
                        'text-xs font-medium mb-0.5',
                        today ? 'text-primary font-bold' : inMonth ? 'text-foreground' : 'text-muted-foreground'
                      )}>
                        {format(day, 'd')}
                      </div>

                      {shootDay && (
                        <div className="text-[10px] bg-amber-500/20 text-amber-400 rounded px-0.5 mb-0.5 truncate">
                          T{shootDay.day_number}
                        </div>
                      )}

                      <div className="flex flex-col gap-0.5">
                        {dayEvents.slice(0, 3).map((ev: any) => (
                          <div key={ev.id} className="flex items-center gap-0.5 text-[10px] truncate">
                            <EventDot color={ev.color || '#6b7280'} />
                            <span className="truncate">{ev.title}</span>
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{dayEvents.length - 3}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: selected day + legend */}
        <div className="space-y-3">
          {selectedDate && (
            <Card>
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm">{formatDateLong(selectedDate)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {selectedShootDay && (
                  <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded text-sm">
                    <p className="font-medium text-amber-400">Drehtag {selectedShootDay.day_number}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{selectedShootDay.notes || 'Kein Vermerk'}</p>
                  </div>
                )}
                {selectedEvents.length > 0 ? selectedEvents.map((ev: any) => (
                  <div key={ev.id} className="p-2 rounded border border-border/40 bg-card/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <EventDot color={ev.color} />
                        <span className="text-sm font-medium">{ev.title}</span>
                      </div>
                      <button onClick={() => deleteEvent.mutate(ev.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <Badge variant="outline" className="text-xs mt-1">{ev.type}</Badge>
                    {ev.notes && <p className="text-xs text-muted-foreground mt-1">{ev.notes}</p>}
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground">Keine Termine.</p>
                )}
                <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => { setAddDate(selectedDate); setAddOpen(true) }}>
                  <Plus className="w-3 h-3 mr-1" />Termin hinzufügen
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Legend */}
          <Card>
            <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">Legende</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {EVENT_TYPES.map(et => (
                <div key={et.value} className="flex items-center gap-2 text-sm">
                  <EventDot color={et.color} />
                  <span>{et.value}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 text-sm mt-2 pt-2 border-t border-border/30">
                <span className="text-xs text-amber-400 font-mono font-bold">T1</span>
                <span>Drehtag</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AddEventDialog
        open={addOpen}
        onClose={() => { setAddOpen(false); setAddDate(undefined) }}
        projectId={pid}
        defaultDate={addDate}
      />
    </div>
  )
}
