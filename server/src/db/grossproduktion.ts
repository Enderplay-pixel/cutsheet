/**
 * Testprojekt "Nordlicht" — eine große Kinoproduktion, wie sie ein
 * Produktionsbüro wirklich führt.
 *
 * Wozu: Das Demo-Projekt "Sprachlos" hat acht Szenen und drei Drehtage. Damit
 * sieht man, ob eine Seite funktioniert, aber nicht, ob sie bei einem echten
 * Spielfilm trägt — 160 Szenen, 45 Drehtage, über hundert Leute im Stab, eine
 * Kalkulation mit Millionenbudget. Genau das braucht der Hard-Launch-Test: Last
 * auf jeder Liste, jedem PDF und jeder Auswertung.
 *
 * Die Daten sind erfunden, aber branchentypisch: Kalkulation nach dem
 * FFA-Schema, Stab nach Departments, Drehplan nach Motiven gebündelt, Tage in
 * der Vergangenheit sind abgedreht und haben Tagesberichte, Kameraberichte und
 * Timesheets. Ein fester Zufallsgenerator sorgt dafür, dass jeder Lauf dieselbe
 * Produktion erzeugt.
 */
import { db, TxClient } from './index'
import { heuteISO } from '../lib/datum'
import { hashPasswort } from '../lib/passwort'

export const GROSSPRODUKTION_TITEL = 'Nordlicht (Großproduktion)'

// ─── Zufall, aber reproduzierbar ────────────────────────────────────────────
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ─── Gebündeltes Einfügen ───────────────────────────────────────────────────
/**
 * Viele Zeilen in einem INSERT je Block. Einzelne INSERTs für ~20.000 Zeilen
 * würden Minuten dauern; so sind es Sekunden. Gibt die neuen IDs in
 * Einfügereihenfolge zurück.
 */
async function insertMany(tx: TxClient, table: string, cols: string[], rows: any[][], chunk = 400): Promise<number[]> {
  const ids: number[] = []
  const t = table === 'cast' ? '"cast"' : table
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk)
    let n = 0
    const values = part.map(r => `(${r.map(() => `$${++n}`).join(', ')})`).join(', ')
    const sql = `INSERT INTO ${t} (${cols.join(', ')}) VALUES ${values} RETURNING id`
    // Direkt über den Client: toPg() würde "?" ersetzen, hier stehen schon $n
    const res = await (tx as any).client.query(sql, part.flat())
    for (const row of res.rows) ids.push(row.id)
  }
  return ids
}

// ─── Stammdaten der Produktion ──────────────────────────────────────────────
const VORNAMEN = ['Jana', 'Lukas', 'Mira', 'Jonas', 'Hanna', 'Felix', 'Lea', 'Paul', 'Emma', 'Ben', 'Sophie', 'Finn', 'Clara', 'Noah', 'Ida', 'Emil',
  'Greta', 'Anton', 'Frieda', 'Mats', 'Lotte', 'Theo', 'Marlene', 'Jakob', 'Nele', 'Oskar', 'Ronja', 'Moritz', 'Johanna', 'Henrik', 'Svenja', 'Malte',
  'Ayşe', 'Deniz', 'Mehmet', 'Leyla', 'Tomasz', 'Katarzyna', 'Nikolai', 'Irina', 'Kwame', 'Amara', 'Luca', 'Giulia', 'Mateo', 'Sofía', 'Yusuf', 'Selin',
  'Björn', 'Kirsten', 'Hauke', 'Wiebke', 'Ole', 'Imke', 'Arne', 'Birte', 'Kai', 'Silke', 'Torben', 'Anke']
const NACHNAMEN = ['Petersen', 'Jensen', 'Hansen', 'Möller', 'Schröder', 'Carstensen', 'Thomsen', 'Lorenzen', 'Brodersen', 'Albers', 'Friedrichs',
  'Voss', 'Behrens', 'Krüger', 'Hartmann', 'Sommer', 'Lindner', 'Kowalski', 'Nowak', 'Yılmaz', 'Demir', 'Öztürk', 'Rossi', 'García', 'Asante',
  'Ivanova', 'Kraus', 'Wagner', 'Becker', 'Hoffmann', 'Schulte', 'Kühl', 'Stahl', 'Engel', 'Winter', 'Frahm', 'Detlefsen', 'Paulsen', 'Rasmussen',
  'Nielsen', 'Iversen', 'Claußen', 'Harms', 'Janssen', 'Ahrens', 'Bruhn', 'Dittmer', 'Ewers', 'Feddersen', 'Grothe']

const MOTIVE: Array<{ name: string; addr: string; city: string; zip: string; typ: 'INT' | 'EXT'; strom: number; miete: number; parken: string; note: string }> = [
  { name: 'Polizeipräsidium, Büro Mordkommission', addr: 'Bruno-Georges-Platz 1', city: 'Hamburg', zip: '22297', typ: 'INT', strom: 1, miete: 180000, parken: 'Innenhof, 12 Stellplätze', note: 'Drehzeit nur Sa/So, Ausweise am Empfang' },
  { name: 'Containerterminal Altenwerder', addr: 'Am Ballinkai 1', city: 'Hamburg', zip: '21129', typ: 'EXT', strom: 0, miete: 450000, parken: 'Besucherparkplatz Tor 3', note: 'Sicherheitseinweisung Pflicht, Warnwesten, max. 40 Personen' },
  { name: 'Jana Petersens Wohnung', addr: 'Marktstraße 104', city: 'Hamburg', zip: '20357', typ: 'INT', strom: 1, miete: 90000, parken: 'Halteverbot beantragt', note: '3. OG ohne Aufzug, Nachbarn informiert' },
  { name: 'Fischmarkt, Altonaer Fischauktionshalle', addr: 'Große Elbstraße 9', city: 'Hamburg', zip: '22767', typ: 'INT', strom: 1, miete: 320000, parken: 'Elbparkplatz', note: 'Sonntags ab 5 Uhr Markt — nur Mo–Fr' },
  { name: 'Köhlbrandbrücke, Standstreifen', addr: 'Köhlbrandbrücke', city: 'Hamburg', zip: '21107', typ: 'EXT', strom: 0, miete: 250000, parken: 'Nicht möglich, Shuttle', note: 'Vollsperrung 02–05 Uhr, Polizei begleitet' },
  { name: 'Reederei Carstensen, Chefetage', addr: 'Ballindamm 17', city: 'Hamburg', zip: '20095', typ: 'INT', strom: 1, miete: 210000, parken: 'Tiefgarage Europa-Passage', note: 'Glasfront — Reflexionen beachten' },
  { name: 'Hafenkneipe "Zum Anker"', addr: 'Hafenstraße 126', city: 'Hamburg', zip: '20359', typ: 'INT', strom: 1, miete: 120000, parken: 'Anwohnerzone, Sondergenehmigung', note: 'Kneipenbetrieb ab 18 Uhr — bis 17 Uhr fertig' },
  { name: 'Elbstrand Övelgönne', addr: 'Övelgönne 1', city: 'Hamburg', zip: '22605', typ: 'EXT', strom: 0, miete: 60000, parken: 'Museumshafen', note: 'Tide beachten, Niedrigwasser-Fenster im Plan' },
  { name: 'Lagerhalle Veddel', addr: 'Veddeler Damm 30', city: 'Hamburg', zip: '20539', typ: 'INT', strom: 1, miete: 150000, parken: 'Gelände, 30 Stellplätze', note: 'Basecamp und Garderobe hier' },
  { name: 'Krankenhaus St. Georg, Intensivstation (Nachbau)', addr: 'Studio Hamburg, Halle 4', city: 'Hamburg', zip: '22045', typ: 'INT', strom: 1, miete: 380000, parken: 'Studiogelände', note: 'Kulisse, Wände fliegend' },
  { name: 'Speicherstadt, Kehrwiederfleet', addr: 'Kehrwieder 2', city: 'Hamburg', zip: '20457', typ: 'EXT', strom: 0, miete: 140000, parken: 'P+R Baumwall', note: 'Touristen — Absperrung mit Security' },
  { name: 'Autobahnraststätte Stillhorn', addr: 'A1, Stillhorn West', city: 'Hamburg', zip: '21109', typ: 'EXT', strom: 1, miete: 95000, parken: 'LKW-Parkplatz Randbereich', note: 'Nachtdreh, Pächter informiert' },
  { name: 'Leuchtturm Westerhever', addr: 'Leuchtturmweg', city: 'Westerhever', zip: '25881', typ: 'EXT', strom: 0, miete: 210000, parken: 'Parkplatz am Deich, 2 km Fußweg', note: 'Naturschutzgebiet — Drohne nur mit Genehmigung' },
  { name: 'Leuchtturmwärterhaus', addr: 'Leuchtturmweg 3', city: 'Westerhever', zip: '25881', typ: 'INT', strom: 1, miete: 110000, parken: 'Deich', note: 'Kleine Räume, max. 12 Personen am Set' },
  { name: 'Fähre Glückstadt–Wischhafen', addr: 'Fähranleger', city: 'Glückstadt', zip: '25348', typ: 'EXT', strom: 0, miete: 280000, parken: 'Fährparkplatz', note: 'Fahrten 3x gebucht, Deck exklusiv' },
  { name: 'Villa Carstensen, Blankenese', addr: 'Strandweg 88', city: 'Hamburg', zip: '22587', typ: 'INT', strom: 1, miete: 420000, parken: 'Elbchaussee, Sondergenehmigung', note: 'Parkett schützen, Filzgleiter Pflicht' },
  { name: 'Villa Carstensen, Garten', addr: 'Strandweg 88', city: 'Hamburg', zip: '22587', typ: 'EXT', strom: 1, miete: 0, parken: 'siehe Villa', note: 'Mit Villa gebucht' },
  { name: 'U-Bahnhof Überseequartier', addr: 'Überseeboulevard', city: 'Hamburg', zip: '20457', typ: 'INT', strom: 1, miete: 300000, parken: 'Parkhaus Überseequartier', note: 'Betriebspause 01:30–04:00' },
  { name: 'Reeperbahn, Seitenstraße', addr: 'Hamburger Berg 12', city: 'Hamburg', zip: '20359', typ: 'EXT', strom: 0, miete: 80000, parken: 'Spielbudenplatz', note: 'Nachtdreh, zwei Security' },
  { name: 'Werft Blohm+Voss, Dock 10 (Außengelände)', addr: 'Hermann-Blohm-Straße 3', city: 'Hamburg', zip: '20457', typ: 'EXT', strom: 1, miete: 520000, parken: 'Werksgelände', note: 'Sicherheitsschuhe, Helmpflicht' },
  { name: 'Verhörraum (Studio)', addr: 'Studio Hamburg, Halle 2', city: 'Hamburg', zip: '22045', typ: 'INT', strom: 1, miete: 160000, parken: 'Studiogelände', note: 'Spiegelglas als Kulisse' },
  { name: 'Hotelzimmer "Hafenblick"', addr: 'Seewartenstraße 9', city: 'Hamburg', zip: '20459', typ: 'INT', strom: 1, miete: 70000, parken: 'Hotelgarage', note: 'Zimmer 612 und 614 geblockt' },
  { name: 'Elbtunnel (Alter)', addr: 'Bei den St. Pauli-Landungsbrücken', city: 'Hamburg', zip: '20359', typ: 'INT', strom: 1, miete: 260000, parken: 'Landungsbrücken', note: 'Fahrstühle reserviert, Fußgänger umgeleitet' },
  { name: 'Hafenbecken, Barkasse', addr: 'Landungsbrücken Brücke 4', city: 'Hamburg', zip: '20359', typ: 'EXT', strom: 0, miete: 190000, parken: 'Landungsbrücken', note: 'Wasserschutzpolizei informiert' },
  { name: 'Kleingartenanlage Wilhelmsburg', addr: 'Mengestraße 20', city: 'Hamburg', zip: '21107', typ: 'EXT', strom: 0, miete: 40000, parken: 'Vereinsparkplatz', note: 'Vereinsvorstand gibt Schlüssel' },
  { name: 'Friedhof Ohlsdorf, Kapelle 4', addr: 'Fuhlsbüttler Straße 756', city: 'Hamburg', zip: '22337', typ: 'INT', strom: 1, miete: 100000, parken: 'Haupteingang', note: 'Keine Dreharbeiten während Trauerfeiern' },
  { name: 'Autowerkstatt Frahm', addr: 'Billstraße 80', city: 'Hamburg', zip: '20539', typ: 'INT', strom: 1, miete: 85000, parken: 'Hof', note: 'Hebebühne nutzbar' },
  { name: 'Wattenmeer bei Westerhever', addr: 'Deichvorland', city: 'Westerhever', zip: '25881', typ: 'EXT', strom: 0, miete: 50000, parken: 'Deich', note: 'Nur mit Wattführer, Gezeitentabelle beachten' },
]

const ROLLEN: Array<[string, string, string, string]> = [
  // [Rolle, Beschreibung, Alter, Geschlecht]
  ['Jana Petersen', 'Kommissarin, Anfang 40, stur, trocken, seit dem Tod ihres Partners allein', '40-45', 'Weiblich'],
  ['Erik Carstensen', 'Reeder, Patriarch, charmant und gefährlich', '60-65', 'Männlich'],
  ['Malte Brodersen', 'Janas junger Kollege, Ehrgeiz größer als Erfahrung', '28-32', 'Männlich'],
  ['Leyla Demir', 'Hafenarbeiterin und Zeugin, die zu viel gesehen hat', '30-35', 'Weiblich'],
  ['Henrik Carstensen', 'Eriks Sohn, erbt ein Imperium, das er nicht will', '33-38', 'Männlich'],
  ['Wiebke Harms', 'Leiterin der Mordkommission, Janas Vorgesetzte', '50-55', 'Weiblich'],
  ['Tomasz Nowak', 'Kranführer, verschwindet in Nacht 1', '45-50', 'Männlich'],
  ['Ida Petersen', 'Janas Tochter, 16', '15-17', 'Weiblich'],
  ['Hauke Thomsen', 'Leuchtturmwärter a. D., Einsiedler', '70-75', 'Männlich'],
  ['Selin Öztürk', 'Rechtsmedizinerin', '35-40', 'Weiblich'],
  ['Arne Voss', 'Staatsanwalt', '45-50', 'Männlich'],
  ['Irina Ivanova', 'Übersetzerin mit Vergangenheit', '38-42', 'Weiblich'],
  ['Kwame Asante', 'Journalist beim Hafenblatt', '30-35', 'Männlich'],
  ['Birte Lorenzen', 'Wirtin "Zum Anker"', '55-60', 'Weiblich'],
  ['Ole Jensen', 'Kleinkrimineller, Informant', '25-30', 'Männlich'],
  ['Clara Carstensen', 'Eriks Frau, hält die Fassade', '58-62', 'Weiblich'],
  ['Mats Albers', 'Hafenmeister', '50-55', 'Männlich'],
  ['Deniz Yılmaz', 'IT-Forensiker', '27-30', 'Männlich'],
  ['Silke Behrens', 'Sekretärin Carstensen', '45-50', 'Weiblich'],
  ['Luca Rossi', 'Schiffsmakler aus Genua', '40-45', 'Männlich'],
  ['Amara Asante', 'Kwames Schwester, Krankenschwester', '28-32', 'Weiblich'],
  ['Torben Kühl', 'Werftarbeiter', '35-40', 'Männlich'],
  ['Kirsten Janssen', 'Nachbarin von Jana', '65-70', 'Weiblich'],
  ['Nikolai Ivanov', 'Irinas Bruder', '40-45', 'Männlich'],
  ['Polizist 1 (Streife)', 'Streifenbeamter', '25-35', 'Männlich'],
  ['Polizistin 2 (Streife)', 'Streifenbeamtin', '25-35', 'Weiblich'],
  ['Barkeeper', 'Tresenkraft im "Anker"', '30-40', 'Männlich'],
  ['Fährmann', 'Kapitän der Elbfähre', '55-65', 'Männlich'],
  ['Wattführerin', 'Führt Jana durchs Watt', '45-55', 'Weiblich'],
  ['Notärztin', 'Rettungsdienst', '35-45', 'Weiblich'],
  ['Hotelportier', 'Nachtportier "Hafenblick"', '50-60', 'Männlich'],
  ['Pastor', 'Trauerfeier Ohlsdorf', '60-70', 'Männlich'],
]

const AGENTUREN = ['Agentur Hansen & Partner', 'Schauspielagentur Nordwind', 'Fitz+Skoglund Agents', 'Players Berlin (fiktiv)', 'Agentur Elbufer', 'Studio Talents Hamburg']

// Stab nach Departments — [Abteilung, Position, Gage/Tag in Cent, Anzahl]
const STAB: Array<[string, string, number, number]> = [
  ['Regie', 'Regisseurin', 0, 1], ['Regie', '1. Regieassistenz', 65000, 1], ['Regie', '2. Regieassistenz', 42000, 1],
  ['Regie', 'Script / Continuity', 38000, 1], ['Regie', 'Regiepraktikum', 12000, 1],
  ['Produktion', 'Produzent', 0, 1], ['Produktion', 'Herstellungsleitung', 0, 1], ['Produktion', 'Produktionsleitung', 60000, 1],
  ['Produktion', 'Produktionskoordination', 38000, 1], ['Produktion', 'Filmgeschäftsführung', 42000, 1], ['Produktion', 'Produktionssekretariat', 24000, 1],
  ['Aufnahmeleitung', '1. Aufnahmeleitung', 48000, 1], ['Aufnahmeleitung', 'Set-Aufnahmeleitung', 36000, 2], ['Aufnahmeleitung', 'Motivaufnahmeleitung', 36000, 1],
  ['Aufnahmeleitung', 'Set-Runner', 18000, 4], ['Aufnahmeleitung', 'Location Scout', 32000, 1],
  ['Kamera', 'Director of Photography', 110000, 1], ['Kamera', 'A-Kamera Operator', 60000, 1], ['Kamera', 'B-Kamera Operator', 55000, 1],
  ['Kamera', '1. Kameraassistenz (Focus Puller)', 42000, 2], ['Kamera', '2. Kameraassistenz (Clapper Loader)', 30000, 2],
  ['Kamera', 'DIT', 40000, 1], ['Kamera', 'Steadicam Operator', 70000, 1], ['Kamera', 'Video Operator', 28000, 1], ['Kamera', 'Standfotografie', 35000, 1],
  ['Licht', 'Oberbeleuchter (Gaffer)', 48000, 1], ['Licht', 'Best Boy Electric', 36000, 1], ['Licht', 'Beleuchter', 30000, 6], ['Licht', 'Generatorfahrer', 28000, 1],
  ['Sonstiges', 'Key Grip', 42000, 1], ['Sonstiges', 'Kamerabühne (Grip)', 30000, 4], ['Sonstiges', 'Dolly Grip', 34000, 1],
  ['Ton', 'Tonmeisterin', 50000, 1], ['Ton', 'Tonangel', 32000, 1], ['Ton', 'Tonassistenz', 24000, 1],
  ['Ausstattung', 'Szenenbildnerin', 60000, 1], ['Ausstattung', 'Art Director', 45000, 1], ['Ausstattung', 'Set Dresser', 30000, 3],
  ['Ausstattung', 'Baubühne', 30000, 4], ['Ausstattung', 'Malerin', 28000, 2],
  ['Requisite', 'Außenrequisite', 32000, 1], ['Requisite', 'Innenrequisite', 32000, 2], ['Requisite', 'Requisitenassistenz', 22000, 1],
  ['Kostüm', 'Kostümbildnerin', 52000, 1], ['Kostüm', 'Kostümassistenz', 30000, 1], ['Kostüm', 'Garderobe', 26000, 3], ['Kostüm', 'Schneiderin', 26000, 1],
  ['Maske', 'Chefmaskenbildnerin', 48000, 1], ['Maske', 'Maskenbild', 34000, 3], ['Maske', 'Maske SFX (Wunden)', 45000, 1],
  ['VFX', 'VFX Supervisor', 65000, 1], ['VFX', 'VFX Data Wrangler', 28000, 1],
  ['Sonstiges', 'Stunt-Koordination', 70000, 1], ['Sonstiges', 'Stuntdouble', 55000, 2], ['Sonstiges', 'SFX (Regen, Nebel)', 45000, 2],
  ['Sonstiges', 'Set-Sanitäter', 24000, 1], ['Sonstiges', 'Set-Security', 22000, 3], ['Sonstiges', 'Making-of', 25000, 1],
  ['Sonstiges', 'Catering Chef', 30000, 1], ['Sonstiges', 'Catering', 20000, 3], ['Sonstiges', 'Casting', 0, 1],
  ['Schnitt', 'Editor', 55000, 1], ['Schnitt', 'Schnittassistenz', 28000, 1],
  ['Musik', 'Komponist', 0, 1],
  ['Fahrer', 'Fahrer (Darsteller)', 20000, 3], ['Fahrer', 'Fahrer (LKW Technik)', 24000, 3], ['Fahrer', 'Fahrer (Shuttle)', 20000, 2],
]

const BEATS = [
  'findet die Leiche', 'verhört', 'bricht ein', 'beobachtet', 'streitet mit', 'erfährt die Wahrheit über', 'folgt', 'verliert die Spur von',
  'trifft heimlich', 'konfrontiert', 'versteckt Beweise vor', 'rettet', 'wird bedroht von', 'lügt', 'gesteht', 'sucht nach',
  'erhält einen Anruf von', 'verabschiedet sich von', 'erinnert sich an', 'jagt',
]

// ─── Kalkulation (FFA-Schema, gekürzt) ─────────────────────────────────────
const KALKULATION: Array<[string, string, string, string, number, number]> = [
  // [Kategorie, Konto, Bezeichnung, Einheit, Menge, Einzelpreis in Cent]
  ['1000 - Vorkosten/Rechte', '1110', 'Drehbuchhonorar', 'Pauschal', 1, 9500000],
  ['1000 - Vorkosten/Rechte', '1120', 'Stoffrechte Romanvorlage', 'Pauschal', 1, 6000000],
  ['1000 - Vorkosten/Rechte', '1210', 'Stoffentwicklung, Recherche', 'Pauschal', 1, 1200000],
  ['1000 - Vorkosten/Rechte', '1310', 'Casting Vorbereitung', 'Wochen', 6, 280000],
  ['1000 - Vorkosten/Rechte', '1410', 'Motivsuche, Besichtigungen', 'Tage', 25, 45000],
  ['1000 - Vorkosten/Rechte', '1510', 'Leseprobe, Proben', 'Tage', 5, 180000],
]
function stabKalkulation(): Array<[string, string, string, string, number, number]> {
  const out: Array<[string, string, string, string, number, number]> = []
  let konto = 2100
  for (const [abt, pos, gage, anzahl] of STAB) {
    if (!gage) continue
    out.push(['2000 - Stab', String(konto), `${pos}${anzahl > 1 ? ` (${anzahl}×)` : ''} — ${abt}`, 'Tage', 45 * anzahl + 8, gage])
    konto += 5
  }
  out.push(['2000 - Stab', '2900', 'Regie (Pauschalgage)', 'Pauschal', 1, 18000000])
  out.push(['2000 - Stab', '2910', 'Produzent, Herstellungsleitung (Pauschal)', 'Pauschal', 1, 14000000])
  out.push(['2000 - Stab', '2920', 'Sozialabgaben Stab (21 %)', 'Pauschal', 1, 42000000])
  return out
}
const RESTKALKULATION: Array<[string, string, string, string, number, number]> = [
  ['4000 - Ausstattung/Technik', '4110', 'Kameramiete ARRI Alexa 35 (2 Bodies)', 'Tage', 45, 180000],
  ['4000 - Ausstattung/Technik', '4120', 'Optiken Cooke S4/i, Zooms', 'Tage', 45, 95000],
  ['4000 - Ausstattung/Technik', '4130', 'Lichtpaket inkl. LKW 12 t', 'Tage', 45, 210000],
  ['4000 - Ausstattung/Technik', '4140', 'Bühnenpaket, Dolly, Kran (Tageweise)', 'Tage', 45, 90000],
  ['4000 - Ausstattung/Technik', '4150', 'Tonpaket', 'Tage', 45, 38000],
  ['4000 - Ausstattung/Technik', '4160', 'Generator 100 kVA', 'Tage', 30, 42000],
  ['4000 - Ausstattung/Technik', '4210', 'Studiomiete Studio Hamburg Hallen 2+4', 'Tage', 14, 380000],
  ['4000 - Ausstattung/Technik', '4220', 'Kulissenbau Intensivstation, Verhörraum', 'Pauschal', 1, 11500000],
  ['4000 - Ausstattung/Technik', '4310', 'Ausstattung, Requisiten, Fahrzeuge im Bild', 'Pauschal', 1, 8200000],
  ['4000 - Ausstattung/Technik', '4410', 'Kostüme Kauf/Leihe', 'Pauschal', 1, 5600000],
  ['4000 - Ausstattung/Technik', '4510', 'Maske, Perücken, SFX-Wunden', 'Pauschal', 1, 2400000],
  ['4000 - Ausstattung/Technik', '4610', 'Motivmieten', 'Pauschal', 1, 6100000],
  ['4000 - Ausstattung/Technik', '4620', 'Genehmigungen, Absperrungen, Polizei', 'Pauschal', 1, 2800000],
  ['4000 - Ausstattung/Technik', '4710', 'Stunts, SFX Regen/Nebel', 'Pauschal', 1, 4800000],
  ['5000 - Reisen/Transport', '5110', 'Hotel Westerhever-Block (8 Nächte, 60 Pers.)', 'Nächte', 480, 9500],
  ['5000 - Reisen/Transport', '5210', 'Fahrzeugflotte (22 Fahrzeuge)', 'Tage', 50, 190000],
  ['5000 - Reisen/Transport', '5310', 'Kraftstoff', 'Pauschal', 1, 2400000],
  ['5000 - Reisen/Transport', '5410', 'Catering (Ø 140 Pers.)', 'Tage', 45, 310000],
  ['5000 - Reisen/Transport', '5510', 'Spesen, Tagegelder', 'Pauschal', 1, 1800000],
  ['6000 - Postproduktion', '6110', 'Schnitt (Editor 20 Wochen)', 'Wochen', 20, 320000],
  ['6000 - Postproduktion', '6210', 'Grading DI', 'Tage', 12, 240000],
  ['6000 - Postproduktion', '6310', 'VFX (ca. 60 Shots)', 'Pauschal', 1, 18500000],
  ['6000 - Postproduktion', '6410', 'Tonbearbeitung, Foley, Mischung Atmos', 'Pauschal', 1, 9500000],
  ['6000 - Postproduktion', '6510', 'Filmmusik (Komposition, Orchester)', 'Pauschal', 1, 12000000],
  ['6000 - Postproduktion', '6610', 'Musiklizenzen', 'Pauschal', 1, 2500000],
  ['6000 - Postproduktion', '6710', 'DCP, Masterings, Untertitel, Barrierefreiheit', 'Pauschal', 1, 2200000],
  ['7000 - Versicherungen/Allgemein', '7110', 'Filmversicherung (Negativ-, Ausfall-)', 'Pauschal', 1, 6800000],
  ['7000 - Versicherungen/Allgemein', '7210', 'Rechtsberatung, Verträge', 'Pauschal', 1, 2400000],
  ['7000 - Versicherungen/Allgemein', '7310', 'Prüfung, Abrechnung Förderer', 'Pauschal', 1, 1500000],
  ['8000 - Handlungskosten', '8110', 'Handlungskosten (7,5 %)', 'Pauschal', 1, 42000000],
  ['9000 - Überschreitungsreserve', '9110', 'Überschreitungsreserve (6 %)', 'Pauschal', 1, 34000000],
]

// ─── Seed ───────────────────────────────────────────────────────────────────
export interface GrossproduktionErgebnis {
  projectId: number
  zahlen: Record<string, number>
  team: Array<{ email: string; rolle: string; passwort: string }>
}

/**
 * Legt die Großproduktion für `ownerId` an. Ein vorhandenes Projekt gleichen
 * Namens beim selben Besitzer wird vorher entfernt (ON DELETE CASCADE räumt
 * alle abhängigen Tabellen mit ab).
 */
export async function seedGrossproduktion(
  ownerId: number,
  // ohneTeam: fuer Lasttest-Daten - sonst saehen die Teamkonten jedes der
  // hundert Lasttest-Projekte in ihrer Liste.
  opts: { teamPasswort?: string; ohneTeam?: boolean } = {},
): Promise<GrossproduktionErgebnis> {
  const rnd = mulberry32(20261003)
  const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]
  const between = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
  const tag = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return heuteISO(d) }
  const person = () => `${pick(VORNAMEN)} ${pick(NACHNAMEN)}`
  const mail = (name: string, domain: string) =>
    name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/ı/g, 'i').replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '') + '@' + domain
  const tel = () => `01${between(51, 79)} ${between(1000000, 9999999)}`

  const vorhanden = await db.all('SELECT id FROM projects WHERE owner_id = ? AND title = ?', [ownerId, GROSSPRODUKTION_TITEL])
  for (const p of vorhanden) await db.run('DELETE FROM projects WHERE id = ?', [p.id])

  const team: GrossproduktionErgebnis['team'] = []
  // Teamkonten mit festen Rollen, damit sich Rechte realistisch testen lassen.
  // Passwort: vorgegeben oder zufällig — nie ein bekannter Standard.
  const { randomBytes } = await import('crypto')
  const teamRollen: Array<[string, string, string]> = [
    ['nordlicht.produktion@cutsheet.test', 'Produktion Nordlicht', 'producer'],
    ['nordlicht.regie@cutsheet.test', 'Regie Nordlicht', 'director'],
    ['nordlicht.kamera@cutsheet.test', 'Kamera Nordlicht', 'dept_head'],
    ['nordlicht.aufnahmeleitung@cutsheet.test', 'Aufnahmeleitung Nordlicht', 'dept_head'],
    ['nordlicht.sender@cutsheet.test', 'Redaktion Sender (nur lesen)', 'read_only'],
  ]
  const teamIds: Array<[number, string]> = []
  for (const [email, name, rolle] of opts.ohneTeam ? [] : teamRollen) {
    // Bei jedem Lauf ein bekanntes Passwort setzen - vorgegeben oder neu
    // gewuerfelt - und einmalig zurueckgeben. Sonst bliebe nach einem
    // frueheren Lauf ein Passwort stehen, das niemand mehr kennt.
    const passwort = opts.teamPasswort || randomBytes(9).toString('base64url')
    const hash = await hashPasswort(passwort, 10)
    const bestehend = await db.get('SELECT id FROM users WHERE email = ?', [email]) as any
    if (bestehend) {
      await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, bestehend.id])
      teamIds.push([bestehend.id, rolle]); team.push({ email, rolle, passwort }); continue
    }
    const r = await db.run('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)', [email, hash, name, 'user'])
    teamIds.push([r.id, rolle]); team.push({ email, rolle, passwort })
  }

  const zahlen: Record<string, number> = {}
  const projectId = await db.transaction(async tx => {
    const drehtage = 45
    const startOffset = -24 // erster Drehtag vor gut drei Wochen
    // Drehtage Mo–Sa, Sonntag frei
    const daten: string[] = []
    for (let o = startOffset; daten.length < drehtage; o++) {
      const d = new Date(); d.setDate(d.getDate() + o)
      if (d.getDay() !== 0) daten.push(tag(o))
    }
    const heute = tag(0)

    const p = await tx.run(`INSERT INTO projects (title, genre, format, length_minutes, status, synopsis, director, producer, dop, production_company, shoot_start, shoot_end, owner_id, is_demo, project_kind)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      GROSSPRODUKTION_TITEL, 'Thriller / Drama', 'Kinofilm', 118, 'Produktion',
      'Als ein Kranführer im Hamburger Hafen spurlos verschwindet, stößt Kommissarin Jana Petersen auf ein Netz aus Schmuggel, Schweigen und einer Reederfamilie, die seit Generationen über der Elbe thront. Die Spur führt bis zum Leuchtturm von Westerhever — und in Janas eigene Vergangenheit.',
      'Svenja Lorenzen', 'Torben Feddersen', 'Nikolai Rasmussen', 'Elbwerk Film GmbH (fiktiv)', daten[0], daten[daten.length - 1], ownerId, false, 'film'])
    const pid = p.id

    await tx.run('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', [pid, ownerId, 'admin'])
    for (const [uid, rolle] of teamIds) {
      await tx.run('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', [pid, uid, rolle])
    }
    await tx.run('INSERT INTO project_settings (project_id, default_call_time, default_wrap_time, turnaround_hours, currency, country, header_color) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [pid, 390, 1170, 11, 'EUR', 'Deutschland', '#0071E3'])

    // Motive
    const locIds = await insertMany(tx, 'locations', ['project_id', 'name', 'address', 'city', 'zip', 'country', 'contact_name', 'contact_phone', 'contact_email', 'rental_fee', 'parking_info', 'power_available', 'notes'],
      MOTIVE.map(m => { const k = person(); return [pid, m.name, m.addr, m.city, m.zip, 'Deutschland', k, tel(), mail(k, 'motiv-kontakt.de'), m.miete, m.parken, m.strom, m.note] }))
    zahlen.motive = locIds.length

    // Rollen und Besetzung
    const charIds = await insertMany(tx, 'characters', ['project_id', 'name', 'description', 'age_range', 'gender', 'sort_order'],
      ROLLEN.map((r, i) => [pid, r[0], r[1], r[2], r[3], i]))
    const darsteller = ROLLEN.map((r, i) => {
      const n = i < 4 ? ['Katharina Brodersen', 'Hans-Jürgen Iversen', 'Mats Ewers', 'Aylin Demir'][i] : person()
      const gage = i < 2 ? 650000 : i < 6 ? 280000 : i < 12 ? 140000 : i < 24 ? 80000 : 45000
      return [pid, charIds[i], n, mail(n, 'schauspiel-mail.de'), tel(), i < 12 ? person() : '', i < 12 ? mail('agent', 'agentur.test') : '', i < 12 ? pick(AGENTUREN) : '',
        gage, i < 6 ? 'Pauschal + Tage' : 'Tagesgage', i % 5 === 0 ? 'Theaterverpflichtung donnerstags' : '', '', i < 2 ? 'Hauptrolle, Billing 1–2' : '']
    })
    const castIds = await insertMany(tx, 'cast', ['project_id', 'character_id', 'actor_name', 'email', 'phone', 'agent', 'agent_email', 'agency', 'fee_per_day', 'contract_type', 'availability_notes', 'photo_url', 'notes'], darsteller)
    zahlen.darsteller = castIds.length

    // Stab
    const stabZeilen: any[][] = []
    const stabNamen: string[] = []
    let sort = 0
    for (const [abt, pos, gage, anzahl] of STAB) {
      for (let k = 0; k < anzahl; k++) {
        const n = pos === 'Regisseurin' ? 'Svenja Lorenzen' : pos === 'Produzent' ? 'Torben Feddersen' : pos === 'Director of Photography' ? 'Nikolai Rasmussen' : person()
        stabNamen.push(n)
        stabZeilen.push([pid, n, abt, pos, mail(n, 'elbwerk-film.test'), tel(), gage, gage ? 'Tagesgage' : 'Pauschal', '', '', sort++])
      }
    }
    const crewIds = await insertMany(tx, 'crew', ['project_id', 'name', 'department', 'role', 'email', 'phone', 'fee_per_day', 'contract_type', 'availability_notes', 'notes', 'sort_order'], stabZeilen)
    zahlen.stab = crewIds.length

    // Komparserie
    const komparsen = Array.from({ length: 240 }, () => { const n = person(); return [pid, n, tel(), mail(n, 'komparsen.test'), pick(['Standard', 'Standard', 'Standard', 'Kleindarsteller', 'Spezial (eigenes Kfz)', 'Spezial (Uniform)']), pick(['Hafenarbeiter', 'Marktbesucher', 'Kneipengast', 'Polizeibeamter', 'Passant', 'Trauergast', 'Fährgast', 'Werftarbeiter'])] })
    zahlen.komparsen = (await insertMany(tx, 'extras', ['project_id', 'name', 'phone', 'email', 'tariff_group', 'notes'], komparsen)).length

    // Szenen: 160, nach Motiv gebündelt, mit A-Szenen dazwischen
    const szenenZeilen: any[][] = []
    const szenenMeta: Array<{ loc: number; ie: string; dn: string; chars: number[]; eighths: number; nummer: string }> = []
    let nr = 1
    for (let i = 0; i < 160; i++) {
      const li = i < 4 ? 1 : Math.floor(rnd() * MOTIVE.length)
      const m = MOTIVE[li]
      const dn = pick(['TAG', 'TAG', 'TAG', 'NACHT', 'NACHT', 'DÄMMERUNG', 'MORGEN'])
      const eighths = between(2, 22)
      const nummer = (i % 17 === 5) ? `${nr - 1}A` : String(nr++)
      const hauptfigur = rnd() < 0.72 ? 0 : between(1, 5)
      const weitere = Array.from({ length: between(0, 3) }, () => between(1, ROLLEN.length - 1))
      const chars = [...new Set([hauptfigur, ...weitere])]
      const titel = `${ROLLEN[chars[0]][0].split(' ')[0]} ${pick(BEATS)} ${chars[1] !== undefined ? ROLLEN[chars[1]][0].split(' ')[0] : 'jemandem'}`
      szenenMeta.push({ loc: li, ie: m.typ, dn, chars, eighths, nummer })
      szenenZeilen.push([pid, nummer, i, titel, `${m.name}: ${titel}. ${dn === 'NACHT' ? 'Nur Arbeitslicht, Regen möglich.' : 'Naturlicht, Wolkenlücken abwarten.'}`, locIds[li], m.typ, dn, eighths, Math.round(eighths * 7.5), '', 'offen'])
    }
    const sceneIds = await insertMany(tx, 'scenes', ['project_id', 'scene_number', 'sort_order', 'title', 'description', 'location_id', 'int_ext', 'day_night', 'eighths', 'estimated_minutes', 'notes', 'shot_status'], szenenZeilen)
    zahlen.szenen = sceneIds.length

    await insertMany(tx, 'scene_characters', ['scene_id', 'character_id', 'role_in_scene'],
      szenenMeta.flatMap((s, i) => s.chars.map((c, k) => [sceneIds[i], charIds[c], k === 0 ? 'Haupt' : 'Neben'])))
    zahlen.szenenInventar = (await insertMany(tx, 'scene_inventory', ['scene_id', 'item', 'category', 'quantity', 'notes'],
      szenenMeta.flatMap((_, i) => Array.from({ length: between(0, 3) }, () => [sceneIds[i],
        pick(['Dienstwaffe (Attrappe)', 'Handy mit gesprungenem Display', 'Aktenordner Reederei', 'Thermoskanne', 'Seekarte 1974', 'Taschenlampe', 'Blutkonserve (SFX)', 'Fernglas', 'Frachtpapiere', 'Polizeimarke', 'Zigaretten', 'Kranführerhelm']),
        pick(['Requisite', 'Requisite', 'Kostüm', 'SFX', 'Fahrzeug']), between(1, 4), ''])))).length

    // Drehtage: Szenen nach Motiv sortiert, ~3,4 Szenen pro Tag, 6 bleiben ungeplant
    const reihenfolge = sceneIds.map((id, i) => ({ id, i })).sort((a, b) => szenenMeta[a.i].loc - szenenMeta[b.i].loc || a.i - b.i)
    const geplant = reihenfolge.slice(0, reihenfolge.length - 6)
    const tagZeilen = daten.map((d, i) => {
      const vergangen = d < heute
      return [pid, i + 1, d, vergangen ? 'Abgedreht' : d === heute ? 'Bestätigt' : (i === 40 ? 'Ausgefallen' : 'Geplant'),
        i >= 38 ? '2nd Unit' : 'Hauptteam', `Drehtag ${i + 1}`, between(95, 165), i % 9 === 3 ? 'Nachtdreh, Ruhezeit 11 h einhalten' : '']
    })
    const dayIds = await insertMany(tx, 'shoot_days', ['project_id', 'day_number', 'date', 'status', 'unit', 'notes', 'catering_count', 'risk_notes'], tagZeilen)
    zahlen.drehtage = dayIds.length
    const szenenJeTag: number[][] = dayIds.map(() => [])
    geplant.forEach((s, k) => { szenenJeTag[Math.min(dayIds.length - 1, Math.floor(k * dayIds.length / geplant.length))].push(s.i) })
    await insertMany(tx, 'shoot_day_scenes', ['shoot_day_id', 'scene_id', 'sort_order'],
      szenenJeTag.flatMap((idx, d) => idx.map((si, k) => [dayIds[d], sceneIds[si], k])))
    const abgedrehtTage = daten.map((d, i) => d < heute ? i : -1).filter(i => i >= 0)
    const abgedrehteSzenen = abgedrehtTage.flatMap(d => szenenJeTag[d])
    if (abgedrehteSzenen.length) {
      await tx.run(`UPDATE scenes SET shot_status = 'abgedreht' WHERE id = ANY($1::int[])`.replace('$1', '?'), [abgedrehteSzenen.map(i => sceneIds[i])])
    }
    zahlen.abgedrehteTage = abgedrehtTage.length

    // Shotlist: 3–6 Einstellungen je Szene
    const shotZeilen: any[][] = []
    const shotsJeSzene: number[][] = sceneIds.map(() => [])
    const groessen = ['EWS', 'WS', 'MWS', 'MS', 'MCU', 'CU', 'ECU', 'Totale']
    const bewegungen = ['Statisch', 'Statisch', 'Pan', 'Dolly', 'Gimbal', 'Handheld', 'Kran', 'Drohne', 'Fahrt']
    sceneIds.forEach((sid, i) => {
      const n = between(3, 6)
      for (let k = 0; k < n; k++) {
        shotsJeSzene[i].push(shotZeilen.length)
        const done = abgedrehteSzenen.includes(i) ? 1 : 0
        shotZeilen.push([pid, sid, null, `E${k + 1}`, k, pick(groessen), pick(bewegungen), String(pick([18, 25, 32, 40, 50, 75, 100, 135])),
          `${pick(['Establishing', 'Reaktion', 'Insert', 'Over-shoulder', 'Gegenschuss', 'Detail Hände', 'Weg durchs Motiv'])} — ${ROLLEN[szenenMeta[i].chars[0]][0].split(' ')[0]}`,
          k === 0 && rnd() < 0.2 ? 'Regenmaschine' : '', '', between(4, 45), done, done ? `T${between(2, 7)}` : ''])
      }
    })
    const shotIds = await insertMany(tx, 'shots', ['project_id', 'scene_id', 'shoot_day_id', 'shot_number', 'sort_order', 'size', 'movement', 'lens_mm', 'description', 'notes', 'storyboard_url', 'duration_seconds', 'done', 'best_take'], shotZeilen)
    zahlen.einstellungen = shotIds.length

    // Drehbuch
    const bloecke: any[][] = []
    szenenMeta.forEach((s, i) => {
      const m = MOTIVE[s.loc]
      let so = 0
      bloecke.push([sceneIds[i], pid, so++, 'scene_heading', `${s.ie === 'INT' ? 'INNEN' : 'AUSSEN'}. ${m.name.toUpperCase()} - ${s.dn}`])
      bloecke.push([sceneIds[i], pid, so++, 'action', `${ROLLEN[s.chars[0]][0].split(' ')[0].toUpperCase()} ${pick(BEATS)} ${s.chars[1] !== undefined ? ROLLEN[s.chars[1]][0] : 'niemanden'}. ${pick(['Wind zerrt an den Planen.', 'Irgendwo schlägt eine Stahltür.', 'Das Licht flackert.', 'Möwen kreischen.', 'Regen trommelt aufs Dach.'])}`])
      for (let k = 0; k < between(1, 3); k++) {
        const wer = s.chars[k % s.chars.length]
        bloecke.push([sceneIds[i], pid, so++, 'character', ROLLEN[wer][0].split(' ')[0].toUpperCase()])
        bloecke.push([sceneIds[i], pid, so++, 'dialogue', pick(['Du warst in der Nacht am Terminal. Lüg mich nicht an.', 'Das hier ist größer als wir beide.', 'Ich will nur wissen, wo er ist.', 'Mein Vater hat nie jemanden verschwinden lassen.', 'Die Flut kommt in einer Stunde.', 'Sag ihr nichts. Noch nicht.', 'Wer hat die Frachtpapiere unterschrieben?'])])
      }
    })
    zahlen.drehbuchBloecke = (await insertMany(tx, 'screenplay_blocks', ['scene_id', 'project_id', 'sort_order', 'block_type', 'content'], bloecke)).length

    // Dispos für alle Drehtage: Cast der Szenen + gesamter Stab mit Department-Staffelung
    const dispoZeilen: any[][] = []
    const generalCall: number[] = []
    // Nachtdrehs in Blöcken, wie ein Produktionsbüro sie legt: drei Nächte bis
    // Samstag, danach der freie Sonntag — so hält die Ruhezeit.
    const samstage = daten.map((d, i) => (new Date(d + 'T12:00:00').getDay() === 6 ? i : -1)).filter(i => i >= 2)
    const nachtBloecke = [samstage[1], samstage[4]].filter(i => i !== undefined).flatMap(i => [i - 2, i - 1, i])
    const callSheetIds = await insertMany(tx, 'call_sheets', ['shoot_day_id', 'general_call', 'shooting_call', 'location_id', 'weather_forecast', 'sunrise', 'sunset', 'notes', 'safety_personnel', 'hospital_name', 'hospital_address', 'crew_parking', 'basecamp', 'breakfast_call', 'lunch_call', 'weather_high', 'weather_low', 'walkie_channels', 'dept_notes'],
      dayIds.map((_, d) => {
        const erste = szenenJeTag[d][0]
        const nacht = nachtBloecke.includes(d)
        const gc = nacht ? 1080 : pick([420, 450])
        generalCall.push(gc)
        return [gc, gc + 75, erste !== undefined ? locIds[szenenMeta[erste].loc] : null, pick(['Bewölkt, Schauer', 'Sonnig, windig', 'Nieselregen', 'Nebel am Morgen', 'Wechselhaft']),
          '06:58', '19:04', nacht ? 'Nachtdreh: Shuttle ab Basecamp 17:30. Ruhezeiten beachten.' : 'Bitte Sicherheitseinweisung am Set beachten.', 1,
          'Asklepios Klinik St. Georg', 'Lohmühlenstraße 5, 20099 Hamburg', 'Lagerhalle Veddel, Tor 2', 'Lagerhalle Veddel', gc - 30, gc + 330,
          `${between(12, 18)}°C`, `${between(6, 11)}°C`, 'K1 Regie · K2 AL · K3 Kamera · K4 Licht/Bühne · K5 Transport',
          'PROPS: Dienstwaffen-Attrappen im Waffenkoffer, Ausgabe nur durch Waffenmeister\nKAMERA: B-Kamera ab Mittag auf Steadicam\nSFX: Regenmaschine vorheizen\nFAHRDIENST: Shuttle alle 20 Min.']
      }).map((r, d) => [dayIds[d], ...r]))
    const deptOffset: Record<string, number> = { Licht: -60, Sonstiges: -45, Ausstattung: -90, Requisite: -60, Kamera: -45, Maske: -30, Kostüm: -30, Ton: -30, Fahrer: -75 }
    dayIds.forEach((_, d) => {
      const castHeute = [...new Set(szenenJeTag[d].flatMap(si => szenenMeta[si].chars))]
      let so = 0
      // Call-Zeiten relativ zum General Call des Tages — Nachtdrehs beginnen
      // abends, Departments mit Vorlauf früher
      const gc = generalCall[d]
      for (const c of castHeute) dispoZeilen.push([callSheetIds[d], 'cast', castIds[c], (gc + between(-15, 90)) % 1440, pick(['Hotel Hafenblick', 'Basecamp', 'Eigenanreise']), c < 4 ? 'Maske 45 Min. vorher' : '', so++, 'W'])
      stabZeilen.forEach((row, k) => {
        dispoZeilen.push([callSheetIds[d], 'crew', crewIds[k], (gc + (deptOffset[row[2] as string] ?? 0) + 1440) % 1440, '', '', so++, ''])
      })
    })
    zahlen.dispoEintraege = (await insertMany(tx, 'call_sheet_entries', ['call_sheet_id', 'person_type', 'person_id', 'call_time', 'pickup_location', 'notes', 'sort_order', 'cast_status'], dispoZeilen)).length
    // Abgedrehte Tage: alle eingecheckt und bestätigt
    const abgedrehteSheets = abgedrehtTage.map(d => callSheetIds[d])
    if (abgedrehteSheets.length) {
      await tx.run('UPDATE call_sheet_entries SET checked_in = TRUE, checked_in_at = NOW(), confirmed_at = NOW() WHERE call_sheet_id = ANY(?::int[])', [abgedrehteSheets])
    }

    // Tagesberichte, Kameraberichte, Timesheets für abgedrehte Tage
    const berichtIds = await insertMany(tx, 'daily_reports', ['shoot_day_id', 'date', 'call_time', 'first_shot', 'lunch_in', 'lunch_out', 'wrap', 'scenes_completed', 'scenes_partial', 'pages_shot', 'total_setups', 'camera_rolls', 'sound_rolls', 'notes', 'production_notes'],
      abgedrehtTage.map(d => {
        const s = szenenJeTag[d]
        const gc = generalCall[d]
        // 11 h Drehtag inkl. Pause, gelegentlich Overtime — Wrap nach
        // Mitternacht steht wie im Tagesbericht als Uhrzeit (z. B. 120 = 02:00)
        return [dayIds[d], daten[d], gc, gc + between(60, 110), (gc + 330) % 1440, (gc + 390) % 1440, (gc + 600 + between(-30, rnd() < 0.15 ? 120 : 40)) % 1440,
          // Wie die App: JSON-Liste der Szenen-IDs; gelegentlich bleibt die
          // letzte Szene des Tages angedreht statt fertig
          ...(() => { const ids = s.map(i => sceneIds[i]); const teil = ids.length > 1 && rnd() < 0.2 ? ids.splice(-1) : []; return [JSON.stringify(ids), JSON.stringify(teil)] })(),
          s.reduce((a, i) => a + szenenMeta[i].eighths, 0), s.reduce((a, i) => a + shotsJeSzene[i].length, 0) + between(0, 6),
          `A${d + 1}01–A${d + 1}0${between(3, 6)}`, `S${d + 1}01–S${d + 1}0${between(2, 4)}`,
          pick(['Wetterumschwung ab 15 Uhr, zwei Einstellungen ins Studio verlegt.', 'Reibungsloser Tag, Overtime 25 Min. wegen Kranumbau.', 'Polizeiabsperrung verspätet, Drehbeginn +40 Min.', '']),
          pick(['Catering gelobt.', 'Generator ausgefallen 11:20–11:45.', 'Stunt ohne Zwischenfall.', ''])]
      }))
    zahlen.tagesberichte = berichtIds.length
    await insertMany(tx, 'daily_report_cast', ['daily_report_id', 'cast_id', 'call_time', 'makeup_in', 'on_set', 'wrap'],
      abgedrehtTage.flatMap((d, k) => [...new Set(szenenJeTag[d].flatMap(si => szenenMeta[si].chars))].map(c => [berichtIds[k], castIds[c], generalCall[d], (generalCall[d] + 30) % 1440, (generalCall[d] + 90) % 1440, (generalCall[d] + 600) % 1440])))

    const reportIds = await insertMany(tx, 'camera_reports', ['shoot_day_id', 'camera', 'magazine', 'format'],
      abgedrehtTage.flatMap(d => [[dayIds[d], 'A', `A${String(d + 1).padStart(3, '0')}`, 'ARRIRAW 4.6K'], [dayIds[d], 'B', `B${String(d + 1).padStart(3, '0')}`, 'ProRes 4444 XQ']]))
    const takes: any[][] = []
    abgedrehtTage.forEach((d, k) => {
      let so = 0
      for (const si of szenenJeTag[d]) for (const shotIdx of shotsJeSzene[si]) {
        const n = between(2, 7), gut = between(1, n)
        for (let t = 1; t <= n; t++) takes.push([reportIds[k * 2 + (t % 3 === 0 ? 1 : 0)], shotIds[shotIdx], szenenMeta[si].nummer, t,
          `${String(8 + Math.floor(so / 40)).padStart(2, '0')}:${String(so % 60).padStart(2, '0')}:10:00`, '', Math.round(rnd() * 90) / 10, t === gut, rnd() < 0.05, false, t === gut && rnd() < 0.3, '', so++])
      }
    })
    zahlen.takes = (await insertMany(tx, 'camera_takes', ['camera_report_id', 'shot_id', 'scene_number', 'take_number', 'timecode_in', 'timecode_out', 'meters', 'circle', 'false_start', 'mute', 'directors_cut', 'notes', 'sort_order'], takes)).length

    zahlen.timesheets = (await insertMany(tx, 'timesheets', ['project_id', 'shoot_day_id', 'person_type', 'person_id', 'call_time', 'wrap_time', 'meal_penalty', 'overtime_hours', 'notes'],
      abgedrehtTage.flatMap(d => crewIds.map((cid, k) => {
        const call = (generalCall[d] + (deptOffset[stabZeilen[k][2] as string] ?? 0) + 1440) % 1440
        const dauer = 600 + (deptOffset[stabZeilen[k][2] as string] ? 30 : 0) + between(-15, rnd() < 0.15 ? 120 : 30)
        const wrap = (call + dauer) % 1440
        const ot = Math.max(0, dauer / 60 - 10)
        return [pid, dayIds[d], 'crew', cid, call, wrap, rnd() < 0.04, Math.round(ot * 4) / 4, '']
      })))).length

    // Kalkulation, Finanzierung, Belege
    await tx.run("INSERT INTO budget_versions (project_id, name, status, total_cents, created_at) VALUES (?, ?, ?, ?, NOW() - INTERVAL '120 days')", [pid, 'Kalkulation Förderantrag v1', 'Archiviert', 598000000])
    const bv = await tx.run('INSERT INTO budget_versions (project_id, name, status) VALUES (?, ?, ?)', [pid, 'Kalkulation Drehfassung v3', 'Aktiv'])
    const alleZeilen = [...KALKULATION, ...stabKalkulation(), ...RESTKALKULATION]
    let summe = 0
    const lineIds = await insertMany(tx, 'budget_lines', ['budget_version_id', 'category', 'account_code', 'description', 'unit', 'quantity', 'unit_price_cents', 'total_cents', 'notes', 'sort_order'],
      alleZeilen.map(([cat, konto, bez, einheit, menge, preis], i) => { const t = Math.round(menge * preis); summe += t; return [bv.id, cat, konto, bez, einheit, menge, preis, t, '', i] }))
    await tx.run('UPDATE budget_versions SET total_cents = ? WHERE id = ?', [summe, bv.id])
    zahlen.kalkulationsZeilen = lineIds.length
    zahlen.budgetEuro = Math.round(summe / 100)

    const fv = await tx.run('INSERT INTO financing_plan_versions (project_id, name) VALUES (?, ?)', [pid, 'Finanzierungsplan Stand Drehbeginn'])
    const fin: Array<[string, string, number, number]> = [
      // Bewusst knapp unter dem Budget: eine Finanzierungslücke, wie sie kurz
      // vor Drehbeginn üblich ist — der Konfliktradar soll sie melden.
      ['Filmförderungsanstalt (FFA)', 'Förderung', 70000000, 1], ['DFFF I', 'Förderung', 85000000, 1],
      ['MOIN Filmförderung Hamburg Schleswig-Holstein', 'Förderung', 100000000, 1], ['Nordmedia', 'Förderung', 30000000, 0],
      ['Senderbeteiligung (fiktiver Sender)', 'Sender', 120000000, 1], ['Verleih-MG (fiktiver Verleih)', 'Vertrieb', 45000000, 1],
      ['Weltvertrieb-MG', 'Vertrieb', 20000000, 0], ['Eigenmittel / Rückstellungen Elbwerk', 'Eigenmittel', 30000000, 1],
    ]
    let finSumme = 0
    await insertMany(tx, 'financing_entries', ['financing_version_id', 'source', 'type', 'amount_cents', 'confirmed', 'notes', 'sort_order'],
      fin.map(([q, t, b, c], i) => { finSumme += b; return [fv.id, q, t, b, c, c ? 'Vertrag liegt vor' : 'Zusage mündlich', i] }))
    await tx.run('UPDATE financing_plan_versions SET total_cents = ? WHERE id = ?', [finSumme, fv.id])

    zahlen.belege = (await insertMany(tx, 'expenses', ['project_id', 'budget_line_id', 'category', 'description', 'amount_cents', 'receipt_no', 'expense_date', 'paid'],
      Array.from({ length: 280 }, (_, i) => {
        const li = between(0, alleZeilen.length - 1)
        const z = alleZeilen[li]
        return [pid, lineIds[li], z[0], `${z[2]} — Rechnung ${pick(['Vorschuss', 'Teilrechnung', 'Schlussrechnung', 'Quittung'])}`, Math.round(z[5] * z[4] * (0.02 + rnd() * 0.12)),
          `R-2026-${String(1000 + i)}`, tag(-between(0, 90)), rnd() < 0.8]
      }))).length

    // Equipment
    const listen: Array<[string, string, Array<[string, number, string, number]>]> = [
      ['Kamera A+B', 'Kamera', [['ARRI Alexa 35 Body', 2, 'ARRI Rental Hamburg', 90000], ['Cooke S4/i Satz 18–135 mm', 1, 'ARRI Rental Hamburg', 65000], ['Angénieux Optimo 24–290', 1, 'ARRI Rental Hamburg', 38000], ['Teradek Bolt 6 Set', 2, 'Cine Support', 9000], ['Preston FIZ 3', 2, 'Cine Support', 7500], ['Codex Compact Drive 2 TB', 12, 'ARRI Rental Hamburg', 2500], ['Steadicam M-2', 1, 'Steady Crew Nord', 28000], ['Ronin 2 Gimbal', 1, 'Cine Support', 18000], ['Monitore SmallHD 24"', 3, 'Cine Support', 4500], ['DIT-Wagen komplett', 1, 'Data Boat', 22000]]],
      ['Licht', 'Licht', [['ARRI SkyPanel S360-C', 4, 'Licht & Strom Nord', 16000], ['ARRI M90 HMI', 2, 'Licht & Strom Nord', 22000], ['Astera Titan Tubes (8er Set)', 3, 'Licht & Strom Nord', 6500], ['Aputure 1200d Pro', 4, 'Licht & Strom Nord', 5500], ['Ballon-Licht 4 kW', 2, 'Airstar (fiktiv)', 18000], ['Stromverteilung 125 A komplett', 1, 'Licht & Strom Nord', 12000], ['Frames 12×12, 20×20', 6, 'Licht & Strom Nord', 2500], ['Dimmerpult grandMA3 compact', 1, 'Licht & Strom Nord', 9000]]],
      ['Bühne', 'Sonstiges', [['Dolly Panther Evolution', 1, 'Grip Factory', 24000], ['Schienen 30 m', 1, 'Grip Factory', 6000], ['Technocrane 22 ft', 1, 'Grip Factory', 95000], ['Autohalterung Kamera', 2, 'Grip Factory', 8000], ['Sandsäcke, Stative, C-Stands', 1, 'Grip Factory', 5500]]],
      ['Ton', 'Ton', [['Sound Devices 888', 1, 'Tonverleih Hansen', 9500], ['Sennheiser MKH 50 / 416', 2, 'Tonverleih Hansen', 2800], ['Funkstrecken Wisycom (8 Kanäle)', 1, 'Tonverleih Hansen', 12000], ['Timecode Tentacle Sync', 6, 'Tonverleih Hansen', 800]]],
    ]
    const itemZeilen: any[][] = []
    for (const [name, abt, items] of listen) {
      const l = await tx.run('INSERT INTO equipment_lists (project_id, name, department, notes) VALUES (?, ?, ?, ?)', [pid, name, abt, 'Miete für 45 Drehtage + 3 Prep-Tage'])
      items.forEach(([it, menge, lieferant, preis], i) => itemZeilen.push([l.id, it, menge, lieferant, preis, 48, preis * 48 * menge, i % 3 === 0 ? 1 : 0, '', i]))
    }
    const itemIds = await insertMany(tx, 'equipment_items', ['equipment_list_id', 'item', 'quantity', 'supplier', 'rental_per_day_cents', 'total_days', 'total_cents', 'checked', 'notes', 'sort_order'], itemZeilen)
    zahlen.equipment = itemIds.length
    await insertMany(tx, 'equipment_bookings', ['project_id', 'equipment_item_id', 'item_name', 'start_date', 'end_date', 'notes'],
      itemIds.map((iid, i) => [pid, iid, itemZeilen[i][1], daten[0], daten[daten.length - 1], i % 7 === 0 ? 'Doppelbuchung mit Werbeproduktion prüfen' : '']))

    // Personenbezogenes Drumherum
    await insertMany(tx, 'cast_blackout_dates', ['project_id', 'cast_id', 'start_date', 'end_date', 'reason'],
      castIds.slice(0, 20).flatMap((cid, i) => i % 2 ? [] : [[pid, cid, daten[between(5, 40)], daten[between(5, 40)], pick(['Theatervorstellung', 'Anderer Dreh', 'Familienfeier', 'Synchron-Termin'])]]).map(r => r[2] > r[3] ? [r[0], r[1], r[3], r[2], r[4]] : r))
    const diaet = ['keine', 'keine', 'keine', 'vegetarisch', 'vegetarisch', 'vegan', 'glutenfrei', 'laktosefrei', 'halal']
    await insertMany(tx, 'catering_preferences', ['project_id', 'person_type', 'person_id', 'dietary', 'allergies', 'notes'],
      [...castIds.map(id => ['cast', id]), ...crewIds.map(id => ['crew', id])].map(([t, id]) => [pid, t, id, pick(diaet), rnd() < 0.12 ? pick(['Nüsse', 'Sellerie', 'Schalentiere', 'Soja']) : '', '']))
    zahlen.continuity = (await insertMany(tx, 'continuity_notes', ['project_id', 'scene_id', 'cast_id', 'category', 'description', 'photos', 'shoot_day_id'],
      Array.from({ length: 120 }, () => {
        const d = abgedrehtTage.length ? pick(abgedrehtTage) : 0
        const si = szenenJeTag[d][0] ?? 0
        return [pid, sceneIds[si], castIds[szenenMeta[si].chars[0]], pick(['kostüm', 'maske', 'props', 'set', 'haare', 'sonstiges']),
          pick(['Jacke offen, Kragen hochgeschlagen', 'Schnittwunde linke Augenbraue, Tag 3 der Heilung', 'Kaffeebecher halbvoll, rechte Hand', 'Fenster links gekippt', 'Haare nass, Zopf gelöst', 'Dienstausweis in der Brusttasche']), '', dayIds[d]]
      }))).length

    zahlen.vfx = (await insertMany(tx, 'vfx_shots', ['project_id', 'scene_id', 'shot_number', 'description', 'vfx_type', 'status', 'artist', 'deadline', 'complexity', 'notes'],
      Array.from({ length: 60 }, (_, i) => [pid, sceneIds[between(0, sceneIds.length - 1)], `NL-${String(i + 1).padStart(3, '0')}`,
        pick(['Regen verstärken', 'Containerbrücke erweitern', 'Leuchtturm-Leuchtfeuer', 'Wasseroberfläche Nacht', 'Mündungsfeuer', 'Screen Replacement Handy', 'Set Extension Werft', 'Nebelbank Watt']),
        pick(['Compositing', 'Set Extension', 'CG', 'Matte Painting', 'Cleanup']), pick(['Offen', 'Offen', 'In Arbeit', 'Review', 'Finalisiert']),
        pick(['Pixelhafen (fiktiv)', 'Nordlicht VFX', 'Studio Elbwerk', '']), tag(between(60, 160)), pick(['Niedrig', 'Mittel', 'Hoch', 'Sehr hoch']), '']))).length

    await insertMany(tx, 'post_phases', ['project_id', 'phase', 'start_date', 'end_date', 'status', 'responsible', 'notes', 'sort_order'],
      [['Dailies & Sync', -24, 30, 'In Arbeit'], ['Rohschnitt', 10, 80, 'In Arbeit'], ['Feinschnitt', 80, 120, 'Ausstehend'], ['VFX', 40, 160, 'Ausstehend'],
        ['Grading', 125, 140, 'Ausstehend'], ['Sounddesign & Foley', 110, 150, 'Ausstehend'], ['Musikaufnahme Orchester', 130, 135, 'Ausstehend'],
        ['Mischung Dolby Atmos', 150, 162, 'Ausstehend'], ['Abnahme & DCP', 165, 172, 'Ausstehend']]
        .map(([ph, a, b, st], i) => [pid, ph, tag(a as number), tag(b as number), st, stabNamen[between(0, stabNamen.length - 1)], '', i]))
    zahlen.musik = (await insertMany(tx, 'music_cues', ['project_id', 'scene_id', 'title', 'composer', 'publisher', 'duration_seconds', 'cue_type', 'usage_type', 'lyrics_author', 'notes', 'sort_order'],
      Array.from({ length: 45 }, (_, i) => [pid, sceneIds[between(0, sceneIds.length - 1)], `1M${String(i + 1).padStart(2, '0')} ${pick(['Nordlicht Thema', 'Hafen bei Nacht', 'Verhör', 'Flut', 'Carstensen', 'Jagd', 'Leuchtfeuer'])}`,
        i % 6 === 0 ? 'Fremdtitel (fiktiv)' : 'Henrik Iversen', i % 6 === 0 ? 'Musikverlag Elbe (fiktiv)' : 'Eigenkomposition', between(20, 240),
        i % 6 === 0 ? 'Lizenz' : 'Eigenkomposition', pick(['Unterlegt', 'Unterlegt', 'Thema', 'Quelle']), '', i % 6 === 0 ? 'Sync-Lizenz angefragt' : '', i]))).length
    await insertMany(tx, 'insurances', ['project_id', 'ins_type', 'provider', 'policy_number', 'coverage_amount_cents', 'premium_cents', 'start_date', 'end_date', 'notes', 'sort_order'],
      [['Filmversicherung', 'Filmversicherer Nord (fiktiv)', 'FV-2026-90412', 700000000, 5200000], ['Betriebshaftpflicht', 'Hanse Versicherung (fiktiv)', 'BH-2026-11873', 1000000000, 950000],
        ['Unfallversicherung', 'Hanse Versicherung (fiktiv)', 'UV-2026-5521', 50000000, 620000], ['Ausrüstungsversicherung', 'Technikschutz AG (fiktiv)', 'AV-2026-7743', 300000000, 1480000],
        ['Sonstiges', 'Wasserfahrzeug-Haftpflicht (fiktiv)', 'WS-2026-201', 200000000, 240000], ['Sonstiges', 'Drohnenhaftpflicht (fiktiv)', 'DR-2026-044', 100000000, 90000]]
        .map(([t, pr, nr, dk, pm], i) => [pid, t, pr, nr, dk, pm, tag(-60), tag(200), '', i]))
    await insertMany(tx, 'vehicles', ['project_id', 'name', 'license_plate', 'type', 'capacity', 'driver_name', 'driver_phone', 'notes'],
      [['Kamera-LKW 7,5 t', 'LKW'], ['Licht-LKW 12 t', 'LKW'], ['Bühnen-LKW 7,5 t', 'LKW'], ['Generator 100 kVA', 'Generator'], ['Maskenmobil', 'Mobil'], ['Garderobenmobil', 'Mobil'],
        ['Darstellermobil 1', 'Mobil'], ['Darstellermobil 2', 'Mobil'], ['Honeywagon', 'Mobil'], ['Catering-Truck', 'LKW'], ['Regie-Van', 'Van'], ['Produktions-Van', 'Van'],
        ['Shuttle 1', 'Kleinbus'], ['Shuttle 2', 'Kleinbus'], ['Shuttle 3', 'Kleinbus'], ['Requisiten-Transporter', 'Transporter'], ['Ausstattung-Transporter', 'Transporter'],
        ['Kostüm-Transporter', 'Transporter'], ['Darstellerfahrzeug A', 'PKW'], ['Darstellerfahrzeug B', 'PKW'], ['Spielfahrzeug: Streifenwagen', 'PKW (im Bild)'], ['Spielfahrzeug: Janas Volvo 240', 'PKW (im Bild)']]
        .map(([n, t], i) => [pid, n, `HH-NL ${100 + i}`, t, t === 'Kleinbus' ? 8 : t === 'Van' ? 7 : 3, stabNamen[between(0, stabNamen.length - 1)], tel(), '']))
    await insertMany(tx, 'location_releases', ['location_id', 'owner_name', 'owner_address', 'shoot_dates', 'fee_cents', 'special_conditions', 'signed_at', 'signed_by', 'signature_data', 'status'],
      locIds.map((lid, i) => [lid, `${person()} (Eigentümer)`, `${MOTIVE[i].addr}, ${MOTIVE[i].zip} ${MOTIVE[i].city}`, `${daten[between(0, 20)]} – ${daten[between(21, 44)]}`, MOTIVE[i].miete,
        MOTIVE[i].note, i % 4 ? new Date().toISOString() : null, i % 4 ? person() : '', '', i % 4 ? 'Unterschrieben' : 'Entwurf']))
    zahlen.aufgaben = (await insertMany(tx, 'project_tasks', ['project_id', 'title', 'description', 'status', 'department', 'assignee', 'due_date', 'sort_order', 'created_by'],
      Array.from({ length: 70 }, (_, i) => [pid, pick(['Drehgenehmigung Köhlbrandbrücke nachreichen', 'Waffenschein-Kopie an Versicherung', 'Hotelblock Westerhever bestätigen', 'Tidekalender in Drehplan übernehmen', 'Kostümprobe Katharina Brodersen', 'Stuntprobe Containerterminal', 'Catering-Mengen für Nachtdrehs anpassen', 'Musterabnahme mit Sender', 'Backup Codex-Drives prüfen', 'Polizeibegleitung Nachtdreh anfragen', 'Anwohnerbriefe Marktstraße verteilen', 'Drohnengenehmigung Westerhever']) + ` (${i + 1})`,
        '', pick(['offen', 'offen', 'in_arbeit', 'abnahme', 'erledigt', 'erledigt']), pick(['Produktion', 'Aufnahmeleitung', 'Kamera', 'Kostüm', 'Ausstattung', 'Regie']), stabNamen[between(0, stabNamen.length - 1)], tag(between(-10, 30)), i, ownerId]))).length
    await insertMany(tx, 'comments', ['project_id', 'entity_type', 'entity_id', 'author', 'content', 'resolved'],
      Array.from({ length: 90 }, () => [pid, 'scene', sceneIds[between(0, sceneIds.length - 1)], pick(stabNamen.slice(0, 30)),
        pick(['Können wir die Szene auf den Nachtblock legen?', 'Dialog kürzen — Laufzeit!', 'Motiv hier doch Villa statt Büro?', 'Stunt nötig, bitte mit Koordination klären.', 'Regenmaschine eingeplant?', 'Anschluss an 45A beachten.']), rnd() < 0.4 ? 1 : 0]))
    await insertMany(tx, 'project_events', ['project_id', 'title', 'start_date', 'end_date', 'type', 'color', 'notes', 'all_day'],
      [['Leseprobe', -40, 'Meeting'], ['Kostümprobe Hauptcast', -35, 'Casting'], ['Technische Motivbesichtigung Hafen', -30, 'Locationscout'], ['Technische Motivbesichtigung Westerhever', -28, 'Locationscout'],
        ['Stuntprobe', -27, 'Probe'], ['Produktionsbesprechung Woche 1', -25, 'Meeting'], ['Musterabnahme Sender', 3, 'Meeting'], ['Produktionsbesprechung Woche 5', 5, 'Meeting'], ['Reisetag Westerhever', 12, 'Reise'], ['Abschlussfeier (Wrap Party)', 30, 'Sonstiges']]
        .map(([t, o, typ]) => [pid, t, tag(o as number), null, typ, '#0071E3', '', 1]))
    await insertMany(tx, 'sticky_notes', ['project_id', 'content', 'color', 'position_x', 'position_y', 'created_by'],
      ['Köhlbrandbrücke: Sperrung nur Nacht 12→13 bestätigt!', 'Tide Westerhever: Niedrigwasser Drehtag 31 um 11:40', 'Ersatzmotiv bei Sturm: Lagerhalle Veddel', 'Katharina: keine Nachtdrehs vor Theaterabenden (Do)', 'Codex-Drives: 4 in Reserve', 'Drohne: Kennzeichen am Gerät!', 'Shuttle-Plan hängt am Basecamp', 'Wrap-Party: Hafenkneipe gebucht'].map((c, i) => [pid, c, ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6'][i % 4], (i % 4) * 220, Math.floor(i / 4) * 220, ownerId]))
    await insertMany(tx, 'moodboard_items', ['project_id', 'image_url', 'title', 'notes', 'category', 'position_x', 'position_y', 'width'],
      [['#0B1D2A', 'Nachtblau Hafen', 'Grundton aller Nachtszenen'], ['#C9A227', 'Natriumdampf', 'Hafenbeleuchtung'], ['#5C6B73', 'Elbgrau', 'Tagszenen Hamburg'], ['#E8E4DA', 'Leuchtturmweiß', 'Westerhever'],
        ['', 'Bildsprache', 'Lange Brennweiten im Hafen, weitwinklig im Watt. Keine Handkamera außer in Szene 88–92.'], ['', 'Referenz', 'Nordic Noir, aber wärmer im Innenlicht der Villa.'], ['', 'Farbdramaturgie', 'Je näher Jana der Wahrheit kommt, desto kälter.']]
        .map(([u, t, n], i) => [pid, u, t, n, u ? 'Farbe' : 'Notiz', 80 + (i % 4) * 260, 80 + Math.floor(i / 4) * 240, 220]))
    await insertMany(tx, 'camera_presets', ['project_id', 'name', 'camera', 'lenses', 'notes'],
      [['Hafen Nacht', 'Alexa 35', 'Cooke 75 mm T2', 'ISO 1600, 2,8 ND'], ['Watt Weite', 'Alexa 35', 'Cooke 18 mm T5.6', 'ISO 800, Polfilter'], ['Verhör', 'Alexa 35', 'Cooke 50 mm T2.8', 'ISO 800, leicht untersättigt'], ['Steadicam Villa', 'Alexa 35 Mini LF', 'Cooke 32 mm', 'ISO 800']].map(r => [pid, ...r]))

    return pid
  })

  console.log(`[DB] Großproduktion "${GROSSPRODUKTION_TITEL}" angelegt (Projekt ${projectId}):`, JSON.stringify(zahlen))
  return { projectId, zahlen, team }
}
