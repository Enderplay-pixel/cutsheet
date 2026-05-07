import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { formatDate, debounce, cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Sun, Cloud, MapPin, Clock, Users, Plus, Minus, ClipboardList, Save, Download, Trash2 } from 'lucide-react'
import { TimeInput } from '@/components/ui/time-input'

function CallSheetTable({ callSheet, projectId, onSaveEntries, onRefresh }: {
  callSheet: any; projectId: number; onSaveEntries: (entries: any[]) => void; onRefresh: () => void
}) {
  const [entries, setEntries] = useState<any[]>(callSheet?.entries || [])
  const [showAdd, setShowAdd] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    setEntries(callSheet?.entries || [])
  }, [callSheet?.entries])

  const updateEntry = (idx: number, key: string, value: any) => {
    setEntries(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [key]: value }
      return next
    })
  }

  const hasChanges = JSON.stringify(entries) !== JSON.stringify(callSheet?.entries || [])

  const addEntryMutation = useMutation({
    mutationFn: (data: { person_type: string; person_id: number; call_time: number }) =>
      api.callSheets.addEntry(callSheet.id, data),
    onSuccess: () => { onRefresh(); setShowAdd(false) },
  })

  const deleteEntryMutation = useMutation({
    mutationFn: (entryId: number) => api.callSheets.deleteEntry(callSheet.id, entryId),
    onSuccess: () => onRefresh(),
  })

  const { data: crew } = useQuery({
    queryKey: ['crew', projectId],
    queryFn: () => api.crew.list(projectId),
    enabled: showAdd,
  })
  const { data: castList } = useQuery({
    queryKey: ['cast', projectId],
    queryFn: () => api.cast.list(projectId),
    enabled: showAdd,
  })

  const assignedIds = new Set(entries.map((e: any) => `${e.person_type}:${e.person_id}`))
  const availableCrew = (crew || []).filter((c: any) => !assignedIds.has(`crew:${c.id}`))
  const availableCast = (castList || []).filter((c: any) => !assignedIds.has(`cast:${c.id}`))

  if (!callSheet?.entries || callSheet.entries.length === 0) {
    return null
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          Call Sheet <span className="text-muted-foreground font-normal">({entries.length} Personen)</span>
        </h2>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button size="sm" onClick={() => onSaveEntries(entries)}>
              <Save className="w-3.5 h-3.5 mr-1.5" />Speichern
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowAdd(v => !v)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />Person hinzufügen
          </Button>
        </div>
      </div>

      {showAdd && (
        <div className="mb-3 p-3 border border-border/60 rounded-xl bg-muted/20 space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Person hinzufügen</p>
          <div className="flex flex-wrap gap-2">
            {availableCrew.map((c: any) => (
              <button key={c.id}
                onClick={() => addEntryMutation.mutate({ person_type: 'crew', person_id: c.id, call_time: callSheet.general_call || 480 })}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-border/60 text-xs hover:border-primary/40 hover:text-primary transition-colors bg-card"
              >
                <Plus className="w-3 h-3" />{c.name} <span className="text-muted-foreground">{c.role}</span>
              </button>
            ))}
            {availableCast.map((c: any) => (
              <button key={c.id}
                onClick={() => addEntryMutation.mutate({ person_type: 'cast', person_id: c.id, call_time: callSheet.general_call || 480 })}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-primary/30 text-xs hover:border-primary/60 hover:text-primary transition-colors bg-primary/5"
              >
                <Plus className="w-3 h-3" />{c.actor_name} <span className="text-muted-foreground">Darsteller</span>
              </button>
            ))}
            {availableCrew.length === 0 && availableCast.length === 0 && (
              <p className="text-xs text-muted-foreground">Alle Personen sind bereits im Call Sheet.</p>
            )}
          </div>
        </div>
      )}

      <div className="border border-border/60 rounded-xl overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40">
              <th className="text-left text-[11px] text-muted-foreground/60 font-medium uppercase tracking-wide py-2.5 pl-4 pr-2">Name / Rolle</th>
              <th className="text-left text-[11px] text-muted-foreground/60 font-medium uppercase tracking-wide py-2.5 px-2">Typ</th>
              <th className="text-left text-[11px] text-muted-foreground/60 font-medium uppercase tracking-wide py-2.5 px-2">Call Time</th>
              <th className="text-left text-[11px] text-muted-foreground/60 font-medium uppercase tracking-wide py-2.5 px-2">Abholort</th>
              <th className="text-left text-[11px] text-muted-foreground/60 font-medium uppercase tracking-wide py-2.5 px-2">Notiz</th>
              <th className="py-2.5 pr-4 w-8" />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry: any, idx: number) => (
              <tr key={entry.id} className="border-b border-border/30 last:border-0 hover:bg-muted/10 transition-colors group">
                <td className="py-2.5 pl-4 pr-2">
                  <div className="text-sm font-medium">{entry.person_name || '–'}</div>
                  <div className="text-xs text-muted-foreground">{entry.role || ''}</div>
                </td>
                <td className="py-2.5 px-2">
                  <span className={cn(
                    'text-[11px] px-2 py-0.5 rounded-full font-medium',
                    entry.person_type === 'cast'
                      ? 'bg-primary/12 text-primary'
                      : 'bg-muted text-muted-foreground'
                  )}>
                    {entry.person_type === 'cast' ? 'Darsteller' : 'Stab'}
                  </span>
                </td>
                <td className="py-2.5 px-2">
                  <TimeInput value={entry.call_time || 480} onChange={v => updateEntry(idx, 'call_time', v)} className="w-20 h-7 text-xs" />
                </td>
                <td className="py-2.5 px-2">
                  <Input value={entry.pickup_location || ''} onChange={e => updateEntry(idx, 'pickup_location', e.target.value)} className="h-7 text-xs w-32" placeholder="Abholort" />
                </td>
                <td className="py-2.5 px-2">
                  <Input value={entry.notes || ''} onChange={e => updateEntry(idx, 'notes', e.target.value)} className="h-7 text-xs w-40" placeholder="Notiz" />
                </td>
                <td className="py-2.5 pr-4">
                  <button
                    onClick={() => deleteEntryMutation.mutate(entry.id)}
                    className="w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function Component() {
  const { projectId, dayId } = useParams()
  const pid = Number(projectId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: allDays } = useQuery({
    queryKey: ['shoot-days', pid],
    queryFn: () => api.drehplan.listDays(pid),
  })

  const { data: project } = useQuery({
    queryKey: ['project', pid],
    queryFn: () => api.projects.get(pid),
  })

  const selectedDayId = dayId ? Number(dayId) : allDays?.[0]?.id
  const currentDay = allDays?.find((d: any) => d.id === selectedDayId)
  const currentIndex = allDays?.findIndex((d: any) => d.id === selectedDayId) ?? -1

  const { data: callSheet, isLoading } = useQuery({
    queryKey: ['call-sheet', selectedDayId],
    queryFn: () => api.callSheets.get(selectedDayId!),
    enabled: !!selectedDayId,
  })

  const [headerForm, setHeaderForm] = useState<any>(null)
  useEffect(() => {
    if (callSheet !== undefined) {
      const defCall = project?.settings?.default_call_time ?? 480
      setHeaderForm(callSheet || {
        general_call: defCall, shooting_call: defCall + 30,
        weather_forecast: '', sunrise: '', sunset: '', notes: '',
      })
    }
  }, [callSheet, selectedDayId])

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.callSheets.createOrUpdate(selectedDayId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-sheet', selectedDayId] })
      toast({ title: 'Tagesdispo gespeichert' })
    },
  })

  const saveEntriesMutation = useMutation({
    mutationFn: (entries: any[]) => api.callSheets.updateEntries(callSheet?.id!, entries),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-sheet', selectedDayId] })
      toast({ title: 'Call Sheet aktualisiert' })
    },
  })

  const debouncedSave = useRef(debounce((data: any) => saveMutation.mutate(data), 600)).current
  const updateHeader = (key: string, value: any) => {
    const next = { ...headerForm, [key]: value }
    setHeaderForm(next)
    debouncedSave(next)
  }

  const shiftMutation = useMutation({
    mutationFn: (mins: number) => api.callSheets.shiftTimes(callSheet?.id!, mins),
    onSuccess: (_data, mins) => {
      queryClient.invalidateQueries({ queryKey: ['call-sheet', selectedDayId] })
      toast({ title: `Alle Zeiten um ${mins > 0 ? '+' : ''}${mins} Min. verschoben` })
    },
  })

  const [shiftAmount, setShiftAmount] = useState(15)

  if (!allDays || allDays.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-center text-muted-foreground">
        <Clock className="w-10 h-10 mb-3 opacity-20" />
        <p className="text-sm">Keine Drehtage geplant.</p>
        <p className="text-xs mt-1">Lege zuerst Drehtage im Drehplan an.</p>
      </div>
    )
  }

  return (
    <div className="p-7 max-w-5xl mx-auto animate-fade-up space-y-5">
      {/* Day nav + title */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="w-8 h-8"
            disabled={currentIndex <= 0}
            onClick={() => navigate(`/projects/${pid}/tagesdispo/${allDays[currentIndex - 1].id}`)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Select value={String(selectedDayId)} onValueChange={v => navigate(`/projects/${pid}/tagesdispo/${v}`)}>
            <SelectTrigger className="w-52 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {allDays.map((d: any) => (
                <SelectItem key={d.id} value={String(d.id)} className="text-xs">
                  Tag {d.day_number} – {formatDate(d.date)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="w-8 h-8"
            disabled={currentIndex >= allDays.length - 1}
            onClick={() => navigate(`/projects/${pid}/tagesdispo/${allDays[currentIndex + 1].id}`)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold leading-tight">Tagesdisposition</h1>
          {currentDay && (
            <p className="text-sm text-muted-foreground">
              Drehtag {currentDay.day_number} · {formatDate(currentDay.date)}
            </p>
          )}
        </div>
        {selectedDayId && (
          <a href={api.pdf.tagesdispo(selectedDayId)} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <Download className="w-3.5 h-3.5 mr-1.5" />PDF
            </Button>
          </a>
        )}
      </div>

      {isLoading || !headerForm ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : (
        <>
          {/* Time cards */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'General Call', key: 'general_call', icon: Clock, isTime: true },
              { label: 'Shooting Call', key: 'shooting_call', icon: Clock, isTime: true },
              { label: 'Sonnenaufgang', key: 'sunrise', icon: Sun, isTime: false },
              { label: 'Sonnenuntergang', key: 'sunset', icon: Cloud, isTime: false },
            ].map(({ label, key, icon: Icon, isTime }) => (
              <div key={key} className="bg-card border border-border/60 rounded-xl p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
                {isTime ? (
                  <TimeInput
                    value={headerForm[key] || 480}
                    onChange={v => updateHeader(key, v)}
                    className="h-10 text-xl font-bold text-center"
                  />
                ) : (
                  <Input
                    value={headerForm[key] || ''}
                    onChange={e => updateHeader(key, e.target.value)}
                    className="h-10 font-mono text-lg text-center"
                    placeholder="–"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Scenes today */}
          {currentDay?.scenes?.length > 0 && (
            <div className="bg-card border border-border/60 rounded-xl p-4">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">
                Szenen heute ({currentDay.scenes.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                {currentDay.scenes.map((s: any) => (
                  <div key={s.scene_id} className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/60 rounded-lg text-xs">
                    <span className="font-mono font-semibold">Sz. {s.scene_number}</span>
                    <span className="text-muted-foreground">–</span>
                    <span>{s.title}</span>
                    <span className="text-muted-foreground/60">{s.int_ext}/{s.day_night}</span>
                    {s.location_name && (
                      <>
                        <MapPin className="w-3 h-3 text-muted-foreground/50" />
                        <span className="text-muted-foreground">{s.location_name}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Time shift */}
          <div className="bg-card border border-border/60 rounded-xl p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-sm font-medium">Alle Zeiten verschieben</span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="w-7 h-7"
                  onClick={() => setShiftAmount(Math.max(5, shiftAmount - 5))}>
                  <Minus className="w-3 h-3" />
                </Button>
                <span className="text-sm font-mono w-14 text-center tabular-nums">{shiftAmount} Min</span>
                <Button variant="outline" size="icon" className="w-7 h-7"
                  onClick={() => setShiftAmount(shiftAmount + 5)}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs"
                  onClick={() => shiftMutation.mutate(-shiftAmount)} disabled={!callSheet?.id}>
                  −{shiftAmount} Min
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs"
                  onClick={() => shiftMutation.mutate(shiftAmount)} disabled={!callSheet?.id}>
                  +{shiftAmount} Min
                </Button>
              </div>
            </div>
          </div>

          {/* Call sheet entries */}
          {!callSheet?.entries || callSheet.entries.length === 0 ? (
            <div className="bg-card border border-border/60 rounded-xl p-8 text-center">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground mb-1">Call Sheet noch leer</p>
              <p className="text-xs text-muted-foreground/60 mb-4">Speichere die Tagesdispo, um die Teilnehmerliste zu generieren.</p>
              <Button size="sm" onClick={() => saveMutation.mutate(headerForm)}>
                Tagesdispo erstellen
              </Button>
            </div>
          ) : (
            <CallSheetTable
              callSheet={callSheet}
              projectId={pid}
              onSaveEntries={(entries) => saveEntriesMutation.mutate(entries)}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ['call-sheet', selectedDayId] })}
            />
          )}

          {/* Weather + Notes */}
          <div className="bg-card border border-border/60 rounded-xl p-4 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
              Allgemeine Informationen
            </h2>
            <div>
              <Label className="text-xs text-muted-foreground">Wetter</Label>
              <Input value={headerForm.weather_forecast || ''}
                onChange={e => updateHeader('weather_forecast', e.target.value)}
                className="mt-1 h-8 text-sm" placeholder="z.B. Bewölkt, 18°C, kein Regen" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Allgemeine Notizen</Label>
              <Textarea value={headerForm.notes || ''}
                onChange={e => updateHeader('notes', e.target.value)}
                rows={3} className="mt-1 text-sm resize-none"
                placeholder="Besonderheiten, Sicherheitshinweise, Catering…" />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
