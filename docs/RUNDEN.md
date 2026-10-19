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
