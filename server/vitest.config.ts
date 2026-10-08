import { defineConfig } from 'vitest/config'

/**
 * Eine Testdatei startet eine echte PostgreSQL-Instanz (`datenbank.test.ts`).
 * Deren Auf- und Abbau braucht mehr Zeit, als vitest einem Hook sonst lässt.
 */
export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
})
