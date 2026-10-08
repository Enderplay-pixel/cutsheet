/**
 * Das Rechnungsblatt.
 *
 * Eine Rechnung ist kein Bericht, sondern ein Beleg: Sie muss Angaben tragen,
 * die das Umsatzsteuergesetz vorschreibt (Paragraf 14 Absatz 4 UStG), und
 * sie muss im Fensterumschlag funktionieren. Darum ein eigenes Layout statt
 * des allgemeinen Dokumentgerüsts.
 *
 * Pflichtangaben, die hier gesetzt werden:
 *  - vollständiger Name und Anschrift beider Seiten
 *  - Steuernummer oder Umsatzsteuer-Identifikationsnummer
 *  - Ausstellungsdatum und fortlaufende Rechnungsnummer
 *  - Menge und Art der Leistung
 *  - Zeitpunkt der Leistung
 *  - Entgelt nach Steuersätzen getrennt, Steuerbetrag, Bruttobetrag
 *  - bei Paragraf 19 UStG der Hinweis auf die Kleinunternehmerregelung
 */
import { euro, menge, summiere, type Position, type Steuerart } from './rechnung'
import { pdfFontFaces, PDF_SANS } from './pdfFonts'

function esc(wert: any): string {
  return String(wert ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function mehrzeilig(wert: any): string {
  return esc(wert).replace(/\n/g, '<br>')
}

function datum(wert: string | null | undefined): string {
  if (!wert) return ''
  const d = new Date(`${String(wert).slice(0, 10)}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return String(wert)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export type Rechnungsdaten = {
  firma: {
    name: string; legal_name?: string; address?: string; zip?: string; city?: string; country?: string
    tax_number?: string; vat_id?: string; phone?: string; email?: string; website?: string
    iban?: string; bic?: string; bank_name?: string; tax_mode?: string
  }
  kunde: {
    name: string; contact_name?: string; address?: string; zip?: string; city?: string; country?: string; vat_id?: string
  } | null
  rechnung: {
    number: string; issue_date?: string | null; due_date?: string | null
    service_from?: string | null; service_to?: string | null
    intro?: string; outro?: string; status: string; tax_mode?: string
  }
  positionen: Array<Position & { description?: string; unit?: string }>
  projekt?: string | null
}

/** Baut das HTML der Rechnung. generatePdf macht daraus das Blatt. */
export function renderRechnung(daten: Rechnungsdaten): string {
  const { firma, kunde, rechnung, positionen } = daten
  const steuerart = (rechnung.tax_mode || firma.tax_mode || 'regel') as Steuerart
  const summen = summiere(positionen, steuerart)
  const kleinunternehmen = steuerart === 'kleinunternehmer'

  const absenderzeile = [firma.legal_name || firma.name, firma.address, [firma.zip, firma.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(' · ')

  const zeilen = positionen
    .map(
      (position, i) => `
      <tr>
        <td class="nr">${i + 1}</td>
        <td>${mehrzeilig(position.description)}</td>
        <td class="zahl">${esc(menge(position.quantity_milli))}</td>
        <td>${esc(position.unit || '')}</td>
        <td class="zahl">${esc(euro(position.unit_price_cents))}</td>
        ${kleinunternehmen ? '' : `<td class="zahl">${esc(position.tax_percent)} %</td>`}
        <td class="zahl">${esc(euro(Math.round((position.quantity_milli * position.unit_price_cents) / 1000)))}</td>
      </tr>`
    )
    .join('')

  const steuerzeilen = kleinunternehmen
    ? ''
    : summen.nachSatz
        .filter((zeile) => zeile.netto > 0)
        .map(
          (zeile) => `
        <tr>
          <td>Umsatzsteuer ${zeile.satz} % auf ${esc(euro(zeile.netto))}</td>
          <td class="zahl">${esc(euro(zeile.steuer))}</td>
        </tr>`
        )
        .join('')

  const leistungszeitraum =
    rechnung.service_from && rechnung.service_to && rechnung.service_from !== rechnung.service_to
      ? `${datum(rechnung.service_from)} bis ${datum(rechnung.service_to)}`
      : datum(rechnung.service_from || rechnung.service_to || rechnung.issue_date)

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Rechnung ${esc(rechnung.number)}</title>
<style>
${pdfFontFaces()}
  @page { size: A4; margin: 20mm 20mm 24mm 25mm; }
  * { box-sizing: border-box; }
  body {
    font-family: ${PDF_SANS};
    font-size: 10.5pt; line-height: 1.5; color: #111; margin: 0;
    -webkit-font-smoothing: antialiased;
  }
  .kopf { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  .firma { font-size: 13pt; font-weight: 600; }
  .firma-klein { font-size: 9pt; color: #555; line-height: 1.45; margin-top: 4px; }

  /* Anschriftenfeld nach DIN 5008, damit es im Fensterumschlag steht */
  .anschrift { margin-top: 18mm; min-height: 27mm; }
  .absenderzeile {
    font-size: 7.5pt; color: #666; border-bottom: 0.4pt solid #bbb;
    padding-bottom: 2px; margin-bottom: 8px;
  }
  .empfaenger { font-size: 11pt; line-height: 1.5; }

  .eckdaten { margin-top: 10mm; display: flex; justify-content: space-between; align-items: flex-end; }
  h1 { font-size: 16pt; margin: 0; font-weight: 600; letter-spacing: -0.01em; }
  .eck { font-size: 9.5pt; color: #444; text-align: right; line-height: 1.6; }
  .eck b { color: #111; font-weight: 600; }

  .einleitung { margin: 8mm 0 4mm; }

  table.posten { width: 100%; border-collapse: collapse; margin-top: 4mm; }
  table.posten th {
    text-align: left; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.04em;
    color: #555; border-bottom: 0.8pt solid #333; padding: 6px 6px 5px; font-weight: 600;
  }
  table.posten td { padding: 7px 6px; border-bottom: 0.4pt solid #ddd; vertical-align: top; }
  table.posten tr { page-break-inside: avoid; }
  table.posten thead { display: table-header-group; }
  .zahl { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .nr { color: #888; width: 7mm; }

  .summen { margin-top: 6mm; display: flex; justify-content: flex-end; page-break-inside: avoid; }
  .summen table { border-collapse: collapse; min-width: 75mm; }
  .summen td { padding: 4px 8px; }
  .summen td.zahl { font-variant-numeric: tabular-nums; }
  .summen tr.gesamt td {
    border-top: 0.8pt solid #333; font-weight: 700; font-size: 12pt; padding-top: 7px;
  }

  .hinweis { margin-top: 8mm; font-size: 9.5pt; }
  .zahlung { margin-top: 6mm; font-size: 9.5pt; }
  .zahlung b { font-weight: 600; }
  .bank { margin-top: 3mm; font-variant-numeric: tabular-nums; }

  .fuss {
    margin-top: 12mm; padding-top: 4mm; border-top: 0.4pt solid #ccc;
    font-size: 8pt; color: #666; display: flex; justify-content: space-between; gap: 16px;
  }
  .fuss div { flex: 1; line-height: 1.5; }
  .entwurf {
    position: fixed; top: 45%; left: 50%; transform: translate(-50%, -50%) rotate(-24deg);
    font-size: 64pt; color: rgba(0,0,0,0.07); font-weight: 700; letter-spacing: 0.1em;
  }
</style>
</head>
<body>
${rechnung.status === 'entwurf' ? '<div class="entwurf">ENTWURF</div>' : ''}
${rechnung.status === 'storniert' ? '<div class="entwurf">STORNIERT</div>' : ''}

<div class="kopf">
  <div>
    <div class="firma">${esc(firma.name)}</div>
    <div class="firma-klein">
      ${esc(firma.address || '')}${firma.address ? '<br>' : ''}
      ${esc([firma.zip, firma.city].filter(Boolean).join(' '))}
    </div>
  </div>
  <div class="firma-klein" style="text-align:right;">
    ${firma.phone ? `${esc(firma.phone)}<br>` : ''}
    ${firma.email ? `${esc(firma.email)}<br>` : ''}
    ${firma.website ? `${esc(firma.website)}` : ''}
  </div>
</div>

<div class="anschrift">
  <div class="absenderzeile">${esc(absenderzeile)}</div>
  <div class="empfaenger">
    ${kunde ? esc(kunde.name) : '<i>Kein Auftraggeber hinterlegt</i>'}<br>
    ${kunde?.contact_name ? `${esc(kunde.contact_name)}<br>` : ''}
    ${kunde?.address ? `${esc(kunde.address)}<br>` : ''}
    ${esc([kunde?.zip, kunde?.city].filter(Boolean).join(' '))}
    ${kunde?.country && kunde.country !== 'Deutschland' ? `<br>${esc(kunde.country)}` : ''}
  </div>
</div>

<div class="eckdaten">
  <h1>Rechnung${rechnung.number ? ` ${esc(rechnung.number)}` : ''}</h1>
  <div class="eck">
    ${rechnung.issue_date ? `Rechnungsdatum: <b>${esc(datum(rechnung.issue_date))}</b><br>` : ''}
    ${leistungszeitraum ? `Leistungszeitraum: <b>${esc(leistungszeitraum)}</b><br>` : ''}
    ${firma.tax_number ? `Steuernummer: <b>${esc(firma.tax_number)}</b><br>` : ''}
    ${firma.vat_id ? `USt-IdNr.: <b>${esc(firma.vat_id)}</b><br>` : ''}
    ${kunde?.vat_id ? `USt-IdNr. Auftraggeber: <b>${esc(kunde.vat_id)}</b>` : ''}
  </div>
</div>

${rechnung.intro ? `<div class="einleitung">${mehrzeilig(rechnung.intro)}</div>` : ''}
${daten.projekt ? `<div class="einleitung">Projekt: <b>${esc(daten.projekt)}</b></div>` : ''}

<table class="posten">
  <thead>
    <tr>
      <th class="nr">#</th>
      <th>Leistung</th>
      <th class="zahl">Menge</th>
      <th>Einheit</th>
      <th class="zahl">Einzelpreis</th>
      ${kleinunternehmen ? '' : '<th class="zahl">USt.</th>'}
      <th class="zahl">Betrag</th>
    </tr>
  </thead>
  <tbody>${zeilen}</tbody>
</table>

<div class="summen">
  <table>
    <tr><td>Nettobetrag</td><td class="zahl">${esc(euro(summen.netto))}</td></tr>
    ${steuerzeilen}
    <tr class="gesamt"><td>${kleinunternehmen ? 'Rechnungsbetrag' : 'Gesamtbetrag'}</td><td class="zahl">${esc(euro(summen.brutto))}</td></tr>
  </table>
</div>

${
  kleinunternehmen
    ? `<div class="hinweis">Gemäß Paragraf 19 Absatz 1 UStG wird keine Umsatzsteuer berechnet.</div>`
    : ''
}
${rechnung.outro ? `<div class="hinweis">${mehrzeilig(rechnung.outro)}</div>` : ''}

<div class="zahlung">
  ${
    rechnung.due_date
      ? `Bitte überweisen Sie den Betrag bis zum <b>${esc(datum(rechnung.due_date))}</b>${
          rechnung.number ? ` unter Angabe der Rechnungsnummer ${esc(rechnung.number)}` : ''
        }.`
      : ''
  }
  ${
    firma.iban
      ? `<div class="bank">
           ${esc(firma.bank_name || '')}${firma.bank_name ? '<br>' : ''}
           IBAN ${esc(firma.iban)}${firma.bic ? ` · BIC ${esc(firma.bic)}` : ''}
         </div>`
      : ''
  }
</div>

<div class="fuss">
  <div>
    ${esc(firma.legal_name || firma.name)}<br>
    ${esc(firma.address || '')}<br>
    ${esc([firma.zip, firma.city].filter(Boolean).join(' '))}
  </div>
  <div>
    ${firma.phone ? `${esc(firma.phone)}<br>` : ''}
    ${firma.email ? `${esc(firma.email)}` : ''}
  </div>
  <div>
    ${firma.tax_number ? `Steuernummer ${esc(firma.tax_number)}<br>` : ''}
    ${firma.vat_id ? `USt-IdNr. ${esc(firma.vat_id)}` : ''}
  </div>
</div>
</body>
</html>`
}
