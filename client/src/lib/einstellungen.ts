/**
 * Persönliche Einstellungen des angemeldeten Kontos (Server: user_einstellungen).
 *
 * Der Abfrageschlüssel enthält die Kontokennung, und beim Abmelden wird der
 * ganze Cache geleert: Meldet sich im selben Browser jemand anderes an, sieht
 * er nie die Anordnung seines Vorgängers.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/components/ui/use-toast'
import { t, type Lang } from '@/lib/i18n'
import { useProjectStore } from '@/store/useProjectStore'
import { arbeitsplatzT } from '@/lib/texte/Arbeitsplatz'
import { useMemo } from 'react'
import {
  arbeitsplatzSchluessel, normalisieren, kategorienAus,
  type Anordnung, type ArbeitsplatzArt,
} from '@/lib/bereiche'

export function useEinstellungen() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['einstellungen', user?.id],
    queryFn: api.einstellungen.alle,
    enabled: !!user,
    // Beim Zurückkehren in den Tab neu holen: Die Anordnung kann inzwischen
    // auf einem anderen Gerät oder in einem anderen Tab geändert worden sein.
    staleTime: 30_000,
  })
}

/**
 * Eine Einstellung lesen und schreiben. Die Anzeige folgt sofort, der Server
 * danach; scheitert das Speichern, springt sie zurück und eine Meldung sagt es.
 */
export function useEinstellung<T>(schluessel: string) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const sprache = useProjectStore(s => s.language) as Lang
  const { data, isSuccess, isLoading } = useEinstellungen()
  const key = ['einstellungen', user?.id]

  async function setzen(wert: T) {
    const vorher = queryClient.getQueryData<Record<string, unknown>>(key)
    const eintragen = () =>
      queryClient.setQueryData<Record<string, unknown>>(key, alt => ({ ...(alt ?? {}), [schluessel]: wert }))
    // Sofort, im selben Takt wie das Ablegen - sonst springt die Karte kurz zurück
    eintragen()
    try {
      await api.einstellungen.setzen(schluessel, wert)
      // Kam inzwischen eine ältere Abfrage zurück, gilt trotzdem das Gespeicherte
      eintragen()
    } catch (e) {
      queryClient.setQueryData(key, vorher)
      toast({
        title: t(arbeitsplatzT.speichernFehler, sprache),
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      })
    }
  }

  return {
    wert: data?.[schluessel] as T | undefined,
    /** Erst nach dem Laden ist klar, ob ein fehlender Wert wirklich fehlt. */
    geladen: isSuccess,
    /** Nichts mehr unterwegs - auch wenn das Laden scheiterte, gilt dann der Standard. */
    bereit: !isLoading,
    setzen,
  }
}

/** Die Anordnung der Bereiche für eine Projektart, schon auf Katalogstand. */
export function useArbeitsplatz(art: ArbeitsplatzArt) {
  const { wert, geladen, bereit, setzen } = useEinstellung<Anordnung>(arbeitsplatzSchluessel(art))
  const anordnung = useMemo(() => normalisieren(art, wert), [art, wert])
  const kategorien = useMemo(() => kategorienAus(art, anordnung), [art, anordnung])
  return {
    anordnung,
    kategorien,
    /** Noch nie eingerichtet: Die Hauptseite bietet dann die Einrichtung an. */
    neu: geladen && wert === undefined,
    bereit,
    setzen,
  }
}
