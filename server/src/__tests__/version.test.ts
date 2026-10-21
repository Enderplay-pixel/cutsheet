import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * Die Version steht an einer Stelle - und soll dort bleiben.
 *
 * `client/src/lib/version.ts` ist die Quelle. Der Seitentitel in
 * `client/index.html` ist statisches HTML und kann die Konstante nicht lesen;
 * er trägt die Zahl deshalb doppelt. Genau solche Doppelungen laufen
 * auseinander: Jemand erhöht die Konstante, der Reiter im Browser zeigt
 * monatelang die alte Zahl, und niemandem fällt es auf.
 *
 * Dieser Test hält beide zusammen.
 */

const WURZEL = path.join(__dirname, '../../..')

function lies(datei: string): string {
  return fs.readFileSync(path.join(WURZEL, datei), 'utf-8')
}

/** Die Zahl aus `export const VERSION = '…'`. */
function versionAusQuelle(): string {
  const treffer = /export const VERSION = '([^']+)'/.exec(lies('client/src/lib/version.ts'))
  return treffer ? treffer[1] : ''
}

describe('Version', () => {
  it('steht in der Quelle und hat die erwartete Form', () => {
    const v = versionAusQuelle()
    // "v1.0 alpha", später "v2.3 beta" oder "v1.0" - immer mit führendem v
    // und einer Zahl mit Punkt.
    expect(v, 'VERSION fehlt in client/src/lib/version.ts').not.toBe('')
    expect(v).toMatch(/^v\d+\.\d+( (alpha|beta))?$/)
  })

  it('steht genauso im Seitentitel', () => {
    const v = versionAusQuelle()
    const titel = /<title>([^<]*)<\/title>/.exec(lies('client/index.html'))?.[1] ?? ''
    expect(
      titel,
      `Der Titel in client/index.html nennt nicht ${v}. Beide müssen zusammenpassen - `
        + 'statisches HTML kann die Konstante nicht lesen.'
    ).toContain(v)
  })

  it('nennt im Titel auch den Namen der Anwendung', () => {
    const titel = /<title>([^<]*)<\/title>/.exec(lies('client/index.html'))?.[1] ?? ''
    expect(titel).toContain('CutSheet')
  })

  it('trägt ein Stichdatum, das zur Version gehört', () => {
    const quelle = lies('client/src/lib/version.ts')
    const stand = /export const VERSION_STAND = '([^']+)'/.exec(quelle)?.[1] ?? ''
    // Ohne Datum weiß später niemand, ob die Zahl zur laufenden Fassung passt.
    expect(stand).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('benutzt keinen Gedankenstrich im Titel', () => {
    // Hausregel: Bindestrich, nie Gedankenstrich.
    const titel = /<title>([^<]*)<\/title>/.exec(lies('client/index.html'))?.[1] ?? ''
    expect(titel).not.toContain('—')
    expect(titel).not.toContain('–')
  })
})
