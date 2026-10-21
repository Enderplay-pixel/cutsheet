import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { KeyRound } from 'lucide-react'
import { AppIcon } from '@/components/shared/BrandMark'
import { useT } from '@/lib/useT'
import { resetPasswordT as r } from '@/lib/texte/ResetPassword'

export function Component() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const tt = useT()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError(tt(r.nichtGleich))
      return
    }
    setLoading(true)
    try {
      await api.authExtra.resetPassword(token!, password) // texte-ok
      navigate('/login', { replace: true })
    } catch (err: any) {
      setError(err.message || tt(r.fehler))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <AppIcon className="w-14 h-14 mb-5" />
          <h1 className="font-display text-[28px] sm:text-[34px]">{tt(r.titel)}</h1>
          <p className="text-sm text-muted-foreground mt-1.5">{tt(r.untertitel)}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="neues-passwort-0" className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.06em]">{tt(r.neuesPasswort)}</label>
            <Input id="neues-passwort-0"
              type="password"
              placeholder={tt(r.mindestens)}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required minLength={6}
              autoComplete="new-password" autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="neues-passwort-1" className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.06em]">{tt(r.wiederholen)}</label>
            <Input id="neues-passwort-1"
              type="password"
              placeholder="••••••••"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required autoComplete="new-password"
            />
          </div>
          {error && (
            <div className="rounded-lg bg-destructive/8 border border-destructive/20 px-3.5 py-2.5 text-sm text-destructive font-medium">
              {error}
            </div>
          )}
          <Button type="submit" className="w-full h-10 text-sm font-semibold" disabled={loading}>
            <KeyRound className="w-4 h-4 mr-1.5" />
            {loading ? tt(r.speichert) : tt(r.festlegen)}
          </Button>
        </form>

        <p className="text-center mt-8">
          <Link to="/login" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors">
            {tt(r.zurueck)}
          </Link>
        </p>
      </div>
    </div>
  )
}
