import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Clapperboard, Film, Users, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LANGS, loginT, t, type Lang } from '@/lib/i18n'
import { useProjectStore } from '@/store/useProjectStore'

const FEATURES = [
  { icon: Film,     label: 'Drehplan',  desc: 'Shooting schedule' },
  { icon: Users,    label: 'Crew',      desc: 'Team management'   },
  { icon: Calendar, label: 'Budget',    desc: 'Finance tracking'  },
]

export function Component() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { login, register } = useAuth()
  const { language, setLanguage } = useProjectStore()
  const navigate = useNavigate()
  const lang = language

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
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel — cinematic ─────────────────────── */}
      <div className="hidden lg:flex flex-col items-center justify-center flex-1 bg-[hsl(0_0%_3%)] relative overflow-hidden select-none">
        {/* Red glow at bottom */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_110%,hsl(0_72%_51%/0.18),transparent_65%)]" />
        {/* Horizontal film-strip lines */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 59px,hsl(0_0%_100%) 60px)',
          }}
        />
        {/* Vertical edge fade */}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(0_0%_3%)_0%,transparent_15%,transparent_85%,hsl(0_0%_3%)_100%)]" />

        <div className="relative z-10 text-center max-w-xs px-6">
          <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-[0_0_48px_hsl(0_72%_51%/0.45)]">
            <Clapperboard className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">CutSheet</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t(loginT.tagline, lang)}
          </p>

          <div className="mt-10 grid grid-cols-3 gap-3">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="p-3 rounded-xl border border-white/6 bg-white/3">
                <Icon className="w-4 h-4 text-primary mx-auto mb-2" />
                <div className="text-xs font-semibold">{label}</div>
                <div className="text-[10px] text-muted-foreground/70 mt-0.5">{desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom wordmark */}
        <p className="absolute bottom-6 text-[11px] text-muted-foreground/30 tracking-widest uppercase">
          Film Production Management
        </p>
      </div>

      {/* ── Right panel — form ─────────────────────────── */}
      <div className="flex flex-col items-center justify-center flex-1 bg-background px-8 py-12 relative">
        {/* Subtle top glow */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        <div className="w-full max-w-sm">
          {/* Mobile-only logo */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center shadow-[0_0_24px_hsl(0_72%_51%/0.35)] mb-4">
              <Clapperboard className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">CutSheet</h1>
          </div>

          {/* Heading */}
          <div className="mb-7">
            <h2 className="text-2xl font-bold tracking-tight">
              {mode === 'login' ? t(loginT.tabLogin, lang) : t(loginT.tabRegister, lang)}
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5">
              {mode === 'login'
                ? 'Melde dich in deinem Workspace an.'
                : 'Erstelle deinen Account, um loszulegen.'}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex rounded-lg bg-muted/60 border border-border/60 p-1 mb-6 gap-1">
            {(['login', 'register'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null) }}
                className={cn(
                  'flex-1 text-sm py-1.5 rounded-md font-medium transition-[background-color,color,box-shadow] duration-150 active:scale-[0.97]',
                  mode === m
                    ? 'bg-background text-foreground shadow-sm border border-border/60'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {m === 'login' ? t(loginT.tabLogin, lang) : t(loginT.tabRegister, lang)}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.06em]">
                  {t(loginT.labelName, lang)}
                </label>
                <Input
                  type="text"
                  placeholder={t(loginT.placeholderName, lang)}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.06em]">
                {t(loginT.labelEmail, lang)}
              </label>
              <Input
                type="email"
                placeholder={t(loginT.placeholderEmail, lang)}
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.06em]">
                {t(loginT.labelPassword, lang)}
              </label>
              <Input
                type="password"
                placeholder={t(loginT.placeholderPw, lang)}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            {/* Language picker — register only */}
            {mode === 'register' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.06em]">
                  {t(loginT.labelLanguage, lang)}
                </label>
                <div className="flex gap-2">
                  {LANGS.map(l => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => setLanguage(l.code as Lang)}
                      className={cn(
                        'flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs font-medium',
                        'transition-[background-color,border-color,color] duration-150 active:scale-[0.97]',
                        language === l.code
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground hover:bg-foreground/4'
                      )}
                    >
                      <span className="text-xl leading-none">{l.flag}</span>
                      <span>{l.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-destructive/8 border border-destructive/20 px-3.5 py-2.5 text-sm text-destructive font-medium">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-10 text-sm font-semibold" disabled={loading}>
              {loading
                ? (mode === 'login' ? t(loginT.btnLoginLoading, lang) : t(loginT.btnRegisterLoading, lang))
                : (mode === 'login' ? t(loginT.tabLogin, lang) : t(loginT.btnRegister, lang))}
            </Button>
          </form>

          <p className="text-center text-[11px] text-muted-foreground/40 mt-8 tracking-wide">
            CutSheet · Film Production Management
          </p>
        </div>
      </div>
    </div>
  )
}
