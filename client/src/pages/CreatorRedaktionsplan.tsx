import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { CalendarClock } from 'lucide-react'
import {
  BereichKopf, Kennzahlen, BereichLaden, NichtsDa, VideoLink, Marke, BereichTabelle,
} from '@/components/creator/BereichLayout'
import { useT, useGebietsschema } from '@/lib/useT'
import { creatorRedaktionsplanT as rt } from '@/lib/texte/CreatorRedaktionsplan'

function monatsName(key: string, gebietsschema: string): string {
  const [jahr, monat] = key.split('-')
  const i = Number(monat) - 1
  if (!(i >= 0 && i < 12)) return key
  return new Date(Number(jahr), i, 1).toLocaleDateString(gebietsschema, { month: 'long', year: 'numeric' })
}

// In der gewählten Sprache - vorher fest "TT.MM.JJJJ"
function tag(datum: string | null): string {
  return datum ? formatDate(datum) : '-'
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const tt = useT()
  const gs = useGebietsschema()
  const { data, isLoading } = useQuery({
    queryKey: ['creator-redaktionsplan', pid],
    queryFn: () => api.creator.redaktionsplan(pid),
  })

  if (isLoading) return <BereichLaden />

  const monate = data?.monate ?? []

  return (
    <div className="page-container animate-fade-up">
      <BereichKopf
        symbol={CalendarClock}
        titel={tt(rt.titel)}
        untertitel={tt(rt.untertitel)}
      />

      <Kennzahlen werte={[
        { label: tt(rt.imPlan), wert: data?.eintraege?.length ?? 0 },
        { label: tt(rt.ueberfaellig), wert: data?.ueberfaellig ?? 0, warnung: true,
          hinweis: tt(rt.ueberfaelligHinweis) },
        { label: tt(rt.ohneDatum), wert: data?.ohne_datum ?? 0,
          hinweis: tt(rt.ohneDatumHinweis) },
      ]} />

      {monate.length === 0 ? (
        <NichtsDa
          symbol={CalendarClock}
          titel={tt(rt.nichtsTerminiert)}
          text={tt(rt.nichtsTerminiertText)}
        />
      ) : (
        monate.map((m: any) => (
          <div key={m.monat} className="mb-8">
            <p className="section-label mb-3">{monatsName(m.monat, gs)}</p>
            <BereichTabelle
              minBreite={600}
              kopf={<tr><th>{tt(rt.datum)}</th><th>{tt(rt.video)}</th><th>{tt(rt.serie)}</th><th>{tt(rt.plattform)}</th><th>{tt(rt.status)}</th></tr>}
            >
              {m.videos.map((v: any) => (
                <tr key={v.id} className={v.ueberfaellig ? 'bg-danger/5' : undefined}>
                  <td className="tabular-nums whitespace-nowrap">{tag(v.datum)}</td>
                  <td><VideoLink projectId={pid} videoId={v.id}>{v.titel}</VideoLink></td>
                  <td className="text-muted-foreground">{v.serie || '-'}</td>
                  <td className="text-muted-foreground">{v.plattform || '-'}</td>
                  <td>
                    {v.veroeffentlicht
                      ? <Marke text={tt(rt.markeVeroeffentlicht)} ton="gut" />
                      : v.ueberfaellig
                        ? <Marke text={tt(rt.markeUeberfaellig)} ton="gefahr" />
                        : <Marke text={v.status || tt(rt.markeGeplant)} />}
                  </td>
                </tr>
              ))}
            </BereichTabelle>
          </div>
        ))
      )}
    </div>
  )
}
