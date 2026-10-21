import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Layers } from 'lucide-react'
import {
  BereichKopf, Kennzahlen, BereichLaden, NichtsDa, BereichTabelle,
} from '@/components/creator/BereichLayout'
import { useT, useGebietsschema } from '@/lib/useT'
import { creatorSerienT as st } from '@/lib/texte/CreatorSerien'

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const tt = useT()
  const gs = useGebietsschema()
  const { data, isLoading } = useQuery({
    queryKey: ['creator-serien', pid],
    queryFn: () => api.creator.serien(pid),
  })

  if (isLoading) return <BereichLaden />

  const serien = data?.serien ?? []
  const echte = serien.filter((s: any) => s.name !== 'Ohne Serie')
  const ohne = serien.find((s: any) => s.name === 'Ohne Serie')

  return (
    <div className="page-container animate-fade-up">
      <BereichKopf
        symbol={Layers}
        titel={tt(st.titel)}
        untertitel={tt(st.untertitel)}
      />

      <Kennzahlen werte={[
        { label: tt(st.serien), wert: echte.length },
        { label: tt(st.ohneSerie), wert: ohne?.videos ?? 0,
          hinweis: tt(st.ohneSerieHinweis) },
        {
          label: tt(st.staerksteSerie),
          wert: echte.slice().sort((a: any, b: any) => (b.aufrufe_schnitt ?? 0) - (a.aufrufe_schnitt ?? 0))[0]?.name ?? null,
          hinweis: tt(st.nachAufrufen),
        },
      ]} />

      {serien.length === 0 ? (
        <NichtsDa
          symbol={Layers}
          titel={tt(st.keineVideos)}
          text={tt(st.keineVideosText)}
        />
      ) : (
        <BereichTabelle
          minBreite={700}
          kopf={<tr><th>{tt(st.serie)}</th><th className="text-right">{tt(st.videos)}</th><th className="text-right">{tt(st.davonRaus)}</th><th className="text-right">{tt(st.geplant)}</th><th className="text-right">{tt(st.aufrufeSchnitt)}</th><th>{tt(st.staerksteFolge)}</th></tr>}
        >
          {serien.map((s: any) => (
            <tr key={s.name} className={s.name === 'Ohne Serie' ? 'text-muted-foreground' : undefined}>
              <td className="font-semibold">{s.name === 'Ohne Serie' ? tt(st.ohneSerie) : s.name}</td>
              <td className="text-right tabular-nums">{s.videos}</td>
              <td className="text-right tabular-nums">{s.veroeffentlicht}</td>
              <td className="text-right tabular-nums">{s.geplant || '-'}</td>
              <td className="text-right tabular-nums">
                {/* Ohne veröffentlichte Folge gibt es keinen Schnitt - eine 0
                    würde hier behaupten, die Serie liefe schlecht. */}
                {s.aufrufe_schnitt === null ? '-' : s.aufrufe_schnitt.toLocaleString(gs)}
              </td>
              <td className="text-[12px]">{s.beste ?? '-'}</td>
            </tr>
          ))}
        </BereichTabelle>
      )}
    </div>
  )
}
