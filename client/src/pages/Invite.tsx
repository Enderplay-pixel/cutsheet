import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Film, CheckCircle2, AlertCircle, Loader2, LogIn, UserPlus } from 'lucide-react'
import { AppIcon } from '@/components/shared/BrandMark'
import { cn } from '@/lib/utils'

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin:     { label: 'Admin',             color: 'text-red-500' },
  producer:  { label: 'Produzent',         color: 'text-amber-500' },
  director:  { label: 'Regisseur',         color: 'text-blue-500' },
  dept_head: { label: 'Abteilungsleitung', color: 'text-purple-500' },
  read_only: { label: 'Lesezugriff',       color: 'text-muted-foreground' },
}

export function Component() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { user, login, register } = useAuth()

  const [invite, setInvite]       = useState<any>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)
  const [accepted, setAccepted]   = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [acceptError, setAcceptError] = useState<string | null>(null)

  const [mode, setMode]         = useState<'login' | 'register'>('register')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [name, setName]         = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)

  // Load invite info (public endpoint — no auth needed)
  useEffect(() => {
    if (!token) return
    fetch(`/api/invites/${token}`)
      .then(r => r.json())
      .then(({ data, error }) => { if (error) setLoadError(error); else setInvite(data) })
      .catch(() => setLoadError('Netzwerkfehler'))
      .finally(() => setLoading(false))
  }, [token])

  // Accept invite
  const accept = async () => {
    if (!token) return
    setAccepting(true)
    setAcceptError(null)
    try {
      const r = await fetch(`/api/invites/${token}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
      const { data, error } = await r.json()
      if (error) throw new Error(error)
      setAccepted(true)
      setTimeout(() => navigate(`/projects/${data.project_id}`), 2500)
    } catch (e: any) {
      setAcceptError(e.message)
    } finally {
      setAccepting(false)
    }
  }

  // Auto-accept once user is logged in and invite is loaded
  useEffect(() => {
    if (user && invite && !accepted && !accepting) accept()
  }, [user?.id, invite?.id])

  // Auth form submit
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError(null)
    setAuthLoading(true)
    try {
      if (mode === 'login') await login(email, password)
      else await register(email, password, name)
      // accept() fires automatically via useEffect above
    } catch (e: any) {
      setAuthError(e.message)
    } finally {
      setAuthLoading(false)
    }
  }

  const role = invite ? ROLE_LABELS[invite.role] : null

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-4">

        {/* Logo */}
        <div className="flex flex-col items-center mb-2">
          <AppIcon className="w-14 h-14 mb-4" />
          <h1 className="font-display text-[28px] sm:text-[34px]">CutSheet</h1>
        </div>

        {/* Loading */}
        {loading && (
          <div className="bg-card border border-border/60 rounded-xl p-8 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Einladungslink wird geprüft…</p>
          </div>
        )}

        {/* Error loading invite */}
        {!loading && loadError && (
          <div className="bg-card border border-destructive/40 rounded-xl p-6 text-center space-y-2">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
            <p className="font-medium">Ungültiger Link</p>
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <Button variant="outline" className="mt-2" onClick={() => navigate('/')}>
              Zur Startseite
            </Button>
          </div>
        )}

        {/* Accepted! */}
        {accepted && invite && (
          <div className="bg-card border border-green-500/40 rounded-xl p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <p className="text-lg font-semibold">Willkommen im Projekt!</p>
            <p className="text-sm text-muted-foreground">
              Du bist jetzt <span className={cn('font-semibold', role?.color)}>{role?.label}</span> in
              <span className="font-semibold text-foreground"> „{invite.project_title}"</span>
            </p>
            <p className="text-xs text-muted-foreground animate-pulse">Leite weiter…</p>
          </div>
        )}

        {/* Invite info + action */}
        {!loading && !loadError && !accepted && invite && (
          <>
            {/* Project info card */}
            <div className="bg-card border border-border/60 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <Film className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Du wurdest eingeladen zu</p>
                  <p className="font-semibold leading-tight">{invite.project_title}</p>
                  {invite.label && <p className="text-xs text-muted-foreground mt-0.5 italic">„{invite.label}"</p>}
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-xs text-muted-foreground">Rolle:</span>
                    <span className={cn('text-xs font-semibold', role?.color)}>{role?.label}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* If already logged in → accept button */}
            {user && (
              <div className="bg-card border border-border/60 rounded-xl p-5 space-y-3">
                <p className="text-sm">
                  Angemeldet als <span className="font-semibold">{user.name || user.email}</span>
                </p>
                {acceptError && (
                  <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{acceptError}</p>
                )}
                <Button onClick={accept} disabled={accepting} className="w-full">
                  {accepting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Projekt beitreten
                </Button>
              </div>
            )}

            {/* If not logged in → login/register form */}
            {!user && (
              <div className="bg-card border border-border/60 rounded-xl p-5">
                <p className="text-sm text-muted-foreground mb-4">
                  Melde dich an oder erstelle ein Konto, um dem Projekt beizutreten.
                </p>

                {/* Mode toggle */}
                <div className="flex rounded-lg bg-muted p-1 mb-4">
                  <button
                    type="button"
                    onClick={() => { setMode('register'); setAuthError(null) }}
                    className={cn(
                      'flex-1 text-xs py-1.5 rounded-md font-medium transition-colors flex items-center justify-center gap-1.5',
                      mode === 'register' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <UserPlus className="w-3 h-3" /> Registrieren
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setAuthError(null) }}
                    className={cn(
                      'flex-1 text-xs py-1.5 rounded-md font-medium transition-colors flex items-center justify-center gap-1.5',
                      mode === 'login' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <LogIn className="w-3 h-3" /> Anmelden
                  </button>
                </div>

                <form onSubmit={handleAuth} className="space-y-3">
                  {mode === 'register' && (
                    <Input placeholder="Name" value={name} onChange={e => setName(e.target.value)} required />
                  )}
                  <Input type="email" placeholder="E-Mail" value={email} onChange={e => setEmail(e.target.value)} required />
                  <Input
                    type="password"
                    placeholder="Passwort"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                  {authError && (
                    <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{authError}</p>
                  )}
                  <Button type="submit" className="w-full" disabled={authLoading}>
                    {authLoading
                      ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      : mode === 'login' ? <LogIn className="w-4 h-4 mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />
                    }
                    {mode === 'login' ? 'Anmelden & Beitreten' : 'Registrieren & Beitreten'}
                  </Button>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
