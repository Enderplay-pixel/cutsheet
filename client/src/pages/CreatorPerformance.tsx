import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn, formatDate } from '@/lib/utils'
import { TrendingUp } from 'lucide-react'
import {
  BereichKopf, Kennzahlen, BereichLaden, NichtsDa, VideoLink, BereichTabelle,
} from '@/components/creator/BereichLayout'
import { useT, useGebietsschema } from '@/lib/useT'
import { creatorPerformanceT as pt } from '@/lib/texte/CreatorPerformance'

// Datum und Dezimalzeichen in der gewählten Sprache - vorher fest
// "TT.MM.JJJJ" und "4.2 %" auch im Deutschen
function tag(datum: string): string {
  return datum ? formatDate(datum) : '-'
}

function prozent(n: number | null, gebietsschema: string): string {
  return n === null ? '-' : `${n.toLocaleString(gebietsschema)} %`
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const tt = useT()
  const gs = useGebietsschema()
  const { data, isLoading } = useQuery({
    queryKey: ['creator-performance', pid],
    queryFn: () => api.creator.performance(pid),
  })

  if (isLoading) return <BereichLaden />

  const liste = data?.liste ?? []

  return (
    <div className="page-container animate-fade-up">
      <BereichKopf
        symbol={TrendingUp}
        titel={tt(pt.titel)}
        untertitel={tt(pt.untertitel)}
      />

      <Kennzahlen werte={[
        { label: tt(pt.veroeffentlicht), wert: data?.veroeffentlicht ?? 0 },
        { label: tt(pt.aufrufeGesamt), wert: (data?.aufrufe_gesamt ?? 0).toLocaleString(gs) },
        { label: tt(pt.klickrateSchnitt), wert: prozent(data?.ctr_schnitt ?? null, gs),
          hinweis: tt(pt.klickrateHinweis) },
        { label: tt(pt.haltequoteSchnitt), wert: prozent(data?.haltequote_schnitt ?? null, gs),
          hinweis: tt(pt.haltequoteHinweis) },
      ]} />

      {liste.length === 0 ? (
        <NichtsDa
          symbol={TrendingUp}
          titel={tt(pt.nichtsVeroeffentlicht)}
          text={tt(pt.nichtsVeroeffentlichtText)}
        />
      ) : (
        <BereichTabelle
          minBreite={800}
          kopf={<tr><th>{tt(pt.video)}</th><th>{tt(pt.serie)}</th><th>{tt(pt.datum)}</th><th className="text-right">{tt(pt.aufrufe)}</th><th className="text-right">{tt(pt.klickrate)}</th><th className="text-right">{tt(pt.haltequote)}</th><th className="text-right">{tt(pt.abos)}</th></tr>}
        >
          {liste.map((e: any) => (
            <tr key={e.id}>
              <td><VideoLink projectId={pid} videoId={e.id}>{e.video}</VideoLink></td>
              <td className="text-muted-foreground text-[12px]">{e.serie || '-'}</td>
              <td className="tabular-nums whitespace-nowrap">{tag(e.datum)}</td>
              <td className="text-right tabular-nums">{e.aufrufe.toLocaleString(gs)}</td>
              <td className={cn('text-right tabular-nums',
                e.ctr !== null && e.ctr < 2 && 'text-danger',
                e.ctr !== null && e.ctr > 10 && 'text-success')}>
                {prozent(e.ctr, gs)}
              </td>
              <td className={cn('text-right tabular-nums',
                e.haltequote !== null && e.haltequote < 30 && 'text-danger',
                e.haltequote !== null && e.haltequote >= 50 && 'text-success')}>
                {prozent(e.haltequote, gs)}
              </td>
              <td className="text-right tabular-nums">{e.abos || '-'}</td>
            </tr>
          ))}
        </BereichTabelle>
      )}

      {liste.some((e: any) => e.hinweise.length > 0) && (
        <div className="mt-8">
          <p className="section-label mb-3">{tt(pt.einordnung)}</p>
          <div className="space-y-3">
            {liste.filter((e: any) => e.hinweise.length).slice(0, 8).map((e: any) => (
              <div key={e.id} className="stat-card">
                <p className="font-semibold text-[13px] mb-1.5">{e.video}</p>
                <ul className="space-y-1">
                  {e.hinweise.map((h: string, i: number) => (
                    <li key={i} className="text-[12px] text-muted-foreground leading-snug">{h}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
