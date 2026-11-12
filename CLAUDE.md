# CLAUDE.md

CutSheet ist Produktionssoftware für Film und Video: npm-Workspaces mit
`client/` (React, Vite) und `server/` (Express, Postgres). Was das Programm
ist und abdeckt, steht in `CUTSHEET.md`. Prüfstand, Fundbuch und der
Abschnitt "Hier weitermachen" stehen in `docs/CODEPRUEFUNG.md`, die Seiten
in `docs/SEITEN.md`.

## Kino-Ausbau

Seit dem 10.11.2026 wird nach einem Bauplan gearbeitet, der außerhalb des
Repos im Coding Vault liegt. Wer am Ausbau baut, liest zuerst vollständig:

`C:\Users\flork\Documents\Coding Vault\Apps\CutSheet Kino-Ausbau - Opus-Anleitung.md`

Dort stehen der Ablauf einer Sitzung, die feste Reihenfolge der
Arbeitspakete, die Regel, wann ein Paket fertig ist, und der Weg der
Auslieferung. Der Stand je Paket steht in der Tabelle "Fortschritt" der
Notiz `CutSheet Kino-Ausbau.md` im selben Ordner.

## Immer

- Vor jedem "fertig" die vier Läufe: `npx tsc --noEmit` in `client` und in
  `server`, `npx vitest run` in `server`, `npm run build` in `client`.
- `git add` nur mit Dateinamen. Nie `git add -A`, nie `git commit -a`.
- `server/src/lib/benachrichtigungen.ts` ist unversioniert und gehört einer
  anderen Sitzung: nicht committen, nicht löschen, nicht ändern.
- Ein Push auf `master` ist ein Deploy (Render, rund 13 Minuten). Nur mit
  Florians Wort in der Sitzung, und gebündelt statt je Korrektur.
- Lokal starten: Vorschau `cutsheet-lokal` aus `.claude/launch.json`
  (Postgres auf 55432, Server auf 3001, Client auf 5173).
- Eine Aussage über laufenden Code braucht eine Messung, keinen Blick in
  die Quelle.
