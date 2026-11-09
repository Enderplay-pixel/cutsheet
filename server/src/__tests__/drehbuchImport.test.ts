/**
 * Drehbuch-Import: Base64 nur, wenn es wirklich Base64 ist.
 *
 * Gemessen am 19.10.2026 im Einrichtungsassistenten: Eine Fountain-Datei mit
 * 264 Zeichen scheiterte mit "Der Text enthält ein Zeichen, das nicht
 * gespeichert werden kann." Die Route hielt jeden Text ohne "<" mit einer
 * durch 4 teilbaren Länge für Base64 und machte daraus Datenmüll mit
 * Nullbytes. Damit traf es jedes vierte Fountain- oder TXT-Drehbuch.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('../db', () => ({
  pool: { query: vi.fn(async () => ({ rows: [] })) },
  toPg: (sql: string) => sql,
  db: { get: vi.fn(), all: vi.fn(async () => []), run: vi.fn(async () => ({})) },
}))

describe('Importtext entpacken', () => {
  it('lässt ein Fountain-Drehbuch mit durch 4 teilbarer Länge, wie es ist', async () => {
    const { entpackeImport } = await import('../routes/screenplay')
    const roh = 'INT. WOHNKÜCHE - NACHT\n\nLena sitzt am Tisch.\n\nLENA\nHörst du das?\n'
    const fountain = roh + ' '.repeat((4 - (roh.length % 4)) % 4)
    expect(fountain.length % 4).toBe(0)
    expect(entpackeImport(fountain)).toBe(fountain)
  })

  it('entpackt echtes Base64', async () => {
    const { entpackeImport } = await import('../routes/screenplay')
    const xml = '<FinalDraft><Content><Paragraph Type="Scene Heading"><Text>INT. KÜCHE - TAG</Text></Paragraph></Content></FinalDraft>'
    expect(entpackeImport(Buffer.from(xml, 'utf-8').toString('base64'))).toBe(xml)
  })
})

describe('Fountain lesen', () => {
  const fountain = [
    'Title: Nachtfalter',
    'Credit: Drehbuch von',
    'Author: Mira Schulte',
    '',
    'INT. WOHNKÜCHE - NACHT',
    '',
    'Lena (24) sitzt am Tisch.',
    '',
    'LENA',
    '(leise)',
    'Hörst du das auch?',
    '',
    'EXT. HINTERHOF - NACHT',
  ].join('\n')

  it('übernimmt den Titelblock nicht als Szeneninhalt', async () => {
    const { parsePlainText } = await import('../routes/screenplay')
    const bloecke = parsePlainText(fountain)
    expect(bloecke[0]).toEqual({ type: 'scene_heading', content: 'INT. WOHNKÜCHE - NACHT' })
    expect(bloecke.some((b) => b.content.startsWith('Title:'))).toBe(false)
  })

  it('erkennt Rolle, Regieanweisung und Dialog', async () => {
    const { parsePlainText } = await import('../routes/screenplay')
    const typen = parsePlainText(fountain).map((b) => b.type)
    expect(typen).toEqual(['scene_heading', 'action', 'character', 'parenthetical', 'dialogue', 'scene_heading'])
  })

  it('lässt einen Text ohne Titelblock beginnen, wie er beginnt', async () => {
    const { parsePlainText } = await import('../routes/screenplay')
    expect(parsePlainText('Es ist still.\n\nINT. FLUR - TAG')[0]).toEqual({ type: 'action', content: 'Es ist still.' })
  })
})

describe('Szenenüberschriften', () => {
  it('liest INT./EXT., EXT./INT., I/E und die deutschen Formen', async () => {
    const { parseSceneHeading } = await import('../routes/screenplay')
    expect(parseSceneHeading('INT./EXT. LKW - NACHT')).toEqual({ int_ext: 'INT/EXT', title: 'LKW', day_night: 'NACHT' })
    expect(parseSceneHeading('EXT./INT. AUTO - TAG')).toMatchObject({ int_ext: 'INT/EXT', title: 'AUTO' })
    expect(parseSceneHeading('I/E. BUS - DAY')).toMatchObject({ int_ext: 'INT/EXT', title: 'BUS' })
    expect(parseSceneHeading('INNEN. KÜCHE - TAG')).toMatchObject({ int_ext: 'INT', title: 'KÜCHE' })
    expect(parseSceneHeading('AUSSEN. DEICH - NACHT')).toMatchObject({ int_ext: 'EXT', title: 'DEICH', day_night: 'NACHT' })
    expect(parseSceneHeading('EXT. HAFEN - TAG')).toMatchObject({ int_ext: 'EXT', title: 'HAFEN' })
  })

  it('nimmt die Fountain-Nummer aus der Überschrift', async () => {
    const { parsePlainText } = await import('../routes/screenplay')
    expect(parsePlainText('INT. HAUS - TAG #13A#\n\nText.')[0]).toEqual({ type: 'scene_heading', content: 'INT. HAUS - TAG', nummer: '13A' })
  })

  it('löst hexadezimale Entities auf und &amp; zuletzt', async () => {
    const { entitaetenAufloesen } = await import('../routes/screenplay')
    expect(entitaetenAufloesen('Johanna&#x27;s &#228; &amp;lt;')).toBe("Johanna's ä &lt;")
  })
})

