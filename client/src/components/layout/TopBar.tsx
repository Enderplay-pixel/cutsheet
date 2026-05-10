import { useParams, useLocation } from 'react-router-dom'
import { Search, Moon, Sun } from 'lucide-react'
import { useProjectStore } from '@/store/useProjectStore'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/useT'
import { topBarT } from '@/lib/i18n'

interface TopBarProps {
  onSearchOpen: () => void
}

export function TopBar({ onSearchOpen }: TopBarProps) {
  const { darkMode, toggleDarkMode, lastSaved } = useProjectStore()
  const location = useLocation()
  const tt = useT()

  const segments = location.pathname.split('/')
  const lastSegment = segments[segments.length - 1]
  const pageKey = isNaN(Number(lastSegment)) ? lastSegment : ''
  const pageTitleMap = topBarT.pageTitles[pageKey as keyof typeof topBarT.pageTitles]
  const pageTitle = pageTitleMap ? tt(pageTitleMap) : ''

  return (
    <header className={cn(
      'flex items-center h-[56px] px-5 border-b border-border bg-card/70 backdrop-blur-md gap-4 shrink-0',
    )}>
      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-semibold text-foreground truncate tracking-tight">{pageTitle}</h1>
        {lastSaved && (
          <p className="text-[11px] text-muted-foreground/50 leading-none mt-0.5">
            {tt(topBarT.saved)} {new Date(lastSaved).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>

      {/* Search trigger */}
      <button
        onClick={onSearchOpen}
        className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-lg bg-muted/50 border border-border text-muted-foreground hover:text-foreground hover:bg-muted hover:border-border/80 transition-[background-color,border-color,color] duration-150 text-xs active:scale-[0.97]"
      >
        <Search className="w-3 h-3 shrink-0" />
        <span>{tt(topBarT.searchBtn)}</span>
        <kbd className="text-[10px] bg-background/70 px-1.5 py-0.5 rounded font-mono ml-1 text-muted-foreground/60 border border-border/60">⌘K</kbd>
      </button>

      <button
        onClick={onSearchOpen}
        className="sm:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-foreground/5 text-muted-foreground hover:text-foreground transition-[background-color,color] duration-150 active:scale-[0.97]"
      >
        <Search className="w-4 h-4" />
      </button>

      {/* Dark mode */}
      <button
        onClick={toggleDarkMode}
        title={darkMode ? tt(topBarT.lightMode) : tt(topBarT.darkMode)}
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-foreground/5 text-muted-foreground hover:text-foreground transition-[background-color,color] duration-150 active:scale-[0.97]"
      >
        {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
      </button>
    </header>
  )
}
