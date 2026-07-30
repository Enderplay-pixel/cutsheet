import { useToast } from '@/components/ui/use-toast'
import { useT } from '@/lib/useT'
import { uiT } from '@/lib/i18n'

/**
 * Liest den Dateinamen aus dem Content-Disposition-Header.
 * Unterstützt sowohl filename="…" als auch das RFC-5987-Format filename*=UTF-8''…
 */
function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null

  const utf8 = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header)
  if (utf8?.[1]) {
    try { return decodeURIComponent(utf8[1].trim().replace(/^"|"$/g, '')) } catch { /* fällt unten durch */ }
  }

  const plain = /filename="?([^";]+)"?/i.exec(header)
  return plain?.[1]?.trim() || null
}

/**
 * Lädt eine geschützte Server-Datei (PDF, CSV, ICS …) herunter.
 *
 * Ein `<a href>` kann keinen Authorization-Header mitschicken — deshalb liefen
 * alle Export-Links in ein "Nicht authentifiziert" des Servers. Wir holen die
 * Datei per fetch mit Token und geben sie als Blob-URL an den Browser weiter.
 */
export function useDownload() {
  const { toast } = useToast()
  const tt = useT()

  return async function download(url: string, fallbackName?: string): Promise<void> {
    let objectUrl: string | null = null
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })

      if (!res.ok) {
        // Server antwortet im Fehlerfall mit JSON { data, error }
        let message = `HTTP ${res.status}`
        try {
          const body = await res.json()
          if (body?.error) message = String(body.error)
        } catch { /* keine JSON-Antwort — Statuscode genügt */ }
        throw new Error(message)
      }

      const blob = await res.blob()
      const name = filenameFromDisposition(res.headers.get('content-disposition'))
        || fallbackName
        || 'download'

      objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')

      if ('download' in a) {
        // Chrome, Firefox, Edge, Safari ab 14: Blob direkt speichern.
        // Der Anker muss im DOM hängen, sonst ignoriert Firefox den Klick.
        a.href = objectUrl
        a.download = name
        a.rel = 'noopener'
        document.body.appendChild(a)
        a.click()
        a.remove()
      } else {
        // Sehr alte Safari-/iOS-Versionen kennen kein download-Attribut.
        // Dort bleibt nur: im neuen Tab öffnen und den Nutzer speichern lassen.
        const win = window.open(objectUrl, '_blank')
        if (!win) throw new Error('Der Browser hat das Öffnen des Downloads blockiert.')
      }
    } catch (err: any) {
      toast({
        title: tt(uiT.downloadFailed),
        description: err?.message || String(err),
        variant: 'destructive',
      })
    } finally {
      // Erst freigeben, wenn der Browser den Download übernommen hat
      if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl!), 60_000)
    }
  }
}
