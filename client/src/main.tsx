import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: 1 },
  },
})

const router = createBrowserRouter([
  {
    path: '/login',
    lazy: () => import('./pages/Login'),
  },
  {
    path: '/admin/benutzer',
    element: <App />,
    children: [{ index: true, lazy: () => import('./pages/Benutzerverwaltung') }],
  },
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, lazy: () => import('./pages/ProjectList') },
      {
        path: 'projects/:projectId',
        children: [
          { index: true, lazy: () => import('./pages/Dashboard') },
          { path: 'stammdaten', lazy: () => import('./pages/Stammdaten') },
          { path: 'drehbuch', lazy: () => import('./pages/Drehbuch') },
          { path: 'besetzung', lazy: () => import('./pages/Besetzung') },
          { path: 'stabliste', lazy: () => import('./pages/Stabliste') },
          { path: 'motive', lazy: () => import('./pages/Motive') },
          { path: 'equipment', lazy: () => import('./pages/Equipment') },
          { path: 'drehplan', lazy: () => import('./pages/Drehplan') },
          { path: 'staebchenplan', lazy: () => import('./pages/StaebchenplanNew') },
          { path: 'shotlist', lazy: () => import('./pages/Shotlist') },
          { path: 'tagesdispo', lazy: () => import('./pages/Tagesdispo') },
          { path: 'tagesdispo/:dayId', lazy: () => import('./pages/Tagesdispo') },
          { path: 'tagesbericht', lazy: () => import('./pages/Tagesbericht') },
          { path: 'budget', lazy: () => import('./pages/Budget') },
          { path: 'email', lazy: () => import('./pages/EmailCenter') },
          { path: 'kalender', lazy: () => import('./pages/Terminkalender') },
          { path: 'konfliktradar', lazy: () => import('./pages/Konfliktradar') },
          { path: 'pinboard', lazy: () => import('./pages/Pinboard') },
          { path: 'fahrzeuge', lazy: () => import('./pages/Fahrzeuge') },
          { path: 'komparsen', lazy: () => import('./pages/Komparsen') },
          { path: 'audit', lazy: () => import('./pages/AuditLog') },
          { path: 'zeitanalyse', lazy: () => import('./pages/ZeitAnalyse') },
          { path: 'suche', lazy: () => import('./pages/Suche') },
          { path: 'screenplay-editor', lazy: () => import('./pages/ScreenplayEditor') },
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
