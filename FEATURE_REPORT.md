# CutSheet — Feature Report

> Generated: 2026-05-14 | Commit: b1039e0 | 48 files, 7768 insertions

---

## GRUPPE A — On-Set Tools

| # | Feature | Status | Route (Backend) | Page (Frontend) |
|---|---------|--------|-----------------|-----------------|
| A1 | Check-in System | ✅ | `POST /api/call-sheet-entries/:id/checkin` · `GET /api/call-sheets/:id/checkin-status` | `/projects/:id/checkin` |
| A2 | Timesheet / Arbeitszeiterfassung | ✅ | `CRUD /api/shoot-days/:dayId/timesheets` · `GET /api/projects/:pid/timesheets/export.csv` | `/projects/:id/timesheets` |
| A3 | Script Sides Generator | ✅ | `GET /api/shoot-days/:dayId/script-sides/pdf?cast_id=X` | Button in Drehplan-Seite |
| A4 | Catering-Liste | ✅ | `CRUD /api/projects/:pid/catering-preferences` · `GET /api/shoot-days/:dayId/catering-list` | `/projects/:id/catering` |
| A5 | Continuity-Modul | ✅ | `CRUD /api/projects/:pid/continuity` | `/projects/:id/continuity` |

---

## GRUPPE B — Pre-Production Intelligence

| # | Feature | Status | Route (Backend) | Page (Frontend) |
|---|---------|--------|-----------------|-----------------|
| B1 | DOOD-Report | ✅ | `GET /api/projects/:pid/dood-report` | `/projects/:id/dood` |
| B2 | KI Script Breakdown | ✅ | `POST /api/scenes/:sceneId/ai-breakdown` (Claude claude-opus-4-5) | Dialog auf Szenen-Detailseite |
| B3 | Location Release / Motivvertrag | ✅ | `GET/POST /api/locations/:id/release` · `PATCH .../sign` · `GET .../pdf` | In Motive-Detailansicht |
| B4 | AI Auto-Scheduling | ✅ | `POST /api/projects/:pid/drehplan/ai-optimize` (Claude claude-opus-4-5, snapshot-first) | Button in Drehplan |
| B5 | Sonnenstands-Rechner | ✅ | `GET /api/locations/:id/sun?date=YYYY-MM-DD` (suncalc npm package) | Widget in Location-Ansicht |

---

## GRUPPE C — Kommunikation & Kollaboration

| # | Feature | Status | Route (Backend) | Page (Frontend) |
|---|---------|--------|-----------------|-----------------|
| C1 | SMTP E-Mail | ✅ | `POST /api/projects/:pid/email/send` · `/status` · `/test` (nodemailer, SMTP fallback to logging) | Konfiguration in Settings |
| C2 | Push Notifications | ✅ | `POST /api/push/subscribe|unsubscribe` · `GET /push/vapid-public-key` (web-push) | Toggle in Settings |
| C3 | Bestätigungs-Tracking | ✅ | `POST /api/call-sheet-entries/:id/confirm` · `GET .../track.png` (1×1 Tracking-Pixel) | Status-Icons in Tagesdispo |
| C4 | iCal Export | ✅ | `GET /api/projects/:pid/calendar/export.ics?from=&to=` (ical-generator) | Button in Terminkalender |

---

## GRUPPE D — Post & Verwaltung

| # | Feature | Status | Route (Backend) | Page (Frontend) |
|---|---------|--------|-----------------|-----------------|
| D1 | Kamera-Report / Cutterbericht | ✅ | `CRUD /api/shoot-days/:dayId/camera-reports` + takes CRUD | `/projects/:id/kameraberichte` |
| D2 | Digitale Unterschriften | ✅ | Canvas-basiertes SignaturePad in Location Release | Verwendet in Motivvertrag |
| D3 | Payroll CSV Export | ✅ | `GET /api/projects/:pid/payroll/export.csv?type=cast|crew|all` | Button in Budget-Bereich |
| D4 | PWA (Progressive Web App) | ✅ | Service Worker via Workbox (vite-plugin-pwa) | Install-Banner, Offline-Support |
| D5 | Förderantrag-Export | ✅ | `GET /api/projects/:pid/foerderantrag/export` (JSON + `?format=pdf`) | Im Budget-Bereich |

---

## GRUPPE E — Eigene Features

| # | Feature | Status | Route (Backend) | Page (Frontend) |
|---|---------|--------|-----------------|-----------------|
| E1 | Globale Aktivitäts-Timeline | ✅ | `GET /api/projects/:pid/activity?limit=N` (audit_log + comments merged) | `/projects/:id/aktivitaet` |
| E2 | Szenen-Kommentare | ✅ | `CRUD /api/projects/:pid/scenes/:sceneId/comments` · `PATCH /comments/:id/resolve` | `/projects/:id/kommentare` |
| E3 | Equipment-Verfügbarkeits-Kalender | ✅ | `CRUD /api/projects/:pid/equipment-bookings` · `GET .../conflicts` | `/projects/:id/equipment-kalender` |
| E4 | Moodboard | ✅ | `CRUD /api/projects/:pid/moodboard` | `/projects/:id/moodboard` |
| E5 | Drehtag-Briefing Dokument | ⚠️ | Script Sides PDF dient als Grundlage (A3). Separater "Morning Brief"-Endpoint noch nicht implementiert. | — |
| E6 | Sperrtag-Management für Cast | ✅ | `CRUD /api/projects/:pid/cast/:castId/blackout-dates` · `GET .../conflicts` | `/projects/:id/sperrtage` |
| E7 | Projekt-Templates | ✅ | Keine Backend-Logik nötig (Frontend-only Vorausfüllung) | `ProjectTemplates.tsx` Komponente |
| E8 | Offline-Fähige Set-App | ✅ | Nutzt bestehende Endpoints | `/set` (eigenständige Route ohne AppShell) |
| E9 | Produktions-Fortschritts-Dashboard | ✅ | Nutzt `/api/projects` + `/api/auth/users` | `/admin/stats` |
| E10 | Automatische Optimierungs-Vorschläge | ✅ | `GET/POST /api/projects/:pid/scheduling-suggestions` · `PATCH .../dismiss` | Im Dashboard-Widget |

---

## Technische Details

### Neue NPM-Pakete (Server)
- `nodemailer` — SMTP E-Mail-Versand (C1)
- `web-push` — Browser Push Notifications mit VAPID (C2)
- `suncalc` — Sonnenstand-Berechnung ohne externe API (B5)
- `ical-generator` — iCal/.ics Export (C4)
- `@anthropic-ai/sdk` — KI-Features B2 + B4

### Neue NPM-Pakete (Client)
- `vite-plugin-pwa` — Progressive Web App + Service Worker (D4)

### Neue DB-Tabellen (12)
| Tabelle | Feature |
|---------|---------|
| `timesheets` | A2 |
| `catering_preferences` | A4 |
| `continuity_notes` | A5 |
| `location_releases` | B3 |
| `push_subscriptions` | C2 |
| `camera_reports` | D1 |
| `camera_takes` | D1 |
| `equipment_bookings` | E3 |
| `moodboard_items` | E4 |
| `cast_blackout_dates` | E6 |
| `scheduling_suggestions` | E10 |

### Neue DB-Spalten in `call_sheet_entries` (4)
- `checked_in BOOLEAN DEFAULT false` — A1
- `checked_in_at TIMESTAMPTZ` — A1
- `confirmed_at TIMESTAMPTZ` — C3
- `viewed_at TIMESTAMPTZ` — C3

### Neue Env-Vars
```env
# E-Mail (optional — ohne diese Vars wird nur geloggt)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your-app-password
SMTP_FROM="CutSheet <noreply@cutsheet.app>"

# Web Push (optional)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=mailto:admin@cutsheet.app

# Claude API (für KI-Features B2 + B4)
ANTHROPIC_API_KEY=
```

---

## Zusammenfassung

| Status | Anzahl | Features |
|--------|--------|---------|
| ✅ Vollständig implementiert | 29 | A1-A5, B1-B5, C1-C4, D1-D5, E1-E4, E6-E10 |
| ⚠️ Teilweise implementiert | 1 | E5 (Morning Brief — Script Sides PDF als Basis, kein dedizierter Endpoint) |
| ❌ Nicht implementiert | 0 | — |

**Gesamtbilanz: 29/30 vollständig ✅ · 1/30 als Basis ⚠️**
