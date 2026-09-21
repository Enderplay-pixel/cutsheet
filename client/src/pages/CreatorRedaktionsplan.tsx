import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { CalendarClock } from 'lucide-react'
import {
  BereichKopf, Kennzahlen, BereichLaden, NichtsDa, VideoLink, Marke, BereichTabelle,
} from '@/components/creator/BereichLayout'

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

function monatsName(key: string): string {
  const [jahr, monat] = key.split('-')
  const i = Number(monat) - 1
  return MONATE[i] ? `${MONATE[i]} ${jahr}` : key
}

function tag(datum: string | null): string {
  if (!datum) return '—'
  const [j, m, t] = datum.split('-')
  return `${t}.${m}.${j}`
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
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
        titel="Redaktionsplan"
        untertitel="Was wann rausgeht - über alle Videos des Kanals"
      />

      <Kennzahlen werte={[
        { label: 'Im Plan', wert: data?.eintraege?.length ?? 0 },
        { label: 'Überfällig', wert: data?.ueberfaellig ?? 0, warnung: true,
          hinweis: 'geplantes Datum vorbei, noch nicht draußen' },
        { label: 'Ohne Datum', wert: data?.ohne_datum ?? 0,
          hinweis: 'taucht im Plan nicht auf' },
      ]} />

      {monate.length === 0 ? (
        <NichtsDa
          symbol={CalendarClock}
          titel="Noch nichts terminiert"
          text="Sobald ein Video ein Veröffentlichungsdatum hat, erscheint es hier - nach Monat sortiert, mit allem was überfällig ist."
        />
      ) : (
        monate.map((m: any) => (
          <div key={m.monat} className="mb-8">
            <p className="section-label mb-3">{monatsName(m.monat)}</p>
            <BereichTabelle
              minBreite={600}
              kopf={<tr><th>Datum</th><th>Video</th><th>Serie</th><th>Plattform</th><th>Status</th></tr>}
            >
              {m.videos.map((v: any) => (
                <tr key={v.id} className={v.ueberfaellig ? 'bg-danger/5' : undefined}>
                  <td className="tabular-nums whitespace-nowrap">{tag(v.datum)}</td>
                  <td><VideoLink projectId={pid} videoId={v.id}>{v.titel}</VideoLink></td>
                  <td className="text-muted-foreground">{v.serie || '—'}</td>
                  <td className="text-muted-foreground">{v.plattform || '—'}</td>
                  <td>
                    {v.veroeffentlicht
                      ? <Marke text="veröffentlicht" ton="gut" />
                      : v.ueberfaellig
                        ? <Marke text="überfällig" ton="gefahr" />
                        : <Marke text={v.status || 'geplant'} />}
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
