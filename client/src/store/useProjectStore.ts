import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Lang } from '@/lib/i18n'

// Entfernt am 27.10.2026, weil nie gelesen oder nie gesetzt: activeProjectId
// (nur geschrieben), lastSaved (nie gesetzt - "Gespeichert HH:MM" in der
// Kopfleiste erschien nie) und ein Rückgängig-Stapel ohne Aufrufer. Am
// 31.10.2026 dazu searchOpen: die Suche führt ihren Zustand in App.tsx.
interface ProjectStore {
  darkMode: boolean
  toggleDarkMode: () => void

  sidebarCollapsed: boolean
  /** Navigations-Schublade am Telefon. Bewusst nicht gespeichert:
   *  beim nächsten Laden soll sie wieder zu sein. */
  mobileNavOpen: boolean
  toggleSidebar: () => void
  setMobileNav: (open: boolean) => void

  language: Lang
  setLanguage: (lang: Lang) => void
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      darkMode: window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true,
      toggleDarkMode: () => {
        const next = !get().darkMode
        set({ darkMode: next })
        document.documentElement.classList.toggle('dark', next)
        document.documentElement.classList.toggle('light', !next)
      },

      sidebarCollapsed: false,
      mobileNavOpen: false,
      toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setMobileNav: (open: boolean) => set({ mobileNavOpen: open }),

      // Deutsch als Voreinstellung: Strings ohne i18n-Eintrag sind deutsch,
      // also ist 'de' die einzige Sprache ohne Mischmasch in der Oberfläche.
      language: 'de',
      setLanguage: (lang) => set({ language: lang }),
    }),
    {
      name: 'cutsheet-ui',
      partialize: (s) => ({ darkMode: s.darkMode, sidebarCollapsed: s.sidebarCollapsed, language: s.language }),
    }
  )
)
