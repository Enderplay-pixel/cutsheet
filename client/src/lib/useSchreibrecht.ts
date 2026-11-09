import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

/**
 * Gagen, Kalkulation und Verträge sieht nur die Produktion. Der Server
 * schickt sie den anderen Rollen gar nicht (server/src/lib/gagenschutz.ts);
 * die Oberfläche blendet die Felder aus, statt "0 €" zu zeigen.
 */
export function siehtGagen(rolle: string | undefined | null): boolean {
  return rolle === 'admin' || rolle === 'producer'
}

/**
 * Darf die angemeldete Person in diesem Projekt etwas ändern?
 *
 * Gemessen am 27.09.2026 mit einem Konto, das nur Lesezugriff hat: auf den
 * Stammdaten standen 18 offene Eingabefelder, in der Szenenübersicht war
 * "Neue Szene" anklickbar. Getippt werden konnte überall - erst beim
 * Speichern kam "Fehler beim Speichern". Der Server hat richtig abgewiesen,
 * die Oberfläche hat nur zu spät widersprochen.
 *
 * Die Abfrage teilt sich den Schlüssel mit App.tsx, kostet also keine
 * zusätzliche Runde zum Server.
 */
export function useSchreibrecht(): { darfSchreiben: boolean; rolle: string; siehtGagen: boolean } {
  const { projectId } = useParams()
  const { data } = useQuery({
    queryKey: ['project', Number(projectId)],
    queryFn: () => api.projects.get(Number(projectId)),
    enabled: !!projectId,
  })
  const rolle = (data as any)?.my_role ?? ''
  // Ohne geladenes Projekt nicht sperren: sonst wären die Felder beim ersten
  // Aufbau der Seite kurz tot, obwohl alles erlaubt ist.
  return { darfSchreiben: rolle !== 'read_only', rolle, siehtGagen: siehtGagen(rolle) }
}
