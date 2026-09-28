import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Type } from 'lucide-react'
import {
  BereichKopf, Kennzahlen, BereichLaden, NichtsDa, VideoLink, Marke,
} from '@/components/creator/BereichLayout'

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
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
        titel="Titel & Thumbnails"
        untertitel="Alle Varianten nebeneinander – Titel und Thumbnail entscheiden über die Klickrate"
      />

      <Kennzahlen werte={[
        { label: 'Videos', wert: liste.length },
        { label: 'Titelvarianten', wert: data?.varianten_gesamt ?? 0 },
        { label: 'Ohne Vergleich', wert: data?.ohne_vergleich ?? 0, warnung: true,
          hinweis: 'weniger als zwei Varianten' },
      ]} />

      {liste.length === 0 ? (
        <NichtsDa
          symbol={Type}
          titel="Noch keine Videos"
          text="Titelvarianten und Thumbnail-Ideen werden beim Video gepflegt. Hier stehen sie über den ganzen Kanal nebeneinander."
        />
      ) : (
        <div className="space-y-3">
          {liste.map((e: any) => (
            <div key={e.id} className="stat-card">
              <div className="flex items-start justify-between gap-3 mb-3">
                <VideoLink projectId={pid} videoId={e.id}>{e.video}</VideoLink>
                {e.kein_vergleich
                  ? <Marke text="kein Vergleich möglich" ton="warnung" />
                  : <Marke text={`${e.titelvarianten.length} Titel · ${e.thumbnail_ideen.length} Thumbnails`} ton="gut" />}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="section-label mb-2">Titelvarianten</p>
                  {e.titelvarianten.length === 0 ? (
                    <p className="text-[13px] text-muted-foreground">noch keine</p>
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
                  <p className="section-label mb-2">Thumbnail-Ideen</p>
                  {e.thumbnail_ideen.length === 0 ? (
                    <p className="text-[13px] text-muted-foreground">noch keine</p>
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
