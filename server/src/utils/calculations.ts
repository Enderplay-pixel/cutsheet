// SV (Sozialversicherung) calculation for German film production
// Beitragssatz 2024: KV 14.6%, PV 3.4%, RV 18.6%, AV 2.6% (Arbeitnehmer-Anteil: half)
export const SV_RATES = {
  kv: 0.073,  // Krankenversicherung (AN-Anteil)
  pv: 0.017,  // Pflegeversicherung (AN-Anteil)
  rv: 0.093,  // Rentenversicherung (AN-Anteil)
  av: 0.013,  // Arbeitslosenversicherung (AN-Anteil)
}

export function calcSV(grossCents: number): {
  kv: number; pv: number; rv: number; av: number; total: number; net: number
} {
  const kv = Math.round(grossCents * SV_RATES.kv)
  const pv = Math.round(grossCents * SV_RATES.pv)
  const rv = Math.round(grossCents * SV_RATES.rv)
  const av = Math.round(grossCents * SV_RATES.av)
  const total = kv + pv + rv + av
  return { kv, pv, rv, av, total, net: grossCents - total }
}

export function calcDailyFee(feeCents: number, days: number): number {
  return feeCents * days
}

export function calcTotal(lines: Array<{ quantity: number; unit_price_cents: number }>): number {
  return lines.reduce((sum, l) => sum + Math.round(l.quantity * l.unit_price_cents), 0)
}

export function formatCents(cents: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(cents / 100)
}

export function calcBudgetVariance(planned: number, actual: number): {
  variance: number; variancePercent: number; overBudget: boolean
} {
  const variance = actual - planned
  const variancePercent = planned > 0 ? Math.round((variance / planned) * 100) : 0
  return { variance, variancePercent, overBudget: variance > 0 }
}

export function calcCashflow(
  budgetLines: Array<{ total_cents: number; category: string }>,
  shootDays: number
): { perDay: number; total: number; byCategory: Record<string, number> } {
  const total = budgetLines.reduce((s, l) => s + l.total_cents, 0)
  const byCategory = budgetLines.reduce((acc, l) => {
    acc[l.category] = (acc[l.category] || 0) + l.total_cents
    return acc
  }, {} as Record<string, number>)
  return { perDay: shootDays > 0 ? Math.round(total / shootDays) : 0, total, byCategory }
}
