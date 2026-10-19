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

- [ ] **7. Übersetzung - zurückgestellt.** Gemessen: nur 14 von 87 Seiten übersetzt, nicht 56. Umfang und Sinn sind Florians Entscheidung, siehe ENTSCHEIDUNGEN-FLORIAN.md Punkt 4. Nicht anfangen, bis er entschieden hat.
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
- [x] **3b. Gedankenstriche** - 19.10.2026, 211 im Client (7aecd5e), 60 im Server (Runde 4). Wächtertest für sichtbaren Text steht noch aus.
- [x] **4. PDFs** - 19.10.2026, Textebene, Mahnungsanschrift, Abnahmeprotokoll, Zeitzone. Siehe RUNDEN.md Runde 4.
- [x] **5. Geld** - 19.10.2026, Rundung im Minus, Zahlungen an einer Stelle, Storno zum eigenen Datum. Offene Entscheidung zu Altdaten in ENTSCHEIDUNGEN-FLORIAN.md.
- [x] **2c. Scan ohne blinde Flecken** - 19.10.2026, findet die Lücken aus Runde 3 nachweislich, 1 Route ohne echte ID. Siehe RUNDEN.md Runde 6.
- [x] **8. Erste fünf Minuten** - 19.10.2026, Drehbuch-Import (jede vierte Datei scheiterte), Parser, Transaktion, Nummern, Admin-Statistik. Siehe RUNDEN.md Runde 7.
- [x] **6. Oktober-Seiten im Browser** - 19.10.2026, 12 Seiten bei 375 px ohne Überlauf, Rückfragen für endgültige Geld-Aktionen. Siehe RUNDEN.md Runde 8.
