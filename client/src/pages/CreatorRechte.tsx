import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ShieldCheck, AlertTriangle } from 'lucide-react'
import {
  BereichKopf, Kennzahlen, BereichLaden, NichtsDa, VideoLink, Marke, BereichTabelle,
} from '@/components/creator/BereichLayout'

const TON: Record<string, 'gut' | 'warnung' | 'gefahr'> = {
  keins: 'gut', moeglich: 'warnung', hoch: 'gefahr',
}
const RISIKO_TEXT: Record<string, string> = {
  keins: 'kein Risiko', moeglich: 'möglich', hoch: 'hoch',
}

export function Component() {
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
        titel="Rechte & Lizenzen"
        untertitel="Musik, Material und Fremdaufnahmen über alle Videos - wo eine Lizenz fehlt"
      />

      <Kennzahlen werte={[
        { label: 'Material gesamt', wert: data?.material_gesamt ?? 0 },
        { label: 'Ohne Lizenz', wert: ohneLizenz, warnung: true },
        { label: 'Videos mit hohem Risiko', wert: data?.videos_mit_risiko ?? 0, warnung: true },
      ]} />

      {ohneLizenz > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 mb-7">
          <AlertTriangle className="w-4 h-4 text-danger mt-0.5 shrink-0" />
          <div className="text-[13px] leading-relaxed">
            <p className="font-semibold text-danger">
              {ohneLizenz === 1 ? 'Ein Titel ohne Lizenznachweis' : `${ohneLizenz} Titel ohne Lizenznachweis`}
            </p>
            <p className="text-muted-foreground mt-0.5">
              Ein einziger ungeklärter Track kann die Monetarisierung des ganzen Videos kosten.
              Das höchste Einzelrisiko schlägt deshalb auf das Video durch.
            </p>
          </div>
        </div>
      )}

      {liste.length === 0 ? (
        <NichtsDa
          symbol={ShieldCheck}
          titel="Noch kein Material erfasst"
          text="Musik, Stockmaterial und Fremdaufnahmen werden beim jeweiligen Video eingetragen. Hier stehen sie dann über den ganzen Kanal zusammen."
        />
      ) : (
        <BereichTabelle
          minBreite={700}
          kopf={<tr><th>Video</th><th className="text-right">Material</th><th className="text-right">ohne Lizenz</th><th>Risiko</th><th>Beanstandungen</th></tr>}
        >
          {liste.map((e: any) => (
            <tr key={e.id} className={e.risiko === 'hoch' ? 'bg-danger/5' : undefined}>
              <td><VideoLink projectId={pid} videoId={e.id}>{e.video}</VideoLink></td>
              <td className="text-right tabular-nums">{e.material}</td>
              <td className="text-right tabular-nums">
                {e.ohne_lizenz > 0 ? <span className="text-danger font-semibold">{e.ohne_lizenz}</span> : '—'}
              </td>
              <td><Marke text={RISIKO_TEXT[e.risiko] ?? e.risiko} ton={TON[e.risiko] ?? 'neutral'} /></td>
              <td className="text-muted-foreground text-[12px] leading-snug">
                {e.probleme.length ? e.probleme.join(' · ') : '—'}
              </td>
            </tr>
          ))}
        </BereichTabelle>
      )}
    </div>
  )
}
