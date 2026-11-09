# Abschlussbericht: Produktions- und Funktionstest von CutSheet

**Testobjekt:** https://cutsheet.onrender.com, Version v1.2 alpha (Live-System)
**Testdatum:** 09.11.2026
**Testprojekt:** „SALZWIND“, fiktiver Kinospielfilm (Projekt-ID 26, Firma „Nordlicht Film“, ID 1)
**Perspektive:** Produzentin und Herstellungsleitung einer Kinoproduktion
**Testkonten (fiktiv):** Mara Krüger (Inhaberin/Admin), Henrik Asmussen (über Einladung, Rolle „Regie“)

---

## 0. Vorbemerkung zur Testmethode und ihren Grenzen

- **Bedienung:** Der Test lief mit einem ferngesteuerten Chromium-Browser (Playwright, 1440 × 900 px, zeitweise 390 px mobil). Alle Aktionen liefen über die Oberfläche: echte Mausklicks, Tastatureingaben Zeichen für Zeichen, Drag-and-drop mit der Maus und die Dateiauswahl über die Datei-Felder. Es gab keine API-Aufrufe, Datenbankzugriffe oder DOM-Manipulationen. Den Quelltext im Repository habe ich nur gelesen, um beobachtetes Verhalten richtig einzuordnen (zum Beispiel ob ein Klickproblem an mir oder an der App liegt).
- **Grenzen der Testumgebung:**
  - Das Netz der Testumgebung erlaubte nur `cutsheet.onrender.com`. Externe Dienste aus dem Browser (Wetterabruf, Kartenkacheln) waren blockiert und sind deshalb **nicht bewertbar**.
  - Headless-Chromium formatiert Datums- und Zahlenfelder nach US-Locale (MM/TT/JJJJ, Dezimalpunkt). Befunde zu Datums- und Kommaeingaben sind entsprechend gekennzeichnet.
  - Der Server hat **kein SMTP** eingerichtet. Alle Wege über Mail-Links ohne Konto (Dispo bestätigen `/dispo/:token`, Vertrag `/vertrag/:token`, Agenturantwort `/casting/:token`, Abnahme `/abnahme/:token`) waren über die Oberfläche **nicht erreichbar**, weil es keinen „Link kopieren“ gibt.
  - In der Szenen-, Motiv- und Geräteliste lösten Mausklicks auf Knöpfe *innerhalb* aufklappbarer Zeilen in meiner Automatisierung nur das Aufklappen aus. Per Tastatur (Fokus + Enter) funktionierten sie. Ob das auch echte Mausnutzer betrifft, kann ich nicht sicher sagen. Ich führe es als „in Automatisierung reproduzierbar“.
- **Eigene Fehler während des Tests** (offen benannt, keine App-Fehler):
  - Ein Skript hat zunächst mehrere Stabmitglieder in dieselbe Zeile getippt.
  - Budgetpositionen landeten zunächst in falschen Kategorien.
  - Durch einen zu weiten Filter habe ich eine Kinderkomparsin gelöscht.
  - Abgebrochene Läufe haben Doppeleinträge erzeugt (Sperrtage, Komparse, Finanzierungsposten, eine leere Shotlist-Zeile).

  Alles wurde über die Oberfläche korrigiert. Diese Fälle haben aber echte UX-Erkenntnisse geliefert (siehe unten).

---

## 1. Zusammenfassung der Anwendung

CutSheet ist eine deutschsprachige Web-Anwendung (React/Node/PostgreSQL, PWA) für die Produktionsorganisation von Film und Video, von Drehbuch und Szenen über Besetzung, Stab, Motive und Drehplan bis zu Tagesdispo, Tagesbericht, Budget, Verträgen, Abnahme und Rechnungswesen der Produktionsfirma. Hinzu kommt ein Creator-Modus für Online-Video.

Die Anwendung hat **55 Projektbereiche** in 8 Kategorien sowie Firmenbereiche (Adressbuch, Gagensätze, Angebote, Rechnungen, Offene Posten, Buchhaltung/DATEV, Auswertungen, KSK).

Besonders stark ist sie überall dort, wo **deutsches Recht** hineinspielt: Jugendarbeitsschutz nach § 6 JArbSchG, Verpflegungsmehraufwand nach § 9 Abs. 4a EStG, Rechnungsnummernkreise, Verzugszinsen, Künstlersozialabgabe und Aufbewahrungsfristen. Diese Funktionen sind rechnerisch korrekt und mit Quellen erklärt.

Die Oberfläche ist hochwertig gestaltet, schnell und durchgehend auf Deutsch. Englisch und Französisch sind als „teilweise“ markiert.

Schwächen zeigen sich bei:
- der **Verbindung der Module untereinander** (unterschiedliche „Wahrheiten“ für Drehtage, Soll/Ist ohne Kalkulation, Deckungsbeitrag ohne Kosten),
- **uneinheitlichen Bedienmustern** (Autosave, Speichern-Knopf, Haken-Knopf; Löschen sofort, mit `confirm()` oder Papierkorb),
- einem **Rechteproblem** (die Rolle „Regie“ sieht alle Gagen),
- dem **Drag-and-drop im Drehplan**,
- **Lücken für die Kinogröße** (Massen-Komparserie, Haltetage, Kalkulationsschema, Drehort-Hierarchie, Unit-Planung).

---

## 2. Das angelegte Kinofilmprojekt „SALZWIND“

| Bereich | Inhalt (alles fiktiv) |
|---|---|
| Titel / Genre / Format | SALZWIND · Historisches Drama / Katastrophenfilm · Spielfilm, 118 Min. |
| Logline / Kurzinhalt | Hamburg, Februar 1962: Die junge Deichwärterin Johanna Behrens entdeckt Sickerstellen im Elbdeich und kämpft gegen eine Behörde, die marode Deiche verschweigt, bis in der Nacht des 16. Februar die Sturmflut kommt und sie zwischen der Rettung ihres Bruders und der eines ganzen Stadtteils wählen muss. |
| Produktion | Nordlicht Filmproduktion GmbH (Hamburg), Koproduktion mit Elbwerk Pictures und Skagen Film ApS (DK); Produzentin Mara Krüger, Regie Henrik Asmussen, DoP Lene Hartwig, Drehbuch Ilka Brodersen |
| Drehzeitraum | 01.03.–30.04.2027 (Stammdaten); Drehplan Block 1: 20 Drehtage vom 01.03. bis 26.03.2027 (Mo–Fr), davon 18 belegt und 2 Reserve |
| Drehbuch | Fountain/FDX-Drehbuch (3. Fassung) mit 19 Kernszenen per Import, 13 weitere per Textimport, gesamt **32 Szenen, 29 3/8 Seiten**, mit Nummer 13A, INT/EXT-Fahrszene, Nacht-, Dämmerungs- und Wasserszenen; vollständiger Breakdown (Requisite, Kostüm, SFX, VFX, Fahrzeuge, Tiere, Stunts) |
| Figuren / Besetzung | 12 Figuren, 10 Darstellerinnen und Darsteller mit Agentur, Tagesgage und Geburtsdatum, darunter ein 11-jähriger Kinderdarsteller mit Bewilligung nach § 6 JArbSchG und Erziehungsberechtigter |
| Komparserie | 4 Einträge (2 Kleindarsteller, 1 Kinderkomparsin 9 J., 1 Sammeleintrag „40 Freiwillige“) |
| Stab | 34 Personen in 14 Abteilungen, Gesamtgage 18.240 €/Tag |
| Agenturen | 3 Agenturen auf Firmenebene, 1 Besetzungsanfrage (2 Rollen) |
| Motive | 27 Motive, davon 9 vollständig (Adresse, Ansprechpartner, Miete, Koordinaten, Hinweise); 1 Motivvertrag digital unterschrieben |
| Sperrtage | 3 (Theaterverpflichtung, Feiertag, Klassenfahrt) mit 2 absichtlich provozierten Konflikten |
| Drehplan | 20 Drehtage, alle 32 Szenen verteilt, 2 Versionen gesichert |
| Tagesdispo | Drehtag 4 vollständig (Call-Zeiten, Abholorte, Hinweise, Sicherheits- und Jugendschutzhinweise); PDF und Script Sides |
| Logistik | 3 Fahrzeuge, 1 Hotel (Kontingent), 1 Reise mit Verpflegungspauschale, 5 Equipment-Positionen (74.180 €) mit Buchungen und erkannter Doppelbuchung, Catering-Präferenzen und Allergien |
| Budget | Kalkulation **4.736.380 €** (automatisch übernommene Gagen und Equipment sowie Above-the-line, Studio/Wasserbecken, VFX 1,45 Mio., Musik, Versicherung, Komparserie, Catering, HU, Reserve) |
| Finanzierung | 7 Geldgeber = 100 % (regionale/nationale Förderung, deutsch-dänischer Fonds, Sender, Verleih-MG, Koproduzent DK, Eigenanteil) |
| Dreh (simuliert) | Tagesbericht DT1, Kamerabericht mit Take, 3 Timesheets, Check-in, Shotlist (2 Einstellungen), VFX-Shot, Continuity-Eintrag, Set-Plan |
| Post | 8 Postphasen, GEMA-Musikcue, Fassung „Rohschnitt 1“, Abnahmerunde an die Senderredaktion |
| Organisation | 3 Aufgaben mit Status-Workflow, Versicherung, Ablage (Drehgenehmigung mit Ablaufdatum), Moodboard, Pinboard, Szenenkommentar, Kalendertermine |
| Firma / Finanzen | Angebot A-2026-0001 → Rechnung 2026-0001 (249.900 € brutto) → bezahlt; Gagensätze; Auswertungen; KSK |
| Verträge | Darstellervertrag (Hauptrolle), Einverständnis der Erziehungsberechtigten (Kind) |

Die Zahl von 32 Szenen ist für 118 Minuten ein Auszug. Ein echtes Drehbuch hätte rund 110 Seiten und 42 Drehtage. Ich habe den Umfang so gewählt, dass jede Funktion mit realistischen, zusammenhängenden Daten geprüft werden konnte.

---

## 3. Übersicht aller entdeckten Seiten und Funktionen

**Legende:**
- ✅ getestet, funktioniert
- ❌ getestet, fehlerhaft
- ◐ teilweise getestet oder funktioniert mit Einschränkungen
- ⊘ nicht testbar
- — nicht vorhanden

### Konto und Allgemein

| Funktion | Status | Bemerkung |
|---|---|---|
| Registrierung | ✅ | Pflichtfelder, @-Prüfung, mind. 8 Zeichen (nur native Browserhinweise) |
| Login / Logout / geschützte Seiten | ✅ | „Ungültige Anmeldedaten“; ohne Login Umleitung auf /login |
| Passwort vergessen | ⊘ | ohne SMTP nicht durchführbar |
| Passwort ändern | ◐ | Hinweis „stimmen nicht überein“ ok; falsches aktuelles Passwort ergibt HTTP 400, keine sichtbare Meldung gefunden |
| Zweiter Faktor (TOTP) | ◐ | Bereich angesehen, nicht aktiviert (Konto sollte nutzbar bleiben) |
| Angemeldete Geräte | ✅ | Liste mit IP und Zeit |
| Sprache DE/EN/FR | ✅ | EN geprüft (Drehplan, Navigation), FR als „teilweise“ markiert |
| Hell/Dunkel | ✅ | |
| Arbeitsplatz-Anordnung (Drag-and-drop) | ◐ | Maus funktioniert und wird gespeichert; Tastatur nur innerhalb einer Kategorie; Ziehen am Text markiert nur Text |
| Erst-Assistent „Dein erstes Projekt“ | ✅ | Projekt entsteht schon in Schritt 3 |
| Einführungen beim ersten Öffnen | ✅ | z. B. Stäbchenplan (2 Schritte) |
| Strg+K-Suche | ✅ | springt zum Treffer |
| Feedback-Dialog | ✅ | Fehler/Idee/Allgemein (nicht abgeschickt) |
| Impressum / Datenschutz | ❌ | Platzhalter „[VOR- UND NACHNAME DES BETREIBERS]“ auf der Live-Seite |
| 404-Seite | ✅ | |
| Fremdes Projekt aufrufen | ◐ | API sperrt (403), Oberfläche zeigt leeres Dashboard statt „kein Zugriff“ |
| /admin als normaler Nutzer | ✅ | stille Umleitung |
| Mobile Ansicht (390 px) | ✅ | Drehplan und Dispo ohne horizontales Überlaufen |
| Set-App /set | ◐ | lädt mit Projekt-/Drehtagwahl und Reitern; nicht im Detail bedient |
| Creator-Modus | — / nicht getestet | für Kinoproduktion nicht relevant, bewusst ausgelassen |

### Projektverwaltung

| Funktion | Status | Bemerkung |
|---|---|---|
| Neues Projekt, Projektliste | ✅ | |
| Duplizieren | ✅ | „(Kopie)“, Status und Termine zurückgesetzt |
| Archivieren / Archiv / Wiederherstellen | ✅ | |
| Projekt löschen | ✅ / Risiko | nur `confirm()`, keine Namenseingabe |
| Projekt abschließen / wieder öffnen | ✅ | |
| Abschluss-Prüfliste | ✅ | stark |
| Stammdaten (Autosave) | ◐ | Laufzeit „-5“ gespeichert; Drehschluss vor Drehbeginn und Jahr 42027 ohne Warnung |
| Einladungslink mit Rolle | ✅ | Annahme mit 2. Konto erfolgreich |
| Rollenrechte Regie | ❌ | sieht alle Gagen und die Kalkulation |

### Entwicklung

| Funktion | Status | Bemerkung |
|---|---|---|
| Drehbuch-Import FDX / Fountain | ❌ | Pseudoszene „IMPORT“, Szenennummern ignoriert, INT./EXT. falsch, `&#x27;` nicht dekodiert, zweiter Import hängt Duplikate an |
| Textimport Szenen | ◐ | ungültige Zeilen still übersprungen, INT./EXT. falsch |
| Szenenliste: Bearbeiten (alle Felder), Breakdown | ✅ | Autosave zuverlässig, Achtelsumme korrekt |
| Szenen löschen / Abgedreht-Haken | ◐ | per Tastatur ok; Mausklick klappt in der Automatisierung nur die Zeile auf |
| Filter und Suche Szenen | ◐ | INT/EXT-Szenen fehlen in beiden Filtern; Breakdown nicht durchsuchbar |
| Export Fountain | ◐ | ohne Szenennummern; „Autor“ = Regie |
| Drehbuch-Editor | ◐ | Import und Anzeige geprüft, Schreibfunktion nur angesehen; PDF nicht geprüft |
| Figuren (anlegen, bearbeiten, löschen) | ✅ | |
| Moodboard (Bild, Notiz, Farbe) | ✅ | |
| Szenen-Kommentare | ◐ | Autor „Unbekannt“, kein „Erledigt“ in der Oberfläche |

### Casting und Team

| Funktion | Status | Bemerkung |
|---|---|---|
| Darsteller | ◐ | Geburtsdatum geht bei Tab-Verlassen verloren |
| Besetzungsliste CSV/PDF | ✅ | PDF ohne Cast-Nummern |
| Sperrtage | ✅ | Bis-vor-Von gesperrt (ohne Erklärung) |
| Komparsen | ◐ | Löschen ohne Rückfrage und ohne Papierkorb |
| Stab inkl. Tagessumme | ✅ | |
| Stab CSV/PDF | ✅ | |
| Kontakte (Filter, Suche, CSV, vCard) | ✅ | |
| Agenturen und Besetzungsanfrage | ◐ | Status „Verschickt“, obwohl nichts versendet wurde |
| Agentur-Antwortportal | ⊘ | kein SMTP, kein Link |
| Verträge: Vorlagen, Entwurf, PDF | ❌ | leere Platzhalter, falscher Firmenname, Listen-Formatfehler |
| Jugendschutz | ✅ | sehr stark |
| Vertrag bestätigen ohne Konto | ⊘ | |

### Planung und Vorbereitung

| Funktion | Status | Bemerkung |
|---|---|---|
| Motive (Detail, Umbenennen mit Verknüpfung, Löschen) | ✅ | |
| Motivvertrag mit Canvas-Unterschrift | ✅ | |
| Motiv-PDF | nicht getestet | |
| Sonnenstand-Widget | — | nicht gefunden |
| Karte | ⊘ | durch die Sandbox blockiert |
| Drehtage (einzeln, Zeitraum, löschen) | ✅ | Zeitraum schließt Wochenenden ein |
| Drehplan Drag-and-drop | ❌ | Drop nur in der vertikalen Spaltenmitte; ungenaue Drops landen still beim Nachbartag |
| Drehplan: Verschieben zwischen Tagen, Status, Versionen, PDF | ✅ | |
| KI-Optimierung | ❌ | HTTP 400 ohne Meldung, Dialog hängt |
| Stäbchenplan | ◐ | reine Anzeige (Doku verspricht Umsortieren) |
| Kalender, Termine, .ics | ✅ | .ics-Download nicht ausgewertet |
| Konfliktradar | ✅ | stark |
| Equipment und Equipment-Kalender | ✅ | Doppelbuchung erkannt |
| Fahrzeuge | ✅ | |
| Reise und Unterkunft | ✅ | Berechnung exakt |
| Ablage | ◐ | .txt kommentarlos ignoriert |
| Catering | ◐ | Komparsen fehlen |
| Budget-Kalkulation | ◐ | Übernahme zählt Reserve-/Sperrtage, keine Haltetage; Kommaeingabe (siehe Abschnitt 0) |
| Finanzierungsplan | ◐ | kein Abgleich mit der Kalkulation |
| Budget-/Förderantrag-PDF | ✅ | |
| Kostenstand | ❌ | Soll = 0 € |
| Versicherungen | ✅ | |
| Aufgaben | ✅ | |
| Abnahme (Fassung, Runde) | ◐ | |
| Abnahme-Kundenseite | ⊘ | |

### Dreharbeiten

| Funktion | Status | Bemerkung |
|---|---|---|
| Tagesdispo (Anlage, Personen, Zeiten, Verschieben, PDF) | ✅ | Speichern-Knopf statt Autosave |
| Script Sides | ✅ | |
| Dispo versenden | ⊘ | |
| Check-in Board | ✅ | Check-in Monate vorher möglich |
| Shotlist und PDF | ✅ | |
| Set-Plan | ◐ | Elemente anlegen ok, Verschieben ohne Wirkung im Test |
| VFX-Tracking | ✅ | |
| Continuity | ✅ | |
| Kameraberichte | ✅ | |
| Tagesbericht und PDF | ✅ | |
| Zeitanalyse | ◐ | „angefangen“ zählt als „abgedreht“ |
| Timesheets, CSV, Lohnexport | ◐ | Lohnexport zählt nur Dispo-Tage |
| DOOD und CSV | ✅ | stark |

### Postproduktion und Werkzeuge

| Funktion | Status | Bemerkung |
|---|---|---|
| Postplan | ✅ | |
| Musikliste (GEMA) | ✅ | CSV nicht ausgewertet |
| E-Mail-Center (Verteiler, Vorlagen, Postausgang) | ◐ | Versand ⊘ |
| Pinboard | ✅ | |
| Aktivitätsfeed | ✅ | technische Bezeichner |
| Volltextsuche | ✅ | stark |
| Audit-Log mit Filter und CSV | ✅ | |
| Datenschutz (Auskunft, Wer sieht was) | ◐ | Auskunft als rohes JSON; „Daten entfernen“ bewusst nicht ausgeführt |
| Listen-Import | ✅ | Duplikaterkennung, alles oder nichts |
| Papierkorb mit Zurückholen | ◐ | enthält nur Szenen und Rollen |

### Firma

| Funktion | Status | Bemerkung |
|---|---|---|
| Firma anlegen, Profil, Projekt zuordnen | ✅ | |
| Gagensätze | ✅ | |
| Mitglieder | ◐ | angesehen |
| Mailvorlagen der Firma | ◐ | angesehen |
| „Was anliegt“ | ✅ | |
| Auftraggeber | ✅ | kein Feld für die Debitorennummer |
| Angebote (festschreiben, annehmen → Rechnung) | ✅ | |
| Rechnungen festschreiben | ❌ | ohne Leistungszeitraum möglich |
| Rechnungs-PDF | ◐ | öffnet neuen Tab, headless nicht auswertbar |
| Zahlungseingang | ❌ | ein Klick = voll bezahlt, ohne Betrag/Datum |
| Stornieren | nicht getestet | bewusst unterlassen |
| Offene Posten | ✅ | Mahnlauf ohne fällige Posten nur angesehen |
| Buchhaltung: CSV | ✅ | |
| DATEV ohne Kanzleidaten gesperrt | ✅ | |
| Auswertungen | ❌ | Kosten 0 €, Marge 100 % trotz Belegen |
| Künstlersozialabgabe | ✅ | |

---

## 4. PRO und CONTRA

### PRO: Was überzeugt

1. **Fachliche Tiefe beim deutschen Recht:**
   - Jugendschutz rechnet aus der Dispo: „11,8 Std. geplant, erlaubt sind 3“ und „Beginn 07:15 liegt vor 8 Uhr“, mit Antrags-Checkliste und Bewilligungsdaten.
   - Verpflegungsmehraufwand exakt: 67,20 € und nach Mittagsgestellung 11,20 €/Tag.
   - Kilometerpauschale, KSK, Verzugszinsen mit Stichtag und Aufbewahrungsfristen mit dem ehrlichen Hinweis „Quellen uneinheitlich“.
2. **Konfliktradar:** Es fand beide eingebauten Sperrtag-Konflikte (Voss am 16.03., Kind am 22.03.) als Fehler, dazu leere Drehtage und Szenen ohne Figuren, mit automatischer Prüfung alle 30 Sekunden.
3. **DOOD automatisch** aus Drehplan und Figuren (SW/W/H/F/SWF), korrekt und als CSV exportierbar.
4. **Tagesdispo-PDF auf Branchenniveau:** Crew-Call, Szenen mit Cast-IDs, Abholung, Department-Zeilen, Vorschau der Folgetage und Unterschriftsfelder. Dazu passende **Script Sides** im Courier-Satz.
5. **Dispo übernimmt Cast und Stab automatisch.** „Alle Zeiten verschieben ±15 Min.“ funktioniert serverseitig korrekt.
6. **Versionierung des Drehplans** mit automatischer Sicherung vor jeder Wiederherstellung.
7. **Budget „Kosten übernehmen“** mit Vorschau, idempotent; Handpositionen bleiben unangetastet.
8. **Exporte:**
   - CSV mit BOM, Semikolon und Dezimalkomma, Excel-tauglich.
   - Telefonnummern mit vorangestelltem `'` gegen Formel-Injection.
   - vCard und durchweg saubere PDFs (Stab, Besetzung, Dispo, Drehplan, Kalkulation, Förderantrag, Shotlist, Tagesbericht, Verträge).
9. **Volltextsuche und Strg+K:** findet sogar Dialogzeilen und Drehtage je Darsteller.
10. **Listen-Import** mit Duplikaterkennung („1 neu, 1 ergänzt“) und Alles-oder-nichts-Übernahme.
11. **Prüflisten:** Abschluss-Prüfliste und „Was anliegt“ zeigen Versäumnisse, bevor sie teuer werden (Kind ohne Bewilligung, ablaufende Genehmigung, KSK).
12. **Doppelbuchungserkennung** im Equipment-Kalender.
13. **Saubere Lösch-Rückfragen mit Folgenbeschreibung**, zum Beispiel „Dispo, Tagesbericht und Check-ins werden mit gelöscht“.
14. **Angebot → Rechnung** mit lückenlosen Nummernkreisen; Festschreiben erst bei Freigabe.
15. **Oberfläche:** ruhig, schnell, konsistentes Design, Dunkelmodus, mobil ohne Überlaufen, hilfreiche Erklärtexte.

### CONTRA: Was stört oder fehlt

1. **Mehrere Wahrheiten für dieselbe Frage („Wer dreht wann?“):**
   - Budget rechnet mit allen Drehplantagen (inkl. Reserve- und Sperrtag),
   - DOOD mit Szenenfiguren,
   - Lohnexport und Verträge nur mit Dispo-Tagen.

   Folge: Im Vertrag der Hauptdarstellerin bleiben Zeitraum und Gesamtgage leer, im Lohnexport steht sie mit 0 Drehtagen.
2. **Soll/Ist ohne Soll:** Der Kostenstand zeigt „Kalkuliert 0 €“ und meldet nach zwei Belegen „überzogen“. Die Auswertung zeigt Kosten 0 € und Marge 100 %.
3. **Rechte:** Die Rolle „Regie“ sieht alle Gagen und die Kalkulation, entgegen der dokumentierten Rechte.
4. **Drehplan-Drag-and-drop** ist auf normalen Bildschirmen kaum nutzbar: Drop nur in der Spaltenmitte, Nachbartag-Fehlzuordnung, kein Tastaturweg. Der Stäbchenplan kann nicht umsortieren.
5. **Drehbuch-Import** ist für professionelle Drehbücher nicht belastbar (Nummern, INT./EXT., Duplikate beim zweiten Import, Pseudoszene).
6. **Uneinheitliche Bedienung:**
   - Speichern: Autosave (Stammdaten, Szenen, Stab), Speichern-Knopf (Dispo-Einträge), Haken-Knopf (Komparsen, Fahrzeuge), Speichern bei Verlassen des Feldes (Geburtsdatum).
   - Löschen: sofort (Szene, Figur, Komparse, Budgetposition), `confirm()` (Sperrtag, Drehtag, Projekt), Papierkorb nur teilweise.
   - Ungespeicherte Dispo-Änderungen gehen beim Neuladen ohne Warnung verloren.
7. **Unklare Rückmeldungen:**
   - Status „Verschickt“ ohne Mailserver,
   - KI-Optimierung hängt still,
   - abgelehnte Uploads und Links ohne Fehlermeldung,
   - ungültige Uhrzeiten werden still verworfen.
8. **Fehlende Validierung:**
   - negative Laufzeit,
   - Drehschluss vor Drehbeginn,
   - Jahr 42027,
   - Rechnung ohne Leistungszeitraum,
   - Zahlungseingang ohne Betrag,
   - keine Plausibilitätswarnung bei absurden Budgetsummen.
9. **Kinogröße:**
   - keine Gruppenerfassung der Komparserie,
   - Breakdown ohne Komparserie, Ton/Playback und Sonder-Equipment,
   - keine Drehort → Motiv/Set-Hierarchie,
   - keine Units (2nd Unit, Wasser-Unit, Drohne),
   - Kalkulationskategorien ohne Rechte, HU, Reserve und Lohnnebenkosten (kein deutsches Förder-Kalkulationsschema),
   - keine Haltetage in den Gagen, keine Verleih-Wochenpauschale,
   - keine Arbeitszeitgesetz-Warnung bei Tagen über 10 Stunden,
   - Ruhezeit zwischen Wrap und nächstem Call wird nur im Konfliktradar geprüft.
10. **Medienbrüche:** Agentur, Fahrer und Zuständige sind Freitexte statt verknüpfter Personen; Drehgenehmigungen hängen an keinem Motiv; Catering an Drehtagen setzt keine Kürzung bei der Reise; der Breakdown landet nicht in den Department-Zeilen der Dispo; die Teamangaben des Assistenten werden nicht zu Stabmitgliedern.
11. **Rechtliches im Betrieb:** Impressum und Datenschutz enthalten Platzhalter.

---

## 5. Konkrete Verbesserungsvorschläge

### Benutzeroberfläche und Bedienung
- **Ein Speichermodell** für alle Inline-Tabellen (Autosave mit sichtbarem „Gespeichert“-Status). Dazu eine Warnung beim Verlassen mit ungespeicherten Änderungen.
- **Ein Lösch-Muster:** Alles Löschbare kommt in den Papierkorb (auch Komparsen, Sperrtage, Budget- und Finanzierungsposten, Projekte) und erhält einen „Rückgängig“-Toast. Projekt-Löschen mit Namenseingabe.
- **Drehplan:** Kollisionserkennung auf `pointerWithin`/`rectIntersection` umstellen; ganze Karte als Greiffläche; Tastatursensor; zusätzlich „Szene zu Drehtag …“ als Menü oder Mehrfachauswahl. Den Stäbchenplan zum eigentlichen Planungswerkzeug machen (Streifen ziehen, Tagestrenner, Banner für Unit/Ortswechsel).
- **Fehlermeldungen** für jeden abgelehnten Speichervorgang (400/403), für abgelehnte Dateitypen, ungültige Links und Uhrzeiten. Feldvalidierung mit sichtbarem Text statt nur nativer Browser-Tooltips.
- **Massenaktionen** in Szenen-, Stab- und Komparsenlisten (mehrfach auswählen, löschen, einem Drehtag oder Motiv zuordnen).
- **Feldbeschriftung „Titel“** in der Szene in „Szenenkopf/Motiv“ und „Kurzbeschreibung“ trennen.
- **Barrierefreiheit:** Labels an allen Eingaben (Darsteller, Tagesbericht-Zeiten), Tastaturbedienung für Drag-and-drop.

### Datenmodell und Verknüpfungen
- **Eine Quelle für Arbeitstage** je Person (Drehplan + Figuren → DOOD), aus der Budget, Verträge, Lohnexport, Reise und Catering lesen. Die Dispo bestätigt und verfeinert nur.
- **Kostenstand und Auswertung** an Kalkulationskategorien und Projektkosten binden (Belege mit Kategorie-Auswahl statt Freitext).
- **Drehort → Motiv/Set-Hierarchie** mit gemeinsamer Adresse, Vertrag, Genehmigungen, Basecamp, Parken und nächstem Krankenhaus (die beiden letzten Felder stehen bereits auf der Dispo).
- **Personen verknüpfen:** Agentur (Adressbuch), Fahrer (Stab), Aufgaben-Zuständige (Projektmitglieder mit Benachrichtigung).
- **Breakdown → Dispo:** Department-Zeilen automatisch aus dem Szenen-Breakdown füllen.

### Fehlende Funktionen für Kinoproduktionen
- Komparserie als Gruppen mit Anzahl, Tarif, Kostüm und Abruf je Drehtag; Catering und Budget zählen sie mit.
- Units und Parallel-Drehtage; Wetter-Cover-Sets; Tag-für-Nacht-Kennzeichen.
- Kalkulation nach deutschem Förderschema (Rechte und Stoff, Gagen, Lohnnebenkosten, HU, Überschreitungsreserve), Haltetage, Prep- und Wrap-Wochen, Verleih-Wochenpauschalen, Kostenkategorie je Position änderbar.
- Finanzierungsplan mit Soll-Ist-Abgleich zur Kalkulation (Deckungslücke), Status „beantragt / Bescheid / ausgezahlt“ und Ratenplan.
- Arbeitszeitgesetz-Prüfung (10 h/Tag, 11 h Ruhezeit, Sonn- und Feiertage) in Timesheets und Dispo; Überstunden in Euro.
- Drehbuch-Revisionen (farbige Fassungen, gelockte Seiten und Nummern, Änderungsvergleich A/B).

### Automatisierung
- Reisekosten: An Drehtagen mit Catering automatisch „Mittag gestellt“ setzen.
- Vertragsentwurf: vor dem Versand prüfen, ob alle Platzhalter gefüllt sind (sonst sperren); Fallback auf Drehplan-Tage.
- Drehgenehmigungen mit Motiv und Drehtag verknüpfen; Konfliktradar warnt, wenn ein Drehtag ohne gültige Genehmigung ist.
- Konfliktradar um Jugendschutz-Verstöße der Dispo, ArbZG und „zwei Magic-Hour-Szenen am selben Tag“ erweitern.
- Mailversand: ohne SMTP „Link kopieren“ anbieten, damit Dispo, Vertrag, Casting und Abnahme trotzdem per Messenger verteilt werden können; der Status darf erst nach tatsächlichem Versand „Verschickt“ zeigen.

---

## 6. Bewertung des Produktionsworkflows

**Alltagstauglichkeit:** Für die Kette Szenen → Besetzung/Stab → Drehplan → Dispo → Set → Tagesbericht trägt CutSheet bereits sehr weit. Die automatische Übernahme von Cast und Stab in die Dispo, die Jugendschutzprüfung, das Konfliktradar und der DOOD sparen echte Stunden in der Vorbereitung, und die PDFs kann man ohne Nacharbeit ans Set geben.

**Effizienz:** Ineffizient wird es bei großen Datenmengen:
- 20 Duplikate einzeln löschen,
- 32 Szenen einzeln per Drag-and-drop einplanen (auf normalen Monitoren nur mit Scrollen zur Spaltenmitte),
- Figuren für stumme Auftritte in 12 Szenen von Hand nachtragen,
- Komparserie einzeln erfassen.

Dazu kommt, dass ich drei Speichermodelle kennen musste, um keine Daten zu verlieren.

**Medienbrüche:**
- Mail ohne SMTP (alle Freigaben laufen über Mails, die nicht rausgehen),
- Freitextfelder statt Verknüpfungen,
- Kostenstand und Auswertung ohne Kalkulation,
- Drehgenehmigung ohne Motiv,
- Verträge nur als PDF ohne Vorschau.

**Zusammenführen und automatisieren:**
- Drehplan und Stäbchenplan zu einem Werkzeug machen,
- Budgetübernahme, Lohnexport und Verträge auf eine Tagesquelle stellen,
- Reise und Catering verknüpfen,
- Breakdown und Dispo verknüpfen,
- Genehmigungen, Motive und Konfliktradar verknüpfen.

**Eignung für größere Produktionen:** Die Daten eines Kinofilms ließen sich abbilden (34 Personen Stab, 20 Drehtage, 4,7 Mio. € Kalkulation). Bei 40+ Drehtagen, 100+ Komparsen pro Tag, mehreren Units und Revisionsständen des Drehbuchs fehlen aber die Werkzeuge für Masse und Parallelität. Die Projektdoku selbst nennt als Zielgröße „1 bis 60 Drehtage, 5 bis 150 Beteiligte“ und schließt Studiobetrieb ausdrücklich aus. Das deckt sich mit meinem Eindruck.

---

## 7. Aufgetretene Bugs mit Reproduktionsschritten

**Schweregrade:** K = kritisch, H = hoch, M = mittel, N = niedrig.

1. **[K] Rolle „Regie“ sieht Gagen und Kalkulation**
   1. Projekt → Stammdaten → Einladungslink mit Rolle „Regie“ erzeugen.
   2. Mit einem zweiten Konto über den Link beitreten.
   3. Besetzung, Stab und Budget öffnen.

   Ergebnis: Darstellergagen (63.500 €, Einzelgagen), Stab-Tagesgagen und die Kalkulation (4.736.380 €) sind sichtbar. Erwartet laut Doku: „Regie … keine Gagen“.

2. **[K] Kostenstand ohne Soll**
   1. Budget → Kalkulation mit Positionen (hier 4,74 Mio. €).
   2. Kostenstand → zwei Belege erfassen.

   Ergebnis: „Kalkuliert (Soll) 0,00 €“, Kategorien Soll 0 €, Status „ÜBERZOGEN 22.190 €“.

3. **[K] Drehplan: Drop wird nicht erkannt oder falsch zugeordnet**
   1. Bei 32 ungeplanten Szenen (Fenster 1440 × 900) eine Szene am Griff ⠿ greifen.
   2. Im oberen Drittel eines leeren Drehtags loslassen.

   Ergebnis: keine Zuordnung, kein Request. Nur in der vertikalen Spaltenmitte (ca. 1.340 px, nach Scrollen) klappt es. Ungenaue Drops landeten zweimal still beim Nachbartag. Ursache laut Code: `closestCenter` bei sehr hohen Spalten.

4. **[H] FDX-Import hängt beim zweiten Mal Duplikate an**
   1. Drehbuch-Editor → „FDX importieren“ → Datei.
   2. Denselben Import noch einmal ausführen.

   Ergebnis: Szenenzahl verdoppelt (20 → 40), keine Rückfrage. Zusätzlich: „FADE IN:“ erzeugt eine Szene „INT. IMPORT - TAG“, `Number="13A"` und Fountain `#1#` werden ignoriert oder bleiben im Text, „INT./EXT.“ wird zu INT mit Motiv „/EXT. …“, `&#x27;` erscheint wörtlich.

5. **[H] Darstellervertrag mit leeren Platzhaltern**
   1. Drehplan mit Szenen der Figur, aber keine Dispo für diese Person.
   2. Verträge → Vertrag → „Darstellervertrag“ → PDF.

   Ergebnis: „…an Drehtagen im Zeitraum .“ und „insgesamt .“, keine Warnung. Außerdem steht „Nordlicht Film“ statt des rechtlichen Namens „Nordlicht Filmproduktion GmbH“.

6. **[H] „Als bezahlt erfassen“ setzt sofort voll bezahlt**
   1. Rechnung festschreiben.
   2. „Als bezahlt erfassen“ klicken.

   Ergebnis: Status „Bezahlt“ über den vollen Betrag (249.900 €), ohne Betrags- oder Datumseingabe und ohne Rückfrage; Teilzahlung nicht möglich, Rücknahme nicht sichtbar.

7. **[H] Rechnung ohne Leistungszeitraum festschreibbar**
   1. Rechnungsentwurf, „Leistung von/bis“ leer lassen.
   2. Festschreiben.

   Ergebnis: Nummer 2026-0001 vergeben (Pflichtangabe nach § 14 Abs. 4 Nr. 6 UStG fehlt).

8. **[H] Verschickt-Status ohne Mailserver**
   1. Agenturen → Anfrage → Verschicken.

   Ergebnis: Die Anfrage steht auf „Verschickt/Wartet“, der Postausgang meldet „nicht versendet (SMTP_HOST fehlt)“.

9. **[H] Komparse ohne Rückfrage und ohne Papierkorb gelöscht**
   1. Komparsen → Zeilenknopf „Löschen“.

   Ergebnis: Eintrag sofort weg und nicht im Papierkorb.

10. **[H] Geburtsdatum geht verloren (Jugendschutz)**
    1. Besetzung → Darsteller → Geburtsdatum per Tastatur eingeben.
    2. Mit Tab verlassen und die Seite neu laden.

    Ergebnis: Feld leer, es wurde kein Request gesendet. Erst ein Klick außerhalb speichert.

11. **[H] Impressum und Datenschutz mit Platzhaltern**
    1. `/impressum` öffnen.

    Ergebnis: „[VOR- UND NACHNAME DES BETREIBERS]“, „[KONTAKT-E-MAIL]“.

12. **[M] KI-Optimierung hängt**
    1. Drehplan → KI-Optimierung → „Jetzt optimieren“.

    Ergebnis: HTTP 400, keine Meldung, der Dialog bleibt über 60 Sekunden offen.

13. **[M] Lohnexport und Verträge zählen nur Dispo-Tage**
    1. Tagesbericht und Timesheet für Drehtag 1 ohne Dispo erfassen.
    2. Timesheets → Lohnexport.

    Ergebnis: Hauptdarstellerin mit 0 Drehtagen und 0 €; Überstunden ohne Vergütung.

14. **[M] Budgetübernahme zählt Reserve- und Sperrtage**
    1. Drehtage 19 (leer) und 20 (Status „Sperrtag“) anlegen.
    2. Kosten übernehmen.

    Ergebnis: Stabgagen × 20 Tage (358.800 €); Haltetage der Darsteller fehlen.

15. **[M] Auswertung ohne Kosten**
    1. Kostenstand-Belege erfassen und eine Rechnung festschreiben.
    2. Auswertungen öffnen.

    Ergebnis: Kosten 0 €, Marge 100 %.

16. **[M] Einverständniserklärung: Zeilenumbrüche werden zu Listenpunkten**
    1. Vertrag für ein Kind → PDF.

    Ergebnis: Mitten im Satz „1. … 2. Aufsichtsbehörde … 3. Bewilligung …“.

17. **[M] Szenenfilter**
    1. Eine Szene als INT/EXT anlegen.
    2. Filter „INT“ und „EXT“ prüfen.

    Ergebnis: Die Szene fehlt in beiden.

18. **[M] Stammdaten-Validierung**
    1. Laufzeit „-5“ eingeben → „Gespeichert“.
    2. Drehschluss vor Drehbeginn setzen → keine Warnung.
    3. Durch Überschreiben des Datumsfelds das Jahr 42027 erzeugen → gespeichert.

19. **[M] Szenenliste: Mausklick auf Löschen oder Abgedreht klappt nur die Zeile auf** *(in Chromium-Automatisierung reproduzierbar, per Tastatur funktioniert es)*
    1. Mit der Maus über eine Szenenzeile fahren.
    2. Den Mülleimer anklicken.

    Ergebnis: Die Zeile klappt auf, nichts wird gelöscht. Ähnlich bei Motiven.

20. **[M] Szenen-Kommentar zeigt Autor „Unbekannt“**, und es gibt keinen „Erledigt“-Knopf.

21. **[N] Zeitanalyse** zählt „angefangene“ Szenen als „abgedreht“ (2 statt 1).

22. **[N] Kopfzeile Szenenübersicht** zeigt „ca. 990 Min.“ (= Seiten × 60), ignoriert die eingetragenen Drehzeiten und ist nicht beschriftet.

23. **[N] Stilles Verwerfen von Eingaben:**
    - ungültiger Fassungslink: HTTP 400 ohne Text,
    - .txt in der Ablage: ignoriert,
    - Call-Zeit „25:99“: verworfen,
    - ungültige Textimport-Zeilen: übersprungen.

24. **[N] Fremdes Projekt:** `/projects/999999` zeigt ein leeres Dashboard statt „nicht gefunden/kein Zugriff“. Ebenso `/firma/1` für Nicht-Mitglieder.

25. **[N] Check-in Monate vor dem Drehtag möglich**; Motive aus gelöschten Szenen bleiben als Waisen stehen.

---

## 8. Eignung nach Produktionsgröße

| Größe | Eignung | Begründung |
|---|---|---|
| **Klein** (Kurzfilm, Werbung, Imagefilm; 1–10 DT, < 30 Personen) | **Gut bis sehr gut** | Datenmengen klein, Drag-and-drop- und Massenprobleme fallen kaum ins Gewicht. Dispo, Verträge, Rechnungen und Reisekosten in einem System sind ein echter Vorteil gegenüber Word/Excel. |
| **Mittel** (Fernsehfilm, kleiner Kinofilm; 15–30 DT, 30–80 Personen) | **Bedingt geeignet** | Die Kernkette trägt. Nötig sind aber Disziplin bei den Speichermodellen, Handarbeit bei Figuren und Komparserie sowie ein eigenes Budget-Controlling außerhalb (Kostenstand und Auswertung sind ohne Soll und Kosten). Rechte-Problem beachten: der Regie-Zugang zeigt Gagen. |
| **Groß** (Kino, 40+ DT, mehrere Units, 100+ Komparsen, Koproduktion) | **Derzeit nicht geeignet als Hauptsystem** | Es fehlen Units, Massen-Komparserie, Drehbuch-Revisionen, ein belastbarer Import, ein planungsfähiges Stripboard, ein Förder-Kalkulationsschema, Soll/Ist und ein Rechtemodell für Gagen. Gut nutzbar wären einzelne Module (Jugendschutz, Konfliktradar, DOOD, Dispo-PDF, Reisekosten). |

---

## 9. Priorisierte Liste der wichtigsten Verbesserungen

1. **Rollenrechte für Gagen und Budget** durchsetzen (Regie und Abteilungsleitungen ohne Geldsicht), in API und Oberfläche.
2. **Eine Quelle für Arbeitstage** (Drehplan/DOOD) für Budget, Verträge, Lohnexport, Reise und Catering; Haltetage berücksichtigen.
3. **Kostenstand und Auswertung mit der Kalkulation verbinden** (Soll aus Kalkulation, Belege mit Kategorie und Projekt).
4. **Drehplan-Drag-and-drop reparieren** (Kollisionserkennung, ganze Karte, Tastatur) und den Stäbchenplan planungsfähig machen.
5. **Drehbuch-Import professionalisieren:** Szenennummern übernehmen, INT./EXT. und Entities korrekt verarbeiten, Titelseite erkennen, beim erneuten Import „ersetzen / abgleichen / als Revision“ anbieten.
6. **Vertragsentwürfe absichern:** keine leeren Platzhalter, rechtlicher Firmenname, Listenformatierung korrigieren, Vorschau im Browser.
7. **Rechnungswesen absichern:** Leistungszeitraum als Pflicht, Zahlungseingang mit Betrag, Datum und Teilzahlung, Rücknahme.
8. **Einheitliches Speicher- und Löschmodell** mit Papierkorb für alles und Warnung bei ungespeicherten Änderungen.
9. **Ehrliche Statusanzeigen und Fehlermeldungen** (Versand ohne SMTP, KI, Uploads, Validierungen) und „Link kopieren“ für alle Freigabe-Links.
10. **Kino-Funktionen:** Komparserie als Gruppen, Units, Drehort-Hierarchie, Förder-Kalkulationsschema, ArbZG-Prüfung, Drehbuch-Revisionen.
11. **Impressum und Datenschutz** des Live-Systems vervollständigen.

---

## 10. Gesamtbewertung (1 = sehr schlecht, 10 = hervorragend)

| Kriterium | Note | Kurzbegründung |
|---|---|---|
| Benutzerfreundlichkeit | **6/10** | Schöne, klare Oberfläche mit guten Erklärtexten; abgewertet wegen uneinheitlicher Speicher- und Löschmuster, stiller Fehler, des schwer bedienbaren Drehplan-Drag-and-drops und fehlender Massenaktionen. |
| Funktionsumfang | **8/10** | Erstaunlich breit (55 Projektbereiche plus Firmenfinanzen) und in Recht und Steuern tief; für Kino fehlen Units, Massen-Komparserie, Revisionen und ein Förderschema. |
| Stabilität | **6/10** | Keine Abstürze, keine Datenkorruption, Autosave zuverlässig; aber eine Reihe funktionaler Fehler (Import-Duplikate, leere Vertragsfelder, Soll 0 €, Drop-Erkennung, verlorenes Geburtsdatum). |
| Produktionsworkflow | **6/10** | Die Kette Szene → Dispo → Set → Bericht ist stark verzahnt; Geld- und Vertragsseite rechnen mit abweichenden Datenquellen. |
| Professionalität | **7/10** | Dispo-, Sides-, Stab-, Kalkulations- und Rechnungs-PDFs auf Branchenniveau, Rechtsbezüge mit Quellen; abgewertet wegen Rechteproblem, Impressum-Platzhaltern und Vertragsfehlern. |
| **Gesamteignung für Kinofilmproduktionen** | **5/10** | Als Hauptsystem für einen Kinofilm dieser Größe noch nicht tragfähig; als Werkzeugkasten für Dispo, Jugendschutz, DOOD, Konflikte und Reisekosten schon heute wertvoll. Mit den Punkten 1–6 der Prioritätenliste realistisch bei 7 bis 8. |

---

*Testprotokoll mit über 130 Einzelbefunden, Screenshots und heruntergeladenen Exporten liegt in der Testumgebung vor. Alle Personen, Firmen, Adressen, Telefonnummern (Bereich 5550) und E-Mail-Adressen (`*.example`/`example.com`) sind frei erfunden.*
