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

**Tests:** 907 → 991 (plus 5 aus Runde 4), alle grün.
