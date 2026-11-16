import { db } from '../db'
import { kostenartName } from './ffaSchema'

type Zugriff = { get: typeof db.get }

export type Kalkulation = { id: number; name: string; status: string; total_cents: number; schema: string }

/**
 * Die Kalkulation, gegen die gerechnet wird: die aktive, sonst die neueste.
 *
 * Eine neue Fassung beginnt als "Entwurf". Bis zum 09.11.2026 rechneten
 * Kostenstand, Dashboard und Budgetalarm nur gegen eine Fassung mit dem
 * Status "Aktiv" - gemessen im Testbericht SALZWIND: Kalkulation über
 * 4,7 Mio. € gefüllt, Kostenstand "Kalkuliert 0,00 €" und "Überzogen", weil
 * niemand die Fassung umgestellt hatte. Der Konfliktradar nahm schon die
 * neueste; jetzt gilt das überall, und die Seiten sagen, welche Fassung es ist.
 */
export async function massgeblicheKalkulation(projectId: number | string, zugriff: Zugriff = db): Promise<Kalkulation | null> {
  const zeile = (await zugriff.get(
    `SELECT id, name, status, COALESCE(total_cents, 0) AS total_cents, schema
       FROM budget_versions WHERE project_id = ?
      ORDER BY (status = 'Aktiv') DESC, created_at DESC, id DESC LIMIT 1`,
    [projectId]
  )) as any
  if (!zeile) return null
  return { id: Number(zeile.id), name: String(zeile.name), status: String(zeile.status), total_cents: Number(zeile.total_cents) || 0, schema: String(zeile.schema ?? 'frei') }
}

// ─── Finanzierung (Plan Kino-Ausbau, AP B2) ─────────────────────────────────

export const FINANZ_STATUS = ['geplant', 'beantragt', 'zugesagt', 'ausgezahlt'] as const
export type FinanzStatus = (typeof FINANZ_STATUS)[number]
export const istFinanzStatus = (s: unknown): s is FinanzStatus => typeof s === 'string' && (FINANZ_STATUS as readonly string[]).includes(s)
/** Zugesagt ist auch, was schon ausgezahlt ist. */
export const istZugesagt = (s: unknown) => s === 'zugesagt' || s === 'ausgezahlt'

/** Der Finanzierungsplan, der gilt: der neueste - wie im Konfliktradar. */
export async function massgeblicherFinanzierungsplan(projectId: number | string, zugriff: Zugriff = db): Promise<{ id: number; total_cents: number } | null> {
  const zeile = (await zugriff.get(
    'SELECT id, COALESCE(total_cents, 0) AS total_cents FROM financing_plan_versions WHERE project_id = ? ORDER BY created_at DESC, id DESC LIMIT 1',
    [projectId]
  )) as any
  return zeile ? { id: Number(zeile.id), total_cents: Number(zeile.total_cents) || 0 } : null
}

// ─── Rückstellungen und Beistellungen (AP E4) ───────────────────────────────

/**
 * Was die maßgebliche Kalkulation zurückstellt und beigestellt bekommt. Beides
 * ist Kosten und Finanzierung zugleich: Der Finanzierungsplan zählt es als
 * zugesagt, der Kostenstand erwartet dafür keinen Beleg, der Cashflow keine
 * Auszahlung.
 */
export async function ausKalkulation(projectId: number | string, zugriff: Zugriff = db): Promise<{ rueckstellungen_cents: number; beistellungen_cents: number; kalkulation_id: number | null }> {
  const k = await massgeblicheKalkulation(projectId, zugriff)
  if (!k) return { rueckstellungen_cents: 0, beistellungen_cents: 0, kalkulation_id: null }
  const s = (await zugriff.get(
    'SELECT COALESCE(SUM(deferred_cents), 0) AS r, COALESCE(SUM(in_kind_cents), 0) AS b FROM budget_lines WHERE budget_version_id = ?', [k.id]
  )) as any
  return { rueckstellungen_cents: Number(s?.r) || 0, beistellungen_cents: Number(s?.b) || 0, kalkulation_id: k.id }
}

export const AUS_KALKULATION = {
  rueckstellungen: 'Rückstellungen (aus der Kalkulation)',
  beistellungen: 'Beistellungen (aus der Kalkulation)',
} as const

/** Die zwei Zeilen des Finanzierungsplans, die sich selbst rechnen; nur mit Betrag. */
export function zeilenAusKalkulation(a: { rueckstellungen_cents: number; beistellungen_cents: number }) {
  return ([
    { art: 'rueckstellungen', id: -1, source: AUS_KALKULATION.rueckstellungen, amount_cents: a.rueckstellungen_cents, status: 'zugesagt' },
    { art: 'beistellungen', id: -2, source: AUS_KALKULATION.beistellungen, amount_cents: a.beistellungen_cents, status: 'zugesagt' },
  ] as const).filter((z) => z.amount_cents > 0)
}

export type Geldgeber = { id: number; amount_cents: unknown; status: unknown }
export type Rate = { id?: number; entry_id: number; amount_cents: unknown; due_on?: unknown; received_on?: unknown }

const tag = (d: unknown): string => (d instanceof Date ? d.toISOString() : String(d ?? '')).slice(0, 10)

/**
 * Stand einer Finanzierung gegen die Herstellungskosten: Summe, davon
 * zugesagt, davon ausgezahlt, Lücke, "noch nicht zugesagt" und
 * Überfinanzierung; je Geldgeber die Summe seiner Raten und ob sie den Betrag
 * übersteigt; die überfälligen Raten (fällig vor heute, nicht eingegangen).
 *
 * Ausgezahlt ist ein Geldgeber im Stand "ausgezahlt" ganz, sonst die Summe
 * seiner eingegangenen Raten.
 */
export function finanzierungsstand(eintraege: Geldgeber[], raten: Rate[], herstellungskosten: number, heute: string) {
  const betrag = (e: { amount_cents: unknown }) => Math.max(0, Number(e.amount_cents) || 0)
  const summe = eintraege.reduce((s, e) => s + betrag(e), 0)
  const zugesagt = eintraege.filter((e) => istZugesagt(e.status)).reduce((s, e) => s + betrag(e), 0)
  const jeGeldgeber = new Map<number, { summe_cents: number; eingegangen_cents: number; ueber_betrag: boolean }>()
  for (const e of eintraege) {
    const eigene = raten.filter((r) => Number(r.entry_id) === Number(e.id))
    const s = eigene.reduce((x, r) => x + betrag(r), 0)
    const ein = eigene.filter((r) => tag(r.received_on)).reduce((x, r) => x + betrag(r), 0)
    jeGeldgeber.set(Number(e.id), { summe_cents: s, eingegangen_cents: ein, ueber_betrag: s > betrag(e) })
  }
  const ausgezahlt = eintraege.reduce((s, e) => s + (e.status === 'ausgezahlt' ? betrag(e) : jeGeldgeber.get(Number(e.id))?.eingegangen_cents ?? 0), 0)
  const hk = Math.max(0, Math.round(herstellungskosten))
  const ueberfaellig = raten.filter((r) => tag(r.due_on) && tag(r.due_on) < heute && !tag(r.received_on))
  return {
    herstellungskosten_cents: hk,
    summe_cents: summe,
    zugesagt_cents: zugesagt,
    ausgezahlt_cents: ausgezahlt,
    luecke_cents: Math.max(0, hk - summe),
    nicht_zugesagt_cents: summe - zugesagt,
    ueberfinanziert_cents: Math.max(0, summe - hk),
    je_geldgeber: Object.fromEntries(jeGeldgeber),
    ueberfaellig: ueberfaellig.map((r) => ({ id: r.id, entry_id: Number(r.entry_id), amount_cents: betrag(r), due_on: tag(r.due_on) })),
  }
}

// ─── Kostenstand mit Endstand, Vergleich zweier Fassungen (AP E1) ───────────

export type StandZeile = {
  id: number
  gruppe: string
  description?: string | null
  total_cents: unknown
  forecast_rest_cents?: unknown
  closed?: unknown
  forecast_set_by_name?: string | null
  forecast_set_at?: unknown
  deferred_cents?: unknown
  in_kind_cents?: unknown
}
export type StandBeleg = { budget_line_id?: unknown; gruppe: string; amount_cents: unknown }

/**
 * Kalkulation, Ist, noch zu erwarten, Endstand und die Abweichung des
 * Endstands. Zurückgestellt und beigestellt (AP E4) sind Kosten ohne Beleg:
 * Sie stehen im Endstand, aber nicht in "noch zu erwarten".
 */
export function vierZahlen(soll: number, ist: number, rest: number, ohneZahlung = 0) {
  const endstand = ist + rest + ohneZahlung
  const abweichung = endstand - soll
  return {
    soll_cents: soll,
    ist_cents: ist,
    rest_cents: rest,
    ohne_zahlung_cents: ohneZahlung,
    endstand_cents: endstand,
    abweichung_cents: abweichung,
    abweichung_prozent: soll !== 0 ? Math.round((abweichung / soll) * 1000) / 10 : null,
    ueber: abweichung > 0,
    // Soll minus Ist, wie vor AP E1 - für Frühwarnung und Summenkarten
    diff_cents: soll - ist,
  }
}

const zahlOder0 = (w: unknown) => Number(w) || 0
const istGesetzt = (w: unknown) => w !== null && w !== undefined && w !== ''

/**
 * Der Kostenstand je Gruppe (Kostenart oder Kategorie) und je Zeile.
 *
 * "Noch zu erwarten" ist ohne Eingabe Kalkulation minus Ist, nie unter null;
 * überschreibt die Produktion den Wert, gilt ihrer; eine abgeschlossene Zeile
 * erwartet nichts mehr. Ein Beleg mit Zeile zählt zur Gruppe seiner Zeile,
 * einer ohne Zeile zur eigenen Gruppe, dort in der Zeile "Belege ohne Zeile"
 * - er mindert keinen Rest. So sind die Summen je Gruppe die Summen der Zeilen.
 */
export function kostenstand(
  zeilen: StandZeile[],
  belege: StandBeleg[],
  gruppen: Array<{ gruppe: string; zusatz?: { description: string; cents: number } }>,
) {
  const zeileVonId = new Map(zeilen.map((z) => [Number(z.id), z]))
  const istJeZeile = new Map<number, number>()
  const ohneZeile = new Map<string, number>()
  for (const b of belege) {
    const z = istGesetzt(b.budget_line_id) ? zeileVonId.get(Number(b.budget_line_id)) : undefined
    if (z) istJeZeile.set(Number(z.id), (istJeZeile.get(Number(z.id)) ?? 0) + zahlOder0(b.amount_cents))
    else ohneZeile.set(b.gruppe, (ohneZeile.get(b.gruppe) ?? 0) + zahlOder0(b.amount_cents))
  }
  const alleGruppen = [...gruppen]
  for (const g of [...zeilen.map((z) => z.gruppe), ...ohneZeile.keys()]) {
    if (!alleGruppen.some((x) => x.gruppe === g)) alleGruppen.push({ gruppe: g })
  }
  return alleGruppen.map((g) => {
    const eigene = zeilen.filter((z) => z.gruppe === g.gruppe).map((z) => {
      const soll = zahlOder0(z.total_cents)
      const ist = istJeZeile.get(Number(z.id)) ?? 0
      const abgeschlossen = z.closed === true
      const gesetzt = istGesetzt(z.forecast_rest_cents)
      // Zurückgestellt und beigestellt kommt nicht als Beleg (AP E4)
      const zurueck = Math.max(0, zahlOder0(z.deferred_cents))
      const bei = Math.max(0, zahlOder0(z.in_kind_cents))
      const rest = abgeschlossen ? 0 : gesetzt ? Math.max(0, zahlOder0(z.forecast_rest_cents)) : Math.max(0, soll - zurueck - bei - ist)
      return {
        id: Number(z.id), description: String(z.description ?? ''), ...vierZahlen(soll, ist, rest, zurueck + bei),
        zurueckgestellt_cents: zurueck, beigestellt_cents: bei,
        abgeschlossen, rest_gesetzt: gesetzt && !abgeschlossen,
        gesetzt_von: z.forecast_set_by_name ?? null, gesetzt_am: z.forecast_set_at ?? null,
      }
    })
    // Zusatzkosten Gagen (AP B1): gerechnet, nicht ausgegeben - der Rest ist der ganze Betrag
    const ohneAnteile = { zurueckgestellt_cents: 0, beigestellt_cents: 0, abgeschlossen: false, rest_gesetzt: false, gesetzt_von: null, gesetzt_am: null }
    if (g.zusatz) eigene.push({ id: 0, description: g.zusatz.description, ...vierZahlen(g.zusatz.cents, 0, g.zusatz.cents), ...ohneAnteile })
    const lose = ohneZeile.get(g.gruppe) ?? 0
    if (lose !== 0) eigene.push({ id: 0, description: 'Belege ohne Zeile', ...vierZahlen(0, lose, 0), ...ohneAnteile })
    const summe = (k: 'soll_cents' | 'ist_cents' | 'rest_cents' | 'ohne_zahlung_cents') => eigene.reduce((s, z) => s + z[k], 0)
    return { gruppe: g.gruppe, ...vierZahlen(summe('soll_cents'), summe('ist_cents'), summe('rest_cents'), summe('ohne_zahlung_cents')), zeilen: eigene }
  })
}

export const VERGLEICH_ART: Record<'beide' | 'nur_a' | 'nur_b', string> = { beide: '', nur_a: 'nur in A', nur_b: 'nur in B' }

/**
 * Zwei Fassungen eines Projekts laden und vergleichen (AP E1). Gruppe ist im
 * FFA-Schema die Kostenart, sonst die Kategorie. null, wenn eine Fassung
 * fehlt oder nicht zum Projekt gehört.
 */
export async function fassungenVergleichen(projectId: number, aId: unknown, bId: unknown, zugriff: { get: typeof db.get; all: typeof db.all } = db) {
  const lade = async (id: unknown) => (Number.isInteger(Number(id))
    ? (await zugriff.get('SELECT id, name, schema FROM budget_versions WHERE id = ? AND project_id = ?', [Number(id), projectId])) as any
    : null)
  const [va, vb] = [await lade(aId), await lade(bId)]
  if (!va || !vb) return null
  const zeilen = async (v: any) => ((await zugriff.all(
    'SELECT id, source_key, description, total_cents, cost_group, category FROM budget_lines WHERE budget_version_id = ? ORDER BY sort_order, id', [v.id])) as any[])
    .map((z) => ({
      ...z,
      gruppe: v.schema === 'ffa'
        ? (Number(z.cost_group) >= 1 && Number(z.cost_group) <= 11 ? `${Number(z.cost_group)} ${kostenartName(Number(z.cost_group))}` : 'Ohne Kostenart')
        : (String(z.category || '').trim() || 'Ohne Kategorie'),
    }))
  const v = vergleicheFassungen(await zeilen(va), await zeilen(vb))
  // Kostenarten nach ihrer Nummer, Kategorien wie geschrieben; ohne Nummer ans Ende
  const gruppen = v.gruppen.map((g) => ({ ...g, name: g.gruppe }))
    .sort((x, y) => (parseInt(x.name, 10) || 1e9) - (parseInt(y.name, 10) || 1e9) || x.name.localeCompare(y.name, 'de'))
  const summe = { a_cents: gruppen.reduce((s, g) => s + g.a_cents, 0), b_cents: gruppen.reduce((s, g) => s + g.b_cents, 0), diff_cents: 0 }
  summe.diff_cents = summe.b_cents - summe.a_cents
  return { a: { id: Number(va.id), name: String(va.name) }, b: { id: Number(vb.id), name: String(vb.name) }, gruppen, summe, unterschiede: v.unterschiede }
}

export type VergleichZeile = { id?: number; gruppe: string; source_key?: string | null; description?: string | null; total_cents: unknown }

/**
 * Zwei Fassungen nebeneinander: Zeilen finden über den Herkunftsschlüssel
 * zueinander, sonst über Gruppe und Beschreibung (ohne Groß- und
 * Kleinschreibung), je eine mit einer. Was nur in einer steht, heißt so.
 */
export function vergleicheFassungen(a: VergleichZeile[], b: VergleichZeile[]) {
  const frei = new Set(b.map((_, i) => i))
  const nimm = (pruefe: (z: VergleichZeile) => boolean) => {
    for (const i of frei) if (pruefe(b[i])) { frei.delete(i); return b[i] }
    return undefined
  }
  const text = (z: VergleichZeile) => String(z.description ?? '').trim().toLocaleLowerCase('de')
  const paare: Array<{ a?: VergleichZeile; b?: VergleichZeile }> = a.map((za) => ({ a: za }))
  // Erst der Herkunftsschlüssel, dann Gruppe und Beschreibung
  for (const p of paare) {
    const k = String(p.a!.source_key ?? '').trim()
    if (k) p.b = nimm((zb) => String(zb.source_key ?? '').trim() === k)
  }
  for (const p of paare) {
    if (!p.b) p.b = nimm((zb) => !String(zb.source_key ?? '').trim() || !String(p.a!.source_key ?? '').trim()
      ? zb.gruppe === p.a!.gruppe && text(zb) === text(p.a!) : false)
  }
  for (const i of frei) paare.push({ b: b[i] })
  const zeilen = paare.map(({ a: za, b: zb }) => {
    const ac = za ? zahlOder0(za.total_cents) : null
    const bc = zb ? zahlOder0(zb.total_cents) : null
    return {
      gruppe: (za ?? zb)!.gruppe,
      description: String((za ?? zb)!.description ?? ''),
      a_cents: ac, b_cents: bc, diff_cents: (bc ?? 0) - (ac ?? 0),
      art: za && zb ? 'beide' as const : za ? 'nur_a' as const : 'nur_b' as const,
    }
  })
  const gruppen = [...new Set(zeilen.map((z) => z.gruppe))].map((g) => {
    const eigene = zeilen.filter((z) => z.gruppe === g)
    const a_cents = eigene.reduce((s, z) => s + (z.a_cents ?? 0), 0)
    const b_cents = eigene.reduce((s, z) => s + (z.b_cents ?? 0), 0)
    return { gruppe: g, a_cents, b_cents, diff_cents: b_cents - a_cents, zeilen: eigene }
  })
  return { gruppen, unterschiede: zeilen.filter((z) => z.art !== 'beide' || z.diff_cents !== 0).length }
}

// ─── Regionaleffekt (AP E3) ─────────────────────────────────────────────────

export type RegionAnteil = { budget_line_id: unknown; region_id: unknown; share_bp: unknown }
export type RegionZeile = { id: number; total_cents: unknown; mindernd?: boolean }
export type RegionBeleg = { budget_line_id?: unknown; amount_cents: unknown }
export type RegionGeldgeber = { id: number; source?: string | null; amount_cents: unknown; region_id?: unknown; regional_effect_bp?: unknown }

export const ANTEILE_MAX = 4

/**
 * Anteile einer Zeile an bis zu vier Regionen prüfen: ganze Basispunkte über
 * null, jede Region einmal, zusammen höchstens 100 %. Gibt den Grund zurück
 * oder null.
 */
export function anteileFehler(anteile: Array<{ region_id: number; share_bp: number }>): string | null {
  if (anteile.length > ANTEILE_MAX) return `Höchstens ${ANTEILE_MAX} Regionen je Zeile`
  if (new Set(anteile.map((a) => a.region_id)).size !== anteile.length) return 'Jede Region nur einmal je Zeile'
  if (anteile.some((a) => !Number.isInteger(a.share_bp) || a.share_bp <= 0 || a.share_bp > 10_000)) return 'Ein Anteil liegt über 0 und höchstens bei 100 %'
  const summe = anteile.reduce((s, a) => s + a.share_bp, 0)
  if (summe > 10_000) return `Die Anteile ergeben zusammen ${String(summe / 100).replace('.', ',')} % - höchstens 100 %`
  return null
}

/** Ein Betrag nach Anteilen (Basispunkte) auf Regionen; der Rest ist "ohne Region". */
function aufteilen(cents: number, anteile: Array<{ region: number; bp: number }>, ziel: Map<number, number>) {
  let verteilt = 0
  for (const a of anteile) {
    const teil = Math.round((cents * a.bp) / 10_000)
    ziel.set(a.region, (ziel.get(a.region) ?? 0) + teil)
    verteilt += teil
  }
  ziel.set(0, (ziel.get(0) ?? 0) + cents - verteilt)
}

/**
 * Regionaleffekt je Region: geplant aus den Zeilen der Kalkulation nach ihren
 * Anteilen, bisher aus den Belegen (ein Beleg erbt die Aufteilung seiner
 * Zeile, einer ohne Zeile ist "ohne Region"), gefordert als Summe über die
 * Geldgeber der Region (Betrag mal Effekt), Differenz und erfüllt. Zeilen,
 * die die Kosten mindern (Kostenart 11), sind keine Ausgabe in einer Region.
 */
export function regionaleffekt(
  regionen: Array<{ id: number; name: string }>,
  zeilen: RegionZeile[],
  anteile: RegionAnteil[],
  belege: RegionBeleg[],
  geldgeber: RegionGeldgeber[],
) {
  const jeZeile = new Map<number, Array<{ region: number; bp: number }>>()
  for (const a of anteile) {
    const z = Number(a.budget_line_id)
    jeZeile.set(z, [...(jeZeile.get(z) ?? []), { region: Number(a.region_id), bp: Number(a.share_bp) || 0 }])
  }
  const zeileVonId = new Map(zeilen.map((z) => [Number(z.id), z]))
  const geplant = new Map<number, number>()
  const bisher = new Map<number, number>()
  for (const z of zeilen) {
    if (z.mindernd) continue
    aufteilen(Number(z.total_cents) || 0, jeZeile.get(Number(z.id)) ?? [], geplant)
  }
  for (const b of belege) {
    const z = istGesetzt(b.budget_line_id) ? zeileVonId.get(Number(b.budget_line_id)) : undefined
    if (z?.mindernd) continue
    aufteilen(Number(b.amount_cents) || 0, z ? jeZeile.get(Number(z.id)) ?? [] : [], bisher)
  }
  const forderungen = geldgeber
    .filter((g) => istGesetzt(g.region_id) && istGesetzt(g.regional_effect_bp))
    .map((g) => ({
      id: g.id, source: String(g.source ?? ''), region_id: Number(g.region_id), effekt_bp: Number(g.regional_effect_bp) || 0,
      amount_cents: Number(g.amount_cents) || 0,
      gefordert_cents: Math.round(((Number(g.amount_cents) || 0) * (Number(g.regional_effect_bp) || 0)) / 10_000),
    }))
  const zeilenJeRegion = regionen.map((r) => {
    const gefordert = forderungen.filter((f) => f.region_id === r.id).reduce((s, f) => s + f.gefordert_cents, 0)
    const g = geplant.get(r.id) ?? 0
    return {
      id: r.id, name: r.name,
      geplant_cents: g,
      bisher_cents: bisher.get(r.id) ?? 0,
      gefordert_cents: gefordert,
      differenz_cents: g - gefordert,
      erfuellt: gefordert > 0 ? g >= gefordert : null,
    }
  })
  return {
    regionen: zeilenJeRegion,
    ohne_region: { geplant_cents: geplant.get(0) ?? 0, bisher_cents: bisher.get(0) ?? 0 },
    geldgeber: forderungen,
  }
}
