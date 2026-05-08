import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Lang } from '@/lib/i18n'

interface ProjectStore {
  activeProjectId: number | null
  setActiveProjectId: (id: number | null) => void

  darkMode: boolean
  toggleDarkMode: () => void

  sidebarCollapsed: boolean
  toggleSidebar: () => void

  searchOpen: boolean
  setSearchOpen: (open: boolean) => void

  language: Lang
  setLanguage: (lang: Lang) => void

  lastSaved: Date | null
  setLastSaved: (d: Date) => void

  undoStack: any[]
  redoStack: any[]
  pushUndo: (state: any) => void
  undo: () => any | null
  redo: () => any | null
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      activeProjectId: null,
      setActiveProjectId: (id) => set({ activeProjectId: id }),

      darkMode: window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true,
      toggleDarkMode: () => {
        const next = !get().darkMode
        set({ darkMode: next })
        document.documentElement.classList.toggle('dark', next)
        document.documentElement.classList.toggle('light', !next)
      },

      sidebarCollapsed: false,
      toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      searchOpen: false,
      setSearchOpen: (open) => set({ searchOpen: open }),

      language: 'en',
      setLanguage: (lang) => set({ language: lang }),

      lastSaved: null,
      setLastSaved: (d) => set({ lastSaved: d }),

      undoStack: [],
      redoStack: [],
      pushUndo: (state) => set(s => ({ undoStack: [...s.undoStack.slice(-49), state], redoStack: [] })),
      undo: () => {
        const { undoStack, redoStack } = get()
        if (undoStack.length === 0) return null
        const state = undoStack[undoStack.length - 1]
        set({ undoStack: undoStack.slice(0, -1), redoStack: [...redoStack, state] })
        return state
      },
      redo: () => {
        const { redoStack, undoStack } = get()
        if (redoStack.length === 0) return null
        const state = redoStack[redoStack.length - 1]
        set({ redoStack: redoStack.slice(0, -1), undoStack: [...undoStack, state] })
        return state
      },
    }),
    {
      name: 'cutsheet-ui',
      partialize: (s) => ({ activeProjectId: s.activeProjectId, darkMode: s.darkMode, sidebarCollapsed: s.sidebarCollapsed, language: s.language }),
    }
  )
)
