/**
 * Übersicht aller Dispos (Plan Kino-Ausbau, AP E7, Soll 6): je Drehtag
 * Call, geplanter Drehschluss, Szenen, Vorstopp (AP E5) und der Stand von
 * Versand und Bestätigungen. Ein Klick öffnet die Tagesdispo.
 */
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList } from 'lucide-react'
import { api } from '@/lib/api'
import { useT } from '@/lib/useT'
import { fahrT } from '@/lib/texte/Fahrdispo'
import { formatDate, formatTime, eighthsToString } from '@/lib/utils'
import { zeitText } from '@/lib/vorstopp'
import { Skeleton } from '@/components/ui/skeleton'

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const tt = useT()
  const { data: tage, isLoading } = useQuery<any[]>({ queryKey: ['dispos', pid], queryFn: () => api.callSheets.uebersicht(pid), enabled: pid > 0 })

  return (
    <div className="px-5 py-6 sm:p-7 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <ClipboardList className="w-5 h-5 text-primary" aria-hidden="true" />
        <h1 className="font-display text-[28px] sm:text-[34px]">{tt(fahrT.uebersicht)}</h1>
      </div>
      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/60 bg-card">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-border/40 bg-muted/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pl-4 pr-2">{tt(fahrT.spalteTag)}</th>
                <th className="py-2 px-2">{tt(fahrT.spalteCall)}</th>
                <th className="py-2 px-2">{tt(fahrT.spalteSchluss)}</th>
                <th className="py-2 px-2">{tt(fahrT.spalteSzenen)}</th>
                <th className="py-2 px-2">{tt(fahrT.spalteVorstopp)}</th>
                <th className="py-2 pr-4 pl-2">{tt(fahrT.spalteStand)}</th>
              </tr>
            </thead>
            <tbody>
              {(tage ?? []).map((t) => (
                <tr key={t.id} className="border-b border-border/20 last:border-0 hover:bg-muted/10">
                  <td className="py-2.5 pl-4 pr-2 whitespace-nowrap">
                    <Link to={`/projects/${pid}/tagesdispo/${t.id}`} className="font-semibold hover:text-primary">
                      {tt(fahrT.spalteTag)} {t.day_number}
                    </Link>
                    <span className="ml-2 text-xs text-muted-foreground">{t.date ? formatDate(t.date) : ''}</span>
                  </td>
                  <td className="py-2.5 px-2 font-mono">{t.dispo_id ? formatTime(t.general_call) : <span className="text-muted-foreground">{tt(fahrT.keineDispo)}</span>}</td>
                  <td className="py-2.5 px-2 font-mono">{t.planned_wrap != null ? formatTime(t.planned_wrap) : '-'}</td>
                  <td className="py-2.5 px-2">
                    {t.szenen.length > 0 ? `${t.szenen.join(', ')} · ${eighthsToString(t.achtel)}` : '-'}
                  </td>
                  <td className="py-2.5 px-2 font-mono">{t.vorstopp?.sekunden ? zeitText(t.vorstopp.sekunden) : '-'}</td>
                  <td className="py-2.5 pr-4 pl-2 text-xs">
                    {t.dispo_id ? tt(fahrT.stand).replace('{v}', String(t.verschickt)).replace('{n}', String(t.personen)).replace('{b}', String(t.bestaetigt)) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
