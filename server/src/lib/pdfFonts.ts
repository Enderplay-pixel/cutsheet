/**
 * Schriften für alle PDF-Dokumente.
 *
 * Der Server rendert mit einem nackten Chromium ohne Systemschriften wie
 * SF Pro — ohne eingebettete Schrift fiele jedes PDF auf DejaVu oder Arial
 * zurück und sähe anders aus als die App. Geist ist die Ersatzschrift der
 * App und wird hier als data:-URL eingebettet, damit der Browser dafür
 * nicht ins Netz muss.
 */
import { readFileSync } from 'fs'

function fontDataUrl(pkg: string, file: string): string | null {
  try {
    const path = require.resolve(`${pkg}/files/${file}`)
    return `data:font/woff2;base64,${readFileSync(path).toString('base64')}`
  } catch {
    // Paket fehlt (etwa in einer schlanken Testumgebung): Systemschrift reicht
    return null
  }
}

let cached: string | null = null

/** @font-face-Regeln für Geist (Text) und Geist Mono (Ziffernspalten). */
export function pdfFontFaces(): string {
  if (cached !== null) return cached
  const faces: string[] = []
  const sans = fontDataUrl('@fontsource-variable/geist', 'geist-latin-wght-normal.woff2')
  const sansExt = fontDataUrl('@fontsource-variable/geist', 'geist-latin-ext-wght-normal.woff2')
  const mono = fontDataUrl('@fontsource-variable/geist-mono', 'geist-mono-latin-wght-normal.woff2')
  if (sans) faces.push(`@font-face { font-family: 'Geist'; font-weight: 100 900; font-style: normal; src: url(${sans}) format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }`)
  if (sansExt) faces.push(`@font-face { font-family: 'Geist'; font-weight: 100 900; font-style: normal; src: url(${sansExt}) format('woff2'); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF; }`)
  if (mono) faces.push(`@font-face { font-family: 'Geist Mono'; font-weight: 100 900; font-style: normal; src: url(${mono}) format('woff2'); }`)
  cached = faces.join('\n')
  return cached
}

/** Schriftstapel: SF Pro, wo vorhanden, sonst die eingebettete Geist. */
export const PDF_SANS = `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Geist', 'Helvetica Neue', Arial, sans-serif`
export const PDF_MONO = `'SF Mono', 'Geist Mono', ui-monospace, Menlo, monospace`

/** Standard-Akzent, wenn das Projekt keine eigene Kopffarbe gewählt hat. */
export const PDF_DEFAULT_ACCENT = '#C43D0B' // Tungsten, siehe docs/designphilosophie.md

/**
 * Kopffarbe eines Projekts für Dokumente.
 *
 * Bis zum Redesign war Bernstein (#f59e0b) die Voreinstellung und steht so
 * in jedem bestehenden Projekt — auch dort, wo niemand sie bewusst gewählt
 * hat. Diese alte Voreinstellung gilt deshalb als „nicht gewählt“ und folgt
 * dem neuen Standard; jede andere Farbe bleibt, wie sie eingestellt wurde.
 * Dasselbe gilt für das System-Blau (#0071E3), die Voreinstellung vor
 * „Tungsten“.
 */
export function resolveAccent(color: string | null | undefined): string {
  const c = String(color ?? '').trim()
  if (!c || ['#f59e0b', '#0071e3'].includes(c.toLowerCase())) return PDF_DEFAULT_ACCENT
  return c
}
