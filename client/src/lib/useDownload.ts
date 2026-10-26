import { useEffect, useState } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { useT } from '@/lib/useT'
import { uiT } from '@/lib/i18n'

/** Eine geschützte Adresse mit Token holen - `<img>` und `window.open` schicken keinen Header. */
async function holeMitToken(url: string): Promise<Response> {
  const token = localStorage.getItem('token')
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const body = await res.json()
      if (body?.error) message = String(body.error)
    } catch { /* keine JSON-Antwort - Statuscode genügt */ }
    throw new Error(message)
  }
  return res
}

/**
 * Ein Bild aus der geschützten Dateiablage für `<img src>`.
 *
 * Seit Bilder in der Datenbank liegen (`/api/projects/:id/dateien/:id/inhalt`),
 * lud ein `<img src>` sie ohne Token - gemessen am 25.10.2026: der Grundriss
 * im Setplan kam mit 401 und blieb leer. Andere Adressen (data:, extern)
 * gehen unverändert durch.
 */
export function useGeschuetztesBild(url: string | null | undefined): string | undefined {
  const [quelle, setQuelle] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (!url) { setQuelle(undefined); return }
    if (!url.startsWith('/api/')) { setQuelle(url); return }
    let objektUrl: string | null = null
    let abgebrochen = false
    holeMitToken(url)
      .then((res) => res.blob())
      .then((blob) => {
        if (abgebrochen) return
        objektUrl = URL.createObjectURL(blob)
        setQuelle(objektUrl)
      })
      .catch(() => { if (!abgebrochen) setQuelle(undefined) })
    return () => {
      abgebrochen = true
      if (objektUrl) URL.revokeObjectURL(objektUrl)
    }
  }, [url])
  return quelle
}

/**
 * Eine geschützte Datei im neuen Tab ansehen.
 *
 * Das Fenster öffnet synchron im Klick (sonst greift der Popup-Blocker) und
 * bekommt die Datei, sobald sie geladen ist. Vorher `window.open` auf die
 * Adresse selbst - ohne Token, also "Nicht authentifiziert" im neuen Tab.
 */
export function useAnsehen() {
  const { toast } = useToast()
  const tt = useT()
  return async function ansehen(url: string): Promise<void> {
    const fenster = window.open('', '_blank')
    try {
      const blob = await (await holeMitToken(url)).blob()
      const objektUrl = URL.createObjectURL(blob)
      if (fenster) {
        fenster.opener = null
        fenster.location.href = objektUrl
      } else {
        window.open(objektUrl, '_blank')
      }
      setTimeout(() => URL.revokeObjectURL(objektUrl), 60_000)
    } catch (err: any) {
      fenster?.close()
      toast({ title: tt(uiT.downloadFailed), description: err?.message || String(err), variant: 'destructive' })
    }
  }
}

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
 * Ein `<a href>` kann keinen Authorization-Header mitschicken - deshalb liefen
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
        } catch { /* keine JSON-Antwort - Statuscode genügt */ }
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
