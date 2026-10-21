import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MailCheck, ArrowLeft } from 'lucide-react'
import { AppIcon } from '@/components/shared/BrandMark'
import { useT } from '@/lib/useT'
import { vergessenT } from '@/lib/texte/ForgotPassword'

export function Component() {
  const tt = useT()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [emailConfigured, setEmailConfigured] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await api.authExtra.forgotPassword(email)
      setEmailConfigured(res.emailConfigured)
      setSent(true)
    } catch (err: any) {
      setError(err.message || tt(vergessenT.fehler))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <AppIcon className="w-14 h-14 mb-5" />
          <h1 className="font-display text-[28px] sm:text-[34px]">{tt(vergessenT.titel)}</h1>
        </div>

        {sent ? (
          <div className="text-center animate-fade-up">
            <div className="w-12 h-12 rounded-full bg-success/10 border border-success/25 flex items-center justify-center mx-auto mb-4">
              <MailCheck className="w-5 h-5 text-success" />
            </div>
            {emailConfigured ? (
              <>
                <p className="text-sm text-foreground font-medium mb-1">{tt(vergessenT.unterwegs)}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {tt(vergessenT.gesendet)}
                </p>
              </>
            ) : (
              <p className="text-sm text-warning leading-relaxed">
                {tt(vergessenT.keinVersand)}
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {tt(vergessenT.hinweis)}
            </p>
            <div className="space-y-1.5">
              <label htmlFor="vergessen-email-0" className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.06em]">{tt(vergessenT.email)}</label>
              <Input id="vergessen-email-0"
                type="email"
                placeholder={tt(vergessenT.emailBeispiel)}
                value={email}
                onChange={e => setEmail(e.target.value)}
                required autoComplete="email" autoFocus
              />
            </div>
            {error && (
              <div className="rounded-lg bg-destructive/8 border border-destructive/20 px-3.5 py-2.5 text-sm text-destructive font-medium">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full h-10 text-sm font-semibold" disabled={loading}>
              {loading ? tt(vergessenT.wirdGesendet) : tt(vergessenT.anfordern)}
            </Button>
          </form>
        )}

        <Link
          to="/login"
          className="mt-8 flex items-center justify-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> {tt(vergessenT.zurueck)}
        </Link>
      </div>
    </div>
  )
}
