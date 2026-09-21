import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Layers } from 'lucide-react'
import {
  BereichKopf, Kennzahlen, BereichLaden, NichtsDa, BereichTabelle,
} from '@/components/creator/BereichLayout'

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
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
        titel="Serien & Formate"
        untertitel="Welches wiederkehrende Format trägt den Kanal"
      />

      <Kennzahlen werte={[
        { label: 'Serien', wert: echte.length },
        { label: 'Ohne Serie', wert: ohne?.videos ?? 0,
          hinweis: 'Einzelstücke ohne Format' },
        {
          label: 'Stärkste Serie',
          wert: echte.slice().sort((a: any, b: any) => (b.aufrufe_schnitt ?? 0) - (a.aufrufe_schnitt ?? 0))[0]?.name ?? null,
          hinweis: 'nach Aufrufen im Schnitt',
        },
      ]} />

      {serien.length === 0 ? (
        <NichtsDa
          symbol={Layers}
          titel="Noch keine Videos"
          text="Sobald Videos angelegt sind, lassen sie sich einer Serie zuordnen. Diese Seite zeigt dann, welches Format im Schnitt am besten läuft."
        />
      ) : (
        <BereichTabelle
          minBreite={700}
          kopf={<tr><th>Serie</th><th className="text-right">Videos</th><th className="text-right">davon raus</th><th className="text-right">geplant</th><th className="text-right">Aufrufe im Schnitt</th><th>Stärkste Folge</th></tr>}
        >
          {serien.map((s: any) => (
            <tr key={s.name} className={s.name === 'Ohne Serie' ? 'text-muted-foreground' : undefined}>
              <td className="font-semibold">{s.name}</td>
              <td className="text-right tabular-nums">{s.videos}</td>
              <td className="text-right tabular-nums">{s.veroeffentlicht}</td>
              <td className="text-right tabular-nums">{s.geplant || '—'}</td>
              <td className="text-right tabular-nums">
                {/* Ohne veröffentlichte Folge gibt es keinen Schnitt - eine 0
                    würde hier behaupten, die Serie liefe schlecht. */}
                {s.aufrufe_schnitt === null ? '—' : s.aufrufe_schnitt.toLocaleString('de-DE')}
              </td>
              <td className="text-[12px]">{s.beste ?? '—'}</td>
            </tr>
          ))}
        </BereichTabelle>
      )}
    </div>
  )
}
