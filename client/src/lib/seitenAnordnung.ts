import { create } from 'zustand'

/**
 * Welche Seite gerade Abschnitte zum Anordnen anbietet und ob sie gerade
 * angeordnet wird. Die Seite meldet sich über `SeitenBloecke` an, die
 * Kopfleiste zeigt danach ihren Schalter - so steht er überall an derselben
 * Stelle, ohne dass jede Seite ihn selbst einbaut.
 */
type Zustand = {
  seite: string | null
  anordnen: boolean
  anmelden: (seite: string) => void
  abmelden: (seite: string) => void
  setAnordnen: (an: boolean) => void
}

export const useSeitenAnordnung = create<Zustand>((set, get) => ({
  seite: null,
  anordnen: false,
  anmelden: seite => set({ seite, anordnen: false }),
  // Nur die eigene Anmeldung zurücknehmen, falls die nächste Seite schneller war
  abmelden: seite => { if (get().seite === seite) set({ seite: null, anordnen: false }) },
  setAnordnen: anordnen => set({ anordnen }),
}))
