import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Type } from 'lucide-react'
import { useT } from '@/lib/useT'
import { creatorTitelT as T } from '@/lib/texte/CreatorTitel'
import {
  BereichKopf, Kennzahlen, BereichLaden, NichtsDa, VideoLink, Marke,
} from '@/components/creator/BereichLayout'

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const tt = useT()
  const { data, isLoading } = useQuery({
    queryKey: ['creator-titel', pid],
    queryFn: () => api.creator.titel(pid),
  })

  if (isLoading) return <BereichLaden />

  const liste = data?.liste ?? []

  return (
    <div className="page-container animate-fade-up">
      <BereichKopf
        symbol={Type}
        titel={tt(T.titel)}
        untertitel={tt(T.untertitel)}
      />

      <Kennzahlen werte={[
        { label: tt(T.videos), wert: liste.length },
        { label: tt(T.titelvarianten), wert: data?.varianten_gesamt ?? 0 },
        { label: tt(T.ohneVergleich), wert: data?.ohne_vergleich ?? 0, warnung: true,
          hinweis: tt(T.ohneVergleichHinweis) },
      ]} />

      {liste.length === 0 ? (
        <NichtsDa
          symbol={Type}
          titel={tt(T.leerTitel)}
          text={tt(T.leerText)}
        />
      ) : (
        <div className="space-y-3">
          {liste.map((e: any) => (
            <div key={e.id} className="stat-card">
              <div className="flex items-start justify-between gap-3 mb-3">
                <VideoLink projectId={pid} videoId={e.id}>{e.video}</VideoLink>
                {e.kein_vergleich
                  ? <Marke text={tt(T.keinVergleich)} ton="warnung" />
                  : <Marke text={tt(T.anzahl).replace('{t}', String(e.titelvarianten.length)).replace('{n}', String(e.thumbnail_ideen.length))} ton="gut" />}
              </div>
              <div data-einfuehrung="liste" className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="section-label mb-2">{tt(T.titelvarianten)}</p>
                  {e.titelvarianten.length === 0 ? (
                    <p className="text-[13px] text-muted-foreground">{tt(T.nochKeine)}</p>
                  ) : (
                    <ol className="space-y-1.5">
                      {e.titelvarianten.map((t: string, i: number) => (
                        <li key={i} className="text-[13px] leading-snug flex gap-2">
                          <span className="text-muted-foreground/50 tabular-nums shrink-0">{i + 1}</span>
                          <span className="flex-1">{t}</span>
                          <span className="text-muted-foreground/50 tabular-nums text-[11px] shrink-0">{t.length}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                <div>
                  <p className="section-label mb-2">{tt(T.thumbnailIdeen)}</p>
                  {e.thumbnail_ideen.length === 0 ? (
                    <p className="text-[13px] text-muted-foreground">{tt(T.nochKeine)}</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {e.thumbnail_ideen.map((t: string, i: number) => (
                        <li key={i} className="text-[13px] leading-snug text-muted-foreground">{t}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
