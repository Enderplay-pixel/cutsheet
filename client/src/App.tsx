import { useEffect, useState } from 'react'
import { Outlet, useNavigate, useParams, useLocation } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { Toaster } from '@/components/ui/toaster'
import { GlobalSearch } from '@/components/shared/GlobalSearch'
import { ShortcutsModal } from '@/components/shared/ShortcutsModal'
import { TutorialModal } from '@/components/shared/TutorialModal'
import { useAuth } from '@/contexts/AuthContext'
import { useProjectStore } from '@/store/useProjectStore'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { SkipLink } from '@/components/SkipLink'
import { ProjectRoleProvider } from '@/contexts/ProjectRoleContext'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { EyeOff } from 'lucide-react'
import { useT } from '@/lib/useT'
import { appT } from '@/lib/i18n'

function AppShell() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { darkMode, setActiveProjectId, searchOpen, setSearchOpen } = useProjectStore()
  const [searchVisible, setSearchVisible] = useState(false)
  const { user, justRegistered, clearJustRegistered } = useAuth()
  const [tutorialOpen, setTutorialOpen] = useState(false)

  // Show tutorial exactly once per user, right after registration
  useEffect(() => {
    if (!user) return
    const key = `cutsheet-tutorial-seen-${user.id}`
    if (justRegistered && !localStorage.getItem(key)) {
      setTutorialOpen(true)
    }
  }, [justRegistered, user])

  const handleTutorialClose = () => {
    if (user) localStorage.setItem(`cutsheet-tutorial-seen-${user.id}`, '1')
    setTutorialOpen(false)
    clearJustRegistered()
  }

  // Fetch project to get my_role
  const { data: project } = useQuery({
    queryKey: ['project', Number(projectId)],
    queryFn: () => api.projects.get(Number(projectId)),
    enabled: !!projectId,
  })
  const myRole = (project as any)?.my_role ?? 'read_only'
  const tt = useT()

  // Apply dark mode class
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    document.documentElement.classList.toggle('light', !darkMode)
  }, [darkMode])

  // Track active project
  useEffect(() => {
    if (projectId) setActiveProjectId(Number(projectId))
  }, [projectId, setActiveProjectId])

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // CMD+K or CTRL+K → search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchVisible(true)
      }
      // ESC handled by dialog
      if (e.key === 'Escape') setSearchVisible(false)

      // Project navigation shortcuts (only when project is open)
      if (projectId && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

        if (e.key === 'd') navigate(`/projects/${projectId}/drehplan`)
        if (e.key === 's') navigate(`/projects/${projectId}/drehbuch`)
        if (e.key === 'b') navigate(`/projects/${projectId}/besetzung`)
        if (e.key === 't') navigate(`/projects/${projectId}/tagesdispo`)
        if (e.key === 'c') navigate(`/projects/${projectId}/stabliste`)
        if (e.key === 'e') navigate(`/projects/${projectId}/equipment`)
        if (e.key === 'l') navigate(`/projects/${projectId}/shotlist`)
        if (e.key === 'm') navigate(`/projects/${projectId}/motive`)
        if (e.key === 'g') navigate(`/projects/${projectId}/budget`)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [projectId, navigate, setSearchOpen])

  return (
    <ProjectRoleProvider role={myRole}>
      <TooltipProvider delayDuration={300}>
        <SkipLink />
        <div className="flex h-dvh overflow-hidden bg-background">
          <Sidebar />
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <TopBar onSearchOpen={() => setSearchVisible(true)} />
            {/* Read-only banner */}
            {projectId && myRole === 'read_only' && (
              <div className="flex items-center gap-2 px-4 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 shrink-0">
                <EyeOff className="w-3.5 h-3.5 shrink-0" />
                <span>{tt(appT.readOnlyBanner)}</span>
              </div>
            )}
            <main id="main-content" className="flex-1 overflow-auto" role="main">
              <ErrorBoundary key={location.pathname}>
                <Outlet />
              </ErrorBoundary>
            </main>
          </div>
        </div>
        <GlobalSearch open={searchVisible} onClose={() => setSearchVisible(false)} />
        <ShortcutsModal />
        <TutorialModal open={tutorialOpen} onClose={handleTutorialClose} />
        <Toaster />
      </TooltipProvider>
    </ProjectRoleProvider>
  )
}

export default function App() {
  return (
    <ProtectedRoute>
      <AppShell />
    </ProtectedRoute>
  )
}
