/**
 * Das Konto aus ADMIN_EMAIL ist dauerhaft Admin.
 *
 * Bis zum 03.11.2026 galt das nur beim Serverstart: Wer sich mit der Adresse
 * registrierte, war bis zum nächsten Neustart normaler Nutzer, und ein
 * anderer Admin konnte das Konto im Panel herabstufen oder löschen. Florian
 * (03.11.2026): seine Adresse ist "perma admin".
 */
export function istDauerAdmin(email: string | null | undefined): boolean {
  const dauer = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return !!dauer && String(email ?? '').trim().toLowerCase() === dauer
}

export const DAUERADMIN_FEHLER = 'Dieses Konto ist über ADMIN_EMAIL dauerhaft Admin'
