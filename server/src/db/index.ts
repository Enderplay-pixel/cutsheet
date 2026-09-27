import { Pool, PoolClient } from 'pg'
import { heuteISO } from '../lib/datum'

// ─── Connection pool ──────────────────────────────────────────────────────────
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://cutsheet:cutsheet@localhost:5432/cutsheet',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

// ─── SQL helpers ──────────────────────────────────────────────────────────────
// Converts SQLite-style `?` placeholders to PostgreSQL-style `$1, $2, …`
// and replaces datetime('now') with NOW() for any stray occurrences.
export function toPg(sql: string): string {
  let i = 0
  return sql
    // Multi-arg datetime: datetime('now', '-7 days') → NOW() - INTERVAL '7 days'
    .replace(/datetime\('now'\s*,\s*'([+-]?\d+)\s+(\w+)'\)/gi, "NOW() - INTERVAL '$1 $2'")
    .replace(/datetime\('now'\)/gi, 'NOW()')
    // Auch die doppelt gequotete Form abfangen: In Postgres waere "now" ein
    // Bezeichner und die Abfrage schluege fehl. Genau daran ist das Speichern
    // der Tagesdispo gescheitert.
    .replace(/datetime\("now"\)/gi, 'NOW()')
    .replace(/\bdate\('now'\)/gi, 'CURRENT_DATE')
    // Quote 'cast' table/column references - reserved word in PostgreSQL.
    // Negative lookbehind skips already-quoted "cast"; negative lookahead skips CAST( function calls.
    .replace(/(?<!")\bcast\b(?!\()/gi, '"cast"')
    .replace(/\?/g, () => `$${++i}`)
}

// ─── Transaction client wrapper ───────────────────────────────────────────────
export class TxClient {
  constructor(private client: PoolClient) {}

  async all(sql: string, params: any[] = []): Promise<any[]> {
    const result = await this.client.query(toPg(sql), params)
    return result.rows
  }

  async get(sql: string, params: any[] = []): Promise<any | undefined> {
    const result = await this.client.query(toPg(sql), params)
    return result.rows[0]
  }

  async run(sql: string, params: any[] = []): Promise<{ id: number; changes: number }> {
    const trimmed = sql.trimStart()
    let pgSql = toPg(sql)
    if (/^INSERT\s/i.test(trimmed) && !/RETURNING/i.test(trimmed)) {
      pgSql += ' RETURNING id'
    }
    const result = await this.client.query(pgSql, params)
    return { id: result.rows[0]?.id ?? 0, changes: result.rowCount ?? 0 }
  }
}

// ─── Main DB wrapper ──────────────────────────────────────────────────────────
class Db {
  /** SELECT → array of rows */
  async all(sql: string, params: any[] = []): Promise<any[]> {
    const result = await pool.query(toPg(sql), params)
    return result.rows
  }

  /** SELECT → first row or undefined */
  async get(sql: string, params: any[] = []): Promise<any | undefined> {
    const result = await pool.query(toPg(sql), params)
    return result.rows[0]
  }

  /**
   * INSERT / UPDATE / DELETE.
   * For INSERT statements RETURNING id is appended automatically so that
   * `result.id` gives the new row's primary key.
   */
  async run(sql: string, params: any[] = []): Promise<{ id: number; changes: number }> {
    const trimmed = sql.trimStart()
    let pgSql = toPg(sql)
    if (/^INSERT\s/i.test(trimmed) && !/RETURNING/i.test(trimmed)) {
      pgSql += ' RETURNING id'
    }
    const result = await pool.query(pgSql, params)
    return { id: result.rows[0]?.id ?? 0, changes: result.rowCount ?? 0 }
  }

  /** DDL or parameterless statements (supports multi-statement strings via simple query protocol). */
  async exec(sql: string): Promise<void> {
    await pool.query(sql)
  }

  /** Wraps fn in BEGIN / COMMIT / ROLLBACK. Passes a TxClient so helpers stay available. */
  async transaction<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
    const client = await pool.connect()
    const tx = new TxClient(client)
    try {
      await client.query('BEGIN')
      const result = await fn(tx)
      await client.query('COMMIT')
      return result
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }
}

export const db = new Db()

// ─── PostgreSQL Schema ────────────────────────────────────────────────────────
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'Neues Projekt',
    genre TEXT NOT NULL DEFAULT '',
    format TEXT NOT NULL DEFAULT 'Kurzfilm',
    length_minutes INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Vorproduktion',
    synopsis TEXT NOT NULL DEFAULT '',
    director TEXT NOT NULL DEFAULT '',
    producer TEXT NOT NULL DEFAULT '',
    dop TEXT NOT NULL DEFAULT '',
    production_company TEXT NOT NULL DEFAULT '',
    shoot_start TEXT,
    shoot_end TEXT,
    owner_id INTEGER,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS project_settings (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    default_call_time INTEGER NOT NULL DEFAULT 480,
    default_wrap_time INTEGER NOT NULL DEFAULT 1200,
    turnaround_hours INTEGER NOT NULL DEFAULT 11,
    currency TEXT NOT NULL DEFAULT 'EUR',
    country TEXT NOT NULL DEFAULT 'Deutschland',
    logo_url TEXT,
    header_color TEXT NOT NULL DEFAULT '#f59e0b',
    vat_mode TEXT NOT NULL DEFAULT 'netto'
  );

  CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    zip TEXT NOT NULL DEFAULT '',
    country TEXT NOT NULL DEFAULT 'Deutschland',
    lat REAL,
    lng REAL,
    contact_name TEXT NOT NULL DEFAULT '',
    contact_phone TEXT NOT NULL DEFAULT '',
    contact_email TEXT NOT NULL DEFAULT '',
    rental_fee INTEGER NOT NULL DEFAULT 0,
    parking_info TEXT NOT NULL DEFAULT '',
    power_available INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    photos TEXT NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS characters (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    age_range TEXT NOT NULL DEFAULT '',
    gender TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS "cast" (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL,
    actor_name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    agent TEXT NOT NULL DEFAULT '',
    agent_email TEXT NOT NULL DEFAULT '',
    agency TEXT NOT NULL DEFAULT '',
    fee_per_day INTEGER NOT NULL DEFAULT 0,
    contract_type TEXT NOT NULL DEFAULT 'Tagesgage',
    availability_notes TEXT NOT NULL DEFAULT '',
    photo_url TEXT,
    notes TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS crew (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    department TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    fee_per_day INTEGER NOT NULL DEFAULT 0,
    contract_type TEXT NOT NULL DEFAULT 'Tagesgage',
    availability_notes TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS scenes (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    scene_number TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    int_ext TEXT NOT NULL DEFAULT 'INT',
    day_night TEXT NOT NULL DEFAULT 'TAG',
    eighths INTEGER NOT NULL DEFAULT 8,
    estimated_minutes INTEGER NOT NULL DEFAULT 60,
    notes TEXT NOT NULL DEFAULT '',
    shot_status TEXT NOT NULL DEFAULT 'offen',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS scene_characters (
    id SERIAL PRIMARY KEY,
    scene_id INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    role_in_scene TEXT NOT NULL DEFAULT '',
    UNIQUE(scene_id, character_id)
  );

  CREATE TABLE IF NOT EXISTS scene_inventory (
    id SERIAL PRIMARY KEY,
    scene_id INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    item TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'Requisite',
    quantity INTEGER NOT NULL DEFAULT 1,
    notes TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS shoot_days (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL DEFAULT 1,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Geplant',
    unit TEXT NOT NULL DEFAULT 'Haupteinheit',
    notes TEXT NOT NULL DEFAULT '',
    catering_count INTEGER NOT NULL DEFAULT 0,
    risk_notes TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS shoot_day_scenes (
    id SERIAL PRIMARY KEY,
    shoot_day_id INTEGER NOT NULL REFERENCES shoot_days(id) ON DELETE CASCADE,
    scene_id INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    estimated_minutes INTEGER,
    UNIQUE(shoot_day_id, scene_id)
  );

  CREATE TABLE IF NOT EXISTS call_sheets (
    id SERIAL PRIMARY KEY,
    shoot_day_id INTEGER NOT NULL UNIQUE REFERENCES shoot_days(id) ON DELETE CASCADE,
    general_call INTEGER NOT NULL DEFAULT 480,
    shooting_call INTEGER NOT NULL DEFAULT 510,
    location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    weather_forecast TEXT NOT NULL DEFAULT '',
    sunrise TEXT NOT NULL DEFAULT '',
    sunset TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    safety_personnel INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS call_sheet_entries (
    id SERIAL PRIMARY KEY,
    call_sheet_id INTEGER NOT NULL REFERENCES call_sheets(id) ON DELETE CASCADE,
    person_type TEXT NOT NULL DEFAULT 'crew',
    person_id INTEGER NOT NULL,
    call_time INTEGER NOT NULL DEFAULT 480,
    pickup_location TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS daily_reports (
    id SERIAL PRIMARY KEY,
    shoot_day_id INTEGER NOT NULL UNIQUE REFERENCES shoot_days(id) ON DELETE CASCADE,
    date TEXT NOT NULL DEFAULT '',
    call_time INTEGER NOT NULL DEFAULT 480,
    first_shot INTEGER NOT NULL DEFAULT 510,
    lunch_in INTEGER,
    lunch_out INTEGER,
    wrap INTEGER NOT NULL DEFAULT 1200,
    scenes_completed TEXT NOT NULL DEFAULT '[]',
    scenes_partial TEXT NOT NULL DEFAULT '[]',
    pages_shot INTEGER NOT NULL DEFAULT 0,
    total_setups INTEGER NOT NULL DEFAULT 0,
    camera_rolls TEXT NOT NULL DEFAULT '',
    sound_rolls TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    production_notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS daily_report_cast (
    id SERIAL PRIMARY KEY,
    daily_report_id INTEGER NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    cast_id INTEGER NOT NULL REFERENCES "cast"(id) ON DELETE CASCADE,
    call_time INTEGER NOT NULL DEFAULT 480,
    makeup_in INTEGER,
    on_set INTEGER,
    wrap INTEGER
  );

  CREATE TABLE IF NOT EXISTS shots (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    scene_id INTEGER REFERENCES scenes(id) ON DELETE SET NULL,
    shoot_day_id INTEGER REFERENCES shoot_days(id) ON DELETE SET NULL,
    shot_number TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    size TEXT NOT NULL DEFAULT 'HN',
    movement TEXT NOT NULL DEFAULT 'Statisch',
    lens_mm TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    storyboard_url TEXT,
    duration_seconds INTEGER,
    done INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS storyboard_frames (
    id SERIAL PRIMARY KEY,
    shot_id INTEGER NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
    frame_number INTEGER NOT NULL DEFAULT 1,
    image_url TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS budget_versions (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Kalkulation',
    status TEXT NOT NULL DEFAULT 'Entwurf',
    total_cents INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS budget_lines (
    id SERIAL PRIMARY KEY,
    budget_version_id INTEGER NOT NULL REFERENCES budget_versions(id) ON DELETE CASCADE,
    category TEXT NOT NULL DEFAULT '',
    account_code TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    unit TEXT NOT NULL DEFAULT 'Pauschal',
    quantity REAL NOT NULL DEFAULT 1,
    unit_price_cents INTEGER NOT NULL DEFAULT 0,
    total_cents INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS financing_plan_versions (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Finanzierungsplan',
    total_cents INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS financing_entries (
    id SERIAL PRIMARY KEY,
    financing_version_id INTEGER NOT NULL REFERENCES financing_plan_versions(id) ON DELETE CASCADE,
    source TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'Förderung',
    amount_cents INTEGER NOT NULL DEFAULT 0,
    confirmed INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS equipment_lists (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    department TEXT NOT NULL DEFAULT '',
    shoot_day_id INTEGER REFERENCES shoot_days(id) ON DELETE SET NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS equipment_items (
    id SERIAL PRIMARY KEY,
    equipment_list_id INTEGER NOT NULL REFERENCES equipment_lists(id) ON DELETE CASCADE,
    item TEXT NOT NULL DEFAULT '',
    quantity INTEGER NOT NULL DEFAULT 1,
    supplier TEXT NOT NULL DEFAULT '',
    rental_per_day_cents INTEGER NOT NULL DEFAULT 0,
    total_days INTEGER NOT NULL DEFAULT 1,
    total_cents INTEGER NOT NULL DEFAULT 0,
    checked INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL DEFAULT '',
    entity_id INTEGER NOT NULL DEFAULT 0,
    author TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    resolved INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS project_events (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '',
    start_date TEXT NOT NULL DEFAULT '',
    end_date TEXT,
    type TEXT NOT NULL DEFAULT 'Meeting',
    color TEXT NOT NULL DEFAULT '#f59e0b',
    notes TEXT NOT NULL DEFAULT '',
    all_day INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS drehplan_versions (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    snapshot_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS email_log (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    subject TEXT NOT NULL DEFAULT '',
    recipients TEXT NOT NULL DEFAULT '[]',
    body TEXT NOT NULL DEFAULT '',
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'read_only',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS project_members (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'read_only',
    UNIQUE(project_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_name TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL DEFAULT '',
    entity_type TEXT NOT NULL DEFAULT '',
    entity_id INTEGER,
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS guest_tokens (
    id SERIAL PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    shoot_day_id INTEGER REFERENCES shoot_days(id) ON DELETE CASCADE,
    expires_at TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS sticky_notes (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    content TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '#fef08a',
    position_x INTEGER NOT NULL DEFAULT 0,
    position_y INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    license_plate TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'PKW',
    capacity INTEGER NOT NULL DEFAULT 4,
    driver_name TEXT NOT NULL DEFAULT '',
    driver_phone TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS extras (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    tariff_group TEXT NOT NULL DEFAULT 'Standard',
    notes TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS camera_presets (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    camera TEXT NOT NULL DEFAULT '',
    lenses TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS budget_alerts (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    threshold_percent INTEGER NOT NULL DEFAULT 80,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS screenplay_blocks (
    id SERIAL PRIMARY KEY,
    scene_id INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    block_type TEXT NOT NULL DEFAULT 'action',
    content TEXT NOT NULL DEFAULT '',
    annotation_color TEXT NOT NULL DEFAULT '#f59e0b',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS fdx_imports (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    filename TEXT NOT NULL DEFAULT '',
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scene_count INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS project_invites (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'read_only',
    label TEXT NOT NULL DEFAULT '',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TEXT
  );

  CREATE TABLE IF NOT EXISTS vfx_shots (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    scene_id INTEGER REFERENCES scenes(id) ON DELETE SET NULL,
    shot_number TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    vfx_type TEXT NOT NULL DEFAULT 'Compositing',
    status TEXT NOT NULL DEFAULT 'Offen',
    artist TEXT NOT NULL DEFAULT '',
    deadline TEXT,
    complexity TEXT NOT NULL DEFAULT 'Mittel',
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS post_phases (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    phase TEXT NOT NULL DEFAULT 'Rohschnitt',
    start_date TEXT,
    end_date TEXT,
    status TEXT NOT NULL DEFAULT 'Ausstehend',
    responsible TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS music_cues (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    scene_id INTEGER REFERENCES scenes(id) ON DELETE SET NULL,
    title TEXT NOT NULL DEFAULT '',
    composer TEXT NOT NULL DEFAULT '',
    publisher TEXT NOT NULL DEFAULT '',
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    cue_type TEXT NOT NULL DEFAULT 'Original',
    usage_type TEXT NOT NULL DEFAULT 'Unterlegt',
    lyrics_author TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS insurances (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    ins_type TEXT NOT NULL DEFAULT 'Filmversicherung',
    provider TEXT NOT NULL DEFAULT '',
    policy_number TEXT NOT NULL DEFAULT '',
    coverage_amount_cents INTEGER NOT NULL DEFAULT 0,
    premium_cents INTEGER NOT NULL DEFAULT 0,
    start_date TEXT,
    end_date TEXT,
    notes TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  -- A1: Check-in columns added via ALTER below
  -- A2: Timesheets
  CREATE TABLE IF NOT EXISTS timesheets (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    shoot_day_id INTEGER NOT NULL REFERENCES shoot_days(id) ON DELETE CASCADE,
    person_type TEXT NOT NULL DEFAULT 'crew',
    person_id INTEGER NOT NULL,
    call_time INTEGER,
    wrap_time INTEGER,
    meal_penalty BOOLEAN NOT NULL DEFAULT false,
    overtime_hours REAL NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- A4: Catering preferences
  CREATE TABLE IF NOT EXISTS catering_preferences (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    person_type TEXT NOT NULL DEFAULT 'crew',
    person_id INTEGER NOT NULL,
    dietary TEXT NOT NULL DEFAULT 'keine',
    allergies TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    UNIQUE(project_id, person_type, person_id)
  );

  -- A5: Continuity notes
  CREATE TABLE IF NOT EXISTS continuity_notes (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    scene_id INTEGER REFERENCES scenes(id) ON DELETE CASCADE,
    cast_id INTEGER REFERENCES "cast"(id) ON DELETE SET NULL,
    category TEXT NOT NULL DEFAULT 'kostüm',
    description TEXT NOT NULL DEFAULT '',
    photos TEXT NOT NULL DEFAULT '[]',
    shoot_day_id INTEGER REFERENCES shoot_days(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- B3: Location releases
  CREATE TABLE IF NOT EXISTS location_releases (
    id SERIAL PRIMARY KEY,
    location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    owner_name TEXT NOT NULL DEFAULT '',
    owner_address TEXT NOT NULL DEFAULT '',
    shoot_dates TEXT NOT NULL DEFAULT '[]',
    fee_cents INTEGER NOT NULL DEFAULT 0,
    special_conditions TEXT NOT NULL DEFAULT '',
    signed_at TIMESTAMPTZ,
    signed_by TEXT NOT NULL DEFAULT '',
    signature_data TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Entwurf',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- C2: Push subscriptions
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL DEFAULT '',
    auth TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- D1: Camera reports
  CREATE TABLE IF NOT EXISTS camera_reports (
    id SERIAL PRIMARY KEY,
    shoot_day_id INTEGER NOT NULL REFERENCES shoot_days(id) ON DELETE CASCADE,
    camera TEXT NOT NULL DEFAULT 'A',
    magazine TEXT NOT NULL DEFAULT '',
    format TEXT NOT NULL DEFAULT '4K RAW',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS camera_takes (
    id SERIAL PRIMARY KEY,
    camera_report_id INTEGER NOT NULL REFERENCES camera_reports(id) ON DELETE CASCADE,
    shot_id INTEGER REFERENCES shots(id) ON DELETE SET NULL,
    scene_number TEXT NOT NULL DEFAULT '',
    take_number INTEGER NOT NULL DEFAULT 1,
    timecode_in TEXT NOT NULL DEFAULT '',
    timecode_out TEXT NOT NULL DEFAULT '',
    meters REAL,
    circle BOOLEAN NOT NULL DEFAULT false,
    false_start BOOLEAN NOT NULL DEFAULT false,
    mute BOOLEAN NOT NULL DEFAULT false,
    directors_cut BOOLEAN NOT NULL DEFAULT false,
    notes TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  -- E3: Equipment bookings (calendar)
  CREATE TABLE IF NOT EXISTS equipment_bookings (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    equipment_item_id INTEGER REFERENCES equipment_items(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL DEFAULT '',
    start_date TEXT NOT NULL DEFAULT '',
    end_date TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT ''
  );

  -- E4: Moodboard
  CREATE TABLE IF NOT EXISTS moodboard_items (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'Allgemein',
    position_x INTEGER NOT NULL DEFAULT 0,
    position_y INTEGER NOT NULL DEFAULT 0,
    width INTEGER NOT NULL DEFAULT 300,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- E6: Cast blackout dates (Sperrtage)
  CREATE TABLE IF NOT EXISTS cast_blackout_dates (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    cast_id INTEGER NOT NULL REFERENCES "cast"(id) ON DELETE CASCADE,
    start_date TEXT NOT NULL DEFAULT '',
    end_date TEXT NOT NULL DEFAULT '',
    reason TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- E10: Scheduling suggestions
  CREATE TABLE IF NOT EXISTS scheduling_suggestions (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    suggestion_type TEXT NOT NULL DEFAULT 'location_cluster',
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    savings_days INTEGER NOT NULL DEFAULT 0,
    scene_ids TEXT NOT NULL DEFAULT '[]',
    dismissed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`

// ─── Test admin seeder ────────────────────────────────────────────────────────
async function ensureTestAdmin() {
  const bcrypt = await import('bcryptjs')
  const existing = await db.get("SELECT id FROM users WHERE email = 'admin@cutsheet.dev'")
  if (!existing) {
    const hash = await bcrypt.hash('admin1234', 12)
    await db.run(
      "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)",
      ['admin@cutsheet.dev', hash, 'Test Admin', 'admin']
    )
    console.log('[DB] Test-Admin erstellt: admin@cutsheet.dev / admin1234')
  } else {
    await db.run("UPDATE users SET role = 'admin' WHERE email = 'admin@cutsheet.dev'")
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
export async function initDatabase() {
  // Verify connection
  await pool.query('SELECT 1')

  // Create all tables
  await db.exec(SCHEMA)

  // Add foreign key from projects.owner_id now that users table exists
  await db.exec(`
    DO $$ BEGIN
      ALTER TABLE projects ADD CONSTRAINT projects_owner_id_fkey
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)

  // Add new columns - each in its own exec() call to avoid multi-statement issues
  await db.exec(`ALTER TABLE call_sheet_entries ADD COLUMN IF NOT EXISTS checked_in BOOLEAN DEFAULT false`)
  await db.exec(`ALTER TABLE call_sheet_entries ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ`)
  await db.exec(`ALTER TABLE call_sheet_entries ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ`)
  await db.exec(`ALTER TABLE call_sheet_entries ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ`)
  // Circle Take: welcher Take gedruckt wird. Freitext, weil in der Praxis auch
  // "3, 5" oder "2 (Ton ab 4)" darin steht.
  await db.exec(`ALTER TABLE shots ADD COLUMN IF NOT EXISTS best_take TEXT NOT NULL DEFAULT ''`)
  await db.exec(`ALTER TABLE screenplay_blocks ADD COLUMN IF NOT EXISTS annotation_color TEXT NOT NULL DEFAULT '#f59e0b'`)
  // Tatsaechlicher Drehaufwand je Szene und Drehtag. NULL heisst "nicht
  // gemessen" - nicht 0. Die Zeitanalyse faellt dann auf die Aufteilung der
  // Tagesdrehzeit zurueck und kennzeichnet den Wert als geschaetzt.
  await db.exec(`ALTER TABLE shoot_day_scenes ADD COLUMN IF NOT EXISTS actual_minutes INTEGER`)
  // Herkunft einer Kalkulationszeile. Leer heisst: von Hand angelegt und
  // wird von der Kostenuebernahme nie angefasst.
  await db.exec(`ALTER TABLE budget_lines ADD COLUMN IF NOT EXISTS source_key TEXT NOT NULL DEFAULT ''`)

  // Eine Szene gehoert zu genau einem Drehtag. Ohne diese Sperre konnte sie
  // bei gleichzeitigem Verschieben an mehreren liegen. Erst Altlasten
  // bereinigen, sonst scheitert der Index.
  await db.exec(`DELETE FROM shoot_day_scenes a USING shoot_day_scenes b
                 WHERE a.scene_id = b.scene_id AND a.id > b.id`)
  await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS shoot_day_scenes_scene_eindeutig
                 ON shoot_day_scenes (scene_id)`)

  // Verwaiste Verweise auf geloeschte Personen.
  //
  // person_type/person_id zeigen auf zwei Tabellen, deshalb gibt es keinen
  // Fremdschluessel - die Datenbank raeumt beim Loeschen eines Stabmitglieds
  // nicht mit auf. Seit dem 26.09.2026 tut die Anwendung es selbst
  // (lib/person.ts); was vorher liegen geblieben ist, kommt hier einmalig
  // weg. Sonst steht auf einem gedruckten Call Sheet eine namenlose Zeile.
  for (const tabelle of ['call_sheet_entries', 'timesheets', 'catering_preferences']) {
    await db.exec(`DELETE FROM ${tabelle}
                   WHERE (person_type = 'crew' AND NOT EXISTS (SELECT 1 FROM crew c WHERE c.id = person_id))
                      OR (person_type = 'cast' AND NOT EXISTS (SELECT 1 FROM "cast" ca WHERE ca.id = person_id))`)
  }
  await db.exec(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false`)
  // Projektart: 'film' = klassische Produktion, 'creator' = Content-/YouTube-Kanal.
  // Steuert Navigation und Feature-Set im Client.
  await db.exec(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_kind TEXT NOT NULL DEFAULT 'film'`)
  // Nachziehen: Projekte, die vor Einfuehrung der Projektart angelegt wurden,
  // stehen auf dem Standardwert 'film', obwohl ihr Format eindeutig Content ist.
  // Ohne das bekommen sie die Filmproduktions-Navigation statt der Creator-Sicht.
  await db.exec(`
    UPDATE projects SET project_kind = 'creator'
    WHERE project_kind = 'film'
      AND format IN ('YouTube-Video', 'YouTube Shorts', 'Reel / TikTok', 'Podcast', 'Stream / Live')
  `)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS creator_videos (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Idee',
      platform TEXT NOT NULL DEFAULT 'YouTube',
      hook TEXT NOT NULL DEFAULT '',
      target_seconds INTEGER NOT NULL DEFAULT 0,
      wpm INTEGER NOT NULL DEFAULT 150,
      publish_at TEXT,
      -- Upload-Paket: je Zeile ein Eintrag, Tags kommasepariert
      title_variants TEXT NOT NULL DEFAULT '',
      thumbnail_ideas TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS creator_script_sections (
      id SERIAL PRIMARY KEY,
      video_id INTEGER NOT NULL REFERENCES creator_videos(id) ON DELETE CASCADE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'segment',
      heading TEXT NOT NULL DEFAULT '',
      spoken TEXT NOT NULL DEFAULT '',
      visuals TEXT NOT NULL DEFAULT '',
      target_seconds INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_creator_videos_project ON creator_videos(project_id, sort_order)`)
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_creator_sections_video ON creator_script_sections(video_id, sort_order)`)

  // ── Creator-Modus, Ausbaustufe 2 ──
  // Serie/Format und SEO-Keyword
  await db.exec(`ALTER TABLE creator_videos ADD COLUMN IF NOT EXISTS series TEXT NOT NULL DEFAULT ''`)
  await db.exec(`ALTER TABLE creator_videos ADD COLUMN IF NOT EXISTS keyword TEXT NOT NULL DEFAULT ''`)
  await db.exec(`ALTER TABLE creator_videos ADD COLUMN IF NOT EXISTS video_url TEXT NOT NULL DEFAULT ''`)
  await db.exec(`ALTER TABLE creator_videos ADD COLUMN IF NOT EXISTS published_at TEXT`)
  // Performance wird von Hand gepflegt - es gibt keine YouTube-API-Anbindung
  await db.exec(`ALTER TABLE creator_videos ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0`)
  await db.exec(`ALTER TABLE creator_videos ADD COLUMN IF NOT EXISTS impressions INTEGER NOT NULL DEFAULT 0`)
  await db.exec(`ALTER TABLE creator_videos ADD COLUMN IF NOT EXISTS avg_view_seconds INTEGER NOT NULL DEFAULT 0`)
  await db.exec(`ALTER TABLE creator_videos ADD COLUMN IF NOT EXISTS likes INTEGER NOT NULL DEFAULT 0`)
  await db.exec(`ALTER TABLE creator_videos ADD COLUMN IF NOT EXISTS comments INTEGER NOT NULL DEFAULT 0`)
  await db.exec(`ALTER TABLE creator_videos ADD COLUMN IF NOT EXISTS subs_gained INTEGER NOT NULL DEFAULT 0`)
  // Sponsoring am Video, weil Deals bei Creators pro Video verhandelt werden
  await db.exec(`ALTER TABLE creator_videos ADD COLUMN IF NOT EXISTS sponsor_brand TEXT NOT NULL DEFAULT ''`)
  await db.exec(`ALTER TABLE creator_videos ADD COLUMN IF NOT EXISTS sponsor_fee_cents INTEGER NOT NULL DEFAULT 0`)
  await db.exec(`ALTER TABLE creator_videos ADD COLUMN IF NOT EXISTS sponsor_deliverables TEXT NOT NULL DEFAULT ''`)
  await db.exec(`ALTER TABLE creator_videos ADD COLUMN IF NOT EXISTS sponsor_deadline TEXT`)
  await db.exec(`ALTER TABLE creator_videos ADD COLUMN IF NOT EXISTS sponsor_disclosed BOOLEAN NOT NULL DEFAULT false`)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS creator_ideas (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      impact INTEGER NOT NULL DEFAULT 3,
      effort INTEGER NOT NULL DEFAULT 3,
      status TEXT NOT NULL DEFAULT 'offen',
      video_id INTEGER REFERENCES creator_videos(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS creator_assets (
      id SERIAL PRIMARY KEY,
      video_id INTEGER NOT NULL REFERENCES creator_videos(id) ON DELETE CASCADE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'musik',
      name TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      license TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      claim_risk TEXT NOT NULL DEFAULT 'keins',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS creator_clips (
      id SERIAL PRIMARY KEY,
      video_id INTEGER NOT NULL REFERENCES creator_videos(id) ON DELETE CASCADE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      start_seconds INTEGER NOT NULL DEFAULT 0,
      end_seconds INTEGER NOT NULL DEFAULT 0,
      platform TEXT NOT NULL DEFAULT 'YouTube Shorts',
      status TEXT NOT NULL DEFAULT 'offen',
      note TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS creator_checklist (
      id SERIAL PRIMARY KEY,
      video_id INTEGER NOT NULL REFERENCES creator_videos(id) ON DELETE CASCADE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      done BOOLEAN NOT NULL DEFAULT false,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `)
  // YouTube-Anbindung je Projekt. Tokens liegen verschlüsselt (siehe
  // lib/youtubeOAuth), deshalb TEXT und keine Klartextspalten.
  await db.exec(`
    CREATE TABLE IF NOT EXISTS creator_youtube_accounts (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
      channel_id TEXT NOT NULL DEFAULT '',
      channel_title TEXT NOT NULL DEFAULT '',
      subscribers BIGINT,
      total_views BIGINT,
      access_token TEXT NOT NULL DEFAULT '',
      refresh_token TEXT NOT NULL DEFAULT '',
      expires_at BIGINT NOT NULL DEFAULT 0,
      scope TEXT NOT NULL DEFAULT '',
      last_sync_at TIMESTAMPTZ,
      last_error TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await db.exec(`ALTER TABLE creator_videos ADD COLUMN IF NOT EXISTS youtube_video_id TEXT NOT NULL DEFAULT ''`)
  // Retention-Kurve als JSON: sie wird immer als Ganzes geholt und gelesen
  await db.exec(`ALTER TABLE creator_videos ADD COLUMN IF NOT EXISTS retention_curve TEXT NOT NULL DEFAULT ''`)
  await db.exec(`ALTER TABLE creator_videos ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ`)
  // Echte Videolaenge von YouTube. Die Schaetzung aus dem Sprechtext weicht ab,
  // sobald geschnitten wurde - fuer die Retention-Zuordnung zaehlt die echte.
  await db.exec(`ALTER TABLE creator_videos ADD COLUMN IF NOT EXISTS duration_seconds INTEGER NOT NULL DEFAULT 0`)
  await db.exec(`ALTER TABLE creator_videos ADD COLUMN IF NOT EXISTS imported_from_youtube BOOLEAN NOT NULL DEFAULT false`)
  // Beim Abgleich uebersprungene Videos: Wer ein importiertes Video loescht,
  // will es nicht beim naechsten Abgleich wiederhaben.
  await db.exec(`
    CREATE TABLE IF NOT EXISTS creator_youtube_ignored (
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      youtube_video_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (project_id, youtube_video_id)
    )
  `)
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_creator_ideas_project ON creator_ideas(project_id)`)
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_creator_assets_video ON creator_assets(video_id)`)
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_creator_clips_video ON creator_clips(video_id, sort_order)`)
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_creator_checklist_video ON creator_checklist(video_id, sort_order)`)
  await db.exec(`ALTER TABLE call_sheet_entries ADD COLUMN IF NOT EXISTS public_token TEXT`)
  await db.exec(`ALTER TABLE call_sheet_entries ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ`)

  // ── Felder fuer das Call Sheet im Branchenstandard ──
  // Sicherheitsangaben stehen dort ganz oben: im Notfall zaehlt, dass das
  // naechste Krankenhaus auf dem Blatt steht und nicht im Telefon.
  await db.exec(`ALTER TABLE call_sheets ADD COLUMN IF NOT EXISTS hospital_name TEXT NOT NULL DEFAULT ''`)
  await db.exec(`ALTER TABLE call_sheets ADD COLUMN IF NOT EXISTS hospital_address TEXT NOT NULL DEFAULT ''`)
  await db.exec(`ALTER TABLE call_sheets ADD COLUMN IF NOT EXISTS crew_parking TEXT NOT NULL DEFAULT ''`)
  await db.exec(`ALTER TABLE call_sheets ADD COLUMN IF NOT EXISTS basecamp TEXT NOT NULL DEFAULT ''`)
  await db.exec(`ALTER TABLE call_sheets ADD COLUMN IF NOT EXISTS breakfast_call INTEGER NOT NULL DEFAULT 0`)
  await db.exec(`ALTER TABLE call_sheets ADD COLUMN IF NOT EXISTS lunch_call INTEGER NOT NULL DEFAULT 0`)
  await db.exec(`ALTER TABLE call_sheets ADD COLUMN IF NOT EXISTS weather_high TEXT NOT NULL DEFAULT ''`)
  await db.exec(`ALTER TABLE call_sheets ADD COLUMN IF NOT EXISTS weather_low TEXT NOT NULL DEFAULT ''`)
  await db.exec(`ALTER TABLE call_sheets ADD COLUMN IF NOT EXISTS walkie_channels TEXT NOT NULL DEFAULT ''`)
  await db.exec(`ALTER TABLE call_sheets ADD COLUMN IF NOT EXISTS dept_notes TEXT NOT NULL DEFAULT ''`)
  // Cast-Zeilen: Status nach Branchenkuerzeln (W = work, SW = start work,
  // WF = work finish, SWF = start work finish, H = hold) und die Zeitspalten,
  // die am Set tatsaechlich gebraucht werden
  await db.exec(`ALTER TABLE call_sheet_entries ADD COLUMN IF NOT EXISTS cast_status TEXT NOT NULL DEFAULT ''`)
  await db.exec(`ALTER TABLE call_sheet_entries ADD COLUMN IF NOT EXISTS blk_reh INTEGER`)
  await db.exec(`ALTER TABLE call_sheet_entries ADD COLUMN IF NOT EXISTS on_set INTEGER`)
  await db.exec(`ALTER TABLE call_sheet_entries ADD COLUMN IF NOT EXISTS lose_at INTEGER`)

  // ── Set-Plan ──
  // Ein Grundriss je Szene oder Motiv, auf dem Kamera, Licht und Ton stehen.
  await db.exec(`
    CREATE TABLE IF NOT EXISTS floorplans (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      scene_id INTEGER REFERENCES scenes(id) ON DELETE SET NULL,
      location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
      name TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  // Positionen relativ (0 bis 1) statt in Pixeln: So stimmt der Plan auf jedem
  // Bildschirm und im PDF, unabhaengig von der Groesse des Hintergrundbilds.
  await db.exec(`
    CREATE TABLE IF NOT EXISTS floorplan_items (
      id SERIAL PRIMARY KEY,
      floorplan_id INTEGER NOT NULL REFERENCES floorplans(id) ON DELETE CASCADE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'kamera',
      label TEXT NOT NULL DEFAULT '',
      x REAL NOT NULL DEFAULT 0.5,
      y REAL NOT NULL DEFAULT 0.5,
      rotation INTEGER NOT NULL DEFAULT 0,
      size INTEGER NOT NULL DEFAULT 100,
      notes TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `)
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_floorplans_project ON floorplans(project_id)`)
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_floorplan_items_plan ON floorplan_items(floorplan_id, sort_order)`)
  await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_cse_public_token ON call_sheet_entries(public_token)`)
  await db.exec(`ALTER TABLE project_invites ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT ''`)
  await db.exec(`ALTER TABLE project_invites ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ`)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS project_tasks (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'offen',
      department TEXT NOT NULL DEFAULT '',
      assignee TEXT NOT NULL DEFAULT '',
      due_date DATE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      budget_line_id INTEGER REFERENCES budget_lines(id) ON DELETE SET NULL,
      category TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL,
      amount_cents INTEGER NOT NULL DEFAULT 0,
      receipt_no TEXT NOT NULL DEFAULT '',
      expense_date DATE,
      paid BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS feedback (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      user_email TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'allgemein',
      message TEXT NOT NULL,
      page_path TEXT NOT NULL DEFAULT '',
      resolved BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  // Check if empty - seed demo data on first run
  const count = await db.get('SELECT COUNT(*) as c FROM projects')
  if (!count || Number(count.c) === 0) {
    await seedDemoData()
  }

  // Assign unclaimed projects to first user
  await db.exec(`
    UPDATE projects SET owner_id = (SELECT id FROM users ORDER BY id ASC LIMIT 1)
    WHERE owner_id IS NULL AND (SELECT COUNT(*) FROM users) > 0
  `)

  // Fix roles: only first user keeps 'admin'
  await db.exec(`
    UPDATE users SET role = 'user'
    WHERE id != (SELECT MIN(id) FROM users) AND role = 'admin'
  `)

  await ensureTestAdmin()

  console.log('[DB] PostgreSQL-Datenbank initialisiert')
}

// ─── Demo seed data ───────────────────────────────────────────────────────────
// Ohne ownerId: globales Seed beim ersten DB-Init (Bestandsverhalten).
// Mit ownerId: persönliches, löschbares Demo-Projekt für einen frischen Account.
export async function seedDemoData(ownerId?: number): Promise<number> {
  // Drehtage immer relativ zu heute, damit das Demo-Projekt "lebendig" wirkt:
  // Tag 1 gestern abgedreht, Tag 2/3 stehen bevor (Dashboard-Countdown greift).
  const d = (offset: number) => {
    const dt = new Date()
    dt.setDate(dt.getDate() + offset)
    // Deutsche Zeit, nicht UTC: sonst legt ein Seed um 01:00 nachts alle
    // Drehtage einen Tag zu frueh an.
    return heuteISO(dt)
  }

  const projectResult = await db.run(`
    INSERT INTO projects (title, genre, format, length_minutes, status, director, producer, dop, production_company, shoot_start, shoot_end, owner_id, is_demo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, ['Sprachlos (Demo)', 'Drama', 'Kurzfilm', 15, 'Vorproduktion',
      'Sarah Müller', 'Thomas Bauer', 'Lisa Schneider', 'Bauer Film GmbH',
      d(-1), d(7), ownerId ?? null, true])
  const projectId = projectResult.id

  if (ownerId) {
    await db.run(
      'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
      [projectId, ownerId, 'admin']
    )
  }

  await db.run(
    'INSERT INTO project_settings (project_id, default_call_time, default_wrap_time) VALUES (?, ?, ?)',
    [projectId, 480, 1140]
  )

  // Locations
  const loc1 = await db.run(
    'INSERT INTO locations (project_id, name, address, city, zip, contact_name, contact_phone, power_available, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [projectId, 'Wohnküche Andi', 'Musterstraße 12', 'München', '80331', 'Andrea Huber', '089 1234567', 1, 'Ruhige Straße, gute Parkmöglichkeiten']
  )
  const loc2 = await db.run(
    'INSERT INTO locations (project_id, name, address, city, zip, contact_name, contact_phone, power_available, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [projectId, 'Stadtpark Englischer Garten', 'Englischer Garten 1', 'München', '80538', 'Stadtpark Verwaltung', '089 9876543', 0, 'Drehgenehmigung erforderlich']
  )
  const loc3 = await db.run(
    'INSERT INTO locations (project_id, name, address, city, zip, contact_name, contact_phone, power_available, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [projectId, 'Café Morgenrot', 'Leopoldstraße 45', 'München', '80802', 'Maria Vogel', '089 5556789', 1, 'Samstags geschlossen, Sonntags verfügbar']
  )
  const locId1 = loc1.id, locId2 = loc2.id, locId3 = loc3.id

  // Characters
  const char1 = await db.run(
    'INSERT INTO characters (project_id, name, description, age_range, gender, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
    [projectId, 'Andi', 'Introvertierter junger Mann, kämpft mit Kommunikation nach einem Trauma', '25-30', 'Männlich', 1]
  )
  const char2 = await db.run(
    'INSERT INTO characters (project_id, name, description, age_range, gender, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
    [projectId, 'Mia', 'Andis Nachbarin, einfühlsam und geduldig', '25-35', 'Weiblich', 2]
  )
  const charId1 = char1.id, charId2 = char2.id

  // Cast
  await db.run(
    'INSERT INTO "cast" (project_id, character_id, actor_name, email, phone, fee_per_day, contract_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [projectId, charId1, 'Felix Wagner', 'felix.wagner@email.de', '0170 1234567', 50000, 'Tagesgage']
  )
  await db.run(
    'INSERT INTO "cast" (project_id, character_id, actor_name, email, phone, fee_per_day, contract_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [projectId, charId2, 'Anna Schmidt', 'anna.schmidt@email.de', '0171 9876543', 50000, 'Tagesgage']
  )

  // Crew
  const crewData = [
    ['Sarah Müller', 'Regie', 'Regisseurin', 'sarah.mueller@bauerfilm.de', '0172 1111111', 0, 'Pauschal'],
    ['Thomas Bauer', 'Produktion', 'Produzent', 'thomas.bauer@bauerfilm.de', '0172 2222222', 0, 'Pauschal'],
    ['Lisa Schneider', 'Kamera', 'Director of Photography', 'lisa.schneider@bauerfilm.de', '0173 3333333', 80000, 'Tagesgage'],
    ['Markus Klein', 'Kamera', 'Kameraassistent', 'markus.klein@email.de', '0174 4444444', 40000, 'Tagesgage'],
    ['Julia Braun', 'Ton', 'Tonmeisterin', 'julia.braun@email.de', '0175 5555555', 50000, 'Tagesgage'],
    ['Peter Wolf', 'Maske', 'Maskenbild', 'peter.wolf@email.de', '0176 6666666', 30000, 'Tagesgage'],
    ['Nina Fischer', 'Kostüm', 'Kostümbildnerin', 'nina.fischer@email.de', '0177 7777777', 30000, 'Tagesgage'],
    ['Lars Weber', 'Aufnahmeleitung', 'Aufnahmeleiter', 'lars.weber@email.de', '0178 8888888', 45000, 'Tagesgage'],
  ]
  for (let i = 0; i < crewData.length; i++) {
    const [name, dept, role, email, phone, fee, contract] = crewData[i]
    await db.run(
      'INSERT INTO crew (project_id, name, department, role, email, phone, fee_per_day, contract_type, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [projectId, name, dept, role, email, phone, fee, contract, i]
    )
  }

  // Scenes
  const scenesData: Array<[string, number, string, string, number, string, string, number, number]> = [
    ['1', 0, 'Andis Morgen', 'Andi sitzt allein am Frühstückstisch. Vor ihm liegt ein leeres Notizbuch.', locId1, 'INT', 'TAG', 12, 90],
    ['2', 1, 'Klingeln', 'Es klingelt. Andi erstarrt, rührt sich nicht. Das Klingeln wiederholt sich dreimal.', locId1, 'INT', 'TAG', 4, 30],
    ['3', 2, 'Mia vor der Tür', 'Mia steht im Flur, hält eine Pflanze. Sie lächelt, wartet.', locId1, 'INT', 'TAG', 8, 60],
    ['4', 3, 'Das erste Gespräch', 'Andi öffnet zögernd die Tür. Zwischen beiden liegt Schweigen.', locId1, 'INT', 'TAG', 16, 120],
    ['5', 4, 'Im Park', 'Andi und Mia sitzen auf einer Bank. Er schreibt, sie liest.', locId2, 'EXT', 'TAG', 20, 150],
    ['6', 5, 'Der Regen', 'Es beginnt zu regnen. Sie laufen Seite an Seite, ohne Worte.', locId2, 'EXT', 'TAG', 12, 90],
    ['7', 6, 'Café-Szene', 'Im Café. Mia bestellt für beide. Andi schreibt ihr einen Zettel.', locId3, 'INT', 'TAG', 16, 120],
    ['8', 7, 'Das Ende', 'Andi allein. Das Notizbuch. Er fängt an zu schreiben.', locId1, 'INT', 'NACHT', 8, 60],
  ]

  const sceneIds: number[] = []
  for (const [num, sort, title, desc, locId, intExt, dayNight, eighths, mins] of scenesData) {
    const res = await db.run(
      'INSERT INTO scenes (project_id, scene_number, sort_order, title, description, location_id, int_ext, day_night, eighths, estimated_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [projectId, num, sort, title, desc, locId, intExt, dayNight, eighths, mins]
    )
    sceneIds.push(res.id)
  }

  // Scene characters
  const sceneCharAssignments: [number, number][] = [
    [sceneIds[0], charId1], [sceneIds[1], charId1], [sceneIds[2], charId2],
    [sceneIds[3], charId1], [sceneIds[3], charId2],
    [sceneIds[4], charId1], [sceneIds[4], charId2],
    [sceneIds[5], charId1], [sceneIds[5], charId2],
    [sceneIds[6], charId1], [sceneIds[6], charId2],
    [sceneIds[7], charId1],
  ]
  for (const [sceneId, charId] of sceneCharAssignments) {
    await db.run(
      'INSERT INTO scene_characters (scene_id, character_id) VALUES (?, ?) ON CONFLICT DO NOTHING',
      [sceneId, charId]
    )
  }

  // Shoot days
  const day1 = await db.run(
    'INSERT INTO shoot_days (project_id, day_number, date, status, notes) VALUES (?, ?, ?, ?, ?)',
    [projectId, 1, d(-1), 'Geplant', 'Drehtag 1 - Innenaufnahmen Andis Wohnung']
  )
  const day2 = await db.run(
    'INSERT INTO shoot_days (project_id, day_number, date, status, notes) VALUES (?, ?, ?, ?, ?)',
    [projectId, 2, d(6), 'Geplant', 'Drehtag 2 - Außenaufnahmen Englischer Garten']
  )
  const day3 = await db.run(
    'INSERT INTO shoot_days (project_id, day_number, date, status, notes) VALUES (?, ?, ?, ?, ?)',
    [projectId, 3, d(7), 'Geplant', 'Drehtag 3 - Café und Schlussszene']
  )
  const dayId1 = day1.id, dayId2 = day2.id, dayId3 = day3.id

  const dayScenes: [number, number, number][] = [
    [dayId1, sceneIds[0], 0], [dayId1, sceneIds[1], 1], [dayId1, sceneIds[2], 2], [dayId1, sceneIds[3], 3],
    [dayId2, sceneIds[4], 0], [dayId2, sceneIds[5], 1],
    [dayId3, sceneIds[6], 0], [dayId3, sceneIds[7], 1],
  ]
  for (const [dayId, sceneId, sort] of dayScenes) {
    await db.run(
      'INSERT INTO shoot_day_scenes (shoot_day_id, scene_id, sort_order) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
      [dayId, sceneId, sort]
    )
  }

  // Budget
  const budget = await db.run(
    'INSERT INTO budget_versions (project_id, name, status) VALUES (?, ?, ?)',
    [projectId, 'Kalkulation v1', 'Aktiv']
  )
  const budgetId = budget.id

  const budgetLines: Array<[string, string, string, string, number, number]> = [
    ['1000 - Stab', '1100', 'Regisseurin (Pauschal)', 'Pauschal', 1, 200000],
    ['1000 - Stab', '1200', 'Produzent (Pauschal)', 'Pauschal', 1, 150000],
    ['2000 - Kamera', '2100', 'Director of Photography', 'Tage', 3, 80000],
    ['2000 - Kamera', '2200', 'Kameraassistent', 'Tage', 3, 40000],
    ['2000 - Kamera', '2300', 'Kameramiete', 'Tage', 3, 50000],
    ['3000 - Ton', '3100', 'Tonmeisterin', 'Tage', 3, 50000],
    ['3000 - Ton', '3200', 'Tonequipment', 'Pauschal', 1, 30000],
    ['4000 - Maske/Kostüm', '4100', 'Maskenbild', 'Tage', 3, 30000],
    ['4000 - Maske/Kostüm', '4200', 'Kostümbild', 'Tage', 2, 30000],
    ['5000 - Darst.', '5100', 'Hauptdarsteller Andi', 'Tage', 3, 50000],
    ['5000 - Darst.', '5200', 'Hauptdarstellerin Mia', 'Tage', 3, 50000],
    ['6000 - Motiv', '6100', 'Location Café Morgenrot', 'Tage', 1, 50000],
    ['6000 - Motiv', '6200', 'Drehgenehmigung Englischer Garten', 'Pauschal', 1, 20000],
    ['7000 - Verwaltung', '7100', 'Aufnahmeleitung', 'Tage', 3, 45000],
    ['8000 - Sonst.', '8100', 'Catering (3 Drehtage)', 'Tage', 3, 20000],
    ['8000 - Sonst.', '8200', 'Transport/Fahrzeuge', 'Pauschal', 1, 30000],
    ['8000 - Sonst.', '8300', 'Reserve (5%)', 'Pauschal', 1, 37375],
  ]

  let totalBudget = 0
  for (let i = 0; i < budgetLines.length; i++) {
    const [category, code, description, unit, qty, unitPrice] = budgetLines[i]
    const total = qty * unitPrice
    totalBudget += total
    await db.run(
      'INSERT INTO budget_lines (budget_version_id, category, account_code, description, unit, quantity, unit_price_cents, total_cents, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [budgetId, category, code, description, unit, qty, unitPrice, total, i]
    )
  }
  await db.run('UPDATE budget_versions SET total_cents = ? WHERE id = ?', [totalBudget, budgetId])

  // Financing
  const financing = await db.run(
    'INSERT INTO financing_plan_versions (project_id, name) VALUES (?, ?)',
    [projectId, 'Finanzierungsplan v1']
  )
  const finId = financing.id

  const finEntries: Array<[string, string, number, number]> = [
    ['FilmFernsehFonds Bayern', 'Förderung', 800000, 1],
    ['Eigenmittel Bauer Film', 'Eigenmittel', 400000, 1],
    ['ZDF Kleines Fernsehspiel', 'Sender', 200000, 0],
    ['DFFF (Bundesförderung)', 'Förderung', 100000, 0],
  ]
  let totalFin = 0
  for (let i = 0; i < finEntries.length; i++) {
    const [source, type, amount, confirmed] = finEntries[i]
    totalFin += amount
    await db.run(
      'INSERT INTO financing_entries (financing_version_id, source, type, amount_cents, confirmed, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [finId, source, type, amount, confirmed, i]
    )
  }
  await db.run('UPDATE financing_plan_versions SET total_cents = ? WHERE id = ?', [totalFin, finId])

  // Equipment
  const equip = await db.run(
    'INSERT INTO equipment_lists (project_id, name, department, notes) VALUES (?, ?, ?, ?)',
    [projectId, 'Kamera-Equipment Drehtage', 'Kamera', 'Mietanfrage an Movietech München']
  )
  const equipId = equip.id

  const equipItems: Array<[string, number, string, number, number]> = [
    ['Sony FX3 Kamera-Body', 1, 'Movietech München', 15000, 3],
    ['Zeiss CP.3 Objektiv-Set 25/50/85mm', 1, 'Movietech München', 20000, 3],
    ['Sachtler Flowtech 75 Stativ', 1, 'Movietech München', 5000, 3],
    ['SmallRig Shoulder Rig', 1, 'Movietech München', 2000, 3],
    ['V-Mount Akkus (4x)', 4, 'Movietech München', 1500, 3],
    ['Atomos Shogun Recorder', 1, 'Movietech München', 3000, 3],
  ]
  for (let i = 0; i < equipItems.length; i++) {
    const [item, qty, supplier, rentPerDay, days] = equipItems[i]
    const total = rentPerDay * days
    await db.run(
      'INSERT INTO equipment_items (equipment_list_id, item, quantity, supplier, rental_per_day_cents, total_days, total_cents, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [equipId, item, qty, supplier, rentPerDay, days, total, i]
    )
  }

  // Calendar events
  const events = [
    ['Drehtag 1 - Wohnküche', d(-1), 'Drehtag', '#f59e0b', 'Innenaufnahmen Andis Wohnung'],
    ['Drehtag 2 - Englischer Garten', d(6), 'Drehtag', '#f59e0b', 'Außenaufnahmen im Park'],
    ['Drehtag 3 - Café & Schluss', d(7), 'Drehtag', '#f59e0b', 'Café-Szene und Schlussszene'],
    ['Casting-Termin', d(-22), 'Casting', '#3b82f6', 'Casting für Nebenrollen'],
    ['Locationscout Englischer Garten', d(-15), 'Locationscout', '#10b981', 'Mit Lisa und Lars'],
    ['Produktionsbesprechung', d(-8), 'Meeting', '#8b5cf6', 'Finales Meeting vor Produktion'],
  ]
  for (const [title, date, type, color, notes] of events) {
    await db.run(
      'INSERT INTO project_events (project_id, title, start_date, type, color, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [projectId, title, date, type, color, notes]
    )
  }

  // Shots (Shotlist)
  const shotsData: Array<[number, string, string, string, string, number, string, number]> = [
    [sceneIds[0], 'E1', 'Totale', 'Statisch', '35mm', 0, 'Andi allein am Tisch, Fenster im Hintergrund', 8],
    [sceneIds[0], 'E2', 'Nahe', 'Statisch', '85mm', 1, 'Close auf leeres Notizbuch', 4],
    [sceneIds[0], 'E3', 'Groß', 'Statisch', '85mm', 2, 'Andis Gesicht - leerer Blick', 5],
    [sceneIds[3], 'E1', 'Halbnahe', 'Statisch', '50mm', 0, 'Andi öffnet die Tür', 6],
    [sceneIds[3], 'E2', 'Schuss-Gegenschuss', 'Statisch', '85mm', 1, 'Blick von Mia auf Andi', 5],
    [sceneIds[3], 'E3', 'Schuss-Gegenschuss', 'Statisch', '85mm', 2, 'Blick von Andi auf Mia', 5],
    [sceneIds[4], 'E1', 'Totale', 'Dolly', '35mm', 0, 'Weite Parklandschaft, Bank in Mitte', 10],
    [sceneIds[4], 'E2', 'Halbnahe', 'Statisch', '50mm', 1, 'Beide auf der Bank', 8],
    [sceneIds[6], 'E1', 'Totale', 'Statisch', '35mm', 0, 'Café-Überblick', 6],
    [sceneIds[6], 'E2', 'Nahe', 'Statisch', '85mm', 1, 'Mia bestellt', 5],
    [sceneIds[6], 'E3', 'Insert', 'Statisch', '85mm', 2, 'Andis Zettel in Großaufnahme', 4],
  ]
  for (const [sceneId, shotNum, size, movement, lens, sort, desc, dur] of shotsData) {
    await db.run(
      'INSERT INTO shots (project_id, scene_id, shot_number, size, movement, lens_mm, sort_order, description, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [projectId, sceneId, shotNum, size, movement, parseInt(lens), sort, desc, dur]
    )
  }

  // Call sheet for Day 1
  const cs1 = await db.run(
    'INSERT INTO call_sheets (shoot_day_id, general_call, shooting_call, location_id, weather_forecast, sunrise, sunset, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [dayId1, 420, 480, locId1, 'Sonnig, 18°C', '05:30', '21:00', 'Bitte pünktlich erscheinen. Parkplätze in der Nebenstraße.']
  )
  const castRows = await db.all('SELECT id FROM "cast" WHERE project_id = ?', [projectId])
  const crewRows = await db.all('SELECT id FROM crew WHERE project_id = ? ORDER BY id ASC', [projectId])
  const csEntries: Array<[string, number, number, string]> = [
    ['cast',  castRows[0]?.id, 420, 'Maske um 07:00'],
    ['cast',  castRows[1]?.id, 450, 'Maske um 07:30'],
    ['crew',  crewRows[0]?.id, 420, ''],
    ['crew',  crewRows[1]?.id, 420, ''],
    ['crew',  crewRows[2]?.id, 420, 'Equipment-Aufbau ab 06:00'],
    ['crew',  crewRows[4]?.id, 420, 'Ton-Setup ab 06:30'],
    ['crew',  crewRows[7]?.id, 390, 'Einlass koordinieren'],
  ]
  for (let i = 0; i < csEntries.length; i++) {
    const [type, personId, callTime, notes] = csEntries[i]
    if (!personId) continue
    await db.run(
      'INSERT INTO call_sheet_entries (call_sheet_id, person_type, person_id, call_time, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [cs1.id, type, personId, callTime, notes, i]
    )
  }

  // Daily report for Day 1 (completed)
  await db.run('UPDATE shoot_days SET status = ? WHERE id = ?', ['Abgedreht', dayId1])
  await db.run(
    `INSERT INTO daily_reports (shoot_day_id, call_time, first_shot, lunch_in, lunch_out, wrap, pages_shot, total_setups, camera_rolls, sound_rolls, production_notes, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [dayId1, 420, 495, 750, 810, 1110,
     2, 12, 2, 2,
     'Sehr produktiver Drehtag. Szenen 1-4 komplett abgedreht. Felix Wagner hat hervorragende Arbeit geleistet.',
     'Parkplätze waren knapp - für Tag 2 Alternativparkplatz organisieren.']
  )

  // Screenplay blocks (Drehbuch-Editor)
  const blocksByScene: Array<[number, string, string]>[] = [
    [ // Szene 1
      [sceneIds[0], 'scene_heading', 'INNEN. ANDIS WOHNKÜCHE - TAG'],
      [sceneIds[0], 'action', 'Die Küche ist klein und ordentlich. Morgenlicht fällt durchs Fenster. ANDI (28) sitzt reglos am Tisch. Vor ihm: eine Tasse Kaffee, die längst kalt ist. Ein leeres Notizbuch.'],
      [sceneIds[0], 'action', 'Er starrt auf das Notizbuch. Seine Hand liegt daneben, rührt sich nicht.'],
    ],
    [ // Szene 4
      [sceneIds[3], 'scene_heading', 'INNEN. ANDIS WOHNUNGSTÜR - TAG'],
      [sceneIds[3], 'action', 'Die Tür öffnet sich einen Spalt. Andi schaut durch den Spalt. MIA (30) steht im Treppenhaus, hält eine kleine Pflanze.'],
      [sceneIds[3], 'character', 'MIA'],
      [sceneIds[3], 'dialogue', 'Ich dachte, vielleicht... wäre das etwas für dich. Eine Pflanze. Die braucht nicht viel.'],
      [sceneIds[3], 'action', 'Andi sagt nichts. Schaut auf die Pflanze.'],
    ],
    [ // Szene 5
      [sceneIds[4], 'scene_heading', 'AUSSEN. ENGLISCHER GARTEN, BANK - TAG'],
      [sceneIds[4], 'action', 'Eine Bank am Teich. Andi schreibt in sein Notizbuch. Mia sitzt daneben, liest ein Buch. Keine Worte nötig.'],
      [sceneIds[4], 'action', 'Er dreht das Notizbuch, zeigt ihr eine Zeichnung. Sie lächelt.'],
    ],
  ]
  let blockSort = 0
  for (const sceneBlocks of blocksByScene) {
    blockSort = 0
    for (const [sceneId, blockType, content] of sceneBlocks) {
      await db.run(
        'INSERT INTO screenplay_blocks (project_id, scene_id, block_type, content, sort_order) VALUES (?, ?, ?, ?, ?)',
        [projectId, sceneId, blockType, content, blockSort++]
      )
    }
  }

  // Sticky notes (Pinboard) - schema: content, color, position_x, position_y (no title)
  const stickyData = [
    ['Englischer Garten Genehmigung noch ausstehend! Lars kümmert sich darum.', '#f59e0b', 0, 0],
    ['Vegane Option für Anna Schmidt (Hauptdarstellerin) nicht vergessen!', '#3b82f6', 220, 0],
    ['Sony FX3 Reservierung bestätigt von Movietech München.', '#10b981', 0, 220],
    ['Café Morgenrot: Sonntag 9-17 Uhr verfügbar. Kontakt: Maria Vogel 089 5556789', '#8b5cf6', 220, 220],
  ]
  for (const [content, color, posX, posY] of stickyData) {
    await db.run(
      'INSERT INTO sticky_notes (project_id, content, color, position_x, position_y) VALUES (?, ?, ?, ?, ?)',
      [projectId, content, color, posX, posY]
    )
  }

  // VFX shots - schema columns: shot_number, description, vfx_type, status, artist, deadline, complexity, notes
  const vfxShots = [
    ['VFX-001', sceneIds[5], 'Regen wird digital hinzugefügt', 'Compositing', 'Offen', '', '2026-07-01', 'Mittel', ''],
    ['VFX-002', sceneIds[0], 'Außenblick durchs Fenster - digitale Erweiterung', 'Matte Painting', 'Offen', '', '2026-07-15', 'Niedrig', ''],
  ]
  for (const [shotNum, sceneId, desc, vfxType, status, artist, deadline, complexity, notesTxt] of vfxShots) {
    await db.run(
      'INSERT INTO vfx_shots (project_id, scene_id, shot_number, description, vfx_type, status, artist, deadline, complexity, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [projectId, sceneId, shotNum, desc, vfxType, status, artist, deadline, complexity, notesTxt]
    )
  }

  // Post-production phases - schema column is "phase" not "name"
  const postPhases = [
    ['Rohschnitt', '2026-06-20', '2026-07-10', 'Maria Sommer', 'Laufend', 'Offline-Schnitt mit DaVinci Resolve'],
    ['Feinschnitt', '2026-07-11', '2026-07-18', 'Ben Richter', 'Ausstehend', 'Online-Grading nach Schnittabnahme'],
    ['Tonmischung', '2026-07-11', '2026-07-20', 'Julia Braun', 'Ausstehend', 'Atmos-Mix im Tonstudio München'],
    ['Farbkorrektur', '2026-07-01', '2026-07-22', 'VFX-Studio Berlin', 'Ausstehend', 'Regen und Matte Painting'],
    ['Abnahme', '2026-07-25', '2026-07-28', 'Thomas Bauer', 'Ausstehend', 'DCP + Web-Versionen'],
  ]
  for (let i = 0; i < postPhases.length; i++) {
    const [phase, start, end, responsible, status, notesTxt] = postPhases[i]
    await db.run(
      'INSERT INTO post_phases (project_id, phase, start_date, end_date, responsible, status, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [projectId, phase, start, end, responsible, status, notesTxt, i]
    )
  }

  // Music cues - duration_seconds is INTEGER, no sort_order column
  const musicCues = [
    ['Andis Morgen', 'Erik Satie', 'Satie Estate', 'Original', 'Unterlegt', 135, 'GEMA-pflichtig - Lizenz klären'],
    ['Parkszene', '', '', 'Original', 'Atmo', 220, 'Nur Umgebungsgeräusche, keine Musik'],
    ['Abspann', 'Ben Richter', 'Eigenkomposition', 'Original', 'Unterlegt', 90, 'Auftragskomposition'],
  ]
  for (const [title, composer, publisher, cueType, usageType, durSec, notesTxt] of musicCues) {
    await db.run(
      'INSERT INTO music_cues (project_id, title, composer, publisher, cue_type, usage_type, duration_seconds, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [projectId, title, composer, publisher, cueType, usageType, durSec, notesTxt]
    )
  }

  // Insurances
  const insurances = [
    ['Filmversicherung', 'Allianz Film & Entertainment', 'FV-2026-48291', 500000000, 180000, '2026-05-01', '2026-08-31', 'All-Risk Deckung inkl. Produktionsabbruch'],
    ['Haftpflicht', 'HDI Gerling', 'HP-2026-77412', 1000000000, 90000, '2026-06-01', '2026-06-30', 'Für alle Drehtage. Kopie beim AL.'],
    ['Equipmentversicherung', 'Ergo', 'EQ-2026-33901', 200000000, 45000, '2026-06-10', '2026-06-20', 'Mietequipment Movietech abgedeckt'],
  ]
  for (let i = 0; i < insurances.length; i++) {
    const [type, provider, policy, coverage, premium, start, end, notesTxt] = insurances[i]
    await db.run(
      'INSERT INTO insurances (project_id, ins_type, provider, policy_number, coverage_amount_cents, premium_cents, start_date, end_date, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [projectId, type, provider, policy, coverage, premium, start, end, notesTxt, i]
    )
  }

  // Vehicles - schema: name, license_plate, type, capacity, driver_name, driver_phone, notes
  const vehicles = [
    ['Produktionsbus', 'M-BP-2026', 'Transporter', 9, 'Lars Weber', '0178 8888888', 'Equipment-Transport, Mietwagen Sixt'],
    ['Regiefahrzeug', 'M-RG-445', 'PKW', 5, 'Sarah Müller', '0172 1111111', 'Privatwagen Regie'],
    ['Catering-Fahrzeug', 'M-CT-889', 'Transporter', 3, 'Catering Service', '', 'Kommt mit eigenem Fahrzeug'],
  ]
  for (const [name, plate, type, capacity, driverName, driverPhone, notesTxt] of vehicles) {
    await db.run(
      'INSERT INTO vehicles (project_id, name, license_plate, type, capacity, driver_name, driver_phone, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [projectId, name, plate, type, capacity, driverName, driverPhone, notesTxt]
    )
  }

  // Extras - schema: name, phone, email, tariff_group, notes
  const extras = [
    ['Thomas Meier', '0160 1112233', 'thomas.meier@gmail.com', 'Standard', 'Café-Gast, 17. Juni'],
    ['Sabine Koch', '0161 4445566', 'sabine.k@web.de', 'Standard', 'Café-Gast, 17. Juni'],
    ['Rainer Schmid', '0162 7778899', 'r.schmid@gmx.de', 'Standard', 'Parkbesucher, 16. Juni'],
    ['Petra Lange', '0163 0001122', 'p.lange@mail.de', 'Standard', 'Parkbesucherin, 16. Juni'],
  ]
  for (const [name, phone, email, tariff, notesTxt] of extras) {
    await db.run(
      'INSERT INTO extras (project_id, name, phone, email, tariff_group, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [projectId, name, phone, email, tariff, notesTxt]
    )
  }

  // Camera presets - schema: name, camera, lenses, notes
  const presets = [
    ['Standard Dialog', 'Sony FX3', '50mm T2.8', 'A-Kamera Dialog-Einstellungen, ISO 800'],
    ['Totale Außen', 'Sony FX3', '35mm T4', 'Standard für Außentotalen, ISO 400'],
    ['Close-Up Emotion', 'Sony FX3', '85mm T2', 'Intensive Nahaufnahmen, flache Schärfe, ISO 1600'],
  ]
  for (const [name, camera, lenses, notesTxt] of presets) {
    await db.run(
      'INSERT INTO camera_presets (project_id, name, camera, lenses, notes) VALUES (?, ?, ?, ?, ?)',
      [projectId, name, camera, lenses, notesTxt]
    )
  }

  console.log(`[DB] Demo-Daten "Sprachlos" eingefügt${ownerId ? ` (Owner ${ownerId})` : ''}.`)
  return projectId
}
