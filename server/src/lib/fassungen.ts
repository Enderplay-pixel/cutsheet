/**
 * Drehbuch-Fassungen mit gesperrten Nummern (Plan Kino-Ausbau, AP A3).
 *
 * Reine Rechnungen ohne Datenbank: welche Szene der neuen Datei zu welcher
 * vorhandenen gehört, welche Nummer eine neue Szene im gesperrten Drehbuch
 * bekommt, welche Farbe eine Fassung trägt und was sich zeilenweise geändert
 * hat. `routes/screenplay.ts` schreibt, was hier herauskommt.
 *
 * Warum das zählt: Dispo, Shotlist, Kontinuität und Tagesbericht hängen an
 * Szenennummern. Bis zum 14.11.2026 konnte ein Projekt ein Drehbuch nur
 * einmal einlesen oder alles anhängen (Testbericht SALZWIND, Priorität 5).
 */

/** Eine Szene, wie sie in der Datei oder im Projekt steht: Nummer, Überschrift, Textzeilen. */
export type SzenenText = { nummer: string; kopf: string; zeilen: string[] }
export type Vorhandene = SzenenText & { id: number; omitted?: boolean }

export interface Zuordnung<V extends Vorhandene = Vorhandene, E extends SzenenText = SzenenText> {
  unveraendert: Array<{ alt: V; neu: E }>
  geaendert: Array<{ alt: V; neu: E }>
  /** `nach`: Kennung der vorangehenden zugeordneten Szene, null vor der ersten */
  neu: Array<{ neu: E; nach: number | null }>
  fehlt: V[]
}

/** Datenbank oder Transaktion - nur, was `drehbuchGesperrt` braucht. */
type Lesen = { get: (sql: string, werte?: any[]) => Promise<any> }

/** Ist das Drehbuch des Projekts gesperrt? Dann bleiben Szenennummern, wie sie sind. */
export async function drehbuchGesperrt(z: Lesen, projectId: number | string): Promise<boolean> {
  const s = await z.get('SELECT script_locked_at FROM project_settings WHERE project_id = ?', [projectId])
  return !!s?.script_locked_at
}

const glatt = (s: string) => String(s ?? '').replace(/\s+/g, ' ').trim()
const nummerSchluessel = (n: string) => glatt(n).toUpperCase()

/** Die Überschrift ohne Nummer, Großschreibung und Leerzeichen - "INT. KÜCHE - TAG". */
export function kopfSchluessel(kopf: string): string {
  return glatt(String(kopf ?? '').replace(/\s#[^#\s]+#\s*$/, '').replace(/[–—]/g, '-')).toUpperCase()
}

/** Gleich heißt: dieselbe Überschrift und dieselben Zeilen, nachdem Leerzeichen geglättet sind. */
function gleicherText(a: SzenenText, b: SzenenText): boolean {
  if (kopfSchluessel(a.kopf) !== kopfSchluessel(b.kopf)) return false
  const za = a.zeilen.map(glatt).filter(Boolean)
  const zb = b.zeilen.map(glatt).filter(Boolean)
  return za.length === zb.length && za.every((z, i) => z === zb[i])
}

/**
 * Ordnet die Szenen einer neuen Datei den vorhandenen zu (Soll 2).
 *
 * Tragen alle Szenen der Datei eine Nummer, zählt die Nummer. Sonst zählt
 * die Überschrift, und bei gleichen Überschriften das wievielte Vorkommen.
 * Eine entfallene Szene, die in der Datei wieder steht, gilt als geändert -
 * sie kommt zurück. Eine entfallene, die fehlt, fehlt nicht noch einmal.
 */
export function ordneZu<V extends Vorhandene, E extends SzenenText>(vorhanden: V[], eingelesen: E[]): Zuordnung<V, E> {
  const ergebnis: Zuordnung<V, E> = { unveraendert: [], geaendert: [], neu: [], fehlt: [] }
  const vergeben = new Set<number>()
  const nachNummer = eingelesen.length > 0 && eingelesen.every((e) => nummerSchluessel(e.nummer) !== '')

  const jeNummer = new Map<string, V>()
  const jeKopf = new Map<string, V[]>()
  for (const v of vorhanden) {
    if (!jeNummer.has(nummerSchluessel(v.nummer))) jeNummer.set(nummerSchluessel(v.nummer), v)
    const k = kopfSchluessel(v.kopf)
    jeKopf.set(k, [...(jeKopf.get(k) ?? []), v])
  }
  const vorkommen = new Map<string, number>()

  let zuletzt: number | null = null
  for (const e of eingelesen) {
    let treffer: V | undefined
    if (nachNummer) {
      treffer = jeNummer.get(nummerSchluessel(e.nummer))
    } else {
      const k = kopfSchluessel(e.kopf)
      const n = vorkommen.get(k) ?? 0
      vorkommen.set(k, n + 1)
      treffer = (jeKopf.get(k) ?? [])[n]
    }
    if (treffer && !vergeben.has(treffer.id)) {
      vergeben.add(treffer.id)
      zuletzt = treffer.id
      if (!treffer.omitted && gleicherText(treffer, e)) ergebnis.unveraendert.push({ alt: treffer, neu: e })
      else ergebnis.geaendert.push({ alt: treffer, neu: e })
    } else {
      ergebnis.neu.push({ neu: e, nach: zuletzt })
    }
  }
  ergebnis.fehlt = vorhanden.filter((v) => !vergeben.has(v.id) && !v.omitted)
  return ergebnis
}

/** Der Buchstabe nach `b`: A → B, Z → AA (nur für den Fall, dass alle 26 belegt sind). */
function naechsterBuchstabe(b: string): string {
  return b === 'Z' ? 'AA' : String.fromCharCode(b.charCodeAt(0) + 1)
}

/**
 * Die Nummer einer neuen Szene im gesperrten Drehbuch (Soll 1): die Nummer der
 * Szene davor plus den nächsten freien Buchstaben - 13A, 13B. Hinter 13A
 * zuerst 13B, ist das vergeben, 13AA. Vor der ersten Szene (`davor` null):
 * A plus deren Nummer, also A1, dann B1.
 */
export function naechsteNummer(davor: string | null, vergebenListe: Iterable<string>, erste?: string | null): string {
  const vergeben = new Set([...vergebenListe].map(nummerSchluessel))
  const frei = (n: string) => !vergeben.has(nummerSchluessel(n))
  if (davor === null || glatt(davor) === '') {
    const basis = glatt(erste ?? '1')
    for (let b = 'A'; b.length === 1; b = naechsterBuchstabe(b)) if (frei(b + basis)) return b + basis
    return 'A' + basis + 'A'
  }
  const nummer = glatt(davor).toUpperCase()
  const endung = nummer.match(/^(.*\d)([A-Z])$/)
  if (endung) {
    const kandidat = endung[1] + naechsterBuchstabe(endung[2])
    if (naechsterBuchstabe(endung[2]).length === 1 && frei(kandidat)) return kandidat
  }
  for (let b = 'A'; b.length === 1; b = naechsterBuchstabe(b)) if (frei(nummer + b)) return nummer + b
  return nummer + 'AA'
}

/** Farbfolge der Revisionen (R10): Weiß ist die Erstfassung, danach Blau bis Kirschrot, dann von vorn. */
const FARBEN = ['blau', 'rosa', 'gelb', 'gruen', 'goldgelb', 'chamois', 'lachs', 'kirschrot'] as const

export function farbeFuer(nummer: number): string {
  if (nummer <= 0) return 'weiss'
  const runde = Math.floor((nummer - 1) / FARBEN.length) + 1
  const farbe = FARBEN[(nummer - 1) % FARBEN.length]
  return runde === 1 ? farbe : `${farbe}-${runde}`
}

const NAME: Record<string, string> = {
  weiss: 'Weiße Fassung', blau: 'Blaue Fassung', rosa: 'Rosa Fassung', gelb: 'Gelbe Fassung',
  gruen: 'Grüne Fassung', goldgelb: 'Goldgelbe Fassung', chamois: 'Chamois-Fassung',
  lachs: 'Lachsfarbene Fassung', kirschrot: 'Kirschrote Fassung',
}
const ORDINAL = ['', '', 'Zweite', 'Dritte', 'Vierte', 'Fünfte', 'Sechste', 'Siebte', 'Achte', 'Neunte', 'Zehnte']

/** "Blaue Fassung", "Zweite Blaue Fassung" - für Kopfzeile und Liste. Unbekanntes bleibt, wie es ist. */
export function fassungsName(farbe: string): string {
  const [art, rundeText] = String(farbe ?? '').split('-')
  const name = NAME[art] ?? art
  const runde = Number(rundeText) || 1
  return runde > 1 ? `${ORDINAL[runde] ?? `${runde}.`} ${name}` : name
}

export const FARBSCHLUESSEL = ['weiss', ...FARBEN]

/**
 * Alt gegen neu, zeilenweise (Soll 5): längste gemeinsame Teilfolge, ohne
 * neue Abhängigkeit. `alt` und `neu` sind die Stellen in den Listen - so
 * weiß der Import, welche Blöcke gleich geblieben sind.
 */
export function vergleiche(alt: string[], neu: string[]): Array<{ art: 'gleich' | 'weg' | 'neu'; zeile: string; alt?: number; neu?: number }> {
  const n = alt.length
  const m = neu.length
  const lang: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lang[i][j] = glatt(alt[i]) === glatt(neu[j]) ? lang[i + 1][j + 1] + 1 : Math.max(lang[i + 1][j], lang[i][j + 1])
    }
  }
  const zeilen: Array<{ art: 'gleich' | 'weg' | 'neu'; zeile: string; alt?: number; neu?: number }> = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (glatt(alt[i]) === glatt(neu[j])) {
      zeilen.push({ art: 'gleich', zeile: neu[j], alt: i, neu: j })
      i++
      j++
    } else if (lang[i + 1][j] >= lang[i][j + 1]) {
      zeilen.push({ art: 'weg', zeile: alt[i], alt: i })
      i++
    } else {
      zeilen.push({ art: 'neu', zeile: neu[j], neu: j })
      j++
    }
  }
  for (; i < n; i++) zeilen.push({ art: 'weg', zeile: alt[i], alt: i })
  for (; j < m; j++) zeilen.push({ art: 'neu', zeile: neu[j], neu: j })
  return zeilen
}
