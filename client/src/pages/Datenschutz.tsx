import { LegalLayout } from './Impressum'

// HINWEIS FÜR DEN BETREIBER: Platzhalter in [ECKIGEN KLAMMERN] ersetzen und
// die Angaben (Hosting-Anbieter, PostHog-Einsatz) an den realen Betrieb anpassen.

export function Component() {
  return (
    <LegalLayout title="Datenschutzerklärung">
      <h2>1. Verantwortlicher</h2>
      <p>
        [VOR- UND NACHNAME], [ANSCHRIFT], E-Mail: [KONTAKT-E-MAIL] —
        verantwortlich im Sinne der Datenschutz-Grundverordnung (DSGVO).
      </p>

      <h2>2. Welche Daten wir verarbeiten</h2>
      <h3>Konto-Daten</h3>
      <p>
        Bei der Registrierung speichern wir E-Mail-Adresse, Name und ein verschlüsseltes
        Passwort (bcrypt-Hash). Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).
      </p>
      <h3>Produktionsdaten</h3>
      <p>
        Inhalte, die du in Projekten anlegst (Drehpläne, Kontaktdaten von Cast und Crew,
        Dispositionen etc.), werden ausschließlich zur Bereitstellung des Dienstes verarbeitet.
        Als Projektverantwortliche*r bist du dafür verantwortlich, dass du die Kontaktdaten
        deines Teams einpflegen darfst.
      </p>
      <h3>E-Mail-Versand</h3>
      <p>
        CutSheet versendet in deinem Auftrag E-Mails (z. B. Tagesdispositionen, Einladungen,
        Passwort-Resets). Dispo-E-Mails enthalten ein Zählpixel, das den Empfang
        registriert (Öffnungsstatus für die Produktionsleitung). Rechtsgrundlage:
        Art. 6 Abs. 1 lit. b und f DSGVO.
      </p>
      <h3>Push-Benachrichtigungen</h3>
      <p>
        Optional und nur nach ausdrücklicher Einwilligung im Browser (Art. 6 Abs. 1 lit. a DSGVO).
        Die Einwilligung kann jederzeit in den Einstellungen widerrufen werden.
      </p>
      <h3>Nutzungsanalyse (PostHog)</h3>
      <p>
        Sofern aktiviert, nutzen wir PostHog (PostHog EU, Hosting in der EU) zur anonymisierten
        Analyse der Funktionsnutzung, um das Produkt zu verbessern. Es werden keine Daten an
        Server außerhalb der EU übertragen. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.
      </p>
      <h3>Lokale Speicherung</h3>
      <p>
        CutSheet speichert technisch notwendige Daten im localStorage deines Browsers
        (Login-Token, UI-Einstellungen). Es werden keine Werbe-Cookies gesetzt.
      </p>

      <h2>3. Hosting</h2>
      <p>
        Die Anwendung wird gehostet bei [HOSTING-ANBIETER, z. B. Render.com / Railway],
        Serverstandort [STANDORT]. Mit dem Anbieter besteht ein Auftragsverarbeitungsvertrag
        nach Art. 28 DSGVO.
      </p>

      <h2>4. Deine Rechte</h2>
      <ul>
        <li><strong>Auskunft & Datenübertragbarkeit</strong> (Art. 15, 20 DSGVO): In den Einstellungen kannst du jederzeit alle deine Daten als JSON exportieren.</li>
        <li><strong>Löschung</strong> (Art. 17 DSGVO): Du kannst dein Konto in den Einstellungen selbst löschen.</li>
        <li><strong>Berichtigung</strong> (Art. 16 DSGVO): Name und E-Mail kannst du selbst ändern.</li>
        <li><strong>Widerspruch & Einschränkung</strong> (Art. 18, 21 DSGVO): Wende dich an [KONTAKT-E-MAIL].</li>
        <li><strong>Beschwerde</strong>: Du hast das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren.</li>
      </ul>

      <h2>5. Speicherdauer</h2>
      <p>
        Konto- und Projektdaten werden gespeichert, solange dein Konto besteht. Nach
        Kontolöschung werden deine personenbezogenen Daten unverzüglich entfernt.
      </p>
    </LegalLayout>
  )
}
