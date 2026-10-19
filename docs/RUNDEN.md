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
