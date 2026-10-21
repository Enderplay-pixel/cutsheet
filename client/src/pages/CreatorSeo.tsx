import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Search } from 'lucide-react'
import {
  BereichKopf, Kennzahlen, BereichLaden, NichtsDa, VideoLink, Marke, BereichTabelle,
} from '@/components/creator/BereichLayout'
import { useT } from '@/lib/useT'
import { creatorSeoT } from '@/lib/texte/CreatorSeo'

/** Ab hier schneidet die YouTube-Suche den Titel in der Regel ab. */
const TITEL_MAX = 60

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const tt = useT()
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
        titel={tt(creatorSeoT.titel)}
        untertitel={tt(creatorSeoT.untertitel)}
      />

      <Kennzahlen werte={[
        { label: tt(creatorSeoT.videos), wert: liste.length },
        { label: tt(creatorSeoT.vollstaendig), wert: data?.vollstaendig ?? 0 },
        { label: tt(creatorSeoT.mitMaengeln), wert: data?.mit_maengeln ?? 0, warnung: true },
      ]} />

      {liste.length === 0 ? (
        <NichtsDa
          symbol={Search}
          titel={tt(creatorSeoT.leerTitel)}
          text={tt(creatorSeoT.leerText)}
        />
      ) : (
        <BereichTabelle
          minBreite={760}
          kopf={<tr><th>{tt(creatorSeoT.spalteVideo)}</th><th className="text-right">{tt(creatorSeoT.spalteTitel)}</th><th>{tt(creatorSeoT.spalteZiel)}</th><th className="text-right">{tt(creatorSeoT.spalteTags)}</th><th className="text-right">{tt(creatorSeoT.spalteBeschr)}</th><th>{tt(creatorSeoT.spalteFehlt)}</th></tr>}
        >
          {liste.map((e: any) => (
            <tr key={e.id} className={e.maengel.length ? 'bg-warning/5' : undefined}>
              <td><VideoLink projectId={pid} videoId={e.id}>{e.titel}</VideoLink></td>
              <td className={cn('text-right tabular-nums', e.titel_laenge > TITEL_MAX && 'text-danger font-semibold')}>
                {e.titel_laenge}
              </td>
              <td className="text-[12px]">{e.zielbegriff || <span className="text-danger">-</span>}</td>
              <td className="text-right tabular-nums">{e.tags.length}</td>
              <td className="text-right tabular-nums">{e.beschreibung_laenge}</td>
              <td className="text-[12px] leading-snug">
                {e.maengel.length === 0
                  ? <Marke text={tt(creatorSeoT.markeVoll)} ton="gut" />
                  : <span className="text-muted-foreground">{e.maengel.join(' · ')}</span>}
              </td>
            </tr>
          ))}
        </BereichTabelle>
      )}

      <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed max-w-2xl">
        {tt(creatorSeoT.richtwerte).replace('{n}', String(TITEL_MAX))}
      </p>
    </div>
  )
}
