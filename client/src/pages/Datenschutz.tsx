import { LegalLayout } from './Impressum'
import { useT } from '@/lib/useT'
import { datenschutzT as d } from '@/lib/texte/Datenschutz'

// HINWEIS FÜR DEN BETREIBER: Platzhalter in [ECKIGEN KLAMMERN] ersetzen und
// die Angaben (Hosting-Anbieter, PostHog-Einsatz) an den realen Betrieb anpassen.

export function Component() {
  const tt = useT()
  const verbindlich = tt(d.verbindlich)
  return (
    <LegalLayout title={tt(d.titel)}>
      {verbindlich && <p className="text-foreground font-medium">{verbindlich}</p>}

      <h2>{tt(d.h1)}</h2>
      <p>{tt(d.p1)}</p>

      <h2>{tt(d.h2)}</h2>
      <h3>{tt(d.kontoTitel)}</h3>
      <p>{tt(d.kontoText)}</p>
      <h3>{tt(d.produktionTitel)}</h3>
      <p>{tt(d.produktionText)}</p>
      <h3>{tt(d.mailTitel)}</h3>
      <p>{tt(d.mailText)}</p>
      <h3>{tt(d.pushTitel)}</h3>
      <p>{tt(d.pushText)}</p>
      <h3>{tt(d.analyseTitel)}</h3>
      <p>{tt(d.analyseText)}</p>
      <h3>{tt(d.lokalTitel)}</h3>
      <p>{tt(d.lokalText)}</p>

      <h2>{tt(d.h3)}</h2>
      <p>{tt(d.p3)}</p>

      <h2>{tt(d.h4)}</h2>
      <ul>
        <li><strong>{tt(d.auskunftTitel)}</strong>{tt(d.auskunftText)}</li>
        <li><strong>{tt(d.loeschungTitel)}</strong>{tt(d.loeschungText)}</li>
        <li><strong>{tt(d.berichtigungTitel)}</strong>{tt(d.berichtigungText)}</li>
        <li><strong>{tt(d.widerspruchTitel)}</strong>{tt(d.widerspruchText)}</li>
        <li><strong>{tt(d.beschwerdeTitel)}</strong>{tt(d.beschwerdeText)}</li>
      </ul>

      <h2>{tt(d.h5)}</h2>
      <p>{tt(d.p5)}</p>
    </LegalLayout>
  )
}
