import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ShieldCheck, AlertTriangle } from 'lucide-react'
import {
  BereichKopf, Kennzahlen, BereichLaden, NichtsDa, VideoLink, Marke, BereichTabelle,
} from '@/components/creator/BereichLayout'
import { useT } from '@/lib/useT'
import { creatorRechteT as T, RISIKO_TEXT } from '@/lib/texte/CreatorRechte'

const TON: Record<string, 'gut' | 'warnung' | 'gefahr'> = {
  keins: 'gut', moeglich: 'warnung', hoch: 'gefahr',
}

export function Component() {
  const tt = useT()
  const { projectId } = useParams()
  const pid = Number(projectId)
  const { data, isLoading } = useQuery({
    queryKey: ['creator-rechte', pid],
    queryFn: () => api.creator.rechte(pid),
  })

  if (isLoading) return <BereichLaden />

  const liste = data?.liste ?? []
  const ohneLizenz = data?.ohne_lizenz ?? 0

  return (
    <div className="page-container animate-fade-up">
      <BereichKopf
        symbol={ShieldCheck}
        titel={tt(T.titel)}
        untertitel={tt(T.untertitel)}
      />

      <Kennzahlen werte={[
        { label: tt(T.materialGesamt), wert: data?.material_gesamt ?? 0 },
        { label: tt(T.ohneLizenz), wert: ohneLizenz, warnung: true },
        { label: tt(T.videosRisiko), wert: data?.videos_mit_risiko ?? 0, warnung: true },
      ]} />

      {ohneLizenz > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 mb-7">
          <AlertTriangle className="w-4 h-4 text-danger mt-0.5 shrink-0" />
          <div className="text-[13px] leading-relaxed">
            <p className="font-semibold text-danger">
              {ohneLizenz === 1 ? tt(T.einTitel) : tt(T.nTitel).replace('{n}', String(ohneLizenz))}
            </p>
            <p className="text-muted-foreground mt-0.5">
              {tt(T.warnung)}
            </p>
          </div>
        </div>
      )}

      {liste.length === 0 ? (
        <NichtsDa
          symbol={ShieldCheck}
          titel={tt(T.leerTitel)}
          text={tt(T.leerText)}
        />
      ) : (
        <BereichTabelle
          minBreite={700}
          kopf={<tr><th>{tt(T.video)}</th><th className="text-right">{tt(T.material)}</th><th className="text-right">{tt(T.ohneLizenzKlein)}</th><th>{tt(T.risiko)}</th><th>{tt(T.beanstandungen)}</th></tr>}
        >
          {liste.map((e: any) => (
            <tr key={e.id} className={e.risiko === 'hoch' ? 'bg-danger/5' : undefined}>
              <td><VideoLink projectId={pid} videoId={e.id}>{e.video}</VideoLink></td>
              <td className="text-right tabular-nums">{e.material}</td>
              <td className="text-right tabular-nums">
                {e.ohne_lizenz > 0 ? <span className="text-danger font-semibold">{e.ohne_lizenz}</span> : '-'}
              </td>
              <td><Marke text={RISIKO_TEXT[e.risiko] ? tt(RISIKO_TEXT[e.risiko]) : e.risiko} ton={TON[e.risiko] ?? 'neutral'} /></td>
              <td className="text-muted-foreground text-[12px] leading-snug">
                {e.probleme.length ? e.probleme.join(' · ') : '-'}
              </td>
            </tr>
          ))}
        </BereichTabelle>
      )}
    </div>
  )
}
