import { describe, it, expect } from 'vitest'
import { vorstopp, vorstoppSumme, zeitText, sekundenAus, mitErzaehltag } from '../lib/vorstopp'

describe('Vorstopp und Erzähltag (AP E5)', () => {
  it('schätzt aus der Seitenlänge, bis jemand gestoppt hat', () => {
    expect(vorstopp({ eighths: 8, pretimed_seconds: null })).toEqual({ sekunden: 60, geschaetzt: true })
    expect(vorstopp({ eighths: 3 })).toEqual({ sekunden: 23, geschaetzt: true })
    expect(vorstopp({ eighths: 8, pretimed_seconds: 130 })).toEqual({ sekunden: 130, geschaetzt: false })
    expect(vorstopp({ eighths: 8, pretimed_seconds: 0 })).toEqual({ sekunden: 0, geschaetzt: false })
  })

  it('summiert einen Tag und weist den geschätzten Anteil aus', () => {
    expect(vorstoppSumme([{ eighths: 8, pretimed_seconds: 100 }, { eighths: 8, pretimed_seconds: 70 }, { eighths: 8 }]))
      .toEqual({ sekunden: 230, geschaetzt_sekunden: 60 })
    expect(vorstoppSumme([])).toEqual({ sekunden: 0, geschaetzt_sekunden: 0 })
  })

  it('schreibt Zeiten als m:ss, ab einer Stunde h:mm:ss', () => {
    expect([zeitText(250), zeitText(5), zeitText(3725)]).toEqual(['4:10', '0:05', '1:02:05'])
  })

  it('nimmt ganze Sekunden von 0 bis zehn Stunden an, leer ist null', () => {
    expect([sekundenAus(''), sekundenAus(null), sekundenAus(0), sekundenAus(36_000)]).toEqual([null, null, 0, 36_000])
    expect([sekundenAus(-1), sekundenAus(1.5), sekundenAus('x'), sekundenAus(36_001)]).toEqual([undefined, undefined, undefined, undefined])
  })

  it('hängt den Erzähltag an das Kürzel - ohne Erzähltag keine Zahl', () => {
    expect([mitErzaehltag('T', '1'), mitErzaehltag('N', ' 3A '), mitErzaehltag('T', ''), mitErzaehltag('N', null), mitErzaehltag('T/N', '2')])
      .toEqual(['T1', 'N3A', 'T', 'N', 'T/N 2'])
  })
})
