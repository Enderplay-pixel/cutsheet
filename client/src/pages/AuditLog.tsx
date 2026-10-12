import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useDownload } from '@/lib/useDownload'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { History, Download, Search, X } from 'lucide-react'

/** Wie viele Zeilen eine Seite zeigt. */
const SEITE = 100

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
  if (lower.includes('create') || lower.includes('add') || lower.includes('insert') || lower.includes('angelegt')) {
    cls = 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
  } else if (lower.includes('delete') || lower.includes('remove') || lower.includes('gelöscht')) {
    cls = 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
  } else if (lower.includes('update') || lower.includes('edit') || lower.includes('change') || lower.includes('geändert')) {
    cls = 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {action}
    </span>
  )
}

/** Die Suchangaben - alle freiwillig, alle mit UND verknüpft. */
type Filter = {
  suche: string
  nutzer: string
  aktion: string
  bereich: string
  von: string
  bis: string
}

const LEER: Filter = { suche: '', nutzer: '', aktion: '', bereich: '', von: '', bis: '' }

/** Macht aus den Suchangaben eine Abfragezeichenkette - leere Felder fallen weg. */
function alsAbfrage(filter: Filter, extra: Record<string, string | number> = {}): string {
  const p = new URLSearchParams()
  for (const [schlüssel, wert] of Object.entries({ ...filter, ...extra })) {
    if (wert !== '' && wert !== undefined && wert !== null) p.set(schlüssel, String(wert))
  }
  const text = p.toString()
  return text ? `?${text}` : ''
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const download = useDownload()

  // `entwurf` ist, was in den Feldern steht, `filter` ist, wonach gesucht
  // wird. Ohne die Trennung würde jeder Tastendruck eine Abfrage auslösen.
  const [entwurf, setEntwurf] = useState<Filter>(LEER)
  const [filter, setFilter] = useState<Filter>(LEER)
  const [seite, setSeite] = useState(0)

  const { data: antwort, isLoading } = useQuery({
    queryKey: ['audit', pid, filter, seite],
    queryFn: () => api.audit.list(pid, alsAbfrage(filter, { grenze: SEITE, sprung: seite * SEITE })),
  })

  const { data: werte } = useQuery({
    queryKey: ['audit-werte', pid],
    queryFn: () => api.audit.werte(pid),
  })

  const entries: any[] = antwort?.data ?? []
  const gesamt: number = antwort?.meta?.gesamt ?? entries.length
  const gefiltert = Object.values(filter).some((w) => w !== '')

  const suchen = () => { setFilter(entwurf); setSeite(0) }
  const zurücksetzen = () => { setEntwurf(LEER); setFilter(LEER); setSeite(0) }

  const feld = (schlüssel: keyof Filter) => ({
    value: entwurf[schlüssel],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setEntwurf((v) => ({ ...v, [schlüssel]: e.target.value })),
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter') suchen() },
  })

  /**
   * Die Vorschlagsliste eines Feldes.
   *
   * Was im Protokoll vorkommt, hängt davon ab, was im Projekt getan wurde -
   * eine feste Liste wäre entweder zu lang oder falsch.
   */
  const liste = (id: string, vorschläge: string[] | undefined) =>
    vorschläge && vorschläge.length > 0 ? (
      <datalist id={id}>
        {vorschläge.map((v) => <option key={v} value={v} />)}
      </datalist>
    ) : null

  return (
    <div className="px-5 py-6 sm:p-7 max-w-6xl mx-auto">
      {/* Kopf */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <History className="w-5 h-5 text-muted-foreground" />
          <div>
            <h1 className="font-display text-[28px] sm:text-[34px]">Protokoll</h1>
            <p className="text-sm text-muted-foreground">
              {isLoading
                ? 'Lade…'
                : gefiltert
                  ? `${gesamt.toLocaleString('de-DE')} Treffer`
                  : `${gesamt.toLocaleString('de-DE')} Einträge`}
              {werte?.erste && !gefiltert && (
                <span className="text-muted-foreground/70">
                  {' '}· seit {formatTimestamp(werte.erste).slice(0, 10)}
                </span>
              )}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => download(api.audit.csvUrl(pid, alsAbfrage(filter)), `protokoll-${pid}.csv`)}
          disabled={gesamt === 0}
        >
          <Download className="w-4 h-4 mr-1.5" />
          {gefiltert ? 'Treffer als CSV' : 'Als CSV'}
        </Button>
      </div>

      {/* Suche */}
      <div className="bg-card border border-border/60 rounded-xl p-4 mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor="protokoll-suche">Volltext</Label>
            <Input id="protokoll-suche" placeholder="Name, Aktion, Inhalt…" {...feld('suche')} />
          </div>
          <div>
            <Label htmlFor="protokoll-nutzer">Benutzer</Label>
            <Input id="protokoll-nutzer" list="protokoll-nutzer-liste" placeholder="alle" {...feld('nutzer')} />
            {liste('protokoll-nutzer-liste', werte?.nutzer)}
          </div>
          <div>
            <Label htmlFor="protokoll-aktion">Aktion</Label>
            <Input id="protokoll-aktion" list="protokoll-aktion-liste" placeholder="alle" {...feld('aktion')} />
            {liste('protokoll-aktion-liste', werte?.aktionen)}
          </div>
          <div>
            <Label htmlFor="protokoll-bereich">Bereich</Label>
            <Input id="protokoll-bereich" list="protokoll-bereich-liste" placeholder="alle" {...feld('bereich')} />
            {liste('protokoll-bereich-liste', werte?.bereiche)}
          </div>
          <div>
            <Label htmlFor="protokoll-von">Von</Label>
            <Input id="protokoll-von" type="date" {...feld('von')} />
          </div>
          <div>
            <Label htmlFor="protokoll-bis">Bis</Label>
            <Input id="protokoll-bis" type="date" {...feld('bis')} />
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Button size="sm" onClick={suchen}>
            <Search className="w-4 h-4 mr-1.5" />
            Suchen
          </Button>
          {gefiltert && (
            <Button size="sm" variant="ghost" onClick={zurücksetzen}>
              <X className="w-4 h-4 mr-1.5" />
              Filter löschen
            </Button>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            Tage werden in deutscher Zeit abgegrenzt
          </span>
        </div>
      </div>

      {/* Tabelle */}
      <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Zeitpunkt</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Benutzer</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aktion</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bereich</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Details</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i} className="border-b border-border/40">
                    {[1, 2, 3, 4, 5].map(j => (
                      <td key={j} className="py-3 px-4">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-muted-foreground text-sm">
                    {gefiltert
                      ? 'Keine Einträge zu dieser Suche. Weniger Filter setzen oder den Zeitraum weiten.'
                      : 'Noch keine Einträge. Hier erscheint jede Änderung mit Zeitpunkt und Benutzer.'}
                  </td>
                </tr>
              ) : (
                entries.map((entry: any, idx: number) => (
                  <tr key={entry.id ?? idx} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-4 text-xs text-muted-foreground font-mono whitespace-nowrap">
                      {formatTimestamp(entry.created_at || entry.timestamp || '')}
                    </td>
                    <td className="py-2.5 px-4 text-sm">
                      {entry.user_name || entry.user?.name || entry.user_email || '—'}
                    </td>
                    <td className="py-2.5 px-4">
                      <ActionBadge action={entry.action || entry.event_type || '—'} />
                    </td>
                    <td className="py-2.5 px-4 text-sm text-muted-foreground">
                      {entry.entity_type || entry.table_name || '—'}
                      {entry.entity_id && (
                        <span className="text-xs text-muted-foreground/60 ml-1">#{entry.entity_id}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-muted-foreground max-w-sm truncate" title={entry.details || ''}>
                      {entry.details || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Blättern - nur wenn es etwas zu blättern gibt */}
      {gesamt > SEITE && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-muted-foreground">
            {(seite * SEITE + 1).toLocaleString('de-DE')}–
            {Math.min(gesamt, seite * SEITE + entries.length).toLocaleString('de-DE')} von{' '}
            {gesamt.toLocaleString('de-DE')}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={seite === 0} onClick={() => setSeite(s => s - 1)}>
              Zurück
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={(seite + 1) * SEITE >= gesamt}
              onClick={() => setSeite(s => s + 1)}
            >
              Weiter
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
