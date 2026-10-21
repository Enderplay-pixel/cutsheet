import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Activity, Film, Users, Briefcase, DollarSign, Camera, Map, Package, Music, Clapperboard } from 'lucide-react'
import { useT, useGebietsschema } from '@/lib/useT'
import type { Lang } from '@/lib/i18n'
import { activityFeedT as T } from '@/lib/texte/ActivityFeed'

type Tt = (map: Record<Lang, string>) => string

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

function formatRelativeTime(ts: string, tt: Tt): string {
  const now = Date.now()
  const then = new Date(ts).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return tt(T.geradeEben)
  if (diff < 3600) return tt(T.vorMin).replace('{n}', String(Math.floor(diff / 60)))
  if (diff < 86400) return tt(T.vorStd).replace('{n}', String(Math.floor(diff / 3600)))
  if (diff < 172800) return tt(T.gesternKlein)
  return tt(T.vorTagen).replace('{n}', String(Math.floor(diff / 86400)))
}

function formatDateHeader(ts: string, tt: Tt, gebietsschema: string): string {
  const d = new Date(ts)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const itemDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (itemDay.getTime() === today.getTime()) return tt(T.heute)
  if (itemDay.getTime() === yesterday.getTime()) return tt(T.gestern)
  return d.toLocaleDateString(gebietsschema, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function getDateKey(ts: string): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

const ENTITY_CONFIG: Record<string, { label: Record<Lang, string>; icon: any; color: string }> = {
  scenes:     { label: T.szenen,    icon: Film,        color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  cast:       { label: T.cast,      icon: Users,       color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  crew:       { label: T.stab,      icon: Briefcase,   color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  budget:     { label: T.budget,    icon: DollarSign,  color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  shoot_days: { label: T.drehtage, icon: Clapperboard, color: 'bg-red-500/10 text-red-600 border-red-500/20' },
  locations:  { label: T.motive,   icon: Map,          color: 'bg-teal-500/10 text-teal-600 border-teal-500/20' },
  equipment:  { label: T.equipment, icon: Package,     color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  music:      { label: T.musik,    icon: Music,        color: 'bg-pink-500/10 text-pink-600 border-pink-500/20' },
  shots:      { label: T.shotlist, icon: Camera,       color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' },
}

const FILTER_OPTIONS = [
  { value: 'all',        label: T.alle },
  { value: 'scenes',     label: T.szenen },
  { value: 'cast',       label: T.cast },
  { value: 'crew',       label: T.stab },
  { value: 'budget',     label: T.budget },
  { value: 'shoot_days', label: T.drehtage },
  { value: 'locations',  label: T.motive },
  { value: 'equipment',  label: T.equipment },
  { value: 'shots',      label: T.shotlist },
]

function ActivityItem({ item }: { item: any }) {
  const tt = useT()
  const config = ENTITY_CONFIG[item.entity_type] || {
    label: { de: item.entity_type, en: item.entity_type, fr: item.entity_type },
    icon: Activity,
    color: 'bg-muted text-muted-foreground border-border',
  }
  const Icon = config.icon
  const initials = (item.user_name || item.actor_name || '?')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="rounded-xl border border-border/40 bg-card p-4 hover:border-border/70 transition-colors flex items-start gap-3.5">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-semibold text-primary shrink-0 mt-0.5">
        {initials}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold leading-snug">
            {item.user_name || tt(T.system)}
          </span>
          <span className="text-sm text-muted-foreground leading-snug">
            {item.description || item.action || item.entity_type}
          </span>
          <Badge
            variant="outline"
            className={`text-[10px] h-4 px-1.5 border font-semibold ${config.color}`}
          >
            <Icon className="w-2.5 h-2.5 mr-1" />
            {tt(config.label)}
          </Badge>
        </div>
        <div className="text-[11px] text-muted-foreground/60 mt-1">
          {formatRelativeTime(item.created_at, tt)}
        </div>
      </div>
    </div>
  )
}

export function Component() {
  const { projectId: id } = useParams<{ projectId: string }>()
  const pid = Number(id)
  const [filter, setFilter] = useState('all')
  const tt = useT()
  const gebietsschema = useGebietsschema()

  const { data: activities, isLoading } = useQuery({
    queryKey: ['activity', pid],
    queryFn: () => req<any[]>(`/projects/${pid}/activity?limit=100`),
    refetchInterval: 30000,
  })

  const filtered = (activities || []).filter(
    (a: any) => filter === 'all' || a.entity_type === filter
  )

  // Group by date
  const groups: { dateKey: string; label: string; items: any[] }[] = []
  const seenKeys = new Set<string>()
  filtered.forEach((item: any) => {
    const key = getDateKey(item.created_at)
    if (!seenKeys.has(key)) {
      seenKeys.add(key)
      groups.push({ dateKey: key, label: formatDateHeader(item.created_at, tt, gebietsschema), items: [] })
    }
    groups[groups.length - 1].items.push(item)
  })

  return (
    <div className="px-5 py-6 sm:p-7 max-w-6xl mx-auto animate-fade-up">
      {/* Page hero */}
      <div className="mb-8 pb-7 border-b border-border/40 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] sm:text-[34px]">
            {tt(T.titel)}
          </h1>
          <p className="text-sm text-muted-foreground/60 mt-1.5">
            {tt(T.untertitel)}
          </p>
        </div>

        {/* Filter */}
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40 h-8 text-sm shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTER_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value} className="text-sm">
                {tt(o.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="space-y-2.5">
          {[1, 2, 3, 4, 5].map(i => (
            <div
              key={i}
              className="rounded-xl border border-border/40 bg-card p-4 flex items-start gap-3.5"
            >
              <Skeleton className="w-8 h-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Activity className="w-10 h-10 mb-3 opacity-20" />
          <p className="text-sm text-muted-foreground/60">
            {tt(T.leer)}
          </p>
        </div>
      ) : (
        /* Timeline grouped by date */
        <div className="space-y-8">
          {groups.map(group => (
            <div key={group.dateKey}>
              {/* Date group header */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40">
                  {group.label}
                </span>
                <div className="flex-1 h-px bg-border/40" />
              </div>

              {/* Activity items */}
              <div className="space-y-2">
                {group.items.map((item: any, i: number) => (
                  <ActivityItem key={item.id ?? i} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
