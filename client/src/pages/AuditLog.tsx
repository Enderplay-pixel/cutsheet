import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import { History } from 'lucide-react'

function formatTimestamp(ts: string) {
  if (!ts) return '—'
  try {
    const d = new Date(ts)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  } catch {
    return ts
  }
}

function ActionBadge({ action }: { action: string }) {
  const lower = (action || '').toLowerCase()
  let cls = 'bg-muted text-muted-foreground'
  if (lower.includes('create') || lower.includes('add') || lower.includes('insert')) {
    cls = 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
  } else if (lower.includes('delete') || lower.includes('remove')) {
    cls = 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
  } else if (lower.includes('update') || lower.includes('edit') || lower.includes('change')) {
    cls = 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {action}
    </span>
  )
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['audit', pid],
    queryFn: () => api.audit.list(pid),
  })

  // Newest first
  const sorted = [...entries].sort((a: any, b: any) => {
    return new Date(b.created_at || b.timestamp || 0).getTime() -
           new Date(a.created_at || a.timestamp || 0).getTime()
  })

  return (
    <div className="px-5 py-6 sm:p-7 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <History className="w-5 h-5 text-muted-foreground" />
        <div>
          <h1 className="font-display text-[28px] sm:text-[34px]">Audit-Log</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? 'Lade…' : `${entries.length} Einträge`}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Zeitpunkt</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Benutzer</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aktion</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entität</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Details</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [1,2,3,4,5].map(i => (
                  <tr key={i} className="border-b border-border/40">
                    {[1,2,3,4,5].map(j => (
                      <td key={j} className="py-3 px-4">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-muted-foreground text-sm">
                    Keine Audit-Einträge vorhanden.
                  </td>
                </tr>
              ) : (
                sorted.map((entry: any, idx: number) => (
                  <tr key={entry.id ?? idx} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-4 text-xs text-muted-foreground font-mono whitespace-nowrap">
                      {formatTimestamp(entry.created_at || entry.timestamp || '')}
                    </td>
                    <td className="py-2.5 px-4 text-sm">
                      {entry.user_name || entry.user?.name || entry.user_email || entry.user?.email || '—'}
                    </td>
                    <td className="py-2.5 px-4">
                      <ActionBadge action={entry.action || entry.event_type || '—'} />
                    </td>
                    <td className="py-2.5 px-4 text-sm text-muted-foreground">
                      {entry.entity_type || entry.table_name || entry.resource || '—'}
                      {(entry.entity_id || entry.record_id) && (
                        <span className="text-xs text-muted-foreground/60 ml-1">
                          #{entry.entity_id || entry.record_id}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-muted-foreground max-w-sm truncate">
                      {entry.details
                        ? (typeof entry.details === 'string'
                          ? entry.details
                          : JSON.stringify(entry.details))
                        : entry.description || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
