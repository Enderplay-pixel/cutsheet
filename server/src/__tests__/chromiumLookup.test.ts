import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { findInPuppeteerCache } from '../routes/pdf'

/**
 * Regressionstest für den Fehler, der den PDF-Export auf Render lahmgelegt hat:
 * puppeteer legt Chrome unter <cache>/chrome/<plattform-version>/chrome-<plattform>/
 * ab. Die Version steckt im Ordnernamen, sie muss also gefunden statt geraten
 * werden — sonst kommt "Could not find Chrome (ver. …)".
 */
describe('findInPuppeteerCache', () => {
  let root: string

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'pptr-cache-'))
  })

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  function seed(cacheName: string, build: string, inner: string, binary: string): string {
    const dir = path.join(root, cacheName, 'chrome', build, inner)
    fs.mkdirSync(dir, { recursive: true })
    const bin = path.join(dir, binary)
    fs.writeFileSync(bin, '#!/bin/sh\n')
    return bin
  }

  it('findet ein heruntergeladenes Linux-Chrome', () => {
    const bin = seed('linux', 'linux-121.0.6167.85', 'chrome-linux64', 'chrome')
    expect(findInPuppeteerCache(path.join(root, 'linux'))).toBe(bin)
  })

  it('findet chrome.exe unter Windows', () => {
    const bin = seed('win', 'win64-121.0.6167.85', 'chrome-win64', 'chrome.exe')
    expect(findInPuppeteerCache(path.join(root, 'win'))).toBe(bin)
  })

  it('findet auch die headless-shell-Variante', () => {
    const bin = seed('shell', 'linux-124.0.0.0', 'chrome-headless-shell-linux64', 'chrome-headless-shell')
    expect(findInPuppeteerCache(path.join(root, 'shell'))).toBe(bin)
  })

  it('nimmt bei mehreren Versionen die hoechste', () => {
    seed('multi', 'linux-118.0.5993.70', 'chrome-linux64', 'chrome')
    const newer = seed('multi', 'linux-121.0.6167.85', 'chrome-linux64', 'chrome')
    expect(findInPuppeteerCache(path.join(root, 'multi'))).toBe(newer)
  })

  it('liefert undefined fuer ein nicht existierendes Verzeichnis', () => {
    expect(findInPuppeteerCache(path.join(root, 'gibtesnicht'))).toBeUndefined()
  })

  it('liefert undefined, wenn der Cache leer ist', () => {
    const empty = path.join(root, 'leer', 'chrome')
    fs.mkdirSync(empty, { recursive: true })
    expect(findInPuppeteerCache(path.join(root, 'leer'))).toBeUndefined()
  })

  it('liefert undefined, wenn kein Binary im Build-Ordner liegt', () => {
    fs.mkdirSync(path.join(root, 'kaputt', 'chrome', 'linux-1.2.3', 'chrome-linux64'), { recursive: true })
    expect(findInPuppeteerCache(path.join(root, 'kaputt'))).toBeUndefined()
  })
})
