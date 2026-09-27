# Testversion für den Hard Launch

Diese Anleitung beschreibt, wie CutSheet als Testversion vor dem Launch läuft, wie das große Testprojekt entsteht und was unter Last gemessen wurde.

## 1. Umgebungsvariablen

Im Dashboard von Render oder Railway setzen:

| Variable | Wert | Zweck |
|---|---|---|
| `CUTSHEET_TESTVERSION` | `1` | Zeigt in der App (Seitenleiste und Anmeldung) das Kennzeichen „Test“. Nach dem Launch entfernen. |
| `ADMIN_EMAIL` | deine E-Mail | Dieses Konto ist immer Admin. |
| `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD` | optional, Passwort mindestens 12 Zeichen | Legt einen zusätzlichen Test-Admin an. Ohne beide Werte gibt es in Produktion **kein** Standardkonto. |
| `APP_BASE_URL` | öffentliche URL | Pflicht für Links in E-Mails. |
| `PDF_MAX_PARALLEL` | `1` bei 512 MB RAM, sonst `2` | Anzahl PDFs, die gleichzeitig gerendert werden. |

Sicherheitshinweis: Früher legte jeder Produktionsstart `admin@cutsheet.dev` mit dem Passwort `admin1234` an. Das passiert nicht mehr. Hat eine bestehende Datenbank dieses Konto noch mit dem alten Passwort, bekommt es beim nächsten Start ein zufälliges Passwort und die Rolle „user“.

## 2. Testprojekt „Nordlicht“ (Großproduktion)

Das Testprojekt entsteht über **Admin → System → „Großproduktion anlegen“**. Es gehört danach dem angemeldeten Admin. Ein vorhandenes „Nordlicht“ wird ersetzt.

Es enthält eine vollständige Kinoproduktion (Hamburg und Westerhever):

- **Drehplan:** 45 Drehtage (Mo–Sa), davon ein ausgefallener Tag, 2nd-Unit-Tage und Nachtblöcke.
- **Tagesarbeit:** Tagesdispos für jeden Tag. Für die bereits gedrehten Tage gibt es Tagesberichte, Kameraberichte mit rund 1.500 Takes und Stundenzettel.
- **Drehbuch und Shots:** 160 Szenen, über 900 Drehbuchblöcke und rund 720 Shots.
- **Besetzung und Team:** 32 Rollen mit Besetzung, rund 100 Stab-Mitglieder, 240 Komparsen und 28 Motive.
- **Geld:** Kalkulation mit rund 5,15 Mio. € plus eine archivierte Vorversion. Die Finanzierung liegt bei 5,0 Mio. €, die Lücke ist also gewollt. Dazu kommen 280 Belege.
- **Weitere Abteilungen:** Equipment, Fahrzeuge, VFX, Musik, Versicherungen, Continuity, Motivverträge, Aufgaben, Kommentare, Termine und Moodboard.
- **Teamkonten:** fünf Konten mit den Rollen Produktion, Regie, zweimal Abteilungsleitung und einmal nur lesen. Ihre Passwörter werden beim Anlegen **einmal** angezeigt.

Auf der Kommandozeile geht es auch:

```bash
SEED_TEAM_PASSWORD='mind-12-zeichen' npm run seed:gross --workspace=server -- admin@beispiel.de
```

## 3. Betrieb unter vielen Nutzern

Was eingebaut ist:

- **Datenbank:** Alle Fremdschlüssel haben einen Index; fehlende Indizes werden beim Start angelegt. Der Pool ist über `DB_POOL_MAX`, `DB_CONNECT_TIMEOUT_MS` und `DB_STATEMENT_TIMEOUT_MS` einstellbar.
- **Überlast:** Statt eines Fehlers antwortet der Server mit `503` und `Retry-After`. Die App wiederholt Lesezugriffe und die Anmeldung automatisch. Ein kurzer Server-Aussetzer meldet niemanden mehr ab.
- **Passwörter:** bcrypt läuft in Worker-Threads. Viele gleichzeitige Anmeldungen blockieren den Server nicht mehr.
- **PDF:** Alle Exporte teilen sich einen Browser und laufen über eine Warteschlange. Nach einer Minute ohne Export wird der Speicher freigegeben.
- **Netzwerk:** gzip-Kompression; eine Shotlist mit 258 KB wird zu rund 25 KB. Dazu `trust proxy` und Keep-Alive passend zum Proxy.
- **Ratengrenzen:**
  - API: 1200 Anfragen pro Minute und Nutzer
  - Registrierung: 10 pro Stunde und Adresse
  - KI und E-Mail-Versand: 30 pro Stunde und Nutzer
  - Anmeldung: 8 Fehlversuche, danach Pause
- **Deploy:** Beim Herunterfahren laufen offene Anfragen noch zu Ende.

### Lasttest selbst wiederholen

```bash
LASTTEST_PASSWORT='mind-12-zeichen' npm run seed:last --workspace=server -- 150
LASTTEST_PASSWORT='mind-12-zeichen' BASE=http://localhost:3001 node scripts/lasttest.cjs 150 60
```

Jeder virtuelle Nutzer meldet sich an und bekommt eine eigene Großproduktion. Dann klickt er mit ein bis drei Sekunden Bedenkzeit durch Dashboard, Drehplan, Dispo, Drehbuch, Stab, Besetzung, Budget, Shotlist, Kostenstand und DOOD. In Produktion ist `seed:last` gesperrt, außer mit `LASTTEST_ERLAUBT=1`.

### Messung (27.09.2026)

Gemessen auf einer Maschine mit 4 Kernen. Datenbank und Lastgenerator liefen auf derselben Maschine wie der Produktions-Build.

| | vorher | nachher |
|---|---|---|
| 150 gleichzeitige Nutzer, 60 s | Anmeldungen scheitern mit 500 (bis zu 51 von 150) | **0 Fehler** |
| Anfragen pro Sekunde | 107, aber nicht alle Nutzer angemeldet | 114, mit allen 150 Nutzern |
| langsamste Seite, p95 | 3,4 s (mit weniger aktiven Nutzern) | 5,0 s (Kostenstand, 150 Nutzer) |
| 20 PDF-Exporte gleichzeitig | 20 Chromium-Prozesse | ein Browser, alle 20 in 4,5 s |
| Shotlist mit 160 Szenen, Aufbau | 391 s (Entwicklungsmodus) | 3,6 s bei vierfach gedrosselter CPU |

Ein Server-Prozess nutzt einen CPU-Kern. Für deutlich mehr als 150 gleichzeitig aktive Nutzer die Instanz vergrößern oder mehrere Instanzen hinter den Load Balancer stellen. Die Anmeldebremse und die Ratengrenzen zählen dann je Instanz.
