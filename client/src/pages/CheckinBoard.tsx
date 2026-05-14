import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { CheckCircle2, Circle, QrCode, Clock } from 'lucide-react'

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
      return res.json()
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
      return res.json()
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
      return res.json()
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Check-in Board</h1>
      </div>

      {/* Day selector */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <span className="text-sm font-medium text-muted-foreground w-24">Drehtag:</span>
        {loadingDays ? (
          <Skeleton className="h-10 w-64" />
        ) : (
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
                  DT {d.day_number} – {formatDateLong(d.date)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!selectedDayId && (
        <p className="text-muted-foreground">Bitte einen Drehtag auswählen.</p>
      )}

      {selectedDayId && loadingSheet && (
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {selectedDayId && !loadingSheet && callSheet === null && (
        <p className="text-muted-foreground">Keine Tagesdispo für diesen Drehtag.</p>
      )}

      {selectedDayId && !loadingSheet && callSheet && (
        <div className="space-y-4">
          {/* Progress */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{checkedIn} / {total} eingecheckt</span>
              <span className="text-muted-foreground">{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-2" />
          </div>

          {/* QR hint */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg px-4 py-2">
            <QrCode className="h-4 w-4 shrink-0" />
            <span>Gastlink für Check-in: <code className="font-mono text-xs">/guest/checkin/{selectedDayId}</code></span>
          </div>

          {/* Entries */}
          <div className="space-y-2">
            {entries.length === 0 && (
              <p className="text-muted-foreground text-sm">Keine Einträge in dieser Tagesdispo.</p>
            )}
            {entries
              .slice()
              .sort((a, b) => (a.call_time ?? '').localeCompare(b.call_time ?? ''))
              .map(entry => (
                <Card key={entry.id} className={`border ${entry.checked_in ? 'border-green-500/30 bg-green-500/5' : 'border-border'}`}>
                  <CardContent className="flex items-center gap-4 py-3 px-4">
                    {/* Status icon */}
                    <div className="shrink-0">
                      {entry.checked_in ? (
                        <CheckCircle2 className="h-6 w-6 text-green-500" />
                      ) : (
                        <Circle className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{entry.name}</span>
                        <Badge variant={entry.person_type === 'cast' ? 'purple' : 'blue'} className="text-[10px]">
                          {entry.person_type === 'cast' ? 'Darsteller' : 'Crew'}
                        </Badge>
                        {entry.role && (
                          <span className="text-xs text-muted-foreground">{entry.role}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Clock className="h-3 w-3" />
                        <span>Call: {formatTime(entry.call_time)}</span>
                        {entry.checked_in && entry.checked_in_at && (
                          <span className="ml-2 text-green-600 dark:text-green-400">
                            Eingecheckt um {formatDateTime(entry.checked_in_at)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status pill */}
                    <div className="shrink-0">
                      {entry.checked_in ? (
                        <Badge variant="green">Eingecheckt</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-muted-foreground">Ausstehend</Badge>
                      )}
                    </div>

                    {/* Action */}
                    {!entry.checked_in && (
                      <Button
                        size="sm"
                        onClick={() => checkinMutation.mutate(entry.id)}
                        disabled={checkinMutation.isPending}
                        className="shrink-0"
                      >
                        Einchecken
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
