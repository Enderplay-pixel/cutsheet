import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Clapperboard } from 'lucide-react'

export function Component() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { login, register } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password, name)
      }
      navigate('/', { replace: true })
    } catch (err: any) {
      setError(err.message || 'Ein Fehler ist aufgetreten')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-md mb-4">
            <Clapperboard className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">CutSheet</h1>
          <p className="text-sm text-muted-foreground mt-1">Filmproduktion leicht gemacht</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border/60 rounded-xl p-6 shadow-sm">
          {/* Mode toggle */}
          <div className="flex rounded-lg bg-muted p-1 mb-6">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null) }}
              className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${
                mode === 'login'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Anmelden
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(null) }}
              className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${
                mode === 'register'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Registrieren
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Name</label>
                <Input
                  type="text"
                  placeholder="Vorname Nachname"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">E-Mail</label>
              <Input
                type="email"
                placeholder="name@beispiel.de"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Passwort</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? (mode === 'login' ? 'Anmelden…' : 'Registrieren…')
                : (mode === 'login' ? 'Anmelden' : 'Registrieren')
              }
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
