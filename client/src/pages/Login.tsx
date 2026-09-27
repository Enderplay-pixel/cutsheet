import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BrandMark } from '@/components/shared/BrandMark'
import { cn } from '@/lib/utils'
import { LANGS, loginT, t, type Lang } from '@/lib/i18n'
import { useProjectStore } from '@/store/useProjectStore'

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
    <div className="min-h-dvh flex bg-background">

      {/* ── Links: ein Auszug aus einer Tagesdispo, wie gedruckt ── */}
      <aside className="hidden lg:flex flex-col justify-between flex-1 bg-canvas border-r border-border relative overflow-hidden select-none px-14 py-12">
        {/* feine Linierung wie Kontrollpapier */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.5] pointer-events-none"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 31px, hsl(var(--border)) 31px 32px)' }}
        />
        <div className="relative flex items-center gap-2.5">
          <BrandMark className="w-6 h-6 text-foreground" />
          <span className="font-display text-2xl leading-none">CutSheet</span>
        </div>

        <div className="relative max-w-[520px]">
          <p className="font-display text-[64px] xl:text-[76px] leading-[0.98]">
            Vom Drehbuch<br />bis zur <em className="text-signal">letzten Klappe.</em>
          </p>
          <p className="text-[15px] text-muted-foreground mt-6 max-w-[44ch] leading-relaxed">
            {t(loginT.tagline, lang)} — Drehplan, Dispo, Besetzung und Budget in einem Dokument, das alle am Set lesen können.
          </p>

          {/* Dispo-Auszug */}
          <div className="mt-10 rounded-xl border border-border bg-card shadow-lg rotate-[-1.2deg] origin-bottom-left animate-fade-up">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <span className="eyebrow">Tagesdispo · Drehtag 4 / 10</span>
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">Sa 03.10.</span>
            </div>
            <dl className="grid grid-cols-3 divide-x divide-border text-[13px]">
              {[
                ['Crew Call', '06:30'],
                ['Drehbeginn', '08:15'],
                ['Sonnenunterg.', '18:52'],
              ].map(([k, v]) => (
                <div key={k} className="px-5 py-3.5">
                  <dt className="eyebrow">{k}</dt>
                  <dd className="font-mono text-lg tabular-nums mt-1">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="border-t border-border">
              {[
                ['12', 'INT. SCHNEIDERAUM — NACHT', '2 ⅛'],
                ['14A', 'EXT. ARCHIV, HOF — TAG', '⅝'],
              ].map(([sc, set, pg]) => (
                <div key={sc} className="flex items-center gap-4 px-5 py-2.5 border-b border-border last:border-0 text-[12.5px]">
                  <span className="font-mono w-8 tabular-nums">{sc}</span>
                  <span className="flex-1 font-mono uppercase tracking-[0.04em] text-muted-foreground truncate">{set}</span>
                  <span className="font-mono tabular-nums text-muted-foreground">{pg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="relative eyebrow">Produktionsmanagement für Film</p>
      </aside>

      {/* ── Rechts: Formular ─────────────────────────────── */}
      <main className="flex flex-col items-center justify-center flex-1 px-6 sm:px-8 py-12">
        <div className="w-full max-w-sm">
          {/* Logo nur am Telefon */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <BrandMark className="w-6 h-6 text-foreground" />
            <span className="font-display text-2xl leading-none">CutSheet</span>
          </div>

          {/* Heading */}
          <div className="mb-7">
            <h1 className="font-display text-[44px]">
              {mode === 'login' ? t(loginT.tabLogin, lang) : t(loginT.tabRegister, lang)}
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {mode === 'login'
                ? 'Melde dich in deinem Workspace an.'
                : 'Erstelle deinen Account, um loszulegen.'}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex rounded-lg bg-muted border border-border p-0.5 mb-7 gap-0.5" role="tablist">
            {(['login', 'register'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null) }}
                className={cn(
                  'flex-1 text-[13px] py-1.5 rounded-md font-medium transition-[background-color,color,box-shadow] duration-150 active:scale-[0.98]',
                  mode === m
                    ? 'bg-card text-foreground shadow-[0_0_0_1px_hsl(var(--border)),0_1px_2px_hsl(var(--shadow)/0.06)]'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                role="tab"
                aria-selected={mode === m}
              >
                {m === 'login' ? t(loginT.tabLogin, lang) : t(loginT.tabRegister, lang)}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="space-y-1.5">
                <label className="eyebrow">
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
              <label className="eyebrow">
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
              <label className="eyebrow">
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
              {mode === 'login' && (
                <div className="text-right">
                  <Link
                    to="/forgot-password"
                    className="text-[12px] text-muted-foreground underline decoration-transparent underline-offset-4 hover:text-foreground hover:decoration-foreground/40 transition-colors duration-150"
                  >
                    Passwort vergessen?
                  </Link>
                </div>
              )}
            </div>

            {/* Language picker — register only */}
            {mode === 'register' && (
              <div className="space-y-1.5">
                <label className="eyebrow">
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
                          ? 'border-foreground bg-card text-foreground'
                          : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
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
              <div role="alert" className="rounded-md bg-danger/[0.07] border border-danger/25 px-3.5 py-2.5 text-[13px] text-danger">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading
                ? (mode === 'login' ? t(loginT.btnLoginLoading, lang) : t(loginT.btnRegisterLoading, lang))
                : (mode === 'login' ? t(loginT.tabLogin, lang) : t(loginT.btnRegister, lang))}
            </Button>
          </form>

          <p className="text-[11.5px] mt-10 pt-5 border-t border-border flex gap-4 text-muted-foreground">
            <Link to="/impressum" className="hover:text-foreground transition-colors">Impressum</Link>
            <Link to="/datenschutz" className="hover:text-foreground transition-colors">Datenschutz</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
