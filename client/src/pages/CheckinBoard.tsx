import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { CheckCircle2, Circle, QrCode, Clock, Users } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ShootDay {
  id: number
  day_number: number
  date: string
}

interface CallSheetEntry {
  id: number
  name: string
  person_type: 'cast' | 'crew'
  role?: string
  call_time?: string // ISO or HH:MM
  checked_in: boolean
  checked_in_at?: string
}

interface CallSheet {
  id: number
  shoot_day_id: number
  entries: CallSheetEntry[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(val: string | undefined) {
  if (!val) return '–'
  // handle HH:MM or ISO
  if (val.includes('T')) {
    const d = new Date(val)
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  }
  return val.substring(0, 5)
}

function formatDateTime(iso: string | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function formatDateLong(iso: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

function formatDateShort(iso: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

// ─── Component ───────────────────────────────────────────────────────────────

export function Component() {
  const { projectId: id } = useParams<{ projectId: string }>()
  const pid = Number(id)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedDayId, setSelectedDayId] = useState<number | null>(null)

  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // Shoot days
  const { data: shootDays, isLoading: loadingDays } = useQuery<ShootDay[]>({
    queryKey: ['shoot-days', pid],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${pid}/shoot-days`, { headers })
      if (!res.ok) throw new Error('Fehler')
      return (await res.json()).data
    },
  })

  // Call sheet for selected day
  const { data: callSheet, isLoading: loadingSheet } = useQuery<CallSheet | null>({
    queryKey: ['call-sheet', selectedDayId],
    queryFn: async () => {
      if (!selectedDayId) return null
      const res = await fetch(`/api/shoot-days/${selectedDayId}/call-sheet`, { headers })
      if (res.status === 404) return null
      if (!res.ok) throw new Error('Fehler')
      return (await res.json()).data
    },
    enabled: !!selectedDayId,
    refetchInterval: 10000,
  })

  // Check-in mutation
  const checkinMutation = useMutation({
    mutationFn: async (entryId: number) => {
      const res = await fetch(`/api/call-sheet-entries/${entryId}/checkin`, {
        method: 'POST',
        headers,
      })
      if (!res.ok) throw new Error('Fehler beim Einchecken')
      return (await res.json()).data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-sheet', selectedDayId] })
      toast({ title: 'Erfolgreich eingecheckt' })
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Fehler beim Einchecken' })
    },
  })

  const entries = callSheet?.entries ?? []
  const checkedIn = entries.filter(e => e.checked_in).length
  const total = entries.length
  const progressPct = total > 0 ? Math.round((checkedIn / total) * 100) : 0

  const selectedDay = shootDays?.find(d => d.id === selectedDayId)

  const sortedEntries = entries
    .slice()
    .sort((a, b) => (a.call_time ?? '').localeCompare(b.call_time ?? ''))

  return (
    <div className="p-7 max-w-6xl mx-auto animate-fade-up">
      {/* Page hero */}
      <div className="mb-8 pb-7 border-b border-border/40">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <h1 className="font-display text-[34px] sm:text-[40px]">Check-in Board</h1>
            <p className="text-sm text-muted-foreground/60 mt-1.5">Anwesenheit live verfolgen und bestätigen</p>
          </div>

          {/* Stat card */}
          <div className="rounded-xl border border-border/60 bg-card p-5 card-lift group flex items-start gap-4 min-w-[180px]">
            <div className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <div className="text-[2.25rem] font-bold tabular-nums leading-none">
                {selectedDayId && !loadingSheet && callSheet
                  ? <><span className="text-green-500">{checkedIn}</span><span className="text-muted-foreground/40 text-2xl"> / {total}</span></>
                  : <span className="text-muted-foreground/30">–</span>
                }
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] mt-2 text-muted-foreground">Eingecheckt</div>
            </div>
          </div>
        </div>

        {/* Progress bar – full width, below hero text */}
        {selectedDayId && !loadingSheet && callSheet && (
          <div className="mt-6 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">{progressPct}% anwesend</span>
              <span>{checkedIn} von {total} Personen</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted/40 overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Day selector card */}
      <div className="rounded-xl border border-border/60 bg-card p-5 mb-6">
        <div className="mb-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40">Drehtag</span>
        </div>
        {loadingDays ? (
          <Skeleton className="h-10 w-64 rounded-lg" />
        ) : (
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Select
              value={selectedDayId ? String(selectedDayId) : ''}
              onValueChange={v => setSelectedDayId(Number(v))}
            >
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Drehtag auswählen…" />
              </SelectTrigger>
              <SelectContent>
                {(shootDays ?? []).map(d => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    DT {d.day_number} – {formatDateShort(d.date)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedDay && (
              <span className="text-sm text-muted-foreground">{formatDateLong(selectedDay.date)}</span>
            )}
          </div>
        )}

        {/* QR guest link */}
        {selectedDayId && (
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 w-fit">
            <QrCode className="h-3.5 w-3.5 shrink-0" />
            <span>Gastlink: <code className="font-mono">/guest/checkin/{selectedDayId}</code></span>
          </div>
        )}
      </div>

      {/* Empty / loading states */}
      {!selectedDayId && (
        <div className="rounded-xl border border-border/60 bg-card p-16 flex flex-col items-center justify-center gap-3">
          <CheckCircle2 className="h-10 w-10 opacity-20" />
          <p className="text-sm text-muted-foreground">Bitte einen Drehtag auswählen.</p>
        </div>
      )}

      {selectedDayId && loadingSheet && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      )}

      {selectedDayId && !loadingSheet && callSheet === null && (
        <div className="rounded-xl border border-border/60 bg-card p-16 flex flex-col items-center justify-center gap-3">
          <Circle className="h-10 w-10 opacity-20" />
          <p className="text-sm text-muted-foreground">Keine Tagesdispo für diesen Drehtag.</p>
        </div>
      )}

      {selectedDayId && !loadingSheet && callSheet && (
        <div className="space-y-3">
          {entries.length === 0 && (
            <div className="rounded-xl border border-border/60 bg-card p-16 flex flex-col items-center justify-center gap-3">
              <Circle className="h-10 w-10 opacity-20" />
              <p className="text-sm text-muted-foreground">Keine Einträge in dieser Tagesdispo.</p>
            </div>
          )}

          {sortedEntries.map(entry => (
            <div
              key={entry.id}
              className={[
                'rounded-xl border p-5 transition-all duration-300',
                entry.checked_in
                  ? 'border-success/30 bg-success/[0.05]'
                  : 'border-border/60 bg-card',
              ].join(' ')}
            >
              <div className="flex items-center gap-4">
                {/* Status icon */}
                <div className="shrink-0">
                  {entry.checked_in ? (
                    <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center">
                      <Circle className="h-5 w-5 text-muted-foreground/40" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[0.95rem]">{entry.name}</span>
                    <Badge variant={entry.person_type === 'cast' ? 'purple' : 'blue'} className="text-[10px]">
                      {entry.person_type === 'cast' ? 'Darsteller' : 'Crew'}
                    </Badge>
                    {entry.role && (
                      <span className="text-xs text-muted-foreground/60">{entry.role}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Call: <span className="font-medium tabular-nums">{formatTime(entry.call_time)}</span></span>
                    </div>
                    {entry.checked_in && entry.checked_in_at && (
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                        Eingecheckt um {formatDateTime(entry.checked_in_at)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status pill + action */}
                <div className="shrink-0 flex items-center gap-3">
                  {entry.checked_in ? (
                    <Badge variant="green" className="text-[11px] px-2.5 py-0.5">Eingecheckt</Badge>
                  ) : (
                    <>
                      <Badge variant="secondary" className="text-muted-foreground text-[11px] px-2.5 py-0.5">Ausstehend</Badge>
                      <Button
                        size="sm"
                        onClick={() => checkinMutation.mutate(entry.id)}
                        disabled={checkinMutation.isPending}
                        className="active:scale-[0.97] shrink-0"
                      >
                        Einchecken
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
