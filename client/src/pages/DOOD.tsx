import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Download } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface DoodDay {
  shoot_day_id: number
  day_number: number
  date: string
}

interface DoodEntry {
  status: string // W | H | SW | F | SWF | ''
}

interface DoodCastRow {
  cast_id: number
  name: string
  character: string
  daily_rate_cents: number
  days: Record<number, DoodEntry> // keyed by shoot_day_id
  total_work: number
  total_hold: number
  estimated_cost_cents: number
}

interface DoodReport {
  shoot_days: DoodDay[]
  cast: DoodCastRow[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  W:   'bg-green-500/20 text-green-700 dark:text-green-300 font-semibold',
  H:   'bg-yellow-400/20 text-yellow-700 dark:text-yellow-300 font-semibold',
  SW:  'bg-blue-500/20 text-blue-700 dark:text-blue-300 font-semibold',
  F:   'bg-muted text-muted-foreground',
  SWF: 'bg-purple-500/20 text-purple-700 dark:text-purple-300 font-semibold',
}

function statusCell(status: string) {
  const cls = STATUS_STYLES[status] ?? ''
  return (
    <div className={`w-full h-full flex items-center justify-center text-xs rounded ${cls}`}>
      {status || '–'}
    </div>
  )
}

function formatDate(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function downloadCSV(report: DoodReport, pid: number) {
  const days = report.shoot_days
  const header = ['Name', 'Figur', ...days.map(d => `DT${d.day_number} (${formatDate(d.date)})`), 'Arbeitstage', 'Haltetage', 'Kosten (est.)']
  const rows = report.cast.map(c => [
    c.name,
    c.character,
    ...days.map(d => c.days[d.shoot_day_id]?.status ?? ''),
    String(c.total_work),
    String(c.total_hold),
    formatCurrency(c.estimated_cost_cents),
  ])
  const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `dood-projekt-${pid}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Component ───────────────────────────────────────────────────────────────

export function Component() {
  const { projectId: id } = useParams<{ projectId: string }>()
  const pid = Number(id)
  const { toast } = useToast()

  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const { data: report, isLoading, isError } = useQuery<DoodReport>({
    queryKey: ['dood-report', pid],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${pid}/dood-report`, { headers })
      if (!res.ok) throw new Error('Fehler beim Laden')
      return res.json()
    },
  })

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Day Out of Days</h1>
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (isError || !report) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">Day Out of Days</h1>
        <p className="text-destructive">Fehler beim Laden des Berichts.</p>
      </div>
    )
  }

  const days = report.shoot_days ?? []
  const cast = report.cast ?? []

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Day Out of Days</h1>
        <Button variant="outline" size="sm" onClick={() => downloadCSV(report, pid)}>
          <Download className="mr-2 h-4 w-4" />
          CSV exportieren
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries(STATUS_STYLES).map(([k, cls]) => (
          <span key={k} className={`px-2 py-0.5 rounded ${cls}`}>{k}</span>
        ))}
        <span className="text-muted-foreground ml-2">W = Arbeit · H = Haltetag · SW = Start/Wrap · F = Frei · SWF = Start+Wrap+Frei</span>
      </div>

      {/* Table */}
      {cast.length === 0 ? (
        <p className="text-muted-foreground">Keine Darsteller gefunden.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="sticky left-0 z-10 bg-muted/80 backdrop-blur px-3 py-2 text-left font-semibold min-w-[160px]">
                  Darsteller
                </th>
                {days.map(d => (
                  <th key={d.shoot_day_id} className="px-2 py-2 text-center font-medium min-w-[52px]">
                    <div className="text-xs font-bold">DT{d.day_number}</div>
                    <div className="text-[10px] text-muted-foreground">{formatDate(d.date)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cast.map((c, i) => (
                <tr key={c.cast_id} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                  <td className="sticky left-0 z-10 bg-inherit px-3 py-1.5 font-medium border-r border-border">
                    <div>{c.name}</div>
                    {c.character && <div className="text-xs text-muted-foreground">{c.character}</div>}
                  </td>
                  {days.map(d => {
                    const status = c.days[d.shoot_day_id]?.status ?? ''
                    return (
                      <td key={d.shoot_day_id} className="px-1 py-1 text-center">
                        <div className="h-7 w-full">{statusCell(status)}</div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary */}
      {cast.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Zusammenfassung</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-3 py-2 text-left">Darsteller</th>
                  <th className="px-3 py-2 text-center">Arbeitstage</th>
                  <th className="px-3 py-2 text-center">Haltetage</th>
                  <th className="px-3 py-2 text-right">Kosten (est.)</th>
                </tr>
              </thead>
              <tbody>
                {cast.map((c, i) => (
                  <tr key={c.cast_id} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                    <td className="px-3 py-2 font-medium">{c.name}</td>
                    <td className="px-3 py-2 text-center">
                      <Badge variant="green">{c.total_work}</Badge>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Badge variant="amber">{c.total_hold}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatCurrency(c.estimated_cost_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
