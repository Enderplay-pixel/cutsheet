/**
 * Cashflowplan (Plan Kino-Ausbau, AP E2): Einnahmen und Ausgaben auf der
 * Zeitachse, je Woche oder je Monat.
 *
 * Ausgaben laut Plan sind die Budgetzeilen mit Zeitraum (`spend_from`,
 * `spend_until`): Der Betrag verteilt sich nach Tagen auf die Wochen oder
 * Monate, die der Zeitraum berührt - bei ganzen Wochen also gleichmäßig auf
 * die Wochen. Gerechnet wird in ganzen Cent, der Rest einer Teilung geht in
 * den letzten Zeitraum, damit die Summe stimmt. Weil Woche und Monat dieselbe
 * Tagesrechnung nutzen, haben beide Raster dieselbe Gesamtsumme.
 *
 * Einnahmen sind die Raten der Geldgeber an ihrem Eingangstag, sonst am
 * Fälligkeitstag. Ausgaben laut Belegen stehen am Belegdatum. Was kein Datum
 * hat, steht mit seinem Betrag unter "nicht terminiert" - es verschwindet
 * nicht.
 *
 * Der Saldo ist Einnahmen minus Ausgaben laut Plan; ein aufgelaufenes Minus
 * heißt Unterdeckung. Die Belege stehen zum Vergleich daneben.
 */

export const RASTER = ['woche', 'monat'] as const
export type Raster = (typeof RASTER)[number]
export const istRaster = (r: unknown): r is Raster => r === 'woche' || r === 'monat'

const TAG = 86_400_000
const DATUM = /^\d{4}-\d{2}-\d{2}$/

/** "JJJJ-MM-TT" aus einem Datum oder Text, sonst null. */
export function datumAus(wert: unknown): string | null {
  if (wert === null || wert === undefined || wert === '') return null
  const text = wert instanceof Date ? wert.toISOString().slice(0, 10) : String(wert).slice(0, 10)
  if (!DATUM.test(text)) return null
  const t = Date.UTC(Number(text.slice(0, 4)), Number(text.slice(5, 7)) - 1, Number(text.slice(8, 10)))
  // 2026-02-30 gibt es nicht: Date.UTC rollt in den März
  return new Date(t).toISOString().slice(0, 10) === text ? text : null
}

const ms = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)))
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)

export type Zeitraum = { schluessel: string; von: string; bis: string }

/** Die Woche (Montag bis Sonntag) oder der Monat, in dem ein Tag liegt. */
export function zeitraumVon(datum: string, raster: Raster): Zeitraum {
  if (raster === 'woche') {
    const t = ms(datum)
    const montag = t - ((new Date(t).getUTCDay() + 6) % 7) * TAG
    return { schluessel: iso(montag), von: iso(montag), bis: iso(montag + 6 * TAG) }
  }
  const jahr = Number(datum.slice(0, 4))
  const monat = Number(datum.slice(5, 7))
  return { schluessel: datum.slice(0, 7), von: `${datum.slice(0, 7)}-01`, bis: iso(Date.UTC(jahr, monat, 0)) }
}

/** Alle Wochen oder Monate von `von` bis `bis`, lückenlos. */
export function zeitraeume(von: string, bis: string, raster: Raster): Zeitraum[] {
  const liste: Zeitraum[] = []
  let z = zeitraumVon(von, raster)
  while (z.von <= bis) {
    liste.push(z)
    z = zeitraumVon(iso(ms(z.bis) + TAG), raster)
  }
  return liste
}

/**
 * Ein Betrag über einen Zeitraum, nach Tagen auf Wochen oder Monate verteilt.
 * Ganze Cent; der Rest geht in den letzten Zeitraum. Negative Beträge (Erträge
 * im FFA-Schema) werden wie positive verteilt.
 */
export function verteilen(cents: number, von: string, bis: string, raster: Raster): Array<{ schluessel: string; cents: number }> {
  const tage = (ms(bis) - ms(von)) / TAG + 1
  const teile = zeitraeume(von, bis, raster)
  const vorzeichen = cents < 0 ? -1 : 1
  const betrag = Math.abs(Math.round(cents))
  let vergeben = 0
  return teile.map((z, i) => {
    let anteil: number
    if (i === teile.length - 1) anteil = betrag - vergeben
    else {
      const anfang = z.von > von ? z.von : von
      const ende = z.bis < bis ? z.bis : bis
      anteil = Math.floor((betrag * ((ms(ende) - ms(anfang)) / TAG + 1)) / tage)
    }
    vergeben += anteil
    return { schluessel: z.schluessel, cents: vorzeichen * anteil }
  })
}

export type CfZeile = { bezeichnung: string; cents: number; von?: unknown; bis?: unknown }
export type CfPosten = { bezeichnung: string; cents: number; datum?: unknown }
export type CfEreignis = { datum: string; titel: string; art: 'drehbeginn' | 'drehende' | 'meilenstein' }

export type CfEingabe = {
  raster: Raster
  /** Ausgaben laut Plan: Budgetzeilen; ohne gültigen Zeitraum nicht terminiert. */
  zeilen: CfZeile[]
  /** Einnahmen: Raten (Datum = Eingang, sonst Fälligkeit) und Beträge ohne Rate. */
  einnahmen: CfPosten[]
  /** Ausgaben laut Belegen, am Belegdatum. */
  belege: CfPosten[]
  ereignisse: CfEreignis[]
}

/** Ein gültiger Zeitraum einer Zeile: beide Enden, das Ende nicht vor dem Anfang. */
export function zeitraumDerZeile(von: unknown, bis: unknown): { von: string; bis: string } | null {
  const a = datumAus(von)
  const b = datumAus(bis)
  return a && b && a <= b ? { von: a, bis: b } : null
}

export function cashflow(e: CfEingabe) {
  const plan = new Map<string, number>()
  const ein = new Map<string, number>()
  const ist = new Map<string, number>()
  const marken = new Map<string, CfEreignis[]>()
  const ohneZeitraum: Array<{ bezeichnung: string; cents: number }> = []
  const ohneDatumEin: Array<{ bezeichnung: string; cents: number }> = []
  const ohneDatumBeleg: Array<{ bezeichnung: string; cents: number }> = []
  const plus = (m: Map<string, number>, k: string, c: number) => m.set(k, (m.get(k) ?? 0) + c)
  // Ein Objekt statt zweier let: TypeScript verfolgt Zuweisungen in einer
  // Hilfsfunktion nicht und hielte die Grenzen sonst für immer null
  const grenze: { anfang: string | null; ende: string | null } = { anfang: null, ende: null }
  const spanne = (von: string, bis: string) => {
    if (grenze.anfang === null || von < grenze.anfang) grenze.anfang = von
    if (grenze.ende === null || bis > grenze.ende) grenze.ende = bis
  }

  const verteilt: Array<{ z: { von: string; bis: string }; cents: number }> = []
  for (const z of e.zeilen) {
    const cents = Math.round(Number(z.cents) || 0)
    if (cents === 0) continue
    const zr = zeitraumDerZeile(z.von, z.bis)
    if (!zr) { ohneZeitraum.push({ bezeichnung: z.bezeichnung, cents }); continue }
    spanne(zr.von, zr.bis)
    verteilt.push({ z: zr, cents })
  }
  const amTag = (liste: CfPosten[], ziel: Map<string, number>, ohne: Array<{ bezeichnung: string; cents: number }>) => {
    const datiert: Array<{ datum: string; cents: number }> = []
    for (const p of liste) {
      const cents = Math.round(Number(p.cents) || 0)
      if (cents === 0) continue
      const d = datumAus(p.datum)
      if (!d) { ohne.push({ bezeichnung: p.bezeichnung, cents }); continue }
      spanne(d, d)
      datiert.push({ datum: d, cents })
    }
    return () => { for (const p of datiert) plus(ziel, zeitraumVon(p.datum, e.raster).schluessel, p.cents) }
  }
  const einBuchen = amTag(e.einnahmen, ein, ohneDatumEin)
  const istBuchen = amTag(e.belege, ist, ohneDatumBeleg)
  const ereignisse = e.ereignisse.filter((x) => datumAus(x.datum))
  for (const x of ereignisse) spanne(x.datum, x.datum)

  for (const v of verteilt) for (const t of verteilen(v.cents, v.z.von, v.z.bis, e.raster)) plus(plan, t.schluessel, t.cents)
  einBuchen()
  istBuchen()
  for (const x of [...ereignisse].sort((a, b) => a.datum.localeCompare(b.datum))) {
    const k = zeitraumVon(x.datum, e.raster).schluessel
    marken.set(k, [...(marken.get(k) ?? []), x])
  }

  let aufgelaufen = 0
  const liste = grenze.anfang !== null && grenze.ende !== null ? zeitraeume(grenze.anfang, grenze.ende, e.raster) : []
  const perioden = liste.map((z) => {
    const einnahmen = ein.get(z.schluessel) ?? 0
    const ausgaben = plan.get(z.schluessel) ?? 0
    const saldo = einnahmen - ausgaben
    aufgelaufen += saldo
    return {
      ...z,
      einnahmen_cents: einnahmen,
      ausgaben_plan_cents: ausgaben,
      ausgaben_ist_cents: ist.get(z.schluessel) ?? 0,
      saldo_cents: saldo,
      saldo_aufgelaufen_cents: aufgelaufen,
      unterdeckung: aufgelaufen < 0,
      ereignisse: marken.get(z.schluessel) ?? [],
    }
  })
  const summe = (l: Array<{ cents: number }>) => l.reduce((s, x) => s + x.cents, 0)
  const summeDer = (k: 'einnahmen_cents' | 'ausgaben_plan_cents' | 'ausgaben_ist_cents') => perioden.reduce((s, p) => s + p[k], 0)
  return {
    raster: e.raster,
    perioden,
    summen: {
      einnahmen_cents: summeDer('einnahmen_cents'),
      ausgaben_plan_cents: summeDer('ausgaben_plan_cents'),
      ausgaben_ist_cents: summeDer('ausgaben_ist_cents'),
      saldo_cents: aufgelaufen,
    },
    nicht_terminiert: {
      ausgaben: ohneZeitraum,
      ausgaben_cents: summe(ohneZeitraum),
      einnahmen: ohneDatumEin,
      einnahmen_cents: summe(ohneDatumEin),
      belege: ohneDatumBeleg,
      belege_cents: summe(ohneDatumBeleg),
    },
    erste_unterdeckung: perioden.find((p) => p.unterdeckung)?.schluessel ?? null,
  }
}
