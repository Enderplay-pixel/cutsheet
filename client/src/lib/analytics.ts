// Produktanalytik via PostHog EU — komplett env-gated:
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

export function identifyUser(u: { id: number; email: string; name: string }) {
  if (KEY) posthog.identify(String(u.id), { email: u.email, name: u.name })
}

export function resetAnalytics() {
  if (KEY) posthog.reset()
}
