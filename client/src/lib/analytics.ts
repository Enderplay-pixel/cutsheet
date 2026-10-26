// Produktanalytik via PostHog EU - komplett env-gated:
// ohne VITE_POSTHOG_KEY ist jede Funktion ein No-op (kein Netzwerk-Call).
import posthog from 'posthog-js'

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined

export function initAnalytics() {
  if (!KEY) return
  posthog.init(KEY, {
    api_host: 'https://eu.i.posthog.com',
    autocapture: false,
    capture_pageview: true,
    persistence: 'localStorage',
  })
}

export function track(event: string, props?: Record<string, unknown>) {
  if (KEY) posthog.capture(event, props)
}

/**
 * Nur die Kontonummer, kein Name und keine E-Mail: Die Datenschutzerklärung
 * verspricht eine pseudonymisierte Auswertung. Vorher gingen Name und Adresse
 * an PostHog (gemessen am Code, 26.10.2026).
 */
export function identifyUser(u: { id: number }) {
  if (KEY) posthog.identify(String(u.id))
}

export function resetAnalytics() {
  if (KEY) posthog.reset()
}
