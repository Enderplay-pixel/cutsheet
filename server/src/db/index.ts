import { Pool, PoolClient } from 'pg'

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
    .replace(/datetime\('now'\)/gi, 'NOW()')
    .replace(/\bdate\('now'\)/gi, 'CURRENT_DATE')
    // Quote 'cast' — reserved word in PostgreSQL (lowercase only; CAST() function stays untouched)
    .replace(/\bcast\b(?!\s*\()/g, '"cast"')
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

  // Check if empty — seed demo data on first run
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
async function seedDemoData() {
  const projectResult = await db.run(`
    INSERT INTO projects (title, genre, format, length_minutes, status, director, producer, dop, production_company, shoot_start, shoot_end)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, ['Sprachlos', 'Drama', 'Kurzfilm', 15, 'Vorproduktion',
      'Sarah Müller', 'Thomas Bauer', 'Lisa Schneider', 'Bauer Film GmbH',
      '2026-06-15', '2026-06-17'])
  const projectId = projectResult.id

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
    'INSERT INTO cast (project_id, character_id, actor_name, email, phone, fee_per_day, contract_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [projectId, charId1, 'Felix Wagner', 'felix.wagner@email.de', '0170 1234567', 50000, 'Tagesgage']
  )
  await db.run(
    'INSERT INTO cast (project_id, character_id, actor_name, email, phone, fee_per_day, contract_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
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
    [projectId, 1, '2026-06-15', 'Geplant', 'Drehtag 1 - Innenaufnahmen Andis Wohnung']
  )
  const day2 = await db.run(
    'INSERT INTO shoot_days (project_id, day_number, date, status, notes) VALUES (?, ?, ?, ?, ?)',
    [projectId, 2, '2026-06-16', 'Geplant', 'Drehtag 2 - Außenaufnahmen Englischer Garten']
  )
  const day3 = await db.run(
    'INSERT INTO shoot_days (project_id, day_number, date, status, notes) VALUES (?, ?, ?, ?, ?)',
    [projectId, 3, '2026-06-17', 'Geplant', 'Drehtag 3 - Café und Schlussszene']
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
    ['Drehtag 1 - Wohnküche', '2026-06-15', 'Drehtag', '#f59e0b', 'Innenaufnahmen Andis Wohnung'],
    ['Drehtag 2 - Englischer Garten', '2026-06-16', 'Drehtag', '#f59e0b', 'Außenaufnahmen im Park'],
    ['Drehtag 3 - Café & Schluss', '2026-06-17', 'Drehtag', '#f59e0b', 'Café-Szene und Schlussszene'],
    ['Casting-Termin', '2026-05-20', 'Casting', '#3b82f6', 'Casting für Nebenrollen'],
    ['Locationscout Englischer Garten', '2026-05-28', 'Locationscout', '#10b981', 'Mit Lisa und Lars'],
    ['Produktionsbesprechung', '2026-06-01', 'Meeting', '#8b5cf6', 'Finales Meeting vor Produktion'],
  ]
  for (const [title, date, type, color, notes] of events) {
    await db.run(
      'INSERT INTO project_events (project_id, title, start_date, type, color, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [projectId, title, date, type, color, notes]
    )
  }

  console.log('[DB] Demo-Daten "Sprachlos" erfolgreich eingefügt.')
}
