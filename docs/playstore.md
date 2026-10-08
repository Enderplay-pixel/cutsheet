# CutSheet im Play Store (Android)

CutSheet ist bereits eine installierbare Web-App (PWA): mit Manifest, Service Worker, Push-Benachrichtigungen und Offline-Zugriff auf die Set-Daten. Deshalb braucht es für den Play Store **keine zweite, native App**. Eine *Trusted Web Activity* (TWA) verpackt die bestehende App. Sie läuft im Vollbild ohne Adressleiste, und jedes Update auf dem Server ist sofort in der App.

## Empfehlung

- **Eine App „CutSheet“**, die direkt in die Set-App startet (`/set`). Von dort ist die ganze App erreichbar. Eine zweite App „CutSheet Set“ lohnt sich erst, wenn Cast und Crew sie ohne Konto nutzen sollen, zum Beispiel nur für Dispo-Links.
- **Zuerst Android**, iOS später. Apple lehnt reine Web-Verpackungen häufig ab (Richtlinie 4.2). Dort braucht es mehr native Funktionen, etwa über Capacitor. Auf dem iPhone funktioniert die PWA über „Zum Home-Bildschirm“ schon heute.

## Was bereits vorbereitet ist

| Baustein | Stand |
|---|---|
| Manifest mit Symbolen, Farben, Sprache Deutsch | vorhanden |
| Kurzbefehl „Set-App“ beim langen Drücken auf das Symbol | vorhanden |
| Offline: Dispo, Shots, Drehtage, Szenen, Continuity drei Tage aus dem Cache | vorhanden |
| App öffnet ohne Netz, zeigt einen Hinweis „Offline“ | vorhanden |
| Cache wird beim Abmelden gelöscht (geteilte Set-Tablets) | vorhanden |
| `/.well-known/assetlinks.json` für die Verknüpfung App ↔ Domain | Route vorhanden, Werte per Umgebung |

## Schritte zur Veröffentlichung

1. **Google-Play-Konsole** anlegen (einmalig 25 $).
2. **App erzeugen** mit Bubblewrap (Google-Werkzeug für TWAs):
   ```bash
   npx @bubblewrap/cli init --manifest https://<deine-domain>/manifest.webmanifest
   # Paketname z. B. app.cutsheet.twa, Start-URL /set
   npx @bubblewrap/cli build
   ```
   Bubblewrap erzeugt den Signaturschlüssel und zeigt dessen SHA-256-Fingerabdruck.
3. **Domain verknüpfen**: Auf dem Server diese Umgebungsvariablen setzen:
   ```
   TWA_PACKAGE_NAME=app.cutsheet.twa
   TWA_SHA256_FINGERPRINTS=AB:CD:...   # bei mehreren durch Komma getrennt
   ```
   Nutzt du die Google-Play-App-Signatur, gehört **auch** deren Fingerabdruck dazu (Play-Konsole → App-Integrität). Prüfen: `https://<deine-domain>/.well-known/assetlinks.json` muss beide Werte zeigen.
4. **Store-Eintrag**: Screenshots der Set-App (Dispo, Shots, Check-in), kurze Beschreibung, Datenschutzerklärung-URL (`/datenschutz`), Angaben zur Datensicherheit.
5. **Interner Test** mit dem Team, danach offener Test, dann Produktion.

## Aufwand und Nutzen

- **Aufwand:** rund ein Tag, ohne zweite Codebasis. Updates brauchen keinen neuen Store-Release, solange sich Symbol, Name oder Paket nicht ändern.
- **Nutzen:**
  - Auffindbar im Store und Vertrauen („echte App“).
  - Zuverlässige Benachrichtigungen bei Dispo-Versand und Zeitänderungen.
  - Symbol auf dem Homescreen, ohne dass Nutzer „Installieren“ im Browser finden müssen.
