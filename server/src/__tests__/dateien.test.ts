import { describe, it, expect } from 'vitest'
import {
  ARTEN, MAX_BYTES, istArt, mitFrist, sichererName, typPasst,
  fristStand, groesse, dateiUrl, dateiIdAus,
} from '../lib/dateien'

/**
 * Die Dateiablage.
 *
 * Der Anlass war ein stiller Datenverlust: Grundrisse, Motivfotos und
 * Storyboards lagen als Dateien auf der Platte, und beim Hoster ist das
 * Dateisystem flüchtig. Nach jedem Deploy war das Bild weg, die Zeile in der
 * Datenbank blieb - im Browser ein kaputtes Bild ohne Erklärung.
 */

describe('Arten', () => {
  it('kennt die Arten, auf die sich der Rest verlässt', () => {
    for (const art of ['genehmigung', 'versicherung', 'vertrag', 'grundriss', 'foto', 'storyboard']) {
      expect(istArt(art), art).toBe(true)
    }
    expect(istArt('irgendwas')).toBe(false)
    expect(istArt('')).toBe(false)
  })

  it('überwacht nur dort eine Frist, wo es eine gibt', () => {
    // Eine Drehgenehmigung läuft ab, eine Eingangsrechnung nicht.
    expect(mitFrist('genehmigung')).toBe(true)
    expect(mitFrist('versicherung')).toBe(true)
    expect(mitFrist('rechnung')).toBe(false)
    expect(mitFrist('foto')).toBe(false)
    expect(mitFrist('gibtesnicht')).toBe(false)
  })

  it('hat zu jeder Art einen Namen', () => {
    for (const a of ARTEN) {
      expect(a.name.length, a.art).toBeGreaterThan(2)
    }
  })
})

describe('Dateiname', () => {
  it('behält Umlaute - daran erkennt man die Datei wieder', () => {
    expect(sichererName('Drehgenehmigung Hauptstraße.pdf')).toBe('Drehgenehmigung Hauptstraße.pdf')
    expect(sichererName('Außenmotiv Köln.jpg')).toBe('Außenmotiv Köln.jpg')
  })

  it('entfernt Pfadanteile', () => {
    // Ein Browser schickt manchmal den ganzen Pfad mit. In der Ablage hat er
    // nichts zu suchen - und beim Herunterladen wäre er gefährlich.
    expect(sichererName('C:\\Users\\flork\\Desktop\\plan.png')).toBe('plan.png')
    expect(sichererName('/etc/passwd')).toBe('passwd')
    expect(sichererName('../../geheim.pdf')).toBe('geheim.pdf')
  })

  it('entfernt Zeichen, die Dateisysteme nicht mögen', () => {
    expect(sichererName('Rechnung: 12-2026 <final>.pdf')).toBe('Rechnung 12-2026 final.pdf')
    expect(sichererName('Plan |neu|.png')).toBe('Plan neu.png')
  })

  it('behandelt einen Schrägstrich als Pfad, nicht als Zeichen', () => {
    // Auf keinem Dateisystem darf ein Name einen Schrägstrich enthalten - wo
    // einer auftaucht, ist es ein Pfad oder ein Versuch. Dass dabei
    // "Rechnung 12" aus "Rechnung 12/2026.pdf" verlorengeht, ist der Preis
    // dafür und richtig so: Der Browser schickt den reinen Dateinamen.
    expect(sichererName('Rechnung 12/2026.pdf')).toBe('2026.pdf')
  })

  it('gibt nie einen leeren Namen zurück', () => {
    expect(sichererName('')).toBe('datei')
    expect(sichererName('   ')).toBe('datei')
    expect(sichererName('???')).toBe('datei')
  })

  it('kürzt sehr lange Namen', () => {
    expect(sichererName('x'.repeat(500)).length).toBe(200)
  })
})

describe('Dateitypen', () => {
  it('nimmt Bilder und PDF', () => {
    expect(typPasst('genehmigung', 'application/pdf')).toBe(true)
    expect(typPasst('genehmigung', 'image/jpeg')).toBe(true)
    // Ein abfotografierter Nachweis ist auch ein Nachweis.
    expect(typPasst('versicherung', 'image/png')).toBe(true)
    expect(typPasst('grundriss', 'application/pdf')).toBe(true)
  })

  it('weist ab, was offensichtlich nicht hingehört', () => {
    expect(typPasst('genehmigung', 'application/x-msdownload')).toBe(false)
    expect(typPasst('foto', 'text/html')).toBe(false)
    expect(typPasst('vertrag', '')).toBe(false)
  })
})

describe('Fristen', () => {
  it('kennt die vier Zustände', () => {
    expect(fristStand(null, '2026-10-13')).toBe('ohne')
    expect(fristStand('2026-10-12', '2026-10-13')).toBe('abgelaufen')
    // Am Stichtag selbst gilt sie noch.
    expect(fristStand('2026-10-13', '2026-10-13')).toBe('laeuft_ab')
    expect(fristStand('2026-11-12', '2026-10-13')).toBe('laeuft_ab')
    expect(fristStand('2026-11-13', '2026-10-13')).toBe('gueltig')
  })

  it('warnt dreißig Tage vorher, nicht eine Woche', () => {
    // Eine Drehgenehmigung zu verlängern dauert; eine Woche vorher ist es zu
    // spät. Genau 30 Tage sind noch Warnung, 31 noch nicht.
    expect(fristStand('2026-11-12', '2026-10-13')).toBe('laeuft_ab')
    expect(fristStand('2026-11-13', '2026-10-13')).toBe('gueltig')
  })

  it('rechnet über einen Monatswechsel', () => {
    expect(fristStand('2027-01-10', '2026-12-20')).toBe('laeuft_ab')
    expect(fristStand('2026-12-19', '2026-12-20')).toBe('abgelaufen')
  })
})

describe('Größenangabe', () => {
  it('rechnet in Tausenderschritten', () => {
    // Nicht 1024er: Die Zahl soll der entsprechen, die der Nutzer woanders
    // sieht.
    expect(groesse(999)).toBe('999 B')
    expect(groesse(1000)).toBe('1 KB')
    expect(groesse(1536)).toBe('1,5 KB')
    expect(groesse(2_500_000)).toBe('2,5 MB')
  })

  it('kommt mit null und Unsinn klar', () => {
    expect(groesse(0)).toBe('0 B')
    expect(groesse(NaN)).toBe('0 B')
  })

  it('nennt die Obergrenze lesbar', () => {
    expect(MAX_BYTES).toBe(20 * 1024 * 1024)
    expect(groesse(MAX_BYTES)).toContain('MB')
  })
})

describe('Adressen der Ablage', () => {
  it('baut die Ausliefer-Adresse', () => {
    expect(dateiUrl(4, 17)).toBe('/api/projects/4/dateien/17/inhalt')
  })

  it('liest die Kennung wieder heraus', () => {
    expect(dateiIdAus(dateiUrl(4, 17))).toBe(17)
    expect(dateiIdAus('/api/projects/1/dateien/2/inhalt')).toBe(2)
  })

  it('erkennt Altbestand als solchen', () => {
    // Alte Adressen zeigen auf die Platte. Wer sie für eine Ablage-Kennung
    // hält, löscht beim Ersetzen die falsche Zeile.
    expect(dateiIdAus('/uploads/floorplans/1699-plan.png')).toBeNull()
    expect(dateiIdAus('')).toBeNull()
    expect(dateiIdAus('irgendwas')).toBeNull()
  })
})
