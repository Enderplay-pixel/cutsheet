# CutSheet

**Produktionssoftware für Film und Video - von der Anfrage bis zur
Schlussrechnung.**

Dieses Dokument beschreibt, was CutSheet ist, wofür es da ist und was es
abdeckt. Es ist kein Handbuch und keine Installationsanleitung - technische
Einzelheiten stehen in `README.md`.

- **Stand:** 13. Oktober 2026
- **Läuft unter:** https://cutsheet.onrender.com
- **Quelltext:** `C:\Users\flork\cutsheet` (npm-Workspaces, `client/` und `server/`)

---

## Inhalt

1. [Wofür das Ganze](#wofür-das-ganze)
2. [Für wen](#für-wen)
3. [Der Ablauf einer Produktion](#der-ablauf-einer-produktion)
4. [Die Module im Einzelnen](#die-module-im-einzelnen)
5. [Deutsches Recht im Code](#deutsches-recht-im-code)
6. [Wer was darf](#wer-was-darf)
7. [Links für Menschen ohne Konto](#links-für-menschen-ohne-konto)
8. [Technik in Kürze](#technik-in-kürze)
9. [Was CutSheet absichtlich nicht tut](#was-cutsheet-absichtlich-nicht-tut)
10. [Zahlen](#zahlen)

---

## Wofür das Ganze

Eine Filmproduktion scheitert selten an der Technik. Sie scheitert daran, dass
etwas fehlt, von dem niemand wusste, dass es fehlt: eine Unterschrift, eine
Genehmigung, eine Rechnung, die niemand gestellt hat, die Zusage einer
Agentur, die in einem Postfach hängt.

Der übliche Zustand sieht so aus: Der Drehplan liegt in einer Tabelle, die
Dispo wird in Word geschrieben und als PDF verschickt, die Gagen stehen in
einer zweiten Tabelle, die Verträge in einem Ordner, die Rechnungen im
Buchhaltungsprogramm, und die Rückmeldung des Auftraggebers zum Rohschnitt in
einer Mail. Nichts davon weiß voneinander. Wer wissen will, ob ein Projekt
sich gelohnt hat, rechnet es von Hand aus - und wer wissen will, wer noch
nicht unterschrieben hat, geht die Mails durch.

CutSheet führt das an einem Ort zusammen. Nicht, weil eine große Software
schöner wäre, sondern weil die Verbindungen das Wertvolle sind:

- Der Drehplan weiß, wer wann am Set ist - daraus entstehen Dispo, Gagen,
  Verträge und Reisekosten.
- Die Rechnung weiß, zu welchem Projekt sie gehört - daraus entsteht der
  Deckungsbeitrag.
- Der Vertrag weiß, wer minderjährig ist - daraus entsteht die Prüfung nach
  dem Jugendarbeitsschutzgesetz.
- Die Abnahme weiß, welche Fassung freigegeben wurde - daraus wird die
  Schlussrechnung belegbar.

Das Leitmotiv durchgehend: **Was fehlt, soll sichtbar sein, bevor es weh
tut.** Deshalb gibt es auf der Firmenseite die Karte „Was anliegt" und am
Projektende eine Prüfliste. Beide rechnen nur und erledigen nichts von selbst.

---

## Für wen

**Einzelunternehmen und kleine Produktionsfirmen** im deutschsprachigen Raum.
Konkret entstanden für RuhrCut (Florian Jaschke), gebaut aber so, dass mehrere
Firmen, mehrere Projekte und mehrere Mitarbeitende nebeneinander laufen.

Gedacht für Produktionen in der Größenordnung Imagefilm, Werbefilm, Kurzfilm,
Dokumentation - also 1 bis 60 Drehtage, 5 bis 150 Beteiligte. Getestet wurde
gegen eine Großproduktion mit 45 Drehtagen, 160 Szenen, 135 Personen und 2060
erfassten Arbeitszeiten.

Nicht gedacht für: Serienproduktion mit mehreren Einheiten und
Hunderten Mitarbeitenden, Hollywood-Studiobetrieb, Verleih und Vertrieb.

Es gibt daneben einen **Creator-Modus** für Videoprojekte ohne klassischen
Drehplan: Kanalplanung, Redaktionsplan, Serienformate, Titel und
Thumbnails, Sponsoren, Rechte, YouTube-Anbindung.

---

## Der Ablauf einer Produktion

CutSheet bildet die Kette in dieser Reihenfolge ab. Jeder Schritt gibt dem
nächsten Daten weiter.

```
 Anfrage      Angebot      Auftrag      Vorbereitung      Dreh
    │            │            │              │              │
    └─ Agentur   └─ A-2026-   └─ Vertrag     └─ Drehplan    └─ Dispo
       anfragen     0001         Besetzung      Motive         Zeiten
       Vorschläge   annehmen     Crew           Equipment      Berichte
                                 Kinder         Reise
                                 (§ 6 JArbSchG) Unterkunft

 Postproduktion      Abnahme           Abrechnung        Abschluss
       │                │                   │                │
       └─ Fassungen     └─ Link an den      └─ Rechnung      └─ Prüfliste
          Schnittstufen    Auftraggeber        Mahnwesen        Aufbewahrung
                           Anmerkungen         DATEV            Archiv
                           mit Zeitstelle      KSK
                           Protokoll           Auswertung
```

---

## Die Module im Einzelnen

### Stammdaten und Drehbuch

Projekt, Drehbuch mit Szenen, Figuren, Auflösung in Einstellungen
(Shotlist), Storyboard, Moodboard, Szenenkommentare, Drehbuch-Editor mit
Fountain-Export. Szenen tragen Achtel, geschätzte Minuten, Innen/Außen,
Tag/Nacht und ihr Motiv - das ist die Grundlage für alles Weitere.

### Besetzung und Stab

Besetzung, Komparserie, Stab mit Gewerk und Tagesgage, Sperrtage, Kontaktliste
mit Export als CSV und vCard. Je Person: Mailadresse, Agentur, Geburtsdatum
(für den Jugendarbeitsschutz) und die Kennzeichnung für die
Künstlersozialabgabe.

### Agenturen und Casting

Agenturen gehören zur **Firma**, nicht zum Projekt - sie sind beim nächsten
Projekt noch da. Eine Besetzungsanfrage trägt mehrere Rollen in einem
Schreiben, je Rolle Zeitraum, Drehtage und Gage. Die Agentur antwortet über
einen Link ohne Konto: Vorschläge mit Verfügbarkeit, Gage und Link auf
Material. Ein Vorschlag wird mit einem Klick zur Besetzung.

### Drehplanung

Drehplan mit Drehtagen und Szenenzuordnung, Stäbchenplan (Stripboard) zum
Umsortieren, Kalender, Sperrtage, Feiertage, **Konfliktradar** (Doppelbuchung,
zu kurze Ruhezeit, Motivkonflikte), Zeitanalyse, DOOD-Bericht
(Day-out-of-Days), Vorschläge zur Optimierung.

### Motive, Equipment, Fahrzeuge

Motive mit Fotos, Setplan und Grundrissen (zeichenbar, mit Hintergrundbild),
Drehgenehmigungen je Motiv, Equipment-Listen mit Kalender und
Doppelbuchungsprüfung, Fahrzeuge, Catering mit Vorlieben und
Unverträglichkeiten.

### Reise und Unterkunft

Unterkünfte mit Zimmerbelegung, Reisen je Person. Die Verpflegungspauschalen
rechnet CutSheet selbst (§ 9 Abs. 4a EStG): 14 € über acht Stunden, 28 € am
vollen Tag, 14 € an An- und Abreisetagen. Gestellte Mahlzeiten kürzen - immer
gerechnet vom vollen Tagessatz. Ist beim Hotel Frühstück inklusive, wird die
Kürzung automatisch eingetragen; sie wird sonst am häufigsten vergessen.

### Am Set

Tagesdisposition mit persönlichen Call-Zeiten, Versand per Mail mit
persönlichem Bestätigungslink, Check-in-Board, Tagesbericht,
Kameraberichte, Continuity, Script Sides, Morgenbrief je Drehtag, Pinnwand.

### Verträge und Jugendarbeitsschutz

Fünf Vertragsvorlagen (Darsteller, Crew, Komparse, Bildrechte, Einverständnis
der Erziehungsberechtigten), ausdrücklich als Entwürfe gekennzeichnet. Die
Platzhalter werden aus dem Projekt gefüllt: Rolle, Drehtage **dieser** Person
aus den Dispositionen, Gage, Motive. Ab dem Versand ist der Text eingefroren.

Der Auftragnehmer bestätigt über einen Link ohne Konto. Bei Minderjährigen
geht der Vertrag an die erziehungsberechtigte Person, nicht an das Kind.

Die Jugendschutzprüfung rechnet jeden Drehtag gegen die Grenzen des § 6
JArbSchG und meldet, was dagegensteht: zu lange, zu früh, zu spät, keine
Bewilligung.

### Geld

**Budget** mit Versionen, Kostenstand, Ausgaben, Finanzierungsplan,
Förderantrag-Export.

**Arbeitszeiten** je Drehtag und Person mit Überstunden, **Honorarübersicht**
mit CSV-Export.

**Angebote** mit eigenem Nummernkreis (`A-2026-0001`) - getrennt von den
Rechnungen, weil eine Rechnungsnummer lückenlos sein muss und ein Angebot, das
nie zur Rechnung wird, keine verbrauchen darf. Beim Annehmen entsteht ein
Rechnungsentwurf mit denselben Positionen.

**Rechnungen** nach § 14 UStG mit Adressfenster nach DIN 5008, Nummernkreis je
Firma und Jahr, Umsatzsteuer je Satz, Kleinunternehmerregelung,
Umsatzsteuer-Voranmeldung.

**Zahlungseingänge** als einzelne Datensätze - nicht nur eine Summe. Ein
negativer Betrag bildet die Rücklastschrift ab.

**Mahnwesen** nach § 288 BGB: vier Stufen mit eigenen Fristen und Gebühren,
Verzugszinsen ganzzahlig gerechnet, 40-Euro-Pauschale gegenüber Unternehmern.
Eine laufende Frist sperrt die nächste Stufe. Mahnschreiben als Blatt mit
nachrechenbarer Zinsangabe, Versand über die Warteschlange.

**Offene-Posten-Liste** mit Altersstruktur (nicht fällig / bis 30 / 31-60 /
61-90 / über 90 Tage).

**Buchhaltung:** einfache Tabelle als CSV und DATEV-Buchungsstapel im
EXTF-Format, Windows-1252 kodiert, ohne Festschreibung. Der Export verweigert
sich, solange Beraternummer, Mandantennummer oder eine Debitorennummer fehlt.

**Künstlersozialabgabe:** Honorare je Jahr, Abgabesatz mit Quelle hinterlegt
(4,9 % für 2026), drei Zustände je Person - ja, nein, noch nicht entschieden.

**Auswertungen:** Umsatz je Monat, Auftraggeber und Projekt, Deckungsbeitrag
und Marge. Zwei Dinge, die eine reine Umsatzliste verschweigt, stehen eigens
da: Projekte mit Kosten ohne Rechnung, und Monate mit Drehtagen ohne Rechnung.

### Postproduktion und Abnahme

Postproduktionsplan mit Phasen, Musikliste, VFX-Verfolgung.

**Fassungen** mit Stufe (Rohschnitt bis final), Länge, Format und dem Link,
unter dem sie liegt. Die Datei bleibt, wo sie ist - ein Schnitt gehört nicht
in eine Datenbank.

**Abnahme:** Der Auftraggeber bekommt einen Link ohne Konto, sieht die
Fassung, hinterlässt Anmerkungen **mit Zeitstelle** und nimmt ab oder verlangt
eine Runde mehr. Jede Anmerkung lässt sich abhaken: erledigt, nicht umsetzen,
wieder offen. Das Abnahmeprotokoll als PDF hält Fassung, Entscheidung, Person
und Zeitpunkt fest.

### Mail

Eigener Postausgang mit Warteschlange, Wiederholung bei Fehlern (1, 5, 15, 60
Minuten, höchstens fünf Versuche), Mailvorlagen mit Platzhaltern je Firma und
Projekt, Absenderidentität je Projekt, Empfangsquittungen, Aufbewahrung
(Anhänge 60 Tage, Protokoll 365 Tage).

### Ablage

Drehgenehmigungen, Versicherungsnachweise, Vertragsscans, Eingangsrechnungen.
Bilder und PDF bis 20 MB, gespeichert **in der Datenbank** - auf der Platte des
Servers überleben sie keinen Deploy. Nachweise mit Ablaufdatum melden sich 30
Tage vorher.

### Betrieb und Sicherheit

Anmeldung mit Mail und Passwort, **zweiter Faktor** (TOTP) mit
Wiederherstellungscodes, Sitzungen einzeln widerrufbar. Änderungsprotokoll
über alles, durchsuchbar und seitenweise, mit CSV-Ausleitung.
Datenschutz-Werkzeuge (Auskunft, Zugriffsübersicht). Papierkorb mit
Wiederherstellung. Sicherung und Import je Projekt. Bereitschaftsanzeige unter
`/api/ready`.

### Abschluss

Eine Prüfliste zählt aus acht Quellen zusammen, was noch offen ist. Vier
Punkte stehen einem Abschluss wirklich entgegen - offene Rechnungen,
unbestätigte Verträge, Abnahmen ohne Entscheidung, fehlende Bewilligungen.
Abschließen geht trotzdem, aber nur ausdrücklich. Der Abschluss lässt sich
zurücknehmen.

---

## Deutsches Recht im Code

CutSheet rechnet an mehreren Stellen mit Zahlen, die im Gesetz stehen und sich
ändern. Alle sind **mit Quelle und Stichdatum** hinterlegt, keine ist geraten.
Wo die Quellen uneinheitlich sind, steht das dabei - und es wird nichts
gerechnet.

| Thema | Grundlage | Wert | Besonderheit |
|---|---|---|---|
| Verzugszinsen | § 288 BGB | Basiszins + 9 bzw. 5 Prozentpunkte | Basiszins 1,52 % seit 1.7.2026, meldet sich bei jedem Halbjahreswechsel |
| Verzugspauschale | § 288 Abs. 5 BGB | 40 € | nur gegenüber Unternehmern, nur einmal |
| Basiszinssatz | § 247 BGB | 1,52 % | Stichdatum wird mitgeführt |
| Rechnungsangaben | § 14 UStG | - | Pflichtangaben im Blatt |
| Kleinunternehmer | § 19 UStG | - | Hinweis statt Steuerausweis |
| Kinder am Set | § 6 Abs. 1 Nr. 2 JArbSchG | 2 h (3-6 J.), 3 h (über 6 J.) | Zeitfenster 8-17 bzw. 8-22 Uhr, Bewilligung zwingend |
| Künstlersozialabgabe | KSVG, Abgabeverordnung | 4,9 % für 2026 | für ein Jahr ohne hinterlegten Satz wird **nicht** gerechnet |
| Verpflegungsmehraufwand | § 9 Abs. 4a EStG | 14 € / 28 € | Kürzung immer vom vollen Tagessatz |
| Kilometerpauschale | § 9 Abs. 1 Nr. 4a EStG | 30 ct bzw. 20 ct | |
| Aufbewahrung | § 147 Abs. 3 AO, § 14b UStG | 6 / 8 oder 10 Jahre | **Quellen uneinheitlich** - wird angezeigt, nichts wird gelöscht |

Auslandssachverhalte sind bewusst ausgespart: Für Auslandsreisen gelten
Ländersätze des Bundesfinanzministeriums, die hier nicht hinterlegt sind - und
es wird dafür auch nichts gerechnet.

---

## Wer was darf

**Firmenebene** - gibt Zugriff auf Stammdaten der Firma, ausdrücklich **nicht**
auf Inhalte fremder Projekte:

| Rolle | Darf |
|---|---|
| Inhaber | alles, inklusive Buchhaltungseinstellungen und Stornos |
| Produktion | Rechnungen, Angebote, Mahnwesen, Auswertungen |
| Mitarbeiter | lesen |

**Projektebene:**

| Rolle | Darf |
|---|---|
| Admin | alles |
| Produzent | alles im Projekt |
| Regie | planen und ändern, keine Gagen |
| Gewerksleitung | das eigene Gewerk |
| Nur lesen | ansehen |

Durchgesetzt wird das zentral: eine Prüfung für alle Leserouten unter
`/api/projects/:id`, eine für alle Schreibzugriffe. Nicht in jedem Router
einzeln - das hatte früher daran gehangen, dass zwanzig andere Router zufällig
früher eingebunden waren.

---

## Links für Menschen ohne Konto

Fünf Stellen arbeiten mit einem Token im Pfad statt mit einer Anmeldung. Wer
eine Dispo bestätigt, einen Vertrag unterschreibt, als Agentur antwortet oder
eine Fassung abnimmt, legt sich kein Konto an - er würde sonst zurückmailen,
und dann steht die Antwort in einem Postfach statt im Projekt.

| Pfad | Wer | Was |
|---|---|---|
| `/dispo/:token` | Cast und Crew | Tagesdisposition ansehen und bestätigen |
| `/vertrag/:token` | Vertragspartner | Vertrag lesen, zustimmen oder ablehnen |
| `/casting/:token` | Agentur | Vorschläge zu einer Besetzungsanfrage melden |
| `/abnahme/:token` | Auftraggeber | Fassung ansehen, Anmerkungen, Freigabe |
| `/invite/:token` | neue Mitarbeitende | Einladung ins Projekt annehmen |

Jeder Token hat mindestens 160 Bit Zufall und steht nur in der Mail, mit der
er verschickt wurde. Die Liste der erlaubten Pfade steht an **einer** Stelle im
Code, mit Begründung, und ein Test hält sie gegen die tatsächlichen Routen -
weil dreimal ein Eintrag vergessen wurde und der Fehler jedes Mal still war.

---

## Technik in Kürze

| | |
|---|---|
| Oberfläche | React 18, TypeScript, Vite, Tailwind, Radix, TanStack Query |
| Server | Node, Express, TypeScript |
| Datenbank | PostgreSQL |
| PDF | Puppeteer (Chromium wird beim Serverstart vorgewärmt) |
| Mail | SMTP über eigene Warteschlange |
| Betrieb | Render, freier Plan |
| Mehrsprachig | Deutsch, Englisch, Französisch (56 von 87 Seiten) |
| Offline | PWA mit Service Worker, Auto-Update |

Besonderheiten, die man wissen sollte:

- **Geld ist immer ganzzahlig in Cent.** `Math.round(1.005 * 100)` ist 100 und
  nicht 101 - das kostet in einer Rechnung Vertrauen.
- **Dateien liegen in der Datenbank**, nicht auf der Platte: Beim Hoster ist
  das Dateisystem flüchtig, ein Deploy löscht alles Geschriebene.
- **Der freie Plan schläft ein.** Nach Leerlauf dauert der erste Aufruf etwa
  eine halbe Minute. `/api/ready` antwortet in dieser Zeit ehrlich mit 503,
  während `/api/health` 200 liefern muss, damit der Hoster den Start nicht
  abbricht.
- **Zeitzonen:** Datumsgrenzen in Filtern liegen ausdrücklich in Berliner Zeit,
  nicht in der des Servers - sonst hätte dieselbe Suche lokal und beim Hoster
  zwei Ergebnisse.

---

## Was CutSheet absichtlich nicht tut

Das ist kein Mangel, sondern Entscheidung:

- **Nichts automatisch verschicken.** Mahnungen, Verträge, Anfragen und
  Dispositionen gehen auf Knopfdruck raus, je Empfänger bestätigt. Eine
  Software, die eigenmächtig Mahnungen an Auftraggeber schickt, ruiniert
  Verhältnisse, die über Jahre gewachsen sind.
- **Nichts automatisch löschen.** Auch nicht nach Ablauf einer
  Aufbewahrungsfrist. Wer löschen will, entscheidet einzeln.
- **Keine Rechtsberatung.** Die Vertragsvorlagen sind Entwürfe und als solche
  gekennzeichnet. Der DATEV-Export folgt der Beschreibung, ist aber nicht
  gegen eine DATEV-Installation geprüft - vor dem ersten echten Import gehört
  ein Probelauf in die Kanzlei.
- **Keine erfundenen Zahlen.** Für ein Jahr ohne hinterlegten Abgabesatz wird
  nicht gerechnet. Für Auslandsreisen auch nicht. Lieber keine Zahl als eine
  falsche.
- **Keine Videodateien.** Ein Schnitt bleibt, wo er liegt; gespeichert wird der
  Link.
- **Kein Verleih, kein Vertrieb, keine Buchhaltung im engeren Sinn.** Die
  Buchhaltung bekommt einen sauberen Export, führt aber die Bücher selbst.

---

## Zahlen

Gemessen am 13. Oktober 2026, Commit `7d37cf1`:

| | |
|---|---|
| Datenbanktabellen | 103 |
| API-Routen | 491 in 78 Dateien |
| Seiten in der Oberfläche | 87 |
| Hilfsbibliotheken auf dem Server | 37 |
| Automatische Tests | 903 in 43 Dateien |
| Zeilen Serverquelltext | rund 40.000 |
| Zeilen Oberfläche | rund 34.000 |
| Commits | 147 |

### Gemessene Antwortzeiten

An einer Produktion mit 45 Drehtagen, 160 Szenen, 135 Personen und 2060
Arbeitszeiten:

| Vorgang | vorher | heute |
|---|---|---|
| Drehplan laden | 1,95 s | 0,02 s |
| Arbeitszeiten als CSV | 2,9 s | 0,06 s |
| Honorarübersicht | 1,3 s | 0,05 s |
| Suche über alles | 0,54 s (0 Treffer) | 0,04 s (50 Treffer) |
| Erstes PDF nach Neustart | 37,7 s | 4,03 s |

Die Suche fand vorher niemanden: PostgreSQL unterscheidet bei `LIKE` Groß- und
Kleinschreibung, SQLite tat das nicht. Still falsch, ohne Fehlermeldung.

---

*Fragen oder Unstimmigkeiten in diesem Dokument: Es beschreibt den Stand vom
13. Oktober 2026. Was im Code steht, hat Vorrang.*
