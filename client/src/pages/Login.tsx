import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AppIcon } from '@/components/shared/BrandMark'
import { TestversionBadge } from '@/components/shared/TestversionBadge'
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
      <aside className="hidden lg:flex flex-col justify-between flex-1 bg-canvas relative overflow-hidden select-none px-14 py-12">
        <div className="relative flex items-center gap-2.5">
          <AppIcon className="w-8 h-8" />
          <span className="text-[17px] font-semibold tracking-[-0.02em]">CutSheet</span>
          <TestversionBadge />
        </div>

        <div className="relative max-w-[540px]">
          <p className="font-display text-[52px] xl:text-[60px] leading-[1.04]">
            Vom Drehbuch.<br /><span className="text-muted-foreground">Bis zur letzten Klappe.</span>
          </p>
          <p className="text-[17px] text-muted-foreground mt-6 max-w-[42ch] leading-relaxed">
            Drehplan, Dispo, Besetzung und Budget in einem Dokument, das alle am Set lesen können.
          </p>

          {/* Dispo-Auszug */}
          <div className="mt-12 rounded-3xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-2xl animate-fade-up overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <span className="text-[13px] font-semibold">Tagesdispo · Drehtag 4 von 10</span>
              <span className="text-[13px] text-muted-foreground tabular-nums">Sa, 3. Okt.</span>
            </div>
            <dl className="grid grid-cols-3 gap-2 px-4 pb-4 text-[13px]">
              {[
                ['Crew Call', '06:30'],
                ['Drehbeginn', '08:15'],
                ['Sonnenuntergang', '18:52'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-foreground/[0.04] px-4 py-3">
                  <dt className="text-[12px] text-muted-foreground">{k}</dt>
                  <dd className="text-[22px] font-semibold tracking-[-0.02em] tabular-nums mt-0.5">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="border-t border-border/70">
              {[
                ['12', 'Int. Schneideraum – Nacht', '2 ⅛'],
                ['14A', 'Ext. Archiv, Hof – Tag', '⅝'],
              ].map(([sc, set, pg]) => (
                <div key={sc} className="flex items-center gap-4 px-6 py-3 border-b border-border/70 last:border-0 text-[13px]">
                  <span className="w-9 font-semibold tabular-nums">{sc}</span>
                  <span className="flex-1 text-muted-foreground truncate">{set}</span>
                  <span className="tabular-nums text-muted-foreground">{pg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="relative text-[12px] text-muted-foreground">Produktionsmanagement für Film</p>
      </aside>

      {/* ── Rechts: Formular ─────────────────────────────── */}
      <main className="flex flex-col items-center justify-center flex-1 px-6 sm:px-8 py-12">
        <div className="w-full max-w-sm">
          {/* Logo nur am Telefon */}
          <div className="flex items-end gap-2 mb-6 lg:hidden">
            <AppIcon className="w-14 h-14" />
            <TestversionBadge className="mb-1" />
          </div>

          {/* Heading */}
          <div className="mb-7">
            <h1 className="font-display text-[34px]">
              {mode === 'login' ? t(loginT.tabLogin, lang) : t(loginT.tabRegister, lang)}
            </h1>
            <p className="text-[15px] text-muted-foreground mt-1.5">
              {mode === 'login'
                ? 'Melde dich in deinem Workspace an.'
                : 'Erstelle deinen Account, um loszulegen.'}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex rounded-[10px] bg-foreground/[0.06] p-[3px] mb-7 gap-0.5" role="tablist">
            {(['login', 'register'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null) }}
                className={cn(
                  'flex-1 text-[13px] py-1.5 rounded-[8px] font-medium transition-[background-color,color,box-shadow] duration-150 active:scale-[0.98]',
                  mode === m
                    ? 'bg-card text-foreground shadow-[0_1px_3px_hsl(var(--shadow)/0.12)]'
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
                <label className="text-[13px] font-medium text-foreground/80">
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
              <label className="text-[13px] font-medium text-foreground/80">
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
              <label className="text-[13px] font-medium text-foreground/80">
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
                    className="text-[13px] text-primary hover:underline underline-offset-4"
                  >
                    Passwort vergessen?
                  </Link>
                </div>
              )}
            </div>

            {/* Language picker - register only */}
            {mode === 'register' && (
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground/80">
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

          <p className="text-[12px] mt-10 flex gap-4 text-muted-foreground">
            <Link to="/impressum" className="hover:text-foreground transition-colors">Impressum</Link>
            <Link to="/datenschutz" className="hover:text-foreground transition-colors">Datenschutz</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
