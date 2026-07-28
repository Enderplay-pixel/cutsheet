import { Link } from 'react-router-dom'
import { Clapperboard, ArrowLeft } from 'lucide-react'

// HINWEIS FÜR DEN BETREIBER: Platzhalter in [ECKIGEN KLAMMERN] vor dem
// öffentlichen Betrieb durch echte Angaben ersetzen (§ 5 TMG / § 18 MStV).

export function Component() {
  return (
    <LegalLayout title="Impressum">
      <h2>Angaben gemäß § 5 TMG</h2>
      <p>
        [VOR- UND NACHNAME DES BETREIBERS]<br />
        [STRASSE UND HAUSNUMMER]<br />
        [PLZ UND ORT]<br />
        Deutschland
      </p>

      <h2>Kontakt</h2>
      <p>
        E-Mail: [KONTAKT-E-MAIL]<br />
        Telefon: [TELEFONNUMMER, optional]
      </p>

      <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
      <p>[VOR- UND NACHNAME], Anschrift wie oben.</p>

      <h2>Haftung für Inhalte</h2>
      <p>
        Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen
        Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind
        wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte
        fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine
        rechtswidrige Tätigkeit hinweisen.
      </p>

      <h2>Haftung für Links</h2>
      <p>
        Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir
        keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine
        Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige
        Anbieter oder Betreiber der Seiten verantwortlich.
      </p>
    </LegalLayout>
  )
}

export function LegalLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link to="/login" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <Clapperboard className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm tracking-tight group-hover:text-primary transition-colors">CutSheet</span>
          </Link>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-10 animate-fade-up">
        <h1 className="text-2xl font-bold tracking-tight mb-8">{title}</h1>
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
          <ArrowLeft className="w-3.5 h-3.5" /> Zurück zur Anmeldung
        </Link>
      </main>
    </div>
  )
}
