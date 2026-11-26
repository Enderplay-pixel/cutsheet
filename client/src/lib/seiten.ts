/**
 * Seitenangaben lesen (AP E6): "7/8", "1", "1 1/8" in Achteln. Leer ist null,
 * Unlesbares undefined - so wie Seiten im Drehplan geschrieben werden
 * (`eighthsToString`).
 */
export function achtelLesen(text: string): number | null | undefined {
  const t = text.trim()
  if (!t) return null
  const m = t.match(/^(?:(\d+)\s+)?(\d+)\/8$/) ?? t.match(/^(\d+)$/)
  if (!m) return undefined
  if (t.includes('/')) {
    const ganze = Number(m[1] ?? 0), achtel = Number(m[2])
    return achtel < 8 ? ganze * 8 + achtel : undefined
  }
  return Number(m[1]) * 8
}
