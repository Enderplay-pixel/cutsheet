# YouTube-Anbindung einrichten

Damit CutSheet Zahlen und Retention-Kurven aus deinem Kanal holen kann, braucht
es einen OAuth-Client aus deiner Google Cloud Console. Den kann nur du anlegen —
er hängt an deinem Google-Konto.

Dauer: rund zehn Minuten.

---

## 1. Projekt und APIs

1. [console.cloud.google.com](https://console.cloud.google.com) öffnen, oben ein
   **neues Projekt** anlegen (Name egal, z. B. „CutSheet").
2. Unter **APIs und Dienste → Bibliothek** diese beiden aktivieren:
   - **YouTube Data API v3**
   - **YouTube Analytics API**

Ohne die zweite gibt es keine Retention-Kurve.

## 2. Zustimmungsbildschirm

Unter **APIs und Dienste → OAuth-Zustimmungsbildschirm**:

- Nutzertyp **Extern**
- App-Name, deine Mailadresse als Support- und Entwicklerkontakt
- Bei **Bereiche** nichts eintragen — CutSheet fragt sie zur Laufzeit an
- Unter **Testnutzer** deine eigene Google-Adresse hinzufügen

> **Wichtig:** `yt-analytics.readonly` gilt bei Google als sensibler Bereich.
> Solange die App im Status *Testing* steht, verfallen die Zugriffsrechte nach
> **7 Tagen** — du musst dich dann in CutSheet einmal neu verbinden. Das ist
> eingeplant, die Oberfläche fordert dich dazu auf. Dauerhaft ginge nur mit
> Googles Überprüfungsverfahren, das für einen einzelnen Kanal unverhältnismäßig
> ist.

## 3. Zugangsdaten

Unter **APIs und Dienste → Anmeldedaten → Anmeldedaten erstellen → OAuth-Client-ID**:

- Anwendungstyp **Webanwendung**
- Bei **Autorisierte Weiterleitungs-URIs** exakt eintragen:

```
https://cutsheet.onrender.com/api/creator/youtube/callback
```

Für lokale Entwicklung zusätzlich:

```
http://localhost:5173/api/creator/youtube/callback
```

Die URI muss **zeichengenau** stimmen, sonst lehnt Google mit
`redirect_uri_mismatch` ab.

Danach zeigt Google **Client-ID** und **Client-Secret** an.

## 4. In Render eintragen

Im Render-Dashboard beim Service unter **Environment** anlegen:

| Variable | Wert |
|---|---|
| `YOUTUBE_CLIENT_ID` | die Client-ID von Google |
| `YOUTUBE_CLIENT_SECRET` | das Client-Secret von Google |
| `APP_BASE_URL` | `https://cutsheet.onrender.com` |
| `TOKEN_ENCRYPTION_KEY` | beliebige lange Zufallszeichenkette |

`APP_BASE_URL` muss gesetzt sein, sonst baut der Server die Weiterleitungs-URI
falsch zusammen. `TOKEN_ENCRYPTION_KEY` verschlüsselt die gespeicherten Tokens;
fehlt er, wird ersatzweise `JWT_SECRET` verwendet.

Nach dem Speichern startet Render den Dienst neu.

## 5. Verbinden

In CutSheet: Creator-Projekt öffnen → **Kanal** → **Mit YouTube verbinden**.
Google fragt nach Zustimmung, danach landest du zurück in der App.

Dann **Zahlen abgleichen** drücken.

---

## Wie die Zuordnung funktioniert

CutSheet ordnet seine Videos den YouTube-Videos über die Video-ID zu. Die kommt
aus dem Feld **Video-Link** im Reiter „Zahlen" — jede übliche Linkform wird
erkannt:

```
https://www.youtube.com/watch?v=dQw4w9WgXcQ
https://youtu.be/dQw4w9WgXcQ
https://www.youtube.com/shorts/dQw4w9WgXcQ
dQw4w9WgXcQ
```

Videos ohne Link bleiben beim Abgleich außen vor und werden danach namentlich
aufgelistet.

## Was danach zu sehen ist

Im Reiter **Zahlen** eines Videos erscheint unter den Kennzahlen der Abschnitt
**„Wo die Leute abspringen"**: die Retention-Kurve von YouTube, gelegt über deine
Skript-Abschnitte.

Der Verlust wird auf eine Minute normiert — sonst wäre der längste Abschnitt
immer der scheinbar schlechteste. Zusätzlich ausgewiesen: der Zuschaueranteil
nach 30 Sekunden als Hook-Test und die Abwanderung während der Sponsorstrecke.

Auf der **Kanal**-Seite stehen Muster über alle Videos: mittlere Klickrate, der
Zusammenhang zwischen Videolänge und gesehenem Anteil, bester Wochentag.

## Wenn etwas klemmt

| Meldung | Ursache |
|---|---|
| `redirect_uri_mismatch` | Die URI in Google stimmt nicht zeichengenau mit `APP_BASE_URL` + `/api/creator/youtube/callback` überein |
| „Zugriff abgelaufen — bitte neu verbinden" | Die 7 Tage des Testmodus sind um. Einmal neu verbinden |
| „Zu diesem Google-Konto gehört kein YouTube-Kanal" | Beim Zustimmen das falsche Google-Konto gewählt |
| Keine Retention-Kurve | YouTube liefert sie erst ab einer Mindestzahl an Aufrufen |
| Impressionen und Klickrate fehlen | Diese Metriken sind nicht für jeden Kanal freigeschaltet; der Rest wird trotzdem geholt |
