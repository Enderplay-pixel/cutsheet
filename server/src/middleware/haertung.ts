import { Request, Response, NextFunction } from 'express'

/**
 * Grundhaertung: Schutzkoepfe und eine Bremse gegen Passwort-Raten.
 *
 * Gemessen am 23.09.2026: die Anwendung sendete KEINEN einzigen
 * Sicherheitskopf, verriet ueber X-Powered-By ihre Serversoftware, und zehn
 * falsche Passwoerter hintereinander wurden alle gleich schnell und ohne
 * Bremse beantwortet. Mit einem bekannten Testkonto in der Produktion ist das
 * in Minuten durchprobiert.
 *
 * Absichtlich ohne zusaetzliche Pakete: beides ist klein genug, um es selbst
 * zu halten, und eine Abhaengigkeit weniger ist eine Angriffsflaeche weniger.
 */

// ─── Schutzkoepfe ───────────────────────────────────────────────────────────

export function schutzkoepfe(istProduktion: boolean) {
  return function (_req: Request, res: Response, next: NextFunction) {
    // Verraet sonst "Express" an jeden, der eine Antwort ansieht.
    res.removeHeader('X-Powered-By')

    // Browser soll den Inhaltstyp nicht raten. Sonst wird eine hochgeladene
    // Datei, die wie ein Bild deklariert ist, als Skript ausgefuehrt.
    res.setHeader('X-Content-Type-Options', 'nosniff')

    // Kein Einbetten in fremde Seiten - schuetzt vor Clickjacking.
    res.setHeader('X-Frame-Options', 'DENY')

    // Beim Verlassen der Seite nur die Herkunft mitgeben, nicht den ganzen
    // Pfad. Ein Pfad wie /projects/7/gagen gehoert niemanden sonst an.
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

    // Funktionen, die diese Anwendung nie braucht.
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), payment=(), usb=()')

    // HSTS nur ueber HTTPS. Lokal gesetzt wuerde es den Browser zwingen,
    // http://localhost dauerhaft auf https umzuschreiben - und die
    // Entwicklungsumgebung waere unerreichbar, bis man es von Hand loescht.
    if (istProduktion) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    }
    next()
  }
}

// ─── Bremse gegen Raten ─────────────────────────────────────────────────────

type Eintrag = { versuche: number; erster: number; gesperrtBis: number }

/**
 * Zaehler je Schluessel. Im Speicher, weil die Anwendung als ein Prozess
 * laeuft. Bei mehreren Instanzen muesste das in die Datenbank oder einen
 * gemeinsamen Speicher - dann steht es hier.
 */
const zaehler = new Map<string, Eintrag>()

/** Damit der Speicher nicht unbegrenzt waechst. */
function aufraeumen(jetzt: number, fensterMs: number) {
  if (zaehler.size < 5000) return
  for (const [k, e] of zaehler) {
    if (jetzt - e.erster > fensterMs && jetzt > e.gesperrtBis) zaehler.delete(k)
  }
}

export function bremseZuruecksetzen() {
  zaehler.clear()
}

export type BremsenOptionen = {
  /** Wie viele Versuche im Fenster erlaubt sind. */
  grenze: number
  /** Laenge des Fensters in Millisekunden. */
  fensterMs: number
  /** Wie lange gesperrt wird, wenn die Grenze faellt. */
  sperreMs: number
  /** Woran ein Anrufer erkannt wird. Standard: IP. */
  schluessel?: (req: Request) => string
}

/**
 * Zaehlt nur FEHLGESCHLAGENE Versuche. Wer sein Passwort kennt, wird nie
 * gebremst - sonst bestraft die Sperre die Falschen, etwa ein ganzes
 * Filmteam hinter einer gemeinsamen Adresse am Set.
 */
export function bremse(o: BremsenOptionen) {
  const schluesselVon = o.schluessel ?? ((req: Request) =>
    String(req.ip || req.socket?.remoteAddress || 'unbekannt'))

  return function (req: Request, res: Response, next: NextFunction) {
    const jetzt = Date.now()
    const k = schluesselVon(req)
    aufraeumen(jetzt, o.fensterMs)

    const e = zaehler.get(k)
    if (e && jetzt < e.gesperrtBis) {
      const sekunden = Math.ceil((e.gesperrtBis - jetzt) / 1000)
      res.setHeader('Retry-After', String(sekunden))
      return res.status(429).json({
        data: null,
        error: `Zu viele Fehlversuche. Bitte ${sekunden} Sekunden warten.`,
      })
    }

    // Nach der Antwort entscheiden: war es ein Fehlversuch?
    res.on('finish', () => {
      const gescheitert = res.statusCode === 401 || res.statusCode === 403
      const vorhanden = zaehler.get(k)

      if (!gescheitert) {
        // Erfolg loescht die Historie: ein Tippfehler von gestern soll den
        // naechsten Anmeldeversuch nicht belasten.
        if (vorhanden && jetzt >= vorhanden.gesperrtBis) zaehler.delete(k)
        return
      }

      if (!vorhanden || jetzt - vorhanden.erster > o.fensterMs) {
        zaehler.set(k, { versuche: 1, erster: jetzt, gesperrtBis: 0 })
        return
      }
      vorhanden.versuche++
      if (vorhanden.versuche >= o.grenze) {
        vorhanden.gesperrtBis = jetzt + o.sperreMs
        vorhanden.versuche = 0
        vorhanden.erster = jetzt
      }
    })

    next()
  }
}

/**
 * Anmeldung: acht Fehlversuche in zehn Minuten, dann fuenf Minuten Pause.
 *
 * Bewusst nicht haerter. Eine Viertelstunde Sperre haelt einen Angreifer
 * kaum laenger auf als fuenf Minuten - acht Versuche pro Fenster machen jedes
 * Woerterbuch unbrauchbar -, trifft aber jemanden hart, der sich vor Publikum
 * vertippt. Die Sperre soll das Raten verteuern, nicht den Besitzer aussperren.
 *
 * Gegen ein schwaches Passwort hilft sie ohnehin nicht. Das bleibt eine
 * eigene Aufgabe.
 */
export const anmeldeBremse = bremse({
  grenze: 8,
  fensterMs: 10 * 60_000,
  sperreMs: 5 * 60_000,
  // Zusaetzlich nach E-Mail trennen: sonst sperrt ein Angreifer mit
  // Falschversuchen das ganze Set aus, das hinter derselben Adresse sitzt.
  schluessel: (req) => {
    const ip = String(req.ip || req.socket?.remoteAddress || 'unbekannt')
    const mail = String((req.body as any)?.email ?? '').toLowerCase().trim()
    return `${ip}|${mail}`
  },
})
