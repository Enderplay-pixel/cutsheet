import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { initAnalytics } from './lib/analytics'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import './index.css'

initAnalytics()

// Hell/Dunkel schon vor dem ersten Rendern setzen — sonst zeigen Login
// und öffentliche Seiten (ausserhalb der AppShell) immer den Dunkelmodus.
try {
  const saved = JSON.parse(localStorage.getItem('cutsheet-ui') || '{}')?.state?.darkMode
  const dark = typeof saved === 'boolean' ? saved : (window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.classList.toggle('light', !dark)
} catch { /* Speicher gesperrt: Standard aus index.html bleibt */ }

// After a new deployment the browser may have a cached index.html pointing to
// old chunk hashes that no longer exist. Wrap every lazy import so that if
// loading fails (404 on the chunk) the page reloads once to get fresh URLs.
// The returned promise never resolves so React Router never sees the error.
const lazyPage = (factory: () => Promise<any>) => () =>
  factory().catch(() => { window.location.reload(); return new Promise<never>(() => {}) })

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: 1 },
  },
})

const router = createBrowserRouter([
  {
    path: '/login',
    lazy: lazyPage(() => import('./pages/Login')),
  },
  {
    path: '/forgot-password',
    lazy: lazyPage(() => import('./pages/ForgotPassword')),
  },
  {
    path: '/reset-password/:token',
    lazy: lazyPage(() => import('./pages/ResetPassword')),
  },
  {
    path: '/impressum',
    lazy: lazyPage(() => import('./pages/Impressum')),
  },
  {
    path: '/datenschutz',
    lazy: lazyPage(() => import('./pages/Datenschutz')),
  },
  {
    path: '/dispo/:token',
    lazy: lazyPage(() => import('./pages/PublicDispo')),
  },
  {
    path: '/invite/:token',
    lazy: lazyPage(() => import('./pages/Invite')),
  },
  {
    path: '/set',
    lazy: lazyPage(() => import('./pages/SetApp')),
  },
  {
    path: '/admin',
    element: <App />,
    children: [{ index: true, lazy: lazyPage(() => import('./pages/AdminPanel')) }],
  },
  {
    path: '/admin/benutzer',
    element: <App />,
    children: [{ index: true, lazy: lazyPage(() => import('./pages/AdminPanel')) }],
  },
  {
    path: '/admin/stats',
    element: <App />,
    children: [{ index: true, lazy: lazyPage(() => import('./pages/AdminStats')) }],
  },
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, lazy: lazyPage(() => import('./pages/ProjectList')) },
      { path: 'settings', lazy: lazyPage(() => import('./pages/Settings')) },
      {
        path: 'projects/:projectId',
        children: [
          { index: true, lazy: lazyPage(() => import('./pages/Dashboard')) },
          { path: 'stammdaten', lazy: lazyPage(() => import('./pages/Stammdaten')) },
          { path: 'drehbuch', lazy: lazyPage(() => import('./pages/Drehbuch')) },
          { path: 'besetzung', lazy: lazyPage(() => import('./pages/Besetzung')) },
          { path: 'stabliste', lazy: lazyPage(() => import('./pages/Stabliste')) },
          { path: 'motive', lazy: lazyPage(() => import('./pages/Motive')) },
          { path: 'equipment', lazy: lazyPage(() => import('./pages/Equipment')) },
          { path: 'drehplan', lazy: lazyPage(() => import('./pages/Drehplan')) },
          { path: 'staebchenplan', lazy: lazyPage(() => import('./pages/StaebchenplanNew')) },
          { path: 'shotlist', lazy: lazyPage(() => import('./pages/Shotlist')) },
          { path: 'setplan', lazy: lazyPage(() => import('./pages/Setplan')) },
          { path: 'tagesdispo', lazy: lazyPage(() => import('./pages/Tagesdispo')) },
          { path: 'tagesdispo/:dayId', lazy: lazyPage(() => import('./pages/Tagesdispo')) },
          { path: 'tagesbericht', lazy: lazyPage(() => import('./pages/Tagesbericht')) },
          { path: 'budget', lazy: lazyPage(() => import('./pages/Budget')) },
          { path: 'email', lazy: lazyPage(() => import('./pages/EmailCenter')) },
          { path: 'kalender', lazy: lazyPage(() => import('./pages/Terminkalender')) },
          { path: 'konfliktradar', lazy: lazyPage(() => import('./pages/Konfliktradar')) },
          { path: 'pinboard', lazy: lazyPage(() => import('./pages/Pinboard')) },
          { path: 'fahrzeuge', lazy: lazyPage(() => import('./pages/Fahrzeuge')) },
          { path: 'komparsen', lazy: lazyPage(() => import('./pages/Komparsen')) },
          { path: 'audit', lazy: lazyPage(() => import('./pages/AuditLog')) },
          { path: 'zeitanalyse', lazy: lazyPage(() => import('./pages/ZeitAnalyse')) },
          { path: 'suche', lazy: lazyPage(() => import('./pages/Suche')) },
          { path: 'screenplay-editor', lazy: lazyPage(() => import('./pages/ScreenplayEditor')) },
          { path: 'creator', lazy: lazyPage(() => import('./pages/CreatorVideos')) },
          { path: 'creator/ideen', lazy: lazyPage(() => import('./pages/CreatorIdeen')) },
          { path: 'creator/kanal', lazy: lazyPage(() => import('./pages/CreatorKanal')) },
          // Bereiche auf Projektebene. Muessen VOR 'creator/:videoId' stehen,
          // sonst frisst der Platzhalter sie als Video-ID.
          { path: 'creator/redaktionsplan', lazy: lazyPage(() => import('./pages/CreatorRedaktionsplan')) },
          { path: 'creator/serien', lazy: lazyPage(() => import('./pages/CreatorSerien')) },
          { path: 'creator/sponsoren', lazy: lazyPage(() => import('./pages/CreatorSponsoren')) },
          { path: 'creator/seo', lazy: lazyPage(() => import('./pages/CreatorSeo')) },
          { path: 'creator/titel', lazy: lazyPage(() => import('./pages/CreatorTitel')) },
          { path: 'creator/rechte', lazy: lazyPage(() => import('./pages/CreatorRechte')) },
          { path: 'creator/clips', lazy: lazyPage(() => import('./pages/CreatorClips')) },
          { path: 'creator/checklisten', lazy: lazyPage(() => import('./pages/CreatorChecklisten')) },
          { path: 'creator/performance', lazy: lazyPage(() => import('./pages/CreatorPerformance')) },
          { path: 'creator/:videoId', lazy: lazyPage(() => import('./pages/CreatorVideo')) },
          { path: 'kontakte', lazy: lazyPage(() => import('./pages/Kontaktliste')) },
          { path: 'vfx', lazy: lazyPage(() => import('./pages/VFX')) },
          { path: 'postplan', lazy: lazyPage(() => import('./pages/Postplan')) },
          { path: 'musikliste', lazy: lazyPage(() => import('./pages/Musikliste')) },
          { path: 'versicherungen', lazy: lazyPage(() => import('./pages/Versicherungen')) },
          { path: 'dood', lazy: lazyPage(() => import('./pages/DOOD')) },
          { path: 'checkin', lazy: lazyPage(() => import('./pages/CheckinBoard')) },
          { path: 'catering', lazy: lazyPage(() => import('./pages/CateringListe')) },
          { path: 'timesheets', lazy: lazyPage(() => import('./pages/Timesheets')) },
          { path: 'continuity', lazy: lazyPage(() => import('./pages/Continuity')) },
          { path: 'moodboard', lazy: lazyPage(() => import('./pages/Moodboard')) },
          { path: 'sperrtage', lazy: lazyPage(() => import('./pages/SperrtageKalender')) },
          { path: 'equipment-kalender', lazy: lazyPage(() => import('./pages/EquipmentKalender')) },
          { path: 'kommentare', lazy: lazyPage(() => import('./pages/SzenenKommentare')) },
          { path: 'aktivitaet', lazy: lazyPage(() => import('./pages/ActivityFeed')) },
          { path: 'kameraberichte', lazy: lazyPage(() => import('./pages/Kameraberichte')) },
          { path: 'aufgaben', lazy: lazyPage(() => import('./pages/Aufgaben')) },
          { path: 'kostenstand', lazy: lazyPage(() => import('./pages/Kostenstand')) },
        ],
      },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
