/// <reference lib="webworker" />
// Eigener Service Worker (injectManifest): Precaching + Runtime-Caching wie
// vorher via generateSW, plus Web-Push-Handler für Dispo-Benachrichtigungen.
declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Parameters<typeof precacheAndRoute>[0] }

import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { clientsClaim } from 'workbox-core'

// Auto-Update-Verhalten wie registerType: 'autoUpdate'
self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// App-Seiten auch ohne Netz öffnen (/set, /projects/...): die SPA-Hülle
// kommt aus dem Precache, die Daten aus den Caches unten.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), {
  denylist: [/^\/api\//, /^\/uploads\//, /^\/\.well-known\//],
}))

// Set-Daten: drei Tage offline verfügbar. Am Motiv gibt es oft kein Netz -
// wer morgens die Dispo geladen hat, muss sie nachmittags noch sehen.
// Mit einer Stunde (wie für den Rest der API) war sie bis Mittag weg.
const SET_DATEN = [
  /^\/api\/projects$/,
  /^\/api\/projects\/\d+\/(shoot-days|shots|scenes|continuity)$/,
  /^\/api\/shoot-days\/\d+\/call-sheet$/,
]
registerRoute(
  ({ url, request }) => request.method === 'GET' && SET_DATEN.some(r => r.test(url.pathname)),
  new NetworkFirst({
    cacheName: 'set-offline',
    networkTimeoutSeconds: 6,
    plugins: [new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 3 * 24 * 60 * 60 })],
  })
)

// API: NetworkFirst (1 h Cache als Offline-Fallback)
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 10,
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 })],
  })
)

// Statische Assets: CacheFirst (30 Tage)
registerRoute(
  ({ url }) => url.pathname.startsWith('/assets/'),
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  })
)

// ─── Web Push ─────────────────────────────────────────────────────────────────

self.addEventListener('push', (event: PushEvent) => {
  let data: { title?: string; body?: string; url?: string } = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { body: event.data?.text() }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'CutSheet', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string })?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
      // Offenes Fenster fokussieren statt neues öffnen
      for (const win of windows) {
        if ('focus' in win) {
          win.navigate(url)
          return win.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
