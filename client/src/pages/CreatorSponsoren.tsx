import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { Megaphone, AlertTriangle } from 'lucide-react'
import { useT, useGebietsschema } from '@/lib/useT'
import { creatorSponsorenT as T } from '@/lib/texte/CreatorSponsoren'
import {
  BereichKopf, Kennzahlen, BereichLaden, NichtsDa, VideoLink, Marke, BereichTabelle,
} from '@/components/creator/BereichLayout'

function tag(datum: string | null, gebietsschema: string): string {
  if (!datum) return '-'
  const [j, m, t] = datum.split('-')
  return new Date(Number(j), Number(m) - 1, Number(t))
    .toLocaleDateString(gebietsschema, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const tt = useT()
  const gebietsschema = useGebietsschema()
  const { data, isLoading } = useQuery({
    queryKey: ['creator-sponsoren', pid],
    queryFn: () => api.creator.sponsoren(pid),
  })

  if (isLoading) return <BereichLaden />

  const liste = data?.liste ?? []
  const ohneKennzeichnung = data?.ohne_kennzeichnung ?? 0

  return (
    <div className="page-container animate-fade-up">
      <BereichKopf
        symbol={Megaphone}
        titel={tt(T.titel)}
        untertitel={tt(T.untertitel)}
      />

      <Kennzahlen werte={[
        { label: tt(T.integrationen), wert: liste.length },
        { label: tt(T.honorarGesamt), wert: formatCurrency(data?.honorar_gesamt_cent ?? 0) },
        { label: tt(T.nochOffen), wert: formatCurrency(data?.offen_cent ?? 0),
          hinweis: tt(T.nochOffenHinweis) },
        { label: tt(T.fristUeber), wert: data?.fristen_ueberschritten ?? 0, warnung: true },
      ]} />

      {ohneKennzeichnung > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 mb-7">
          <AlertTriangle className="w-4 h-4 text-danger mt-0.5 shrink-0" />
          <div className="text-[13px] leading-relaxed">
            <p className="font-semibold text-danger">
              {ohneKennzeichnung === 1
                ? tt(T.eineOhne)
                : tt(T.mehrereOhne).replace('{n}', String(ohneKennzeichnung))}
            </p>
            <p className="text-muted-foreground mt-0.5">
              {tt(T.warnText)}
            </p>
          </div>
        </div>
      )}

      {liste.length === 0 ? (
        <NichtsDa
          symbol={Megaphone}
          titel={tt(T.leerTitel)}
          text={tt(T.leerText)}
        />
      ) : (
        <BereichTabelle
          minBreite={760}
          kopf={<tr><th>{tt(T.spalteMarke)}</th><th>{tt(T.spalteVideo)}</th><th>{tt(T.spalteLeist)}</th><th className="text-right">{tt(T.spalteHonorar)}</th><th>{tt(T.spalteFrist)}</th><th>{tt(T.spalteKennz)}</th></tr>}
        >
          {liste.map((s: any) => (
            <tr key={s.id} className={!s.gekennzeichnet || s.frist_ueberschritten ? 'bg-danger/5' : undefined}>
              <td className="font-semibold whitespace-nowrap">{s.marke}</td>
              <td><VideoLink projectId={pid} videoId={s.id}>{s.video}</VideoLink></td>
              <td className="text-muted-foreground text-[12px]">
                {s.leistungen.length ? s.leistungen.join(' · ') : '-'}
              </td>
              <td className="text-right tabular-nums whitespace-nowrap">
                {s.honorar_cent === null ? '-' : formatCurrency(s.honorar_cent)}
              </td>
              <td className="tabular-nums whitespace-nowrap">
                {tag(s.frist, gebietsschema)}
                {s.frist_ueberschritten && <span className="ml-2"><Marke text={tt(T.ueberschritten)} ton="gefahr" /></span>}
              </td>
              <td>
                {s.gekennzeichnet
                  ? <Marke text={tt(T.gekennzeichnet)} ton="gut" />
                  : <Marke text={tt(T.fehlt)} ton="gefahr" />}
              </td>
            </tr>
          ))}
        </BereichTabelle>
      )}
    </div>
  )
}
