import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import './index.css'

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
    path: '/invite/:token',
    lazy: lazyPage(() => import('./pages/Invite')),
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
          { path: 'kontakte', lazy: lazyPage(() => import('./pages/Kontaktliste')) },
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
