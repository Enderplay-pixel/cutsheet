# Übersetzung der Oberfläche

Florian hat am 19.10.2026 entschieden: Die ganze Oberfläche wird übersetzt,
Deutsch, Englisch, Französisch. Diese Datei ist die Richtlinie dafür.

## Aufbau

- Je Seite eine Textdatei `client/src/lib/texte/<Seite>.ts`, z. B.
  `client/src/lib/texte/Rechnungen.ts`. Sie exportiert ein oder mehrere
  Objekte im Stil von `client/src/lib/i18n.ts`:

  ```ts
  import type { Lang } from '@/lib/i18n'

  type Text = Record<Lang, string>

  export const rechnungenT = {
    titel:      { de: 'Rechnungen', en: 'Invoices', fr: 'Factures' },
    anzahl:     { de: '{n} Rechnungen', en: '{n} invoices', fr: '{n} factures' },
  } satisfies Record<string, Text>
  ```

- Komponenten unter `client/src/components/...` bekommen
  `client/src/lib/texte/komponenten/<Komponente>.ts`.
- In der Komponente: `const tt = useT()` aus `@/lib/useT`, dann
  `tt(rechnungenT.titel)`. Platzhalter wie `{n}` mit `.replace('{n}', ...)`.
- Vorhandene gemeinsame Wörter aus `client/src/lib/i18n.ts` dürfen benutzt
  werden (`uiT.save`, `uiT.cancel`, `uiT.delete` ...). **`i18n.ts` selbst wird
  nicht geändert** - mehrere Leute arbeiten parallel.
- Hooks nur in Komponenten. Steht ein Text in einem Objekt auf Modulebene
  (etwa `const STATUS = { entwurf: { label: 'Entwurf', ... } }`), wird `label`
  zu einem `{ de, en, fr }`-Objekt und erst beim Zeichnen mit `tt()` aufgelöst.
  Hilfsfunktionen außerhalb von Komponenten bekommen `tt` oder das
  Gebietsschema als Parameter.

## Datum, Uhrzeit, Zahlen, Beträge

`useGebietsschema()` aus `@/lib/useT` liefert `de-DE`, `en-GB` oder `fr-FR`.
Jedes feste `'de-DE'` in `toLocaleDateString`, `toLocaleString`,
`toLocaleTimeString` und `Intl.NumberFormat` der Datei wird dadurch ersetzt.
Beträge bleiben in Euro. Eine `timeZone`-Angabe bleibt, wo sie steht.

## Was übersetzt wird

Alles, was ein Mensch sieht oder hört: JSX-Text, `placeholder`, `title`,
`aria-label`, `alt`, `label`, Toast-Titel und -Beschreibungen, `confirm()`,
Leerzustände, Fehlertexte, die der Client selbst formuliert, Tabellenköpfe,
Auswahllisten-Beschriftungen, Tooltips.

## Was nicht übersetzt wird

- Werte, die an den Server gehen oder von dort kommen (Status `entwurf`,
  Rollen, Enum-Werte) - nur ihre **Beschriftung** wird übersetzt.
- Fehlermeldungen vom Server (`fehler.message`) - die kommen auf Deutsch.
- Nutzerdaten, Routen, Query-Keys, CSS-Klassen, Kommentare.
- Beispielwerte in Platzhaltern, die eine Eingabe zeigen (`B-AB 1234`,
  `name@beispiel.de`), dürfen bleiben, wo sie sprachneutral sind; sonst
  übersetzen.

## Regeln für alle drei Sprachen

- Der **deutsche Text bleibt Wort für Wort, wie er ist.** Er wird nur in die
  Textdatei verschoben. Keine Verbesserungen, keine Umformulierung.
- **Bindestrich "-", niemals Gedankenstrich** (weder Halbgeviertstrich noch
  Geviertstrich), auch im Englischen und Französischen.
- Echte Umlaute im Deutschen. Französisch mit korrekten Akzenten.
- Englisch: britische Schreibweise (`colour`, `organise`), passend zu `en-GB`.
- Französische Apostrophe gerade (`'`), String dann in doppelten
  Anführungszeichen.
- Rechtliche deutsche Begriffe bleiben erkennbar: deutscher Begriff in
  Klammern dahinter, z. B. `Artists' social contribution (KSK)`.

## Glossar

| Deutsch | Englisch | Französisch |
|---|---|---|
| Tagesdispo, Dispo | call sheet | feuille de service |
| Drehtag | shoot day | jour de tournage |
| Drehplan | shooting schedule | plan de tournage |
| Drehbuch | script | scénario |
| Szene | scene | scène |
| Einstellung | shot | plan |
| Achtel | eighths | huitièmes |
| Motiv | location | décor |
| Stab | crew | équipe |
| Besetzung | cast | casting |
| Darstellerin, Darsteller | actor | comédien(ne) |
| Figur | character | personnage |
| Komparsen | extras | figurants |
| Abteilung | department | département |
| Abgedreht | shot | tourné |
| Drehschluss | wrap | fin de tournage |
| Kalkulation | budget | budget |
| Gage, Tagesgage | fee, day rate | cachet, cachet journalier |
| Firma | company | société |
| Auftraggeber | client | client |
| Rechnung | invoice | facture |
| Angebot | quote | devis |
| Festschreiben | finalise | valider |
| Stornieren, Storno | cancel invoice, cancellation | annuler, annulation |
| Mahnung | payment reminder | relance |
| Offene Posten | open items | créances ouvertes |
| Umsatzsteuer | VAT | TVA |
| Künstlersozialabgabe (KSK) | artists' social contribution (KSK) | cotisation sociale des artistes (KSK) |
| Jugendarbeitsschutz | protection of young workers (JArbSchG) | protection des jeunes travailleurs (JArbSchG) |
| Verpflegungspauschale | meal allowance | indemnité de repas |
| Vertrag | contract | contrat |
| Einverständnis | consent | consentement |
| Agentur | agency | agence |
| Abnahme | client approval | validation client |
| Fassung | cut | version |
| Anmerkung | note | remarque |
| Ablage | files | documents |
| Projektabschluss | project wrap-up | clôture du projet |
| Papierkorb | bin | corbeille |

## Prüfen

- `python scripts/texte-pruefen.py <Dateien>` meldet Texte, die nicht über
  `tt()` laufen. Ziel: 0. Ein Fund, der wirklich keine Oberfläche ist, wird
  mit `// texte-ok` am Zeilenende ausgenommen.
- `cd client && npx tsc --noEmit` fehlerfrei.

## Rechtstexte

Impressum und Datenschutzerklärung werden übersetzt. Oben steht in Englisch
und Französisch ein Hinweis, dass die deutsche Fassung verbindlich ist.
