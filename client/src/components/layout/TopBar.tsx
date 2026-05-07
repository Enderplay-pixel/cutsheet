import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Moon, Sun } from 'lucide-react'
import { useProjectStore } from '@/store/useProjectStore'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface TopBarProps {
  onSearchOpen: () => void
}

const PAGE_TITLES: Record<string, string> = {
  '': 'Dashboard',
  'stammdaten': 'Stammdaten',
  'drehbuch': 'Szenenübersicht',
  'besetzung': 'Besetzung & Stab',
  'stabliste': 'Stabliste',
  'motive': 'Motive & Drehorte',
  'drehplan': 'Drehplan',
  'shotlist': 'Shotlist',
  'tagesdispo': 'Tagesdisposition',
  'tagesbericht': 'Tagesbericht',
  'budget': 'Budget & Finanzierung',
  'equipment': 'Equipment',
  'email': 'E-Mail Center',
  'kalender': 'Terminkalender',
  'konfliktradar': 'Konfliktradar',
}

export function TopBar({ onSearchOpen }: TopBarProps) {
  const { projectId } = useParams()
  const { darkMode, toggleDarkMode, lastSaved } = useProjectStore()
  const location = useLocation()

  // Determine current page label
  const segments = location.pathname.split('/')
  const lastSegment = segments[segments.length - 1]
  const pageKey = isNaN(Number(lastSegment)) ? lastSegment : ''
  const pageTitle = PAGE_TITLES[pageKey] ?? ''

  return (
    <header className={cn(
      'flex items-center h-[52px] px-5 border-b border-border/60 bg-card/40 backdrop-blur-sm gap-4 shrink-0',
    )}>
      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-[13px] font-medium text-foreground truncate">{pageTitle}</h1>
        {lastSaved && (
          <p className="text-[11px] text-muted-foreground/60 leading-none mt-0.5">
            Gespeichert {new Date(lastSaved).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>

      {/* Search trigger */}
      <button
        onClick={onSearchOpen}
        className="hidden sm:flex items-center gap-2.5 h-7 px-3 rounded-md bg-muted/60 border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs"
      >
        <Search className="w-3 h-3" />
        <span>Suchen</span>
        <kbd className="text-[10px] bg-background/60 px-1.5 py-0.5 rounded font-mono ml-1 text-muted-foreground/70">⌘K</kbd>
      </button>

      <button
        onClick={onSearchOpen}
        className="sm:hidden w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Search className="w-4 h-4" />
      </button>

      {/* Dark mode */}
      <button
        onClick={toggleDarkMode}
        title={darkMode ? 'Hellmodus' : 'Dunkelmodus'}
        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
      >
        {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
      </button>
    </header>
  )
}
