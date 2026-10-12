/**
 * Das Mahnschreiben.
 *
 * Eine Mahnung ist ein Brief, nicht eine Tabelle: Sie geht an einen Menschen,
 * der entscheiden soll zu zahlen, und sie muss im Fensterumschlag
 * funktionieren. Darum dasselbe Adressfenster nach DIN 5008 wie die Rechnung.
 *
 * Was darin stehen muss, damit sie etwas bewirkt:
 *  - welche Rechnung gemeint ist, mit Nummer und Datum
 *  - was offen ist, und woraus sich der geforderte Betrag zusammensetzt
 *  - eine Frist mit Datum, nicht "unverzüglich"
 *  - bei Zinsen der Satz und seine Grundlage, damit der Betrag nachrechenbar
 *    ist - eine Zinsforderung, die niemand nachrechnen kann, wird bestritten
 */
import { euro } from './rechnung'
import { pdfFontFaces, PDF_SANS } from './pdfFonts'

function esc(wert: any): string {
  return String(wert ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function datum(wert: string | null | undefined): string {
  if (!wert) return ''
  const d = new Date(`${String(wert).slice(0, 10)}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return String(wert)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Basispunkte als Prozentsatz: 1052 wird zu "10,52". */
function prozent(bp: number): string {
  return (bp / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export type Mahnungsdaten = {
  firma: {
    name?: string; legal_name?: string; address?: string; zip?: string; city?: string; country?: string
    tax_number?: string; vat_id?: string; phone?: string; email?: string; website?: string
    iban?: string; bic?: string; bank_name?: string
  }
  kunde: { name?: string; contact_name?: string; address?: string; zip?: string; city?: string }
  rechnung: { number: string; issue_date?: string | null; due_date?: string | null }
  mahnung: {
    stufe: number; name: string; datum: string; frist: string; tage_verzug: number
    offen_cents: number; zinsen_cents: number; gebuehr_cents: number
    pauschale_cents: number; gesamt_cents: number
    satz_bp: number; basiszins_bp: number
  }
}

/**
 * Der Text über der Aufstellung, je Stufe anders.
 *
 * Der Ton steigt, der Inhalt bleibt sachlich. Was in einer Mahnung nichts zu
 * suchen hat: Unterstellungen über die Gründe. Niemand weiß, warum nicht
 * gezahlt wurde, und die häufigste Ursache ist Vergessen.
 */
function anschreiben(stufe: number, nummer: string, faellig: string): string {
  const rechnung = `unsere Rechnung ${esc(nummer)}${faellig ? `, fällig am ${datum(faellig)},` : ''}`
  if (stufe <= 1) {
    return `vermutlich ist es Ihnen entgangen: ${rechnung} ist noch offen.
      Falls die Zahlung bereits unterwegs ist, betrachten Sie dieses Schreiben als erledigt.`
  }
  if (stufe === 2) {
    return `${rechnung} ist trotz unserer Zahlungserinnerung noch nicht beglichen.
      Sie befinden sich damit in Verzug. Wir berechnen die gesetzlichen Verzugszinsen
      und unsere Mahnkosten.`
  }
  if (stufe === 3) {
    return `${rechnung} ist weiterhin offen, obwohl wir bereits gemahnt haben.
      Wir bitten Sie, den unten aufgeführten Betrag innerhalb der genannten Frist
      zu überweisen.`
  }
  return `${rechnung} ist nach mehreren Mahnungen unverändert offen. Wir setzen Ihnen
    hiermit eine letzte Frist. Verstreicht sie ohne Zahlungseingang, geben wir die
    Forderung ab und beantragen einen Mahnbescheid. Die dadurch entstehenden Kosten
    tragen Sie.`
}

/** Baut das HTML der Mahnung. generatePdf macht daraus das Blatt. */
export function renderMahnung(d: Mahnungsdaten): string {
  const { firma, kunde, rechnung, mahnung } = d
  const absenderZeile = [firma.legal_name || firma.name, firma.address, `${firma.zip || ''} ${firma.city || ''}`.trim()]
    .filter(Boolean).join(' · ')

  const posten: Array<[string, number]> = [['Offener Rechnungsbetrag', mahnung.offen_cents]]
  if (mahnung.zinsen_cents > 0) {
    posten.push([
      `Verzugszinsen (${prozent(mahnung.satz_bp)} % für ${mahnung.tage_verzug} Tage)`,
      mahnung.zinsen_cents,
    ])
  }
  if (mahnung.gebuehr_cents > 0) posten.push(['Mahnkosten', mahnung.gebuehr_cents])
  if (mahnung.pauschale_cents > 0) posten.push(['Pauschale nach § 288 Abs. 5 BGB', mahnung.pauschale_cents])

  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8">
<title>${esc(mahnung.name)} ${esc(rechnung.number)}</title>
<style>
${pdfFontFaces()}
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: ${PDF_SANS}; font-size: 10.5pt; color: #111; line-height: 1.5; }
  .blatt { width: 210mm; min-height: 297mm; padding: 20mm 20mm 20mm 25mm; position: relative; }
  .kopf { display: flex; justify-content: space-between; align-items: flex-start; gap: 10mm; }
  .kopf h1 { margin: 0; font-size: 15pt; letter-spacing: -0.01em; }
  .kopf .kontakt { font-size: 8.5pt; color: #555; text-align: right; line-height: 1.45; }
  /* Adressfeld nach DIN 5008: 45 mm von oben, damit es im Fenster steht. */
  .fenster { margin-top: 12mm; height: 40mm; }
  .fenster .absender { font-size: 7pt; color: #666; border-bottom: 0.3pt solid #bbb;
    padding-bottom: 1mm; margin-bottom: 2mm; }
  .fenster .empfaenger { font-size: 10.5pt; line-height: 1.45; }
  .angaben { display: flex; justify-content: space-between; margin-top: 6mm; font-size: 9.5pt; }
  .angaben div { color: #444; }
  .angaben b { color: #111; }
  h2.titel { font-size: 13pt; margin: 10mm 0 4mm; }
  p.text { margin: 0 0 4mm; }
  table { width: 100%; border-collapse: collapse; margin-top: 4mm; font-size: 10pt; }
  th { text-align: left; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.04em;
    color: #555; border-bottom: 0.6pt solid #333; padding: 2mm 0; }
  td { padding: 2mm 0; border-bottom: 0.3pt solid #ddd; }
  td.betrag, th.betrag { text-align: right; white-space: nowrap; }
  tr.summe td { border-top: 0.8pt solid #333; border-bottom: none; font-weight: 600;
    font-size: 11.5pt; padding-top: 3mm; }
  .frist { margin-top: 6mm; padding: 4mm; background: #f4f4f5; border-left: 1.2mm solid #111; }
  .frist b { font-size: 11pt; }
  .bank { margin-top: 6mm; font-size: 9.5pt; color: #333; }
  .bank table { margin: 1mm 0 0; font-size: 9.5pt; }
  .bank td { border: none; padding: 0.6mm 4mm 0.6mm 0; }
  .fuss { position: absolute; bottom: 12mm; left: 25mm; right: 20mm; font-size: 7.5pt;
    color: #666; border-top: 0.3pt solid #ddd; padding-top: 2mm; }
  .hinweis { margin-top: 5mm; font-size: 9pt; color: #555; }
</style></head>
<body><div class="blatt">

  <div class="kopf">
    <h1>${esc(firma.name || '')}</h1>
    <div class="kontakt">
      ${firma.phone ? `${esc(firma.phone)}<br>` : ''}
      ${firma.email ? `${esc(firma.email)}<br>` : ''}
      ${firma.website ? `${esc(firma.website)}` : ''}
    </div>
  </div>

  <div class="fenster">
    <div class="absender">${esc(absenderZeile)}</div>
    <div class="empfaenger">
      ${kunde.name ? `${esc(kunde.name)}<br>` : ''}
      ${kunde.contact_name ? `${esc(kunde.contact_name)}<br>` : ''}
      ${kunde.address ? `${esc(kunde.address)}<br>` : ''}
      ${(kunde.zip || kunde.city) ? `${esc(kunde.zip || '')} ${esc(kunde.city || '')}` : ''}
    </div>
  </div>

  <div class="angaben">
    <div>Rechnung <b>${esc(rechnung.number)}</b>${rechnung.issue_date ? ` vom ${datum(rechnung.issue_date)}` : ''}</div>
    <div>Datum <b>${datum(mahnung.datum)}</b></div>
  </div>

  <h2 class="titel">${esc(mahnung.name)}</h2>

  <p class="text">${kunde.contact_name ? `Guten Tag ${esc(kunde.contact_name)},` : 'Guten Tag,'}</p>
  <p class="text">${anschreiben(mahnung.stufe, rechnung.number, rechnung.due_date || '')}</p>

  <table>
    <thead><tr><th>Position</th><th class="betrag">Betrag</th></tr></thead>
    <tbody>
      ${posten.map(([text, betrag]) => `<tr><td>${esc(text)}</td><td class="betrag">${euro(betrag)}</td></tr>`).join('')}
      <tr class="summe"><td>Zu zahlen</td><td class="betrag">${euro(mahnung.gesamt_cents)}</td></tr>
    </tbody>
  </table>

  <div class="frist">
    Wir bitten um Zahlung bis zum <b>${datum(mahnung.frist)}</b>.
  </div>

  ${mahnung.zinsen_cents > 0 ? `<p class="hinweis">
    Der Verzugszinssatz von ${prozent(mahnung.satz_bp)} % ergibt sich aus § 288 BGB:
    Basiszinssatz nach § 247 BGB (${prozent(mahnung.basiszins_bp)} %) zuzüglich
    ${prozent(mahnung.satz_bp - mahnung.basiszins_bp)} Prozentpunkte.
    Berechnet für ${mahnung.tage_verzug} Tage auf ${euro(mahnung.offen_cents)}.
  </p>` : ''}

  ${firma.iban ? `<div class="bank">
    <b>Bankverbindung</b>
    <table>
      ${firma.bank_name ? `<tr><td>Bank</td><td>${esc(firma.bank_name)}</td></tr>` : ''}
      <tr><td>IBAN</td><td>${esc(firma.iban)}</td></tr>
      ${firma.bic ? `<tr><td>BIC</td><td>${esc(firma.bic)}</td></tr>` : ''}
      <tr><td>Verwendungszweck</td><td>${esc(rechnung.number)}</td></tr>
    </table>
  </div>` : ''}

  <div class="fuss">
    ${esc(absenderZeile)}
    ${firma.tax_number ? ` · Steuernummer ${esc(firma.tax_number)}` : ''}
    ${firma.vat_id ? ` · USt-IdNr. ${esc(firma.vat_id)}` : ''}
  </div>

</div></body></html>`
}
