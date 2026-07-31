/**
 * Zugriff auf sicherheitsrelevante Umgebungsvariablen.
 *
 * Hintergrund: Der JWT-Schlüssel hatte einen Platzhalter als Rückfallwert. In
 * der Produktion lief die App damit monatelang, ohne dass es auffiel — wer den
 * Platzhalter kennt, kann sich ein gültiges Token für jede Nutzer-ID ausstellen.
 * Ein stiller Rückfallwert für ein Signaturgeheimnis ist deshalb genau die
 * falsche Voreinstellung: In der Produktion muss der Start scheitern, nicht die
 * Sicherheit.
 */

const DEV_JWT_FALLBACK = 'cutsheet-dev-secret-change-in-production'
const DEV_STATE_FALLBACK = 'cutsheet-dev-state-secret'

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/** Schlüssel für Login-Tokens. In der Produktion ohne Rückfallwert. */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (secret) return secret
  if (isProduction()) {
    throw new Error('JWT_SECRET ist nicht gesetzt. Ohne eigenen Schlüssel dürfen keine Login-Tokens ausgestellt werden.')
  }
  return DEV_JWT_FALLBACK
}

/** Schlüssel für die Signatur des OAuth-State. */
export function getStateSecret(): string {
  const secret = process.env.JWT_SECRET
  if (secret) return secret
  if (isProduction()) {
    throw new Error('JWT_SECRET ist nicht gesetzt. Der OAuth-Rücklauf wäre nicht fälschungssicher.')
  }
  return DEV_STATE_FALLBACK
}

export interface SecretCheck {
  ok: boolean
  problems: string[]
  warnings: string[]
}

/**
 * Prüft die Geheimnisse beim Start.
 *
 * `problems` verhindern den Start in der Produktion, `warnings` nicht — ein
 * fehlender Mailversand ist ärgerlich, ein ratbarer Token-Schlüssel nicht
 * hinnehmbar.
 */
export function checkSecrets(env: NodeJS.ProcessEnv = process.env): SecretCheck {
  const problems: string[] = []
  const warnings: string[] = []
  const prod = env.NODE_ENV === 'production'

  if (!env.JWT_SECRET) {
    const message = 'JWT_SECRET fehlt — Login-Tokens würden mit einem öffentlich bekannten Platzhalter signiert.'
    if (prod) problems.push(message)
    else warnings.push(message + ' (in der Entwicklung wird ein Rückfallwert verwendet)')
  } else if (env.JWT_SECRET === DEV_JWT_FALLBACK) {
    problems.push('JWT_SECRET steht auf dem Platzhalter aus dem Quelltext und muss ersetzt werden.')
  } else if (env.JWT_SECRET.length < 24 && prod) {
    problems.push('JWT_SECRET ist zu kurz — mindestens 24 Zeichen verwenden.')
  }

  if (!env.TOKEN_ENCRYPTION_KEY && !env.JWT_SECRET) {
    // In der Entwicklung nur ein Hinweis: Wer die YouTube-Anbindung lokal nicht
    // nutzt, soll deswegen nicht ausgesperrt werden. Beim Verschlüsseln meldet
    // sich der fehlende Schlüssel ohnehin von selbst.
    const message = 'Weder TOKEN_ENCRYPTION_KEY noch JWT_SECRET gesetzt — gespeicherte Fremdtokens ließen sich nicht verschlüsseln.'
    if (prod) problems.push(message)
    else warnings.push(message)
  }

  if (prod && !env.APP_BASE_URL) {
    warnings.push('APP_BASE_URL fehlt — Links in E-Mails und die OAuth-Weiterleitung zeigen auf localhost.')
  }
  if (env.APP_BASE_URL && env.APP_BASE_URL.endsWith('/')) {
    warnings.push('APP_BASE_URL endet auf einem Schrägstrich — das ergibt doppelte Schrägstriche in erzeugten Links.')
  }

  return { ok: problems.length === 0, problems, warnings }
}

/**
 * Beim Start aufrufen. Bricht in der Produktion mit lesbarer Meldung ab, statt
 * mit unsicherer Voreinstellung weiterzulaufen.
 */
export function assertSecrets(): void {
  const { ok, problems, warnings } = checkSecrets()

  for (const w of warnings) console.warn('[Konfiguration] Warnung:', w)

  if (!ok) {
    for (const p of problems) console.error('[Konfiguration] FEHLER:', p)
    if (isProduction()) {
      console.error('[Konfiguration] Start abgebrochen. Die genannten Variablen im Hosting setzen und neu starten.')
      process.exit(1)
    }
  }
}
