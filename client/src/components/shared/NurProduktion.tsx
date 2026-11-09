import { Lock } from 'lucide-react'
import { useT } from '@/lib/useT'
import type { Lang } from '@/lib/i18n'

const T: Record<'titel' | 'text', Record<Lang, string>> = {
  titel: { de: 'Nur für die Produktion', en: 'Production only', fr: 'Réservé à la production' },
  text: {
    de: 'Gagen, Kalkulation, Kostenstand und Verträge sehen in diesem Projekt nur Produzentinnen, Produzenten und Admins. Wer eine Freigabe braucht, fragt die Produktion.',
    en: 'In this project, fees, the budget, cost status and contracts are visible to producers and admins only. Ask the production if you need access.',
    fr: 'Dans ce projet, seuls les producteurs et les administrateurs voient les cachets, le budget, l’état des coûts et les contrats. Demandez à la production si vous avez besoin d’un accès.',
  },
}

/**
 * Steht anstelle einer Seite, die der Server dieser Rolle gar nicht schickt
 * (server/src/lib/gagenschutz.ts). Ohne den Hinweis sähe man nur leere Tabellen
 * und Fehlermeldungen - und könnte meinen, es gäbe noch keine Kalkulation.
 */
export function NurProduktion() {
  const tt = useT()
  return (
    <div className="px-5 py-6 sm:p-7 max-w-2xl mx-auto animate-fade-up">
      <div className="rounded-xl border border-border/60 bg-muted/20 p-6 flex gap-4">
        <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
          <Lock className="w-4 h-4 text-muted-foreground" aria-hidden />
        </div>
        <div>
          <h1 className="text-base font-semibold">{tt(T.titel)}</h1>
          <p className="text-sm text-muted-foreground mt-1">{tt(T.text)}</p>
        </div>
      </div>
    </div>
  )
}
