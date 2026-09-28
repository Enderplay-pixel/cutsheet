import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Search } from 'lucide-react'
import {
  BereichKopf, Kennzahlen, BereichLaden, NichtsDa, VideoLink, Marke, BereichTabelle,
} from '@/components/creator/BereichLayout'

/** Ab hier schneidet die YouTube-Suche den Titel in der Regel ab. */
const TITEL_MAX = 60

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const { data, isLoading } = useQuery({
    queryKey: ['creator-seo', pid],
    queryFn: () => api.creator.seo(pid),
  })

  if (isLoading) return <BereichLaden />

  const liste = data?.liste ?? []

  return (
    <div className="page-container animate-fade-up">
      <BereichKopf
        symbol={Search}
        titel="SEO & Metadaten"
        untertitel="Zielbegriff, Schlagworte, Beschreibung und Titellänge je Video"
      />

      <Kennzahlen werte={[
        { label: 'Videos', wert: liste.length },
        { label: 'Vollständig', wert: data?.vollstaendig ?? 0 },
        { label: 'Mit Mängeln', wert: data?.mit_maengeln ?? 0, warnung: true },
      ]} />

      {liste.length === 0 ? (
        <NichtsDa
          symbol={Search}
          titel="Noch keine Videos"
          text="Diese Seite prüft für jedes Video Zielbegriff, Schlagworte, Beschreibung und Titellänge – und sagt, was konkret fehlt."
        />
      ) : (
        <BereichTabelle
          minBreite={760}
          kopf={<tr><th>Video</th><th className="text-right">Titel</th><th>Zielbegriff</th><th className="text-right">Schlagworte</th><th className="text-right">Beschreibung</th><th>Fehlt</th></tr>}
        >
          {liste.map((e: any) => (
            <tr key={e.id} className={e.maengel.length ? 'bg-warning/5' : undefined}>
              <td><VideoLink projectId={pid} videoId={e.id}>{e.titel}</VideoLink></td>
              <td className={cn('text-right tabular-nums', e.titel_laenge > TITEL_MAX && 'text-danger font-semibold')}>
                {e.titel_laenge}
              </td>
              <td className="text-[12px]">{e.zielbegriff || <span className="text-danger">—</span>}</td>
              <td className="text-right tabular-nums">{e.tags.length}</td>
              <td className="text-right tabular-nums">{e.beschreibung_laenge}</td>
              <td className="text-[12px] leading-snug">
                {e.maengel.length === 0
                  ? <Marke text="vollständig" ton="gut" />
                  : <span className="text-muted-foreground">{e.maengel.join(' · ')}</span>}
              </td>
            </tr>
          ))}
        </BereichTabelle>
      )}

      <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed max-w-2xl">
        Richtwerte: Titel bis {TITEL_MAX} Zeichen, sonst schneidet die Suche ab. Mindestens drei
        Schlagworte und eine Beschreibung ab 100 Zeichen. Das sind Erfahrungswerte, keine Vorgaben
        von YouTube.
      </p>
    </div>
  )
}
