import { useState, useEffect } from 'react'
import { useSchreibrecht } from '@/lib/useSchreibrecht'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useDownload } from '@/lib/useDownload'
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
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameDay, isSameMonth, parseISO, isToday } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, Trash2, Calendar, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT, useGebietsschema } from '@/lib/useT'
import type { Lang } from '@/lib/i18n'
import { terminkalenderT as T, terminTypT } from '@/lib/texte/Terminkalender'

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

/** Beschriftung eines Termintyps; unbekannte Werte erscheinen, wie sie sind. */
function typLabel(tt: (m: Record<Lang, string>) => string, wert: string): string {
  const m = (terminTypT as Record<string, Record<Lang, string>>)[wert]
  return m ? tt(m) : wert
}

function EventDot({ color }: { color: string }) {
  return <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
}

function AddEventDialog({ open, onClose, projectId, defaultDate }: { open: boolean; onClose: () => void; projectId: number; defaultDate?: Date }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const tt = useT()
  const [form, setForm] = useState({
    title: '',
    start_date: defaultDate ? format(defaultDate, 'yyyy-MM-dd') : '',
    end_date: '',
    type: 'Meeting',
    color: '#6366f1',
    notes: '',
  })

  // Der Dialog bleibt eingehängt - der Startwert von useState galt nur beim
  // ersten Mal. Vorher stand nach "Termin hinzufügen" am 20. ein leeres Datum.
  useEffect(() => {
    if (open) setForm(f => ({ ...f, start_date: defaultDate ? format(defaultDate, 'yyyy-MM-dd') : '' }))
  }, [open, defaultDate])

  const mutation = useMutation({
    mutationFn: (data: any) => api.calendar.create(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', projectId] })
      toast({ title: tt(T.hinzugefuegt) })
      onClose()
      setForm({ title: '', start_date: '', end_date: '', type: 'Meeting', color: '#6366f1', notes: '' })
    },
    onError: () => toast({ title: tt(T.fehler), variant: 'destructive' }),
  })

  const updateType = (type: string) => {
    const et = EVENT_TYPES.find(e => e.value === type)
    setForm(f => ({ ...f, type, color: et?.color || '#6b7280' }))
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{tt(T.neuerTermin)}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">{tt(T.titel)}</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="mt-1" placeholder={tt(T.bezeichnung)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{tt(T.datumVon)}</Label>
              <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">{tt(T.datumBis)}</Label>
              <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs">{tt(T.termintyp)}</Label>
            <Select value={form.type} onValueChange={updateType}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map(et => (
                  <SelectItem key={et.value} value={et.value}>
                    <div className="flex items-center gap-2"><EventDot color={et.color} />{typLabel(tt, et.value)}</div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{tt(T.notizen)}</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="mt-1 resize-none" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tt(T.abbrechen)}</Button>
          <Button onClick={() => form.title && form.start_date && mutation.mutate(form)} disabled={!form.title || !form.start_date || mutation.isPending}>
            {tt(T.hinzufuegen)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const download = useDownload()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const tt = useT()
  const gebietsschema = useGebietsschema()
  const { darfSchreiben } = useSchreibrecht()
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

  // Ein Termin mit "Datum bis" steht an jedem seiner Tage - vorher nur am
  // ersten: eine dreitägige Reise fehlte am zweiten und dritten Tag.
  const getEventsForDate = (date: Date) => {
    const tag = format(date, 'yyyy-MM-dd')
    return (events || []).filter((e: any) => {
      const von = String(e.start_date || '').slice(0, 10)
      const bisRoh = String(e.end_date || '').slice(0, 10)
      const bis = bisRoh && bisRoh >= von ? bisRoh : von
      return !!von && von <= tag && tag <= bis
    })
  }

  const getShootDayForDate = (date: Date) => {
    return (shootDays || []).find((sd: any) => {
      try { return isSameDay(parseISO(sd.date), date) } catch { return false }
    })
  }

  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : []
  const selectedShootDay = selectedDate ? getShootDayForDate(selectedDate) : null

  const WEEKDAYS = [T.mo, T.di, T.mi, T.do, T.fr, T.sa, T.so].map(w => tt(w))
  const monat = currentMonth.toLocaleDateString(gebietsschema, { month: 'long', year: 'numeric' })

  return (
    <div className="px-5 py-6 sm:p-6 max-w-5xl mx-auto space-y-4">
      <PageHeader
        title={tt(T.seitenTitel)}
        subtitle={monat}
        actions={
          <div className="flex gap-2">
            {/* Drehtage und Termine als .ics - für Google, Apple, Outlook */}
            <Button size="sm" variant="outline" title={tt(T.icsTitel)}
              onClick={() => download(api.ical.export(pid), 'cutsheet-kalender.ics')}>
              <Download className="w-4 h-4 mr-2" />{tt(T.icsKnopf)}
            </Button>
            {darfSchreiben && (
              <Button size="sm" onClick={() => { setAddDate(new Date()); setAddOpen(true) }}>
                <Plus className="w-4 h-4 mr-2" />{tt(T.termin)}
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calendar */}
        <div data-einfuehrung="monat" className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <Button variant="ghost" size="sm" aria-label={tt(T.vorherigerMonat)} title={tt(T.vorherigerMonat)} onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <CardTitle className="text-base">{monat}</CardTitle>
              <Button variant="ghost" size="sm" aria-label={tt(T.naechsterMonat)} title={tt(T.naechsterMonat)} onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
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
                      // Per Tastatur wählbar wie per Maus
                      role="button"
                      tabIndex={0}
                      aria-pressed={!!isSelected}
                      aria-label={day.toLocaleDateString(gebietsschema, { weekday: 'long', day: 'numeric', month: 'long' })}
                      onClick={() => setSelectedDate(isSameDay(day, selectedDate!) ? null : day)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedDate(isSameDay(day, selectedDate!) ? null : day)
                        }
                      }}
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
                          {tt(T.drehtagKurz).replace('{n}', String(shootDay.day_number))}
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
                <CardTitle className="text-sm">{selectedDate.toLocaleDateString(gebietsschema, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {selectedShootDay && (
                  <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded text-sm">
                    <p className="font-medium text-amber-400">{tt(T.drehtagNr).replace('{n}', String(selectedShootDay.day_number))}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{selectedShootDay.notes || tt(T.keinVermerk)}</p>
                  </div>
                )}
                {selectedEvents.length > 0 ? selectedEvents.map((ev: any) => (
                  <div key={ev.id} className="p-2 rounded border border-border/40 bg-card/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <EventDot color={ev.color} />
                        <span className="text-sm font-medium">{ev.title}</span>
                      </div>
                      {darfSchreiben && (
                        <button onClick={() => deleteEvent.mutate(ev.id)} aria-label={tt(T.terminLoeschenAria).replace('{titel}', ev.title || '')} title={tt(T.terminLoeschen)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs mt-1">{typLabel(tt, ev.type)}</Badge>
                    {ev.notes && <p className="text-xs text-muted-foreground mt-1">{ev.notes}</p>}
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground">{tt(T.keineTermine)}</p>
                )}
                {darfSchreiben && (
                  <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => { setAddDate(selectedDate); setAddOpen(true) }}>
                    <Plus className="w-3 h-3 mr-1" />{tt(T.terminHinzu)}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Legend */}
          <Card>
            <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">{tt(T.legende)}</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {EVENT_TYPES.map(et => (
                <div key={et.value} className="flex items-center gap-2 text-sm">
                  <EventDot color={et.color} />
                  <span>{typLabel(tt, et.value)}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 text-sm mt-2 pt-2 border-t border-border/30">
                <span className="text-xs text-amber-400 font-mono font-bold">{tt(T.drehtagKurz).replace('{n}', '1')}</span>
                <span>{tt(T.drehtag)}</span>
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
