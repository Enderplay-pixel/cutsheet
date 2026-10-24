# Codeprüfung - Übergabe

Dieses Dokument ist die Übergabe für die Durchsicht des ganzen Codes. Wer es
in einem neuen Chat öffnet, kann ohne weiteren Zusammenhang weitermachen:
Auftrag, Vorgehen, Stand und Funde stehen hier, die Abhakliste unten zeigt,
welche Datei schon gelesen ist.

## Auftrag

Florian am 24.10.2026, wörtlich:

> nachdem du sichergegangen bist dass der upload durch ist, prüfe bitte JEDE
> zeile an text. wenn du out of kontext läufst erstelle eine übergabe md dass
> nen neuer chat nahtlos gestartet werden kann

und präzisiert:

> meine JEDE code zeile

Gemeint ist also **jede Codezeile**, nicht nur die sichtbaren Texte.

## Stand vor Beginn

- **Push:** 28 Commits am 24.10.2026 auf `origin/master` (`a631cf2..5612997`),
  darin Version im Titel, Übersetzungen, Mandantentrennung, Geld-Korrekturen
  und die Drehbuch-Fixes. Ob Render ausgeliefert hat, steht unter
  "Deploy-Prüfung".
- **Nicht committet, bewusst liegengelassen:** `server/src/lib/benachrichtigungen.ts`
  - halbe Runde 17 (Benachrichtigungen). Florian hat die Arbeit daran am
  24.10.2026 abgebrochen. Nicht anfassen, nicht committen, ohne dass er es
  sagt.
- **Lokal starten:** `node scripts/lokal-starten.cjs` (oder im Vorschaufenster
  `cutsheet-lokal`). Client 5173, Server 3001, eigene Postgres-Instanz in
  `.lokale-datenbank/`. Testkonto nur lokal: steht in
  `server/src/db/index.ts` bei `ensureTestAdmin`.
- **Tests:** `cd server && npx vitest run` - Stand vor Beginn 51 Dateien,
  1047 Tests, alle grün. Der Client hat keine Tests.
- **Typprüfung:** `npx tsc --noEmit -p client/tsconfig.json` und
  `npx tsc --noEmit -p server/tsconfig.json`, beide ohne Ausgabe.

## Regeln, die beim Prüfen gelten

Aus Florians `CLAUDE.md` und der Erfahrung dieser Sitzung:

1. **Erst messen, dann behaupten.** Ein Verdacht aus dem Lesen ist kein
   Fund. Bevor etwas geändert wird: nachstellen (Test, Aufruf gegen den
   lokalen Server, Browser). Steht ein Fund nur auf dem Papier, heißt er hier
   "Verdacht" und wird so gekennzeichnet.
2. **Den Messaufbau zuerst prüfen.** In dieser Sitzung dreimal vorgekommen:
   nur das Eingabefeld statt der Datenbank geprüft; `element.focus()` per
   Skript löst im Hintergrundfenster kein Ereignis aus; Backslashes im
   Heredoc werden verschluckt (Skripte als Datei schreiben).
3. **YAGNI.** Gefundenes beheben, nichts dazubauen.
4. **Bindestrich, nie Gedankenstrich. Echte Umlaute.** Auch in Kommentaren,
   Commit-Texten und dieser Datei.
5. **Nach außen nur mit Freigabe.** `git push` sperrt die Mod `aussen-bremse`,
   bis Florian `/freigabe` schickt. Nicht umgehen. Lokal committen geht.
6. **Kleine Korrekturen bündeln**, nicht einzeln ausliefern.
7. **`git add` nur mit ausdrücklichen Pfaden.** `git add -A server/src` hat am
   24.10.2026 die liegengelassene `benachrichtigungen.ts` mitgenommen (lokal
   per `--amend` zurückgenommen, nie gepusht).

## Hier weitermachen

Stand am 24.10.2026 abends, als das Nutzungslimit kam:

- **Fertig:** Gruppe Middleware (7 Dateien). Funde 1-9 eingetragen, 1, 4, 5, 6, 9
  behoben und committet.
- **Fertig:** Gruppe Datenbank (`db/index.ts`, `grossproduktion.ts`).
- **Als Nächstes:** Gruppe "Server: Routen", alphabetisch ab `abnahme.ts`.
- **Fund 10 erledigt** (Demo-Adressen), dazu Fund 11 (Importvorlage).
  Messweg für Mails: `scratchpad/smtp-falle.cjs`-Prinzip - ein Fang-SMTP,
  das nur `RCPT TO` mitschreibt, und eine zweite Instanz mit
  `SMTP_HOST=127.0.0.1 SMTP_PORT=2525` auf Port 3099. Hinterher die
  Prozesse beenden: `netstat -ano` zeigt unter deutschem Windows "ABHÖREN".
- **Nicht gepusht:** alles ab `da3a6ba`. Fund 5 (fremde Projekte über den Body)
  und Fund 9 (Projekte gelöschter Konten) sind in der Produktion offen und
  sollten mit der nächsten Freigabe raus.
- Messskripte dieser Sitzung lagen im Scratchpad und sind weg; sie stehen
  sinngemäß in den Commit-Texten (`git log`), dort auch die Messwerte.

## Vorgehen

Reihenfolge nach Risiko: Middleware und Datenbank zuerst (betrifft jede
Anfrage), dann Routen (Zugriff, Geld, Daten), Bibliotheken, dann der Client,
Werkzeuge, zuletzt die Tests.

Je Datei:

1. Ganz lesen, Zeile für Zeile.
2. Prüfen auf: falsches Ergebnis, Datenverlust, Zugriff auf Fremdes,
   ungeprüfte Eingaben, Rennen zwischen Anfragen, Zeitzonen, Geldrundung,
   SQL, das unter Postgres anders läuft als gedacht, tote Pfade, sichtbaren
   Text (Gedankenstrich, Ersatzumlaute, Sprachmischmasch, Tippfehler).
3. Fund ins Fundbuch, mit Datei und Zeile. Erst nachstellen, dann beheben.
4. Haken in der Abhakliste setzen, Zahl der Funde dahinter.
5. Nach jeder Gruppe: Tests, Typprüfung, Commit.

## Deploy-Prüfung

**Erledigt am 24.10.2026, 18:21:40.** Push `a631cf2..5612997` (28 Commits) ist
auf `https://cutsheet.onrender.com` ausgeliefert. Vorher lokal `npm run build`
wie auf Render: fehlerfrei.

| Prüfung | Ergebnis |
|---|---|
| Titel | vorher `CutSheet — Filmproduktion`, jetzt `CutSheet v1.0 alpha - Filmproduktion` |
| Hauptbundle | `index-BGiSIX2K.js` → `index-C_TjEwAf.js`; enthält "Zeile nicht gespeichert", "Ligne non enregistr", "v1.0 alpha" |
| Editor-Chunk `ScreenplayEditor-CczuiwrT.js` | enthält `drehbuch.fountain`, "Neue Szene", `ArrowUp`, `clipboardData`; der alte Platzhalter `INT. NEW SCENE - DAY` kommt nicht mehr vor |
| `/api/health` | `{"ok":true,"db":true,"testversion":false}` |

Nicht online prüfbar: Serververhalten hinter der Anmeldung. Das Testkonto ist in
der Produktion gesperrt, Florians Zugang wird nicht benutzt. Client und Server
sind ein Render-Dienst aus demselben Bau.

## Fundbuch

| # | Datei:Zeile | Art | Befund | Gemessen | Stand |
|---|---|---|---|---|---|
| 1 | `server/src/middleware/auth.ts:51,85` | Sicherheit | Rolle kommt 30 Tage lang aus dem Token; Löschen und Herabstufen beenden keine Sitzung, und eine per CASCADE verschwundene Sitzung gilt als gültig. Gelöschter oder herabgestufter Admin behält Adminrechte. | ja: beide Fälle `GET /api/admin/users` 200 mit altem Token | behoben: Rolle aus der Datenbank, gelöscht 401, herabgestuft 403; Test in `datenbank.test.ts`, gegen alten Stand rot |
| 2 | `server/src/routes/auth.ts:464`, `admin.ts:316` | Hinweis | Zwei Routen zum Umstufen mit verschiedenen Rollenlisten (`auth` ohne `user`). Die `auth`-Route nutzt nur die nirgends eingehängte `Benutzerverwaltung.tsx`. | nein, nur gelesen | offen, mit der Entscheidung über die verwaisten Seiten |
| 3 | `server/src/db/index.ts` (30 Spalten `*_cents INTEGER`) | Hinweis, Entscheidung | Geldbeträge sind auf 21.474.836,47 € je Feld gedeckelt, darüber 400 "Zahl außerhalb". Trifft zuerst `budget_versions.total_cents` (ganze Kalkulation). Umstellung auf BIGINT: 30 Spalten, und `pg` liefert BIGINT als Text - jede Rechnung müsste angepasst werden. | nein, nur gelesen | offen, für Florian |
| 4 | `server/src/middleware/validate.ts:12` | Text | Zod-Meldungen englisch in deutschen Fehlern: "email: Invalid input: expected string, received undefined". | ja: `POST /api/auth/login` mit `{}` | behoben: `z.config(z.locales.de())` |
| 5 | `server/src/middleware/projectAuth.ts:212` | **Sicherheit, live** | Guard nahm bei POST das Projekt aus dem Body vor dem Pfad. Fremdes Konto schrieb mit eigener `project_id` im Body in fremde Projekte (`POST /scenes/{fremd}/blocks`). Betrifft jede POST-Route auf einem Eintragspfad. Älter als dieser Tag, in der Produktion. | ja: Block "EINGEDRUNGEN-MIT" in Projekt 6, ohne Body-Trick 403 | behoben: Pfad vor Body; Test in `datenbank.test.ts`, gegen alten Stand rot. **Muss bald raus.** |
| 6 | `server/src/routes/auth.ts:48,82`, `admin.ts:350` | Fehler | E-Mail mit exakter Schreibweise verglichen: "Max@..." registriert, mit "max@..." kein Zugang; dieselbe Adresse kleingeschrieben ein zweites Mal registrierbar. | ja: 201, dann 401, dann zweites Konto 201 | behoben: Adresse wird kleingeschrieben, Vergleich per `LOWER`; bei Altpaaren entscheidet das Passwort - beide gemessen erreichbar |
| 7 | `server/src/db/index.ts` (`notifications`, `notification_settings`) | Hinweis, Entscheidung | Tabellen der abgebrochenen Runde 17 kamen versehentlich mit Commit `84f1d7d` und stehen leer in der Produktion. Kein Code nutzt sie. Entfernen hieße `DROP TABLE` in der Produktion. | ja: `git log -S`, `origin/master` enthält den Commit | offen, für Florian |
| 8 | `user_totp.recovery_codes`, `password_reset_tokens.token` | Verdacht | Wiederherstellungscodes und Rücksetz-Token offenbar im Klartext; wer die Datenbank liest, umgeht den zweiten Faktor. | noch nicht - beim Lesen von `routes/auth.ts` prüfen | offen |
| 9 | `server/src/db/index.ts:2058` | **Datenschutz, live** | Bei jedem Start bekam jedes Projekt ohne Inhaber das erste Konto als Inhaber. Ohne Inhaber sind die Projekte gelöschter Konten (`ON DELETE SET NULL`) - nach jedem Deploy gehörten sie still dem ersten Konto, mit allen Daten. | ja: Konto 19 legt Projekt 20 an, gelöscht, Neustart: `owner_id` 1 | behoben: keine Zuweisung beim Start mehr (siehe Fund 22); Test, gegen alten Stand rot. **In der Produktion prüfen**, welche Projekte dem ersten Konto zugefallen sind - aus den Daten allein nicht mehr erkennbar. |
| 10 | `server/src/db/index.ts` (`seedDemoData`), `lib/mailversand.ts` | **Datenschutz, live** | Das Demo-Projekt jedes neuen Kontos enthielt 14 Adressen bei echten Anbietern (`email.de`, `gmx.de`, `gmail.com` ...). Ein Klick auf "Dispo versenden" schrieb Fremde an, unter Florians Absender, mit Dispo-PDF. | ja: Fang-SMTP auf Port 2525, zweite Instanz; 7 Empfänger kamen an (`felix.wagner@email.de` ...) | behoben: Demo-Adressen unter `@demo.test`, bestehende Demo-Projekte beim Start nachgezogen (nur die 14 bekannten Adressen); Versand legt `.test/.example/.invalid/.localhost` und `example.com/net/org` keinem Mailserver vor (`ohne_versand`); Dispo meldet `nicht_zustellbar`. Gemessen danach: 0 in der Falle. Test gegen alten Stand rot. |
| 11 | `server/src/routes/tabellen.ts:207-215` | Datenschutz | Die Importvorlage für Stab, Besetzung und Komparsen trägt eine Beispielzeile mit `@beispiel.de` (registrierte Domain). Wer sie nicht löscht, importiert sie mit. | ja: Vorlage zurückgespielt, Vorschau `neu: Sarah Müller` | behoben: Beispieladressen unter `@beispiel.test` |
| 12 | `server/src/db/index.ts` (`seedDemoData`) | Inhalt | Demo-Projekt in sich widersprüchlich: Postproduktion, VFX-Fristen und Versicherungen fest im Juni/Juli 2026, Drehtage relativ zu heute (Rohschnitt vier Monate vor dem Dreh, Haftpflicht "für alle Drehtage" vor dem ersten abgelaufen); "Reserve (5%)" waren 2,09 %; Rufzeiten widersprachen den Notizen ("Aufbau ab 06:00", gerufen 07:00); Besetzung ohne `ORDER BY`. | ja: frisches Konto, alle Werte aus der Datenbank gelesen | behoben: alles relativ zu `d()`, Reserve 892,50 €, Rufzeiten wie die Notizen |
| 13 | `server/src/db/grossproduktion.ts:304,311` | Hinweis | Testprojekt "Nordlicht" erzeugte Adressen unter `motiv-kontakt.de` und `schauspiel-mail.de`. Beide derzeit nicht registriert - Mails kämen als Rückläufer zurück, und jeder kann die Domains anmelden. | ja: DNS `Non-existent domain` | behoben: `.test` wie der Rest der Datei |
| 14 | `routes/abnahme.ts`, `vertraege.ts`, `agenturen.ts` (je `appBasisUrl`) | **Fehler, möglicherweise live** | Diese drei lasen `APP_URL`, alle anderen und `.env.example` `APP_BASE_URL`. Ist in der Produktion nur die dokumentierte gesetzt, bekommen Auftraggeber, Agenturen und Darsteller Links auf `http://localhost:5173`. | ja: Zweitinstanz nur mit `APP_BASE_URL`, Abnahme versendet: Link `http://localhost:5173/abnahme/…` | behoben: eine `appBasisUrl` in `lib/mailversand.ts`, liest `APP_BASE_URL`, sonst `APP_URL`; auch YouTube nutzt sie. Danach gemessen: `https://cutsheet.onrender.com/abnahme/…`. **Florian: prüfen, welche der beiden in Render gesetzt ist** |
| 15 | neun Routen (`abnahme`, `abschluss`, `agenturen`, `angebote`, `anliegen`, `auswertungen`, `dateien`, `mahnwesen`, `vertraege`) | Fehler | Jede hatte ein eigenes `heuteISO()` in UTC statt `lib/datum` (Europe/Berlin). Zwischen 0 und 2 Uhr ist "heute" gestern - im Vertragstext (`vertraege.ts:216`), beim Zahlungseingang, bei Angeboten; in der Silvesternacht das falsche Jahr. | ja: 22:30 UTC (00:30 Berlin, 25.10.) - Routen `2026-10-24`, richtig `2026-10-25`; Silvester 00:30 - Routen `2026-12-31` | behoben: alle neun nutzen `lib/datum` |
| 16 | `server/src/scripts/zugriffsscan.ts` | Messwerkzeug | Der schreibende Scan schickte nie eine `project_id` im Body und war für Fund 5 blind. | ja: neue Variante KOERPER - gegen den alten `projectAuth.ts` 10 Routen, die Daten der Inhaberin ändern; gegen den aktuellen 0 | ergänzt |
| 17 | `server/src/routes/abnahme.ts` (`watch_url`) | Härtung | Der Server nahm als Sichtungslink alles an, auch `javascript:` und `data:`. Der Link wird auf der öffentlichen Seite des Auftraggebers per `window.open` geöffnet. | Annahme ja; Ausführung **nicht messbar** - das eingebaute Browserfenster öffnet auch harmlose Pop-ups nicht (Gegenprobe) | behoben: Server verlangt http(s) (400 sonst, gemessen), Client öffnet nur http(s) |
| 18 | `server/src/routes/abschluss.ts` (zweimal) | Fehler, Recht | "Kinder ohne Bewilligung" (§ 6 JArbSchG) zählte nur die Besetzung, die Jugendschutz-Seite auch die Komparserie. Eine elfjährige Komparsin ohne Bewilligung hielt den Projektabschluss nicht auf. | ja: Jugendschutz-Seite zeigt sie, Abschluss zählt 0 | behoben: eine gemeinsame Abfrage für Anzeige und Abschluss, beide Arten; danach 1 und Abschluss blockiert |
| 19 | `server/src/routes/abschluss.ts` (`POST .../abschluss`, `.../zuruecknehmen`) | Hinweis, Entscheidung | Projekt abschließen (archivieren) und wieder öffnen erlaubt der Guard laut Code ab `dept_head` - etwa die Kostümleitung. | nein, nur gelesen (`minRankForPath`) | offen, für Florian |
| 20 | `server/src/routes/activityFeed.ts:24` | Klein | `?limit=-1` ergab `LIMIT -1` und 500. | ja: 500 | behoben: Untergrenze 1, danach 200 |
| 21 | `server/src/routes/admin.ts` (`/betrieb`), `AdminStats.tsx` | Ergänzung zu Fund 14 | Die Betriebsübersicht prüfte die Adresse in Mail-Links nicht. | - | ergänzt: Warnung "hoch", wenn die Links in der Produktion auf localhost zeigen; die Adresse steht als "Adresse in Mail-Links" auf der Admin-Seite. **Damit kann Florian Fund 14 live ablesen.** |
| 22 | `server/src/routes/admin.ts:387` (Reseed) mit `db/index.ts` (Start) | Fehler | Der Reseed sucht das globale Demo-Projekt über `owner_id IS NULL`, der Start hat es aber dem ersten Konto zugewiesen. Nach jedem Neustart legte jeder Reseed ein weiteres an. | ja: 16 → 17 Demo-Projekte, das alte blieb | behoben: Beim Start wird kein Inhaber mehr zugewiesen (Admins sehen alle Projekte, neue Konten haben ihr eigenes Demo). Gemessen über zwei Neustarts: 17 bleibt 17. In der Produktion liegen womöglich Dubletten beim ersten Konto. |
| 23 | Mails in `abnahme.ts`, `agenturen.ts` (Anfrage, Nachfassen), `vertraege.ts` | Fehler | Freitext der Mitglieder ging ungefiltert ins Mail-HTML. "Alter <ca. 30, sportlich" kam als "Alter " an; jedes Mitglied konnte HTML in Mails unter dem Namen der Produktion setzen. | ja: Browser-Parser auf dem Mail-HTML; danach "Alter <ca. 30, sportlich" vollständig, HTML als Text | behoben: `maskiere` aus `lib/mailvorlagen.ts` |
| 24 | `server/src/routes/agenturen.ts` (`POST /casting/:token/antwort`), `Agenturen.tsx` | **Sicherheit** | Eine Agentur ohne Konto setzte `showreel_url` frei; die angemeldete Seite der Produktion zeigte ihn als `href`. Gemessen: `href="javascript:alert(document.domain)"` im DOM. Ob ein Klick ihn ausführt, ist im Browserfenster ohne Pop-ups nicht messbar. | ja: Link im DOM der angemeldeten Seite | behoben: Server bereinigt (`lib/webadresse.ts`: nur http(s), ohne Schema wird https:// ergänzt), Client setzt nur http(s) als Link - gemessen auch für Altdaten |
| 25 | `server/src/routes/aiScheduling.ts:10` | Fehler | Die KI-Drehplanung prüfte die **globale** Rolle (`admin/producer/director`). Registrierte Konten sind global `user` - selbst die Inhaberin bekam im eigenen Projekt "Keine Berechtigung". Dazu Umbau ohne Transaktion und `sort_order` ungeprüft aus der KI-Antwort. | Rolle ja: Inhaberin 403, globaler Admin weiter; Transaktion und `sort_order` **nicht messbar** ohne KI-Schlüssel | behoben: Projektrolle ab Regie (danach Inhaberin bis zur Schlüsselprüfung, Fremde 403); Umbau in einer Transaktion; `sort_order` bereinigt |
| 26 | `aiBreakdown.ts:56`, `aiScheduling.ts:91` | Hinweis, Entscheidung | Beide nutzen `claude-opus-4-5`. Laut Modellreferenz (Stand 6.10.2026) **aktiv, nicht abgekündigt** - es läuft. Neuere Modelle (Opus 5.5) sind verfügbar; ein Wechsel ändert Verhalten und Kosten. | ja: Modellreferenz der claude-api-Skill | offen, für Florian |

## Abhakliste

Gesamt: 421 Dateien, 87774 Zeilen

### Server: Middleware

- [x] `server/src/middleware/auth.ts` (152) - Fund 1
- [x] `server/src/middleware/eingabe.ts` (158) - Fund 3
- [x] `server/src/middleware/haertung.ts` (207)
- [x] `server/src/middleware/papierkorbWaechter.ts` (67)
- [x] `server/src/middleware/projectAuth.ts` (314) - Fund 5
- [x] `server/src/middleware/sprache.ts` (64)
- [x] `server/src/middleware/validate.ts` (17) - Fund 4

### Server: Datenbank

- [x] `server/src/db/grossproduktion.ts` (620) - Fund 13
- [x] `server/src/db/index.ts` (2540) - Funde 3, 7, 8, 9, 10, 12

### Server: Routen

- [x] `server/src/routes/abnahme.ts` (588) - Funde 14, 15, 17
- [x] `server/src/routes/abschluss.ts` (321) - Funde 18, 19
- [x] `server/src/routes/activityFeed.ts` (74) - Fund 20
- [x] `server/src/routes/admin.ts` (386) - Funde 21, 22
- [x] `server/src/routes/agenturen.ts` (558) - Funde 23, 24
- [x] `server/src/routes/aiBreakdown.ts` (139) - Fund 26
- [x] `server/src/routes/aiScheduling.ts` (132) - Funde 25, 26
- [ ] `server/src/routes/angebote.ts` (443)
- [ ] `server/src/routes/anliegen.ts` (242)
- [ ] `server/src/routes/audit.ts` (279)
- [ ] `server/src/routes/auswertungen.ts` (361)
- [ ] `server/src/routes/auth.ts` (493)
- [ ] `server/src/routes/backup.ts` (230)
- [ ] `server/src/routes/blackoutDates.ts` (152)
- [ ] `server/src/routes/buchhaltung.ts` (318)
- [ ] `server/src/routes/budget.ts` (326)
- [ ] `server/src/routes/calendar.ts` (48)
- [ ] `server/src/routes/callsheets.ts` (370)
- [ ] `server/src/routes/cameraPresets.ts` (97)
- [ ] `server/src/routes/cameraReports.ts` (188)
- [ ] `server/src/routes/catering.ts` (141)
- [ ] `server/src/routes/characters.ts` (95)
- [ ] `server/src/routes/checkin.ts` (65)
- [ ] `server/src/routes/companies.ts` (509)
- [ ] `server/src/routes/confirmation.ts` (159)
- [ ] `server/src/routes/conflicts.ts` (285)
- [ ] `server/src/routes/contactsExport.ts` (81)
- [ ] `server/src/routes/continuity.ts` (178)
- [ ] `server/src/routes/creator.ts` (710)
- [ ] `server/src/routes/crew.ts` (46)
- [ ] `server/src/routes/dailyreports.ts` (221)
- [ ] `server/src/routes/dateien.ts` (236)
- [ ] `server/src/routes/datenschutz.ts` (202)
- [ ] `server/src/routes/dood.ts` (126)
- [ ] `server/src/routes/drehplan.ts` (305)
- [ ] `server/src/routes/emailRoutes.ts` (646)
- [ ] `server/src/routes/emailService.ts` (118)
- [ ] `server/src/routes/equipment.ts` (68)
- [ ] `server/src/routes/equipmentCalendar.ts` (165)
- [ ] `server/src/routes/expenses.ts` (122)
- [ ] `server/src/routes/extras.ts` (101)
- [ ] `server/src/routes/feedback.ts` (41)
- [ ] `server/src/routes/floorplans.ts` (287)
- [ ] `server/src/routes/foerderantrag.ts` (198)
- [ ] `server/src/routes/guestTokens.ts` (96)
- [ ] `server/src/routes/ical.ts` (143)
- [ ] `server/src/routes/insurances.ts` (138)
- [ ] `server/src/routes/invites.ts` (214)
- [ ] `server/src/routes/invoices.ts` (675)
- [ ] `server/src/routes/locationRelease.ts` (129)
- [ ] `server/src/routes/locations.ts` (77)
- [ ] `server/src/routes/mahnwesen.ts` (492)
- [ ] `server/src/routes/moodboard.ts` (102)
- [ ] `server/src/routes/morningBrief.ts` (261)
- [ ] `server/src/routes/musicCues.ts` (155)
- [ ] `server/src/routes/optimizationSuggestions.ts` (268)
- [ ] `server/src/routes/papierkorb.ts` (46)
- [ ] `server/src/routes/payroll.ts` (157)
- [ ] `server/src/routes/pdf.ts` (1083)
- [ ] `server/src/routes/postplan.ts` (126)
- [ ] `server/src/routes/projects.ts` (446)
- [ ] `server/src/routes/push.ts` (104)
- [ ] `server/src/routes/reise.ts` (482)
- [ ] `server/src/routes/sceneComments.ts` (90)
- [ ] `server/src/routes/scenes.ts` (277)
- [ ] `server/src/routes/screenplay.ts` (512)
- [ ] `server/src/routes/scriptSides.ts` (149)
- [ ] `server/src/routes/search.ts` (110)
- [ ] `server/src/routes/shots.ts` (100)
- [ ] `server/src/routes/stickyNotes.ts` (92)
- [ ] `server/src/routes/sun.ts` (69)
- [ ] `server/src/routes/tabellen.ts` (286)
- [ ] `server/src/routes/tasks.ts` (67)
- [ ] `server/src/routes/timesheets.ts` (193)
- [ ] `server/src/routes/vehicles.ts` (117)
- [ ] `server/src/routes/vertraege.ts` (781)
- [ ] `server/src/routes/vfx.ts` (149)
- [ ] `server/src/routes/youtube.ts` (445)

### Server: Bibliotheken

- [ ] `server/src/lib/benachrichtigungen.ts` (207)
- [ ] `server/src/lib/buchhaltung.ts` (238)
- [ ] `server/src/lib/callSheetLayout.ts` (429)
- [ ] `server/src/lib/creatorAreas.ts` (363)
- [ ] `server/src/lib/creatorInsights.ts` (256)
- [ ] `server/src/lib/creatorScript.ts` (437)
- [ ] `server/src/lib/dateien.ts` (165)
- [ ] `server/src/lib/dateiname.ts` (19)
- [ ] `server/src/lib/datenschutz.ts` (218)
- [ ] `server/src/lib/datum.ts` (15)
- [ ] `server/src/lib/documentLayout.ts` (391)
- [ ] `server/src/lib/drehzeit.ts` (84)
- [ ] `server/src/lib/floorplan.ts` (231)
- [ ] `server/src/lib/fountainExport.ts` (52)
- [ ] `server/src/lib/jugendschutz.ts` (240)
- [ ] `server/src/lib/kostenquellen.ts` (197)
- [ ] `server/src/lib/ksk.ts` (204)
- [ ] `server/src/lib/mahnungLayout.ts` (201)
- [ ] `server/src/lib/mahnwesen.ts` (287)
- [ ] `server/src/lib/mailaufbewahrung.ts` (32)
- [ ] `server/src/lib/mailversand.ts` (291)
- [ ] `server/src/lib/mailvorlagen.ts` (187)
- [ ] `server/src/lib/meldungenText.ts` (260)
- [ ] `server/src/lib/papierkorb.ts` (140)
- [ ] `server/src/lib/passwort.ts` (83)
- [ ] `server/src/lib/pdfFonts.ts` (62)
- [ ] `server/src/lib/person.ts` (20)
- [ ] `server/src/lib/rechnung.ts` (140)
- [ ] `server/src/lib/rechnungLayout.ts` (291)
- [ ] `server/src/lib/screenplayFormat.ts` (675)
- [ ] `server/src/lib/shotlist.ts` (324)
- [ ] `server/src/lib/spesen.ts` (184)
- [ ] `server/src/lib/szenenUeberschrift.ts` (143)
- [ ] `server/src/lib/tabelle.ts` (195)
- [ ] `server/src/lib/ueberlast.ts` (60)
- [ ] `server/src/lib/vertraege.ts` (293)
- [ ] `server/src/lib/videoMatching.ts` (220)
- [ ] `server/src/lib/wiederherstellung.ts` (296)
- [ ] `server/src/lib/youtubeInsights.ts` (270)
- [ ] `server/src/lib/youtubeOAuth.ts` (456)
- [ ] `server/src/lib/zahlungen.ts` (30)
- [ ] `server/src/lib/zweiterFaktor.ts` (153)

### Server: Skripte

- [ ] `server/src/scripts/lasttestDaten.ts` (32)
- [ ] `server/src/scripts/pdfprobe.ts` (165)
- [ ] `server/src/scripts/seedGrossproduktion.ts` (27)
- [ ] `server/src/scripts/zugriffsscan.ts` (460)

### Server: Rest

- [ ] `server/src/index.ts` (472)

### Client: Bibliotheken

- [ ] `client/src/lib/analytics.ts` (27)
- [ ] `client/src/lib/api.ts` (1184)
- [ ] `client/src/lib/belohnung.ts` (183)
- [ ] `client/src/lib/beschriftungen.ts` (130)
- [ ] `client/src/lib/i18n.ts` (629)
- [ ] `client/src/lib/motion.ts` (68)
- [ ] `client/src/lib/projectKind.ts` (36)
- [ ] `client/src/lib/spracheSenden.ts` (20)
- [ ] `client/src/lib/texte/AbnahmeAnsicht.ts` (32)
- [ ] `client/src/lib/texte/Abschluss.ts` (30)
- [ ] `client/src/lib/texte/ActivityFeed.ts` (27)
- [ ] `client/src/lib/texte/Agenturen.ts` (129)
- [ ] `client/src/lib/texte/Angebote.ts` (117)
- [ ] `client/src/lib/texte/AuditLog.ts` (39)
- [ ] `client/src/lib/texte/Aufgaben.ts` (23)
- [ ] `client/src/lib/texte/Auswertungen.ts` (85)
- [ ] `client/src/lib/texte/Benutzerverwaltung.ts` (31)
- [ ] `client/src/lib/texte/Buchhaltung.ts` (48)
- [ ] `client/src/lib/texte/Budget.ts` (105)
- [ ] `client/src/lib/texte/CastingAntwort.ts` (64)
- [ ] `client/src/lib/texte/CateringListe.ts` (47)
- [ ] `client/src/lib/texte/CheckinBoard.ts` (27)
- [ ] `client/src/lib/texte/CreatorChecklisten.ts` (20)
- [ ] `client/src/lib/texte/CreatorClips.ts` (20)
- [ ] `client/src/lib/texte/CreatorIdeen.ts` (27)
- [ ] `client/src/lib/texte/CreatorKanal.ts` (49)
- [ ] `client/src/lib/texte/CreatorPerformance.ts` (28)
- [ ] `client/src/lib/texte/CreatorRechte.ts` (40)
- [ ] `client/src/lib/texte/CreatorRedaktionsplan.ts` (27)
- [ ] `client/src/lib/texte/CreatorSeo.ts` (21)
- [ ] `client/src/lib/texte/CreatorSerien.ts` (25)
- [ ] `client/src/lib/texte/CreatorSponsoren.ts` (27)
- [ ] `client/src/lib/texte/CreatorTitel.ts` (18)
- [ ] `client/src/lib/texte/CreatorVideos.ts` (47)
- [ ] `client/src/lib/texte/DOOD.ts` (30)
- [ ] `client/src/lib/texte/Dateien.ts` (61)
- [ ] `client/src/lib/texte/Datenschutz.ts` (104)
- [ ] `client/src/lib/texte/DatenschutzWerkzeuge.ts` (64)
- [ ] `client/src/lib/texte/Drehplan.ts` (43)
- [ ] `client/src/lib/texte/EmailCenter.ts` (118)
- [ ] `client/src/lib/texte/EquipmentKalender.ts` (48)
- [ ] `client/src/lib/texte/ForgotPassword.ts` (29)
- [ ] `client/src/lib/texte/Impressum.ts` (56)
- [ ] `client/src/lib/texte/Invite.ts` (39)
- [ ] `client/src/lib/texte/Kameraberichte.ts` (39)
- [ ] `client/src/lib/texte/Komparsen.ts` (29)
- [ ] `client/src/lib/texte/Konfliktradar.ts` (18)
- [ ] `client/src/lib/texte/Kostenstand.ts` (52)
- [ ] `client/src/lib/texte/Listen.ts` (57)
- [ ] `client/src/lib/texte/Moodboard.ts` (38)
- [ ] `client/src/lib/texte/Musikliste.ts` (42)
- [ ] `client/src/lib/texte/Papierkorb.ts` (14)
- [ ] `client/src/lib/texte/Pinboard.ts` (22)
- [ ] `client/src/lib/texte/Postplan.ts` (44)
- [ ] `client/src/lib/texte/ProjectTemplates.ts` (76)
- [ ] `client/src/lib/texte/PublicDispo.ts` (30)
- [ ] `client/src/lib/texte/Rechnungen.ts` (108)
- [ ] `client/src/lib/texte/ResetPassword.ts` (16)
- [ ] `client/src/lib/texte/SetApp.ts` (34)
- [ ] `client/src/lib/texte/Setplan.ts` (72)
- [ ] `client/src/lib/texte/Shotlist.ts` (66)
- [ ] `client/src/lib/texte/StaebchenplanNew.ts` (31)
- [ ] `client/src/lib/texte/Suche.ts` (16)
- [ ] `client/src/lib/texte/SzenenKommentare.ts` (29)
- [ ] `client/src/lib/texte/Tagesbericht.ts` (53)
- [ ] `client/src/lib/texte/Terminkalender.ts` (51)
- [ ] `client/src/lib/texte/VFX.ts` (66)
- [ ] `client/src/lib/texte/Versicherungen.ts` (43)
- [ ] `client/src/lib/texte/Vertraege.ts` (204)
- [ ] `client/src/lib/texte/VertragBestaetigen.ts` (24)
- [ ] `client/src/lib/texte/ZeitAnalyse.ts` (34)
- [ ] `client/src/lib/texte/komponenten/AutoSaveIndicator.ts` (8)
- [ ] `client/src/lib/texte/komponenten/Drehplan.ts` (37)
- [ ] `client/src/lib/texte/komponenten/ErrorBoundary.ts` (8)
- [ ] `client/src/lib/texte/komponenten/Layout.ts` (70)
- [ ] `client/src/lib/texte/komponenten/OnboardingWizard.ts` (57)
- [ ] `client/src/lib/texte/komponenten/RetentionChart.ts` (10)
- [ ] `client/src/lib/texte/komponenten/Shared.ts` (49)
- [ ] `client/src/lib/texte/komponenten/SkipLink.ts` (7)
- [ ] `client/src/lib/texte/komponenten/YouTubeConnection.ts` (37)
- [ ] `client/src/lib/useDownload.ts` (82)
- [ ] `client/src/lib/useSchreibrecht.ts` (28)
- [ ] `client/src/lib/useT.ts` (22)
- [ ] `client/src/lib/utils.ts` (119)
- [ ] `client/src/lib/version.ts` (37)

### Client: Kontexte

- [ ] `client/src/contexts/AuthContext.tsx` (122)
- [ ] `client/src/contexts/ProjectRoleContext.tsx` (56)

### Client: Hooks

- [ ] `client/src/hooks/usePushSubscription.ts` (83)

### Client: Komponenten

- [ ] `client/src/components/ErrorBoundary.tsx` (41)
- [ ] `client/src/components/OnboardingWizard.tsx` (506)
- [ ] `client/src/components/ProtectedRoute.tsx` (13)
- [ ] `client/src/components/SkipLink.tsx` (14)
- [ ] `client/src/components/creator/BereichLayout.tsx` (145)
- [ ] `client/src/components/creator/RetentionChart.tsx` (199)
- [ ] `client/src/components/creator/YouTubeConnection.tsx` (182)
- [ ] `client/src/components/drehplan/ScenePool.tsx` (83)
- [ ] `client/src/components/drehplan/SceneStrip.tsx` (73)
- [ ] `client/src/components/drehplan/ShootDayColumn.tsx` (131)
- [ ] `client/src/components/layout/PageHeader.tsx` (33)
- [ ] `client/src/components/layout/Sidebar.tsx` (587)
- [ ] `client/src/components/layout/TopBar.tsx` (155)
- [ ] `client/src/components/shared/AutoSaveIndicator.tsx` (39)
- [ ] `client/src/components/shared/BrandMark.tsx` (26)
- [ ] `client/src/components/shared/FeedbackWidget.tsx` (107)
- [ ] `client/src/components/shared/GlobalSearch.tsx` (94)
- [ ] `client/src/components/shared/PDFPreviewModal.tsx` (42)
- [ ] `client/src/components/shared/ShortcutsModal.tsx` (81)
- [ ] `client/src/components/shared/TestversionBadge.tsx` (39)
- [ ] `client/src/components/shared/TutorialModal.tsx` (135)
- [ ] `client/src/components/ui/accordion.tsx` (50)
- [ ] `client/src/components/ui/alert.tsx` (35)
- [ ] `client/src/components/ui/avatar.tsx` (29)
- [ ] `client/src/components/ui/badge.tsx` (36)
- [ ] `client/src/components/ui/button.tsx` (41)
- [ ] `client/src/components/ui/card.tsx` (34)
- [ ] `client/src/components/ui/checkbox.tsx` (30)
- [ ] `client/src/components/ui/command.tsx` (94)
- [ ] `client/src/components/ui/dialog.tsx` (101)
- [ ] `client/src/components/ui/dropdown-menu.tsx` (173)
- [ ] `client/src/components/ui/input.tsx` (26)
- [ ] `client/src/components/ui/label.tsx` (74)
- [ ] `client/src/components/ui/nur-vorlesen.tsx` (28)
- [ ] `client/src/components/ui/popover.tsx` (34)
- [ ] `client/src/components/ui/progress.tsx` (15)
- [ ] `client/src/components/ui/scroll-area.tsx` (32)
- [ ] `client/src/components/ui/select.tsx` (130)
- [ ] `client/src/components/ui/separator.tsx` (19)
- [ ] `client/src/components/ui/skeleton.tsx` (7)
- [ ] `client/src/components/ui/switch.tsx` (19)
- [ ] `client/src/components/ui/table.tsx` (48)
- [ ] `client/src/components/ui/tabs.tsx` (51)
- [ ] `client/src/components/ui/textarea.tsx` (20)
- [ ] `client/src/components/ui/time-input.tsx` (77)
- [ ] `client/src/components/ui/toast.tsx` (106)
- [ ] `client/src/components/ui/toaster.tsx` (21)
- [ ] `client/src/components/ui/tooltip.tsx` (32)
- [ ] `client/src/components/ui/use-toast.ts` (81)

### Client: Seiten

- [ ] `client/src/pages/Abnahme.tsx` (672)
- [ ] `client/src/pages/AbnahmeAnsicht.tsx` (282)
- [ ] `client/src/pages/Abschluss.tsx` (226)
- [ ] `client/src/pages/ActivityFeed.tsx` (229)
- [ ] `client/src/pages/AdminPanel.tsx` (870)
- [ ] `client/src/pages/AdminStats.tsx` (504)
- [ ] `client/src/pages/Agenturen.tsx` (704)
- [ ] `client/src/pages/Angebote.tsx` (604)
- [ ] `client/src/pages/AuditLog.tsx` (285)
- [ ] `client/src/pages/Aufgaben.tsx` (220)
- [ ] `client/src/pages/Auswertungen.tsx` (464)
- [ ] `client/src/pages/Benutzerverwaltung.tsx` (222)
- [ ] `client/src/pages/Besetzung.tsx` (388)
- [ ] `client/src/pages/Buchhaltung.tsx` (282)
- [ ] `client/src/pages/Budget.tsx` (501)
- [ ] `client/src/pages/CastingAntwort.tsx` (322)
- [ ] `client/src/pages/CateringListe.tsx` (467)
- [ ] `client/src/pages/CheckinBoard.tsx` (331)
- [ ] `client/src/pages/Continuity.tsx` (575)
- [ ] `client/src/pages/CreatorChecklisten.tsx` (86)
- [ ] `client/src/pages/CreatorClips.tsx` (75)
- [ ] `client/src/pages/CreatorIdeen.tsx` (240)
- [ ] `client/src/pages/CreatorKanal.tsx` (200)
- [ ] `client/src/pages/CreatorPerformance.tsx` (105)
- [ ] `client/src/pages/CreatorRechte.tsx` (85)
- [ ] `client/src/pages/CreatorRedaktionsplan.tsx` (89)
- [ ] `client/src/pages/CreatorSeo.tsx` (77)
- [ ] `client/src/pages/CreatorSerien.tsx` (75)
- [ ] `client/src/pages/CreatorSponsoren.tsx` (102)
- [ ] `client/src/pages/CreatorTitel.tsx` (91)
- [ ] `client/src/pages/CreatorVideo.tsx` (887)
- [ ] `client/src/pages/CreatorVideos.tsx` (249)
- [ ] `client/src/pages/DOOD.tsx` (362)
- [ ] `client/src/pages/Dashboard.tsx` (440)
- [ ] `client/src/pages/Dateien.tsx` (341)
- [ ] `client/src/pages/Datenschutz.tsx` (48)
- [ ] `client/src/pages/DatenschutzWerkzeuge.tsx` (297)
- [ ] `client/src/pages/Drehbuch.tsx` (552)
- [ ] `client/src/pages/Drehplan.tsx` (419)
- [ ] `client/src/pages/EmailCenter.tsx` (700)
- [ ] `client/src/pages/Equipment.tsx` (271)
- [ ] `client/src/pages/EquipmentKalender.tsx` (422)
- [ ] `client/src/pages/Fahrzeuge.tsx` (169)
- [ ] `client/src/pages/Firma.tsx` (897)
- [ ] `client/src/pages/ForgotPassword.tsx` (95)
- [ ] `client/src/pages/Impressum.tsx` (73)
- [ ] `client/src/pages/Invite.tsx` (240)
- [ ] `client/src/pages/Kameraberichte.tsx` (501)
- [ ] `client/src/pages/Komparsen.tsx` (258)
- [ ] `client/src/pages/Konfliktradar.tsx` (140)
- [ ] `client/src/pages/Kontaktliste.tsx` (227)
- [ ] `client/src/pages/Kostenstand.tsx` (287)
- [ ] `client/src/pages/Listen.tsx` (225)
- [ ] `client/src/pages/Login.tsx` (280)
- [ ] `client/src/pages/Moodboard.tsx` (575)
- [ ] `client/src/pages/Motive.tsx` (476)
- [ ] `client/src/pages/Musikliste.tsx` (311)
- [ ] `client/src/pages/OffenePosten.tsx` (673)
- [ ] `client/src/pages/Papierkorb.tsx` (100)
- [ ] `client/src/pages/Pinboard.tsx` (161)
- [ ] `client/src/pages/Postplan.tsx` (369)
- [ ] `client/src/pages/ProjectList.tsx` (352)
- [ ] `client/src/pages/ProjectTemplates.tsx` (151)
- [ ] `client/src/pages/PublicDispo.tsx` (242)
- [ ] `client/src/pages/Rechnungen.tsx` (651)
- [ ] `client/src/pages/Reise.tsx` (772)
- [ ] `client/src/pages/ResetPassword.tsx` (88)
- [ ] `client/src/pages/ScreenplayEditor.tsx` (1428)
- [ ] `client/src/pages/SetApp.tsx` (452)
- [ ] `client/src/pages/Setplan.tsx` (420)
- [ ] `client/src/pages/Settings.tsx` (648)
- [ ] `client/src/pages/Shotlist.tsx` (372)
- [ ] `client/src/pages/SperrtageKalender.tsx` (425)
- [ ] `client/src/pages/Stabliste.tsx` (312)
- [ ] `client/src/pages/StaebchenplanNew.tsx` (472)
- [ ] `client/src/pages/Stammdaten.tsx` (496)
- [ ] `client/src/pages/Suche.tsx` (209)
- [ ] `client/src/pages/SzenenKommentare.tsx` (359)
- [ ] `client/src/pages/Tagesbericht.tsx` (349)
- [ ] `client/src/pages/Tagesdispo.tsx` (1116)
- [ ] `client/src/pages/Terminkalender.tsx` (335)
- [ ] `client/src/pages/Timesheets.tsx` (562)
- [ ] `client/src/pages/VFX.tsx` (304)
- [ ] `client/src/pages/Versicherungen.tsx` (394)
- [ ] `client/src/pages/Vertraege.tsx` (837)
- [ ] `client/src/pages/VertragBestaetigen.tsx` (254)
- [ ] `client/src/pages/ZeitAnalyse.tsx` (301)

### Client: Rest

- [ ] `client/src/App.tsx` (139)
- [ ] `client/src/index.css` (751)
- [ ] `client/src/main.tsx` (235)
- [ ] `client/src/sw.ts` (95)
- [ ] `client/src/vite-env.d.ts` (9)

### Werkzeuge

- [ ] `scripts/dateiliste.py` (69)
- [ ] `scripts/importe-pruefen.py` (75)
- [ ] `scripts/install-chromium.js` (103)
- [ ] `scripts/lasttest.cjs` (71)
- [ ] `scripts/lokal-starten.cjs` (102)
- [ ] `scripts/routen-pruefen.py` (81)
- [ ] `scripts/texte-pruefen.py` (70)

### Server: Tests

- [ ] `server/src/__tests__/abnahme.test.ts` (82)
- [ ] `server/src/__tests__/angebote.test.ts` (189)
- [ ] `server/src/__tests__/audit.test.ts` (73)
- [ ] `server/src/__tests__/beschriftungen.test.ts` (149)
- [ ] `server/src/__tests__/budget.test.ts` (87)
- [ ] `server/src/__tests__/callSheetLayout.test.ts` (283)
- [ ] `server/src/__tests__/chromiumLookup.test.ts` (67)
- [ ] `server/src/__tests__/creatorAreas.test.ts` (252)
- [ ] `server/src/__tests__/creatorInsights.test.ts` (205)
- [ ] `server/src/__tests__/creatorScript.test.ts` (236)
- [ ] `server/src/__tests__/dateien.test.ts` (156)
- [ ] `server/src/__tests__/dateiname.test.ts` (16)
- [ ] `server/src/__tests__/datenbank.test.ts` (1697)
- [ ] `server/src/__tests__/datum.test.ts` (30)
- [ ] `server/src/__tests__/documentLayout.test.ts` (230)
- [ ] `server/src/__tests__/documentRoutes.test.ts` (361)
- [ ] `server/src/__tests__/drehbuchImport.test.ts` (68)
- [ ] `server/src/__tests__/drehzeit.test.ts` (87)
- [ ] `server/src/__tests__/eingabe.test.ts` (140)
- [ ] `server/src/__tests__/floorplan.test.ts` (199)
- [ ] `server/src/__tests__/fountainExport.test.ts` (57)
- [ ] `server/src/__tests__/fremdschluessel.test.ts` (207)
- [ ] `server/src/__tests__/haertung.test.ts` (113)
- [ ] `server/src/__tests__/holidays.test.ts` (33)
- [ ] `server/src/__tests__/jugendschutz.test.ts` (187)
- [ ] `server/src/__tests__/kostenquellen.test.ts` (135)
- [ ] `server/src/__tests__/ksk.test.ts` (163)
- [ ] `server/src/__tests__/mahnwesen.test.ts` (231)
- [ ] `server/src/__tests__/mail.test.ts` (112)
- [ ] `server/src/__tests__/meldungen.test.ts` (123)
- [ ] `server/src/__tests__/oeffentliche-pfade.test.ts` (107)
- [ ] `server/src/__tests__/papierkorb.test.ts` (57)
- [ ] `server/src/__tests__/pdfTextebene.test.ts` (37)
- [ ] `server/src/__tests__/rechnung.test.ts` (159)
- [ ] `server/src/__tests__/routeAuth.test.ts` (162)
- [ ] `server/src/__tests__/schreibschutz.test.ts` (165)
- [ ] `server/src/__tests__/screenplayFormat.test.ts` (322)
- [ ] `server/src/__tests__/secrets.test.ts` (103)
- [ ] `server/src/__tests__/shotlist.test.ts` (221)
- [ ] `server/src/__tests__/spesen.test.ts` (187)
- [ ] `server/src/__tests__/szenenUeberschrift.test.ts` (115)
- [ ] `server/src/__tests__/tabelle.test.ts` (180)
- [ ] `server/src/__tests__/toPg.test.ts` (53)
- [ ] `server/src/__tests__/version.test.ts` (66)
- [ ] `server/src/__tests__/vertraege.test.ts` (131)
- [ ] `server/src/__tests__/videoMatching.test.ts` (154)
- [ ] `server/src/__tests__/wiederherstellung.test.ts` (166)
- [ ] `server/src/__tests__/youtubeInsights.test.ts` (214)
- [ ] `server/src/__tests__/youtubeOAuth.test.ts` (350)
- [ ] `server/src/__tests__/zeitzone.test.ts` (49)
- [ ] `server/src/__tests__/zweiterFaktor.test.ts` (144)
