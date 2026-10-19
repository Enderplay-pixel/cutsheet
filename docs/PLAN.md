# Dauerlauf-Plan

Steuerdatei für den unbeaufsichtigten Dauerlauf (geplante Aufgabe
`cutsheet-chef`, stündlich). Jeder Lauf liest diese Datei, nimmt den obersten
offenen Punkt, lässt ihn von einem Arbeiter-Subagenten umsetzen, prüft das
Ergebnis selbst nach und committet lokal. Florian liest am Ende
`docs/RUNDEN.md` und diese Datei.

Angelegt 19.10.2026. Was Florian sagt, hat Vorrang vor dieser Datei.

## Ziel

Ein CutSheet, das man einer echten Produktion ohne Begleitung in die Hand
geben kann: keine Lücke im Zugriffsschutz, kein stiller Fehler in den
Oktober-Modulen, jede Seite übersetzt und am Telefon bedienbar, jedes PDF
sauber. Neue Funktionen erst, wenn das steht.

## Feste Grenzen

- **Nie pushen, nie deployen.** Ein Push auf master geht automatisch live nach
  Render. Florian entscheidet über das Ausliefern.
- Keine Mails, keine Veröffentlichung, nichts nach außen.
- `ensureTestAdmin()` nicht anfassen - offene Entscheidung von Florian.
- Kein Hosting-Umzug, keine neuen Dienste, keine neuen Konten.
- Neue npm-Abhängigkeiten nur, wenn ein Punkt ohne sie nicht lösbar ist, und
  dann mit Begründung in `docs/RUNDEN.md`.
- Vor jedem Commit grün: Client- und Server-`tsc --noEmit`, `vitest run` im
  Server, `npm run build` im Client.
- Bindestrich, nie Gedankenstrich. Echte Umlaute.
- Gemessen, nicht gelesen: Ein Punkt gilt erst als erledigt, wenn eine Messung
  (Test, Scan, Browser) ihn belegt.

## Offene Punkte

Reihenfolge ist Priorität. Der Lauf darf Punkte ergänzen, wenn eine Messung
einen neuen Fehler zeigt - dann mit Beleg und an der passenden Stelle, nicht
hinten angehängt.

- [ ] **2c. Zugriffsscan ohne blinde Flecken.** Kind-IDs für jeden
  Pfadabschnitt aus dem Schema ableiten (Abschnitt → Tabelle), für jede
  Tabelle eine Zeile der Inhaberin anlegen und melden, welche Routen der Scan
  nicht mit einer echten ID treffen konnte. Danach muss der Scan die Lücken aus
  Runde 3 mit zurückgenommenen Fixes finden - sonst ist er weiter blind.
- [ ] **3b. Gedankenstriche raus.** Florians Regel gilt ausnahmslos, auch in
  der App: 195 Fundstellen von „—" und „–" in `client/src` (Stand 19.10.,
  ohne Kommentare gezählt), meist als Platzhalter für leere Werte. Alle
  sichtbaren durch "-" ersetzen, ebenso in Server-Texten, PDFs, Mails und
  `i18n.ts`. Kommentare dürfen bleiben. Danach ein Test, der neue Fundstellen
  in sichtbarem Text meldet.
- [ ] **4. PDFs der Oktober-Module.** Rechnung, Storno, Mahnung, Angebot,
  Vertrag, Abnahmeprotokoll, Reisekostenabrechnung, Projektabschluss: gültige
  Datei, Umlaute, lange Texte, Seitenumbruch, Beträge in Cent korrekt. Jedes
  PDF einmal erzeugen und ansehen.
- [ ] **5. Geld rechnet richtig.** Rechnungssummen, Teilzahlungen,
  Mahngebühren, Umsatzsteuer, KSK, Verpflegungspauschalen: Grenzfälle mit
  Tests (Rundung, 0 Cent, negative Beträge, Storno nach Teilzahlung).
- [ ] **6. Oktober-Seiten im Browser.** Jede neue Seite lokal mit
  Großproduktion aufrufen: Leerzustand, Ladezustand, Fehlermeldung bei
  Serverfehler, Telefonbreite 375 px ohne Seitenscrollen.
- [ ] **7. Übersetzung.** 56 von 87 Seiten übersetzt (Stand 13.10.). Die
  übrigen nach Nutzungshäufigkeit nachziehen; wenn alle durch sind,
  `teilweise` in `client/src/lib/i18n.ts` entfernen.
- [ ] **8. Erste fünf Minuten, noch einmal.** Neues Konto, neue Firma, erstes
  Projekt, erste Rechnung - ohne Vorwissen durchspielen und alles beheben, was
  hakt.
- [ ] **9. Leistung der Oktober-Module** mit der Großproduktion messen
  (Abfragen je Anfrage, Antwortzeit), Ausreißer beheben.
- [ ] **10. `CUTSHEET.md` auf Stand bringen** - Zahlen neu messen, neue
  Abschnitte für das, was im Dauerlauf entstanden ist.

## Erledigt

(Der Lauf verschiebt Punkte hierher, mit Commit-Hash und Datum.)

- [x] **1. Zugriffsscan lesend** - 19.10.2026, Leck `dateien/fristen` geschlossen, 192 Routen, 0 Befunde. Siehe RUNDEN.md Runde 1.
- [x] **2. Zugriffsscan schreibend** - 19.10.2026, 339 Aufrufe, ein Leck (Sperrzeiten mit fremder castId) geschlossen. Siehe RUNDEN.md Runde 2.
- [x] **2b. Fremdschlüssel im Anfragekörper** - 19.10.2026, 57 Lücken plus 9 DELETE-Routen geschlossen. Siehe RUNDEN.md Runde 3.
- [x] **3. Öffentliche Token-Seiten** - 19.10.2026, Zurückziehen für Vertrag, Abnahme, Casting; Rollenprüfung. Siehe RUNDEN.md Runde 3.
