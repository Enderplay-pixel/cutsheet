/**
 * Eine Drehbuchzeile im Fountain-Format.
 *
 * Fountain ist reiner Text: Was eine Zeile ist, ergibt sich aus ihrer Form.
 * Eine Figur ist eine Zeile in Großbuchstaben mit Dialog direkt darunter,
 * eine Überschrift beginnt mit INT. oder EXT., ein Übergang wird mit ">"
 * erzwungen, und Notizen stehen in [[doppelten Klammern]] - sie bleiben in
 * der Datei, werden aber nicht gedruckt.
 *
 * Gemessen am 24.10.2026 fehlten drei Zeilentypen. Sie fielen in den
 * Aktionszweig und standen als gewöhnlicher Drehbuchtext da:
 *  - eine **Anmerkung** - die interne Notiz am Rand - wanderte damit in jedes
 *    exportierte Drehbuch, sichtbar für jeden, der es bekommt;
 *  - eine **Einblendung** verlor ihr "SUPER:" und war von Aktion nicht mehr
 *    zu unterscheiden;
 *  - ein **Intercut** verlor sein "INTERCUT WITH:".
 */

type Block = { block_type: string; content?: string | null }

/** Die Zeilen, die ein Block im Fountain-Text ergibt - leer, wenn er nichts enthält. */
export function fountainZeilen(b: Block): string[] {
  const inhalt = String(b.content ?? '').trim()
  if (!inhalt) return []

  switch (b.block_type) {
    case 'scene_heading': {
      // Fountain erkennt nur INT, EXT, EST, INT./EXT, INT/EXT und I/E selbst
      // (fountain.io/syntax); alles andere wird mit Punkt erzwungen. Vorher
      // galten INNEN und AUSSEN als erkannt - in jeder Fountain-App wurde
      // "INNEN. KÜCHE - TAG" damit zu Aktionstext (gemessen am 26.10.2026).
      const standard = /^(INT\.?\/EXT|INT|EXT|EST|I\/E)[.\s]/i.test(inhalt)
      return [standard ? inhalt.toUpperCase() : `.${inhalt.toUpperCase()}`, '']
    }
    case 'character':
      return [inhalt.toUpperCase()]
    case 'parenthetical':
      return [inhalt.startsWith('(') ? inhalt : `(${inhalt})`]
    case 'dialogue':
      return [inhalt, '']
    case 'transition':
      return [`> ${inhalt.toUpperCase()}`, '']
    case 'note':
    case 'annotation':
      // Bleibt in der Datei, erscheint aber in keinem gedruckten Drehbuch -
      // genau wie im PDF, das Anmerkungen nur auf ausdrücklichen Wunsch zeigt.
      return [`[[${inhalt}]]`, '']
    case 'super':
      return [/^SUPER\b/i.test(inhalt) ? inhalt.toUpperCase() : `SUPER: "${inhalt}"`, '']
    case 'intercut':
      return [/^INTERCUT\b/i.test(inhalt) ? inhalt.toUpperCase() : `INTERCUT WITH: ${inhalt.toUpperCase()}`, '']
    default: // action
      return [inhalt, '']
  }
}
