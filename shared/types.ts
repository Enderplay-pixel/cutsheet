// ─── Projects ────────────────────────────────────────────────────────────────

export interface Project {
  id: number
  title: string
  genre: string
  format: string // Kurzfilm, Spielfilm, Dokumentation, Serie, Werbung
  length_minutes: number
  status: 'Entwicklung' | 'Vorproduktion' | 'Produktion' | 'Postproduktion' | 'Abgeschlossen'
  director: string
  producer: string
  dop: string // Director of Photography
  production_company: string
  shoot_start: string | null // ISO date
  shoot_end: string | null
  created_at: string
  updated_at: string
}

export interface ProjectSettings {
  id: number
  project_id: number
  default_call_time: number // minutes from midnight
  default_wrap_time: number
  turnaround_hours: number
  currency: string
  country: string
  union: string // Kein, ver.di, etc.
  logo_url: string | null
  header_color: string
}

// ─── Scenes ──────────────────────────────────────────────────────────────────

export interface Scene {
  id: number
  project_id: number
  scene_number: string // e.g. "1", "1A", "42B"
  sort_order: number
  title: string
  description: string
  location_id: number | null
  location_name?: string // joined
  int_ext: 'INT' | 'EXT' | 'INT/EXT'
  day_night: 'TAG' | 'NACHT' | 'DÄMMERUNG' | 'MORGEN'
  eighths: number // page count in eighths
  estimated_minutes: number
  characters?: SceneCharacter[]
  inventory?: SceneInventory[]
  notes: string
  created_at: string
  updated_at: string
}

export interface SceneCharacter {
  id: number
  scene_id: number
  character_id: number
  character_name?: string // joined
  role_in_scene: string
}

export interface SceneInventory {
  id: number
  scene_id: number
  item: string
  category: 'Requisite' | 'Kostüm' | 'Maske' | 'Spezialequipment' | 'Fahrzeug' | 'Tier' | 'Sonstiges'
  quantity: number
  notes: string
}

// ─── Characters & Cast ───────────────────────────────────────────────────────

export interface Character {
  id: number
  project_id: number
  name: string
  description: string
  age_range: string
  gender: string
  sort_order: number
}

export interface Cast {
  id: number
  project_id: number
  character_id: number | null
  character_name?: string // joined
  actor_name: string
  email: string
  phone: string
  agent: string
  agent_email: string
  agency: string
  fee_per_day: number // cents
  contract_type: 'Tagesgage' | 'Wochengage' | 'Pauschal' | 'Ehrenamtlich'
  availability_notes: string
  photo_url: string | null
  notes: string
}

// ─── Crew ────────────────────────────────────────────────────────────────────

export interface Crew {
  id: number
  project_id: number
  name: string
  department: string
  role: string
  email: string
  phone: string
  fee_per_day: number // cents
  contract_type: 'Tagesgage' | 'Wochengage' | 'Pauschal' | 'Ehrenamtlich'
  availability_notes: string
  notes: string
  sort_order: number
}

// ─── Locations ───────────────────────────────────────────────────────────────

export interface Location {
  id: number
  project_id: number
  name: string
  address: string
  city: string
  zip: string
  country: string
  lat: number | null
  lng: number | null
  contact_name: string
  contact_phone: string
  contact_email: string
  rental_fee: number // cents per day
  parking_info: string
  power_available: boolean
  notes: string
  photos: string[] // URLs
  created_at: string
}

// ─── Shoot Days & Drehplan ───────────────────────────────────────────────────

export interface ShootDay {
  id: number
  project_id: number
  day_number: number
  date: string // ISO date
  status: 'Geplant' | 'Bestätigt' | 'Abgedreht' | 'Ausgefallen' | 'Sperrtag'
  unit: string // Haupteinheit, 2. Einheit, etc.
  notes: string
  scenes?: ShootDayScene[]
  total_eighths?: number
  estimated_minutes?: number
}

export interface ShootDayScene {
  id: number
  shoot_day_id: number
  scene_id: number
  sort_order: number
  estimated_minutes: number | null
  scene?: Scene // joined
}

export interface DrehplanVersion {
  id: number
  project_id: number
  name: string
  snapshot_json: string // JSON of full drehplan
  created_at: string
}

// ─── Call Sheets / Tagesdispo ────────────────────────────────────────────────

export interface CallSheet {
  id: number
  shoot_day_id: number
  general_call: number // minutes
  shooting_call: number
  location_id: number | null
  location_name?: string
  weather_forecast: string
  sunrise: string
  sunset: string
  notes: string
  entries?: CallSheetEntry[]
  created_at: string
  updated_at: string
}

export interface CallSheetEntry {
  id: number
  call_sheet_id: number
  person_type: 'cast' | 'crew'
  person_id: number
  person_name?: string
  role?: string
  call_time: number // minutes from midnight
  pickup_location: string
  notes: string
  sort_order: number
}

// ─── Daily Reports / Tagesbericht ────────────────────────────────────────────

export interface DailyReport {
  id: number
  shoot_day_id: number
  date: string
  call_time: number
  first_shot: number
  lunch_in: number | null
  lunch_out: number | null
  wrap: number
  scenes_completed: string[]
  scenes_partial: string[]
  pages_shot: number // eighths
  total_setups: number
  camera_rolls: string
  sound_rolls: string
  notes: string
  production_notes: string
  cast?: DailyReportCast[]
  created_at: string
  updated_at: string
}

export interface DailyReportCast {
  id: number
  daily_report_id: number
  cast_id: number
  actor_name?: string
  character_name?: string
  call_time: number
  makeup_in: number | null
  on_set: number | null
  wrap: number | null
  notes: string
}

// ─── Shots & Storyboard ──────────────────────────────────────────────────────

export interface Shot {
  id: number
  project_id: number
  scene_id: number | null
  shoot_day_id: number | null
  shot_number: string // e.g. "001", "001A"
  sort_order: number
  size: 'EST' | 'WT' | 'HT' | 'AT' | 'HN' | 'GN' | 'N' | 'DET'
  // EST=Einstellungsgröße Total, WT=Weite, HT=Halbtotale, AT=Amerikanisch, HN=Halbnah, GN=Groß-Nah, N=Nah, DET=Detail
  movement: 'Statisch' | 'Schwenk' | 'Neigung' | 'Fahrt' | 'Kran' | 'Handkamera' | 'Steadicam' | 'Drohne' | 'Zoom'
  lens_mm: string
  description: string
  notes: string
  storyboard_url: string | null
  duration_seconds: number | null
  created_at: string
}

export interface StoryboardFrame {
  id: number
  shot_id: number
  frame_number: number
  image_url: string
  description: string
}

// ─── Budget & Kalkulation ────────────────────────────────────────────────────

export interface BudgetVersion {
  id: number
  project_id: number
  name: string
  status: 'Entwurf' | 'Aktiv' | 'Archiviert'
  total_cents: number
  created_at: string
  updated_at: string
}

export interface BudgetLine {
  id: number
  budget_version_id: number
  category: string // e.g. "1100 - Regisseur"
  account_code: string
  description: string
  unit: string // Tage, Wochen, Stück, Pauschal
  quantity: number
  unit_price_cents: number
  total_cents: number
  notes: string
  sort_order: number
}

export interface FinancingPlanVersion {
  id: number
  project_id: number
  name: string
  total_cents: number
  created_at: string
}

export interface FinancingEntry {
  id: number
  financing_version_id: number
  source: string // e.g. "Filmförderung Bayern"
  type: 'Förderung' | 'Eigenmittel' | 'Co-Produktion' | 'Sender' | 'Verleih' | 'Sonstiges'
  amount_cents: number
  confirmed: boolean
  notes: string
  sort_order: number
}

// ─── Equipment ───────────────────────────────────────────────────────────────

export interface EquipmentList {
  id: number
  project_id: number
  name: string
  department: string
  shoot_day_id: number | null
  notes: string
  created_at: string
}

export interface EquipmentItem {
  id: number
  equipment_list_id: number
  item: string
  quantity: number
  supplier: string
  rental_per_day_cents: number
  total_days: number
  total_cents: number
  checked: boolean
  notes: string
  sort_order: number
}

// ─── Comments ────────────────────────────────────────────────────────────────

export interface Comment {
  id: number
  project_id: number
  entity_type: string // 'scene' | 'shoot_day' | 'cast' | etc.
  entity_id: number
  author: string
  content: string
  resolved: boolean
  created_at: string
}

// ─── Calendar ────────────────────────────────────────────────────────────────

export interface ProjectEvent {
  id: number
  project_id: number
  title: string
  start_date: string
  end_date: string | null
  type: 'Drehtag' | 'Probe' | 'Casting' | 'Locationscout' | 'Meeting' | 'Abgabe' | 'Sonstiges'
  color: string
  notes: string
  all_day: boolean
}

// ─── API Response Envelope ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export interface ProjectStats {
  total_scenes: number
  scheduled_scenes: number
  unscheduled_scenes: number
  total_shoot_days: number
  completed_shoot_days: number
  total_pages: number // eighths / 8
  total_cast: number
  total_crew: number
  budget_total_cents: number
  financing_total_cents: number
  next_shoot_day: ShootDay | null
}

// ─── Search ──────────────────────────────────────────────────────────────────

export interface SearchResult {
  type: 'scene' | 'cast' | 'crew' | 'location' | 'shoot_day'
  id: number
  title: string
  subtitle: string
  url: string
}
