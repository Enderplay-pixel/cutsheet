import { useProjectStore } from '@/store/useProjectStore'

/**
 * Jede Anfrage an den eigenen Server nennt die Sprache der Oberfläche.
 *
 * Der Server übersetzt damit seine Fehlermeldungen (middleware/sprache.ts).
 * An einer Stelle statt in jedem Aufruf: Rund dreißig Seiten rufen `fetch`
 * direkt auf, darunter die öffentlichen Links für Darsteller und Agenturen.
 */
export function spracheSendenInstallieren(): void {
  const echtesFetch = window.fetch.bind(window)
  window.fetch = (eingabe: RequestInfo | URL, init?: RequestInit) => {
    const adresse = typeof eingabe === 'string' ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe.url
    const eigenerServer = adresse.startsWith('/api') || adresse.startsWith(`${location.origin}/api`)
    if (!eigenerServer) return echtesFetch(eingabe, init)
    const kopf = new Headers(init?.headers ?? (eingabe instanceof Request ? eingabe.headers : undefined))
    if (!kopf.has('X-Sprache')) kopf.set('X-Sprache', useProjectStore.getState().language)
    return echtesFetch(eingabe, { ...init, headers: kopf })
  }
}
