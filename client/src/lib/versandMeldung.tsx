import { useQuery } from '@tanstack/react-query'
import { ToastAction } from '@/components/ui/toast'
import { api } from '@/lib/api'

type Toast = (eingabe: any) => unknown

/**
 * Was nach einem Versand mit Link gemeldet wird - Besetzungsanfrage, Vertrag,
 * Abnahme.
 *
 * Ohne Mailserver legt der Server die Mail in den Postausgang, schickt sie
 * aber nie ab. Bis zum 09.11.2026 stand dann trotzdem "Verschickt" auf dem
 * Bildschirm (Testbericht SALZWIND: Besetzungsanfrage "Verschickt",
 * Postausgang "nicht versendet (SMTP_HOST fehlt)"). Jetzt sagt die Meldung,
 * was geschehen ist, und bietet den Link an - er gilt genauso wie die Mail.
 */
export function versandMelden(toast: Toast, ergebnis: { an?: string; link?: string; mailserver?: boolean }) {
  if (ergebnis.mailserver === false) {
    const link = ergebnis.link
    toast({
      title: 'Nicht per Mail verschickt',
      description: link
        ? 'Es ist kein Mailserver eingerichtet. Gib den Link selbst weiter - er gilt genauso wie die Mail.'
        : 'Es ist kein Mailserver eingerichtet. Die Mail liegt im Postausgang.',
      duration: 30_000,
      action: link ? (
        <ToastAction altText="Link kopieren" onClick={() => { void navigator.clipboard?.writeText(link) }}>
          Link kopieren
        </ToastAction>
      ) : undefined,
    })
    return
  }
  toast({ title: 'Verschickt', description: ergebnis.an ? `An ${ergebnis.an}` : undefined })
}

/**
 * Ist ein Mailserver eingerichtet? `undefined`, solange es niemand weiß.
 * Ohne ihn heißt "versendet" nur: Der Link ist aktiv - die Listen sagen das so.
 */
export function useMailserver(pid: number): boolean | undefined {
  const { data } = useQuery({
    queryKey: ['email-status', pid],
    queryFn: () => api.emailSend.status(pid),
    enabled: !!pid,
    staleTime: 5 * 60_000,
  })
  return data?.configured
}
