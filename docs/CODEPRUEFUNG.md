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

> **Prüfmaßstab von Florian (26.10.2026): Alles ist verknüpft.** Was an einer
> Stelle angelegt oder geändert wird, muss überall gelten - sein Beispiel: Eine
> Figur im Drehbuch ist sofort Rolle, steht in Besetzung, Szenen, Dispo. "Und
> das für ALLE Infos." Bei jeder Datei fragen: Kommt diese Angabe überall an,
> wo sie gebraucht wird? Eine Angabe, die nur an einer Stelle lebt, ist ein
> Fund. Verknüpfungen nur ergänzen, manuelle Zuordnungen nicht ungefragt lösen.
> **Erweitert am selben Tag:** nicht nur beim Drehbuch, sondern bei *jeder*
> Sache prüfen, ob es sich lohnt, sie automatisch in andere Sachen zu
> übernehmen - "Das Ziel der ganzen App ist es nämlich, das zu
> automatisieren." Gefundene Kandidaten stehen unter "Verknüpfungen" am Ende
> des Fundbuchs, gebaute mit Fundnummer.
> Zweite Notiz, **nur Idee, nicht bauen**: Zuhörer einer Vorstellung regten an,
> dass man alles anpassen kann - Florian liefert dazu später mehr.

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
- **PUT auf fehlende Kennung** (Muster aus Fund 51/59): alle gemessenen
  Fälle behoben, zuletzt `/shots/:id` (Fund 103). Messweg
  `scratchpad/fehlende_zeilen.cjs`.
- **Merkzettel für spätere Dateien** (gesehen, noch nicht gemessen):
  Szenenübersicht und Drehplan färben INT/EXT × Tageszeit
  verschieden (INT TAG gelb bzw. orange, EXT TAG blau bzw. grün) - für Florian.
  **Lesezugriff:** Gemessen am 31.10.2026 mit einem Lese-Konto. Equipment ist
  gesperrt (Fund 187). Aufgaben zeigte keinen offenen Knopf, das Testprojekt
  hatte aber keine Aufgaben. `Budget.tsx` fragt keine Rechte ab: Kategorie-Auswahl
  und "Position" stehen auch Lesern offen. Beim Lesen von Budget beheben.
  **Doppelte Protokolleinträge:** Routen mit eigenem `logAudit` (Abschluss,
  Verträge, Rechnungen, Zahlungen, Casting …) landen zusätzlich über die
  automatische Protokollierung (`aenderungenProtokollieren`) im Log - gemessen:
  Wiederöffnen als "projects" und als "zuruecknehmen". Beim Lesen der
  Server-Tests klären, ob die Middleware solche Pfade auslassen soll.
  **`Tagesdispo.tsx:725`** speichert verzögert auf Seitenebene mit wechselndem
  Drehtag - beim Lesen wie Fund 201 messen (tippen, innerhalb der Wartezeit
  blättern).
  **Drei Tageszählungen je Darsteller:** Die Kalkulation (`routes/budget.ts`,
  `tageJePerson`) zählt Dispo-Einträge, DOOD und Besetzung zählen Drehtage mit
  Szenen der Figur. Seit Fund 121 trägt die Dispo die Darsteller selbst ein,
  meist stimmen die Zahlen deshalb überein. Weicht die Dispo von Hand ab, zeigt
  die Kalkulation andere Gagen als DOOD und Besetzung. Florian: welche Zählung
  gilt?
  `Budget.tsx` fragt keine Rechte ab: Eine Abteilungsleitung kann tippen,
  der Server lehnt Budget und Finanzierung erst ab Produktion ab (403) - beim
  Lesen der Seite `canEditBudget` aus `useProjectPerms` nutzen.
  Meldungen, die über eine Konstante
  statt als `error: '...'` im Code stehen, sieht der Meldungstest nicht
  (Fund 41). Das Muster "Fehler selbst abfangen, 500 Interner Serverfehler"
  (Fund 34) ist mit Fund 106 in allen gelesenen Routen entfernt; offen nur noch
  `aiBreakdown.ts` (eigene Form).
  `Kostenstand.tsx:70` liest den Betrag mit `parseFloat(x.replace(',', '.'))`
  - "1.234,56" würde 1,23 € (`parseFloat("1.234.56")` ist 1.234).
  Seiten mit fest deutschen Resten (`scripts/texte-pruefen.py`, 26.10.2026):
  beim Lesen jeder Seite mitübersetzen, die gemischten zuerst - eine halb
  übersetzte Seite sieht nach Fehler aus (Tagesdispo 56, Stammdaten 51,
  Settings 46, Drehbuch 18, Motive 17; Login, ProjectList, Dashboard übersetzt, Funde
  186, 203, 216). Ganz deutsch und als "teilweise" ausgewiesen: Firma, Verträge, Reise,
  Agenturen, Abnahme, CreatorVideo, AdminPanel, AdminStats, Auswertungen,
  OffenePosten, Timesheets, Continuity, SperrtageKalender.
  `Budget.tsx` (Finanzierung): Der Server legt neue Zeilen mit Art
  "Förderung" an, die Auswahl kennt nur "Förderung regional"/"national" -
  prüfen, was die Auswahl dann zeigt.
  **Rechtsfrage für Florian** (`lib/mahnwesen.ts`): Verzugszinsen laufen ab
  dem Fälligkeitsdatum der Rechnung. Ob ein einseitig auf der Rechnung
  gesetztes Zahlungsziel schon Verzug begründet (§ 286 Abs. 2 Nr. 1 BGB)
  oder erst die Mahnung bzw. die 30-Tage-Regel (§ 286 Abs. 3), ist eine
  Rechtsfrage - nach meinem Wissen verlangt die Rechtsprechung für Abs. 2
  Nr. 1 eine vereinbarte Zeit. Nicht geändert, nicht gemessen; vor dem ersten
  echten Mahnlauf klären (Steuerberatung oder Anwalt).
  **Zugriffsscan am 26.10.2026** (`scripts/zugriffsscan.ts`, nach den Funden
  bis 139): 0 Verdachtsfälle bei 299 schreibenden Routen (721 Aufrufe) und
  192 lesenden, Gegenprobe sieht Änderungen. Nebenbefund im Log: `PUT` auf
  `/cast/:id`, `/characters/:id`, `/crew/:id`, Budgetzeilen, Tagesberichte und
  Equipment-Posten setzen alle Spalten aus dem Rumpf - ein unvollständiger
  Rumpf scheitert an NOT NULL (Muster "Teiländerung löscht Felder", hier ohne
  Datenverlust). Die Oberfläche schickt volle Objekte; beim Lesen der
  Client-Seiten prüfen, ob irgendwo nur ein Feld geschickt wird.
  **Für Florian, vor dem Einschalten der Nutzungsanalyse:** PostHog speichert
  eine Kennung im Browser (localStorage). Das braucht nach § 25 TDDDG eine
  Einwilligung, solange es nicht unbedingt nötig ist - also einen
  Einwilligungsdialog, bevor `VITE_POSTHOG_KEY` gesetzt wird. Live ist kein
  Schlüssel gesetzt (Bundle am 26.10.2026 geprüft).
  **Entscheidung für Florian:** Passwörter brauchen mindestens 6 Zeichen
  (Oberfläche und Server einig); ein ungenutztes Schema in
  `server/src/schemas/index.ts` verlangt 8. Üblich sind heute mindestens 8.
  **Zweite Rechtsfrage** (`lib/mailaufbewahrung.ts`): Postausgangszeilen
  werden nach 365 Tagen gelöscht, auch die von Rechnungs- und Mahnmails.
  Abgesandte Handelsbriefe sind nach § 257 HGB sechs Jahre aufzubewahren -
  ob der Postausgang dafür das Archiv ist oder die Rechnung selbst, mit der
  Steuerberatung klären. Nicht geändert.
  `lib/mailvorlagen.ts` `saeubereHtml` entfernt Skripte mit regulären
  Ausdrücken - als Härtung später durch eine erprobte Bibliothek ersetzen
  (Ziel sind Mailprogramme, die selbst filtern; nicht gemessen).
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
| 99 | `server/src/routes/scenes.ts:115` | Fehler | `PUT` auf eine Szene, die es nicht gibt, ergab 200 ohne Daten (Muster aus Fund 51). Geprüft und verworfen: Das Aufräumen der Tagesberichte beim Löschen nimmt nur einen Drehtag - richtig, eine Szene steht per `shoot_day_scenes_scene_eindeutig` auf höchstens einem. | ja: `PUT /scenes/999999` 200 | behoben: 404. Danach gemessen 404 |
| 100 | `server/src/routes/screenplay.ts`, `lib/screenplayFormat.ts:279` | Fehler | Der Drehbuch-Import nummerierte ab der **Anzahl** der Szenen weiter - mit Szenen 1 und 3 bekam die importierte eine zweite 3 (das Muster, das `POST /scenes` am 24.10. verloren hat). Die Anmerkungsfarbe ging ungeprüft in ein style-Attribut des Drehbuch-PDFs - weitere CSS-Eigenschaften samt externer Adresse standen im Satz, der Druck-Browser hätte sie geladen. `POST /blocks` gab die rohe Datenbankmeldung als 500 zurück und schrieb je Block zwei Debug-Zeilen ins Protokoll; beim Laden des Moduls liefen drei `ALTER TABLE` doppelt zu `db/index.ts`. | ja: Nummern `1,3,3`; im HTML `color:red;background-image:url(...)` | behoben: höchste Nummer plus eins; Farbe nur `#rrggbb` (beim Speichern 400, im Satz Rückfall auf Gelb, mit Test); Fehler an den Übersetzer; Debug-Zeilen und doppelte Schemaänderung entfernt. Danach gemessen: `1,3,4`; 400 für CSS, 200 für `#3b82f6` |
| 101 | `server/src/routes/scriptSides.ts`, `docs/designphilosophie.md`, `docs/youtube-einrichten.md`, `docs/testversion.md` | Fehler, Text | Die Sides ergänzten die Szenenüberschrift nur bei Szenen ganz ohne Blöcke - eine Szene mit Aktionsblock, aber ohne Überschriftenblock (Altbestand vor dem 24.10.) stand kopflos da. Kopfzeile und selbst gebaute Überschrift trugen Gedankenstriche. Ein ungültiges Datum warf in `toISOString()` einen 500, Fehler gingen roh zurück; ein eigener Chromium-Sucher war tot. In drei Dokumenten im Repo standen 42 Gedankenstriche (Scan `scratchpad/gedankenstrich.py`; im Code nur Parser, die sie als Eingabe annehmen, und Tests, die ihr Fehlen prüfen). | ja: PDF-Text `Jana steht am Kai.` ohne Überschrift davor; `SIDES – DREHTAG 3` | behoben: `mitUeberschrift` wie Drehbuch-PDF und Fountain; Bindestriche; Datum über `istIsoDatum`; nur der PDF-Teil meldet `PDF-Fehler`; toter Code weg; Dokumente auf Bindestrich. Danach gemessen: `7. EXT. HAFEN - NACHT Jana steht am Kai.`, Kopf `SIDES - DREHTAG 3` |
| 102 | `server/src/routes/search.ts`, `routes/audit.ts:154-170`, `routes/companies.ts:183` | Fehler | Suchtexte gingen unmaskiert in LIKE-/ILIKE-Muster: "_" und "%" fanden in der Projektsuche alles (50 Treffer), ebenso im Änderungsprotokoll und im Adressbuch. Die Projektsuche lud außerdem alle Treffer jeder Tabelle und schnitt erst danach auf 50. | ja: "_" 50, "%" 50 | behoben: `lib/suchmuster.ts` (`enthaeltMuster`, mit Test) in allen drei Routen; je Teilabfrage `LIMIT 50`. Danach gemessen: Projektsuche "_" und "%" 0, "Jana"/"jana" 50; Protokoll "%" 0, "_" findet echte Unterstriche (`fee_per_day`) |
| 103 | `server/src/routes/shots.ts:53` | Fehler | `PUT` auf eine Einstellung, die es nicht gibt, ergab 200 ohne Daten (Muster aus Fund 51). Beim Start legte die Datei noch `uploads/storyboard` an - Storyboards liegen seit `lib/dateien.ts` in der Datenbank (Altbestand liest `pdf.ts` weiter von der Platte, ohne den Ordner anzulegen). | ja: `PUT /shots/999999` 200 | behoben: 404; toter Ordner-Code entfernt. Danach gemessen 404 |
| 104 | `server/src/routes/stickyNotes.ts` | Fehler | Jede Route fing Fehler selbst ab (Muster aus Fund 34): Position "abc" ergab 500. | ja: 500 | behoben: Fehler an den Übersetzer (`ohne_try.py`). Danach 400 |
| 105 | `server/src/routes/sun.ts` | Fehler | Die Morgen-Golden-Hour begann mit der nautischen Dämmerung (Sonne 12 Grad unter dem Horizont) - für Bochum am 02.11. "ab 06:12", Sonnenaufgang 07:27. Die Oberfläche zeigt bisher nur den Beginn der Abend-Golden-Hour, der Fehler war dort unsichtbar. Ohne Datum rechnete die Route mit "jetzt" in Serverzeit (nachts der Vortag). Meldung "Location" statt "Motiv". | ja: Golden Hour Morgen 06:12-08:16 | behoben: Morgen ab Sonnenaufgang, Abend bis Sonnenuntergang (symmetrisch); Standarddatum `heuteISO()`; "Motiv nicht gefunden", unbenutzte Übersetzung entfernt. Danach gemessen: 07:27-08:16, Abend 16:15-17:04 |
| 106 | `server/src/routes/vehicles.ts` und elf bereits gelesene Routen (`activityFeed`, `auth`, `backup`, `blackoutDates`, `cameraPresets`, `confirmation`, `equipmentCalendar`, `extras`, `feedback`, `guestTokens`, `insurances`) | Fehler | Das Muster aus Fund 34 in 42 Handlern: Jeder Fehler, auch eine falsche Eingabe, kam als 500 "Interner Serverfehler" zurück, statt beim Übersetzer als 400 mit Grund. | ja: Fahrzeug mit Kapazität "abc" 500 | behoben mit `scratchpad/ohne_try.py` - entfernt nur den äußeren Block, dessen catch allein protokolliert und 500 meldet; `git diff -w`: genau 42 × try/catch/Protokoll/Antwort/Klammer, sonst nichts. Danach: 400, Anmeldung und Stichproben in fünf Routen weiter 2xx |
| 107 | `server/src/routes/vfx.ts`, `client/src/pages/VFX.tsx` | **Fehler, live** | Derselbe Fehler wie in der Musikliste (Fund 89): "Szene #" fragte die Nummer ab und schickte sie als Kennung - Verknüpfen scheiterte, die Liste zeigte die Kennung ("Szene 26" statt "Szene 1"). Die Szene ließ sich nicht lösen, "morgen" wurde als Deadline gespeichert (Textspalte), Fehler kamen als 500. | ja: "Szene # 12" 404; Lösen ohne Wirkung; Deadline "morgen" 201 | behoben wie Fund 89: Szenenauswahl, `scene_number` per JOIN, `scene_id: null` löst; Deadline leer oder echtes Datum; Fehler an den Übersetzer. Im Browser: "Szene 1"/"Szene 3", Auswahl auf "1 Jana gesteht jemandem". Scan des Clients: keine weiteren Zahlenfelder für Kennungen |
| 108 | `server/src/routes/timesheets.ts`, `db/index.ts` | **Fehler, Geld, live** | Überstunden rechneten `wrap - call` ohne Tageswechsel: 08:00 bis 02:00 (18 Stunden) ergab 0 Überstunden - die Gagenliste summiert diesen Wert. Die Tagesliste lud die Namen über `req.params.pid`, den es auf `/shoot-days/:dayId/timesheets` nicht gibt - jede Zeile ohne Namen. Der CSV-Export trennte mit Komma und Dezimalpunkt (wie Fund 92). | ja: 18 Stunden, Überstunden 0; Name `""`; `...,0.00,""` | behoben: `dauer()` aus `lib/drehzeit.ts`; Projekt über den Drehtag; `schreibeCsv`. Bestehende Zeilen rechnet `initDatabase` einmalig nach (nur `wrap < call` mit falschem Wert, wiederholbar - an Testzeilen geprüft: 18:00-05:00 von 0 auf 1, zweiter Lauf 0 Zeilen, Tagesdreh unberührt). Danach gemessen: 8 Überstunden, Name da, `8,00` |
| 109 | `server/src/lib/jugendschutz.ts` | **Fehler, Recht, live** | Ein Einsatz über Mitternacht fiel durch die Prüfung: 14 Jahre, 17:00 bis 01:00 ergab Dauer 0 und "01:00" lag rechnerisch vor der Zeitgrenze - **kein Verstoß**, während 17:00 bis 23:30 zwei meldete. Für Jugendliche ab 15 galt pauschal 20 Uhr; nach § 14 Abs. 7 JArbSchG dürfen sie bei Film- und Fotoaufnahmen bis 23 Uhr mitwirken (am Gesetzestext auf gesetze-im-internet.de nachgesehen) - eine 16-Jährige bis 22 Uhr wurde fälschlich als Verstoß gemeldet. "6.5 Stunden" mit Dezimalpunkt im deutschen Text; die ungenutzte Theater-Regel war als "Aufführung" beschrieben, gilt nach § 6 Abs. 1 Nr. 1 aber nur für Theatervorstellungen. | ja: 17:00-01:00 ohne Verstoß; 16 Jahre 14:00-22:00 "Ende nach 20 Uhr" (alter Stand ausgeführt); Gesetzestext § 14 Abs. 7 und § 6 Abs. 1 | behoben: Ende vor Beginn zählt in den nächsten Tag (Dauer und Zeitfenster); Jugendliche bis 23 Uhr, Grund nennt die 14 Stunden Freizeit; Dezimalkomma; Wortlaut Theatervorstellung. Tests ergänzt, ein bestehender Test hatte "3.5" festgeschrieben. Danach: 17:00-01:00 meldet 8 Stunden und Ende nach 22 Uhr |
| 110 | `server/src/routes/tabellen.ts` (Import) | Fehler | Die Vorschau eines Listenimports wich vom Ergebnis ab, wenn dieselbe Person (Adresse, sonst Name) zweimal in der Datei stand: Die Übernahme findet die erste Zeile in der Transaktion wieder und ergänzt, die Vorschau schreibt nichts und meldete beide als neu - gegen die erste Regel im Dateikopf ("Nichts geht ungesehen in die Datenbank"). | ja: Vorschau "neu 4", Übernahme "neu 2, ergänzt 2" | behoben: die Vorschau merkt sich die Schlüssel der Datei. Danach gemessen: beide "neu 2, ergänzt 2" |
| 111 | `server/src/routes/vertraege.ts`, `routes/abnahme.ts`, `routes/agenturen.ts` | **Fehler, Recht, live** | Jugendschutzprüfung: Eine Bewilligung galt unbegrenzt - `permit_valid_until` wurde nicht beachtet; Bewilligung bis 31.10., Drehtag 02.11.: kein Verstoß. Undatierte Drehtage gingen in die Prüfung und meldeten "Ohne Geburtsdatum lässt sich nichts entscheiden", obwohl es hinterlegt war. Versand von Vertrag, Abnahmerunde und Besetzungsanfrage (auch Nachfassen): Verwarf der Postausgang die Adresse als ungültig, stand die Sache trotzdem auf "versendet". Vertragstage zählten undatierte Drehtage mit; eine Vorlage ließ sich auf eine unbekannte Vertragsart ändern. | ja: 02.11. "nichts"; undatiert "Ohne Geburtsdatum"; Vertrag an "kaputt" 200 "versendet", 0 Mails; Abnahme an "kaputt" am alten Stand 200 "versendet" | behoben: abgelaufene Bewilligung zählt nicht und meldet "gilt nur bis ..."; `sd.date <> ''`; Status nur mit eingereihter Mail (sonst 400 "Die E-Mail-Adresse ist nicht gültig"); Artprüfung beim Ändern. Danach gemessen: Verstoß am 02.11.; Vertrag und Abnahme an "kaputt" 400, Status Entwurf; gültige Adresse 200 mit Mail |
| 112 | `server/src/routes/youtube.ts:60` | Fehler, Rechte | `GET /creator/youtube/connect` gab die Google-Anmeldeadresse samt signiertem State für das Projekt heraus. Als GET lief die Route am Schreibschutz vorbei, der Rücklauf vertraut allein dem State - ein Mitglied mit Lesezugriff konnte so einen eigenen Kanal an das Projekt hängen, während Trennen für es 403 ergab. Das Analytics-Enddatum kam aus der UTC-Uhr. | ja (zweite Instanz mit Platzhalter-Zugangsdaten): Leser 200 mit Adresse, Trennen 403 | behoben: Verbinden verlangt denselben Rang wie Trennen (Abteilung); `heuteISO()`. Danach gemessen: Leser 403, Inhaber 200. Scan aller schreibenden GET-Handler (`scratchpad/get_schreibt.py`): sonst nur Absicht (Dispo-Quittung per Token, Standardvorlagen beim ersten Aufruf, abgeleitete Vorschläge) |
| 113 | `server/src/routes/dateien.ts:179`, `client/src/lib/useDownload.ts`, `client/src/pages/Setplan.tsx`, `client/src/pages/Dateien.tsx` | **Fehler, live** | Seit Bilder und Dokumente in der Datenbank liegen, prüft die Auslieferung die Anmeldung - per Header. `<img src>` und `window.open` schicken keinen: Der Grundriss im Setplan kam mit 401 und blieb leer, "Ansehen" in der Dateiablage öffnete einen Tab mit "Nicht authentifiziert". Dazu die Härtung: Der Upload nimmt jedes `image/*` an, auch SVG; die Auslieferung zeigte es mit dem gemeldeten Typ inline an. | ja: Setplan-Bild 401, `naturalWidth 0`; SVG `image/svg+xml` inline | behoben: `useGeschuetztesBild` lädt mit Token als Blob (Setplan); `useAnsehen` öffnet das Fenster im Klick und füllt es nach dem Laden; inline nur noch PNG/JPEG/GIF/WebP/PDF, alles andere `application/octet-stream` als Download. Danach gemessen: Setplan-Bild geladen (Blob, 2×2 - die Testdatei ist so groß), Ansehen setzt eine Blob-Adresse (mit Attrappe für `window.open`, das Vorschaufenster öffnet keine Tabs), SVG als Download |
| 114 | `server/src/lib/buchhaltung.ts:112`, `routes/buchhaltung.ts` (DATEV) | Fehler, Geld | Ein DATEV-Stapel über den Jahreswechsel ließ sich erzeugen: 01.11.2026 bis 31.01.2027 ergab Wirtschaftsjahr 2026, das Belegdatum steht nur als TTMM - eine Rechnung vom 15.01.2027 als "1501", in DATEV also der 15.01.2026. Ungültige oder vertauschte Daten gingen durch. "Erzeugt am" kam aus der Serveruhr (beim Hoster UTC, eine bis zwei Stunden zu früh). | ja: Kopf `20260101`, Bereich `20261101`-`20270131`, Belegdatum `1501`; unter `TZ=UTC` Zeitstempel 02:15 bei 03:15 deutscher Zeit | behoben: DATEV-Export nur innerhalb eines Kalenderjahres, Daten geprüft (400 mit Grund); Zeitstempel in deutscher Zeit. Danach gemessen: Jahreswechsel 400, 30.02. 400, Jahreszeitraum 200 mit Datei; `TZ=UTC` 03:15 |
| 115 | `server/src/routes/screenplay.ts`, neu `lib/figuren.ts`, `client/src/pages/ScreenplayEditor.tsx` | **Fehler (Verknüpfung), live** | Eine im Drehbuch geschriebene Figur wurde weder Rolle des Projekts noch mit ihrer Szene verknüpft - sie fehlte in Rollen, Besetzung, Szenenliste, Dispo und Drehplan-Übersicht. Gilt für den Editor und für den Drehbuch-Import. | ja: "JANA (O.S.)" geschrieben - Rollen `[]`, verknüpft 0 | behoben: `figurVerknuepfen` findet die Rolle ohne Groß-/Kleinschreibung oder legt sie an ("JANA" wird "Jana", Zusätze wie (O.S.) fallen weg) und verknüpft die Szene; der Editor löst das beim Verlassen der Figurenzeile aus (`figur_fertig`), nicht beim Tippen - er speichert alle 500 ms, sonst entstünden Rollen aus "JA"; der Import für jede Figur. Danach gemessen: Zwischenstände ohne Rolle, "Jana" einmal, zweite Szene greift auf sie zurück, Import legt "Dr. Müller" an; im Browser "MARA" + Enter - Rolle "Mara", Szene verknüpft. Florians Antwort am 26.10.2026: ja, auch ein Motiv - gebaut in Fund 120 |
| 116 | `server/src/lib/callSheetLayout.ts`, `routes/pdf.ts` (`buildTagesdispoHtml`) | **Fehler (Verknüpfung, Pflichtangaben), live** | Maßstab: die Pflichtangaben einer Tagesdisposition (von Florian eingefügter Wikipedia-Artikel "Tagesdisposition") und der Grundsatz "alles verknüpft". Die Spalte "Cast" der Szenen blieb immer leer (`cast_ids` gibt es in keiner Tabelle); jede Dispo zählte die Cast-Nummern neu ab 1. T/N zählte die Szenen hoch (D1-D4 für vier Tagesszenen - im Standard der Erzähltag, den CutSheet nicht kennt). Uhrzeiten als "7:00 AM". Es fehlten Pflichtangaben, deren Daten vorlagen: Adresse von Drehort und Motiven, geplanter Drehschluss, Anschrift und Kontakt der Produktionsfirma, Produktionsvertretung am Set; der Drehort des Tages (`call_sheets.location_id`) wurde geladen, aber nie gezeigt. | ja: Drehtag 1 des Demo-Projekts - Cast-Spalte `""` bei allen vier Szenen, T/N `D1`-`D4` | behoben: Rollennummern projektweit nach der Rollenliste, Szenen-Cast aus `scene_characters`, Cast-Tabelle danach sortiert; T/N als T/N/D/M ohne Zahl; 24-Stunden-Zeit (DIN 5008, wie im Rest von CutSheet); Drehort und Motive mit Adresse, Drehschluss (geplant) aus den Projekteinstellungen, Firma mit Anschrift/Telefon/Mail, Aufnahmeleitung mit Telefon aus dem Stab. Danach gemessen: Cast `1`/`1`/`2`/`1, 2` passend zu `scene_characters`; Seite 1 im Druckmodus gerendert und angesehen. Florians Antwort am 26.10.2026: Komparsen den Drehtagen zuordnen - gebaut in Fund 119 |
| 117 | `server/src/lib/creatorInsights.ts`, `db/index.ts` | Fehler (Text) | Hinweise der Creator-Bereiche mit Dezimalpunkt und Umschrift: "Klickrate 4.5 %", "längste" als "laengste", "trägt" als "traegt"; jede neue Upload-Checkliste bekam den Punkt "Untertitel geprueft" in die Datenbank. | ja: Ausgabe der Funktionen mit 4,5 % Klickrate, 25/47 Tagen Rhythmus, 2-Sekunden-Clip | behoben: Dezimalkomma (`komma`), Umlaute in Texten und Kommentaren; beim Start werden bestehende Checklistenpunkte nachgezogen (lokal 0 Zeilen betroffen). Danach gemessen: "Klickrate 4,5 %", "längste Pause 47 Tage"; 65 Tests der beiden Dateien grün |
| 118 | `client/src/pages/Komparsen.tsx` | **Fehler, live** | Die Komparsen-Seite schickte und las deutsche Feldnamen (`telefon`, `tarifgruppe`, `notizen`), der Server kennt `phone`, `tariff_group`, `notes`: Telefon, Tarifgruppe und Notiz gingen beim Anlegen und Ändern verloren, die Tabelle zeigte bei jedem Komparsen "-", der Tariffilter fand nie etwas. Die Auswahl bot T1-T4 an, in den Daten stehen "Standard", "Kleindarsteller", "Spezial (Uniform)". | ja: POST wie die Seite - gespeichert `phone ''`, `tariff_group 'Standard'`, `notes ''` | behoben: Feldnamen wie auf dem Server; Tarifgruppe als Freitext mit Vorschlägen aus den vorhandenen Werten. Danach im Browser: Telefon und Notizen sichtbar, Tarifgruppe "Kleindarsteller" gespeichert |
| 119 | `routes/callsheets.ts`, `routes/extras.ts`, neu in `lib/person.ts`: `personAngaben`, `PERSONEN_TABELLE`; `routes/pdf.ts`, `catering.ts`, `checkin.ts`, `confirmation.ts`, `morningBrief.ts`, `timesheets.ts`, `conflicts.ts`, `emailRoutes.ts`, `lib/datenschutz.ts`, Demo-Seed; Client `Komparsen.tsx`, `Tagesdispo.tsx`, `CateringListe.tsx`, `CheckinBoard.tsx` | **Fehler (Verknüpfung), Recht, live** | Komparsen ließen sich keinem Drehtag zuordnen. Vertrag (Drehtage, Gesamtgage) und Jugendschutzprüfung lesen Komparsen aus den Dispo-Einträgen - die Dispo nahm aber nur Stab und Besetzung an, alles andere galt als Stab. Ein minderjähriger Komparse kam so nie in die Prüfung, sein Vertrag nannte keine Drehtage. Das Dispo-PDF listete auf jeder Dispo die ersten 30 Komparsen des Projekts ohne Call-Zeit. Komparsen fehlten in Verpflegung, Check-in, Bestätigung, Verteiler und Morning Brief; beim Löschen blieben Spuren liegen (anders als bei Stab und Besetzung). | ja: PDF Drehtag 2 mit der alten Datei - alle vier Komparsen des Projekts ohne Call-Zeit, obwohl keiner dort dreht. Die Dispo-Route aus dem Code (alter Stand nicht gemessen): jede Art außer `cast` wurde gegen den Stab geprüft und so gespeichert | gebaut: Zuordnung über die Dispo des Tages (`PUT /projects/:id/extras/:id/drehtage`, legt eine fehlende Dispo an wie von Hand); Komparsen in der Dispo (eigene Abteilung, Hinzufügen-Feld), auf der Komparsen-Seite als Drehtage; eine Stelle für Name/Funktion/Kontakt je Personenart (`personAngaben`) statt "Besetzung, sonst Stab" an acht Stellen; unbekannte Personenart 400; Löschen räumt Dispo, Zeiten, Verpflegung. Danach gemessen: Dispo Tag 1 mit Komparse und Call 07:00, PDF nur die disponierten mit Call, Verpflegung Tag 1 mit Komparse, fremder Drehtag 404, Löschen 1 → 0 Einträge; im Browser zugeordnet und in der Tagesdispo unter "Komparserie". Tests: Jugendschutzprüfung sieht den Tag des minderjährigen Komparsen. Demo-Projekt: Café-Gäste an Tag 3, Parkbesucher an Tag 2 |
| 120 | neu `lib/motive.ts`, `routes/screenplay.ts`, `routes/scenes.ts` (Textimport), `client/src/pages/ScreenplayEditor.tsx` | **Fehler (Verknüpfung), Fehler** | Die Szenenüberschrift legte kein Motiv an (Florians Antwort zu Fund 115: ja). Der Szenen-Textimport übernahm den Trenner in den Titel: "41 INT. HAFEN - NACHT" ergab den Titel "HAFEN -". | ja: Import - Titel `HAFEN -` | gebaut: Spielort vor dem ersten Bindestrich wird Motiv ("WOHNUNG ANDI - KÜCHE" → "Wohnung Andi"), gefunden ohne Groß-/Kleinschreibung, sonst angelegt ("BÜRO VON DR. MÜLLER" → "Büro von Dr. Müller"); im Editor beim Verlassen der Zeile (`motiv_fertig`), im Drehbuch- und im Textimport je Szene. Ein ausgefülltes Motiv der Szene bleibt (realer Drehort); eine leere Hülle, an der sonst nichts hängt, folgt der Überschrift - Tippfehler heilt (umbenannt, oder die Szene wechselt zum vorhandenen Motiv und die Hülle geht; vorher blieb sie verwaist stehen, gemessen). Platzhalter "SZENE 7" und "NEUE SZENE" erzeugen nichts. Trenner aus dem Titel entfernt. Danach gemessen: Import Hafen/Büro von Dr. Müller neu, "wohnküche andi" → vorhandenes Motiv, "SZENE 9" nichts; Editor-Ablauf "INT. HA" … "HAFFEN" → "HAFEN"; im Browser "INT. LEUCHTTURM - NACHT" + Enter → Motiv "Leuchtturm" |
| 121 | neu `lib/dispo.ts`; `routes/callsheets.ts`, `pdf.ts`, `confirmation.ts`, `drehplan.ts`, `aiScheduling.ts`, `scenes.ts`, `characters.ts`, `agenturen.ts`, `lib/figuren.ts` | **Fehler (Verknüpfung), live** | Eine neue Dispo rief alle Darsteller des Projekts - jeder bekam die Dispo-Mail auch für Tage, an denen er nicht dreht. Kam später eine Szene in den Drehtag, eine Rolle an eine Szene oder ein Darsteller an eine Rolle, blieb die Dispo, wie sie war. Der Drehort der Dispo (`call_sheets.location_id`) blieb bei jeder neuen Dispo leer - die Tagesdispo-Seite bietet keine Auswahl -, obwohl die Szenen ihr Motiv kannten: leeres "Drehort" im PDF, kein Motiv in Dispo-Mail und Empfängeransicht. | ja: neue Dispo Demo-Tag 2 - Darsteller Mira Hollstein (ohne Rolle in den Szenen des Tages), Anna Schmidt, Felix Wagner; Ort `null`; PDF Tag 3 "Drehort" leer bei erster Szene im Café Morgenrot | gebaut: neue Dispo = ganzer Stab + Besetzung der Szenen des Tages über `scene_characters`; `besetzungNachziehen` ergänzt bestehende Dispos, wenn eine Szene in den Tag kommt (Drehplan, Verschieben, Wiederherstellen, KI-Plan), eine Rolle an eine Szene (Szenen-Seite, Drehbuch) oder ein Darsteller an eine Rolle (Besetzung, Agenturvorschlag) - nur ergänzend, niemand wird gestrichen; Drehort = gewähltes Motiv, sonst das der ersten Szene (PDF, Mail, Empfängeransicht). Danach gemessen: Tag 2 ruft Felix Wagner und Anna Schmidt; PDF Tag 2 "Stadtpark Englischer Garten, Englischer Garten 1, 80538 München", Tag 3 "Café Morgenrot", Tag 1 behält sein gewähltes Motiv. Test: Nachziehen genau einmal |
| 122 | `routes/vertraege.ts` (`werteFuer`) | Fehler (Verknüpfung) | Die Drehorte im Vertrag waren die ersten acht Motive des Projekts - auch die, an denen die Person nie dreht. Die Drehtage im selben Vertrag kamen schon aus ihren Dispositionen. | aus dem Code (alter Stand nicht getrennt gemessen); ein nicht disponierter Komparse bekommt auch jetzt noch alle drei Demo-Motive - so sah es vorher für jeden aus | behoben: Motive der Szenen und Drehort ihrer Tage aus den Dispositionen; ohne Dispo weiter das Projekt (ein Vertrag entsteht oft vor dem Drehplan). Danach gemessen: Komparse an Tag 2 - "Stadtpark Englischer Garten", 1 Drehtag, 14.10.2026 |
| 123 | `server/src/lib/datenschutz.ts` (`anonymisiere`) | **Fehler, Datenschutz (Art. 17 DSGVO), live** | Die Löschung nach DSGVO leerte nur Name, Mail, Telefon, Notiz (Besetzung: Agentur). Geburtsdatum, Erziehungsberechtigte (Name, Mail, Telefon), Agent mit Mail, Verfügbarkeitsnotiz, Foto und die Verknüpfung zum Adressbuch blieben - bei Minderjährigen genug, um das Kind wiederzuerkennen. Notizen der Arbeitszeiten blieben stehen. Der Ersatzname war bei Besetzung und Komparserie "Person (entfernt)", obwohl der Kommentar die Funktion verspricht. | ja: minderjähriger Komparse anonymisiert - `guardian_name 'Petra Probe'`, `guardian_email`, Geburtsdatum noch da | behoben: alle wiedererkennbaren Felder je Personenart geleert bzw. auf NULL (Gage, Vertragsart, Bewilligungsaktenzeichen bleiben als Buchhaltung und Nachweis), Zeitnotizen geleert; Ersatzname = Funktion im Stab, gespielte Figur, "Komparse". Test mit Komparse und Darstellerin |
| 124 | `server/src/lib/dateiname.ts` | Klein | Lag die 80-Zeichen-Grenze auf einem Trenner, endete der Dateiname auf "-" - die Randstriche wurden vor dem Kürzen entfernt. | ja: "drehplan-xxx…x-" | behoben: erst kürzen, dann Randstriche weg; Test |
| 125 | `server/src/lib/fountainExport.ts` | Fehler | Der Fountain-Export galt deutsche Überschriften ("INNEN.", "AUSSEN.") als von Fountain erkannt und erzwang sie nicht mit Punkt. Fountain kennt nur INT, EXT, EST, INT./EXT, INT/EXT und I/E (fountain.io/syntax, im Browser nachgelesen) - in jeder Fountain-App wurde "INNEN. KÜCHE - TAG" damit zu Aktionstext, die Szene verschwand aus der Gliederung. EST wurde unnötig erzwungen. | ja: Ausgabe `INNEN. KÜCHE - TAG` ohne Punkt | behoben: Liste wie in der Spezifikation. Danach gemessen: `.INNEN. KÜCHE - TAG`, `.AUSSEN. HAFEN - NACHT`, `EST. STADT - TAG`, `INT./EXT. AUTO - TAG`; Test |
| 126 | `server/src/lib/ksk.ts` (`gewerkVorschlag`) | Fehler (Recht, Geld) | Der Vorschlag für die Künstlersozialabgabe sprang auf Wortstämme an, die in kaufmännischen Funktionen zufällig stecken: "buch" in "Buchhaltung", "edit" in "Kreditoren". Produktions- und Kreditorenbuchhaltung wurden als künstlerisch vorgeschlagen - wer den Vorschlag übernimmt, meldet zu viel. | ja: `Buchhaltung`, `Produktionsbuchhaltung`, `Kreditorenbuchhaltung` → `true` | behoben: Ausschlussliste (Buchhaltung, Buchung, Kreditor, Debitor) vor den Stämmen. Danach gemessen: alle drei `false`, "Drehbuch" und "Buch" weiter `true`; Test |
| 127 | `server/src/lib/mahnungLayout.ts` | Fehler (Druck) | Das Adressfeld der Mahnung hing an der Höhe des Kopfs: Mit Telefon, Mail und Website begann es bei 45 mm, ohne sie bei 39,9 mm - die Absenderzeile lag dann über dem Fenster des Umschlags. Der Kommentar versprach "45 mm von oben". | ja: im Druckmodus gerendert - mit Kontakt 45,0 mm, ohne 39,9 mm | behoben: Kopf mit fester Höhe, Anschriftfeld nach DIN 5008 Form B wie auf der Rechnung (Absender bei 55 mm, Anschrift ab 61,9 mm); Abstände darunter ausgeglichen. Danach gemessen: in allen Fällen 45 mm; mit allen Angaben endet der Inhalt bei 276,4 mm wie vorher, einseitig, vor der Fußzeile. Die Rechnung stand schon stabil bei 55 mm (gemessen) |
| 128 | `server/src/lib/mailversand.ts` (`sendeFaellige`) | **Fehler, live** | Der Postausgang wird aus der Schleife (alle 30 s) und direkt nach dem Einreihen abgearbeitet (Dispo-Versand, Serienmail, Einladung). Beide Läufe lasen die wartenden Zeilen, ohne sie zu beanspruchen: Überlappten sie, ging dieselbe Mail zweimal raus - bei einer Dispo an 40 Leute genau dann, wenn der Versand länger als bis zum nächsten Schleifentakt dauert. | ja: Fang-SMTP mit 150 ms Antwortzeit, zwei gleichzeitige Läufe - 2× RCPT für dieselbe Mail | behoben: Jeder Lauf beansprucht seine Zeilen in einem Zug (`FOR UPDATE SKIP LOCKED`, zehn Minuten nach hinten); bricht ein Lauf ab, kommt die Mail danach wieder dran. Danach gemessen: 1× RCPT. Test mit eigenem Fang-SMTP: alter Stand 2, neuer 1. Ein Absendername mit Komma war kein Fehler - nodemailer setzt ihn in Anführungszeichen (gemessen) |
| 129 | `server/src/lib/mailvorlagen.ts` (Standardvorlagen) | Klein (Text) | "Motivbesichtigung": "Treffpunkt: {{call}}" setzte eine Uhrzeit als Ort ein. "Danke nach Drehschluss": "Sobald es einen Schnitt zu sehen gibt, meldest du dich als Erstes" sagte das Gegenteil des Gemeinten. | aus dem Text | behoben: "Uhrzeit: {{call}} Uhr", "erfährst du es als Erstes". Gilt für neue Projekte; schon angelegte Vorlagen eines Projekts bleiben, wie sie sind |
| 130 | `routes/drehplan.ts:123`, `routes/tabellen.ts:183`, `lib/meldungenText.ts` | Klein (Text) | "dates array required" kam als englische Meldung bei deutschen Nutzern an; "Die Datei ist zu gross"; eine französische Meldung siezte ("Ajoutez"), alle anderen duzen. | aus dem Text | behoben: "dates ist eine Liste von Daten (JJJJ-MM-TT)", "zu groß", "Ajoute"; Übersetzungen nachgezogen, Meldungstest grün |
| 131 | `server/src/lib/pdfFonts.ts` (`resolveAccent`) | Härtung | Die Kopffarbe eines Projekts wird beim Speichern nicht geprüft und stand ungefiltert im Stylesheet jedes PDFs, das der Server selbst rendert (Dispo, Listen, Morning Brief). | aus dem Code; `resolveAccent('red; } body { display: none')` gab den Text zurück | behoben: nur `#rgb`/`#rrggbb`, sonst der Standard - an der einen Stelle, durch die alle Dokumente laufen. Die Oberfläche bietet ohnehin nur Hex an; lokal alle 72 Projekte mit Hex. Test |
| 132 | `server/src/lib/rechnungLayout.ts:82`, `client/src/pages/Rechnungen.tsx` | **Fehler, Geld** | Die Zeilenbeträge auf dem Rechnungsblatt und die Summe im Rechnungseditor rundeten mit `Math.round`, die Nettosumme kaufmännisch (`positionsNetto`). Bei einer negativen Position mit halbem Cent (Rabatt auf einen halben Tag) ging die Rechnung nicht auf - genau das, wovor der Kopfkommentar von `lib/rechnung.ts` warnt. | ja: Drehtag 10,00 € und Rabatt 0,5 × -1,01 € - Zeilen 10,00 € und -0,50 €, Nettobetrag 9,49 € | behoben: Blatt rechnet die Zeile mit `positionsNetto`, Editor rundet gleich. Danach gemessen: -0,51 €, Summe 9,49 € geht auf; Test |
| 133 | `server/src/lib/screenplayFormat.ts` (`layoutScreenplay`) | **Fehler, live** | Ein Aktions- oder Dialogblock, der länger ist als eine Seite, wurde nur einmal getrennt: Der ganze Rest stand auf der Folgeseite, die Seite hat `overflow: hidden`, alles über 55 Zeilen fehlte im PDF. Das Drehbuch war dadurch auch zu kurz - und die Seitenzahl ist dort die Laufzeit (1 Seite ≈ 1 Minute). | ja: 150 Zeilen Aktion - 2 Seiten, die zweite mit 97 Zeilen, 42 Zeilen nicht sichtbar | behoben: so oft trennen wie nötig, jeder Rest behält mindestens zwei Zeilen, Dialog bekommt auf jeder Seite (MORE) und CONT'D. Danach gemessen: 3 Seiten (55/55/42), alle 150 Zeilen; Monolog mit 130 Zeilen auf 3 Seiten mit 2× (MORE). Zwei Tests |
| 134 | `server/src/lib/tabelle.ts` (`leseBetragCents`) | **Fehler, Geld** | Der Listenimport las deutsche Tausenderpunkte als Dezimalpunkt: Eine Gage "12.000" wurde 12,00 €, "1.234" wurde 1,23 €, "1.234.567" gar nicht gelesen. | ja: `12.000` → 1200, `1.234` → 123, `1.234.567` → null | behoben: nur Punkte in Dreiergruppen sind Tausenderpunkte (drei Nachkommastellen gibt es bei Geld nicht); "12.50" und "1.5" bleiben Dezimalbeträge. Danach gemessen und als Test: 12.000 €, 1.234 €, 1.234.567 € |
| 135 | `server/src/lib/tabelle.ts` (`schreibeCsv`) | Härtung (Merkzettel) | Felder, die mit `=`, `+`, `@` beginnen, gingen unverändert in die CSV-Exporte; Excel nimmt sie als Formel. Namen kommen auch von außen (Casting-Vorschläge). | ja: `=HYPERLINK("x")` und `@SUM(A1)` unverändert im Export | behoben: Hochkomma davor; ein Minus nur, wenn keine Zahl folgt - Beträge wie "-12,50" bleiben Zahlen. Der DATEV-Stapel hat einen eigenen Schreiber und ist nicht betroffen. Test |
| 136 | `server/src/lib/wiederherstellung.ts` (`PERSONEN`) | **Fehler (Folge von Fund 119), Datenschutz** | Die Wiederherstellung einer Sicherung bildet `person_id` über `person_type` auf die Kopie ab und kannte nur Besetzung und Stab. Seit Komparsen in Dispo, Zeiten und Verpflegung stehen, kam ihr `person_id` unverändert in die Kopie und zeigte auf die Kennung im alten Projekt - in einer fremden Datenbank auf einen fremden Komparsen. | ja: Test - Dispo-Eintrag der Kopie mit `person_id` 902 statt 5 | behoben: `extra` → `extras`. Danach gemessen: Dispo und Zeiten zeigen auf den kopierten Komparsen. Übrige Stellen mit nur zwei Personenarten betreffen Gagen und den persönlichen Kalender - Komparsen haben dort nichts |
| 137 | `server/src/lib/vertraege.ts` (Vorlage Komparsenvertrag) | Klein (Text) | "Ich wirke am {{drehzeitraum}} als Komparse mit" - bei mehreren Tagen "am 12.11.2026 bis 20.11.2026", und nur männlich. Die Beschreibung des Platzhalters "drehorte" stimmte seit Fund 122 nicht mehr. | aus dem Text | behoben: "Ich wirke in der Komparserie … mit. Drehzeit: …, Drehorte: …"; Beschreibung "Die Motive der eigenen Drehtage". Gilt für neu angelegte Verträge |
| 138 | `server/src/lib/youtubeInsights.ts` (Merkzettel :224) | Fehler | Der beste Wochentag eines Kanals kam aus `getDay()` in der Zeitzone des Servers (beim Hoster UTC): Ein Video vom Dienstag 00:30 Uhr deutscher Zeit zählte als Montag. Die Hinweise schrieben Zahlen mit Dezimalpunkt ("Klickrate im Schnitt 3.9 %", "86.3 %"), wie in Fund 117. | ja: unter `TZ=UTC` "Montag"; Hinweise mit Punkt | behoben: Wochentag über `Intl` in Europe/Berlin, Dezimalkomma in allen Hinweisen. Danach gemessen: "Dienstag", "3,9 %". Tests: Dezimalkomma; Wochentag fängt den alten Stand, wenn die Tests mit `TZ=UTC` starten (gemessen) |
| 139 | `server/src/lib/zweiterFaktor.ts`, `routes/auth.ts`, `db/index.ts` | **Sicherheit** | Ein Code des zweiten Faktors wurde innerhalb seiner Gültigkeit (rund 90 Sekunden mit Toleranz) beliebig oft angenommen. RFC 6238 (Abschnitt 5.2) verlangt, dass ein verwendeter Code kein zweites Mal gilt - sonst reicht ein abgefangener Code samt Passwort. | ja: Test - Anmeldung zweimal mit demselben Code, alter Stand 200 | behoben: Das zuletzt angenommene Zeitfenster wird je Konto abgelegt (`last_step`, bedingt geschrieben gegen gleichzeitige Anmeldungen); angenommen wird nur ein späteres. Auch der Bestätigungscode beim Einrichten ist damit verbraucht. Danach gemessen: zweiter Versuch 401. Die bestehenden Tests simulieren ein neues Zeitfenster, statt 30 Sekunden zu warten |
| 140 | `server/src/index.ts` | Fehler (Aufbewahrung) | Die Fristen für Mailanhänge (60 Tage), Postausgang (365 Tage) und Papierkorb wurden nur beim Start durchgesetzt. Ein Server, der wochenlang ohne Deploy läuft, hielt alles über die Frist hinaus - auch gelöschte Personendaten im Papierkorb. | aus dem Code: einziger Aufruf in `main()` | behoben: beim Start und danach täglich (Zeitgeber hält den Prozess nicht am Leben). Kommentare mit echten Umlauten |
| 141 | `client/src/lib/texte/Impressum.ts`, `Datenschutz.ts`, `pages/Impressum.tsx` | **Recht, live - offen für Florian** | Das öffentliche Impressum zeigt Platzhalter statt Angaben: "[VOR- UND NACHNAME DES BETREIBERS]", "[STRASSE UND HAUSNUMMER]", "[PLZ UND ORT]", "[KONTAKT-E-MAIL]"; die Datenschutzerklärung ebenso (Verantwortlicher, Hosting-Anbieter, Serverstandort). Beide verwiesen auf das TMG, das seit dem 14.05.2024 durch das Digitale-Dienste-Gesetz ersetzt ist. | ja: https://cutsheet.onrender.com/impressum ohne Anmeldung gelesen - Platzhalter und "§ 5 TMG" | teilweise: Verweise auf § 5, § 7, §§ 8-10 DDG umgestellt (lokal angesehen). **Die Angaben selbst kann nur Florian eintragen** (Name, Anschrift, Kontakt, Hosting); ein Impressum mit Platzhaltern erfüllt die Anbieterkennzeichnung nicht |
| 142 | `client/src/lib/analytics.ts`, `lib/texte/Datenschutz.ts`, `DatenschutzWerkzeuge.ts` | **Datenschutz** | Die Datenschutzerklärung beschrieb nicht, was die Software tut: Sie versprach eine "anonymisierte" Analyse mit PostHog - eingeschaltet hätte `identifyUser` Name und E-Mail übermittelt. Sie nannte ein Zählpixel in Dispo-Mails, das es nicht mehr gibt (persönlicher Link, siehe `routes/confirmation.ts`). Der Löschdialog nannte nicht die seit Fund 123 geleerten Felder. | ja: Code gelesen; live nachgesehen - kein PostHog-Schlüssel im Bundle, die Übermittlung wäre erst beim Einschalten wirksam geworden | behoben: an PostHog geht nur noch die Kontonummer, Text "pseudonymisiert … kein Name, keine E-Mail"; Mailabschnitt beschreibt den persönlichen Link; Löschdialog vollständig. Offen für Florian: Analyse mit Speicherung im Browser braucht vor dem Einschalten eine Einwilligung (§ 25 TDDDG) - Merkzettel |
| 143 | `client/src/lib/texte/*` (Abschluss, Budget, CheckinBoard, CreatorVideos, DOOD, EmailCenter, Invite, Kostenstand, Listen, Papierkorb, PublicDispo, Vertraege, Shared, ForgotPassword, CateringListe, Moodboard, Pinboard, ProjectTemplates, Setplan, StaebchenplanNew), `lib/i18n.ts` | Klein (Text) | "Womit haeltst du die Leute in den ersten fuenf Sekunden?" und "ueblichen" in sichtbaren Texten; "{n} davon steht dem Abschluss entgegen" (falsche Zahl); "Kosten (est.)"; "{pct}% anwesend"; elfmal „…" mit geradem Schlusszeichen; das Französische siezte an 13 Stellen, an denen das Deutsche duzt (die externen Seiten - Casting, Vertrag, Abnahme - siezen auf Deutsch und behalten "vous"). | Prüfskript über alle Übersetzungstabellen: fehlende Sprache, Platzhalter, Gedankenstrich, Umschrift, Anrede | behoben; dabei eine selbst eingeführte Zeichenkette mit Apostroph sofort wieder repariert (Typprüfung). **Eigener Fehler im Commit `1b7cb63`:** Das Vereinheitlichen der Anführungszeichen lief als Python über die Shell, die den Rückverweis zerstörte - an 11 Stellen stand ein Steuerzeichen statt `{name}`, `{titel}`, `{q}`, `{text}`, "Antworten", "Übernehmen", "Person hinzufügen". Die Typprüfung sah es nicht (gültige Zeichenketten). Beim Lesen der Texte bemerkt und aus dem Vorstand wiederhergestellt; Gegenprobe gegen `1b7cb63^` zeigt nur noch das Schlusszeichen als Änderung. Im Vault ergänzt: `Fehler/Backslashes im Heredoc.md` |
| 144 | `client/src/lib/texte/*` (Versicherungen, Suche, VFX, ZeitAnalyse, OnboardingWizard, AutoSaveIndicator, SzenenKommentare, Shared, StaebchenplanNew, Moodboard, Pinboard, SetApp, Vertraege) | Klein (Text) | Beim Lesen aller deutschen Texte: "3 Versicherungen ist abgelaufen" / "läuft … ab" (Zahl beim Verb), "Bei 1 Personen …", Anführungszeichen ‘{q}’ und "{status}", "Total Szenen", "Gesamt Geplant", "Szenen Abgedreht", "Bild URL", "Bild Datei", "Drag zum Verschieben", "Zum Projekt Dashboard", "z.B.", zwei fehlende Kommas vor "um zu", drei Punkte statt Auslassungszeichen. | aus dem Text | behoben (18 Stellen), Typ- und Textprüfung grün |
| 145 | `client/src/lib/api.ts` (`req`, `reqMitMeta`) | Härtung (latent) | `{ headers: {…}, ...options }`: Gibt ein Aufruf eigene `headers` mit, ersetzt der Spread die zusammengeführten Kopfzeilen samt Anmeldung - die Anfrage ginge ohne Token raus. Heute übergibt kein Aufruf `headers`. | aus dem Code (kein Aufruf mit `headers`) | behoben: erst `...options`, dann die zusammengeführten `headers` |
| 146 | `client/src/lib/belohnung.ts`, `client/src/main.tsx` | Klein (Sprache) | Die Quittung nach jedem Schreibvorgang ("Gespeichert") und die Auffangmeldung für fehlgeschlagene Schreibvorgänge ("Nicht gespeichert") standen fest auf Deutsch - im englischen und französischen Modus nach jedem Speichern sichtbar. | aus dem Code (fester Standardwert, feste Zeichenketten) | behoben: Texte aus `topBarT.saved` und `appT.notSaved` in der gewählten Sprache. Danach gemessen (englisch, lokal): neue Aufgabe angelegt, Quittung "Saved"; Statuswechsel mit absichtlich abgelehntem Schreibvorgang (die Aufgaben-Änderung hat kein eigenes onError) zeigt "Not saved". Testaufgabe wieder gelöscht |
| 147 | `client/src/main.tsx`, neu `client/src/pages/NichtGefunden.tsx` | Klein | Ein unbekannter Pfad zeigte die rohe Fehlerseite von React Router ("Unexpected Application Error! 404 Not Found", englisch, ohne Weg zurück) - aus dem Merkzettel. | ja (Merkzettel) | behoben: Auffangroute `*` mit eigener Seite und Knopf zur Startseite. Danach gemessen: `/gibt-es-nicht/xyz` deutsch, `/projects/1/gibt-es-nicht` englisch; `/login` unverändert |
| 148 | `client/src/lib/utils.ts`, `client/src/lib/useT.ts` | Klein (Sprache) | `formatDate`, `formatDateLong` und `formatCurrency` standen fest auf Deutsch, obwohl `useGebietsschema` genau das für andere Seiten löst: Im englischen Modus Wochentag, Monat und Beträge deutsch auf Dashboard, Tagesdispo, Budget, Besetzung, Stabliste, Kostenstand, Motive, Equipment, Stäbchenplan, Tagesbericht, Stammdaten, Projektliste und in den Drehtag-Spalten. Dazu drei nie aufgerufene Funktionen (`getStatusColor`, `parseEighths`, `eighthsToMinutes`). | aus dem Code (`locale: de`, `'de-DE'`) | behoben: die gemeinsamen Formatierer lesen die gewählte Sprache (`aktuellesGebietsschema()`), tote Funktionen entfernt. Danach gemessen auf dem Dashboard: deutsch unverändert "Samstag, 31. Oktober 2026", "18.742,50 €"; englisch "Saturday, 31 October 2026", "€18,742.50" |
| 149 | `client/src/lib/i18n.ts`, `lib/useDownload.ts`, `lib/texte/komponenten/Shared.ts` | Klein (Text) | Die Spracheinstellung behauptete "die meisten Seiten sind deutsch" - nachgemessen sind 45 von 87 Seiten ohne Fund im Prüfskript, 21 mit bis zu zehn, 21 mit mehr. Das Französische siezte an sechs Stellen in `i18n.ts`, an denen das Deutsche duzt (Fund 143 hatte die Datei nicht ganz erfasst); "C'est parti!" und "automatiquement!" ohne Leerzeichen; "Fermer dialog"; "Call Sheet" in drei deutschen Meldungen der Tagesdispo; Platzhalter der Suche mit "..." und "Locations"; fest deutsche Meldung in `useDownload`. | `scripts/texte-pruefen.py` über alle Seiten | behoben; Kommentar an `LANGS` mit der neuen Messung |
| 150 | `client/src/contexts/AuthContext.tsx` (`logout`) | **Sicherheit** | "Abmelden" löschte nur das Token im Browser. Auf dem Server blieb die Sitzung offen: Ein kopiertes Token galt bis zum Ablauf (30 Tage) weiter, die Geräteliste in den Einstellungen zeigte die Sitzung als aktiv. Der Server kann Sitzungen beenden (`DELETE /api/auth/sessions/:sid`), die Oberfläche rief es nur für fremde Geräte auf. | ja: nach Abmelden über die Seitenleiste `/me` mit dem alten Token 200, Sitzung in `/sessions` mit `diese: true`. Erster Messversuch ungültig - die Seite hatte zwischendurch neu geladen, die Anfrage lief mit "Bearer undefined" und ergab 401; wiederholt mit Zwischenspeicher, der das Neuladen übersteht | behoben: `logout` beendet die eigene Sitzung im Hintergrund. Danach gemessen: `DELETE /api/auth/sessions/…` 200, altes Token 401 "Diese Anmeldung wurde beendet" |
| 151 | `client/src/contexts/AuthContext.tsx` | **Datenschutz** | Abmelden leerte den Abfrage-Zwischenspeicher nicht (`['projects', …]` ist nicht nach Konto getrennt, 30 s frisch). Meldete sich danach eine zweite Person am selben Gerät an - der Fall, den der Kommentar zu den Offline-Kopien ausdrücklich nennt -, sah sie die Projektliste des ersten Kontos. | ja: Konto A (67-mal "Sprachlos (Demo)" in der Liste) abgemeldet, Konto B (ein Projekt) über das Formular angemeldet: B sah 67, auch nach 4 s | behoben: `queryClient.clear()` beim Abmelden und bei jeder Anmeldung/Registrierung (auch ohne vorheriges Abmelden). Danach gemessen: B sieht 1. Temporäres Testkonto B danach gelöscht (Anmeldung 401) |
| 152 | `client/src/hooks/usePushSubscription.ts`, `contexts/AuthContext.tsx` | **Fehler** | Der Server liefert den Push-Schlüssel als `{ key }`, der Hook las `publicKey` und nahm sonst das ganze Objekt. Ohne Schlüssel (lokal) blieb der Abschnitt "Benachrichtigungen" sichtbar statt ausgeblendet; mit Schlüssel hätte `urlBase64ToUint8Array` das Objekt bekommen - `atob('[object Object]')` wirft, jedes Abo endet in "Aktivierung fehlgeschlagen". Dazu der Merkzettel-Punkt aus Fund 96: Abmelden kündigte das Push-Abo nicht, Benachrichtigungen des alten Kontos kamen in diesem Browser weiter an. | ja: lokal `{"key":null}`, Abschnitt sichtbar (Browser verweigert Benachrichtigungen, darum "denied" statt "unavailable"); der Weg mit Schlüssel aus dem Code, nicht gemessen (kein Schlüssel lokal) | behoben: `res.key`; beim Abmelden wird das Abo dieses Browsers beim Server abgemeldet und im Browser gekündigt, vor dem Beenden der Sitzung. Danach gemessen: Abschnitt ausgeblendet; mit einer Attrappe für den Service Worker (lokal keiner, Vorschau verweigert Benachrichtigungen) `POST /api/push/unsubscribe` 200, Attrappe gekündigt. Ob Push live eingerichtet ist, ist nicht geprüft |
| 153 | `client/src/contexts/AuthContext.tsx`, `contexts/ProjectRoleContext.tsx` | Klein | Ist der Server beim Start nicht erreichbar, liest die Oberfläche den Namen aus dem Token - per `atob`, also als Bytes: "PrÃ¼fer B" statt "Prüfer B". `canEditScenes` versprach "Szenen erst ab Regie"; der Server kennt diese Stufe nicht (Standard Abteilungsleitung), und keine Seite fragt sie ab. | ja: Dekodierung am Token eines Kontos mit Umlaut nachgerechnet; `canEditScenes` aus dem Code | behoben: `TextDecoder`; `canEditScenes` entfernt, `canEdit` mit Verweis auf die Serverregel |
| 154 | `client/src/store/useProjectStore.ts`, `App.tsx`, `components/layout/TopBar.tsx`, `server/src/utils/calculations.ts`, `__tests__/budget.test.ts` | Klein (toter Code) | Im Store: `activeProjectId` wurde geschrieben und gespeichert, aber nie gelesen; `lastSaved` nie gesetzt - die Anzeige "Gespeichert HH:MM" in der Kopfleiste erschien nie (die Quittung kommt längst aus `lib/belohnung.ts`); Rückgängig-Stapel ohne einen Aufrufer. `utils/calculations.ts` (Sozialversicherung mit Sätzen von 2024, Beträge fest `de-DE`) benutzte nur sein eigener Test. Die Abhakliste kannte diese und 14 weitere Dateien nicht (Abgleich mit `git ls-files`, nachgetragen). | aus dem Code (keine Leser bzw. Aufrufer, `grep`) | entfernt; Typprüfung und Testsuite grün |
| 155 | `client/src/components/shared/GlobalSearch.tsx`, `components/ui/command.tsx` | **Fehler, live** | Die globale Suche (Strg+K) zeigte nie einen Treffer: Der Server sucht, und `cmdk` filterte die Antwort ein zweites Mal selbst - dabei fiel alles heraus, auch Treffer mit dem Suchwort im sichtbaren Text. Dazu konnte eine ältere, langsamere Antwort eine neuere überschreiben. | ja: "Pflanze" 4 Treffer vom Server, 0 in der Liste; Gegenprobe am alten Stand "Mia" 6 vom Server, 0 angezeigt | behoben: `shouldFilter={false}` (der Server filtert), veraltete Antworten werden verworfen. Danach gemessen: "Pflanze" 4, "Mia" 6 sichtbar, Enter springt zum Treffer, "xyzgibtsnicht" zeigt "Keine Ergebnisse" |
| 156 | `server/src/routes/search.ts`, `GlobalSearch.tsx`, `lib/texte/komponenten/Shared.ts` | Verknüpfung (Florian, 27.10.2026) | "Wenn Mia eine Darstellerin ist, auch alles zu ihrem Character." Die Suche kannte keine Figuren, und über eine Darstellerin fand sie nur deren Namen. Die Unterzeilen kamen fest deutsch vom Server ("Darsteller*in", Blocktyp roh als "action"). | ja: Suche nach der Darstellerin lieferte nur `cast` (Test gegen den alten Stand rot) | gebaut: Figuren werden gesucht; für jede gefundene Figur - direkt oder über ihre Darstellerin - kommen Figur (gespielt von …), Darsteller (spielt …), Drehtage (mit Szenen, Sprung in die Tagesdispo des Tages) und Szenen dazu. Beschriftung im Client in der gewählten Sprache. Test `Suche: alles zur Figur` (inklusive fremdem Projekt mit gleichnamiger Figur). Im Browser: "Anna Schmidt" zeigt Mia, Anna Schmidt, Drehtage 1-3, Szenen 3-7; englisch "Character · played by Anna Schmidt" |
| 157 | `client/src/App.tsx` (Tastenkürzel) | **Fehler** | Die Seitenkürzel (D, S, B, T, C, E, L, M, G) griffen überall außer in Eingabefeldern - auch in einer offenen Auswahlliste, in der man Buchstaben tippt, um zu springen. | ja: Rollenauswahl von Anna Schmidt geöffnet, "d" - Wechsel auf den Drehplan mitten aus der Bearbeitung | behoben: keine Kürzel in Feldern, Auswahllisten, Menüs und Dialogen. Danach gemessen: "d" in der offenen Liste bleibt ohne Wirkung; außerhalb wechselt "d" weiter zum Drehplan; die Rolle blieb unverändert |
| 158 | `client/src/components/ui/nur-vorlesen.tsx`, `command.tsx` | Barrierefreiheit | `NurVorlesen` reichte keine Eigenschaften weiter. Als `<DialogTitle asChild>` (Rundgang, Einrichtung) fiel damit die `id` weg, auf die der Dialog mit `aria-labelledby` zeigt - die Dialoge blieben für Vorleseanwendungen namenlos, trotz Titel. Der Suchdialog hatte gar keinen Titel; die Konsole meldete "DialogContent requires a DialogTitle". | ja: nach vollem Neuladen zeigt `aria-labelledby` des Suchdialogs mit dem alten Baustein auf kein Element (erster Versuch per Hot-Reload ungültig - der Dialog blieb mit altem DOM offen) | behoben: `forwardRef` mit allen Eigenschaften; Suchdialog mit Titel "Suche im Projekt". Danach gemessen: Suchdialog "Suche im Projekt", Rundgang "Rundgang" (mit temporärem, danach gelöschtem Konto, weil der Rundgang nur nach der Registrierung kommt) |
| 159 | `components/shared/ShortcutsModal.tsx`, `TutorialModal.tsx`, `AutoSaveIndicator.tsx`, `PDFPreviewModal.tsx`, `TestversionBadge.tsx`, `layout/PageHeader.tsx` | Klein | Der Kürzel-Dialog nannte 4 der 9 Seitenkürzel. Die Schrittpunkte im Rundgang waren Knöpfe ohne Namen. `AutoSaveIndicator` und `PDFPreviewModal` band keine Seite ein (die PDF-Vorschau hätte geschützte PDFs zudem ohne Anmeldung geladen). Umschrift in Kommentaren. | ja: Kürzel-Dialog im Browser; Rest aus dem Code | behoben: alle neun Kürzel (gemessen), Punkte mit "Schritt n" und `aria-current`, die beiden toten Komponenten samt Texten entfernt |
| 160 | `components/layout/Sidebar.tsx`, `TopBar.tsx`, `pages/Dashboard.tsx`, `pages/ZeitAnalyse.tsx` | **Fehler (Verknüpfung)** | Abfrageschlüssel mit der Projektkennung als Text (`['project', '186']`), während Stammdaten, App, Tagesdispo u. a. sie als Zahl bauen (`['project', 186]`). Für React Query sind das zwei Einträge: Eine Änderung invalidiert nur den einen. Ebenso `conflicts`, `stats`, `creator-overview`. | ja: Projekttitel in den Stammdaten geändert, `PUT` 200 - Kopf- und Seitenleiste zeigten weiter den alten Titel; das Projekt wurde je Seitenwechsel zweimal geladen. Das Prüfskript (`scratchpad/schluessel.py`) meldete zunächst zehn gemischte Schlüssel; die meisten waren Fehlalarm (in Unterkomponenten ist `projectId` eine Zahl als Prop), echt waren die vier Dateien | behoben: überall `Number(projectId)`. Danach gemessen: Titel sofort in Kopf- und Seitenleiste, `/api/projects/186` einmal je Seite; Demo-Titel zurückgesetzt |
| 161 | `components/layout/TopBar.tsx` | Fehler | Der Knopf "Drehtag 2 in 4 Tagen" öffnete die Tagesdispo ohne Kennung - die Seite zeigte Tag 1 (24.10., vorbei). Das Tastenkürzel stand als ⌘K auch unter Windows da. | ja: Klick führte nach `/tagesdispo`, Seite "Tag 1 - 24.10.2026" | behoben: Sprung nach `/tagesdispo/<Kennung des Tages>`, Anzeige "Strg K" außerhalb von Apple-Geräten. Danach gemessen: `/tagesdispo/402`, "Tag 2 - 31.10.2026", Anzeige "Strg K" |
| 162 | `components/layout/Sidebar.tsx` | Fehler (Navigation) | Die aktive Seite wurde nur am ersten Pfadabschnitt erkannt: Jede Creator-Unterseite (Kanal, Serien, Sponsoren …) galt als "Videos" - zwei Einträge markiert, die Gruppe der Seite blieb zugeklappt. Der Trenner der schmalen Leiste verglich die Gruppe mit dem Wort "Übersicht" (englisch nie gleich). Die Zahl am Eintrag "Konflikte" fehlte im vorgelesenen Namen. | ja: in einem dafür angelegten Creator-Projekt auf "Kanal" markiert "Kanal" und "Videos", Gruppe "Kanal & Planung" zu | behoben: Zuordnung über zwei Abschnitte, Projekt-Einträge markiert die eigene Zuordnung; Trenner nach Position; Name mit Zahl. Danach gemessen: "Kanal" allein und Gruppe offen, "Videos" auf der Videoliste, "Tagesdispo" auf `/tagesdispo/402`, "Konflikte (1)", Admin-Statistik einfach markiert. Prüfprojekt gelöscht |
| 163 | `client/src/lib/utils.ts` (`getStripClass`) | Fehler (Anzeige) | Die Streifenfarbe im Drehplan, in der Ablage und in der Shotlist kannte nur INT/EXT × TAG/NACHT. Alles andere wurde Außen-Nacht: INT MORGEN, INT DÄMMERUNG, EXT MORGEN und jede INT/EXT-Szene. Die Szenenübersicht bietet MORGEN, DÄMMERUNG und INT/EXT zur Auswahl an, der Textimport erkennt sie. | ja: alle zwölf Kombinationen über das Modul im Browser - acht davon "ext-nacht" | behoben: MORGEN zählt als Tag, DÄMMERUNG als Nacht, INT/EXT als Außen. **Die beiden letzten Zuordnungen sind ein Vorschlag - Florian kann umentscheiden.** Danach gemessen: INT MORGEN "int-tag", INT DÄMMERUNG "int-nacht", INT/EXT TAG "ext-tag" |
| 164 | `client/src/index.css`, `components/drehplan/SceneStrip.tsx` | Barrierefreiheit | 27 Bedienknöpfe erscheinen nur beim Überfahren mit der Maus (`opacity-0 group-hover:opacity-100`); für Touch gab es eine Regel, für die Tastatur nicht - wer mit Tab dorthin kam, fokussierte einen unsichtbaren Knopf. Dazu fest deutsche Vorlesetexte am Szenenstreifen ("… verschieben", "… aus Drehtag entfernen"). | ja: Entfernen-Knopf am Szenenstreifen mit Fokus Deckkraft 0. Erster Messversuch ungültig - Übergänge laufen im Vorschaufenster nicht weiter, erst `getAnimations().finish()` zeigt den Endwert | behoben: eine Regel `.group:focus-within` für alle 27 Stellen; Texte übersetzt. Danach gemessen: mit Fokus 1, ohne 0; Gegenprobe mit zur Laufzeit entfernter Regel: mit Fokus 0 |
| 165 | `components/creator/YouTubeConnection.tsx`, `RetentionChart.tsx`, `BereichLayout.tsx` | Klein | Nach dem YouTube-Abgleich wurden nur Übersicht und Videoliste neu geladen; Performance, Muster, Haltekurven und Einzelvideo zeigten bis zu 30 Sekunden alte Zahlen. Die Haltekurve zeigte Werte nur bei Mausbewegung - am Tablet nie - und die Legende nannte "Hook" auch ohne Hook-Abschnitt. | Abgleich aus dem Code (lokal keine YouTube-Zugangsdaten, nicht gemessen); Haltekurve ja: mit Beispieldaten in der Seite gerendert | behoben: der Abgleich erneuert alle `creator-…`-Abfragen; Zeigerereignisse statt Maus, Hinweistext angepasst, "Hook" nur bei Hook-Abschnitt. Danach gemessen: Legende ohne Hook-Abschnitt nur "Sponsor"; Antippen bei der Hälfte zeigt "Bei 1:00 schauen noch 60 %" (Kurve 60 %) |
| 166 | `components/OnboardingWizard.tsx` | **Fehler** | Der Einrichtungsassistent für neue Konten bot unter "Genre" die Formate an (Spielfilm, Kurzfilm …) und unter "Format" einen Freitext für die Technik ("z. B. 4K, 16 mm"). Überall sonst ist das Genre frei und das Format eine Auswahl - und am Format hängt, ob ein Film- oder Creator-Projekt entsteht. Wer einen YouTube-Kanal anlegen wollte, bekam immer ein Filmprojekt. Das X oben rechts tat nichts (`onOpenChange={() => {}}`). | ja, mit temporärem Konto über die Oberfläche: Projekt mit Genre "Kurzfilm", Format leer; X geklickt, Dialog blieb offen | behoben: Genre Freitext, Format Auswahl aller Formate (mit Creator-Formaten, übersetzt), X beendet wie "Überspringen". Danach gemessen: Genre "Doku", Format "YouTube-Video", Projektart `creator`; X schließt und setzt den Merker. Konto samt Projekten gelöscht |
| 167 | `client/src/lib/utils.ts` (`parseTime`), genutzt von `components/ui/time-input.tsx` | **Fehler (Daten)** | Das Zeitfeld (General Call, Shooting Call, Calls der Personen) trennte nur am Doppelpunkt. "1630" ohne Doppelpunkt wurde 1630 Stunden, "930" 930 Stunden, "16.30" - in Deutschland üblich - still 16:18, "25:99" 26:39, "-1" -1:00; das Feld übernahm jeden dieser Werte. | ja: über das Modul im Browser, alle Fälle wie beschrieben | behoben: versteht 16:30, 16.30, 1630, 930 und 9; außerhalb 00:00-23:59 ungültig, das Feld springt auf den letzten gültigen Wert. Danach gemessen: im Modul alle Fälle richtig; in der Tagesdispo "0630" wird 06:30, "16.30" wird 16:30; Demo-Wert auf 08:00 zurückgesetzt (Server: 480) |
| 168 | `client/src/components/ui/label.tsx` | Barrierefreiheit | `Label` verknüpfte sich mit dem ersten Feld im Elternelement. Stehen zwei Paare im selben Container, zeigen beide Beschriftungen auf das erste Feld. `lib/beschriftungen.ts` (für native Beschriftungen) prüfte dagegen schon zuerst das Nachbarelement. | ja: am Baustein gerendert, "Nachname" zeigte auf das Feld von "Vorname". Auf 23 Seiten (ohne geöffnete Dialoge) war es nicht zu sehen: 28 verknüpfte Beschriftungen, keine geteilt | behoben: zuerst das Nachbarelement, sonst das erste noch unbeschriftete Feld. Danach gemessen: zwei Paare richtig, übliches Muster und Hinweistext dazwischen unverändert richtig |
| 169 | `client/src/components/ui/toast.tsx` | Klein (Barrierefreiheit) | Der Schließen-Knopf der Hinweisfenster war ein Symbol ohne Namen. | aus dem Code | behoben wie beim Dialog (unsichtbarer Text "Schließen" in der gewählten Sprache). Danach gemessen: Name "Schließen" |
| 170 | `client/src/App.tsx`, `client/src/main.tsx` | **Fehler** | Der `Toaster` hing nur im App-Rahmen. Die Seiten ohne Rahmen - Vertrag bestätigen (2 Meldungen), Casting-Antwort (1), Abnahme (3), dazu die globale Fehlermeldung für Schreibvorgänge auf öffentlicher Dispo und Set-App - zeigten ihre Meldungen nie: Wer dort etwas falsch machte oder wessen Speichern scheiterte, erfuhr es nicht. | ja: auf `/casting/…` eine Meldung ausgelöst, nichts erschien | behoben: `Toaster` einmal in `main.tsx` für alle Seiten. Danach gemessen: Meldung auf der Casting-Seite sichtbar; im App-Rahmen genau ein Meldungsbereich und eine Meldung |
| 171 | `client/src/App.tsx`, `store/useProjectStore.ts` | Klein | Solange das Projekt lud, galt die Rolle als "nur lesen" - der Hinweis "Du hast Lesezugriff" stand dann über jeder Projektseite, auch für die Leitung. `searchOpen` im Store wurde nie benutzt (die Suche führt ihren Zustand in `App.tsx`). | ja: Projektabfrage um 1,5 s verzögert, Hinweis beim Laden sichtbar, danach weg | behoben: Hinweis erst mit geladenem Projekt; `searchOpen` entfernt. Danach gemessen: kein Hinweis beim verzögerten Laden |
| 172 | `client/src/pages/Pinboard.tsx` | **Fehler (Datenverlust)** | Eine Notiz speichert beim Tippen, die zwischengespeicherte Liste blieb aber auf dem alten Stand (30 s frisch). Wer die Seite verließ und zurückkam, sah den alten Text - und wer dann weitertippte, überschrieb den gespeicherten. | ja: Notiz angelegt, Text getippt (Server hatte ihn), über Aufgaben zurück: Notiz leer | behoben: gespeicherte Änderungen werden in die Liste geschrieben. Danach gemessen: nach Rückkehr steht der gespeicherte Text da (Server und Anzeige gleich); Prüfnotiz gelöscht |
| 173 | `pages/CreatorRedaktionsplan.tsx`, `CreatorPerformance.tsx`, `ProjectTemplates.tsx` | Klein | Redaktionsplan und Performance bauten Daten fest als "TT.MM.JJJJ", Performance Prozente mit Punkt ("4.2 %" auch im Deutschen). `ProjectTemplates.tsx` war weder eine Route noch eingebunden und hätte Formate gesetzt, die es nicht gibt ("Dokumentarfilm", "Musikvideo"). | aus dem Code | behoben: `formatDate` und `toLocaleString` in der gewählten Sprache; Vorlagenseite samt Texten entfernt. Gemessen am 31.10.2026 mit einem Prüfprojekt: Englisch 05/11/2026, 4.3 %, 12,345; Französisch 05/11/2026, 4,3 %, 12 345; Deutsch 05.11.2026, 4,3 % |
| 174 | `client/src/pages/Fahrzeuge.tsx`, `lib/i18n.ts` | Klein (Sprache) | Meldungen (gelöscht, gespeichert, Fehler), Platzhalter, "Speichern"/"Abbrechen" und die Spalten "Name", "Plätze", "Telefon" standen fest deutsch. | `scripts/texte-pruefen.py`: 9 Funde, dazu zwei vom Skript nicht erkannte | behoben. Danach gemessen (englisch): Spalten NAME, PLATE, TYPE, SEATS, DRIVER, PHONE, Platzhalter und Knöpfe englisch; Prüfskript 0 |
| 175 | `client/src/pages/Suche.tsx`, neu `client/src/lib/suchtreffer.ts`, `components/shared/GlobalSearch.tsx` | **Eigener Fehler (Regression aus Fund 156)** | Fund 156 hatte die Antwort der Suche auf Daten statt deutscher Sätze umgestellt und nur die Schnellsuche (Strg+K) angepasst. Die Suchseite nutzt denselben Endpunkt: Szenen standen ohne Nummer da, Textstellen ohne Titel, und Figur und Drehtage fehlten ganz, weil die Seite diese Arten nicht kannte. | ja: Suchseite, "Mia": Gruppen nur SZENEN (ohne Nummer) und DREHBUCH (ohne Titel) | behoben: Beschriftung und Symbole in `lib/suchtreffer.ts`, von Schnellsuche und Suchseite gemeinsam genutzt; die Suchseite kennt Figuren und Drehtage. Danach gemessen: Suchseite FIGUREN (Mia, gespielt von Anna Schmidt), DREHTAGE, SZENEN ("Szene 3: Mia vor der Tür"), DREHBUCH mit Blockart; Schnellsuche unverändert richtig. Merksatz: Wer eine Antwortform ändert, sucht alle Aufrufer des Endpunkts (`grep api.search`) |
| 176 | `client/src/pages/Listen.tsx`, `pages/Rechnungen.tsx` | **Fehler, live** | Drei Knöpfe waren einfache Links auf geschützte Adressen: Listen-Export (Stab, Besetzung, Szenen, Drehplan), Rechnungs-Export für die Buchhaltung und "PDF" einer Rechnung. Ein Link schickt keine Anmeldung mit; die Server antworten 401 - heruntergeladen wurde die Fehlermeldung als "CSV", das PDF öffnete "Nicht authentifiziert". Dasselbe Muster wie Fund 113, an diesen Stellen übersehen. | ja: `export/crew.csv`, `invoices/report/export.csv`, `invoices/7/pdf` ohne Anmeldung 401 (mit 200); die Vorlage für den Import ist öffentlich (200) und bleibt ein Link | behoben: Exporte über `useDownload`, PDF über `useAnsehen`. Danach gemessen: Listen-Export `text/csv` 682 Bytes, Buchhaltungs-Export `text/csv` 715 Bytes, Rechnungs-PDF `application/pdf` 169 KB im neuen Fenster (Fenster per Attrappe, das Vorschaufenster öffnet keine Tabs). Andere `window.open`/Links geprüft: nur öffentliche Adressen |
| 177 | `client/src/pages/Aufgaben.tsx`, `pages/Benutzerverwaltung.tsx` | Klein | Aufgaben: Bei Lesezugriff war nur das Eingabeformular gesperrt, Status- und Löschknöpfe nicht - der Klick scheiterte erst am Server. `Benutzerverwaltung.tsx` war weder Route noch eingebunden (die Benutzerverwaltung läuft über `AdminPanel`); sie hätte globale Rollen mit Projektrollen verwechselt und Hooks nach einem bedingten `return` aufgerufen. | aus dem Code | behoben: Knöpfe bei Lesezugriff gesperrt; tote Seite samt Texten entfernt. Lesezugriff wird gesammelt mit einem Leser-Konto gemessen (Merkzettel) |
| 178 | `client/src/pages/Abschluss.tsx`, `server/src/routes/abschluss.ts` | Fehler | Nach dem Abschließen blieb das Projekt in der Projektliste bei den aktiven stehen, bis die Liste neu geladen wurde - der Server führt es dann im Archiv. Beim Wiederöffnen setzte der Server immer "Postproduktion", obwohl er den Status von vorher ins Protokoll schreibt, und "öffnete" auch ein gar nicht abgeschlossenes Projekt (wurde dann still Postproduktion). | ja: Demo-Projekt abgeschlossen, Liste zeigte es weiter (66), erst nach Neuladen 65; nach Wiederöffnen "Postproduktion", Zwilling 184 "Vorproduktion" | behoben: Abschließen und Wiederöffnen erneuern die Projektliste; Wiederöffnen nimmt den Status aus dem Protokolleintrag, öffnet nur Abgeschlossenes (sonst 409, Meldung übersetzt). Danach gemessen: nach Wiederöffnen sofort in der Liste (66) ohne Neuladen; Test `Projektabschluss zurücknehmen` (Drehphase bleibt Drehphase, zweites Wiederöffnen 409), gegen den alten Stand rot. Demo-Projekt auf "Vorproduktion" zurückgesetzt |
| 179 | `client/src/pages/Kontaktliste.tsx`, `server/src/routes/contactsExport.ts`, `lib/i18n.ts` | **Fehler + Verknüpfung** | Die Kontaktliste zeigte nur Stab und Besetzung - Komparsen und die Ansprechpartner der Motive fehlten (der vCard-Export hatte immerhin die Motive). Der CSV-Export der Seite entstand im Browser ohne den Formelschutz, den die Server-Exporte haben; der CSV-Export des Servers hatte ihn auch nicht und blieb ungenutzt. Motiv-Kontakte kamen ohne ihre E-Mail. Der vCard-Knopf schwieg bei einem Fehler. Mehrere Texte fest deutsch ("als …", "Darsteller", "CSV Export"). | ja: 4 Komparsen mit Telefon/Mail nicht in Liste und Export; ein Stabname `=HYPERLINK(…)` stand unverändert in der CSV | behoben: Liste und Filter mit Komparsen und Motiv-Kontakten; beide Exporte vom Server über `useDownload`, CSV über `schreibeCsv`; Texte übersetzt. Danach gemessen: 18 Kontakte (4 Komparsen, 3 Motiv-Kontakte), CSV mit `'=HYPERLINK…` und 4 Komparsen, vCard 18 Karten. Test `Kontakt-Export` (Komparse, Motiv-Mail, Formel), gegen den alten Stand rot. Prüfeintrag gelöscht |
| 180 | neu `client/src/lib/csv.ts`; `pages/Besetzung.tsx`, `Stabliste.tsx`, `DOOD.tsx`, `Musikliste.tsx` | Fehler (Export) | Vier Seiten bauten ihre CSV im Browser: Komma als Trenner (deutsches Excel zeigt alles in einer Spalte), Beträge als "450.5" statt "450,50", und ohne den Formelschutz der Server-Exporte - ein Name wie `=HYPERLINK(…)` wäre in Excel ausgeführt worden. | aus dem Code, Regeln wie `schreibeCsv` im Server (Fund 134 und Tabellen-Funde) | behoben: ein gemeinsamer Baustein mit denselben Regeln wie der Server (Semikolon, CRLF, Byte-Reihenfolge-Marke, Hochkomma vor Formeln, Beträge mit Komma). Danach gemessen: im Modul `'=1+1`, "-5" unverändert, "450,50", Anführungszeichen richtig; Stabliste-Export mit Semikolon und "450,00" |
| 181 | `client/src/pages/ActivityFeed.tsx` | Fehler | Der Aktivitäts-Feed filterte und beschriftete nach Tabellennamen (`crew`, `scenes` …). Die automatische Protokollierung schreibt aber deutsche Bezeichnungen ("Stab", "Szene", "Budgetposten" - `ENTITAET` in `routes/audit.ts`), nur einzelne Routen den Tabellennamen. Jeder Filter außer "Alle" blieb leer, kein Eintrag bekam sein Abzeichen. Dazu eine eigene Kopie von `req` mit dem Kopfzeilen-Fehler aus Fund 145. | ja: 19 Einträge, 4 davon "Stab"; Filter "Stab" zeigte 0 | behoben: Zuordnung beider Formen zu den Filtergruppen, Filter "Musik" ergänzt, Abfrage über `api.activity`. Danach gemessen: Filter "Stab" 4 von 19, Abzeichen "Stab" und "Drehtage" (Tagesdispo) |
| 182 | `client/src/pages/CreatorIdeen.tsx`, `CreatorVideos.tsx`, `CreatorVideo.tsx` | Fehler | Eine Idee zum Video machen, ein Video löschen oder seinen Status ändern erneuerte nur die Videoliste. Redaktionsplan, Kanal, Serien, Performance zeigten bis zu 30 Sekunden (`staleTime`) den alten Stand. Dazu: In der Videoliste öffnete nur ein Mausklick auf die Zeile das Video, die Tastatur kam nicht hin; Knöpfe mit nur einem Symbol (Löschen, Status, Wirkung, Aufwand, Abschnitt hoch/runter, Material, Auskopplung, Checklistenpunkt) hatten keinen Namen. | ja: Idee umgewandelt, Redaktionsplan zeigte "Ohne Datum 2", der Server 3 (Gegenprobe mit altem Stand) | behoben: alle `creator-`-Abfragen werden erneuert, Titel ist ein echter Link, alle Symbolknöpfe benannt. Danach gemessen: "Ohne Datum" sofort richtig, zweite Abfrage innerhalb der 30 Sekunden; Eingabetaste auf dem Titel öffnet das Video; in allen vier Reitern des Einzelvideos 0 Knöpfe ohne Namen |
| 183 | `client/src/pages/CreatorVideo.tsx` | Fehler | Titel und Hook speicherten verzögert (600 ms). Wer tippte und gleich die Seite verließ, verlor die Eingabe: Der Zeitgeber wurde beim Verlassen nicht ausgelöst, sondern verworfen. | ja: Titel getippt, sofort zurück zur Liste - Server behielt den alten Titel; mit 1,2 s Pause kam er an (Messaufbau geprüft) | behoben: Beim Verlassen wird die offene Eingabe sofort gespeichert, danach alle Creator-Abfragen erneuert. Danach gemessen: Server-Titel "Titel sofort weg", die Liste zeigt ihn |
| 184 | `server/src/routes/invites.ts`, `client/src/pages/Invite.tsx` | Fehler | Einladung annehmen überschrieb jede Rolle außer Admin. Die Seite nimmt angemeldet automatisch an: Wer als Produktion einen weitergeleiteten Lese-Link öffnete, war ohne Rückfrage nur noch Lesezugriff. Die Seite zeigte zudem die Rolle der Einladung statt der geltenden, und die Projektliste kannte das neue Projekt erst nach Ablauf des Caches. | ja: Test - Produktion nimmt Lese-Link an, danach `read_only` | behoben: Einladung hebt an, stuft nie herab, Antwort nennt die geltende Rolle; Seite zeigt sie und erneuert `['projects']`. Danach gemessen: Test grün (bleibt Produktion, Admin-Link hebt an); im Browser "Du bist jetzt Regisseur" nach Lese-Link, neues Projekt sofort in der Liste (Gegenprobe ohne Erneuern nicht gemacht) |
| 185 | `client/src/pages/PublicDispo.tsx`, `server/src/routes/confirmation.ts`, `client/src/pages/Login.tsx` | Fehler | Die öffentliche Dispo schrieb bei vorhandenem Konto "hier anmelden, um das ganze Projekt zu sehen". Nach der Anmeldung war man aber kein Mitglied, und die Anmeldung führte zur Projektliste statt zurück. Es gab keinen Weg ins Projekt. Außerdem las die Seite das Drehdatum mit `new Date("2026-12-02")` als UTC: Westlich von Greenwich stand der Vortag. | ja: Test - Konto erkannt (`has_account`), Beitritt 404, keine Mitgliedschaft | behoben: `POST /cse/t/:token/beitreten` (nur mit der E-Mail des Eintrags, sonst 403; Lesezugriff, vorhandene Rolle bleibt). Die Anmeldung springt über `?weiter=` zurück, nur zu Pfaden dieser App. Angemeldet zeigt die Dispo "Ganzes Projekt öffnen". Datum über `formatDateLong`. Danach gemessen: Test grün. Im Browser abgemeldet Link mit Rücksprung, Anmeldung zurück zur Dispo, Knopf öffnet das Projekt mit Lesezugriff-Hinweis. `//boese.de` und `https://…` führen zu `/` |
| 186 | `client/src/pages/Login.tsx`, `client/src/lib/i18n.ts` | Klein | Die Anmeldeseite, die neue Nutzer zuerst sehen, hatte 16 feste deutsche Texte: Überschrift, Untertitel, "Passwort vergessen?", Zwei-Faktor-Hinweis, Dispo-Beispiel, Fußzeile. Dazu der Fehlertext fest englisch. Ein Code-Feld aus einem Zwei-Faktor-Versuch blieb beim Wechsel auf "Registrieren" als Pflichtfeld stehen. Die Sprachwahl hatte eine Beschriftung ohne Bezug. | ja: Textprüfung, Code-Feld aus dem Code | behoben: alle Texte in `loginT`, Code-Feld wird beim Wechsel zurückgesetzt, Sprachwahl als benannte Gruppe mit `aria-pressed`. Danach gemessen: Englisch und Französisch ohne deutsches Wort, auch in der linken Spalte. Das Code-Feld nicht gemessen, dafür fehlt ein Konto mit zweitem Faktor |
| 187 | `client/src/pages/Equipment.tsx`, `client/src/lib/i18n.ts` | Fehler | Die Equipment-Seite rechnete Tagessatz × Tage ohne Menge. Server, PDF und Kalkulation rechnen mit Menge. Zwei Leuchten zu 50 € für drei Tage standen auf der Seite mit 150 €, im PDF und im Budget mit 300 €. Weitere Mängel: Ein geleertes Mengen- oder Tagefeld sprang sofort auf 1, aus "3" tippen wurde "13". Bei Lesezugriff ließen sich alle Felder bearbeiten, der Klick scheiterte erst am Server. Spalten, Untertitel, Abteilungen und Bildschirmleser-Namen waren fest deutsch. | ja: Seite 150,00 €, Server `total_cents` 30000 | behoben: eine Rechnung wie der Server, leere Zahlenfelder bleiben beim Tippen leer, Felder bei Lesezugriff gesperrt, alle Texte übersetzt (Abteilung bleibt deutsch gespeichert, Anzeige übersetzt). Danach gemessen: Zeile und Summe 300,00 €. Menge geleert und "3" getippt ergibt 3, Server 3 Stück / 45000. Mit einem Lese-Konto 6 von 6 Feldern gesperrt, kein Löschen, kein Anlegen |
| 188 | 19 Seiten (Abnahme, AbnahmeAnsicht, Agenturen, Angebote, Aufgaben, Auswertungen, CastingAntwort, CateringListe, CheckinBoard, CreatorKanal, Dateien, DOOD, Firma, Kostenstand, OffenePosten, Rechnungen, Reise, Timesheets, Verträge) | Fehler | Datumswerte "JJJJ-MM-TT" wurden mit `new Date(...)` gelesen, also als Mitternacht UTC. Westlich von Greenwich zeigten diese Seiten den Vortag: Fristen, Fälligkeiten, Drehtage, Termine. Im Creator-Kanal landete ein Video im Kalender einen Tag zu früh. In Deutschland unsichtbar (UTC+1/+2). `formatDate` in `lib/utils.ts` las schon richtig (`parseISO`). | ja: Node mit Ortszeit New York, `new Date("2026-11-05")` ergibt 4.11.2026 | behoben: überall `parseISO` (liest reine Daten als Ortszeit, volle Zeitstempel weiter exakt). Danach gemessen: New York 5.11., Berlin und Tokio unverändert, Zeitstempel `2026-11-05T22:30:00Z` exakt. Im Browser: Drehtag-Auswahl in Check-in und Timesheets zeigt dieselben Tage wie der Server, kein "Invalid Date" auf den umgestellten Projektseiten. Die Seiten, die nicht unter dem Projekt hängen (Rechnungen, Angebote, Offene Posten, Dateien, Auswertungen), habe ich nur mit dem Typprüfer geprüft |
| 189 | `client/src/pages/AbnahmeAnsicht.tsx`, `server/src/routes/abnahme.ts`, `client/src/pages/Abnahme.tsx` | Klein | Der Auftraggeber sah bei einer Fassung ohne eingetragene Länge "Länge 0:00": 0 ist der Vorgabewert der Spalte. Ohne Länge begann die Kopfzeile mit " · ". Intern stand in der Fassungsauswahl "Fassung 1 (0:00)". | ja: Kopfzeile "Länge 0:00" bei Runde 2 | behoben: Länge 0 heißt "nicht eingetragen" (leer), Kopfzeile setzt Trenner nur zwischen vorhandene Angaben. Danach gemessen: Runde 2 ohne Kopfzeile, Runde 1 "Länge 12:14 · h264 1080p · Rückmeldung erbeten bis 20.10.2026" |
| 190 | `pages/Buchhaltung.tsx`, `Agenturen.tsx`, `Angebote.tsx`, `Auswertungen.tsx`, `OffenePosten.tsx`, `Rechnungen.tsx`, `Dashboard.tsx`, `Reise.tsx` | Fehler | "Heute" kam aus `new Date().toISOString().slice(0, 10)`, also aus UTC. In Deutschland ist das zwischen Mitternacht und 1 bzw. 2 Uhr noch der Vortag. Betroffen: der Buchhaltungs-Export "bis heute" ohne die Rechnungen des Tages, Rechnungs- und Angebotsdaten mit dem Vortag als Vorgabe, Fälligkeiten in Offene Posten, Dashboard und Reise. Den richtigen Helfer `heuteISO` gab es schon seit dem Set-App-Fehler vom 26.09.2026, diese acht Stellen nutzten ihn nicht. | ja: im Browser (Europe/Berlin) um 00:30 am 1.11. ergab der alte Weg `2026-10-31` | behoben: alle acht über `heuteISO()`. Danach gemessen: 00:30 ergibt `2026-11-01`, mittags unverändert. Buchhaltung zeigt "Bis 2026-10-31" (heute) |
| 191 | `client/src/pages/AuditLog.tsx` | Klein | Das Änderungsprotokoll baute Zeitpunkte fest als "31.10.2026 18:00:00", auch auf Englisch und Französisch (wie Fund 148, hier übersehen). Geprüft und in Ordnung: Der Datumsfilter grenzt Tage auf dem Server nach deutscher Zeit ab (`AT TIME ZONE 'Europe/Berlin'`). Die Farbmarken treffen die häufigen Aktionen (angelegt/create, geändert/update, gelöscht/delete). | aus dem Code | behoben: Zeitpunkt und "seit" in der gewählten Sprache. Danach gemessen: Deutsch "31.10.2026, 18:43:16" und "seit 26.10.2026", Englisch "31/10/2026, 18:43:16" und "since 26/10/2026" |
| 192 | `client/src/lib/utils.ts` (neu `betragInCent`), `pages/Kostenstand.tsx`, `OffenePosten.tsx`, `Versicherungen.tsx`, `Agenturen.tsx`, `Angebote.tsx`, `CastingAntwort.tsx`, `Reise.tsx` | **Fehler, Geld** | Sieben Seiten lasen Beträge mit eigenen Parsern, die in entgegengesetzte Richtungen irrten. Kostenstand, Offene Posten (Zahlung erfassen) und Versicherungen machten aus "1.234,56" 1,23 €. Agenturen (Gage), Angebote (Einzelpreis), Casting-Antwort (Gagenwunsch) und Reise (Unterkunft) entfernten jeden Punkt, aus "12.50" oder "450.00" wurden 1.250 € bzw. 45.000 €. | ja: Kostenstand über die Oberfläche "1.234,56" ergab 123 Cent. Der Quelltext der vier `alsCents` ergab bei "12.50" 125000, `parseEuro("1.234,56")` ergab 123 | behoben: ein gemeinsamer Parser. Ist Komma und Punkt da, ist das letzte das Dezimalzeichen. Ein einzelner Punkt vor drei Ziffern ist ein Tausenderpunkt. Ganzzahlig, Unlesbares ergibt NaN. Angebote behält das Vorzeichen (Rabatte). Danach gemessen: 16 Fälle richtig. Kostenstand über die Oberfläche "1.234,56" ergibt 123456, "12.50" ergibt 1250, "abc" meldet "Betrag nicht lesbar" und speichert nichts. Offene Posten und die vier `alsCents` sind jetzt dünne Hüllen um den gemessenen Parser, über ihre eigene Oberfläche nicht gemessen |
| 193 | `client/src/pages/Kostenstand.tsx` | Klein | Bei Lesezugriff waren nur die Eingabefelder gesperrt. Löschen, "Ändern" und "Abschalten" der Warnschwelle sowie Hinzufügen standen offen und scheiterten erst am Server. | ja, Lese-Konto | behoben: nur mit Schreibrecht sichtbar bzw. aktiv. Danach gemessen mit einem Lese-Konto: kein offener Knopf, kein offenes Feld |
| 194 | `client/src/pages/DatenschutzWerkzeuge.tsx` | Fehler, Datenschutz | Nach "Personenbezug entfernen" (Art. 17 DSGVO) wurden nur Stab, Besetzung und Komparserie neu geladen. Verträge, Dispo, Timesheets und Catering zeigten den gelöschten Namen weiter aus dem Cache, bis zu 30 Sekunden lang. Außerdem gab der JSON-Download der Auskunft die Datei-Adresse sofort frei. Das kann in manchen Browsern den Download abbrechen; `lib/useDownload.ts` wartet deshalb 60 s. | ja: Server "Ton (entfernt)", Vertragsseite zeigte "Mara Messperson" | behoben: nach dem Entfernen alle Abfragen erneuert, Download-Adresse erst nach 60 s freigegeben. Danach gemessen: Die Person stand vorher auf der Vertragsseite, nach dem Entfernen sofort "Kamera (entfernt)". Ein erster Nachmessversuch zählte nicht: Die Seite hatte die Person vorher gar nicht geladen |
| 195 | `client/src/pages/ZeitAnalyse.tsx` | Fehler | Die Differenz Plan/Ist rechnete "Ist der gedrehten Szenen minus Plan aller Szenen". Mitten im Dreh sah das wie eine große Ersparnis aus. Ohne eine einzige gedrehte Szene stand im Demo-Projekt "Differenz -12 Std." in Grün. | ja: Demo 0 von 8 Szenen gedreht, Karte "-12 Std."; Prüfprojekt mit einer Szene 75 statt 60 Min., alte Formel -195 Min. | behoben: Differenz nur über abgedrehte Szenen, ohne solche ein Strich, Hinweis "nur abgedrehte Szenen". Danach gemessen: Prüfprojekt Karte und Fußzeile "+15 Min.", Demo-Projekt "-" |
| 196 | `client/src/pages/VFX.tsx` | Klein | Die Deadline stand roh als "2026-11-24" in der Liste. Im Formular hatten fünf Felder nur einen Platzhalter, der beim Tippen verschwindet, Typ-Auswahl und Datumsfeld gar keinen Namen. | ja: Liste und Formular | behoben: Deadline über `formatDate`, alle Felder mit Namen. Danach gemessen: "24.11.2026", "08.12.2026", 9 von 9 Feldern benannt |
| 197 | `client/src/pages/Musikliste.tsx` | Klein | Die Dauer "1:02:30" wurde als 1 Sekunde gelesen, nur "m:ss" ging. Für die GEMA-Meldung zählt die Dauer. Im Formular hatten sieben Felder nur einen Platzhalter, die Lizenzart-Auswahl gar keinen Namen. | aus dem Code (`parseInt("1:02:30")` ist 1) | behoben: "h:mm:ss", "m:ss" und reine Sekunden, alle Felder benannt. Danach gemessen: 3:30 ergibt 210, 1:02:30 ergibt 3750, 45 ergibt 45, leer ergibt 0; 9 von 9 Feldern benannt |
| 198 | `client/src/pages/Stabliste.tsx`, `client/src/lib/i18n.ts` | Fehler | Die Stabliste zeigte nur Abteilungen aus ihrer festen Liste. Wer über das Firmen-Adressbuch übernommen wurde (`routes/companies.ts`, Abteilung ist dort Freitext), etwa mit "Grip", war unsichtbar. Er zählte oben mit, ließ sich aber weder sehen noch bearbeiten noch löschen. Dazu feste deutsche Reste: Bildschirmleser-Namen, "Alle", "Einklappen", "Neues Mitglied", CSV-Kopf, Abteilungsnamen. | ja: Prüfprojekt "2 Mitarbeiter", sichtbar nur 1 ("Grip" fehlte) | behoben: Bekannte Abteilungen in fester Reihenfolge, danach jede andere. Abteilungen übersetzt angezeigt (gespeichert bleibt deutsch), alle Texte in drei Sprachen. Danach gemessen: beide sichtbar, "Grip" als eigene Gruppe mit Löschknopf. Englisch "Camera", "Position of Klara Kamera", kein deutsches Wort |
| 199 | `client/src/pages/CheckinBoard.tsx` | Fehler | Die Check-in-Tafel nannte einen Gastlink `/guest/checkin/{Drehtag}`, den es nicht gibt (seit Fund 79 im Merkzettel). Ein Fehltipp auf "Einchecken" ließ sich nicht zurücknehmen, obwohl der Server `checked_in: false` kennt. Leser sahen "Einchecken" und bekamen 403. Geprüft und in Ordnung: Tagesdispo und Tafel teilen den Schlüssel `['call-sheet', Tag]` mit demselben Endpunkt. | ja: Hinweis im Browser; "Zurücknehmen" gab es nicht | behoben: Hinweis entfernt, "Zurücknehmen" bei eingecheckten Personen, Knöpfe nur mit Schreibrecht. Danach gemessen: Einchecken setzt den Server auf eingecheckt, Zurücknehmen wieder zurück, der Knopf "Einchecken" ist wieder da. Ein Lese-Konto sieht die Person ohne Knopf |
| 200 | `client/src/pages/Terminkalender.tsx` | Fehler | Ein Termin mit "Datum bis" stand nur an seinem ersten Tag: eine Reise vom 10. bis 12.11. fehlte am 11. und 12. Der Dialog "Termin hinzufügen" übernahm den gewählten Tag nicht. Er bleibt eingehängt, und der Startwert von `useState` galt nur beim ersten Mal. Die Tage ließen sich nur mit der Maus wählen. Anlegen und Löschen standen auch Lesern offen. | ja: Reise nur am 10. sichtbar; nach Wahl des 20. stand im Dialog ein leeres Datum | behoben: Termine an jedem Tag ihres Zeitraums, Dialog setzt beim Öffnen den gewählten Tag, Tage per Tastatur wählbar (Enter/Leertaste, mit Namen), Anlegen und Löschen nur mit Schreibrecht. Danach gemessen: Reise am 10., 11. und 12., nicht am 9. und 13. Enter auf dem 20. wählt ihn, der Dialog zeigt "2026-11-20". Die Lese-Sperre nicht gesondert gemessen |
| 201 | `client/src/pages/Tagesbericht.tsx` | **Fehler, Datenverlust** | Das verzögerte Speichern (700 ms) las den Drehtag erst beim Auslösen. Wer tippte und gleich zum nächsten Tag blätterte, schrieb den Bericht in den nächsten Tag, und der eigene Tag verlor die Eingabe. Eine zweite Eingabe innerhalb von 700 ms verdrängte die gemessenen Szenenminuten aus dem Auftrag: Das Feld zeigte 75, gespeichert wurde nichts. Jedes Neuladen (nach dem Speichern, beim Zurückkehren ins Fenster) setzte das Formular auf den Serverstand zurück. Drehplan und Zeitanalyse wurden nach dem Speichern nicht erneuert. | ja: Tag 2 bekam "Zweite Notiz von Tag 1", Tag 1 behielt die alte; Minutenfeld 75, Server leer | behoben: Jeder Speicherauftrag trägt seinen Drehtag. Beim Blättern und Verlassen wird sofort gespeichert. Ausstehende Teile (Minuten) bleiben im Auftrag. Das Formular wird nur beim ersten Laden eines Tages übernommen, danach `shoot-days` und `time-analysis` erneuert. Danach gemessen: Tag 1 "Neu Tag 1", Tag 2 unverändert. Minuten 80 mit schneller Notiz danach: beides gespeichert. Weitertippen während des Neuladens: Feld und Server "Drehbericht ABC". Den dritten Fall habe ich am alten Stand nicht gemessen |
| 202 | `client/src/pages/Tagesbericht.tsx`, `client/src/pages/Dateien.tsx` | Klein | Bei Lesezugriff war der Tagesbericht voll bearbeitbar, jede Eingabe löste einen Speicherversuch aus, der am Server scheiterte. In der Dateiablage standen Hochladen, Ändern und Löschen offen. | ja, Lese-Konto: im Tagesbericht 15 offene Felder und Knöpfe | behoben: Tagesbericht-Felder in einem gesperrten `fieldset`, Speichern-Knopf nur mit Schreibrecht; Dateien ohne Hochladen, Ändern, Löschen. Danach gemessen mit einem Lese-Konto: Tagesbericht nur noch Blättern und PDF. Dateien: ansehen und herunterladen, sonst nichts |
| 203 | `client/src/pages/ProjectList.tsx`, `client/src/lib/i18n.ts` | Fehler | Demo-Projekte trugen eine zweite "Demo"-Plakette als eigenes Rasterelement. Bei Desktop-Breite stand "Demo" in der Datumsspalte, das Datum in der 20-px-Pfeilspalte, der Pfeil rutschte in eine neue Zeile. Dazu rund 30 feste deutsche Texte (Dialog, Meldungen, Kopf, Leerseite, Zähler, Bildschirmleser-Namen), Status und Format unübersetzt. | ja: bei 1280 px Datum x=902 (Pfeilspalte), Pfeil y=71 | behoben: zweite Plakette entfernt, alle Texte in `projectsT`, Status-Übersetzung `projectsT.status` (auch für Stammdaten nutzbar), Format über `onboardingFormatT`. Danach gemessen: Datum x=766, Pfeil x=902 in derselben Zeile. Englisch "Productions", "Short film · Drama · 15 min · Director: …", "Pre-production", "78 projects" |
| 204 | `client/src/pages/SzenenKommentare.tsx`, `server/src/routes/sceneComments.ts` | Fehler, Leistung | Die Zähler der offenen Kommentare holten jede Szene einzeln. Bei einem Projekt mit 160 Szenen waren das 160 Anfragen und 2,7 s lokal, bei 1200 erlaubten Anfragen pro Minute und Nutzer. Ein gelöster Kommentar ließ sich nicht wieder öffnen, obwohl der Server umschaltet. Die Seite hatte eine eigene Kopie von `req` (Muster aus Fund 145) statt `api.sceneComments`. | ja: 160 Anfragen auf `.../comments`, 2732 ms | behoben: `GET /projects/:id/scene-comments/open` zählt in einer Abfrage, nur Mitglieder (Test: 2 offene, gelöste nicht gezählt, Fremde 403). Seite über `api`, "Wieder öffnen" bei gelösten Kommentaren. Danach gemessen: 1 Anfrage, Summe weiter 57 über 50 Szenen. Lösen ergibt 56, Wiederöffnen 57 |
| 205 | `client/src/pages/DOOD.tsx` | Klein | Die feste Namensspalte hatte `bg-inherit` auf durchsichtigen Zeilen. Beim Waagerecht-Scrollen lagen die Tageszellen ("SW", "W") über den Namen, auch der Spaltenkopf schien durch. Der CSV-Export schrieb Kosten als "1.234,00 €" statt im CSV-Format aus Fund 180. In der Summenzeile fehlten die Haltetage. | ja: Hintergrund `rgba(0,0,0,0)` bzw. 10 %; Bildausschnitt mit "SW" über "Katharina Brodersen" | behoben: deckender Hintergrund im Farbton der Zeile, CSV über `betragCsv`, Summe der Haltetage. Danach gemessen: Bildausschnitt ohne Überlagerung, CSV-Zeile endet mit "292500,00", Fußzeile 289 Arbeitstage / 817 Haltetage |
| 206 | `client/src/pages/Postplan.tsx` | Fehler | Die Dauer zählte den Endtag nicht mit: Rohschnitt vom 2. bis 22.11. stand mit 20 Tagen da (es sind 21), ein eintägiger Schritt mit 0, die Gesamtdauer einen Tag zu kurz. Die Balken endeten einen Tag zu früh. Daten standen roh als "2026-11-02". "Bearbeiten", "Abbrechen" (✎/✕) und drei Felder hatten keinen Namen. | ja: Demo "20 Tage", "7 Tage", "Gesamtdauer: 38 Tage", "Von: 2026-11-02" | behoben: Dauer einschließlich Endtag (auch Balken und Skala), Datum über `formatDate`, Namen für Knöpfe und Felder. Danach gemessen: 21 Tage, 8 Tage, Gesamtdauer 39, "Von: 02.11.2026", letzter Balken endet bei 100 % |
| 207 | `client/src/pages/Shotlist.tsx` | Fehler | Neue und duplizierte Einstellungen bekamen "Anzahl plus eins" als Nummer. Nach dem Löschen von Nr. 2 aus 1, 2, 3 entstand eine zweite Nr. 3, im Drehtag-PDF zwei gleiche Einstellungen. Bei Lesezugriff war jede Einstellung bearbeitbar, die Eingaben scheiterten erst am Server. Eine Drehtage-Abfrage und zwei Importe waren ungenutzt. Der Erledigt-Knopf hatte keinen Namen. | ja: Prüfprojekt 1, 2, 3, Nr. 2 gelöscht, neu ergab 1, 3, 3 | behoben: höchste Nummer plus eins, Einstellungen in einem gesperrten `fieldset`, Hinzufügen nur mit Schreibrecht, tote Abfrage entfernt, Erledigt-Knopf mit Name und `aria-pressed`. Danach gemessen: neu ergibt 4, Duplizieren 5. Ein Lese-Konto sieht nur noch die PDFs und das Aufklappen |
| 208 | `client/src/pages/Besetzung.tsx`, `client/src/lib/i18n.ts` | Klein | Aufgeklappte Figuren- und Darstellerkarten waren auch für Leser bearbeitbar, die Eingaben scheiterten erst am Server. Die Kopfzeilen der Karten ließen sich nur mit der Maus aufklappen. Rund zwölf feste deutsche Reste: "(Kein Name)", "als …", "Rolle wählen", "z.B. 25-35", Löschknöpfe ohne Bezug ("Eintrag löschen"), CSV-Kopf, Namen neuer Einträge. | ja: Lese-Konto, Tastatur | behoben: Felder in gesperrtem `fieldset`, Kopfzeilen per Enter und Leertaste (`aria-expanded`), Löschknöpfe mit Namen der Figur oder Person, alle Texte in `castT`. Danach gemessen: Enter klappt die Karte auf. Ein Lese-Konto sieht in der aufgeklappten Karte kein offenes Feld, nur CSV, PDF und Reiter |
| 209 | `client/src/pages/Versicherungen.tsx` | Fehler | Eine Police mit Ende heute stand schon als "Abgelaufen" da, mit rotem Hinweis oben. `new Date("2026-10-31")` ist 1 Uhr nachts dieses Tages, die Police gilt aber bis Tagesende. Die Laufzeit stand roh als "2026-01-01 - 2026-10-31". Die Betragsfelder waren Zahlenfelder (Wert "1200"), passend zum gemeinsamen Parser aus Fund 192 gehört dort Text in deutscher Schreibweise hin. | ja: Testpolice Ende heute um 23:40, Karte "Abgelaufen" | behoben: gültig bis Ende des letzten Tages, Laufzeit über `formatDate`, Betragsfelder als Text ("1200,00"). Danach gemessen: "Läuft bald ab", "01.01.2026 - 31.10.2026". Eingabe "1.500.000" ergibt 1.500.000,00 €, "1.234,56" ergibt 1.234,56 € |
| 210 | `client/src/pages/Drehplan.tsx`, `client/src/components/drehplan/ShootDayColumn.tsx` | Fehler | Ein Sperrtag mit Szenen versteckte sie: nicht in der Spalte, nicht in der Ablage, aber als "geplant" gezählt (seit dem Lesen der Spalte im Merkzettel). Ein Drehtag ließ sich mit einem Klick hart löschen, samt Dispo, Tagesbericht und Check-ins (Kaskade). Leser und Abteilungsleitung sahen Versionen und KI-Optimierung, Leser auch Ziehen, Anlegen, Löschen und Statuswechsel, alles scheiterte erst am Server. | ja: Prüfprojekt, Szene 7 auf Sperrtag unsichtbar, "1 von 1 Szenen geplant" | behoben: Ein Sperrtag zeigt seine Szenen mit "Sperrtag - diese Szenen umplanen", leer bleibt er gesperrt. Ablegen auf Sperrtagen wird abgewiesen. Rückfrage vor dem Löschen eines Drehtags und vor dem Wiederherstellen. Ziehen, Anlegen, Löschen, Status ab Abteilungsleitung, Versionen und KI ab Produktion. Danach gemessen: Spalte zeigt "Sperrtag - diese Szenen umplanen 7 Sperrprobe". Löschen fragt "Drehtag 1 löschen? Seine Dispo, …", Abbrechen lässt den Tag stehen. Das Abweisen beim Ziehen nicht gemessen (Ziehen nicht nachgestellt) |
| 211 | `server/src/routes/drehplan.ts` (`POST .../drehplan/restore/:versionId`) | **Fehler, Datenverlust** | Eine Drehplan-Version wiederherstellen löschte alle aktuellen Zuordnungen ohne Sicherung, der Klick war nicht rückgängig zu machen. Mit den Zuordnungen gingen die im Tagesbericht gemessenen Minuten verloren (`actual_minutes` hängt an `shoot_day_scenes`). | ja: Test, gemessene 75 Minuten waren nach dem Zurückholen `null` | behoben: Vor dem Zurückholen wird der aktuelle Plan als Version gesichert ("Vor Wiederherstellung von …"). Gemessene Minuten bleiben, wo Tag und Szene wieder zusammenkommen. Danach gemessen: Test grün (75 Minuten erhalten, zweite Version vorhanden, beide Szenen zurück) |
| 212 | `server/src/routes/aiScheduling.ts`, `server/src/routes/drehplan.ts` | **Fehler, Datenverlust** | Die KI-Optimierung sicherte den Plan vorher als `{ shoot_days, scenes }`. Das Wiederherstellen erwartete eine Liste von Tagen und brach mit 500 ab. Weil der Fehler erst nach dem Löschen aller Zuordnungen kam, stand danach ein leerer Drehplan da. Die versprochene "Sicherung vorher" ließ sich nie zurückholen. | ja: Test mit einer Sicherung im alten Format, 500 | behoben: KI sichert über `ladeDrehtageMitSzenen` im selben Format wie "Version speichern". Wiederherstellen liest auch das alte Format und läuft als Transaktion: alles oder nichts, `ON CONFLICT DO NOTHING` statt abgefangener Fehler. Danach gemessen: Test grün, Szene wieder an Tag 1; Fund-211-Test weiter grün |
| 213 | `client/src/pages/Setplan.tsx` | Fehler | Neue Symbole wurden nach Anzahl beschriftet. Nach dem Löschen von Kamera B aus A, B, C hieß die neue wieder C (wie Fund 207). Die Schieberegler für Blickrichtung und Größe sendeten jeden Schritt als eigene Anfrage samt Neuladen: zehn Schritte, zehn Anfragen, ein Zug über die Blickrichtung leicht dreihundert. Leser sahen Palette, Neuer Plan, Hochladen und Löschen, konnten Symbole ziehen und Felder bearbeiten. | ja: A, B, C, B gelöscht, neu ergab A, C, C; 10 Schritte = 10 Anfragen | behoben: Kameras bekommen den ersten freien Buchstaben, andere die höchste Zahl plus eins. Regler speichern beim Loslassen (Maus, Tastatur, Fokuswechsel), die Anzeige folgt live. Leser sehen den Plan ohne Bearbeitung. Danach gemessen: neue Kamera "B". 10 Schritte: 0 Anfragen während, 1 beim Loslassen, gespeichert 100°. Die Lese-Sperre nicht gesondert gemessen |
| 214 | `client/src/pages/EquipmentKalender.tsx` | Fehler | Die Doppelbuchungs-Anzeige las die Server-Antwort falsch. Der Server meldet Paare `{ booking_a, booking_b }`, die Seite erwartete einzelne Buchungen. Text: "Equipment #undefined: Überlappung undefined - undefined". Die rote Markierung im Raster, das Warnsymbol und die Plakette "Konflikt" erschienen nie. Dazu: Namensspalte durchscheinend wie Fund 205 (Merkzettel), Daten roh, Buchungen ohne Rückfrage gelöscht, der Löschknopf der Übersicht ohne Namen. "Ende vor Beginn" wurde angenommen, Leser sahen alle Knöpfe. | ja: Prüfprojekt mit zwei überlappenden Buchungen | behoben: Überlappung je Paar berechnet. Deckender Hintergrund der Namensspalte, `formatDate`, Rückfrage mit Gerät und Zeitraum, Namen für alle Löschknöpfe, Hinweis und Sperre bei Ende vor Beginn, Anlegen und Löschen nur mit Schreibrecht. Danach gemessen: "Alexa Mini: Überlappung 10.11.2026 - 12.11.2026", 7 rote Wochenzellen, Warnsymbol, Plaketten. Rückfrage "Buchung von Alexa Mini (02.11.2026 - 20.12.2026) löschen?", 0 Knöpfe ohne Namen, Hinweis "Das Ende liegt vor dem Beginn". Die Knopfsperre dabei nicht gemessen |
| 215 | `client/src/pages/SperrtageKalender.tsx` | Fehler | Die Konfliktmeldung las die Server-Antwort falsch (wie Fund 214). Der Server liefert `{ shoot_day, cast_name, blackout }`, angezeigt wurde "Greta Gans: Drehtag  kollidiert mit Sperrtag ( - )", also ohne Drehtag und ohne Zeitraum. Dazu: Namensspalte durchscheinend (Merkzettel), Daten roh, Sperrtage ohne Rückfrage gelöscht, "Ende vor Beginn" angenommen, Leser sahen alle Knöpfe. | ja: Prüfprojekt mit Darstellerin, Szene am Drehtag 11.11. und Sperrtag 10.-12.11. | behoben: Konflikt aus `shoot_day` und `blackout` gelesen. Deckender Hintergrund, `formatDate`, Rückfrage mit Name und Zeitraum, Namen für die Löschknöpfe, Hinweis und Sperre bei Ende vor Beginn, Knöpfe nur mit Schreibrecht. Die Seite bleibt bis zu Florians Entscheidung deutsch. Danach gemessen: "Greta Gans: Drehtag 1 (11.11.2026) kollidiert mit Sperrtag (10.11.2026 - 12.11.2026)", Rückfrage "Sperrtag von Greta Gans (10.11.2026 - 12.11.2026) löschen?", Übersicht "10.11.2026 - 12.11.2026" |
| 216 | `client/src/pages/Dashboard.tsx`, `client/src/lib/i18n.ts` | Klein | Das Dashboard, die Startseite jedes Projekts, hatte rund 27 feste deutsche Texte: Gruß, "x von y", Creator-Kennzahlen, "Stand heute", "Details anzeigen", Schnellzugriff samt Bildschirmleser-Namen. Status und Format standen deutsch, Zahlen fest mit "de-DE". Geprüft und in Ordnung: Die Kürzel am Schnellzugriff (D, T, S, B, M, G) stimmen mit `App.tsx` überein. | ja: Textprüfung, Merkzettel | behoben: alle Texte in `dashT`, Status über `projectsT.status`, Format über `onboardingFormatT`, Zahlen im Gebietsschema. Danach gemessen: Englisch "Good night, Test · Pre-production · Short film · Drama · 15 min … 8 of 8 … €18,742.50" ohne deutsches Wort |
| 217 | `client/src/pages/SetApp.tsx` | Fehler | Der Hell/Dunkel-Knopf der Set-App hatte einen eigenen Zustand an der gespeicherten Einstellung vorbei. Am Set auf hell umgestellt, nach dem Neuladen wieder dunkel. Der Knopf hatte keinen Namen. Ein Kommentar versprach "Auto-select today's shoot day", gebaut war nur die Markierung "Heute". Wer die Set-App öffnete, musste den Drehtag selbst suchen. | ja: Knopf schaltete die Anzeige auf hell, gespeichert blieb dunkel | behoben: Knopf über `toggleDarkMode` der App (gespeichert) mit Namen. Ist kein gültiger Tag gewählt, wird der heutige Drehtag gewählt. Danach gemessen: Projekt gewählt, Drehtag-Feld "● Heute - So., 1. Nov.". Umschalten ergibt Anzeige hell und gespeichert hell |
| 218 | `client/src/pages/Auswertungen.tsx` | Fehler | Jede Änderung des Zeitraums (und des KSK-Jahres) ergab einen neuen Abfrageschlüssel. `isLoading` wurde wahr, und "Lade…" ersetzte die ganze Karte samt Datumsfeldern. Das Feld unter dem Cursor verschwand, der Fokus fiel auf den Seitenkörper. Die drei KSK-Knöpfe zeigten ihre Wahl nur über die Farbe. | ja: Datum per Ereignis geändert, Feld weg, neues Element, Fokus BODY. Echte Tastenanschläge erreichten das Datumsfeld im Vorschaufenster nicht, der Messaufbau dafür taugte nicht | behoben: `placeholderData: keepPreviousData` für beide Abfragen, `aria-pressed` an den KSK-Knöpfen. Die Seite bleibt bis zu Florians Entscheidung deutsch. Danach gemessen: kein "Lade…", dasselbe Feld-Element, Fokus bleibt im Feld |
| 219 | `client/src/pages/CateringListe.tsx` | Klein | Neben der Tagesliste stand ein dauerhaft gesperrter Knopf "PDF exportieren". Einen PDF-Weg für Catering gibt es nicht, der Knopf versprach etwas, das nie ging. Auswahl und Felder der Präferenzen hatten nur Platzhalter, keinen Namen mit Person. Bei Lesezugriff waren sie bearbeitbar. | ja: Knopf `disabled` fest im Code, kein Server-Weg | behoben: Ausfuhr der Tagesliste als CSV (Name, Typ, Diät, Allergien, Notizen) über `csvHerunterladen`, nur bei Personen am Tag aktiv. Felder benannt ("Diät von Felix Wagner"), bei Lesezugriff gesperrt. Danach gemessen: Tag 1 ergibt "Name;Typ;Diät;Allergien;Notizen", "Felix Wagner;Darsteller;;;". Tag 3 ohne Personen, Knopf gesperrt |

### Verknüpfungen

Florians Maßstab (siehe "Hier weitermachen"): Bei jeder Sache prüfen, ob sie
automatisch in andere Sachen gehört. Gebaut steht mit Fundnummer im Fundbuch,
Kandidaten stehen hier, bis sie gebaut oder verworfen sind.

| Von | Nach | Stand |
|---|---|---|
| Figur im Drehbuch | Rolle, Szene, Besetzung, Dispo | gebaut, Fund 115 |
| Gewählte Sprache | Datum, Beträge, Speicher-Quittung, Fehlermeldungen der gemeinsamen Bausteine | gebaut, Funde 146 und 148 |
| Suche nach Figur oder Darstellerin | Figur, Besetzung, Szenen, Drehtage der Figur | gebaut, Fund 156 |
| Projekttitel und andere Projektangaben | Kopfleiste, Seitenleiste, Dashboard sofort nach dem Speichern | gebaut, Fund 160 |
| Nächster Drehtag (Kopfleiste) | Tagesdispo genau dieses Tages | gebaut, Fund 161 |
| Format im Einrichtungsassistenten | Projektart Film oder Creator (Seitenleiste, Bereiche) | gebaut, Fund 166 |
| YouTube-Abgleich | alle Creator-Seiten (Performance, Haltekurven, Einzelvideo) | gebaut, Fund 165 |
| Suchtreffer Szene | die Szene selbst im Drehbuch | Kandidat: Treffer führen zur Szenenübersicht, die Seite kennt kein Sprungziel für eine Szene |
| Rollen der Szene | Spalte "Cast" der Dispo, Rollennummer | gebaut, Fund 116 |
| Komparse ↔ Drehtag | Dispo, PDF, Vertrag, Jugendschutz, Verpflegung, Check-in | gebaut, Fund 119 |
| Spielort der Szenenüberschrift | Motiv der Szene | gebaut, Fund 120 |
| Szenen des Drehtags → Rollen → Besetzung | Darsteller der Dispo | gebaut, Fund 121 (auch nachträglich: Szene in den Tag, Rolle an die Szene, Darsteller an die Rolle) |
| Motive der Szenen des Tages | Drehort der Dispo | gebaut, Fund 121 |
| Drehtage einer Person | "Drehorte" im Vertrag | gebaut, Fund 122 |
| Papierkorb: Person zurückholen | ihre Dispo-Einträge, Zeiten, Verpflegung | Kandidat: ohne Fremdschlüssel kommen sie nicht mit zurück (gilt für Stab, Besetzung, Komparsen) |
| Rollen der Szene | Beschriftung der Darsteller-Symbole im Set-Plan | Kandidat: ein neues Darsteller-Symbol heißt "1", "2" … (`nextLabel` in `lib/floorplan.ts`), obwohl der Plan seine Szene und damit deren Rollen kennt |
| Komparsen-Drehtage | Kalkulation (Gagen) | Kandidat: Besetzung und Stab kommen mit Gage × Drehtage in die Kalkulation (`lib/kostenquellen.ts`), Komparsen nicht - sie haben Drehtage (Fund 119), aber keinen Tagessatz, nur eine Tarifgruppe. Braucht einen Satz je Tarifgruppe oder je Komparse |
| Feiertage (`server/src/services/holidays.ts`) | Drehplan und Konfliktradar (Drehtag am Feiertag), Timesheets (Feiertagszuschlag) | Kandidat: Die Feiertage gibt es nur als API (`GET /projects/:id/holidays`), die Oberfläche ruft sie nie ab. Die Liste ist für NRW vollständig; es fehlen 6.1. (BW, BY, ST), 8.3. (BE, MV), 15.8. (SL), 20.9. (TH) und Buß- und Bettag (SN) |
| Fahrer eines Fahrzeugs | Stab (Person mit Telefon), Drehtage der Dispo | Kandidat: Fahrer ist Freitext, Fahrzeuge hängen an keinem Drehtag (`vehicleT.labelDay` gibt es, die Seite nutzt es nicht) |
| Stab, Besetzung, Komparsen, Motiv-Kontakte | eine Kontaktliste, CSV und vCard | gebaut, Fund 179 |
| Video anlegen, umwandeln, Status, Löschen | Redaktionsplan, Kanal, Serien, Performance, Sponsoren, Rechte | gebaut, Fund 182 |
| Dispo-Eintrag einer Person mit Konto | Zugang zum Projekt (Lesezugriff) | gebaut, Fund 185 |
| Termin vom Typ "Sperrtag" im Kalender | Sperrtage-Kalender und Konfliktradar | Kandidat: Der Kalender kennt den Termintyp "Sperrtag", die Sperrtage (`blackout_dates`) sind eine eigene Tabelle. Ein im Kalender eingetragener Sperrtag warnt den Drehplan nicht |
| Tagesbericht (Szenenstand, Minuten) | Drehplan, Zeitanalyse sofort | gebaut, Fund 201 |
| VFX-Shots (Status, Deadlines) | Postplan-Phase "VFX-Abnahme" | Kandidat: Der Postplan kennt die Phase, die VFX-Liste ihre Shots mit Deadline und Status - Fortschritt und spätestes Datum könnten die Phase füllen |

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
- [x] `server/src/routes/dateien.ts` (236) - Funde 64, 113
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
- [x] `server/src/routes/scenes.ts` (277) - Funde 99, 120
- [x] `server/src/routes/screenplay.ts` (512) - Fund 100
- [x] `server/src/routes/scriptSides.ts` (149) - Fund 101
- [x] `server/src/routes/search.ts` (110) - Fund 102
- [x] `server/src/routes/shots.ts` (100) - Funde 76, 103
- [x] `server/src/routes/stickyNotes.ts` (92) - Fund 104
- [x] `server/src/routes/sun.ts` (69) - Fund 105
- [x] `server/src/routes/tabellen.ts` (286) - Fund 110
- [x] `server/src/routes/tasks.ts` (67) - ohne Fund
- [x] `server/src/routes/timesheets.ts` (193) - Fund 108
- [x] `server/src/routes/vehicles.ts` (117) - Fund 106
- [x] `server/src/routes/vertraege.ts` (781) - Fund 111
- [x] `server/src/routes/vfx.ts` (149) - Fund 107
- [x] `server/src/routes/youtube.ts` (445) - Fund 112

### Server: Bibliotheken

- [ ] `server/src/lib/benachrichtigungen.ts` (207) - ausgenommen: unversioniert, bleibt unangetastet (Vorgabe von Florian)
- [x] `server/src/lib/buchhaltung.ts` (238) - Fund 114
- [x] `server/src/lib/callSheetLayout.ts` (429) - Fund 116
- [x] `server/src/lib/creatorAreas.ts` (363) - ohne Fund
- [x] `server/src/lib/creatorInsights.ts` (256) - Fund 117
- [x] `server/src/lib/figuren.ts` (neu) - Fund 115
- [x] `server/src/lib/motive.ts` (neu) - Fund 120
- [x] `server/src/lib/dispo.ts` (neu) - Fund 121
- [x] `server/src/lib/creatorScript.ts` (437) - ohne Fund (zwei Kommentare mit Umlauten)
- [x] `server/src/lib/dateien.ts` (165) - ohne Fund
- [x] `server/src/lib/dateiname.ts` (19) - Fund 124
- [x] `server/src/lib/datenschutz.ts` (218) - Funde 119, 123
- [x] `server/src/lib/datum.ts` (15) - ohne Fund
- [x] `server/src/lib/documentLayout.ts` (391) - ohne Fund (Kommentare mit Umlauten)
- [x] `server/src/lib/drehzeit.ts` (84) - ohne Fund
- [x] `server/src/lib/floorplan.ts` (231) - ohne Fund (Kommentare mit Umlauten)
- [x] `server/src/lib/fountainExport.ts` (52) - Fund 125
- [x] `server/src/lib/jugendschutz.ts` (240) - Fund 109
- [x] `server/src/lib/kostenquellen.ts` (197) - ohne Fund (Kommentare mit Umlauten)
- [x] `server/src/lib/ksk.ts` (204) - Fund 126
- [x] `server/src/lib/mahnungLayout.ts` (201) - Fund 127
- [x] `server/src/lib/mahnwesen.ts` (287) - ohne Fund (Rechtsfrage im Merkzettel)
- [x] `server/src/lib/mailaufbewahrung.ts` (32) - ohne Fund (Rechtsfrage im Merkzettel)
- [x] `server/src/lib/mailversand.ts` (291) - Fund 128
- [x] `server/src/lib/mailvorlagen.ts` (187) - Fund 129
- [x] `server/src/lib/meldungenText.ts` (260) - Fund 130
- [x] `server/src/lib/papierkorb.ts` (140) - Fund 91
- [x] `server/src/lib/passwort.ts` (83) - ohne Fund
- [x] `server/src/lib/pdfFonts.ts` (62) - Fund 131
- [x] `server/src/lib/person.ts` (20) - Fund 119
- [x] `server/src/lib/rechnung.ts` (140) - ohne Fund (Rundung der Darstellung: Fund 132)
- [x] `server/src/lib/rechnungLayout.ts` (291) - ohne Fund (gemessen: Anschrift stabil bei 55 mm); Fund 132
- [x] `server/src/lib/screenplayFormat.ts` (675) - Fund 133 (früher schon Fund 100)
- [x] `server/src/lib/shotlist.ts` (324) - ohne Fund (Drehtag kommt schon aus dem Drehplan der Szene; Kommentare mit Umlauten)
- [x] `server/src/lib/spesen.ts` (184) - ohne Fund
- [x] `server/src/lib/szenenUeberschrift.ts` (143) - ohne Fund
- [x] `server/src/lib/tabelle.ts` (195) - Funde 134, 135
- [x] `server/src/lib/ueberlast.ts` (60) - ohne Fund (Kopfkommentar richtiggestellt)
- [x] `server/src/lib/vertraege.ts` (293) - Fund 137
- [x] `server/src/lib/videoMatching.ts` (220) - ohne Fund (Kommentare mit Umlauten)
- [x] `server/src/lib/wiederherstellung.ts` (296) - Fund 136 (früher angefasst: 46, 70)
- [x] `server/src/lib/youtubeInsights.ts` (270) - Fund 138
- [x] `server/src/lib/youtubeOAuth.ts` (456) - ohne Fund (Kommentare mit Umlauten)
- [x] `server/src/lib/zahlungen.ts` (30) - ohne Fund
- [x] `server/src/lib/zweiterFaktor.ts` (153) - Fund 139

### Server: Skripte

- [x] `server/src/scripts/lasttestDaten.ts` (32) - ohne Fund
- [x] `server/src/scripts/pdfprobe.ts` (165) - ohne Fund - am 26.10.2026 gelaufen: alle 14 Dokumente gültig
- [x] `server/src/scripts/seedGrossproduktion.ts` (27) - ohne Fund
- [x] `server/src/scripts/zugriffsscan.ts` (460) - ohne Fund; am 26.10.2026 gelaufen: 0 Verdachtsfälle (Merkzettel)

### Server: Rest

- [x] `server/src/index.ts` (472) - Fund 140

### Client: Bibliotheken

- [x] `client/src/lib/analytics.ts` (27) - Fund 142
- [x] `client/src/lib/api.ts` (1184) - gelesen (Fund 145)
- [x] `client/src/lib/belohnung.ts` (183) - gelesen (Fund 146)
- [x] `client/src/lib/beschriftungen.ts` (130) - gelesen (ohne Befund, Kommentar-Umlaut)
- [x] `client/src/lib/i18n.ts` (629) - gelesen (Funde 146-149)
- [x] `client/src/lib/motion.ts` (68) - gelesen (ohne Befund)
- [x] `client/src/lib/projectKind.ts` (36) - gelesen (ohne Befund, Liste gleich wie `server/src/routes/projects.ts`)
- [x] `client/src/lib/spracheSenden.ts` (20) - gelesen (ohne Befund)
- [x] `client/src/lib/texte/AbnahmeAnsicht.ts` (32) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/Abschluss.ts` (30) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/ActivityFeed.ts` (27) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/Agenturen.ts` (129) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/Angebote.ts` (117) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/AuditLog.ts` (39) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/Aufgaben.ts` (23) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/Auswertungen.ts` (85) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/Benutzerverwaltung.ts` (31) - entfernt (Fund 177)
- [x] `client/src/lib/texte/Buchhaltung.ts` (48) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/Budget.ts` (105) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/CastingAntwort.ts` (64) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/CateringListe.ts` (47) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/CheckinBoard.ts` (27) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/CreatorChecklisten.ts` (20) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/CreatorClips.ts` (20) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/CreatorIdeen.ts` (27) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/CreatorKanal.ts` (49) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/CreatorPerformance.ts` (28) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/CreatorRechte.ts` (40) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/CreatorRedaktionsplan.ts` (27) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/CreatorSeo.ts` (21) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/CreatorSerien.ts` (25) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/CreatorSponsoren.ts` (27) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/CreatorTitel.ts` (18) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/CreatorVideos.ts` (47) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/DOOD.ts` (30) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/Dateien.ts` (61) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/Datenschutz.ts` (104) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/DatenschutzWerkzeuge.ts` (64) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/Drehplan.ts` (43) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/EmailCenter.ts` (118) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/EquipmentKalender.ts` (48) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/ForgotPassword.ts` (29) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/Impressum.ts` (56) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/Invite.ts` (39) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/Kameraberichte.ts` (39) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/Komparsen.ts` (29) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/Konfliktradar.ts` (18) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/Kostenstand.ts` (52) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/Listen.ts` (57) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/Moodboard.ts` (38) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/Musikliste.ts` (42) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/Papierkorb.ts` (14) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/Pinboard.ts` (22) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/Postplan.ts` (44) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/ProjectTemplates.ts` (76) - entfernt (Fund 173)
- [x] `client/src/lib/texte/PublicDispo.ts` (30) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/Rechnungen.ts` (108) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/ResetPassword.ts` (16) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/SetApp.ts` (34) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/Setplan.ts` (72) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/Shotlist.ts` (66) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/StaebchenplanNew.ts` (31) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/Suche.ts` (16) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/SzenenKommentare.ts` (29) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/Tagesbericht.ts` (53) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/Terminkalender.ts` (51) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/VFX.ts` (66) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/Versicherungen.ts` (43) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/Vertraege.ts` (204) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/VertragBestaetigen.ts` (24) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/ZeitAnalyse.ts` (34) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/komponenten/AutoSaveIndicator.ts` (8) - entfernt (Fund 159)
- [x] `client/src/lib/texte/komponenten/Drehplan.ts` (37) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/komponenten/ErrorBoundary.ts` (8) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/komponenten/Layout.ts` (70) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/komponenten/OnboardingWizard.ts` (57) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/komponenten/RetentionChart.ts` (10) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/komponenten/Shared.ts` (49) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/komponenten/SkipLink.ts` (7) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/texte/komponenten/YouTubeConnection.ts` (37) - gelesen (Funde 141-144 und Prüfskript)
- [x] `client/src/lib/useDownload.ts` (82) - gelesen (Fund 149)
- [x] `client/src/lib/useSchreibrecht.ts` (28) - gelesen (ohne Befund)
- [x] `client/src/lib/useT.ts` (22) - gelesen (Fund 148)
- [x] `client/src/lib/utils.ts` (119) - gelesen (Fund 148)
- [x] `client/src/lib/version.ts` (37) - gelesen (ohne Befund)

### Client: Kontexte

- [x] `client/src/contexts/AuthContext.tsx` (122) - gelesen (Funde 150-153)
- [x] `client/src/contexts/ProjectRoleContext.tsx` (56) - gelesen (Fund 153)

### Client: Hooks

- [x] `client/src/hooks/usePushSubscription.ts` (83) - gelesen (Fund 152)

### Client: Komponenten

- [x] `client/src/components/ErrorBoundary.tsx` (41) - gelesen (ohne Befund)
- [x] `client/src/components/OnboardingWizard.tsx` (506) - gelesen (Fund 166)
- [x] `client/src/components/ProtectedRoute.tsx` (13) - gelesen (ohne Befund)
- [x] `client/src/components/SkipLink.tsx` (14) - gelesen (ohne Befund)
- [x] `client/src/components/creator/BereichLayout.tsx` (145) - gelesen (ohne Befund, Kommentar-Umlaut)
- [x] `client/src/components/creator/RetentionChart.tsx` (199) - gelesen (Fund 165)
- [x] `client/src/components/creator/YouTubeConnection.tsx` (182) - gelesen (Fund 165)
- [x] `client/src/components/drehplan/ScenePool.tsx` (83) - gelesen (ohne eigenen Befund (Farben: Fund 163))
- [x] `client/src/components/drehplan/SceneStrip.tsx` (73) - gelesen (Funde 163, 164)
- [x] `client/src/components/drehplan/ShootDayColumn.tsx` (131) - gelesen (ohne Befund; Sperrtag siehe Merkzettel)
- [x] `client/src/components/layout/PageHeader.tsx` (33) - gelesen (Fund 159, Kommentar-Umlaute)
- [x] `client/src/components/layout/Sidebar.tsx` (587) - gelesen (Funde 160, 162)
- [x] `client/src/components/layout/TopBar.tsx` (155) - gelesen (Funde 160, 161)
- [x] `client/src/components/shared/AutoSaveIndicator.tsx` (39) - entfernt (Fund 159)
- [x] `client/src/components/shared/BrandMark.tsx` (26) - gelesen (ohne Befund)
- [x] `client/src/components/shared/FeedbackWidget.tsx` (107) - gelesen (ohne Befund, Kategorien wie im Server)
- [x] `client/src/components/shared/GlobalSearch.tsx` (94) - gelesen (Funde 155, 156)
- [x] `client/src/components/shared/PDFPreviewModal.tsx` (42) - entfernt (Fund 159)
- [x] `client/src/components/shared/ShortcutsModal.tsx` (81) - gelesen (Fund 159)
- [x] `client/src/components/shared/TestversionBadge.tsx` (39) - gelesen (ohne Befund, Antwortform von /api/health gemessen)
- [x] `client/src/components/shared/TutorialModal.tsx` (135) - gelesen (Funde 158, 159)
- [x] `client/src/components/ui/accordion.tsx` (50) - gelesen (ohne Befund)
- [x] `client/src/components/ui/alert.tsx` (35) - gelesen (ohne Befund)
- [x] `client/src/components/ui/avatar.tsx` (29) - gelesen (ohne Befund)
- [x] `client/src/components/ui/badge.tsx` (36) - gelesen (ohne Befund)
- [x] `client/src/components/ui/button.tsx` (41) - gelesen (ohne Befund)
- [x] `client/src/components/ui/card.tsx` (34) - gelesen (ohne Befund)
- [x] `client/src/components/ui/checkbox.tsx` (30) - gelesen (ohne Befund)
- [x] `client/src/components/ui/command.tsx` (94) - gelesen (Funde 155, 158)
- [x] `client/src/components/ui/dialog.tsx` (101) - gelesen (ohne Befund)
- [x] `client/src/components/ui/dropdown-menu.tsx` (173) - gelesen (ohne Befund)
- [x] `client/src/components/ui/input.tsx` (26) - gelesen (ohne Befund)
- [x] `client/src/components/ui/label.tsx` (74) - gelesen (Fund 168)
- [x] `client/src/components/ui/nur-vorlesen.tsx` (28) - gelesen (Fund 158)
- [x] `client/src/components/ui/popover.tsx` (34) - gelesen (ohne Befund)
- [x] `client/src/components/ui/progress.tsx` (15) - gelesen (ohne Befund)
- [x] `client/src/components/ui/scroll-area.tsx` (32) - gelesen (ohne Befund)
- [x] `client/src/components/ui/select.tsx` (130) - gelesen (ohne Befund)
- [x] `client/src/components/ui/separator.tsx` (19) - gelesen (ohne Befund)
- [x] `client/src/components/ui/skeleton.tsx` (7) - gelesen (ohne Befund)
- [x] `client/src/components/ui/switch.tsx` (19) - gelesen (ohne Befund)
- [x] `client/src/components/ui/table.tsx` (48) - gelesen (ohne Befund)
- [x] `client/src/components/ui/tabs.tsx` (51) - gelesen (ohne Befund)
- [x] `client/src/components/ui/textarea.tsx` (20) - gelesen (ohne Befund)
- [x] `client/src/components/ui/time-input.tsx` (77) - gelesen (Fund 167)
- [x] `client/src/components/ui/toast.tsx` (106) - gelesen (Fund 169)
- [x] `client/src/components/ui/toaster.tsx` (21) - gelesen (ohne Befund)
- [x] `client/src/components/ui/tooltip.tsx` (32) - gelesen (ohne Befund)
- [x] `client/src/components/ui/use-toast.ts` (81) - gelesen (ohne Befund)

### Client: Seiten

- [ ] `client/src/pages/Abnahme.tsx` (672)
- [x] `client/src/pages/AbnahmeAnsicht.tsx` (282) - gelesen (Funde 188 und 189)
- [x] `client/src/pages/Abschluss.tsx` (226) - gelesen (Fund 178)
- [x] `client/src/pages/ActivityFeed.tsx` (229) - gelesen (Fund 181)
- [ ] `client/src/pages/AdminPanel.tsx` (870)
- [ ] `client/src/pages/AdminStats.tsx` (504)
- [ ] `client/src/pages/Agenturen.tsx` (704)
- [ ] `client/src/pages/Angebote.tsx` (604)
- [x] `client/src/pages/AuditLog.tsx` (285) - gelesen (Fund 191)
- [x] `client/src/pages/Aufgaben.tsx` (220) - gelesen (Fund 177)
- [x] `client/src/pages/Auswertungen.tsx` (464) - gelesen (Fund 218; bleibt deutsch (Merkzettel))
- [x] `client/src/pages/Benutzerverwaltung.tsx` (222) - entfernt (Fund 177)
- [x] `client/src/pages/Besetzung.tsx` (388) - gelesen (Fund 208)
- [x] `client/src/pages/Buchhaltung.tsx` (282) - gelesen (Fund 190; Mahnwesen-Haken stimmt (Spalte BOOLEAN))
- [ ] `client/src/pages/Budget.tsx` (501)
- [x] `client/src/pages/CastingAntwort.tsx` (322) - gelesen (ohne neuen Befund; Gage über `betragInCent` (Fund 192), vorbelegte Gage wird richtig zurückgelesen)
- [x] `client/src/pages/CateringListe.tsx` (467) - gelesen (Fund 219)
- [x] `client/src/pages/CheckinBoard.tsx` (331) - gelesen (Fund 199)
- [ ] `client/src/pages/Continuity.tsx` (575)
- [x] `client/src/pages/CreatorChecklisten.tsx` (86) - gelesen (ohne Befund)
- [x] `client/src/pages/CreatorClips.tsx` (75) - gelesen (ohne Befund)
- [x] `client/src/pages/CreatorIdeen.tsx` (240) - gelesen (Fund 182)
- [x] `client/src/pages/CreatorKanal.tsx` (200) - gelesen (ohne Befund)
- [x] `client/src/pages/CreatorPerformance.tsx` (105) - gelesen (Fund 173)
- [x] `client/src/pages/CreatorRechte.tsx` (85) - gelesen (ohne Befund)
- [x] `client/src/pages/CreatorRedaktionsplan.tsx` (89) - gelesen (Fund 173)
- [x] `client/src/pages/CreatorSeo.tsx` (77) - gelesen (ohne Befund)
- [x] `client/src/pages/CreatorSerien.tsx` (75) - gelesen (ohne Befund)
- [x] `client/src/pages/CreatorSponsoren.tsx` (102) - gelesen (ohne Befund)
- [x] `client/src/pages/CreatorTitel.tsx` (91) - gelesen (ohne Befund)
- [x] `client/src/pages/CreatorVideo.tsx` (887) - gelesen (Funde 182 und 183; bleibt ganz deutsch, siehe Merkzettel)
- [x] `client/src/pages/CreatorVideos.tsx` (249) - gelesen (Fund 182)
- [x] `client/src/pages/DOOD.tsx` (362) - gelesen (Fund 205)
- [x] `client/src/pages/Dashboard.tsx` (440) - gelesen (Fund 216)
- [x] `client/src/pages/Dateien.tsx` (341) - gelesen (Fund 202)
- [x] `client/src/pages/Datenschutz.tsx` (48) - gelesen (ohne Befund (Platzhalter: Fund 141))
- [x] `client/src/pages/DatenschutzWerkzeuge.tsx` (297) - gelesen (Fund 194)
- [ ] `client/src/pages/Drehbuch.tsx` (552)
- [x] `client/src/pages/Drehplan.tsx` (419) - gelesen (Funde 210 und 211)
- [ ] `client/src/pages/EmailCenter.tsx` (700)
- [x] `client/src/pages/Equipment.tsx` (271) - gelesen (Fund 187)
- [x] `client/src/pages/EquipmentKalender.tsx` (422) - gelesen (Fund 214)
- [x] `client/src/pages/Fahrzeuge.tsx` (169) - gelesen (Fund 174)
- [ ] `client/src/pages/Firma.tsx` (897)
- [x] `client/src/pages/ForgotPassword.tsx` (95) - gelesen (ohne Befund, Antwortform wie im Server)
- [x] `client/src/pages/Impressum.tsx` (73) - gelesen (ohne Befund (Platzhalter: Fund 141))
- [x] `client/src/pages/Invite.tsx` (240) - gelesen (Fund 184)
- [ ] `client/src/pages/Kameraberichte.tsx` (501)
- [x] `client/src/pages/Komparsen.tsx` (258) - Funde 118, 119
- [x] `client/src/pages/Konfliktradar.tsx` (140) - gelesen (ohne Befund)
- [x] `client/src/pages/Kontaktliste.tsx` (227) - gelesen (Fund 179)
- [x] `client/src/pages/Kostenstand.tsx` (287) - gelesen (Funde 192 und 193)
- [x] `client/src/pages/Listen.tsx` (225) - gelesen (Fund 176)
- [x] `client/src/pages/Login.tsx` (280) - gelesen (Funde 185 und 186)
- [ ] `client/src/pages/Moodboard.tsx` (575)
- [ ] `client/src/pages/Motive.tsx` (476)
- [x] `client/src/pages/Musikliste.tsx` (311) - gelesen (Fund 197)
- [x] `client/src/pages/NichtGefunden.tsx` (24) - neu (Fund 147)
- [ ] `client/src/pages/OffenePosten.tsx` (673)
- [x] `client/src/pages/Papierkorb.tsx` (100) - gelesen (ohne Befund)
- [x] `client/src/pages/Pinboard.tsx` (161) - gelesen (Fund 172)
- [x] `client/src/pages/Postplan.tsx` (369) - gelesen (Fund 206)
- [x] `client/src/pages/ProjectList.tsx` (352) - gelesen (Fund 203)
- [x] `client/src/pages/ProjectTemplates.tsx` (151) - entfernt (Fund 173)
- [x] `client/src/pages/PublicDispo.tsx` (242) - gelesen (Fund 185)
- [ ] `client/src/pages/Rechnungen.tsx` (651)
- [ ] `client/src/pages/Reise.tsx` (772)
- [x] `client/src/pages/ResetPassword.tsx` (88) - gelesen (ohne Befund)
- [ ] `client/src/pages/ScreenplayEditor.tsx` (1428)
- [x] `client/src/pages/SetApp.tsx` (452) - gelesen (Fund 217)
- [x] `client/src/pages/Setplan.tsx` (420) - gelesen (Fund 213)
- [ ] `client/src/pages/Settings.tsx` (648)
- [x] `client/src/pages/Shotlist.tsx` (372) - gelesen (Fund 207)
- [x] `client/src/pages/SperrtageKalender.tsx` (425) - gelesen (Fund 215; bleibt deutsch (Merkzettel))
- [x] `client/src/pages/Stabliste.tsx` (312) - gelesen (Fund 198)
- [ ] `client/src/pages/StaebchenplanNew.tsx` (472)
- [ ] `client/src/pages/Stammdaten.tsx` (496)
- [x] `client/src/pages/Suche.tsx` (209) - gelesen (Fund 175)
- [x] `client/src/pages/SzenenKommentare.tsx` (359) - gelesen (Fund 204)
- [x] `client/src/pages/Tagesbericht.tsx` (349) - gelesen (Funde 201 und 202)
- [ ] `client/src/pages/Tagesdispo.tsx` (1116)
- [x] `client/src/pages/Terminkalender.tsx` (335) - gelesen (Fund 200)
- [ ] `client/src/pages/Timesheets.tsx` (562)
- [x] `client/src/pages/VFX.tsx` (304) - gelesen (Fund 196)
- [x] `client/src/pages/Versicherungen.tsx` (394) - gelesen (Fund 209)
- [ ] `client/src/pages/Vertraege.tsx` (837)
- [x] `client/src/pages/VertragBestaetigen.tsx` (254) - gelesen (ohne Befund: Name Pflicht, bestätigt nicht mehr ablehnbar, Grund kommt als `reason` an)
- [x] `client/src/pages/ZeitAnalyse.tsx` (301) - gelesen (Fund 195)

### Client: Rest

- [x] `client/src/App.tsx` (139) - gelesen (Funde 157, 170, 171)
- [ ] `client/src/index.css` (751)
- [x] `client/src/main.tsx` (235) - gelesen (Funde 146 und 147, 170)
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
- [x] `server/src/__tests__/budget.test.ts` (87) - entfernt (Fund 154)
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

### Nachgetragen am 27.10.2026

Beim Abgleich mit `git ls-files` fehlten diese Dateien in der Liste: ältere,
die beim Anlegen nicht erfasst wurden, und solche, die während der Prüfung
neu entstanden sind (diese mit Fundnummer abgehakt).

- [x] `client/index.html` (16) - gelesen (ohne Befund)
- [x] `client/postcss.config.js` (6) - gelesen (ohne Befund)
- [x] `client/src/store/useProjectStore.ts` (88) - gelesen (Fund 154)
- [x] `client/tailwind.config.ts` (156) - gelesen (ohne Befund, Kommentar-Umlaut)
- [x] `client/vite.config.ts` (63) - gelesen (ohne Befund, Gedankenstrich im Kommentar)
- [x] `server/src/config/secrets.ts` (102) - gelesen (ohne Befund)
- [x] `server/src/schemas/index.ts` (41) - gelesen (ohne Befund; `RegisterSchema` (8 Zeichen) ungenutzt, siehe Merkzettel Passwortlänge)
- [x] `server/src/services/holidays.ts` (58) - gelesen (Kandidat unter Verknüpfungen)
- [x] `server/src/utils/calculations.ts` (51) - entfernt (Fund 154)
- [x] `server/vitest.config.ts` (13) - gelesen (ohne Befund)
- [x] `server/src/lib/suchmuster.ts` (10) - neu während der Prüfung (Fund 102)
- [x] `server/src/__tests__/suchmuster.test.ts` (12) - neu während der Prüfung (Fund 102)
- [x] `server/src/lib/webadresse.ts` (32) - neu während der Prüfung (Fund 24)
- [x] `server/src/__tests__/figuren.test.ts` (19) - neu während der Prüfung (Fund 115)
- [x] `server/src/__tests__/motive.test.ts` (33) - neu während der Prüfung (Fund 120)
- [x] `server/src/__tests__/pdfFonts.test.ts` (17) - neu während der Prüfung (Fund 131)
