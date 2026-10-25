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

Stand am 24.10.2026, 23 Uhr:

- **Fertig:** Gruppe Middleware (7 Dateien). Funde 1-9 eingetragen, 1, 4, 5, 6, 9
  behoben und committet.
- **Fertig:** Gruppe Datenbank (`db/index.ts`, `grossproduktion.ts`).
- **Routen bis `backup.ts` fertig** (siehe Haken). **Als Nächstes:**
  der nächste offene Haken unter "Server: Routen", alphabetisch weiter.
  `lib/wiederherstellung.ts` ist für Funde 46 und 70 angefasst, aber noch
  nicht ganz gelesen. Ebenso nur angefasst:
  `__tests__/schreibschutz.test.ts` (Leser-Variante).
- **Vor jedem Commit die ganze Testsuite**, nicht nur die Typprüfung -
  siehe Fund 41.
- **Gemessen, beim Lesen der Datei beheben** (Muster aus Fund 51/59, `PUT`
  auf eine fehlende Kennung gibt 2xx statt 404; Messweg
  `scratchpad/fehlende_zeilen.cjs`, sinngemäß: jede PUT/PATCH-Route mit
  Kind-Kennung 999999 als Admin aufrufen):
  `/scenes/:id`, `/shots/:id`.
- **Merkzettel für spätere Dateien** (gesehen, noch nicht gemessen):
  Client: Abmelden kündigt das Push-Abo nicht (`hooks/usePushSubscription.ts` nur aus den Einstellungen) - nach dem Logout kommen Benachrichtigungen des alten Kontos weiter in diesem Browser an (Fund 96).
  Meldungen, die über eine Konstante
  statt als `error: '...'` im Code stehen, sieht der Meldungstest nicht
  (Fund 41). 72 Routen fangen Fehler selbst ab
  und geben 500 "Interner Serverfehler" (Muster aus Fund 34).
  `Kostenstand.tsx:70` liest den Betrag mit `parseFloat(x.replace(',', '.'))`
  - "1.234,56" würde 1,23 € (`parseFloat("1.234.56")` ist 1.234).
  `Equipment.tsx:38` rechnet die Summe ohne Stückzahl und schickt sie mit;
  der Server ignoriert sie (rechnet selbst) - toter, irreführender Code.
  `main.tsx`: Ein unbekannter Pfad zeigt die rohe React-Router-Fehlerseite
  ("Unexpected Application Error! 404 Not Found", englisch) - eigene
  404-Seite fehlt (gemessen). `CheckinBoard.tsx:221`: Hinweis auf
  `/guest/checkin/…`, den es nicht gibt (Fund 79).
  Serverzeitzone (Muster aus Fund 36/80):
  `lib/buchhaltung.ts:114` DATEV-Zeitstempel und `lib/youtubeInsights.ts:224`
  Wochen/Wochentage - jeweils beim Lesen messen.
  `Budget.tsx` (Finanzierung): Der Server legt neue Zeilen mit Art
  "Förderung" an, die Auswahl kennt nur "Förderung regional"/"national" -
  prüfen, was die Auswahl dann zeigt.
- **Zeitstempel:** `pg` liefert TIMESTAMPTZ als `Date`, nur DATE kommt als
  Text (`db/index.ts:14`). `String(zeitstempel).slice(0, 10)` ist immer
  falsch - siehe Fund 29.
- Messweg für Geld: Firma, Kunde und Angebot über die API anlegen
  (`POST /companies`, `/companies/:id/clients`, `/companies/:id/quotes`),
  dann Beleg, `invoices/report/vat` und `buchhaltung/export.csv`
  gegeneinander lesen.
- **Fund 10 erledigt** (Demo-Adressen), dazu Fund 11 (Importvorlage).
  Messweg für Mails: `scratchpad/smtp-falle.cjs`-Prinzip - ein Fang-SMTP,
  das nur `RCPT TO` mitschreibt, und eine zweite Instanz mit
  `SMTP_HOST=127.0.0.1 SMTP_PORT=2525` auf Port 3099. Hinterher die
  Prozesse beenden: `netstat -ano` zeigt unter deutschem Windows "ABHÖREN".
- **Gepusht und online** bis `ca38c75` (25.10.2026, siehe Deploy-Prüfung).
  Was danach committet ist, steht mit `git log origin/master..HEAD` da.
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

**Zweiter Deploy am 25.10.2026, gegen 17:45.** Push `5612997..ca38c75`
(31 Commits, Funde 1-64) mit Florians Freigabe. Lokal `npm run build` wie auf
Render: fehlerfrei. Online ohne Anmeldung geprüft: `/api/health` ok, Hauptbundle
`index-C_TjEwAf.js` → `index-CR4ALchc.js`; die neuen Texte stehen im
ausgelieferten Code (`AdminStats`: "Adresse in Mail-Links", `Tagesdispo`:
`nicht_zustellbar`). `curl` erreicht Render aus der Sandbox nicht
(Namensauflösung) - geprüft über das eingebaute Browserfenster.

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
| 8 | `user_totp.recovery_codes`, `password_reset_tokens.token` | **Sicherheit, live** | Wiederherstellungscodes und Rücksetz-Token standen im Klartext in der Datenbank; wer sie las, konnte ein Passwort zurücksetzen oder den zweiten Faktor umgehen. | ja: Token in der Datenbank gleich dem im Link, Codes wörtlich in `recovery_codes` | behoben: Token als SHA-256 (256 Bit, schneller Hash genügt), Codes per scrypt mit Salz (`lib/zweiterFaktor.ts`); `db/index.ts` stellt Altbestand beim Start um, offene Links und alte Codes gelten weiter - beides gemessen (Neustart, alter Code 200). Danach: kein Klartext. |
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
| 27 | `server/src/routes/angebote.ts` (`POST`/`PUT .../quotes`) | Fehler, Geld | `tax_mode` wurde ungeprüft gespeichert und bei Annahme auf die Rechnung übertragen. Bei einem Wert außer `regel`/`kleinunternehmer` rechnete der Beleg 19 %, die USt-Auswertung auch, der Buchhaltungs-Export (`buchhaltung.ts`, `jeSatz`) aber 0,00 Umsatzsteuer. Nur über die API erreichbar, die Oberfläche schickt kein `tax_mode`. | ja: Angebot `xyz` → Rechnung 119,00 €, USt-Auswertung 19,00 €, CSV-Export "0,00" Steuer, "100,00" brutto | behoben: `istSteuerart` in `lib/rechnung.ts`, sonst 400; danach gemessen: `xyz` und `reverse_charge` 400, beide Steuerarten gehen durch |
| 28 | `companies.tax_mode`, `routes/companies.ts:108` | Hinweis, Entscheidung | Die Kleinunternehmerregelung (§ 19 UStG) ist in Rechnung, Blatt und DATEV eingebaut, aber nicht einschaltbar: Keine Route setzt `companies.tax_mode`, und der Client schickt nirgends `tax_mode`. Jede Firma rechnet mit Regelbesteuerung. | nein, gelesen: `grep tax_mode` über Server und Client | offen, für Florian: Schalter in den Firmendaten oder Teil entfernen |
| 29 | `server/src/routes/anliegen.ts:121,168` | Fehler | "Was anliegt" las `sent_at` (TIMESTAMPTZ, von `pg` als `Date` geliefert) per `String(...).slice(0, 10)` - das ergab "Mon Oct 12", `tageZwischen` gab 0. Kein unbeantworteter Vertrag und keine Agenturanfrage ohne abgelaufene Frist kam je auf die Liste. | ja: Vertrag seit 12 Tagen, Anfrage seit 10 Tagen - Liste leer | behoben: Tag über `heuteISO(new Date(...))` (Berlin); danach beide in der Liste. Anderswo kommt das Muster nicht vor (grep) |
| 30 | `server/src/routes/anliegen.ts:65` | Fehler, Recht | Wie Fund 18: Kinder ohne Bewilligung nur aus der Besetzung, nicht aus der Komparserie. | ja: Komparsin, 11 Jahre, fehlte | behoben: Besetzung und Komparserie, Titel mit "(Komparserie)" |
| 31 | `server/src/routes/anliegen.ts:115` | Fehler, Datenschutz | Gescheiterte Mails zählten mit `OR project_id IS NULL` - also die Passwort-Mails aller Konten der ganzen Installation, bei jeder Firma. | ja: fremde Passwort-Mail → "1 Mail nicht zugestellt" | behoben: ohne Projekt nur Mahnungen zu eigenen Rechnungen; gemessen: fremde 0, eigene Mahnung 1 |
| 32 | `server/src/routes/anliegen.ts:50` | Zugriff | Ein Firmen-Mitarbeiter sah überfällige Rechnungen mit Nummer und offenem Betrag, die Rechnungsseite gibt ihm 403 ("Rechnungen sehen und schreiben darf die Produktion"). | ja: Mitarbeiter sah "Rechnung … 1.190,00 € offen", `GET .../invoices` 403 | behoben: Rechnungen ab Rolle Produktion |
| 33 | `server/src/routes/anliegen.ts:104` | Fehler | Abgelaufene Nachweise abgeschlossener Projekte standen als "dringend" in der Liste - jede Genehmigung läuft irgendwann ab, die Liste wüchse mit jedem Projekt. | ja: Drehgenehmigung im archivierten Projekt "dringend" | behoben: nur nicht archivierte Projekte |
| 34 | `server/src/middleware/eingabe.ts` (`uebersetzeDatenbankfehler`), `routes/audit.ts` | Fehler, klein | Ein ungültiges Datum in einem Filter (`?von=abc`, `?bis=2026-13-45`) ergab 500 "Unerwarteter Serverfehler" - der Übersetzer kannte Datumsfehler nicht, `audit.ts` fing Fehler selbst ab und gab 500. | ja: Buchhaltung, USt-Auswertung, Auswertungen, Protokoll (Liste und CSV) je 500 | behoben: Regel im Übersetzer (400 "Ein Datum ist ungültig."), `audit.ts` reicht Fehler weiter; danach alle sechs 400, gültige Filter 200 |
| 35 | `server/src/lib/tabelle.ts:181` (`schreibeCsv`) | Härtung, Entscheidung | CSV-Felder, die mit `=`, `+`, `-` oder `@` beginnen, gehen unverändert hinaus. Excel liest so ein Feld als Formel - im Protokoll-Export etwa einen selbst gewählten Kontonamen `=HYPERLINK(...)`. Schutz (vorangestelltes `'`) hätte Folgen: Telefonnummern wie `+49 151…` und der Wiederimport über `tabellen.ts` müssten mitbedacht werden. | Feld ja: `"=HYPERLINK(""https://beispiel.test"";""Klick"")"` im Export; Ausführung in Excel **nicht gemessen** | offen, beim Lesen von `lib/tabelle.ts` mit Import zusammen entscheiden |
| 36 | `server/src/routes/auswertungen.ts:28,210,328` | Fehler, klein | Wie Fund 15, aber fürs Jahr: Standardzeitraum und KSK-Jahr kamen aus `new Date().getFullYear()` (Serveruhr, beim Hoster UTC). | ja, gerechnet für 00:30 Uhr am 1.1.2027 Berliner Zeit: Zeitraum `2026-01-01` bis `2027-01-01`, KSK-Jahr 2025 statt 2026 | behoben: Jahr aus `heuteISO()`; heute gemessen unverändert (`2026-01-01` bis heute, KSK 2025) |
| 37 | `server/src/routes/auswertungen.ts` (`PUT .../ksk/:art/:personId`) | Fehler | Ohne `ksk_relevant` im Körper wurde aus "unentschieden" ein "nein" - der Kommentar daneben sagt, `null` sei keine Abkürzung für nein, `undefined` war es doch. | ja: `{}` → `ksk_relevant: false` in der Datenbank | behoben: nur `true`, `false`, `null`, sonst 400; alle fünf Fälle gemessen |
| 38 | `auswertungen.ts` (Deckungsbeitrag), `Kostenstand.tsx` | Hinweis, Entscheidung | Der Deckungsbeitrag zieht von **Netto**-Umsätzen die Ausgaben ab. Bei Ausgaben steht nur "Betrag", ohne netto oder brutto. Wer Belege brutto erfasst, sieht eine um die Vorsteuer zu niedrige Marge. | nein, gelesen: `expenses` hat nur `amount_cents`, Eingabefeld "Betrag (€)" | offen, für Florian: Feld als "netto" beschriften oder Steuer mit erfassen |
| 39 | `server/src/routes/auth.ts` (`/register`, `/reset-password`, `/me/password`), `routes/confirmation.ts:151` | **Sicherheit, live** | Ein neues Passwort beendete keine Anmeldung: Nach dem Zurücksetzen per Link galten alle alten Sitzungen weiter - gerade dann, wenn jemand Fremdes drin ist. Nach dem Passwortwechsel ebenso die anderen Geräte. Die Registrierung (und das Konto aus der Dispo-Bestätigung) gab ein Token ohne Sitzung aus, das "alle anderen abmelden" und das Zurücksetzen 30 Tage lang überstand. Andere offene Rücksetz-Links blieben gültig. | ja: nach dem Zurücksetzen alte Anmeldung 200, Registrierungs-Token 200; nach dem Wechsel anderes Gerät 200 | behoben: Zurücksetzen beendet alle Sitzungen und alle offenen Links, Wechsel alle außer dem eigenen Gerät; Registrierung und Dispo-Konto bekommen eine Sitzung. Danach: 401, 401, 401, eigenes Gerät 200, Link zweimal 400, zweiter Link 400. Test in `datenbank.test.ts`, gegen alten Stand rot. **Tokens ohne Sitzung aus der Zeit vor dem Deploy gelten bis zu ihrem Ablauf (höchstens 30 Tage).** |
| 40 | `server/src/routes/auth.ts` (Anmeldung, Anmeldeverlauf) | Fehler | Sitzung und Anmeldeverlauf lasen die IP aus dem Kopf `X-Forwarded-For`, den der Client selbst setzt. | ja: gefälschter Kopf `203.0.113.99` stand in Verlauf und Sitzung | behoben: `req.ip` (hinter dem Hoster über `trust proxy`); danach die echte Adresse |
| 41 | `middleware/eingabe.ts`, `lib/ueberlast.ts`, `lib/meldungenText.ts` | Text | Die Sätze des Fehlerübersetzers ("Eine Zahl wurde als Text übergeben." usw.) und die Überlastmeldung hatten keine Übersetzung - mit `X-Sprache: en` kamen sie deutsch. Ebenso drei neue Meldungen dieser Prüfung (Steuerart, KSK, Datum); die KSK-Meldung hatte den Meldungstest rot gemacht (Commit `e41d870` ohne vollen Testlauf). | ja: `X-Sprache: en` → "Eine Zahl wurde als Text übergeben.", Gegenprobe "Ungültige Anmeldedaten" kam englisch | behoben: zehn Einträge in `MELDUNGEN`; `eingabe.test.ts` prüft je Satz die Übersetzung. Danach englisch und französisch gemessen |
| 42 | `server/src/routes/auth.ts` (Rücksetz-Mail) | Klein | Der Kontoname ging unmaskiert in die Mail (wie Fund 23). | ja: `<b>Fett</b> <img src=x>` wörtlich im HTML | behoben: `maskiere` |
| 43 | `server/src/routes/auth.ts` (`GET /me/export`) | Datenschutz | Der Export "aller personenbezogenen Daten" ließ Anmeldeverlauf, Sitzungen (je mit IP und Gerät), Firmenmitgliedschaften und den Stand des zweiten Faktors weg. | ja: Admin-Konto 69 Anmeldungen, 69 Sitzungen, 5 Firmen - im Export keine | behoben: alle vier im Export, der 2FA-Schlüssel bleibt draußen (gemessen) |
| 44 | `server/src/routes/backup.ts` (`GET .../backup`) | **Sicherheit, live** | Jedes Mitglied darf die Sicherung laden, auch mit Lesezugriff - und darin standen alle Links mit Token: Einladungen (die sonst nur Projekt-Admins sehen), Verträge, Abnahmen, Casting-Anfragen, Dispo-Bestätigungen. Eine Einladung prüft beim Annehmen nicht, für wen sie gedacht war. | ja: Leser lädt die Sicherung, nimmt die Einladung der Produzentin an, ist danach Produzent; Einladungsliste direkt 403 | behoben: keine Spalte mit `token`/`password`/`secret` in der Sicherung, aus keiner Tabelle - dieselbe Regel wie beim Zurückspielen (`istGeheimnis`). Danach 0 Token, 78 Tabellen ohne Geheimnis-Spalte, Zurückspielen geht weiter. **Offen für Florian:** Ob ein Leser die Sicherung überhaupt laden soll, und ob Einladungen an eine Adresse gebunden sein sollen. |
| 45 | `server/src/middleware/projectAuth.ts` (`requireMember`) | Fehler | Das Zurückspielen einer Sicherung (`POST /projects/import`) gab jedem Konto außer einem globalen Admin 403 "Kein Zugriff auf dieses Projekt" - `requireMember` hielt "import" für eine Projektnummer, global und in 31 Routern. | ja: normales Konto, eigene Sicherung → 403 | behoben: Ausnahme für `KEINE_ID` in `requireMember`; danach 201 mit 8 Szenen und 11 Drehbuchblöcken. Fremdes Projekt weiter 403 (Test) |
| 46 | `server/src/lib/wiederherstellung.ts` (`importiereInhalt`) | **Sicherheit** (bisher nur für Admins erreichbar) | Beim Zurückspielen wurden Verweise in Firmen wörtlich übernommen (`company_id`, `client_id`, `contact_id`, `agency_id`) - aus einer bearbeiteten Datei also in jede fremde Firma. Rechnungen wurden als Doppel angelegt; beim Demo-Projekt brach das mit 500 ab. | ja: Demo-Projekt mit Rechnung → 500; präparierte Datei vor dem Fix nicht messbar (Fund 45 sperrte alle außer Admins) | behoben: Firmenverweise leer, Rechnungen nie zurückgespielt; danach Demo 201, präparierte Datei: 0 Rechnungen, alle vier Verweise `null`. Erst damit ist Fund 45 geöffnet. Test, gegen alten Stand rot |
| 47 | `server/src/routes/backup.ts` (`POST /projects/import`) | Fehler | Scheiterte das Zurückspielen mittendrin, blieb ein Projekt "(Import)" mit einem Teil der Daten in der Liste. | ja: nach dem 500 aus Fund 46 stand "Sprachlos (Demo) (Import)" mit 9 Szenen da | behoben: Bei einem Abbruch wird das neue Projekt wieder gelöscht; gemessen mit einer Datei, an der das Einfügen scheitert: 500, kein Projekt bleibt |
| 48 | `server/src/routes/blackoutDates.ts:108` | Fehler | Sperrtage liegen in Textspalten, der Server nahm jedes Datum an: `"abc"` wurde gespeichert, `2026-02-30` ging als 2. März durch. Die Konfliktprüfung gegen die Drehtage übersah solche Einträge still. Löschen fremder Sperrtage ist geschützt (403, gemessen). | ja: `abc`/`abc` → 201 | behoben: `istIsoDatum` in `lib/datum.ts` (echtes Kalenderdatum), sonst 400; danach `abc` und 30. Februar 400, gültige 201, Konflikt mit Drehtag gefunden |
| 49 | `server/src/routes/buchhaltung.ts:100` (`jeSatz`) | Fehler, Geld (latent, siehe Fund 28) | Beim Kleinunternehmer stand in der Buchhaltungstabelle "Steuersatz 19" mit 0,00 Umsatzsteuer; die USt-Auswertung zeigte Satz 0. Der Export rechnete mit Regelbesteuerung und nullte danach nur die Steuer. | ja: Rechnung `kleinunternehmer` → CSV `19;100,00;0,00`, USt-Auswertung `satz: 0` | behoben: `summiere` mit der Steuerart des Belegs; danach CSV Satz 0, Regelbesteuerung unverändert 19 % (beides gemessen). DATEV-Erlöskonto unverändert |
| 50 | `server/src/routes/buchhaltung.ts:268` (`wjBeginn`) | Hinweis | Der DATEV-Kopf nimmt den Beginn des Wirtschaftsjahres aus dem Startjahr des Zeitraums. Ein Zeitraum über den Jahreswechsel trägt Buchungen des neuen Jahres mit dem alten Wirtschaftsjahr. Ob DATEV so einen Stapel annimmt, ist hier nicht prüfbar. | nein, gelesen | offen: beim ersten Probeimport in der Kanzlei mitprüfen oder Zeitraum auf ein Jahr begrenzen |
| 51 | `server/src/routes/budget.ts` (`PUT /budget-lines/:id`, `PUT /financing-entries/:id`) | Klein | Eine Zeile, die es nicht gibt: Kalkulation 200 ohne Daten, Finanzierung 500. Teilüberschreiben (alle Felder werden gesetzt) ist über die Oberfläche nicht erreichbar - `Budget.tsx` schickt immer die ganze Zeile. | ja: 200 `{"error":null}` und 500 | behoben: vorher prüfen, 404; vorhandene Zeile weiter 200 |
| 52 | `server/src/routes/calendar.ts:14`, `services/holidays.ts:35` | Fehler (derzeit ohne Wirkung) | Standard-Bundesland `'NRW'`, die Feiertagsliste kennt nur `'NW'`: ohne Angabe 9 statt 13 Feiertage, Fronleichnam und Allerheiligen fehlten. Keine Seite ruft die Feiertage ab (`api.calendar.holidays` ungenutzt). | ja: ohne Angabe 9, mit `NW` 13 | behoben: Standard `NW`, Jahr aus `heuteISO`; danach 13 |
| 53 | `server/src/routes/calendar.ts` (`POST .../events`, `PUT /events/:id`) | Fehler | Termine in Textspalten: `"abc"` als Datum wurde gespeichert, der Kalender zeigte den Termin an keinem Tag. Ein leeres Ende aus dem Formular stand als `''` statt `null` da. Ein fehlender Termin ergab beim Ändern 500. | ja: 201 mit `abc`, 500 | behoben: echtes Datum verlangt (leeres Ende = kein Ende), 404; danach 400, 404, Formular-Termin 201 mit Ende `null` |
| 54 | `server/src/routes/callsheets.ts` (`POST .../call-sheet/send`) | **Fehler, Datenschutz, live** | Der Dispo-Versand ordnete jede Mail über die Adresse ihrer Person zu. Teilen sich zwei eine Adresse (Eltern mehrerer Kinder, ein Haushalt), bekam jede Mail Name, Call-Time, Hinweis und Bestätigungslink der ersten Person - die zweite konnte die Anwesenheit der ersten bestätigen. | ja: Zweitinstanz mit Fang-SMTP; Ben (Call 10:00) bekam "Hallo Anna", 07:00, Annas Hinweis | behoben: Zuordnung über den Token des Eintrags; danach Ben 10:00, eigener Name, kein fremder Hinweis |
| 55 | `server/src/routes/callsheets.ts` (Dispo-Mail) | Fehler, Text | Projekttitel, Name, Motiv und Hinweis gingen unmaskiert ins Mail-HTML (wie Fund 23); "bestaetigen" und "vollstaendige" im Mailtext. | ja: `<Kamera>`, `<Tor 2>`, `<B>` roh im HTML | behoben: `maskiere`, echte Umlaute; danach `&lt;Tor 2&gt;` |
| 56 | `server/src/routes/callsheets.ts` (`PUT /call-sheets/:id/entries`) | Klein | Ohne Liste im Körper 500. | ja: `{}` → 500 | behoben: 400; gültige Liste 200 |
| 57 | `server/src/middleware/projectAuth.ts` (`entityPatterns`) | **Zugriff, live** | Für Kameraberichte (`/camera-reports/:id`), Grundrisse (`/floorplans/:id`, `/floorplan-items/:id`) und alle Creator-Kindrouten (`/creator/videos|sections|ideas|assets|clips|checklist/:id`) kannte der Schreibschutz kein Muster, löste kein Projekt auf und ließ durch. Die Routen prüfen selbst nur die Mitgliedschaft: Ein Mitglied mit Lesezugriff änderte, ergänzte und löschte. Ins Änderungsprotokoll kamen diese Änderungen nicht. Der Test `schreibschutz.test.ts` prüfte nur fremde Konten. | ja: Leser ändert und löscht Kamerabericht, Grundriss, Video (200/201) | behoben: neun Muster; danach Leser überall 403, Abteilungsleitung weiter 200. `schreibschutz.test.ts` ruft jetzt jede schreibende Route auch als Leser auf - gegen alten Stand 17 Treffer |
| 58 | `server/src/routes/drehplan.ts` (`POST /shoot-days/move-scene`) | Zugriff | Prüfte nur die Mitgliedschaft; ein Leser schob Szenen auf andere Drehtage. Der Pfad trägt keine Kennung, der Schutz kann ihn nicht auflösen. | ja: Leser verschiebt Szene 1 von Tag 1 nach 2, 200 | behoben: mindestens Abteilungsleitung; danach Leser 403, Abteilungsleitung 200. Dazu Übersetzungen für die drei Rollenmeldungen des Schutzes |
| 59 | `server/src/routes/characters.ts` (`PUT /characters/:id`, `PUT /cast/:id`), `checkin.ts:9` | Klein, Text | Fehlende Figur oder fehlender Darsteller: 200 ohne Daten (wie Fund 51). In `checkin.ts` stand "public, no auth required" - der Check-in verlangt eine Anmeldung. | ja: 200 `{"error":null}`; Check-in ohne Anmeldung 401 | behoben: 404; Kommentar richtiggestellt |
| 60 | `server/src/routes/confirmation.ts` (`POST /cse/t/:token/claim`) | **Sicherheit, Entscheidung** | Wer den Dispo-Link einer Person hat, legt mit deren Adresse ein Konto an (ohne Bestätigung der Adresse) und ist danach Leser im Projekt - mit Lesezugriff auf Kalkulation, Gagen, Stab und Besetzung. Dispo-Links werden am Set weitergeleitet; der echte Inhaber kann sich danach nicht mehr registrieren (409), sondern kommt nur über "Passwort vergessen" an das Konto. | ja: Link → Konto → 17 Kalkulationszeilen, Stab mit Gage, Besetzung lesbar | offen, für Florian: Bestätigungsmail an die Adresse statt sofortigem Konto, oder eine engere Rolle für so entstandene Konten |
| 61 | `server/src/routes/conflicts.ts` (Konfliktradar) | Fehler, Text | Zwei Drehtage ohne Datum ergaben die Warnung "Mehrere Drehtage am " (Scheinkonflikt). Ohne Finanzierungsplan stand "übersteigt Finanzierung (NaN €)". Tage ohne Datum hießen "Drehtag 1 () enthält keine Szenen", sonst stand das ISO-Datum im deutschen Satz. | ja: Wegwerfprojekt mit zwei Tagen ohne Datum, Kalkulation 12.345 €, ohne Finanzierung | behoben: Tage ohne Datum zählen nicht als Konflikt, fehlende Finanzierung 0 €, Datum als `04.11.2026` oder "ohne Datum"; danach gemessen, ein echter Konflikt am selben Datum wird weiter gemeldet |
| 62 | `server/src/routes/crew.ts` (`PUT /crew/:id`) | Klein | Fehlender Stabeintrag: 200 ohne Daten (Muster aus Fund 51, vom Scan gefunden). | ja | behoben: 404; vorhandener Eintrag 200 |
| 63 | `server/src/routes/dailyreports.ts:50` (`time-analysis`), `PUT /daily-reports/:id` | Fehler, klein | Die Zeitanalyse sortierte nach `scene_number` (Text): "1 10 100 101 101A … 11". Ein fehlender Bericht gab beim Ändern 200 ohne Daten. | ja: Großproduktion, 160 Szenen | behoben: Reihenfolge wie die Szenenliste (`sort_order`, dann Nummer), danach identisch; 404 |
| 64 | `server/src/routes/dateien.ts` (`GET /companies/:id/dateien/fristen`) | Fehler | Wie Fund 33: Abgelaufene Nachweise abgeschlossener Projekte standen in der Fristenliste der Firma. | ja: Drehgenehmigung des archivierten Projekts "Messarchiv" gelistet | behoben: nur nicht archivierte Projekte; Gegenprobe mit laufendem Projekt weiter gelistet |
| 65 | `server/src/routes/datenschutz.ts` (Verzeichnis nach Art. 30) | Text, Recht | "Öffentliche Links tragen Zufallstoken mit 160 Bit" stimmte nicht für alle: Die Empfangsquittung der Mails hat 128 Bit (Dispo/Einladung 160, Abnahme/Agentur/Vertrag 192, Gastlink 256). Dazu "ausschliesslich". | ja: `randomBytes` je Linkart ausgezählt | behoben: "mindestens 128 Bit", "ausschließlich"; im Verzeichnis nachgemessen |
| 66 | `server/src/routes/datenschutz.ts` | Hinweis, Entscheidung (Recht) | Verpflegungsangaben (Unverträglichkeiten) sind Gesundheitsangaben - `catering.ts` nennt sie selbst so -, das Verzeichnis nennt als Grundlage nur Art. 6 Abs. 1 lit. a. Für Gesundheitsdaten regelt die DSGVO zusätzlich Art. 9. Die Übersicht "Wer hat Zugriff" nennt nur Projektmitglieder, globale Admins sehen aber jedes Projekt. | nein, gelesen | offen, für Florian - rechtlich prüfen lassen |
| 67 | `server/src/routes/dood.ts:23` | Fehler | Der DOOD-Bericht sortierte Drehtage nach `date`; Tage ohne Datum (`''`) standen vorn. Arbeitete jemand an so einem Tag, galt ein Tag vor seinem ersten Einsatz als Haltetag. | ja: Tag 2 ohne Datum vor Tag 1, Tag 1 = H | behoben: Datum aufsteigend, Tage ohne Datum ans Ende nach Nummer; danach Tag 1 kein Haltetag. Drehplan sortiert ebenso nach `date` - bei `drehplan.ts` prüfen |
| 68 | `server/src/routes/drehplan.ts` (Drehtage anlegen, Serie, ändern, Nummerierung, `reorder`) | Fehler | Drehtage nahmen jedes Datum an (`"abc"`, `"x"`, `''`). Die Nummerierung nach `date` machte einen Tag ohne Datum zu "Drehtag 1" und schob den echten ersten Tag auf 2. Ein fehlender Tag gab beim Ändern 200 ohne Daten, `reorder` ohne Liste 500. | ja: Wegwerfprojekt, alle vier | behoben: echtes Datum Pflicht (der Client schickt immer eins), alte Tage ohne Datum zählen ans Ende, 404, 400; danach gemessen. Ob es in der Produktion Tage ohne Datum gibt, ist ohne Anmeldung nicht prüfbar |
| 69 | `server/src/routes/emailRoutes.ts` (`loeseGruppeAuf`, Regel `drehtag`) | **Datenschutz, live seit dem Deploy vom 25.10.2026** | Beim Auflösen eines Drehtag-Verteilers wurde nicht geprüft, ob der Drehtag zum Projekt gehört (nur beim Anlegen). Seit Fund 45 kann jedes Konto eine Sicherung zurückspielen, und Verteiler aus der Datei umgehen die Prüfung beim Anlegen. | ja: Verteiler aus einer Sicherung lieferte Empfänger eines fremden Projekts | behoben: Auflösen nur für Drehtage des eigenen Projekts; danach fremd 0 Empfänger, eigener Verteiler 7. **Muss mit der nächsten Freigabe raus** |
| 70 | `server/src/lib/wiederherstellung.ts` (`importiereInhalt`) | Fehler, Datenschutz | Beim Zurückspielen kamen Verweise unverändert mit, die die Abbildung nicht kannte: Drehtag-Verteiler, Abnahme-Fassung (`cut_id`), Unterkunft (`accommodation_id`), Vertragsvorlage, Verteilermitglieder. In der Kopie zeigten sie auf Zeilen des alten Projekts. Postausgang, Anhänge und Papierkorb wurden mitkopiert - wartende Mails gingen aus der Kopie erneut hinaus. | ja: Projekt 1 gesichert und zurückgespielt - Verteiler auf fremden Drehtag, je ein fremder Verweis bei Abnahme und Reise, 19 Mails im Postausgang der Kopie | behoben: vier neue Abbildungen, Drehtag-Verteiler wird umgeschrieben, Postausgang/Anhänge/Papierkorb bleiben beim alten Projekt; danach 0 fremde Verweise, 0 Mails, Verteiler mit 7 eigenen Empfängern. Test, gegen alten Stand rot |
| 71 | `server/src/routes/backup.ts` (Export) | Datenschutz | Die Projektsicherung (für jedes Mitglied ladbar) enthielt Postausgang, Anhänge und altes Mail-Protokoll mit vollem Mailtext - darin persönliche Links aus Einladungen und Dispositionen. Fund 44 entfernte nur Spalten mit `token` im Namen. | ja: 14 von 19 Mails des Demo-Projekts mit so einem Link in der Sicherung | behoben: diese drei Tabellen bleiben aus der Sicherung (zurückgespielt werden sie seit Fund 70 ohnehin nicht); danach nicht mehr enthalten, Zurückspielen weiter ok |
| 72 | `server/src/routes/equipment.ts` (`PUT /equipment-items/:id`) | Fehler, Geld | Beim Ändern machte `(quantity || 1)` aus Stückzahl 0 eine 1 (ebenso Tage): Anlegen mit 0 Stück ergab 0 €, Ändern auf 0 Stück 100 €. Eine fehlende Position ergab 500. | ja: 0 € beim Anlegen, 100 € beim Ändern; 500 | behoben: gleiche Rechnung wie beim Anlegen, 404; danach 0 Stück 0 €, 3 Stück 300 € |
| 73 | `server/src/routes/equipmentCalendar.ts` | Fehler | Die Konfliktprüfung hielt zwei Buchungen ohne Posten immer für dasselbe Gerät (`null === null`): "Kran / Dolly" als Konflikt. Datumsfelder nahmen "abc" an (Textspalten). Beim Ändern ließ sich der Anfang hinter das gespeicherte Ende legen; eine fehlende Buchung ergab 200. | ja: alle vier | behoben: ohne Posten entscheidet der Name, echtes Datum Pflicht, Reihenfolge gegen den gespeicherten Stand, 404; danach "Kran / kran" weiter Konflikt, Kran / Dolly nicht |
| 74 | `server/src/routes/expenses.ts` (`kostenstand`) | Fehler | Kalkulationszeilen ohne Kategorie standen unter `""`, Belege ohne Kategorie unter "Ohne Kategorie" - Soll und Ist derselben Sache in zwei Zeilen. | ja: `"": Soll 500, Ist 0` und `"Ohne Kategorie": Soll 0, Ist 200` | behoben: beide unter "Ohne Kategorie"; danach eine Zeile Soll 500, Ist 200 |
| 75 | `server/src/routes/feedback.ts` (`PUT /feedback/:id`) | Klein | Fehlender Eintrag: 200 (Muster aus Fund 51, vom Scan). | ja | behoben: 404; vorhandener 200 |
| 76 | `server/src/routes/floorplans.ts` (Löschen, Bild ersetzen, PDF) | **Datenverlust** | Die Bilddatei eines Set-Plans wurde über die Kennung aus `image_url` gelöscht und gelesen, ohne Prüfung des Projekts. Eine zurückgespielte Kopie trägt die Adresse des Originals: Das Löschen ihres Plans löschte das Bild des Originals. | ja: Plan der Kopie gelöscht → Bild des Originals weg | behoben: nur Dateien des eigenen Projekts; danach Bild des Originals noch da |
| 77 | `server/src/lib/wiederherstellung.ts` (Dateiinhalt, `image_url`) | **Datenverlust, live** | Beim Zurückspielen wurde jede Datei der Ablage kaputt gespeichert: In der Sicherung steht der Inhalt als `{"type":"Buffer","data":[…]}`, und genau dieser Text landete in der Datenbank (aus einem 6-Byte-PDF wurden 44 Bytes JSON). Betrifft Drehgenehmigungen, Vertragsscans, Nachweise, Grundrisse. Dazu zeigten Set-Plan-Bild, Storyboard (`shots.storyboard_url`) und Motivfotos (`locations.photos`) der Kopie auf Dateien des Originals; `shots.ts` löschte beim Ersetzen ebenfalls ohne Projektprüfung. | ja: `%PDF-1` → `{"type":"Buf…` | behoben: Buffer-Form wird zurückgewandelt (auch für alte Sicherungen), alle drei Adressarten nach dem Einfügen aller Tabellen auf die mitkopierten Dateien umgeschrieben (eine feste Reihenfolge gibt es nicht: Dateien hängen ihrerseits an Einstellungen und Motiven), `shots.ts` mit Projektprüfung; danach Inhalt gleich, Kopie liefert ihr Bild aus. Test, gegen alten Stand rot. **Projekte, die schon zurückgespielt wurden, haben kaputte Dateien** - die Originale (Sicherungsdatei, altes Projekt) sind unversehrt |
| 78 | `server/src/routes/foerderantrag.ts:39` | Fehler, Inhalt | "Schlüsselpositionen" im Förderantrag: jede Rolle aus Regie und Produktion und jede mit "Ton" im Namen. In der Großproduktion 16 Einträge, darunter Regiepraktikum, Produktionssekretariat, Tonangel, Schnittassistenz; Szenenbild, Kostüm- und Maskenbild fehlten. | ja: Export von Projekt 1 und 7 | behoben: Leitung der Gewerke nach Rollennamen, Assistenzen/Praktika ausgeschlossen; danach Projekt 1 acht, Projekt 7 vierzehn Gewerkleitungen. Mehrere Personen mit gleicher Rolle ("Maskenbild") bleiben mehrfach - das geben die Daten nicht her |
| 79 | `server/src/routes/guestTokens.ts` (`GET /guest/:token`) | Datenschutz, Hinweis | Der öffentliche Gastlink lieferte ganze Zeilen (`SELECT *`) von Projekt und Dispo-Einträgen, mehr als jede Ansicht braucht. Die Gastlink-Funktion hat keine Oberfläche: Keine Seite legt Gastlinks an oder zeigt sie; die Check-in-Tafel nennt einen Pfad `/guest/checkin/{Drehtag}`, den es nicht gibt (rohe 404-Seite). Ein ungültiges `expires_at` lässt einen Gastlink nie ablaufen. | ja: Felder ausgezählt; Pfad im Browser → "Unexpected Application Error! 404" | Antwort begrenzt (Projekt: id, Titel, Format, Genre; Einträge ohne Kontakt- und Tokenfelder). **Offen für Florian:** Gastlink-Funktion fertigbauen oder entfernen; den Hinweis auf der Check-in-Tafel behebe ich bei `CheckinBoard.tsx` |
| 80 | `server/src/routes/ical.ts` (Call-Zeiten im Kalenderexport) | **Fehler, live** | Die Call-Zeit wurde über `setHours` in der Zeitzone des Servers gerechnet. Beim Hoster (UTC) stand Call 07:00 als 07:00 UTC im Kalender - 08:00 Uhr deutscher Zeit, im Sommer 09:00. | ja: Zweitinstanz mit `TZ=UTC`: `20261102T070000Z`, lokal `060000Z` | behoben: `berlinZeitpunkt` in `lib/datum.ts` (unabhängig von der Serverzeitzone, getestet unter Berlin, UTC, New York); danach beide `060000Z` |
| 81 | `server/src/routes/insurances.ts` | Klein | Laufzeit einer Police in Textspalten ohne jede Prüfung (wie Sperrtage, Fund 48). | nein, vorher gelesen; nach dem Fix gemessen | behoben: leer oder echtes Datum, Ende nicht vor Anfang (auch gegen den gespeicherten Stand); danach `abc` 400, Ende vor Anfang 400, leeres Formular 201 |
| 82 | `server/src/routes/invites.ts` (Einladungsmail, Mitglieder-Routen), `routes/projects.ts:311` | Fehler, Text | Projekttitel und Name der Einladenden gingen unmaskiert in die Einladungsmail (wie Fund 23). Die Mitglieder-Routen in `invites.ts` (Liste, Rolle, Entfernen) erreichte nie eine Anfrage - `projects.ts` ist vorher eingehängt und beantwortet dieselben Pfade. Dort wurde jede Rolle ungeprüft gespeichert: Mit "Produzent" verlor ein Mitglied still jedes Schreibrecht. | ja: Titel `<Messung> &` roh in der Mail; Rolle "Produzent" gespeichert | behoben: `maskiere`; toter Doppelcode entfernt; nur bekannte Rollen (`hasOwnProperty`, auch "constructor" 400); danach gemessen, Mitgliederliste weiter 200 |
| 83 | `server/src/routes/invoices.ts` (alle Routen) | **Fehler, Geld, live** | Angebote liegen in derselben Tabelle (`kind = 'angebot'`), die Rechnungsrouten filterten nicht danach. Ein festgeschriebenes Angebot stand in der Rechnungsliste, zählte als offener Posten und stand im Buchhaltungsexport als Rechnung. Über die Rechnungsroute ließ sich ein Angebots-Entwurf festschreiben - mit einer Nummer aus dem Rechnungskreis, der danach eine Lücke hatte. Dazu "Faellig" im Exportkopf, "liess" in einer Meldung, Standardjahr des Exports aus der Serveruhr. | ja: Angebot 5.950 € in Liste, offenen Posten und Export; Angebots-Entwurf bekam 2026-0001, erste Rechnung 2026-0002 | behoben: alle Routen nur `kind = 'rechnung'`; danach Angebot 404, erste Rechnung 2026-0001, Liste/Export nur Rechnungen. Einzelabfragen in `mahnwesen.ts` folgen dort. **In der Produktion prüfen, ob Rechnungsnummern fehlen** |
| 84 | `server/src/routes/locationRelease.ts` (Speichern, Unterschreiben, PDF) | **Fehler, live** | Die Oberfläche speichert nur den Namen des Eigentümers; die Route setzte alle übrigen Felder auf leer - Adresse, Drehdaten, Vergütung und Bedingungen waren nach jedem Speichern weg. Unterschreiben scheiterte immer: Die Oberfläche schickt keinen Namen, `signed_by` ist NOT NULL. Das PDF brach an Drehdaten im Klartext ab, wie sie der Demo-Datensatz schreibt. Wegen `fee_cents NOT NULL DEFAULT 0` stand in jedem Vertrag "Vergütung 0,00 €", obwohl der Kommentar eine Linie verlangt. Ein unterschriebener Vertrag ließ sich weiter ändern, `status` und Unterschrift waren ungeprüft. | ja: nach Speichern wie die Oberfläche Adresse/Daten/Vergütung leer; Unterschreiben 400 "Ein Pflichtfeld fehlt."; PDF 500 | behoben: nur mitgeschickte Felder ändern; `signed_by` leer erlaubt; Unterschrift nur als PNG/JPEG-Bild; nach der Unterschrift 409; `status` nur Entwurf/Versendet; Vergütung ab 0 Cent; Drehdaten tolerant gelesen, ISO-Daten deutsch; ohne Vergütung eine Linie. Danach gemessen: alle Felder bleiben, Unterschreiben 200, PDF 200 mit "02.11.2026" und Linie |
| 85 | `server/src/routes/locations.ts:41` | Fehler | `PUT` auf ein Motiv, das es nicht gibt, lief in `row.photos` auf `undefined` - 500 statt 404 (Muster aus Fund 51). Dazu legte die Datei beim Start noch `uploads/locations` an, das seit `lib/dateien.ts` niemand mehr benutzt, und meldete "Location" statt "Motiv". Gelöschte Motive gehen über den Papierkorb, ihre Fotos bleiben deshalb zu Recht stehen. | ja: `PUT /locations/999999` 500 | behoben: 404 "Motiv nicht gefunden", toter Ordner-Code entfernt; danach gemessen 404 |
| 86 | `server/src/routes/mahnwesen.ts` (Zahlungen, Mahnlauf, Mahnung) | **Fehler, Geld, live** | Die Einzelabfragen filterten nicht nach `kind = 'rechnung'` (wie Fund 83): Eine Zahlung auf ein versendetes Angebot wurde angenommen, das Angebot stand danach auf "bezahlt". Zwei gleichzeitige Mahnungen auf dieselbe Rechnung legten beide eine Mahnung an - mit Mail zwei Mahnmails an den Kunden. Bei abgeschaltetem Mahnwesen ("Mahnwesen eingeschaltet" in der Buchhaltung) ging die Mahnung samt Mail trotzdem raus. Ein Stichtag wie "abc" ergab still "nichts zu mahnen". Ansprechpartner, Rechnungsnummer und Firmenname gingen unmaskiert in die Mahnmail (wie Fund 23). Das Löschen einer Zahlung stand ohne Projekt im Protokoll. | ja: Angebot nach Zahlung "bezahlt"; zwei Anfragen 200/200, zwei Mahnungen Stufe 1; abgeschaltet 200 "eingereiht"; Anrede `Frau <b>Fett</b>` roh | behoben: alle Einzelabfragen nur Rechnungen; die Rechnung wird in einer Transaktion nur umgestellt, wenn sie noch auf dem gelesenen Stand ist (sonst 409); abgeschaltet 409 und Knopf gesperrt; Stichtag und Zahlungsdatum mit `istIsoDatum`; Mailtext maskiert. Danach gemessen: Angebot 404, dreifach gleichzeitig fünfmal genau eine Mahnung, abgeschaltet 409, Anrede `&lt;b&gt;`. Der Test zur Gleichzeitigkeit hält das Ergebnis fest, löste den alten Fehler im Testserver aber nicht zuverlässig aus |
| 87 | `server/src/routes/moodboard.ts` | Fehler | `PUT` auf einen Eintrag, den es nicht gibt, ergab 200 ohne Daten (Muster aus Fund 51). Jede Route fing Fehler selbst ab und meldete auch eine falsche Eingabe als 500 (Muster aus Fund 34). Position und Breite sind INTEGER: Eine Position mit Bruchteil ergab 500 - das Verschieben schickt die Zeigerkoordinate, und die Oberfläche meldet einen Fehler dabei nicht. Ob echte Browser dort Bruchteile schicken, ist nicht gemessen (im Vorschaufenster bei Pixelfaktor 1 ganze Zahlen). | ja: `PUT /moodboard/999999` 200; Position 120.5 500; Position "abc" 500 | behoben: 404; Position und Breite gerundet; Fehler an den Übersetzer. Danach gemessen: 404, 120.5 gespeichert als 121, "abc" 400 |
| 88 | `server/src/routes/morningBrief.ts` (PDF) | Fehler, live | Die Einträge der Dispo wurden mit `LIMIT 8` geladen und daraus "Crew / Cast" gezählt - bei mehr als acht Personen stimmte die Zahl nie. "Auszug" stand schon bei genau acht Einträgen da. Dazu drei fertig gebaute, nie benutzte HTML-Listen (unmaskiert). Die JSON-Route `GET /shoot-days/:id/morning-brief` ruft die Oberfläche nicht auf (nur in `api.ts` deklariert) - nicht entfernt, nur festgehalten. Sonnenzeiten der JSON-Route stimmen (Bochum, 02.11.2026: 07:27 bis 17:04). | ja: 12 Crew + 3 Cast, im PDF "8/0" | behoben: gezählt über alle Einträge, die Tabelle zeigt weiter acht; "Auszug" erst ab neun; tote Listen entfernt. Danach gemessen "12 / 3" |
| 89 | `server/src/routes/musicCues.ts`, `client/src/pages/Musikliste.tsx` | **Fehler, live** | Die Musikliste fragte "Szene #" ab - die Szenennummer - und schickte die Eingabe als `scene_id`, die Kennung der Szene. Der Server sucht per Kennung: Szene 12 (Kennung 846) gab 404, verknüpfen ging praktisch nie. Verknüpfte Einträge (Demodaten) zeigten die Kennung als Nummer, auch im GEMA-Export ("Szene 136" statt "Szene 104"). Eine Szene ließ sich nicht mehr lösen (`COALESCE`). Jede Route fing Fehler selbst ab: Dauer "abc" ergab 500 (Muster aus Fund 34). | ja: "Szene # 12" 404; nach `scene_id: null` blieb 846; Dauer "abc" 500 | behoben: Auswahl der Szenen des Projekts statt Zahlenfeld; die Liste lädt `scene_number` dazu und zeigt sie in Tabelle und Export; `scene_id: null` löst; Fehler an den Übersetzer. Im Browser gemessen: "Szene 104", Auswahl steht auf "104 Jana jagt Amara", Lösen über die Oberfläche gespeichert |
| 90 | `server/src/routes/optimizationSuggestions.ts` | Fehler, live | Hold-Tage zählten Kalendertage samt Wochenenden, der DOOD zählt Drehtage ohne die Person - für dieselbe Darstellerin 6 gegen 3. Ein undatierter Drehtag (`date` ist Text, `''` statt NULL) ließ den Hold-Vorschlag ganz ausfallen. Die Szenenliste der Hold-Vorschläge war immer leer (`scene_id` nicht abgefragt). Die Wochenformel für Nachtdrehs rechnete in Ortszeit: beim Hoster (UTC) Woche ab Sonntag, Nächte an Samstag und Sonntag in zwei Wochen, ebenso 31.12./01.01.; lokal (Berlin) Woche ab Samstag. Ein verworfener Vorschlag kam beim nächsten Erzeugen wieder. Eigene `try/catch` meldeten jeden Fehler als 500 (Muster aus Fund 34). | ja: 6 Hold-Tage gegen 3 im DOOD, Szenen `[]`; mit undatiertem Tag kein Vorschlag; alle verworfen und neu geladen - wieder da; Wochenformel unter `TZ=UTC`: Sa W45, So W46 | behoben: Hold wie im DOOD; `date <> ''`; Szenen abgefragt; `isoWoche` in `lib/datum.ts` (UTC, ab Montag, mit Test); verworfene Vorschläge mit denselben Szenen werden nicht wieder angelegt; Fehler an den Übersetzer. Danach gemessen: 3 wie im DOOD, Szenen gefüllt, verworfen bleibt weg |
| 91 | `server/src/lib/papierkorb.ts`, `routes/backup.ts`, `client/src/pages/Papierkorb.tsx` | **Fehler, live** | Zurückgeholt wurde nur die Zeile selbst. Was die Datenbank beim Löschen per CASCADE mitnahm oder per SET NULL löste, blieb weg: Eine Szene kam ohne Drehplaneintrag, ohne Rollen und **ohne ihren Drehbuchtext** zurück, ihre Einstellungen hingen an keiner Szene mehr; ein Drehtag ohne Dispo, Stundenzettel, Tages- und Kameraberichte; ein Motiv ohne Vertrag und ohne die Szenen, die dort spielen. Der Kommentar und der Hinweis in der Oberfläche versprachen das Gegenteil. | ja: Szene gelöscht und zurückgeholt - Drehplan 0, Rollen 0, Drehbuch 0, Einstellung 0; Motiv zurückgeholt - Vertrag 0, Szene ohne Motiv | behoben: Vor dem Löschen werden die per CASCADE mitgehenden Zeilen (zwei Ebenen, Dispo → Einträge) und die per SET NULL gelösten Verweise in `deleted_items.dependents` abgelegt, beim Zurückholen in einer Transaktion wieder eingefügt bzw. angeknüpft; eine Zeile, die auf inzwischen Gelöschtes zeigt, bleibt einzeln weg (Savepoint), die Oberfläche sagt dann "Eine Verknüpfung fehlt". Der Papierkorb geht nicht mehr in die Projektsicherung (enthält jetzt Gastlinks gelöschter Drehtage als Text). Danach gemessen: alles wieder da; im Browser Hinweis bei fehlender Rolle. Grenze: Werden zwei verbundene Einträge gelöscht, kommt die Verbindung nur zurück, wenn in umgekehrter Reihenfolge zurückgeholt wird - der zuerst gelöschte zuletzt |
| 92 | `server/src/routes/payroll.ts` (Lohnexport) | Fehler | Als einziger Server-Export mit Komma als Trenner und Dezimalpunkt ("6500.00"), eigener CSV-Code neben `lib/tabelle.ts`, dessen Kommentar festhält, dass deutsches Excel mit Semikolon trennt. Gagen sind Cent (wie Stabliste/Besetzung), die Umrechnung stimmte. Dass jedes Mitglied die Gagenliste laden kann, entspricht der Stabliste (zeigt Gagen allen Mitgliedern) - nicht geändert. | ja: Kopf `Typ,Name,...`, Zeile `...,6500.00,292500.00,0.00` | behoben: `schreibeCsv` und `cents` aus `lib/tabelle.ts`. Danach gemessen: `Typ;Name;...`, `6500,00;292500,00;0,00`, BOM `efbbbf` vorhanden. `timesheets.ts:183` hat dasselbe Muster - dort beim Lesen |
| 93 | `server/src/routes/pdf.ts:729` (Kalkulation), `:906` (Shotlist) | **Fehler, live** | Die Kalkulations-PDF las die Budgetfassung nur über ihre Kennung, ohne Bindung an das Projekt im Pfad - ein Mitglied eines Projekts erhielt so die Kalkulation eines anderen. Die Shotlist suchte Storyboards nur im alten Ordner `uploads/storyboard`; seit `lib/dateien.ts` liegen sie in der Datenbank - jedes neu hochgeladene Storyboard fehlte im PDF. | ja: Fassung aus Projekt B über Projekt A 200 mit Posten aus B; Shotlist mit hochgeladenem Storyboard 0 Bildobjekte | behoben: `AND project_id = ?`; Storyboard aus `project_files` (nur aus dem Projekt, Bildtyp geprüft, weil er in ein Attribut geht), Altbestand weiter von der Platte. Danach gemessen: 404; 2 Bildobjekte (Bild und Alphamaske). Scan aller Routen `/projects/:id/.../:kind` auf Abfragen ohne Projektbindung (`scratchpad/kind_bindung2.py`): sonst keine |
| 94 | `server/src/routes/postplan.ts` | Fehler | Datumsfelder (TEXT) nahmen alles an - "morgen" und ein Ende vor dem Anfang wurden gespeichert, der Zeitplan in der Oberfläche rechnet damit (`new Date(...)`). Jede Route fing Fehler selbst ab: `sort_order` "abc" ergab 500 (Muster aus Fund 34). | ja: "morgen" 201 gespeichert; Ende vor Anfang 201; "abc" 500 | behoben: `laufzeitFehler` aus `insurances.ts` nach `lib/datum.ts` verschoben (mit Test) und hier wie dort benutzt; PUT prüft gegen den Stand nach dem Ändern; Fehler an den Übersetzer. Danach gemessen: 400/400/400; Leeren mit `""` und Teiländerung weiter 200 |
| 95 | `server/src/routes/projects.ts` | **Fehler, Datenschutz, live** | `POST /projects/:id/members` (von der Oberfläche nie benutzt) trug jedes Konto per Kennung ein und gab dessen Namen und Mailadresse zurück - jedes frische Konto konnte so mit einem eigenen Projekt Fremde ungefragt eintragen und Adressen abfragen. Die Kennzahlen der Projektübersicht scheiterten an einem einzigen undatierten Drehtag (`date::date` auf `''`). Das Duplikat eines Creator-Projekts wurde ein Filmprojekt. Teiländerungen über die API: Einstellungen setzten nicht mitgeschickte Felder auf den Standard zurück (Währung auf EUR), das Projekt nullte sie (Oberfläche schickt immer alles - dort ohne Wirkung). | ja: fremde Kennung 201 mit Mailadresse, danach Mitglied; Kennzahlen 400 "Ein Datum ist ungültig."; Duplikat `film`; nur Farbe gespeichert - Währung EUR | behoben: Route entfernt (Einladung ist der Weg hinein); `date <> '' AND date >= heuteISO()`; Duplikat mit `project_kind`; fehlende Felder behalten ihren Wert. Danach gemessen: 404 und kein Mitglied; 200; `creator`; Währung bleibt CHF |
| 96 | `server/src/routes/push.ts:28` | Fehler, Datenschutz | Ein Browser hat eine Push-Adresse. Abonnierte dort ein zweites Konto, wurden nur die Schlüssel ersetzt, das Abo gehörte weiter dem ersten Konto: Dessen Dispo-Benachrichtigungen erschienen im Browser des zweiten, das zweite bekam keine. Fehler gingen mit der rohen Datenbankmeldung zurück. | ja: A, dann B abonniert - Abo gehört A, Schlüssel von B | behoben: das Abo wechselt zum abonnierenden Konto; Fehler an den Übersetzer. Danach gemessen: gehört B. Offen im Client: Abmelden kündigt das Abo nicht (Merkzettel) |
| 97 | `server/src/routes/reise.ts` | **Fehler, Geld, live** | Der Reisekosten-Export war nie erreichbar: `GET /reisen/:id` stand davor und nahm "export.csv" als Kennung - der Knopf in der Oberfläche bekam 400 "Eine Zahl wurde als Text übergeben.". Bei Hotel mit Frühstück trug das Anlegen einer Reise das Frühstück an **jedem** Tag ein, auch am Anreisetag - das Hotelfrühstück gibt es erst am Morgen nach der ersten Nacht. Die steuerfreie Verpflegungspauschale wurde so je Reise um 5,60 € (20 % des 24-Stunden-Satzes) zu stark gekürzt. | ja: Export 400; Reise 02.-05.11. mit Frühstückshotel 61,60 € Verpflegung | behoben: Export vor die Einzelroute; Frühstück nicht am Anreisetag und nicht an Tagen ohne Übernachtung (`einzeln`). Danach gemessen: Export 200 mit denselben Summen wie die Liste; 67,20 €. Bestehende Reisen behalten ihre Einträge - je Tag in der Oberfläche änderbar. Scan aller 487 Routen in Einhängereihenfolge auf Verschattung (`scratchpad/verschattung.py`, am alten Stand gegengeprüft): sonst keine |
| 98 | `server/src/routes/sceneComments.ts` | Fehler | Jede Route fing Fehler selbst ab (Muster aus Fund 34): Szene "abc" ergab 500 statt 400. Rechte und Projektbindung stimmen (`/comments/:id` im Schutzmuster, POST prüft die Szene im Projekt). | ja: 500 | behoben: Fehler an den Übersetzer, mit `scratchpad/ohne_try.py` (entfernt nur den äußeren Block, der "Interner Serverfehler" meldet). Danach 400, gültige Anfrage 200 |

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
- [x] `server/src/routes/angebote.ts` (443) - Funde 15, 27, 28
- [x] `server/src/routes/anliegen.ts` (242) - Funde 15, 29-33
- [x] `server/src/routes/audit.ts` (279) - Funde 34, 35
- [x] `server/src/routes/auswertungen.ts` (361) - Funde 15, 36-38
- [x] `server/src/routes/auth.ts` (493) - Funde 2, 6, 8, 39-43
- [x] `server/src/routes/backup.ts` (230) - Funde 44-47
- [x] `server/src/routes/blackoutDates.ts` (152) - Fund 48
- [x] `server/src/routes/buchhaltung.ts` (318) - Funde 49, 50
- [x] `server/src/routes/budget.ts` (326) - Fund 51
- [x] `server/src/routes/calendar.ts` (48) - Funde 52, 53
- [x] `server/src/routes/callsheets.ts` (370) - Funde 54-56
- [x] `server/src/routes/cameraPresets.ts` (97)
- [x] `server/src/routes/cameraReports.ts` (188) - Fund 57
- [x] `server/src/routes/catering.ts` (141)
- [x] `server/src/routes/characters.ts` (95) - Fund 59
- [x] `server/src/routes/checkin.ts` (65) - Fund 59
- [x] `server/src/routes/companies.ts` (509) - Fund 28
- [x] `server/src/routes/confirmation.ts` (159) - Funde 39, 60
- [x] `server/src/routes/conflicts.ts` (285) - Fund 61
- [x] `server/src/routes/contactsExport.ts` (81) - Fund 35 (CSV)
- [x] `server/src/routes/continuity.ts` (178)
- [x] `server/src/routes/creator.ts` (710) - Fund 57
- [x] `server/src/routes/crew.ts` (46) - Fund 62
- [x] `server/src/routes/dailyreports.ts` (221) - Fund 63
- [ ] `server/src/routes/dateien.ts` (236) - Fund 64; Durchsicht noch nicht abgeschlossen
- [x] `server/src/routes/datenschutz.ts` (202) - Funde 65, 66
- [x] `server/src/routes/dood.ts` (126) - Fund 67
- [x] `server/src/routes/drehplan.ts` (305) - Funde 58, 68
- [x] `server/src/routes/emailRoutes.ts` (646) - Fund 69
- [x] `server/src/routes/emailService.ts` (118) - Kommentar korrigiert
- [x] `server/src/routes/equipment.ts` (68) - Fund 72
- [x] `server/src/routes/equipmentCalendar.ts` (165) - Fund 73
- [x] `server/src/routes/expenses.ts` (122) - Funde 38, 74
- [x] `server/src/routes/extras.ts` (101)
- [x] `server/src/routes/feedback.ts` (41) - Fund 75
- [x] `server/src/routes/floorplans.ts` (287) - Funde 57, 76
- [x] `server/src/routes/foerderantrag.ts` (198) - Fund 78
- [x] `server/src/routes/guestTokens.ts` (96) - Fund 79
- [x] `server/src/routes/ical.ts` (143) - Fund 80
- [x] `server/src/routes/insurances.ts` (138) - Fund 81
- [x] `server/src/routes/invites.ts` (214) - Funde 44, 82
- [x] `server/src/routes/invoices.ts` (675) - Funde 27, 83
- [x] `server/src/routes/locationRelease.ts` (129) - Fund 84
- [x] `server/src/routes/locations.ts` (77) - Fund 85
- [x] `server/src/routes/mahnwesen.ts` (492) - Fund 86
- [x] `server/src/routes/moodboard.ts` (102) - Fund 87
- [x] `server/src/routes/morningBrief.ts` (261) - Fund 88
- [x] `server/src/routes/musicCues.ts` (155) - Fund 89
- [x] `server/src/routes/optimizationSuggestions.ts` (268) - Fund 90
- [x] `server/src/routes/papierkorb.ts` (46) - Fund 91
- [x] `server/src/routes/payroll.ts` (157) - Fund 92
- [x] `server/src/routes/pdf.ts` (1083) - Fund 93
- [x] `server/src/routes/postplan.ts` (126) - Fund 94
- [x] `server/src/routes/projects.ts` (446) - Funde 82, 95
- [x] `server/src/routes/push.ts` (104) - Fund 96
- [x] `server/src/routes/reise.ts` (482) - Fund 97
- [x] `server/src/routes/sceneComments.ts` (90) - Fund 98
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
- [x] `server/src/lib/papierkorb.ts` (140) - Fund 91
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
