#!/usr/bin/env node
/**
 * Laedt Chromium fuer den PDF-Export in das Projektverzeichnis.
 *
 * Warum nicht einfach puppeteers Standard: puppeteer legt den Browser nach
 * ~/.cache/puppeteer. Auf Render ist HOME gleich /opt/render/project, und dieses
 * Verzeichnis wird nicht in den Laufzeit-Container uebernommen — der Browser war
 * dort zur Laufzeit weg ("Could not find Chrome ... cache path is
 * /opt/render/project/.cache/puppeteer").
 *
 * Warum nicht .puppeteerrc.cjs allein: die Datei wird je nach Aufrufort nicht
 * gefunden. PUPPETEER_CACHE_DIR wird dagegen immer beachtet, deshalb setzt
 * dieses Skript den Pfad explizit.
 *
 * Warum postinstall: `npm install` fuehrt es unabhaengig davon aus, welcher
 * Build-Befehl beim Hoster konfiguriert ist.
 *
 * Fehler sind bewusst nicht fatal — ohne Browser laeuft die App weiter, nur der
 * PDF-Export nicht. Ein abgebrochenes Deploy waere schlimmer.
 */
const fs = require('fs')
const path = require('path')

const CACHE_DIR = path.join(__dirname, '..', '.cache', 'puppeteer')

/** Sucht ein bereits vorhandenes Chrome-Binary im Cache. */
function findExisting(dir) {
  const root = path.join(dir, 'chrome')
  if (!fs.existsSync(root)) return null
  for (const build of fs.readdirSync(root).sort().reverse()) {
    const buildDir = path.join(root, build)
    let inner = []
    try { inner = fs.readdirSync(buildDir) } catch { continue }
    for (const sub of inner) {
      for (const bin of ['chrome', 'chrome.exe']) {
        const candidate = path.join(buildDir, sub, bin)
        if (fs.existsSync(candidate)) return candidate
      }
    }
  }
  return null
}

/** Die Chrome-Version, auf die das installierte puppeteer gepinnt ist. */
function pinnedChromeVersion() {
  const candidates = [
    'puppeteer-core/lib/cjs/puppeteer/revisions.js',
    'puppeteer/lib/cjs/puppeteer/revisions.js',
  ]
  for (const mod of candidates) {
    try {
      const rev = require(mod).PUPPETEER_REVISIONS
      if (rev?.chrome) return rev.chrome
    } catch { /* Pfad gibt es in dieser Version nicht */ }
  }
  return null
}

async function main() {
  if (process.env.SKIP_CHROMIUM_DOWNLOAD === '1') {
    console.log('[chromium] uebersprungen (SKIP_CHROMIUM_DOWNLOAD=1)')
    return
  }

  const existing = findExisting(CACHE_DIR)
  if (existing) {
    console.log('[chromium] bereits vorhanden:', existing)
    return
  }

  // Programmatische API statt `npx puppeteer browsers install`: kein Shell-Aufruf,
  // damit es auf Windows (npx.cmd laesst sich seit Node 20 nicht direkt starten)
  // und in schlanken Linux-Containern gleichermassen funktioniert.
  const { install, resolveBuildId, detectBrowserPlatform, Browser } = require('@puppeteer/browsers')

  const platform = detectBrowserPlatform()
  if (!platform) {
    console.warn('[chromium] Plattform nicht erkannt — Download uebersprungen')
    return
  }

  console.log('[chromium] lade Chrome nach', CACHE_DIR)
  try {
    // Bevorzugt die Version, auf die das installierte puppeteer gepinnt ist —
    // gleiche Version heisst gleiches DevTools-Protokoll. Ist sie nicht
    // ermittelbar, tut es der aktuelle stabile Build.
    const buildId = await resolveBuildId(Browser.CHROME, platform, pinnedChromeVersion() ?? 'stable')
    const installed = await install({
      browser: Browser.CHROME,
      buildId,
      cacheDir: CACHE_DIR,
      platform,
    })
    console.log('[chromium] bereit:', installed.executablePath)
  } catch (err) {
    // Nicht fatal: ohne Browser laeuft die App weiter, nur der PDF-Export nicht.
    // Ein abgebrochenes Deploy waere schlimmer.
    console.warn('[chromium] Download fehlgeschlagen:', err.message)
    console.warn('[chromium] Der PDF-Export bleibt deaktiviert, bis ein Chromium verfuegbar ist.')
  }
}

main()
