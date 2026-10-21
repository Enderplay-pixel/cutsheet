import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { AppIcon } from '@/components/shared/BrandMark'
import { useT } from '@/lib/useT'
import { impressumT } from '@/lib/texte/Impressum'

// HINWEIS FÜR DEN BETREIBER: Platzhalter in [ECKIGEN KLAMMERN] vor dem
// öffentlichen Betrieb durch echte Angaben ersetzen (§ 5 TMG / § 18 MStV).

export function Component() {
  const tt = useT()
  const hinweis = tt(impressumT.hinweis)
  return (
    <LegalLayout title={tt(impressumT.titel)}>
      {hinweis && <p className="italic">{hinweis}</p>}
      <h2>{tt(impressumT.angaben)}</h2>
      <p>
        {tt(impressumT.betreiberName)}<br />
        {tt(impressumT.strasse)}<br />
        {tt(impressumT.ort)}<br />
        {tt(impressumT.land)}
      </p>

      <h2>{tt(impressumT.kontakt)}</h2>
      <p>
        {tt(impressumT.email)}<br />
        {tt(impressumT.telefon)}
      </p>

      <h2>{tt(impressumT.verantwortlich)}</h2>
      <p>{tt(impressumT.verantwortlichName)}</p>

      <h2>{tt(impressumT.haftungInhalte)}</h2>
      <p>{tt(impressumT.haftungInhalteText)}</p>

      <h2>{tt(impressumT.haftungLinks)}</h2>
      <p>{tt(impressumT.haftungLinksText)}</p>
    </LegalLayout>
  )
}

export function LegalLayout({ title, children }: { title: string; children: React.ReactNode }) {
  const tt = useT()
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link to="/login" className="flex items-center gap-2.5 group">
            <AppIcon className="w-7 h-7" />
            <span className="text-[15px] font-semibold tracking-[-0.02em]">CutSheet</span>
          </Link>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-10 animate-fade-up">
        <h1 className="font-display text-[28px] sm:text-[34px] mb-8">{title}</h1>
        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed
          [&_h2]:text-foreground [&_h2]:font-semibold [&_h2]:text-base [&_h2]:mt-7 [&_h2]:mb-2
          [&_h3]:text-foreground [&_h3]:font-medium [&_h3]:mt-5 [&_h3]:mb-1.5
          [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
          {children}
        </div>
        <Link
          to="/login"
          className="mt-12 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> {tt(impressumT.zurueck)}
        </Link>
      </main>
    </div>
  )
}
