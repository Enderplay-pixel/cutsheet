const { join } = require('path')

/**
 * Chromium in das Repo-Verzeichnis herunterladen statt nach ~/.cache.
 *
 * Auf Render liegt HOME auf /opt/render/project, der Build-Cache dort wird aber
 * nicht in den Laufzeit-Container übernommen — puppeteer fand den Browser zur
 * Laufzeit deshalb nicht ("Could not find Chrome ... cache path is
 * /opt/render/project/.cache/puppeteer"). Innerhalb des Projektverzeichnisses
 * (/opt/render/project/src) übersteht der Download den Deploy.
 */
module.exports = {
  cacheDir: join(__dirname, '.cache', 'puppeteer'),
}
