# Die Seiten von CutSheet

Jede Seite der Oberfläche: was sie tut und wann man sie aufmacht.

Stand 21. Oktober 2026, 87 Seiten. Die Zuordnung Seite → Route stammt aus
`client/src/main.tsx`, die Beschreibung aus den API-Aufrufen der jeweiligen
Seite - nicht aus dem Gedächtnis.

Die Platzhalter in den Routen: `:id` ist das Projekt, `:companyId` die Firma,
`:token` ein Link aus einer Mail.

---

## Inhalt

- [1. Ohne Anmeldung](#1-ohne-anmeldung)
- [2. Übergreifend](#2-übergreifend)
- [3. Firma und Geld](#3-firma-und-geld)
- [4. Stoff und Drehbuch](#4-stoff-und-drehbuch)
- [5. Menschen](#5-menschen)
- [6. Planung](#6-planung)
- [7. Ressourcen](#7-ressourcen)
- [8. Am Drehtag](#8-am-drehtag)
- [9. Projektgeld](#9-projektgeld)
- [10. Postproduktion](#10-postproduktion)
- [11. Verwaltung des Projekts](#11-verwaltung-des-projekts)
- [12. Creator-Modus](#12-creator-modus)
- [13. Verwaltung der Anwendung](#13-verwaltung-der-anwendung)
- [14. Ohne Route](#14-ohne-route)

---

## 1. Ohne Anmeldung

Elf Seiten, die ohne Konto funktionieren. Fünf davon hängen an einem Token im
Pfad: Wer eine Dispo bestätigt, einen Vertrag unterschreibt, als Agentur
antwortet oder eine Fassung abnimmt, legt sich kein Konto an - er würde sonst
zurückmailen, und dann steht die Antwort in einem Postfach statt im Projekt.

| Seite | Route | Was sie tut |
|---|---|---|
| **Login** | `/login` | Anmeldung mit Mail und Passwort, zweiter Faktor wenn eingeschaltet. |
| **ForgotPassword** | `/forgot-password` | Fordert eine Mail mit Rücksetzlink an. |
| **ResetPassword** | `/reset-password/:token` | Neues Passwort über den Link aus der Mail. |
| **Impressum** | `/impressum` | Pflichtangaben nach § 5 DDG. |
| **Datenschutz** | `/datenschutz` | Datenschutzerklärung. |
| **Invite** | `/invite/:token` | Einladung in ein Projekt annehmen. Verlangt anders als die vier folgenden ein Konto - der Token sagt nur, zu welchem Projekt. |
| **PublicDispo** | `/dispo/:token` | Die eigene Tagesdisposition: Call-Zeit, Motiv, Szenen, Wetter. Bestätigen mit einem Klick. |
| **VertragBestaetigen** | `/vertrag/:token` | Vertrag lesen, als PDF öffnen, zustimmen oder ablehnen. Name und Zeitpunkt werden festgehalten. |
| **CastingAntwort** | `/casting/:token` | Eine Agentur sieht die ausgeschriebenen Rollen und meldet Vorschläge mit Verfügbarkeit, Gage und Link auf Material. |
| **AbnahmeAnsicht** | `/abnahme/:token` | Der Auftraggeber sieht die Fassung, hinterlässt Anmerkungen mit Zeitstelle und nimmt ab oder verlangt eine Runde mehr. |
| **SetApp** | `/set` | Die Ansicht fürs Telefon am Set: heutige Dispo, Einstellungen, abhaken. |

**Anwendungsfall:** Alles, was nach außen geht. Die Produktion verschickt
einen Link, der Empfänger erledigt eine Sache und ist fertig. Niemand muss
erklären, wie man sich anmeldet.

---

## 2. Übergreifend

| Seite | Route | Was sie tut | Wann man sie aufmacht |
|---|---|---|---|
| **ProjectList** | `/` | Alle Projekte, anlegen, duplizieren, archivieren, löschen; Firmenzuordnung. | Beim Start. Der Einstieg in alles. |
| **Dashboard** | `/projects/:id` | Kennzahlen des Projekts: Drehtage, Szenen, Konflikte, Fortschritt. | Nach dem Öffnen eines Projekts - der Überblick vor dem Detail. |
| **Suche** | `/projects/:id/suche` | Volltextsuche über Szenen, Rollen, Besetzung, Stab und Motive; eine Figur bringt Darsteller, Szenen und Drehtage mit. | Wenn man weiß, wie etwas heißt, aber nicht, wo es steht. |
| **Aufgaben** | `/projects/:id/aufgaben` | To-do-Liste des Projekts mit Zuständigem und Frist. Vier Stände: offen, in Arbeit, Abnahme, erledigt. | Für alles, was jemand tun muss und was sonst in einer Nachricht untergeht. |
| **ActivityFeed** | `/projects/:id/aktivitaet` | Was im Projekt zuletzt passiert ist, chronologisch. | Montags: Was haben die anderen am Wochenende gemacht? |
| **Settings** | `/settings` | Eigenes Konto: Name, Passwort, zweiter Faktor, aktive Sitzungen, Anmeldeverlauf, Datenexport, Konto löschen. | Beim Einrichten und wenn ein Gerät verlorengeht. |

---

## 3. Firma und Geld

Die Firmenebene liegt über den Projekten. Sie gibt Zugriff auf Stammdaten der
Firma, ausdrücklich **nicht** auf Inhalte fremder Projekte.

| Seite | Route | Was sie tut | Wann man sie aufmacht |
|---|---|---|---|
| **Firma** | `/firma`, `/firma/:companyId` | Firmen anlegen, Adressbuch, Gagensätze, Mailvorlagen, Mitglieder, Firmenprofil. Oben die Karte **„Was anliegt"**: offene Punkte über alle Projekte. | Täglich als erstes - die Karte sagt, was ansteht. |
| **Rechnungen** | `/firma/:companyId/rechnungen` | Auftraggeber verwalten, Rechnungen anlegen, Positionen, festschreiben, stornieren, PDF, Umsatzsteuer-Voranmeldung. | Wenn eine Leistung erbracht ist. |
| **OffenePosten** | `/firma/:companyId/offene-posten` | Was offen ist, mit Altersstruktur. Zahlungen erfassen. **Mahnlauf** mit Stichtag: zeigt je Rechnung die Aufstellung aus Betrag, Verzugszinsen, Gebühr und Pauschale. | Wöchentlich. Und bevor man jemandem hinterhertelefoniert. |
| **Angebote** | `/firma/:companyId/angebote` | Angebote mit eigenem Nummernkreis (`A-2026-0001`), festschreiben, annehmen - daraus entsteht ein Rechnungsentwurf mit denselben Positionen. | Nach jeder Anfrage. |
| **Buchhaltung** | `/firma/:companyId/buchhaltung` | Einfache Tabelle als CSV und DATEV-Buchungsstapel, mit Prüfung davor. Angaben der Kanzlei, Basiszinssatz, Mahnwesen an/aus. | Monatlich oder vor dem Termin beim Steuerberater. |
| **Auswertungen** | `/firma/:companyId/auswertungen` | Umsatz je Monat, Auftraggeber und Projekt, Deckungsbeitrag und Marge. Zweiter Reiter: **Künstlersozialabgabe** je Person und Jahr. | Quartalsweise - und im Januar für die KSK-Meldung bis zum 31. März. |

---

## 4. Stoff und Drehbuch

| Seite | Route | Was sie tut | Wann man sie aufmacht |
|---|---|---|---|
| **Stammdaten** | `/projects/:id/stammdaten` | Projektangaben, Mitglieder, Einladungen, Grundeinstellungen (Drehschluss, Ruhezeit, Währung). | Einmal am Anfang, danach selten. |
| **Drehbuch** | `/projects/:id/drehbuch` | Szenenliste mit Achteln, Innen/Außen, Tag/Nacht, Motiv, Figuren und Requisiten. Import aus Datei. | Nach dem ersten Buch - die Grundlage für alles Weitere. |
| **ScreenplayEditor** | `/projects/:id/screenplay-editor` | Drehbuch schreiben im Format, mit Blöcken, Notizen und PDF-Export (auch mit Anmerkungen). | Wenn das Buch im Haus entsteht. |
| **Shotlist** | `/projects/:id/shotlist` | Einstellungen je Szene: Größe, Bewegung, Brennweite, Dauer, bester Take. Abhaken am Drehtag, PDF nach Szenen oder nach Drehtagen. | In der Auflösung mit der Regie, dann täglich am Set. |
| **SzenenKommentare** | `/projects/:id/kommentare` | Anmerkungen an einzelnen Szenen, auflösbar. | Wenn Regie und Produktion über eine Szene reden. |
| **Moodboard** | `/projects/:id/moodboard` | Bilder und Referenzen sammeln. | In der Entwicklung, für Look und Ausstattung. |
| **Pinboard** | `/projects/:id/pinboard` | Farbige Zettel im Raster, für alle im Projekt sichtbar. | Für alles, was in keine Liste passt. |

---

## 5. Menschen

| Seite | Route | Was sie tut | Wann man sie aufmacht |
|---|---|---|---|
| **Besetzung** | `/projects/:id/besetzung` | Figuren und ihre Darsteller, Gage, Agentur, Mail, Geburtsdatum, Foto. | Sobald die Besetzung steht. |
| **Komparsen** | `/projects/:id/komparsen` | Komparserie mit Tarifgruppe und Kontakt. | Bei Massenszenen. |
| **Stabliste** | `/projects/:id/stabliste` | Der Stab nach Gewerk, mit Tagesgage und Vertragsart, als PDF. | Beim Aufbau der Crew. |
| **Kontaktliste** | `/projects/:id/kontakte` | Alle Beteiligten an einem Ort, Export als CSV und **vCard** fürs Telefon. | Vor dem ersten Drehtag - damit alle Nummern im Telefon sind. |
| **SperrtageKalender** | `/projects/:id/sperrtage` | Wann wer nicht kann. Fließt in den Konfliktradar. | Direkt nach der Besetzung, vor der Drehplanung. |
| **Agenturen** | `/projects/:id/agenturen` | Agenturen (auf Firmenebene geführt) und **Besetzungsanfragen** mit mehreren Rollen in einem Schreiben. Vorschläge einsammeln, nachfassen, übernehmen. | Im Casting, bevor die Besetzung steht. |
| **Vertraege** | `/projects/:id/vertraege` | Wer hat was unterschrieben. Verträge aus Vorlagen erzeugen, verschicken, Stand verfolgen. Zweiter Reiter: **Jugendarbeitsschutz** - prüft jeden Drehtag jedes Kindes gegen § 6 JArbSchG. | Sobald jemand zusagt. Und vor jedem Drehtag mit Kindern. |

---

## 6. Planung

| Seite | Route | Was sie tut | Wann man sie aufmacht |
|---|---|---|---|
| **Drehplan** | `/projects/:id/drehplan` | Drehtage anlegen, Szenen per Ziehen zuordnen, zwischen Tagen verschieben und innerhalb eines Tages umsortieren (Fund 265), Versionen, KI-Optimierung der Reihenfolge. | Das Herzstück der Vorbereitung. |
| **StaebchenplanNew** | `/projects/:id/staebchenplan` | Stripboard: der Drehplan als Streifen, farbig nach Innen/Außen und Tag/Nacht. Nur Ansicht - umsortiert wird im Drehplan. | Wenn man den Plan umwirft und sehen will, was das kostet. |
| **Terminkalender** | `/projects/:id/kalender` | Alle Termine des Projekts, Export als iCal fürs eigene Kalenderprogramm. | Für alles neben dem Dreh: Besprechungen, Abgaben. |
| **Konfliktradar** | `/projects/:id/konfliktradar` | Prüft den Plan: Szenen doppelt oder gar nicht eingeplant, leere Drehtage, mehrere Drehtage an einem Datum, zu kurze Ruhezeiten, Besetzung an ihren Sperrtagen (seit Fund 262), Szenen ohne Motiv oder Figuren, Motive ohne Adresse, Budget gegen Finanzierung. | Nach jeder Änderung am Drehplan. |
| **DOOD** | `/projects/:id/dood` | Day-out-of-Days: wer an welchem Tag gebraucht wird, als Raster. | Für Verträge und Verfügbarkeitsanfragen. |
| **ZeitAnalyse** | `/projects/:id/zeitanalyse` | Geplante gegen tatsächliche Drehzeit je Szene und Tag. | Nach ein paar Drehtagen: Sind wir im Plan? |
| **Motive** | `/projects/:id/motive` | Drehorte mit Adresse, Ansprechpartner, Eigentümer, Miete, Strom und Karte - und dem **Motivvertrag** je Motiv, auf dem Bildschirm unterschreibbar. | In der Motivsuche und vor jeder Genehmigung. |
| **Setplan** | `/projects/:id/setplan` | Grundrisse zeichnen: Kamera, Licht, Technik platzieren, als PDF. | Vor einem komplizierten Drehtag. |
| **Reise** | `/projects/:id/reise` | Reisen je Person mit **Verpflegungspauschalen** nach § 9 Abs. 4a EStG; zweiter Reiter Unterkünfte mit Zimmerbelegung. | Bei jedem auswärtigen Dreh. |

---

## 7. Ressourcen

| Seite | Route | Was sie tut | Wann man sie aufmacht |
|---|---|---|---|
| **Equipment** | `/projects/:id/equipment` | Equipmentlisten je Drehtag oder Gewerk, mit Mietpreis und Status. | In der Vorbereitung, dann beim Packen. |
| **EquipmentKalender** | `/projects/:id/equipment-kalender` | Wann welches Gerät wo ist - findet Doppelbuchungen. | Wenn mehrere Projekte sich Technik teilen. |
| **Fahrzeuge** | `/projects/:id/fahrzeuge` | Fahrzeuge mit Kennzeichen, Plätzen und Fahrer. | Bei Fahrgemeinschaften und auswärtigen Drehs. |
| **CateringListe** | `/projects/:id/catering` | Wer isst was nicht - Unverträglichkeiten und Vorlieben, je Drehtag ausgewertet. | Vor der Bestellung beim Caterer. |
| **Versicherungen** | `/projects/:id/versicherungen` | Policen mit Nummer, Laufzeit und Deckung. | Vor dem ersten Drehtag, und wenn ein Motiv den Nachweis verlangt. |

---

## 8. Am Drehtag

| Seite | Route | Was sie tut | Wann man sie aufmacht |
|---|---|---|---|
| **Tagesdispo** | `/projects/:id/tagesdispo`, `/tagesdispo/:dayId` | Die Disposition: General Call, persönliche Zeiten, Szenen, Motiv, Wetter. Versand per Mail mit persönlichem Bestätigungslink; Zeiten geschlossen verschieben. | Am Vortag, meist abends. |
| **CheckinBoard** | `/projects/:id/checkin` | Wer ist da: alle von der Dispo des Tages, am Set abzuhaken. (Selbst einchecken über einen Link gibt es nicht, siehe Fund 79.) | Morgens am Set. |
| **Tagesbericht** | `/projects/:id/tagesbericht` | Was wirklich gedreht wurde: Szenen, Seiten, Zeiten, Pausen, Vorkommnisse. Als PDF. | Abends nach Drehschluss. |
| **Kameraberichte** | `/projects/:id/kameraberichte` | Takes je Einstellung mit Bewertung, Karten und Speicherplatz. | Am Set durch die Kamera-Assistenz. |
| **Continuity** | `/projects/:id/continuity` | Anschlüsse: Kostüm, Maske, Requisite je Szene, mit Foto. | Am Set durch die Script/Continuity. |
| **Timesheets** | `/projects/:id/timesheets` | Arbeitszeiten je Person und Drehtag mit Überstunden; Export für die Lohnabrechnung. | Täglich erfassen, am Monatsende exportieren. |

---

## 9. Projektgeld

| Seite | Route | Was sie tut | Wann man sie aufmacht |
|---|---|---|---|
| **Budget** | `/projects/:id/budget` | Kalkulation mit Positionen und Versionen, Finanzierungsplan, Förderantrag-Export. Kosten aus dem Iststand übernehmen. | In der Kalkulation, dann bei jeder Änderung. |
| **Kostenstand** | `/projects/:id/kostenstand` | Plan gegen Ist je Position, mit Warnschwellen. Ausgaben erfassen. | Wöchentlich während des Drehs. |

---

## 10. Postproduktion

| Seite | Route | Was sie tut | Wann man sie aufmacht |
|---|---|---|---|
| **Postplan** | `/projects/:id/postplan` | Phasen von Rohschnitt bis Mastering mit Terminen und Verantwortlichen. | Direkt nach dem letzten Drehtag. |
| **Musikliste** | `/projects/:id/musikliste` | Music Cues mit Timecode, Rechteinhaber und Lizenzstand. | Vor jeder Veröffentlichung - und für die GEMA. |
| **VFX** | `/projects/:id/vfx` | VFX-Einstellungen mit Aufwand, Dienstleister und Status. | Wenn Effekte vorkommen. |
| **Abnahme** | `/projects/:id/abnahme` | **Fassungen** (Rohschnitt bis final) mit Link und Länge; **Abnahmerunden** an den Auftraggeber. Anmerkungen abhaken, Abnahmeprotokoll als PDF. | Bei jeder Fassung, die rausgeht. |

---

## 11. Verwaltung des Projekts

| Seite | Route | Was sie tut | Wann man sie aufmacht |
|---|---|---|---|
| **Dateien** (Ablage) | `/projects/:id/ablage` | Genehmigungen, Versicherungsnachweise, Vertragsscans, Eingangsrechnungen. Nachweise mit Ablaufdatum melden sich 30 Tage vorher. | Immer, wenn Papier hereinkommt. |
| **Listen** | `/projects/:id/listen` | Einlesen als CSV: Stab, Besetzung, Komparserie - mit Vorschau vor dem Übernehmen. Ausgeben dazu Szenen und Drehplan. | Wenn Daten aus einer Tabelle kommen oder dorthin sollen. |
| **EmailCenter** | `/projects/:id/email` | Postausgang, Vorlagen, Empfängergruppen, Absenderidentität, Quittungen. | Wenn eine Mail nicht ankam - und zum Pflegen der Vorlagen. |
| **AuditLog** | `/projects/:id/audit` | Jede Änderung mit Zeitpunkt, Person und Inhalt. Sechs Filter, seitenweise, CSV-Ausleitung. | Wenn jemand fragt „wer hat das geändert". |
| **DatenschutzWerkzeuge** | `/projects/:id/datenschutz` | Auskunft nach Art. 15 DSGVO je Person, Zugriffsübersicht, Anonymisieren. | Auf Verlangen einer betroffenen Person. |
| **Papierkorb** | `/projects/:id/papierkorb` | Gelöschtes der letzten Zeit, wiederherstellbar. | Nach einem Fehlklick. |
| **Abschluss** | `/projects/:id/abschluss` | Prüfliste aus acht Quellen: offene Rechnungen, unbestätigte Verträge, Abnahmen ohne Entscheidung, fehlende Bewilligungen, nicht abgerechnete Reisen, KSK, Agenturanfragen, abgelaufene Nachweise. Dazu die Aufbewahrungsfristen. | Wenn ein Projekt vorbei scheint. |

---

## 12. Creator-Modus

Für Videoprojekte ohne klassischen Drehplan. Ein Projekt im Creator-Modus
zeigt diese Seiten statt der Filmseiten.

| Seite | Route | Was sie tut | Wann man sie aufmacht |
|---|---|---|---|
| **CreatorVideos** | `/projects/:id/creator` | Alle Videos des Kanals mit Status. | Der Einstieg im Creator-Modus. |
| **CreatorVideo** | `/projects/:id/creator/:videoId` | Ein Video im Detail: Abschnitte, Sprechtext, Material, Clips, Checkliste. | Beim Bauen eines Videos. |
| **CreatorKanal** | `/projects/:id/creator/kanal` | Kanalübersicht und wiederkehrende Muster. | Monatlich. |
| **CreatorIdeen** | `/projects/:id/creator/ideen` | Ideenspeicher, aus einer Idee wird ein Video. | Wann immer etwas einfällt. |
| **CreatorRedaktionsplan** | `/projects/:id/creator/redaktionsplan` | Was wann erscheint. | Bei der Monatsplanung. |
| **CreatorSerien** | `/projects/:id/creator/serien` | Formate und Reihen. | Wenn ein Format wiederkehrt. |
| **CreatorTitel** | `/projects/:id/creator/titel` | Titel und Thumbnails durchspielen. | Vor der Veröffentlichung. |
| **CreatorSeo** | `/projects/:id/creator/seo` | Beschreibung, Schlagwörter, Kapitelmarken. | Vor der Veröffentlichung. |
| **CreatorSponsoren** | `/projects/:id/creator/sponsoren` | Sponsorenverträge, Integrationen, Fristen. | Bei bezahlten Platzierungen. |
| **CreatorRechte** | `/projects/:id/creator/rechte` | Musik, Material, Lizenzen je Video. | Vor jeder Veröffentlichung. |
| **CreatorClips** | `/projects/:id/creator/clips` | Kurzformate aus einem Video. | Nach der Veröffentlichung. |
| **CreatorChecklisten** | `/projects/:id/creator/checklisten` | Wiederkehrende Schritte vor dem Hochladen. | Bei jedem Video. |
| **CreatorPerformance** | `/projects/:id/creator/performance` | Zahlen aus YouTube: Aufrufe, Haltekurve. | Nach der Veröffentlichung. |

---

## 13. Verwaltung der Anwendung

| Seite | Route | Was sie tut | Wann man sie aufmacht |
|---|---|---|---|
| **AdminPanel** | `/admin`, `/admin/benutzer` | Alle Konten: anlegen, Rolle ändern, Passwort zurücksetzen, löschen; alle Projekte mit ihren Mitgliedern. | Nur als Administrator. |
| **AdminStats** | `/admin/stats` | Nutzung über alle Konten und Projekte. | Gelegentlich. |

---

## 14. Ohne Route

Zwei Dateien liegen unter `client/src/pages`, sind aber von nirgends
erreichbar - sie stehen in keiner Route und werden von keiner Datei
importiert. Sie landen deshalb auch nicht im Build.

| Datei | Zeilen | Befund |
|---|---|---|
| `Benutzerverwaltung.tsx` | 222 | Ältere, kleinere Benutzerverwaltung. Die Navigation zeigt auf `/admin`, und `AdminPanel` kann dasselbe und mehr. Offenbar abgelöst. Der Übersetzungsdurchgang hat ihr trotzdem eine Textdatei angelegt. |
| `ProjectTemplates.tsx` | 151 | Exportiert `TemplateSelector`, wird nirgends verwendet. |

**Zu entscheiden:** löschen oder anbinden. Beides ist vertretbar - deshalb
steht hier nur der Befund.

---

## Zum Nachprüfen

Diese Übersicht lässt sich jederzeit gegen den Code prüfen:

```bash
python3 scripts/routen-pruefen.py          # jeder API-Aufruf hat eine Route
python3 scripts/texte-pruefen.py client/src/pages/*.tsx   # feste Texte finden
python3 scripts/importe-pruefen.py         # Importe stimmen mit den Dateien überein
```
