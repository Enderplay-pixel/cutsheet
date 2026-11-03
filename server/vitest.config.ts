import { defineConfig } from 'vitest/config'

/**
 * Die Tests laufen in UTC, wie der Server beim Hoster. Auf dem Rechner zu
 * Hause wäre es sonst Berliner Zeit, und kein Datumsfehler, der nur in UTC
 * auftritt, fiele auf. `process.env.TZ` in einem Test umzustellen wirkt im
 * Worker nicht - gemessen am 03.11.2026: Versatz blieb -120 Minuten. Gesetzt
 * vor dem Start der Worker wirkt es.
 */
process.env.TZ = 'UTC'

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
