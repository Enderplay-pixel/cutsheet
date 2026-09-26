/**
 * Eine Sicherung zurückspielen.
 *
 * Anlass: am 26.09.2026 gemessen - 300 Drehbuchblöcke in der Sicherungsdatei,
 * 0 nach dem Zurückspielen. Der Import kannte 25 Tabellen von Hand, die
 * Sicherung enthält 61.
 *
 * Hier läuft der echte Importlauf, nur die Datenbank ist gefälscht: ein
 * kleines Schema, und jedes INSERT wird mitgeschrieben.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

/** Schema der gefälschten Datenbank: Tabelle -> Spalten (Pflicht mit !). */
const SCHEMA: Record<string, string[]> = {
  projects: ['id', 'title!', 'owner_id'],
  locations: ['id', 'project_id!', 'name!'],
  scenes: ['id', 'project_id!', 'title!', 'location_id'],
  shoot_days: ['id', 'project_id!', 'date!'],
  screenplay_blocks: ['id', 'project_id!', 'scene_id!', 'content!'],
  daily_reports: ['id', 'shoot_day_id!', 'scenes_completed', 'scenes_partial'],
  crew: ['id', 'project_id!', 'name!'],
  call_sheets: ['id', 'shoot_day_id!'],
  call_sheet_entries: ['id', 'call_sheet_id!', 'person_type!', 'person_id!'],
  comments: ['id', 'project_id!', 'entity_type!', 'entity_id!', 'content!'],
  creator_youtube_accounts: ['id', 'project_id!', 'access_token', 'refresh_token'],
  project_members: ['id', 'project_id!', 'user_id!', 'role!'],
  moodboard_items: ['id', 'project_id!', 'title!'],
}

const eingefuegt: Array<{ tabelle: string; felder: string[]; werte: unknown[] }> = []
let naechsteId = 1000

vi.mock('../db', () => ({
  toPg: (sql: string) => sql,
  pool: { query: vi.fn(async () => ({ rows: [] })) },
  db: {
    all: vi.fn(async (sql: string) => {
      if (sql.includes('information_schema.columns')) {
        return Object.entries(SCHEMA).flatMap(([tabelle, spalten]) =>
          spalten.map((s, i) => ({
            table_name: tabelle,
            column_name: s.replace('!', ''),
            is_nullable: s.endsWith('!') ? 'NO' : 'YES',
            column_default: s.replace('!', '') === 'id' ? 'nextval(...)' : null,
            ordinal_position: i,
          })))
      }
      if (sql.includes('FROM users')) return [{ id: 1 }, { id: 2 }]
      return []
    }),
    get: vi.fn(async () => undefined),
    run: vi.fn(async (sql: string, werte: unknown[]) => {
      const m = sql.match(/INSERT INTO (\w+) \(([^)]+)\)/)
      if (m) eingefuegt.push({ tabelle: m[1], felder: m[2].split(', '), werte })
      return { id: naechsteId++, changes: 1 }
    }),
  },
}))

import { importiereInhalt } from '../lib/wiederherstellung'

/** Alle Zeilen einer Tabelle als {spalte: wert}. */
function zeilen(tabelle: string) {
  return eingefuegt
    .filter(e => e.tabelle === tabelle)
    .map(e => Object.fromEntries(e.felder.map((f, i) => [f, e.werte[i]])))
}

const SICHERUNG = {
  projects: [{ id: 7, title: 'Original' }],
  locations: [{ id: 50, project_id: 7, name: 'Motiv' }],
  scenes: [
    { id: 10, project_id: 7, title: 'Erste', location_id: 50 },
    { id: 11, project_id: 7, title: 'Zweite', location_id: null },
  ],
  shoot_days: [{ id: 20, project_id: 7, date: '2027-01-05' }],
  screenplay_blocks: [
    { id: 30, project_id: 7, scene_id: 10, content: 'INNEN. KÜCHE - TAG' },
    { id: 31, project_id: 7, scene_id: 11, content: 'Sie geht.' },
  ],
  daily_reports: [{ id: 40, shoot_day_id: 20, scenes_completed: '[10,11]', scenes_partial: '[]' }],
  crew: [{ id: 60, project_id: 7, name: 'Tonmann' }],
  call_sheets: [{ id: 70, shoot_day_id: 20 }],
  call_sheet_entries: [
    { id: 80, call_sheet_id: 70, person_type: 'crew', person_id: 60 },
    { id: 81, call_sheet_id: 70, person_type: 'crew', person_id: 999 },   // geloeschte Person
  ],
  comments: [{ id: 90, project_id: 7, entity_type: 'scene', entity_id: 10, content: 'Licht prüfen' }],
  creator_youtube_accounts: [{ id: 95, project_id: 7, access_token: 'geheim', refresh_token: 'auch' }],
  project_members: [{ id: 96, project_id: 7, user_id: 2, role: 'producer' }],
  moodboard_items: [{ id: 97, project_id: 7, title: 'Referenz' }],
}

describe('importiereInhalt', () => {
  let bericht: Awaited<ReturnType<typeof importiereInhalt>>

  beforeEach(async () => {
    eingefuegt.length = 0
    naechsteId = 1000
    bericht = await importiereInhalt(JSON.parse(JSON.stringify(SICHERUNG)) as any, 500, 1)
  })

  it('nimmt Tabellen mit, die keine Liste von Hand kennt', () => {
    // Genau der Befund: der Drehbuchtext fehlte
    expect(bericht.uebernommen['screenplay_blocks']).toBe(2)
    expect(zeilen('screenplay_blocks')[0].content).toBe('INNEN. KÜCHE - TAG')
    expect(bericht.uebernommen['moodboard_items']).toBe(1)
  })

  it('hängt alles an das neue Projekt', () => {
    for (const z of zeilen('scenes')) expect(z.project_id).toBe(500)
    for (const z of zeilen('moodboard_items')) expect(z.project_id).toBe(500)
  })

  it('schreibt Fremdschlüssel auf die neuen Kennungen um', () => {
    const motivId = eingefuegt.findIndex(e => e.tabelle === 'locations')
    const neueMotivId = 1000 + motivId
    const szenen = zeilen('scenes')
    expect(szenen[0].location_id).toBe(neueMotivId)
    expect(szenen[1].location_id).toBeNull()

    // Der Block muss auf die KOPIE der Szene zeigen, nicht auf die 10
    const bloecke = zeilen('screenplay_blocks')
    expect(bloecke[0].scene_id).not.toBe(10)
    expect(bloecke[0].scene_id).toBeGreaterThan(999)
  })

  it('legt Eltern vor Kindern an', () => {
    const platz = (t: string) => eingefuegt.findIndex(e => e.tabelle === t)
    expect(platz('scenes')).toBeLessThan(platz('screenplay_blocks'))
    expect(platz('shoot_days')).toBeLessThan(platz('call_sheets'))
    expect(platz('call_sheets')).toBeLessThan(platz('call_sheet_entries'))
  })

  it('schreibt auch Kennungen in JSON-Listen um', () => {
    // Sonst zeigt der Tagesbericht der Kopie auf Szenen des Originals und
    // die Zeitanalyse rechnet mit fremden Nummern.
    const liste = JSON.parse(String(zeilen('daily_reports')[0].scenes_completed))
    expect(liste).toHaveLength(2)
    for (const id of liste) expect(id).toBeGreaterThan(999)
    expect(liste).not.toContain(10)
  })

  it('löst person_id über person_type auf und lässt Verwaistes aus', () => {
    const eintraege = zeilen('call_sheet_entries')
    expect(eintraege).toHaveLength(1)                   // der zweite zeigt ins Leere
    expect(eintraege[0].person_id).toBeGreaterThan(999)
    expect(bericht.ausgelassen).toEqual([
      { tabelle: 'call_sheet_entries', grund: 'person_id nicht auflösbar', anzahl: 1 },
    ])
  })

  it('löst entity_id über entity_type auf', () => {
    expect(zeilen('comments')[0].entity_id).toBeGreaterThan(999)
  })

  it('nimmt keine Zugangsdaten und keine Mitgliedschaften mit', () => {
    expect(bericht.uebernommen['creator_youtube_accounts']).toBeUndefined()
    expect(bericht.uebernommen['project_members']).toBeUndefined()
    expect(JSON.stringify(eingefuegt)).not.toContain('geheim')
  })

  it('legt das Projekt selbst nicht noch einmal an', () => {
    expect(zeilen('projects')).toHaveLength(0)
  })
})
