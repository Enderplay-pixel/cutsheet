import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * Wächter für die öffentlichen Pfade.
 *
 * `projectWriteGuard` lässt schreibende Anfragen ohne angemeldeten Benutzer
 * nur für eine feste Liste von Präfixen durch. Dreimal ist eine neue
 * tokengesicherte Route gebaut und der Eintrag vergessen worden: erst die
 * Dispo-Links, dann die Vertragsbestätigung, dann die Antwort einer Agentur.
 *
 * Der Fehler ist still. Die Seite lädt, das Formular lässt sich ausfüllen,
 * und erst beim Absenden kommt "Nicht authentifiziert" - und zwar bei
 * jemandem ohne Konto, der nichts dagegen tun kann.
 *
 * Dieser Test liest die Routendateien und vergleicht, was er findet, mit der
 * Liste. Er prüft Quelltext, keine Laufzeit - das reicht, weil genau das
 * Vergessen beim Schreiben der Route der Fehler ist.
 */

const ROUTEN = path.join(__dirname, '../routes')
const WAECHTER = path.join(__dirname, '../middleware/projectAuth.ts')

/** Die Präfixe aus der Liste im Wächter. */
function listeLesen(): string[] {
  const inhalt = fs.readFileSync(WAECHTER, 'utf-8')
  const block = /const OEFFENTLICHE_PFADE = \[([\s\S]*?)\]/.exec(inhalt)
  if (!block) return []
  return [...block[1].matchAll(/'([^']+)'/g)].map((t) => t[1])
}

/**
 * Schreibende Routen, deren Berechtigung an einem Token im Pfad hängt.
 *
 * Erkannt an `:token` im Pfad. Das ist das scharfe Merkmal: Genau das haben
 * die drei Fälle gemeinsam, um die es geht, und im ganzen Projekt tragen es
 * nur eine Handvoll Routen.
 *
 * Ein erster Versuch suchte nach "schreibende Route ohne `requireAuth` in
 * derselben Zeile" und traf 109 Routen - die meisten Router setzen
 * `requireAuth` einmal oben per `router.use`. Der Messaufbau war falsch, nicht
 * der Code.
 *
 * Routen mit `requireAuth` in derselben Zeile bleiben außen vor: Die
 * Einladungsannahme etwa trägt zwar einen Token, verlangt aber trotzdem ein
 * Konto - der Token sagt nur, zu welchem Projekt.
 */
function tokenSchreibrouten(): Array<{ datei: string; pfad: string }> {
  const gefunden: Array<{ datei: string; pfad: string }> = []
  for (const name of fs.readdirSync(ROUTEN).filter((d) => d.endsWith('.ts'))) {
    const inhalt = fs.readFileSync(path.join(ROUTEN, name), 'utf-8')
    for (const zeile of inhalt.split('\n')) {
      const treffer = /router\.(post|put|patch|delete)\(\s*'([^']*:token[^']*)'/.exec(zeile)
      if (!treffer) continue
      if (zeile.includes('requireAuth')) continue
      gefunden.push({ datei: name, pfad: treffer[2] })
    }
  }
  return gefunden
}

describe('Öffentliche Pfade', () => {
  const liste = listeLesen()

  it('ist als benannte Liste vorhanden', () => {
    // Keine verstreuten if-Zeilen mehr: Wer die Liste sucht, soll sie finden.
    expect(liste.length).toBeGreaterThan(0)
  })

  it('enthält die Pfade, die es gibt', () => {
    expect(liste).toContain('/cse/t/')      // Tagesdisposition bestätigen
    expect(liste).toContain('/vertrag/')    // Vertrag zustimmen
    expect(liste).toContain('/casting/')    // Agentur antwortet
  })

  it('findet überhaupt tokengesicherte Schreibrouten', () => {
    // Sonst wäre die nächste Prüfung still erfolgreich, weil sie nichts prüft.
    expect(tokenSchreibrouten().length).toBeGreaterThanOrEqual(3)
  })

  it('deckt jede tokengesicherte Schreibroute ab', () => {
    const routen = tokenSchreibrouten()
    // Das ist die eigentliche Prüfung: Wer eine neue solche Route baut und den
    // Eintrag vergisst, bekommt hier den Dateinamen genannt - und nicht erst
    // eine Rückmeldung von jemandem, der nichts absenden kann.
    const ungedeckt = routen.filter((r) => !liste.some((praefix) => r.pfad.startsWith(praefix)))
    expect(
      ungedeckt,
      'Diese Routen hängen an einem Token, stehen aber nicht in OEFFENTLICHE_PFADE: '
        + ungedeckt.map((r) => `${r.datei}: ${r.pfad}`).join(', ')
    ).toEqual([])
  })

  it('führt keine Präfixe, zu denen es keine Route gibt', () => {
    // Eine Liste, die mehr erlaubt als nötig, ist eine offene Tür. Jeder
    // Eintrag muss zu mindestens einer Route gehören.
    const alleRouten = fs.readdirSync(ROUTEN)
      .filter((d) => d.endsWith('.ts'))
      .map((d) => fs.readFileSync(path.join(ROUTEN, d), 'utf-8'))
      .join('\n')
    for (const praefix of liste) {
      const vorhanden = new RegExp(`router\\.[a-z]+\\(\\s*'${praefix.replace(/\//g, '\\/')}`).test(alleRouten)
      expect(vorhanden, `Kein Treffer für ${praefix} - gehört der Eintrag noch dazu?`).toBe(true)
    }
  })
})
