import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { Megaphone, AlertTriangle } from 'lucide-react'
import {
  BereichKopf, Kennzahlen, BereichLaden, NichtsDa, VideoLink, Marke, BereichTabelle,
} from '@/components/creator/BereichLayout'

function tag(datum: string | null): string {
  if (!datum) return '—'
  const [j, m, t] = datum.split('-')
  return `${t}.${m}.${j}`
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
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
        titel="Sponsoren & Integrationen"
        untertitel="Bezahlte Platzierungen, Honorare, Fristen und Kennzeichnung"
      />

      <Kennzahlen werte={[
        { label: 'Integrationen', wert: liste.length },
        { label: 'Honorar gesamt', wert: formatCurrency(data?.honorar_gesamt_cent ?? 0) },
        { label: 'Noch offen', wert: formatCurrency(data?.offen_cent ?? 0),
          hinweis: 'Videos noch nicht veröffentlicht' },
        { label: 'Frist überschritten', wert: data?.fristen_ueberschritten ?? 0, warnung: true },
      ]} />

      {ohneKennzeichnung > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 mb-7">
          <AlertTriangle className="w-4 h-4 text-danger mt-0.5 shrink-0" />
          <div className="text-[13px] leading-relaxed">
            <p className="font-semibold text-danger">
              {ohneKennzeichnung === 1
                ? 'Eine Integration ohne Kennzeichnung'
                : `${ohneKennzeichnung} Integrationen ohne Kennzeichnung`}
            </p>
            <p className="text-muted-foreground mt-0.5">
              Bezahlte Platzierungen müssen als Werbung erkennbar sein. Fehlt der Hinweis,
              ist es Schleichwerbung - das ist kein Formfehler, sondern abmahnfähig.
            </p>
          </div>
        </div>
      )}

      {liste.length === 0 ? (
        <NichtsDa
          symbol={Megaphone}
          titel="Keine Integrationen erfasst"
          text="Sobald bei einem Video eine Marke eingetragen ist, erscheint sie hier – mit Honorar, Leistungen, Frist und der Prüfung, ob gekennzeichnet wurde."
        />
      ) : (
        <BereichTabelle
          minBreite={760}
          kopf={<tr><th>Marke</th><th>Video</th><th>Leistungen</th><th className="text-right">Honorar</th><th>Frist</th><th>Kennzeichnung</th></tr>}
        >
          {liste.map((s: any) => (
            <tr key={s.id} className={!s.gekennzeichnet || s.frist_ueberschritten ? 'bg-danger/5' : undefined}>
              <td className="font-semibold whitespace-nowrap">{s.marke}</td>
              <td><VideoLink projectId={pid} videoId={s.id}>{s.video}</VideoLink></td>
              <td className="text-muted-foreground text-[12px]">
                {s.leistungen.length ? s.leistungen.join(' · ') : '—'}
              </td>
              <td className="text-right tabular-nums whitespace-nowrap">
                {s.honorar_cent === null ? '—' : formatCurrency(s.honorar_cent)}
              </td>
              <td className="tabular-nums whitespace-nowrap">
                {tag(s.frist)}
                {s.frist_ueberschritten && <span className="ml-2"><Marke text="überschritten" ton="gefahr" /></span>}
              </td>
              <td>
                {s.gekennzeichnet
                  ? <Marke text="gekennzeichnet" ton="gut" />
                  : <Marke text="fehlt" ton="gefahr" />}
              </td>
            </tr>
          ))}
        </BereichTabelle>
      )}
    </div>
  )
}
