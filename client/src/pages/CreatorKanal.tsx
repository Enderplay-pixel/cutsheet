import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { YouTubeConnection } from '@/components/creator/YouTubeConnection'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronLeft, ChevronRight, CalendarDays, Eye, Heart, UserPlus, Banknote } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT, useGebietsschema } from '@/lib/useT'
import { creatorKanalT as T, WOCHENTAGE, STATUS_TEXT } from '@/lib/texte/CreatorKanal'
import { parseISO } from 'date-fns'

const STATUS_DOT: Record<string, string> = {
  'Idee': 'bg-muted-foreground/50',
  'Skript': 'bg-blue-400',
  'Dreh': 'bg-amber-400',
  'Schnitt': 'bg-violet-400',
  'Thumbnail': 'bg-pink-400',
  'Upload': 'bg-cyan-400',
  'Veröffentlicht': 'bg-emerald-400',
}

/** Montag der Woche, in der der Monatsanfang liegt. */
function gridStart(year: number, month: number): Date {
  const first = new Date(year, month, 1)
  const weekday = (first.getDay() + 6) % 7 // Montag = 0
  const start = new Date(first)
  start.setDate(first.getDate() - weekday)
  return start
}

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border border-border/50 bg-card">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{label}</div>
        <div className="font-semibold truncate">{value}</div>
      </div>
    </div>
  )
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const navigate = useNavigate()
  const tt = useT()
  const gs = useGebietsschema()

  const today = new Date()
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() })

  const { data, isLoading } = useQuery({
    queryKey: ['creator-overview', pid],
    queryFn: () => api.creator.overview(pid),
  })

  // Muster ueber den ganzen Kanal - der Vergleich, den Studio nicht anbietet
  const { data: patterns } = useQuery({
    queryKey: ['creator-patterns', pid],
    queryFn: () => api.creator.patterns(pid),
  })

  const byDay = useMemo(() => {
    const map = new Map<string, any[]>()
    for (const entry of (data?.calendar || []) as any[]) {
      if (!entry.date) continue
      const key = isoDay(parseISO(entry.date))
      const list = map.get(key)
      if (list) list.push(entry)
      else map.set(key, [entry])
    }
    return map
  }, [data])

  const days = useMemo(() => {
    const start = gridStart(cursor.year, cursor.month)
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [cursor])

  if (isLoading) {
    return <div className="p-6 space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-96 w-full" /></div>
  }

  const cadence = data?.cadence
  const totals = data?.totals || { views: 0, likes: 0, subs: 0 }
  const monthLabel = new Date(cursor.year, cursor.month, 1)
    .toLocaleDateString(gs, { month: 'long', year: 'numeric' })

  return (
    <div className="p-6 max-w-[1200px]">
      <PageHeader
        title={tt(T.titel)}
        subtitle={tt(T.untertitel).replace('{n}', String(data?.video_count ?? 0)).replace('{p}', String(data?.published_count ?? 0)).replace('{g}', String(data?.planned_count ?? 0))}
      />

      <YouTubeConnection projectId={pid} />

      <div data-einfuehrung="kennzahlen" className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat icon={Eye} label={tt(T.aufrufe)} value={totals.views.toLocaleString(gs)} />
        <Stat icon={Heart} label={tt(T.likes)} value={totals.likes.toLocaleString(gs)} />
        <Stat icon={UserPlus} label={tt(T.abos)} value={totals.subs.toLocaleString(gs)} />
        <Stat
          icon={Banknote}
          label={tt(T.sponsoring)}
          value={((data?.sponsor_fee_cents ?? 0) / 100).toLocaleString(gs, { style: 'currency', currency: 'EUR' })}
        />
      </div>

      {cadence?.notes?.length > 0 && (
        <div className="mb-6 p-3.5 rounded-lg border border-border/50 bg-muted/20">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">{tt(T.rhythmus)}</div>
          {cadence.notes.map((n: string, i: number) => (
            <div key={i} className="text-sm text-muted-foreground">{n}</div>
          ))}
        </div>
      )}

      {(patterns?.notes || []).length > 0 && (
        <div className="mb-6 p-3.5 rounded-lg border border-border/50 bg-muted/20">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">
            {tt(T.muster)}
          </div>
          {patterns.notes.map((n: string, i: number) => (
            <div key={i} className="text-sm text-muted-foreground">{n}</div>
          ))}
        </div>
      )}

      {/* Monatskalender */}
      <div data-einfuehrung="kalender" className="flex items-center gap-2 mb-3">
        <CalendarDays className="w-4 h-4 text-muted-foreground" />
        <span className="font-medium">{monthLabel}</span>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
          aria-label={tt(T.vorherigerMonat)} title={tt(T.vorherigerMonat)}
          onClick={() => setCursor(c => (c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 }))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs"
          onClick={() => setCursor({ year: today.getFullYear(), month: today.getMonth() })}>
          {tt(T.heute)}
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
          aria-label={tt(T.naechsterMonat)} title={tt(T.naechsterMonat)}
          onClick={() => setCursor(c => (c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 }))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border/40 rounded-lg overflow-hidden border border-border/40">
        {WOCHENTAGE.map(d => (
          <div key={d.de} className="bg-card px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/70">{tt(d)}</div>
        ))}
        {days.map(d => {
          const entries = byDay.get(isoDay(d)) || []
          const otherMonth = d.getMonth() !== cursor.month
          const isToday = isoDay(d) === isoDay(today)
          return (
            <div
              key={d.toISOString()}
              className={cn('bg-card min-h-[84px] p-1.5', otherMonth && 'opacity-35')}
            >
              <div className={cn(
                'text-[11px] mb-1 w-5 h-5 flex items-center justify-center rounded',
                isToday ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground'
              )}>
                {d.getDate()}
              </div>
              {entries.map(e => (
                <button
                  key={e.id}
                  onClick={() => navigate(`/projects/${pid}/creator/${e.id}`)}
                  title={`${e.title} - ${STATUS_TEXT[e.status] ? tt(STATUS_TEXT[e.status]) : e.status}${e.published ? tt(T.veroeffentlicht) : ''}`}
                  className="w-full flex items-center gap-1 px-1 py-0.5 mb-0.5 rounded text-left text-[10px] hover:bg-muted/60 transition-colors"
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', STATUS_DOT[e.status] || 'bg-muted-foreground')} />
                  <span className="truncate">{e.title || tt(T.unbenannt)}</span>
                </button>
              ))}
            </div>
          )
        })}
      </div>

      <p className="mt-3 text-xs text-muted-foreground/70">
        {tt(T.fusszeile)}
      </p>
    </div>
  )
}
