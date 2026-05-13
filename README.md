# CutSheet — Film Production Management

Vollständige Webapplikation zur Verwaltung von Filmproduktionen. Von der Vorproduktion über den Dreh bis zur Postproduktion.

---

## Inhaltsverzeichnis

1. [Tech Stack](#tech-stack)
2. [Architektur](#architektur)
3. [Datenbankschema](#datenbankschema)
4. [Auth & Rollen](#auth--rollen)
5. [Seiten & Funktionen](#seiten--funktionen)
6. [API-Endpunkte](#api-endpunkte)
7. [State Management](#state-management)
8. [i18n / Mehrsprachigkeit](#i18n--mehrsprachigkeit)
9. [UI-Komponenten](#ui-komponenten)
10. [PDF-Export](#pdf-export)
11. [Echtzeit-Features (SSE)](#echtzeit-features-sse)
12. [Spezialfeatures](#spezialfeatures)
13. [Umgebungsvariablen](#umgebungsvariablen)
14. [Deployment (Railway)](#deployment-railway)
15. [Lokale Entwicklung](#lokale-entwicklung)

---

## Tech Stack

### Backend
| Technologie | Zweck |
|---|---|
| Node.js + Express | HTTP-Server |
| TypeScript | Typsicherheit |
| PostgreSQL (`pg`) | Datenbank |
| JWT (`jsonwebtoken`) | Authentifizierung |
| bcryptjs (cost 12) | Passwort-Hashing |
| Puppeteer | PDF-Generierung (Chromium headless) |
| Zod | Request-Validierung |
| `express-async-errors` | Async-Error-Propagation |

### Frontend
| Technologie | Zweck |
|---|---|
| React 18 | UI |
| Vite | Build-Tool + Dev-Server |
| TypeScript | Typsicherheit |
| React Router v6 | Client-seitiges Routing (lazy-loaded) |
| TanStack Query v5 | Server-State, Caching, Mutations |
| Zustand | Client-State (mit `persist`) |
| DnD Kit | Drag-and-Drop (Drehplan, Shotlist) |
| Tailwind CSS | Utility-First Styling |
| shadcn/ui (Radix UI) | Accessible Component Primitives |
| `class-variance-authority` | Varianten-Management für Komponenten |
| date-fns | Datumsformatierung |
| Inter (Google Fonts) | Schriftart |

---

## Architektur

```
cutsheet/
├── client/                  # React-Frontend (Vite)
│   ├── public/
│   │   └── film.svg         # Favicon (Clapperboard SVG)
│   └── src/
│       ├── App.tsx           # Root: Router, AppShell, Shortcuts, SSE
│       ├── index.css         # Design-System, Animationen, Utilities
│       ├── components/
│       │   ├── layout/       # Sidebar, TopBar, PageHeader
│       │   ├── ui/           # 27 UI-Primitive (Button, Card, Input, ...)
│       │   ├── shared/       # GlobalSearch, AutoSaveIndicator, PDFPreviewModal, TutorialModal, ShortcutsModal
│       │   └── drehplan/     # ScenePool, ShootDayColumn, SceneStrip
│       ├── contexts/
│       │   ├── AuthContext.tsx         # JWT-Auth, User-State
│       │   └── ProjectRoleContext.tsx  # Projektrolle, canEdit/canAdmin etc.
│       ├── pages/            # 34 Seitenkomponenten (lazy-loaded)
│       ├── store/
│       │   └── useProjectStore.ts   # Zustand Store (Dark Mode, Sidebar, Language, Undo)
│       └── lib/
│           ├── api.ts        # Typisierter API-Client
│           ├── i18n.ts       # Alle Übersetzungsstrings (EN/DE/FR)
│           ├── useT.ts       # Hook: tt(key) → aktueller Sprach-String
│           └── utils.ts      # formatDate, formatCurrency, cn()
└── server/
    └── src/
        ├── index.ts          # Server-Entry: HTTP starten, DB-Retry-Loop, dbReady-Flag
        ├── db/
        │   └── index.ts      # Schema, toPg(), DB-Pool, seedDemoData()
        ├── middleware/
        │   ├── auth.ts       # requireAuth, optionalAuth, requireRole, signToken
        │   ├── projectAuth.ts # projectWriteGuard (Projektrolle-Enforcement)
        │   └── validate.ts   # Zod-Validierung als Middleware
        ├── routes/           # 25 Route-Dateien
        └── services/
            └── holidays.ts   # Feiertagsdaten nach Land
```

### Server-Start-Ablauf
1. HTTP-Server startet sofort (`app.listen`) → `/api/health` antwortet sofort
2. DB-Verbindung wird bis zu 10× versucht (3s Pause je Versuch)
3. Erst nach erfolgreicher DB-Init wird `dbReady = true` gesetzt
4. Alle anderen `/api/*`-Routen geben 503 zurück solange `dbReady = false`

### SQL-Abstraktionsschicht (`toPg()`)
Da SQLite-Syntax-kompatibel entwickelt, aber auf PostgreSQL migriert, wandelt `toPg()` automatisch um:
- `?` → `$1, $2, ...` (positionale Parameter)
- `datetime('now')` → `NOW()`
- `datetime('now', '-N unit')` → `NOW() - INTERVAL 'N unit'`
- `date('now')` → `CURRENT_DATE`
- `cast` (Tabellenname) → `"cast"` (PostgreSQL-reserviertes Wort)

---

## Datenbankschema

### Kern-Tabellen

#### `users`
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | SERIAL PK | |
| `email` | TEXT UNIQUE NOT NULL | Login-E-Mail |
| `password_hash` | TEXT NOT NULL | bcrypt(12) |
| `name` | TEXT | Anzeigename |
| `role` | TEXT | Site-Rolle: `admin` / `user` |
| `created_at` | TIMESTAMPTZ | Auto-Timestamp |

#### `projects`
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | SERIAL PK | |
| `title` | TEXT NOT NULL | Projekttitel |
| `genre` | TEXT | z.B. Drama, Komödie |
| `format` | TEXT | z.B. Kurzfilm, Spielfilm |
| `length_minutes` | INT | Laufzeit in Minuten |
| `status` | TEXT | Entwicklung / Vorproduktion / Produktion / Postproduktion / Abgeschlossen |
| `synopsis` | TEXT | Inhaltsbeschreibung |
| `director` | TEXT | Name Regie |
| `producer` | TEXT | Name Produktion |
| `dop` | TEXT | Director of Photography |
| `production_company` | TEXT | Produktionsfirma |
| `shoot_start` | TEXT | Erster Drehtag (YYYY-MM-DD) |
| `shoot_end` | TEXT | Letzter Drehtag (YYYY-MM-DD) |
| `owner_id` | INT FK→users | Ersteller |
| `archived` | BOOLEAN | Archiviert-Flag |
| `created_at` / `updated_at` | TIMESTAMPTZ | Auto-Timestamps |

#### `project_settings`
| Spalte | Typ | Beschreibung |
|---|---|---|
| `project_id` | INT FK→projects UNIQUE | |
| `default_call_time` | INT | Minuten seit Mitternacht (z.B. 420 = 07:00) |
| `default_wrap_time` | INT | Minuten seit Mitternacht |
| `turnaround_hours` | INT | Mindestruhezeit in Stunden (Standard 11) |
| `currency` | TEXT | z.B. EUR, USD |
| `country` | TEXT | Für Feiertagsberechnung |
| `logo_url` | TEXT | Firmenlogo-URL für PDFs |
| `header_color` | TEXT | Akzentfarbe für PDF-Header (Hex) |
| `vat_mode` | TEXT | Brutto/Netto-Modus für Budget |

#### `project_members`
| Spalte | Typ | Beschreibung |
|---|---|---|
| `project_id` | INT FK→projects | |
| `user_id` | INT FK→users | |
| `role` | TEXT | admin / producer / director / dept_head / read_only |
| UNIQUE | (project_id, user_id) | |

#### `audit_log`
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | SERIAL PK | |
| `project_id` | INT | |
| `user_id` | INT | |
| `user_name` | TEXT | Snapshot des Namens zum Zeitpunkt der Aktion |
| `action` | TEXT | z.B. CREATE, UPDATE, DELETE |
| `entity_type` | TEXT | z.B. scene, shoot_day, cast |
| `entity_id` | INT | ID der betroffenen Entität |
| `old_value` | TEXT | JSON-String des alten Zustands |
| `new_value` | TEXT | JSON-String des neuen Zustands |
| `created_at` | TIMESTAMPTZ | |

### Szenen & Drehbuch

#### `scenes`
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | SERIAL PK | |
| `project_id` | INT FK→projects | |
| `scene_number` | TEXT | z.B. "1", "1A", "42B" |
| `sort_order` | INT | Reihenfolge im Drehbuch |
| `title` | TEXT | Szenenname |
| `description` | TEXT | Kurzbeschreibung |
| `location_id` | INT FK→locations | Drehlocation |
| `int_ext` | TEXT | INT oder EXT |
| `day_night` | TEXT | TAG oder NACHT |
| `eighths` | INT | Seitenlänge in 1/8-Seiten |
| `estimated_minutes` | INT | Geschätzte Drehdauer |
| `shot_status` | TEXT | offen / abgedreht |
| `notes` | TEXT | Interne Notizen |

#### `scene_characters`
Viele-zu-Viele zwischen `scenes` und `characters`.
| Spalte | Typ |
|---|---|
| `scene_id` | INT FK→scenes |
| `character_id` | INT FK→characters |
| `role_in_scene` | TEXT |
| UNIQUE | (scene_id, character_id) |

#### `scene_inventory`
Requisiten-/Breakdown-Items pro Szene.
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | SERIAL PK | |
| `scene_id` | INT FK→scenes | |
| `item` | TEXT | Bezeichnung |
| `category` | TEXT | Requisite / Kostüm / Maske / SFX / Ton / etc. |
| `quantity` | INT | Menge |
| `notes` | TEXT | |

#### `screenplay_blocks`
Bausteine des Drehbuchs (block-basierter Editor).
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | SERIAL PK | |
| `project_id` | INT FK→projects | |
| `scene_id` | INT FK→scenes | |
| `sort_order` | INT | Reihenfolge innerhalb der Szene |
| `block_type` | TEXT | scene_heading / action / character / dialogue / parenthetical / transition / note / super / intercut |
| `content` | TEXT | Inhalt des Blocks |

#### `fdx_imports`
Protokoll von Final Draft Importen.
| Spalte | Typ |
|---|---|
| `id` | SERIAL PK |
| `project_id` | INT FK→projects |
| `filename` | TEXT |
| `imported_at` | TIMESTAMPTZ |
| `scene_count` | INT |

### Drehtage & Disposition

#### `shoot_days`
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | SERIAL PK | |
| `project_id` | INT FK→projects | |
| `day_number` | INT | Laufende Drehtagnummer |
| `date` | TEXT | YYYY-MM-DD |
| `status` | TEXT | Geplant / Abgedreht / Ausgefallen / Sperrtag / Drehfrei / Reisetag |
| `unit` | TEXT | Haupteinheit / 2. Einheit / etc. |
| `notes` | TEXT | |
| `catering_count` | INT | Anzahl Essenspositionen |
| `risk_notes` | TEXT | Sicherheitshinweise |

#### `shoot_day_scenes`
Viele-zu-Viele zwischen `shoot_days` und `scenes`.
| Spalte | Typ |
|---|---|
| `shoot_day_id` | INT FK→shoot_days |
| `scene_id` | INT FK→scenes |
| `sort_order` | INT |
| `estimated_minutes` | INT |
| UNIQUE | (shoot_day_id, scene_id) |

#### `call_sheets`
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | SERIAL PK | |
| `shoot_day_id` | INT FK→shoot_days UNIQUE | |
| `general_call` | INT | Allgemeiner Call in Minuten seit Mitternacht |
| `shooting_call` | INT | Drehbeginn in Minuten |
| `location_id` | INT FK→locations | |
| `weather_forecast` | TEXT | Wettervorhersage |
| `sunrise` | TEXT | HH:MM |
| `sunset` | TEXT | HH:MM |
| `notes` | TEXT | Allgemeine Hinweise |
| `safety_personnel` | TEXT | Sicherheitspersonal |

#### `call_sheet_entries`
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | SERIAL PK | |
| `call_sheet_id` | INT FK→call_sheets | |
| `person_type` | TEXT | cast oder crew |
| `person_id` | INT | ID aus `cast` oder `crew` |
| `call_time` | INT | Minuten seit Mitternacht |
| `pickup_location` | TEXT | Abholpunkt |
| `notes` | TEXT | |
| `sort_order` | INT | |

#### `daily_reports`
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | SERIAL PK | |
| `shoot_day_id` | INT FK→shoot_days UNIQUE | |
| `call_time` | INT | Tatsächlicher Call |
| `first_shot` | INT | Erste Einstellung (Minuten) |
| `lunch_in` | INT | Mittagspause Beginn |
| `lunch_out` | INT | Mittagspause Ende |
| `wrap` | INT | Drehschluss |
| `scenes_completed` | TEXT | JSON-Array von Scene-IDs |
| `scenes_partial` | TEXT | JSON-Array von Scene-IDs |
| `pages_shot` | INT | Gedrehte Seiten (1/8-Seiten) |
| `total_setups` | INT | Anzahl Einstellungen |
| `camera_rolls` | INT | |
| `sound_rolls` | INT | |
| `production_notes` | TEXT | Produktionsbericht |
| `notes` | TEXT | Interne Notizen |

#### `daily_report_cast`
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | SERIAL PK | |
| `daily_report_id` | INT FK→daily_reports | |
| `cast_id` | INT FK→cast | |
| `call_time` | INT | |
| `makeup_in` | INT | Maskenzeit |
| `on_set` | INT | Am Set |
| `wrap` | INT | Abschluss |

#### `drehplan_versions`
Gespeicherte Snapshots des Drehplans.
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | SERIAL PK | |
| `project_id` | INT FK→projects | |
| `name` | TEXT | Versionsname |
| `data` | TEXT | JSON-Snapshot aller Drehtage + Szenen |
| `created_at` | TIMESTAMPTZ | |

### Cast & Crew

#### `characters`
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | SERIAL PK | |
| `project_id` | INT FK→projects | |
| `name` | TEXT | Figurenname |
| `description` | TEXT | Charakterbeschreibung |
| `age_range` | TEXT | z.B. "25-35" |
| `gender` | TEXT | |
| `sort_order` | INT | |

#### `"cast"` *(in Anführungszeichen — PostgreSQL-Reserviertes Wort)*
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | SERIAL PK | |
| `project_id` | INT FK→projects | |
| `character_id` | INT FK→characters | |
| `actor_name` | TEXT | Name der Schauspieler:in |
| `email` | TEXT | |
| `phone` | TEXT | |
| `agent` | TEXT | Agenturname |
| `agency` | TEXT | |
| `fee_per_day` | INT | Tagesgage in Cent |
| `contract_type` | TEXT | z.B. Tagesgage, Pauschal |
| `availability_notes` | TEXT | |
| `photo` | TEXT | Foto-URL |

#### `crew`
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | SERIAL PK | |
| `project_id` | INT FK→projects | |
| `name` | TEXT | |
| `department` | TEXT | Regie / Produktion / Kamera / Ton / Licht / Maske / Kostüm / Aufnahmeleitung / etc. |
| `role` | TEXT | Position im Stab |
| `email` | TEXT | |
| `phone` | TEXT | |
| `fee_per_day` | INT | Tagesgage in Cent |
| `contract_type` | TEXT | |
| `sort_order` | INT | |
| `notes` | TEXT | |

### Locations

#### `locations`
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | SERIAL PK | |
| `project_id` | INT FK→projects | |
| `name` | TEXT | Motivname |
| `address` | TEXT | Straße + Hausnummer |
| `city` | TEXT | |
| `zip` | TEXT | PLZ |
| `country` | TEXT | |
| `lat` | REAL | GPS-Breitengrad |
| `lng` | REAL | GPS-Längengrad |
| `contact_name` | TEXT | Ansprechpartner |
| `contact_phone` | TEXT | |
| `contact_email` | TEXT | |
| `rental_fee_cents` | INT | Miete in Cent |
| `parking` | TEXT | Parkinformationen |
| `power_available` | BOOLEAN | Stromanschluss vorhanden |
| `photos` | TEXT | JSON-Array mit Foto-URLs |
| `notes` | TEXT | |

### Equipment

#### `equipment_lists`
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | SERIAL PK | |
| `project_id` | INT FK→projects | |
| `name` | TEXT | Listenname |
| `department` | TEXT | Abteilung |
| `shoot_day_id` | INT FK→shoot_days | Optional: Drehtag-Zuordnung |
| `notes` | TEXT | |

#### `equipment_items`
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | SERIAL PK | |
| `equipment_list_id` | INT FK→equipment_lists | |
| `item` | TEXT | Gerätename |
| `quantity` | INT | |
| `supplier` | TEXT | Verleih/Lieferant |
| `rental_per_day_cents` | INT | Tagesmiete in Cent |
| `total_days` | INT | |
| `total_cents` | INT | qty × rental × days (auto-berechnet) |
| `checked` | BOOLEAN | Abgehakt/vorhanden |
| `sort_order` | INT | |
| `notes` | TEXT | |

### Budget & Finanzierung

#### `budget_versions`
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | SERIAL PK | |
| `project_id` | INT FK→projects | |
| `name` | TEXT | Versionsname (z.B. "Kalkulation v1") |
| `status` | TEXT | Entwurf / Aktiv |
| `total_cents` | INT | Gesamtsumme (auto-aktualisiert) |

#### `budget_lines`
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | SERIAL PK | |
| `budget_version_id` | INT FK→budget_versions | |
| `category` | TEXT | z.B. "1000 - Stab" |
| `account_code` | TEXT | z.B. "1100" |
| `description` | TEXT | |
| `unit` | TEXT | Tage / Pauschal / etc. |
| `quantity` | INT | Menge |
| `unit_price_cents` | INT | Einzelpreis in Cent |
| `total_cents` | INT | qty × price (auto-berechnet) |
| `sort_order` | INT | |

#### `financing_plan_versions`
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | SERIAL PK | |
| `project_id` | INT FK→projects | |
| `name` | TEXT | |
| `total_cents` | INT | Gesamtfinanzierung |

#### `financing_entries`
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | SERIAL PK | |
| `financing_version_id` | INT FK→financing_plan_versions | |
| `source` | TEXT | Geldgeber (z.B. "FilmFernsehFonds Bayern") |
| `type` | TEXT | Förderung / Eigenmittel / Sender / etc. |
| `amount_cents` | INT | |
| `confirmed` | BOOLEAN | Zugesagt oder nicht |
| `sort_order` | INT | |

#### `budget_alerts`
| Spalte | Typ | Beschreibung |
|---|---|---|
| `project_id` | INT FK→projects UNIQUE | |
| `threshold_percent` | INT | Auslöseschwelle (Standard 80%) |
| `enabled` | BOOLEAN | |

### Shots (Shotlist)

#### `shots`
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | SERIAL PK | |
| `project_id` | INT FK→projects | |
| `scene_id` | INT FK→scenes | |
| `shoot_day_id` | INT FK→shoot_days | Optional |
| `shot_number` | TEXT | z.B. "E1", "E2A" |
| `sort_order` | INT | |
| `size` | TEXT | Totale / Halbnahe / Nahe / Groß / Detail / etc. |
| `movement` | TEXT | Statisch / Dolly / Schwenk / Handkamera / Kran / etc. |
| `lens_mm` | INT | Brennweite |
| `description` | TEXT | Einstellungsbeschreibung |
| `notes` | TEXT | |
| `storyboard_url` | TEXT | |
| `duration_seconds` | INT | Geschätzte Länge |
| `done` | BOOLEAN | Abgehakt |

#### `storyboard_frames`
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | SERIAL PK | |
| `shot_id` | INT FK→shots | |
| `frame_number` | INT | |
| `image_url` | TEXT | |
| `description` | TEXT | |

### Post-Produktion & Management

#### `post_phases`
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | SERIAL PK | |
| `project_id` | INT FK→projects | |
| `phase` | TEXT | Rohschnitt / Feinschnitt / Tonmischung / Farbkorrektur / Abnahme / etc. |
| `start_date` | TEXT | YYYY-MM-DD |
| `end_date` | TEXT | YYYY-MM-DD |
| `status` | TEXT | Ausstehend / Laufend / Abgeschlossen |
| `responsible` | TEXT | Verantwortliche Person |
| `notes` | TEXT | |
| `sort_order` | INT | |

#### `music_cues`
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | SERIAL PK | |
| `project_id` | INT FK→projects | |
| `title` | TEXT | Musiktitel |
| `composer` | TEXT | Komponist:in |
| `publisher` | TEXT | Verlag |
| `cue_type` | TEXT | Original / Lizenz / GEMA-frei |
| `usage_type` | TEXT | Unterlegt / Atmo / Haupttitel / Abspann / etc. |
| `duration_seconds` | INT | Länge in Sekunden |
| `notes` | TEXT | z.B. GEMA-Hinweise |

#### `vfx_shots`
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | SERIAL PK | |
| `project_id` | INT FK→projects | |
| `scene_id` | INT FK→scenes | |
| `shot_number` | TEXT | z.B. "VFX-001" |
| `description` | TEXT | |
| `vfx_type` | TEXT | Compositing / Matte Painting / CGI / etc. |
| `status` | TEXT | Offen / In Arbeit / Review / Abgenommen |
| `artist` | TEXT | Zugeteilte:r VFX-Artist |
| `deadline` | TEXT | YYYY-MM-DD |
| `complexity` | TEXT | Niedrig / Mittel / Hoch |
| `notes` | TEXT | |

#### `insurances`
| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | SERIAL PK | |
| `project_id` | INT FK→projects | |
| `ins_type` | TEXT | Filmversicherung / Haftpflicht / Equipment / etc. |
| `provider` | TEXT | Versicherungsunternehmen |
| `policy_number` | TEXT | Policennummer |
| `coverage_amount_cents` | INT | Deckungssumme in Cent |
| `premium_cents` | INT | Jahresprämie in Cent |
| `start_date` | TEXT | YYYY-MM-DD |
| `end_date` | TEXT | YYYY-MM-DD |
| `notes` | TEXT | |
| `sort_order` | INT | |

### Weitere Tabellen

#### `vehicles`
Produktionsfahrzeuge: `name`, `license_plate`, `type` (PKW/Transporter/LKW/Bus/Motorrad), `capacity`, `driver_name`, `driver_phone`, `notes`.

#### `extras`
Komparsen: `name`, `phone`, `email`, `tariff_group` (Standard/Ver.di/etc.), `notes`.

#### `camera_presets`
Kamera-Setups: `name`, `camera` (Kamera-Body), `lenses` (Objektive), `notes`.

#### `sticky_notes`
Pinnwand-Notizen: `content`, `color` (Hex), `position_x`, `position_y` (freie Positionierung), `created_by`.

#### `project_events`
Kalender-Ereignisse: `title`, `start_date`, `end_date`, `type`, `color`, `notes`, `all_day`.

#### `comments`
Entitäts-Kommentare: `entity_type`, `entity_id`, `author`, `content`, `resolved`.

#### `email_log`
Gesendete E-Mails: `subject`, `recipients` (JSON), `body`, `sent_at`.

#### `guest_tokens`
Öffentliche Tokens: `token` (64-Hex), `project_id`, `shoot_day_id` (optional), `expires_at` (optional).

#### `project_invites`
Einladungslinks: `token` (40-Hex), `role`, `label`, `created_by`, `expires_at` (optional).

---

## Auth & Rollen

### JWT-Authentifizierung
- Token: 30 Tage Gültigkeit, signiert mit `JWT_SECRET`
- Transport: `Authorization: Bearer <token>` Header
- Client: Token in `localStorage`, wird von `AuthContext` verwaltet
- Middleware: `requireAuth` (blockiert ohne gültiges Token), `optionalAuth` (befüllt `req.user` wenn Token vorhanden, blockiert nie), `requireRole(...roles)` (Site-Level-Gate)

### Site-Level Rollen (`users.role`)
| Rolle | Beschreibung |
|---|---|
| `admin` | Zugang zu `/api/admin/*`, kann alle Projekte sehen/verwalten, umgeht alle Projektprüfungen |
| `user` | Standard für alle registrierten Nutzer außer dem ersten |

Der erste registrierte Nutzer wird automatisch zum Site-Admin.

### Projektebene Rollen (`project_members.role`)
| Rolle | Rang | Berechtigungen |
|---|---|---|
| `admin` | 5 | Vollzugriff: Settings, Members, Invites, alle Schreiboperationen |
| `producer` | 4 | Alle Schreiboperationen + Budget/Finanzierung |
| `director` | 3 | Alle Schreiboperationen (Szenen, Drehplan, Drehbuch, etc.) |
| `dept_head` | 2 | Standard-Schreibzugriff (Cast, Crew, Equipment, etc.) |
| `read_only` | 1 | Nur Lesezugriff — zeigt roten Banner in der UI |

Der Projekt-Besitzer (`owner_id`) hat immer Admin-Zugriff auf sein Projekt.

### `projectWriteGuard` Middleware
Intercepts alle Nicht-GET-Anfragen an `/api`:
1. Extrahiert `project_id` aus URL-Parametern oder Request-Body
2. Schlägt Projektrolle des Nutzers nach
3. Vergleicht mit Mindest-Rang der Route:
   - Budget/Finanzierung: `producer` (Rang 4) oder höher
   - Settings/Invites/Members: `admin` (Rang 5)
   - Drehplan-Versionen: `producer` oder höher
   - Alle anderen Schreibrouten: `dept_head` (Rang 2) oder höher

### Client-Side Permissions (`ProjectRoleContext`)
| Flag | Bedingung |
|---|---|
| `canEdit` | Rang ≥ dept_head (2) |
| `canEditScenes` | Rang ≥ director (3) |
| `canEditBudget` | Rang ≥ producer (4) |
| `canAdmin` | Rang = admin (5) |

---

## Seiten & Funktionen

### `/login` — Anmeldung & Registrierung
- Zwei Tabs: Anmelden / Registrieren
- Sprachwahl (DE/EN/FR) oben im Formular
- Nach Registrierung: Tutorial-Modal einmalig anzeigen (`justRegistered`-Flag)
- JWT wird in `localStorage` gespeichert

### `/projects` — Projektliste
- Listet alle eigenen Projekte + Projekte als Mitglied
- Status-Farbcodierung mit linkem Akzentbalken: Entwicklung (grau), Vorproduktion (blau), Produktion (amber), Postproduktion (violett), Abgeschlossen (grün)
- Projekt erstellen (Dialog: Titel, Genre, Format, Laufzeit, Regie, Produktion)
- Archivieren / Wiederherstellen
- Duplizieren (kopiert Metadaten, ohne Szenen/Drehtage)
- Löschen (nach Bestätigung)
- Toggle: Archivierte anzeigen/ausblenden
- Stagger-Animation beim Laden der Liste

### `/invite/:token` — Einladung annehmen
- Öffentlich zugänglich (kein Login nötig zum Anzeigen)
- Zeigt Projektname + zuzuteilende Rolle
- Eingeloggte Nutzer: „Einladung annehmen"-Button → werden Projektmitglied
- Ausgeloggte Nutzer: Weiterleitung zu Login/Registrierung

### `/projects/:id/` — Dashboard
**Daten**: Projektdetails, Projekt-Stats, Konflikte

**Sektionen**:
- **Hero**: Projekttitel (1.85rem bold), Metadata-Chips (Format · Genre · Laufzeit · Status), Synopsistext (2 Zeilen), Countdown-Box mit Tagen bis nächstem Drehtag
- **4 Stat-Cards** (stagger-animiert): Szenen (+ im Plan), Drehtage (+ abgedreht), Cast-Anzahl, Stab-Anzahl — jede Card mit farbigem Icon-Kreis und 2.25rem-Zahl
- **Fortschrittskarte**: 3 animierte Donut-Ringe (96px, 7px Stroke) für Terminplanung %, Drehtage %, abgedrehte Szenen %; darunter Budget vs. Finanzierung mit Progress-Bar und Prozentanzeige
- **Nächster Drehtag**: Drehtag-Nummer (4xl bold), Datum, "heute/morgen/in N Tagen", Link zur Tagesdisposition; radial gradient als Lichteffekt
- **Konflikt-Radar Mini**: Fehler/Warnungen/Hinweise mit farbigen Punkten + Zahl rechts
- **Schnellzugriff**: 6 Buttons mit farbigen Icon-Kreisen (Drehplan, Szenen, Besetzung, Motive, Budget, Tagesdispo)

### `/projects/:id/stammdaten` — Projektdaten
- **Projektinfo**: Titel, Genre, Format, Laufzeit, Synopsis, Regie, Produzent, DoP, Produktionsfirma, Drehdaten, Status — Auto-Save mit Debounce
- **Projekteinstellungen**: Standard-Call-Zeit, Turnaround-Stunden, Währung, Land, Akzentfarbe (für PDFs), Logo-Upload
- **Team**: Alle Projektmitglieder mit Rollen; Einladungslinks erstellen (Rolle + Label), Link kopieren, QR-Code anzeigen, Einladung löschen

### `/projects/:id/drehbuch` — Szenenübersicht
- Sortierbare Tabelle aller Szenen
- Filtern nach INT/EXT, Tag/Nacht, Status (Offen/Abgedreht)
- Suche in Szenen
- Szene erstellen (Inline oder Dialog)
- Szene als abgedreht/offen markieren (Ein-Klick)
- Aufklappen: Alle Felder bearbeiten (Nummer, Titel, INT/EXT, Tag/Nacht, Location, 1/8-Seiten, Beschreibung)
- **Figuren verwalten**: Charaktere zu Szene hinzufügen/entfernen
- **Inventar/Breakdown**: Props pro Szene nach Kategorie (Requisite, Kostüm, Maske, SFX, Ton, etc.)
- **Szenen importieren**: Text-Import-Parser für `N INT. LOCATION — TAG`-Format
- Stats-Leiste: Gesamt-Szenen, Gesamt-Seiten (1/8), Geschätzte Laufzeit

### `/projects/:id/screenplay-editor` — Drehbuch-Editor
- Block-basierter Editor mit linker Szenen-Liste und rechtem Editor-Bereich
- **Block-Typen**: scene_heading, action, character, dialogue, parenthetical, transition, note, super/title card, intercut
- **Charakter-Suffixe**: V.O., O.S., O.C., CONT'D
- **Tastatursteuerung**: Enter → neuer Block, Tab → Block-Typ wechseln, Backspace auf leerem Block → löschen
- Auto-Save bei Änderungen (debounced)
- **FDX-Import**: Final Draft XML → Szenen + Blöcke automatisch erzeugen
- **PDF-Export**: Drehbuch als formatiertes PDF (Courier-Schrift, Drehbuchformat)
- **Fountain-Export**: Export als Plain-Text im Fountain-Standard

### `/projects/:id/besetzung` — Casting
- **Charaktere-Tab**: Erstellen/Bearbeiten mit Name, Beschreibung, Altersrange, Geschlecht, Reihenfolge; zeigt welche Szenen die Figur hat
- **Cast-Tab**: Schauspieler:innen mit Rollenverknüpfung, Kontaktdaten, Agent, Tagesgage, Vertragsart, Foto; zeigt Szenen- und Drehtag-Anzahl
- Alle E-Mail-Adressen kopieren
- PDF-Export (Besetzungsliste)

### `/projects/:id/stabliste` — Stabliste
- Nach Abteilung gruppierte Crew-Liste
- Erstellen/Bearbeiten: Name, Abteilung, Position, E-Mail, Telefon, Tagesgage, Vertragsart, Notizen
- Abteilungen: Regie, Produktion, Kamera, Ton, Licht, Maske, Kostüm, Aufnahmeleitung, etc.
- Drag-and-Drop Sortierung innerhalb Abteilungen
- E-Mail-Adressen einzeln oder alle kopieren
- Gesamttagesgage-Berechnung
- CSV-Export + PDF-Export (Stabliste)

### `/projects/:id/kontakte` — Kontaktliste
- Kombinierte Übersicht aller Kontakte: Cast + Crew + Location-Ansprechpartner
- Filterbar nach Typ (Alle / Crew / Cast)
- Alle E-Mails in Zwischenablage kopieren
- Durchsuchbar

### `/projects/:id/motive` — Locations
- Karten- oder Tabellenansicht aller Drehorte
- Erstellen/Bearbeiten: Name, Adresse, Stadt, PLZ, Land, GPS-Koordinaten (Kartenauswahl), Ansprechpartner (Name/Telefon/E-Mail), Miete, Parkinfos, Stromanschluss, Notizen
- Mehrere Fotos hochladbar (gespeichert als JSON-Array)
- Zeigt welche Szenen an diesem Ort gedreht werden
- PDF-Export (Motivliste)

### `/projects/:id/equipment` — Equipment
- Mehrere Listen pro Projekt, nach Abteilung gruppiert
- Pro Liste: Name, Abteilung, optionale Drehtag-Zuordnung
- Pro Item: Name, Menge, Verleih, Tagesmiete, Tage, Gesamtkosten (auto-berechnet), abgehakt/nicht, Notizen
- Budget-Alert-Banner wenn Ausgaben Schwellenwert überschreiten
- PDF-Export aller Listen

### `/projects/:id/fahrzeuge` — Fahrzeuge
- Tabelle der Produktionsfahrzeuge
- Felder: Name, Kennzeichen, Typ (PKW/Transporter/LKW/Bus/Motorrad), Kapazität, Fahrer:in, Fahrer-Telefon, Notizen
- Vollständiges CRUD

### `/projects/:id/komparsen` — Komparsen
- Tabelle der Statist:innen/Komparsen
- Felder: Name, Telefon, E-Mail, Tarifgruppe (Standard, Ver.di, etc.), Notizen
- Vollständiges CRUD + CSV-Export

### `/projects/:id/drehplan` — Drehplan (Kanban)
**Komplexeste Seite der App — Drag-and-Drop Shooting Schedule**

- **Szenen-Pool** (links): Alle nicht eingeplanten Szenen als ziehbare Strips
- **Drehtag-Spalten**: Eine Spalte pro Drehtag mit Datum, Status und Szenen-Strips
- **Drag-and-Drop** via DnD Kit: Szenen vom Pool in Drehtage, zwischen Drehtagen, innerhalb eines Drehtages sortieren
- **Drehtage erstellen**: Einzelnes Datum oder Datumsbereich (bis 60 Tage auf einmal)
- **Pro Drehtag**: Status ändern (Geplant/Abgedreht/Ausgefallen/Sperrtag/Drehfrei/Reisetag), löschen, Notizen
- **Drehplan-Versionen**: Benannte Snapshots speichern, beliebige Version wiederherstellen, Versionen löschen
- **PDF-Export** des gesamten Drehplans

**Szenen-Strip-Farbcodierung**:
- INT/TAG → amber
- EXT/TAG → grün
- INT/NACHT → indigo
- EXT/NACHT → teal

### `/projects/:id/staebchenplan` — Stäbchenplan
- Visueller Stripboard (Alternative Drehplan-Ansicht)
- Horizontale farbige Strips nach Drehtag organisiert
- Zeigt: Szenen-Nummer, Titel, INT/EXT-Badge, Tag/Nacht-Badge, 1/8-Seiten, Location-Name, Charakter-Anzahl
- Spalten-Statistiken: Gesamtseiten, Geschätzte Zeit
- Sortierung innerhalb Drehtage

### `/projects/:id/shotlist` — Shotlist
- Shots gruppiert nach Szene
- Pro Shot: Nummer, Einstellungsgröße (Totale/Halbnahe/Nahe/Groß/Detail/etc.), Bewegung (Statisch/Dolly/Schwenk/Handkamera/Kran/etc.), Brennweite (mm), Beschreibung, Dauer, abgehakt
- Drag-and-Drop Sortierung innerhalb Szenen
- **Kamera-Presets Panel**: Gespeicherte Kamera-Setups (Body + Objektive) abrufbar
- PDF-Export

### `/projects/:id/tagesdispo` — Tagesdisposition
- Linke Sidebar: Liste aller Drehtage (Datum, Nummer, Status)
- Für ausgewählten Tag:
  - **Header**: Allg. Call, Drehbeginn, Location, Wetter, Sonnenauf/-untergang
  - **Wetter-Auto-Import**: Wettervorhersage basierend auf Location-Adresse abrufen
  - **Szenen des Tages**: Nur-Lesen-Liste der geplanten Szenen
  - **Dispositions-Tabelle**: Cast und Crew mit Call-Zeiten, Abholpunkt, Notizen — Inline-Bearbeitung
  - **Person hinzufügen**: Auswahl aus Projekt-Cast/Crew (noch nicht in Sheet)
  - **Alle Zeiten verschieben**: Bulk-Shift aller Call-Zeiten um N Minuten
  - **Catering-Anzahl**, Allgemeine Notizen
  - **Gast-Token erstellen**: Öffentlich-teilbarer Link (optional: nur für diesen Drehtag, optional: Ablaufdatum) für nicht-registrierte Betrachter
  - **PDF-Export** der Tagesdisposition

### `/projects/:id/tagesbericht` — Tagesbericht
- Pro Drehtag:
  - Call-Zeit, erste Einstellung, Mittagspause (Ein/Aus), Drehschluss
  - Abgedrehte Szenen (Multi-Select), angedrehte Szenen
  - Gedrehte Seiten (1/8-Seiten), Setups, Kamera- und Tonrollen
  - Produktionsbericht (Fließtext), interne Notizen
  - Cast-Zeiten: Maske rein, am Set, Schluss pro Schauspieler:in
  - PDF-Export

### `/projects/:id/budget` — Budget & Finanzierung
**Sub-Tab: Budget**
- Mehrere Budget-Versionen (Entwurf / Aktiv)
- Pro Version: Zeilenpositionen nach Kategorie (mit Kontonummer, Beschreibung, Einheit, Menge, Einzelpreis, Gesamtpreis)
- Inline-Bearbeitung aller Felder
- Auto-Neuberechnung der Gesamtsumme
- Budget-Alert-Schwellenwert konfigurieren (Standard 80%)
- Zusammenfassungs-Widget: % ausgegeben

**Sub-Tab: Finanzierung**
- Finanzierungsplan-Versionen
- Einträge nach Geldgeber/Typ (Förderung/Eigenmittel/Sender/etc.), Betrag, Zugesagt-Status
- Lücken-Anzeige: Budget − Finanzierung
- PDF-Export der Kalkulation

### `/projects/:id/kalender` — Terminkalender
- Monatsansicht mit Projekt-Events
- Events: Titel, Startdatum, optionales Enddatum, Typ (Meeting/Casting/Locationscout/Drehtag/etc.), Farbe, Notizen, Ganztags-Flag
- Nationale Feiertage (länderspezifisch aus `project_settings.country`)
- Vollständiges CRUD: Tag anklicken → Event erstellen; Event anklicken → bearbeiten/löschen

### `/projects/:id/email` — E-Mail-Center
- Empfänger aus Projekt-Cast/Crew auswählen
- Betreff und Nachrichtentext
- Gesendete E-Mails werden in `email_log` protokolliert
- Verlauf gesendeter E-Mails einsehbar
- *Hinweis: Versendet über internes Log, kein SMTP konfiguriert*

### `/projects/:id/konfliktradar` — Konfliktradar
Automatische Prüfung von 11 Konflikt-Typen:
1. Szenen mehrfach in verschiedenen Drehtagen eingeplant (Fehler)
2. Szenen ohne Drehtag (Warnung)
3. Leere Drehtage ohne Szenen (Warnung)
4. Cast ohne Charakter-Zuordnung (Hinweis)
5. Szenen ohne Location (Hinweis)
6. Locations ohne Adresse (Hinweis)
7. Budget-Finanzierungs-Lücke > 50€ (Warnung)
8. Keine Budget-Version vorhanden (Hinweis)
9. Szenen ohne zugewiesene Figuren (Hinweis)
10. Turnaround-Verletzungen (Cast/Crew unter Mindestruhezeit) (Warnung)
11. Mehrere Drehtage am gleichen Kalendertag (Warnung)

Ergebnisse nach Schweregrad + Kategorie gruppiert, jeder Konflikt mit Link zur relevanten Seite.

### `/projects/:id/pinboard` — Pinnwand
- Frei positionierbare Sticky Notes auf großer Leinwand
- Drag-and-Drop zur freien Platzierung
- Farben: gelb, blau, grün, lila
- Inline-Bearbeitung des Inhalts
- Erstellen, verschieben, löschen

### `/projects/:id/audit` — Audit-Log
- Letzte 200 Aktionen des Projekts
- Zeigt: Zeitstempel, Nutzername, Aktion, Entitätstyp, Entitäts-ID, alter Wert, neuer Wert
- Nur-Lesen-Ansicht

### `/projects/:id/suche` — Suche
- Dedizierte Suchseite (Vollbild-Version der globalen Suche)
- Sucht in: Szenen (Titel, Nummer, Beschreibung), Drehbuch-Blöcke (Inhalt), Cast (Name), Crew (Name, Position), Locations (Name, Stadt, Adresse)
- Ergebnisse mit Typ, Titel, Untertitel, Textausschnitt
- Klick auf Ergebnis → Navigation zur relevanten Seite

### `/projects/:id/vfx` — VFX-Tracking
- Tabelle der VFX-Shots
- Felder: Shot-Nummer, Szene, Beschreibung, VFX-Typ (Compositing/Matte Painting/CGI/etc.), Status (Offen/In Arbeit/Review/Abgenommen), Künstler:in, Deadline, Komplexität (Niedrig/Mittel/Hoch)
- Filter nach Status/Typ
- Vollständiges CRUD

### `/projects/:id/postplan` — Postplan
- Post-Produktions-Phasen mit: Phasenname, Start/Enddatum, Status, Verantwortliche Person, Notizen
- Visuelle Gantt-ähnliche Darstellung
- Vollständiges CRUD mit Drag-and-Drop-Sortierung

### `/projects/:id/musikliste` — Musikliste
- Musik-Cue-Blatt
- Felder: Titel, Komponist:in, Verlag, Cue-Typ (Original/Lizenz/GEMA-frei), Verwendungstyp (Unterlegt/Atmo/Haupttitel/etc.), Dauer, verknüpfte Szene, Notizen
- Vollständiges CRUD

### `/projects/:id/versicherungen` — Versicherungen
- Tabelle der Versicherungsverträge
- Felder: Typ, Anbieter, Policennummer, Deckungssumme, Prämie, Laufzeit, Notizen
- Vollständiges CRUD

### `/projects/:id/benutzer` — Benutzerverwaltung (Projekt)
- Alle Projektmitglieder mit Rollen (nur Admin/Producer)
- Rollen ändern, Mitglieder entfernen
- Aktive Einladungslinks verwalten (erstellen, löschen, QR-Code)

### `/settings` — Einstellungen (persönlich)
- **Account**: Anzeigename bearbeiten (E-Mail ist unveränderlich)
- **Sicherheit**: Passwort ändern (aktuelles Passwort erforderlich, min. 6 Zeichen)
- **Darstellung**: Dark/Light Mode, Sprachauswahl (DE/EN/FR)

### `/admin` — Admin-Panel (Site-Admin)
- **Statistiken**: Nutzer gesamt, Projekte, Szenen, Drehtage, Stab, Drehbuch-Blöcke; Neu in 7 Tagen; Top-5-Nutzer; neueste Projekte
- **Nutzerverwaltung**: Alle Nutzer mit E-Mail, Name, Rolle, Projektanzahl, letztes aktives Projekt. Aktionen: Rolle ändern, Passwort zurücksetzen, löschen, neuen Nutzer erstellen
- **Projektverwaltung**: Alle Projekte mit Besitzer, Statistiken, Status. Aktionen: Projekt löschen
- **Demo-Daten neu laden**: „Sprachlos"-Projekt löschen und komplett neu anlegen (`POST /api/admin/reseed`)

---

## API-Endpunkte

### Authentifizierung — `/api/auth/*`
| Methode | Pfad | Funktion | Auth |
|---|---|---|---|
| POST | `/api/auth/register` | Konto erstellen; erster Nutzer wird Site-Admin; gibt JWT zurück | — |
| POST | `/api/auth/login` | Anmelden; gibt JWT zurück | — |
| GET | `/api/auth/me` | Aktuellen Nutzer abrufen | JWT |
| PUT | `/api/auth/me` | Anzeigename aktualisieren | JWT |
| PUT | `/api/auth/me/password` | Passwort ändern (aktuelles erforderlich) | JWT |
| GET | `/api/auth/users` | Alle Nutzer auflisten | JWT + Site-Admin |
| PUT | `/api/auth/users/:id/role` | Nutzer-Site-Rolle ändern | JWT + Site-Admin |
| DELETE | `/api/auth/users/:id` | Nutzer löschen (nicht sich selbst) | JWT + Site-Admin |

### Projekte — `/api/projects/*`
| Methode | Pfad | Funktion | Auth |
|---|---|---|---|
| GET | `/api/projects` | Eigene + Mitglieds-Projekte. `?archived=1` für Archiv. Admins sehen alles. | JWT |
| POST | `/api/projects` | Projekt erstellen; Ersteller wird Admin-Mitglied | JWT |
| GET | `/api/projects/:id` | Projekt mit Settings + `my_role` | JWT + Mitglied |
| PUT | `/api/projects/:id` | Projekt-Metadaten aktualisieren | JWT + Mitglied |
| DELETE | `/api/projects/:id` | Projekt löschen (nur Besitzer oder Site-Admin) | JWT |
| PATCH | `/api/projects/:id/archive` | Archivieren/Wiederherstellen | JWT |
| PUT | `/api/projects/:id/settings` | Projekt-Settings aktualisieren | JWT + Admin |
| GET | `/api/projects/:id/stats` | Dashboard-Statistiken | JWT + Mitglied |
| POST | `/api/projects/:id/duplicate` | Projekt duplizieren (nur Metadaten) | JWT + Mitglied |
| GET | `/api/projects/:id/members` | Mitglieder auflisten | JWT + Mitglied |
| POST | `/api/projects/:id/members` | Mitglied hinzufügen | JWT + Producer+ |
| PUT | `/api/projects/:id/members/:userId/role` | Projektrolle ändern | JWT + Producer+ |
| DELETE | `/api/projects/:id/members/:userId` | Mitglied entfernen | JWT + Producer+ |

### Szenen
| Methode | Pfad | Funktion |
|---|---|---|
| GET | `/api/projects/:pid/scenes` | Alle Szenen mit Charakteren und Inventar |
| POST | `/api/projects/:pid/scenes` | Szene erstellen (auto-erstellt leeren Action-Block) |
| PUT | `/api/scenes/:id` | Szene aktualisieren |
| DELETE | `/api/scenes/:id` | Szene löschen |
| POST | `/api/scenes/:id/characters` | Charakter zur Szene hinzufügen |
| DELETE | `/api/scenes/:id/characters/:charId` | Charakter aus Szene entfernen |
| POST | `/api/scenes/:id/inventory` | Inventar-Item hinzufügen |
| DELETE | `/api/scenes/:id/inventory/:itemId` | Inventar-Item entfernen |
| POST | `/api/projects/:pid/scenes/import` | Szenen aus Text-Format importieren |

### Drehplan / Drehtage
| Methode | Pfad | Funktion |
|---|---|---|
| GET | `/api/projects/:pid/shoot-days` | Alle Drehtage mit Szenen |
| POST | `/api/projects/:pid/shoot-days` | Drehtag erstellen |
| POST | `/api/projects/:pid/shoot-days/batch` | Mehrere Drehtage aus Datums-Array erstellen |
| PUT | `/api/shoot-days/:id` | Drehtag aktualisieren |
| DELETE | `/api/shoot-days/:id` | Drehtag löschen (renummeriert verbleibende) |
| POST | `/api/shoot-days/:id/scenes` | Szene zu Drehtag hinzufügen |
| DELETE | `/api/shoot-days/:dayId/scenes/:sceneId` | Szene aus Drehtag entfernen |
| PUT | `/api/shoot-days/:id/scenes/reorder` | Szenen innerhalb eines Drehtages sortieren |
| POST | `/api/shoot-days/move-scene` | Szene zwischen Drehtagen oder zum Pool verschieben |
| GET | `/api/projects/:pid/drehplan/versions` | Gespeicherte Drehplan-Snapshots auflisten |
| POST | `/api/projects/:pid/drehplan/snapshot` | Benannten Snapshot speichern |
| POST | `/api/projects/:pid/drehplan/restore/:versionId` | Snapshot wiederherstellen |
| DELETE | `/api/drehplan-versions/:id` | Snapshot löschen |

### Tagesdisposition & Tagesbericht
| Methode | Pfad | Funktion |
|---|---|---|
| GET | `/api/shoot-days/:dayId/call-sheet` | Tagesdisposition + Einträge |
| POST | `/api/shoot-days/:dayId/call-sheet` | Tagesdisposition erstellen |
| PUT | `/api/call-sheets/:id` | Header-Felder aktualisieren |
| POST | `/api/call-sheets/:id/entries` | Person zur Disposition hinzufügen |
| PUT | `/api/call-sheet-entries/:id` | Call-Zeit/Abholpunkt/Notiz ändern |
| DELETE | `/api/call-sheet-entries/:id` | Person aus Disposition entfernen |
| GET | `/api/shoot-days/:dayId/daily-report` | Tagesbericht |
| POST | `/api/shoot-days/:dayId/daily-report` | Tagesbericht erstellen |
| PUT | `/api/daily-reports/:id` | Tagesbericht aktualisieren |

### Drehbuch / Screenplay
| Methode | Pfad | Funktion |
|---|---|---|
| GET | `/api/projects/:pid/screenplay` | Alle Szenen mit Blöcken |
| GET | `/api/scenes/:sceneId/blocks` | Blöcke einer Szene |
| POST | `/api/scenes/:sceneId/blocks` | Block erstellen |
| PUT | `/api/blocks/:blockId` | Block-Inhalt/Typ aktualisieren |
| DELETE | `/api/blocks/:blockId` | Block löschen |
| PUT | `/api/scenes/:sceneId/blocks/reorder` | Blöcke sortieren |
| POST | `/api/projects/:pid/screenplay/import-fdx` | Final Draft FDX importieren |
| GET | `/api/projects/:pid/screenplay/export-fountain` | Als Fountain-Text exportieren |

### Shotlist
| Methode | Pfad | Funktion |
|---|---|---|
| GET | `/api/projects/:pid/shots` | Alle Shots (optionale Szenen/Tag-Filter) |
| POST | `/api/projects/:pid/shots` | Shot erstellen |
| PUT | `/api/shots/:id` | Shot aktualisieren |
| DELETE | `/api/shots/:id` | Shot löschen |
| PUT | `/api/scenes/:sceneId/shots/reorder` | Shots sortieren |

### Budget & Finanzierung
| Methode | Pfad | Auth | Funktion |
|---|---|---|---|
| GET/POST | `/api/projects/:pid/budget-versions` | Mitglied / Producer+ | Versionen |
| PUT/DELETE | `/api/budget-versions/:id` | Producer+ | Version aktualisieren/löschen |
| GET/POST | `/api/budget-versions/:id/lines` | Mitglied / Producer+ | Zeilen |
| PUT/DELETE | `/api/budget-lines/:id` | Producer+ | Zeile aktualisieren/löschen |
| GET/POST | `/api/projects/:pid/financing-plan-versions` | Mitglied / Producer+ | Finanzierungspläne |
| GET/POST | `/api/financing-plan-versions/:id/entries` | Mitglied / Producer+ | Finanzierungseinträge |
| PUT/DELETE | `/api/financing-entries/:id` | Producer+ | Eintrag aktualisieren/löschen |
| GET | `/api/projects/:pid/budget-summary` | Mitglied | Nutzungs-% + Alert-Status |
| GET/PUT | `/api/projects/:pid/budget-alerts` | Mitglied / Producer+ | Alert-Konfiguration |

### Einladungen
| Methode | Pfad | Auth | Funktion |
|---|---|---|---|
| GET | `/api/projects/:id/invites` | Projekt-Admin | Aktive Einladungslinks |
| POST | `/api/projects/:id/invites` | Projekt-Admin | Einladungslink erstellen (Rolle + Label + Ablauf) |
| DELETE | `/api/projects/:id/invites/:iid` | Projekt-Admin | Einladungslink löschen |
| GET | `/api/invites/:token` | — | Öffentlich: Projektname + Rolle abrufen |
| POST | `/api/invites/:token/accept` | JWT | Einladung annehmen → Projektmitglied werden |

### Gast-Tokens
| Methode | Pfad | Auth | Funktion |
|---|---|---|---|
| POST | `/api/projects/:pid/guest-tokens` | JWT | Token erstellen (optional: Drehtag-Scope, Ablaufdatum) |
| GET | `/api/guest/:token` | — | Öffentlich: Tagesdisposition ohne Login abrufen |

### Suche & Konflikte
| Methode | Pfad | Funktion |
|---|---|---|
| GET | `/api/projects/:pid/search?q=<query>` | Volltext-Suche über Szenen, Drehbuch, Cast, Crew, Locations |
| GET | `/api/projects/:pid/conflicts` | 11 Konflikt-Typen prüfen + zurückgeben |

### Backup & Import
| Methode | Pfad | Funktion |
|---|---|---|
| GET | `/api/projects/:pid/backup` | Vollständiges Projekt als JSON exportieren (alle Tabellen) |
| POST | `/api/projects/import` | JSON-Backup als neues Projekt importieren (ID-Remapping) |

### PDF-Export (alle: JWT + Mitglied)
| Endpoint | PDF-Inhalt |
|---|---|
| GET `/api/projects/:pid/pdf/drehplan` | Vollständiger Drehplan |
| GET `/api/shoot-days/:dayId/pdf/tagesdispo` | Tagesdisposition eines Drehtages |
| GET `/api/projects/:pid/pdf/stabliste` | Crew-Liste nach Abteilung |
| GET `/api/projects/:pid/pdf/besetzungsliste` | Besetzungsliste |
| GET `/api/projects/:pid/pdf/motivliste` | Location-Liste |
| GET `/api/projects/:pid/pdf/kalkulation/:versionId` | Budget-Kalkulation |
| GET `/api/shoot-days/:dayId/pdf/tagesbericht` | Tagesbericht |
| GET `/api/projects/:pid/pdf/shotlist` | Shotlist |
| GET `/api/projects/:pid/pdf/equipment` | Equipment-Listen |
| GET `/api/projects/:pid/pdf/screenplay` | Vollständiges Drehbuch |

### Echtzeit (SSE)
| Endpoint | Funktion |
|---|---|
| GET `/api/projects/:pid/events` | SSE-Stream; Heartbeat alle 25s |

### Admin — `/api/admin/*` (Site-Admin erforderlich)
| Methode | Pfad | Funktion |
|---|---|---|
| GET | `/api/admin/stats` | Plattform-Statistiken, Top-Nutzer, neueste Projekte |
| GET | `/api/admin/users` | Alle Nutzer mit Projekt-Anzahl + letzter Aktivität |
| GET | `/api/admin/users/:id/projects` | Projekte eines Nutzers |
| GET | `/api/admin/projects` | Alle Projekte mit Owner, Szenen, Tage, Mitglieder |
| POST | `/api/admin/users` | Nutzer mit festgelegter Rolle erstellen |
| PUT | `/api/admin/users/:id/role` | Site-Rolle eines Nutzers ändern |
| POST | `/api/admin/users/:id/reset-password` | Passwort eines Nutzers zurücksetzen |
| DELETE | `/api/admin/users/:id` | Nutzer löschen |
| DELETE | `/api/admin/projects/:id` | Beliebiges Projekt löschen |
| POST | `/api/admin/reseed` | „Sprachlos"-Demo-Projekt neu anlegen |

### Gesundheitsprüfung
| Methode | Pfad | Funktion |
|---|---|---|
| GET | `/api/health` | Immer verfügbar; gibt `{ ok: true, db: boolean }` zurück |

---

## State Management

**Datei**: `client/src/store/useProjectStore.ts`  
**Technologie**: Zustand mit `persist`-Middleware (localStorage-Key: `cutsheet-ui`)

### Persistierter State
| Key | Typ | Beschreibung |
|---|---|---|
| `activeProjectId` | `number \| null` | Aktives Projekt |
| `darkMode` | `boolean` | Dunkelmodus (setzt CSS-Klasse auf `document.documentElement`) |
| `sidebarCollapsed` | `boolean` | Sidebar eingeklappt |
| `language` | `'en' \| 'de' \| 'fr'` | Aktive Sprache |

### Nur im Speicher (nicht persistiert)
| Key | Typ | Beschreibung |
|---|---|---|
| `searchOpen` | `boolean` | Globale Suche geöffnet |
| `lastSaved` | `string \| null` | ISO-Timestamp letzter Auto-Save |
| `undoStack` | `any[]` | Undo-Einträge (max. 50) |
| `redoStack` | `any[]` | Redo-Einträge |

### Methoden
- `setActiveProjectId(id)`, `toggleDarkMode()`, `toggleSidebar()`, `setSearchOpen(open)`, `setLanguage(lang)`, `setLastSaved(ts)`
- `pushUndo(entry)`, `undo()`, `redo()`

---

## i18n / Mehrsprachigkeit

**Dateien**: `client/src/lib/i18n.ts`, `client/src/lib/useT.ts`

Drei Sprachen: Deutsch (`de`), Englisch (`en`), Französisch (`fr`).  
Keine externe Library — reine TypeScript-Maps.

### Verwendung
```typescript
const tt = useT()
tt(dashT.nextShootDay) // → string in aktueller Sprache
```

### Namespaces
`loginT`, `navT`, `topBarT`, `appT`, `uiT`, `dashT`, `projectsT`, `crewT`, `castT`, `scenesT`, `locT`, `equipT`, `vehicleT`, `contactsT`, `masterT`, `dispoT`, `tutorialT`, `shortcutsT`, `settingsT`, `screenplayT`

---

## UI-Komponenten

### Layout-Komponenten
| Komponente | Beschreibung |
|---|---|
| `Sidebar.tsx` | Kollabierbare Sidebar (220px / 52px) mit Nav-Gruppen, User-Menu, Collapse-Toggle. Zeigt projektspezifische Items wenn Projekt offen. Aktiver Zustand: roter Akzentbalken + primäre Hintergrundtönung. |
| `TopBar.tsx` | 56px feste Kopfzeile mit Glasmorphismus (backdrop-blur). Seitentitel (aus URL), Auto-Save-Zeitstempel, Suche-Button (⌘K), Dark-Mode-Toggle. |
| `PageHeader.tsx` | Wiederverwendbarer Seitenheader mit Titel, Untertitel, Action-Slot. |

### Geteilte Komponenten
| Komponente | Beschreibung |
|---|---|
| `GlobalSearch.tsx` | ⌘K/Ctrl+K Modal. Debounced Input → `/api/projects/:pid/search`. Tastatur-navigierbare Ergebnisliste. |
| `AutoSaveIndicator.tsx` | Kleiner "Gespeichert"-Indikator mit Zeitstempel nach Mutationen. |
| `PDFPreviewModal.tsx` | Modal lädt PDF-URL in iframe vor Download. |
| `TutorialModal.tsx` | 6-Schritt Onboarding-Wizard (einmalig nach Registrierung). |
| `ShortcutsModal.tsx` | Keyboard-Shortcut-Referenz (Trigger: `?`-Taste). |

### Drehplan-Komponenten
| Komponente | Beschreibung |
|---|---|
| `ShootDayColumn.tsx` | Einzelne Drehtag-Spalte: Datum-Header, Status-Selector, Szenen-Strip-Liste, Droppable-Zone. |
| `ScenePool.tsx` | Nicht-eingeplante Szenen-Spalte: Droppable Pool. |
| `SceneStrip.tsx` | Szenen-Karte: Nummer, Titel, INT/EXT-Badge, Tag/Nacht-Badge, 1/8-Seiten, Location; Draggable. |

### UI-Primitive (shadcn/ui Basis)
| Kategorie | Komponenten |
|---|---|
| Kern | Button (6 Varianten: default/destructive/outline/secondary/ghost/link; 4 Größen), Card (+Header/Title/Description/Content/Footer), Input, Textarea, Label |
| Overlay | Dialog, Popover, Tooltip, DropdownMenu |
| Auswahl | Select, Command (Combobox), Checkbox, Switch, Tabs |
| Feedback | Toast/Toaster, Alert, Skeleton, Badge (10 Farbvarianten), Progress |
| Layout | ScrollArea, Separator, Accordion, Table, Avatar |
| Speziell | TimeInput (HH:MM-Eingabe, custom) |

### Design-System (index.css)

#### Farbthemen
- **Dark (Standard) „Kino-Saal"**: Background `hsl(0 0% 5%)`, Card `hsl(0 0% 8%)`, Primary Rot `hsl(0 72% 51%)`
- **Light „Pergament"**: Background `hsl(37 35% 97%)`, Card Weiß, Primary Orange `hsl(17 83% 40%)`

#### CSS-Variablen
```css
--ease-out:    cubic-bezier(0.23, 1, 0.32, 1)   /* Snappy UI-Interaktionen */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)   /* On-Screen-Bewegungen */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1) /* Spring-Effekte */
--radius: 0.625rem
--sidebar-width: 220px
--sidebar-collapsed-width: 52px
--topbar-height: 56px
```

#### Animations-Klassen
| Klasse | Effekt |
|---|---|
| `.animate-fade-up` | fade-up 220ms |
| `.animate-fade-in` | fade-in 180ms |
| `.animate-slide-in` | slide-in-left 220ms |
| `.stagger > *` | Kinder nacheinander (50ms Schritte, 12 Kinder) |
| `.stagger-sm > *` | Dichte Listen (30ms Schritte, 9+ Kinder) |
| `.check-indicator` | Spring-Pop beim Abhakenon |
| `.badge-pop` | Scale-in beim Erscheinen |
| `.btn-shine` | Glanz-Sweep beim Hover |
| `.card-lift` | translateY(-1px) + Schatten beim Hover |
| `.count-in` | Scale-from-75% + fade beim Erscheinen |

#### Utility-Klassen
| Klasse | Beschreibung |
|---|---|
| `.page-container` | `p-7 max-w-6xl mx-auto` |
| `.stat-card` | Abgerundete Stat-Karte |
| `.data-table` | Vollständige Tabellen-Styles mit Hover-Akzent |
| `.section-label` | 10px Caps-Label |
| `.top-line` | Border-Top-Trenner |
| `.chip` | Metadata-Chip (neutral) |
| `.chip-primary` | Metadata-Chip (primärfarbe) |
| `.glow-primary` | Box-Shadow mit Primärfarbe |
| `.row-highlighted` | Hervorgehobene Tabellenzeile |
| `.sidebar-transition` | Sidebar-Collapse-Animation (260ms) |
| `.strip-int-tag` | Drehplan-Szenenstreifen INT/TAG |
| `.strip-ext-tag` | Drehplan-Szenenstreifen EXT/TAG |
| `.strip-int-nacht` | Drehplan-Szenenstreifen INT/NACHT |
| `.strip-ext-nacht` | Drehplan-Szenenstreifen EXT/NACHT |

---

## PDF-Export

**Technologie**: Puppeteer (lazy loaded, Chromium headless)

**Chromium-Erkennung** (Railway-kompatibel):
1. `PUPPETEER_EXECUTABLE_PATH` Umgebungsvariable
2. `which chromium-browser` / `which google-chrome`
3. Statische Pfade: `/nix/store/.../chromium`, `/usr/bin/chromium-browser`, etc.

**Format**: A4, 15mm Ränder, Farb-Akzent aus `project_settings.header_color`

**Generierungsprozess**: Server baut HTML-String → Puppeteer rendert zu PDF → Response als Datei-Download

---

## Echtzeit-Features (SSE)

**Datei**: `server/src/routes/sse.ts`

- In-Memory `Map<projectId, Set<Response>>` aller verbundenen Clients
- Heartbeat alle 25s (verhindert Verbindungsabbruch)
- Alle Routes können `broadcastToProject(projectId, eventName, data)` aufrufen
- Client verbindet sich in `App.tsx` wenn Projekt geöffnet ist

---

## Spezialfeatures

### Demo-Daten (`seedDemoData`)
Bei leerem Datenbankstart wird automatisch das Kurzfilm-Projekt **„Sprachlos"** angelegt mit:
- 8 Szenen, 3 Drehorte (Wohnküche, Englischer Garten München, Café)
- 2 Charaktere (Andi, Mia) + 2 Besetzungen (Felix Wagner, Anna Schmidt)
- 8 Crew-Mitglieder
- 3 Drehtage (15.–17. Juni 2026) mit Szenen-Zuordnungen
- 1 Tagesdisposition (Tag 1) mit Cast- und Crew-Calls
- 1 Tagesbericht (Tag 1, abgedreht)
- 11 Shots (Shotlist)
- Budget-Kalkulation (17 Positionen, ~783.000€ Gesamtbudget)
- Finanzierungsplan (4 Quellen: FilmFernsehFonds, Eigenmittel, ZDF, DFFF)
- Equipment-Liste (6 Kamera-Items)
- Drehbuch-Blöcke (3 Szenen ausgearbeitet)
- 4 Sticky Notes
- 6 Kalender-Events
- 2 VFX-Shots
- 5 Postplan-Phasen
- 3 Musik-Cues
- 3 Versicherungen
- 3 Fahrzeuge
- 4 Komparsen
- 3 Kamera-Presets

Reseed über `/api/admin/reseed` (löscht altes „Sprachlos"-Projekt, legt neu an).

### Backup & Import
- **Export**: `GET /api/projects/:pid/backup` → JSON-Datei (`cutsheet-backup-project-N.json`) mit allen 30+ Tabellen, Format-Version `1`
- **Import**: `POST /api/projects/import` → neues Projekt aus JSON mit vollständigem ID-Remapping (keine Konflikte mit bestehenden Daten)

### Drehplan-Versionen
- Benannte Snapshots des kompletten Drehtag-Plans (Drehtage + Szenen-Zuordnungen) als JSON in DB
- Unbegrenzte Versionen pro Projekt
- Wiederherstellung: Best-Effort-Match nach Drehtagnummer

### Budget-Alerts
- Konfigurierbarer Schwellenwert (Standard 80%)
- Alert wird ausgelöst wenn `equipment_total / budget_total > threshold_percent`
- Sichtbar als Warning-Banner auf der Equipment-Seite

### Konflikt-Erkennung
Server-seitig synchrone Prüfung auf 11 Konflikttypen, vollständig dokumentiert in [Konfliktradar-Sektion](#projektsidconfliktradar--konfliktradar).

### Globale Keyboard Shortcuts (App-weit)
| Shortcut | Aktion |
|---|---|
| ⌘K / Ctrl+K | Globale Suche öffnen |
| `?` | Shortcuts-Referenz anzeigen |
| `d` (in Projekt) | → Drehplan |
| `s` (in Projekt) | → Drehbuch/Szenen |
| `b` (in Projekt) | → Besetzung |
| `t` (in Projekt) | → Tagesdispo |
| `c` (in Projekt) | → Stabliste |
| `e` (in Projekt) | → Equipment |
| `l` (in Projekt) | → Shotlist |
| `m` (in Projekt) | → Motive |
| `g` (in Projekt) | → Budget |

### Feiertagsberechnung
`server/src/services/holidays.ts` liefert nationale Feiertage für die Kalenderansicht, länderspezifisch basierend auf `project_settings.country`.

### FDX-Import (Final Draft)
- Akzeptiert `.fdx` XML-Dateien (Final Draft-Format)
- Parser extrahiert Szenen-Überschriften → erstellt `scenes`-Einträge
- Erstellt entsprechende `screenplay_blocks` (scene_heading, action, character, dialogue, etc.)
- Importprotokoll in `fdx_imports`

### Fountain-Export
- Komplettes Drehbuch als Fountain-Plain-Text
- Standard-Screenwriting-Format, kompatibel mit Final Draft, Highland, etc.

---

## Umgebungsvariablen

| Variable | Standardwert | Pflicht | Beschreibung |
|---|---|---|---|
| `DATABASE_URL` | — | ✅ Ja | PostgreSQL-Connection-String |
| `JWT_SECRET` | `cutsheet-dev-secret-change-in-production` | ⚠️ In Prod ersetzen | JWT-Signierschlüssel |
| `PORT` | `3001` | Nein | HTTP-Server-Port |
| `NODE_ENV` | `development` | Nein | `production` aktiviert Static-File-Serving + deaktiviert CORS |
| `PUPPETEER_EXECUTABLE_PATH` | Auto-Erkennung | Nein | Chromium-Binär für PDF-Export |

**Hinweis**: In Railway wird `DATABASE_URL` als `${{Postgres.DATABASE_URL}}` Reference-Variable im Service gesetzt.

---

## Deployment (Railway)

### Services
1. **cutsheet-server** (Node.js)
   - Build: `npm run build` (Vite frontend + tsc backend)
   - Start: `npm start` (Node.js compiled JS)
   - Env: `NODE_ENV=production`, `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `JWT_SECRET=<secret>`
2. **PostgreSQL Plugin** (Managed DB)
   - Stellt `DATABASE_URL` bereit

### Healthcheck
- Endpunkt: `GET /api/health`
- Antwortet immer, auch während DB-Init
- `{ ok: true, db: false }` während Startup, `{ ok: true, db: true }` wenn bereit

### DB-Retry-Mechanismus
10 Verbindungsversuche × 3s Pause. Wenn alle fehlschlagen: `process.exit(1)`.

---

## Lokale Entwicklung

### Voraussetzungen
- Node.js 18+
- PostgreSQL 14+ lokal oder Docker

### Setup
```bash
# Repository klonen
git clone <repo>

# Server-Dependencies
cd server && npm install

# Client-Dependencies
cd ../client && npm install

# Datenbank starten (z.B. Docker)
docker run -d -p 5432:5432 -e POSTGRES_DB=cutsheet -e POSTGRES_USER=cutsheet -e POSTGRES_PASSWORD=cutsheet postgres:16

# Server starten (Dev-Modus mit hot-reload)
cd server && npm run dev

# Client starten (Vite Dev-Server)
cd client && npm run dev
```

### Dev-Ports
- Backend: `http://localhost:3001`
- Frontend: `http://localhost:5173`
- CORS ist für `localhost:5173`, `5174`, `5175` erlaubt

### Demo-Login (nach erstem Start)
```
E-Mail: admin@cutsheet.dev
Passwort: admin1234
```

### Production Build
```bash
# Client bauen
cd client && npm run build  # → client/dist/

# Server bauen
cd server && npm run build  # → server/dist/

# Produktionsserver starten
cd server && npm start
```

Im Produktionsmodus serviert der Express-Server die gebauten Vite-Assets aus `client/dist/` mit:
- `/assets/*`: Cache 1 Jahr (immutable, gehashte Dateinamen)
- `index.html`: Kein Cache (`no-cache, no-store, must-revalidate`)
- Alle Nicht-API-Routen: SPA-Fallback zu `index.html`
