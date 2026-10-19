# Dauerlauf - Rundenprotokoll

Eine Runde je Punkt aus `docs/PLAN.md`. Neueste unten.

## Runde 1 - 19.10.2026 07:20

**Punkt:** 1. Zugriffsscan lesend.

**Gemessen:** Neues Werkzeug `server/src/scripts/zugriffsscan.ts`. Es startet
eine Wegwerf-PostgreSQL und den echten Server, legt die Großproduktion samt je
einer Zeile in den Oktober-Tabellen an und ruft alle 192 GET-Routen dreimal
auf: als Inhaberin, als fremde Person und quer (fremde Person, eigenes Projekt
bzw. eigene Firma im Pfad, Kind-ID der Inhaberin dahinter).

**Befund:** Ein echtes Leck. `GET /companies/:companyId/dateien/fristen` hatte
nur `requireAuth`. Jede angemeldete Person sah Dateinamen, Titel und
Projekttitel ablaufender Nachweise jeder Firma. Belegt durch einen Test, der
vor der Änderung rot war (200 statt 403).

Fünf weitere Treffer waren Fehlalarme: die eigene Firmen- bzw. Projektliste
der Fremden, der öffentliche VAPID-Schlüssel, die Importvorlage und der
Projektexport quer (`:art` ist keine Kind-ID). Im Skript ausgenommen.

**Änderung:** `erfordereFirma()` vor die Route. Regressionstest in
`datenbank.test.ts` (echte Postgres): Inhaberin 200 mit Datei, Außenstehende
403 ohne Daten.

**Tests:** 903 → 905, alle grün. Scan danach: 0 Verdachtsfälle.

**Offen:** 24 Routen bleiben ungemessen, weil schon die Inhaberin dort nichts
bekommt (Parameter wie `:quoteId` zeigen auf die Rechnung statt aufs Angebot,
Youtube braucht Zugangsdaten, einige brauchen Query-Parameter). Gefährlich
sind davon nur Routen ohne Projekt- oder Firmen-ID im Pfad; die laufen über
`requireMemberVia` und sind in `routeAuth.test.ts` abgedeckt.

## Runde 2 - 19.10.2026 08:10

**Punkt:** 2. Zugriffsscan schreibend.

**Gemessen:** Der Scan ruft jetzt auch alle 298 schreibenden Routen auf (339
Aufrufe): als Fremde und quer über ein eigenes Projekt bzw. eine eigene Firma.
Ein Leck erkennt er am Fingerabdruck (md5) aller Zeilen der Inhaberin in jeder
Tabelle mit `project_id` oder `company_id`, vor und nach jedem Aufruf.

**Messung geprüft:** Eine Gegenprobe (Inhaberin löscht einen eigenen
Grundriss) muss eine Änderung zeigen, sonst meldet der Scan "MESSUNG BLIND".
Die erste Gegenprobe mit PUT auf eine Szene war blind: Der Platzhalter-Körper
scheiterte an der Eingabeprüfung (400). Daraus folgt: Bei Querzugriffen kann
ein 400 ein Leck verdecken. Diese Fälle listet der Scan jetzt eigens auf.

**Befund:** Kein Schreibzugriff auf Daten der Inhaberin. Ein früher Treffer
(`DELETE /drehplan-versions/:id` mit 200) war ein Messfehler: Die ID gab es
nicht. Mit echter Zeile kein Zugriff. Von elf verdeckten Querzugriffen waren
zehn sicher (filtern nach Projekt bzw. Firma, nur die Meldung ist ungenau),
einer echt: `POST /projects/:projectId/cast/:castId/blackout-dates` nahm jede
`castId` an. Die Sperrzeitenliste holt den Namen per JOIN - so stand der Name
einer Darstellerin aus einem fremden Projekt im eigenen.

**Änderung:** Die Route prüft jetzt, dass die Darstellerin zum Projekt gehört
(sonst 404). Zwei Tests gegen echte Postgres.

**Tests:** 905 → 907, alle grün.

**Offen:** Fremdschlüssel im Anfragekörper (etwa `budget_line_id`,
`location_id`, `cast_id`) sieht der Scan nicht. Als eigener Punkt 2b in
PLAN.md eingetragen.

## Runde 3 - 19.10.2026 09:40

**Punkte:** 2b (Fremdschlüssel im Anfragekörper, an einen Arbeiter-Subagenten
delegiert) und 3 (öffentliche Token-Seiten, selbst).

**Arbeiter, gemessen:** Alle schreibenden Routen auf IDs aus Körper und
zweitem Pfadparameter geprüft. 57 echte Lücken in 29 Routen-Dateien, jede mit
einem Test, der vor dem Fix rot war (Originalstand eingespielt: 57 rot, 8
Gegenproben grün). Die schwersten:
- Gastlink mit fremdem Drehtag zeigte die fremde Dispo samt Namen öffentlich.
- Mail-Verteiler "Drehtag" mit fremdem Drehtag lieferte fremde Namen und
  Adressen und verschickte an sie.
- `PUT /call-sheets/:id/entries` änderte Call-Zeiten in fremden Dispos.
- Acht `PUT /projects/:projectId/<x>/:id` änderten fremde Zeilen und gaben sie
  ganz zurück (Kamera-Presets, Komparsen, Versicherungen, Musik, Post,
  Notizen, Fahrzeuge, VFX).
- Rechnung und Angebot mit fremdem Kunden (dessen Anschrift auf dem Beleg).

**Selbst nachgeprüft:** Diff gelesen; alle 43 neu hinzugekommenen
SQL-Abfragen einzeln gegen eine frisch migrierte Postgres ausgeführt
(0 Fehler; Gegenprobe mit kaputter Abfrage wurde erkannt). Der Arbeiter hatte
das als offenes Risiko gemeldet, weil seine Tests die Datenbank fälschen.

**Vom Arbeiter gemeldet, selbst geschlossen:** Neun DELETE-Routen löschten per
`WHERE id = ?` - wer in irgendeinem Projekt Mitglied war, konnte fremde
Zeilen löschen. Der Papierkorbwächter sichert vorher, verhindert das Löschen
aber nicht. Jetzt mit Projektfilter (Vertragsvorlagen: Projekt oder dessen
Firma). Neun Tests gegen echte Postgres; mit zurückgenommenem Fix rot.

**Messfehler im eigenen Scan:** Der schreibende Zugriffsscan aus Runde 2 hatte
0 gemeldet und diese Lücken übersehen. Er kannte Kind-IDs nur für 23
Pfadabschnitte und setzte sonst `1` ein - eine ID, die es oft gar nicht gab.
Ein "0 Befunde" galt also nur für die zugeordneten Abschnitte. Nachbesserung
als Punkt 2c in PLAN.md.

**Punkt 3, Befund:** Verschickte Verträge, Abnahmen und Casting-Anfragen
ließen sich nicht zurückziehen. Ein Vertrag an die falsche Adresse oder ein
überholter Text blieb über den Link für immer bestätigbar ("Für eine neue
Fassung einen neuen anlegen" - der alte galt weiter). Die öffentliche
Casting-Antwort übernahm `role_id` ungeprüft.

**Änderung:** `POST .../zurueckziehen` für alle drei (Token wird gelöscht,
Link sagt "gilt nicht mehr", Bestätigtes und Abgenommenes bleibt), Knopf mit
Rückfrage in den drei Oberflächen, Senden nach Zurückziehen abgelehnt.
`role_id` nur noch aus den Rollen der Anfrage. Fünf Tests gegen echte
Postgres.

Token-Raten sind kein Thema: 24 bis 32 Byte Zufall je Token.

**Tests:** 907 → 991, alle grün.

## Runde 4 - 19.10.2026 10:30

**Punkt:** 4. PDFs (dazu Teile von 3b).

**Gemessen:** Neues Werkzeug `server/src/scripts/pdfprobe.ts` erzeugt über die
echten Routen 14 Dokumente aus der Großproduktion plus Rechnung, Angebot,
Mahnung, Vertrag und Abnahme mit langen Texten, Umlauten und krummen
Beträgen. Alle 14 gültig, 0,9 bis 2,3 s. Textebene mit pypdf und pdftotext
ausgelesen, Rechnung, Mahnung, Vertrag und Abnahmeprotokoll angesehen.

**Befunde und Änderungen:**
1. *Textebene kaputt* (Commit c2b55b6): Ersatzziffern und Ligaturen ohne
   Unicode-Zuordnung - Beträge als Nullbytes, "Bitte" als "Bi\0e". Vorher
   geprüft: Rechnung, Angebot, Mahnung betroffen, Kalkulation nicht.
   Nachher alle 14 sauber.
2. *Mahnung ohne Anschrift:* Die Abfrage holte Straße, PLZ und Ort nicht ab,
   der Brief trug nur Name und Ansprechperson. Test gegen echte Postgres war
   vor dem Fix rot.
3. *Abnahmeprotokoll bezeugte eine Zustimmung, die es nicht gab:* Die
   Fußzeile "Die Zustimmung wurde ... erklärt" stand auch auf Protokollen
   ohne Entscheidung, und der Stand hieß roh "entwurf". Jetzt lesbarer Stand,
   Fußzeile nur mit Entscheidung.
4. *Zeitzone:* Datum und Uhrzeit wurden in der Zone des Servers formatiert.
   Unter TZ=UTC gemessen: Sonnenaufgang im Morning Brief 06:02 statt 08:02.
   Ob Render in UTC läuft, ist nicht gemessen (in render.yaml keine Zone
   gesetzt). 26 Stellen auf Europe/Berlin, Test über vier Zonen, dass ein
   reines Datum keinen Tag kippt, Wächter gegen neue Stellen ohne Zone.
5. *Gedankenstriche im Server* (3b): 60 Stellen in Dokumenten, Mails und
   Demodaten. Bewusst geblieben: Drehbuch-Parser (muss sie in Szenenköpfen
   erkennen) und DATEV-Zeichentabelle. `db/index.ts` nicht angefasst, weil
   dort `ensureTestAdmin()` steht.

**Kein Fehler, nur Messaufbau:** Der Probevertrag hatte keinen Titel oben -
die Standardvorlagen beginnen mit `# Darstellervertrag`, nur mein Probetext
nicht.

**Nebenbefund für Florian:** `ensureTestAdmin()` liest inzwischen
`TEST_ADMIN_PASSWORD` aus der Umgebung. Die Vault-Notiz spricht noch vom fest
eingebauten Passwort - nicht angefasst, nur gemeldet.

**Tests:** 991 → 995 (dazu 5 Wächter aus c2b55b6), alle grün.

## Runde 5 - 19.10.2026 12:00

**Punkt:** 5. Geld rechnet richtig.

**Befunde und Änderungen** (jeder Test war vor dem Fix rot):
1. *Negative Beträge rundeten falsch.* `Math.round(-2.5)` ist -2. Eine
   gespiegelte Rechnung (Gutschrift) wich um 3 Cent vom Gegenteil der
   ursprünglichen ab. Jetzt `kaufmaennisch()`: ab halbem Cent vom Betrag weg,
   auch im Minus.
2. *Zwei Buchführungen für Zahlungen.* Der Knopf "Zahlung erfasst" auf der
   Rechnungsseite schrieb nur `paid_cents`, die Offene-Posten-Seite Zeilen in
   `invoice_payments`. Offene Posten und Mahnwesen sahen die Zahlung vom
   Rechnungsknopf nicht und schlugen die bezahlte Rechnung zur Mahnung vor;
   die nächste Teilzahlung überschrieb `paid_cents` mit der eigenen Summe.
   Jetzt legen beide Wege eine Zeile an und verrechnen über
   `lib/zahlungen.ts`.
3. *Storno im DATEV-Export.* Eine stornierte Rechnung stand nur noch im Haben
   zum Rechnungsdatum. Ein neuer Export des Rechnungsmonats zeigte negativen
   Umsatz statt des gebuchten, im Monat des Stornos fehlte er. Jetzt: die
   Rechnung bucht zu ihrem Datum, der Storno zu seinem (`cancelled_on`, neue
   Spalte; ältere Stornos nehmen `updated_at`). Dasselbe im CSV-Export und in
   der Umsatzsteuer-Auswertung, die stornierte Rechnungen vorher ganz
   wegließ - auch aus dem Monat, in dem sie schon angemeldet waren.
   Export und Auswertung rechnen jetzt mit `summiere()` wie der Beleg selbst.

**Nicht entschieden, nur vorbereitet:** Zahlungen, die vor heute über den
Rechnungsknopf erfasst wurden, haben in der Live-Datenbank keine Zeile. Der
Dauerlauf hat eine Nachtrags-Migration gebaut, die Rechteprüfung hat sie
abgelehnt (schreibt beim nächsten Deploy Live-Daten). Prüfabfrage und
Nachtrag für Florian in `docs/ENTSCHEIDUNGEN-FLORIAN.md`.

**Tests:** 995 → 1001, alle grün.

## Runde 6 - 19.10.2026 12:40

**Punkt:** 2c. Zugriffsscan ohne blinde Flecken (Arbeiter-Subagent).

**Änderung am Messwerkzeug:** Kind-IDs kommen jetzt aus dem Schema
(information_schema, Fremdschlüssel-Kette bis Tiefe 3, Minimalzeilen für
leere Tabellen). Der Fingerabdruck sieht auch Kind-Tabellen über die Kette.
Am Ende steht, welche Routen der Scan nicht mit einer echten ID treffen
konnte.

**Nachweis, dass er nicht mehr blind ist:** Die neun Routen-Dateien aus
Runde 3 vorübergehend auf den Stand vor dem Fix gesetzt - der Scan meldete
alle 18 Lücken (9 PUT, 9 DELETE) als `QUER ÄNDERT`, dazu
`PUT /call-sheets/:id/entries`. Am aktuellen Stand: 0. Selbst nachgeprüft:
Routen danach gleich HEAD, Scan noch einmal gelaufen.

**Messfehler beim eigenen Nachlauf:** `GET /creator/youtube/callback` stand
als Leck da. Die Route leitet auf die App um, und der Scan folgte der
Umleitung bis zum gerade laufenden Vite-Server. Scan folgt Umleitungen jetzt
nicht mehr.

**Stand:** 151 von 151 GET- und 265 von 266 schreibenden Routen mit echter
ID getroffen, 0 Verdachtsfälle. Nicht getroffen: `PUT /feedback/:id`
(gehört einem Nutzer, nicht einem Projekt). Weiter blind für IDs im
Anfragekörper (außer `entries`) und für 38 Querzugriffe, die schon an der
Eingabeprüfung scheitern.

**Zwischenfall:** Ein `git commit -a` im Hauptstrang hat währenddessen die
vorübergehend alten Routen mitcommittet. Sofort bemerkt, mit
`reset --soft` zurückgenommen, nie gepusht. Vault-Notiz
`Fehler/commit -a bei paralleler Arbeit.md`.

## Runde 7 - 19.10.2026 13:40

**Punkt:** 8. Erste fünf Minuten - lokal im Browser mit einem frischen Konto
durchgespielt: registrieren, Rundgang, Einrichtungsassistent, Drehbuch
importieren.

**Befunde und Änderungen** (jeder mit Test, der vor dem Fix rot war):
1. *Jedes vierte Drehbuch ließ sich nicht importieren.* Gemessen im
   Assistenten mit einer Fountain-Datei: "Der Text enthält ein Zeichen, das
   nicht gespeichert werden kann." Die Route hielt jeden Text ohne "<" mit
   durch 4 teilbarer Länge für Base64 und machte daraus Datenmüll. Die Datei
   hatte 264 Zeichen. Jetzt nur noch echtes Base64.
2. *Phantomszene "Import"* aus dem Fountain-Titelblock (`Title: …`).
3. *Dialog wurde zu Handlung:* Der Parser übersprang Leerzeilen, bevor er den
   Typ bestimmte; die Zeile unter einer Rolle galt nie als Dialog.
4. *Halbe Importe:* Ohne Transaktion blieb nach einem Abbruch eine Szene
   liegen (Gegenprobe ohne Transaktion: 1 Szene, mit: 0).
5. *Doppelte Szenennummern:* Jeder Import begann bei 1.
6. *Admin-Statistik "neu in 7 Tagen" immer 0:* `toPg` übersetzte
   `datetime('now', '-7 days')` in einen Zeitpunkt sieben Tage in der
   Zukunft. Der vorhandene Test prüfte nur den Text, nicht die Bedeutung;
   neuer Test rechnet in echter Postgres nach.
7. *Zweimal "Willkommen":* Nach dem Rundgang ("Du bist startklar!") begrüßte
   der Assistent noch einmal mit "Willkommen bei CutSheet". Jetzt "Dein
   erstes Projekt".

**Geprüft, kein Fehler:** Die Versprechen im Rundgang (QR-Einladung,
Taste "?", Wetterabruf) gibt es wirklich. "ca. 300 Min." für fünf Szenen ist
die geschätzte Drehzeit (60 Min. je Szene), nicht die Filmlänge. Der
Schließen-Knopf hat einen versteckten Namen, das Werkzeug zeigte ihn nur
nicht an.

**Messaufbau:** Der Test-Server in `datenbank.test.ts` hat jetzt dieselbe
Fehlerbehandlung wie der echte (`express-async-errors`,
`uebersetzeDatenbankfehler`). Ohne sie hing eine werfende Route bis zum
Zeitlimit.

**Offen für Punkt 3b:** `client/index.html` hat noch einen Gedankenstrich im
Seitentitel.

**Tests:** 1001 → 1010, alle grün.
