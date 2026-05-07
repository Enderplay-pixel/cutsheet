import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: 1 },
  },
})

const router = createBrowserRouter([
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
          { path: 'drehplan', lazy: () => import('./pages/Drehplan') },
          { path: 'shotlist', lazy: () => import('./pages/Shotlist') },
          { path: 'tagesdispo', lazy: () => import('./pages/Tagesdispo') },
          { path: 'tagesdispo/:dayId', lazy: () => import('./pages/Tagesdispo') },
          { path: 'tagesbericht', lazy: () => import('./pages/Tagesbericht') },
          { path: 'budget', lazy: () => import('./pages/Budget') },
          { path: 'equipment', lazy: () => import('./pages/Equipment') },
          { path: 'email', lazy: () => import('./pages/EmailCenter') },
          { path: 'kalender', lazy: () => import('./pages/Terminkalender') },
          { path: 'konfliktradar', lazy: () => import('./pages/Konfliktradar') },
        ],
      },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
)
