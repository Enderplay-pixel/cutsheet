import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { useProjectStore } from '@/store/useProjectStore'
import { usePushSubscription } from '@/hooks/usePushSubscription'
import { useT } from '@/lib/useT'
import { settingsT, LANGS, type Lang } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Moon, Sun, Check, KeyRound, User, Globe, Palette, Bell, ShieldCheck, Download, Trash2 } from 'lucide-react'

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border/40 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <div className="px-5 py-5 space-y-4">{children}</div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Component() {
  const { user, updateUser } = useAuth()
  const { language, setLanguage, darkMode, toggleDarkMode } = useProjectStore()
  const { toast } = useToast()
  const tt = useT()
  const queryClient = useQueryClient()

  // Profile state
  const [name, setName] = useState(user?.name ?? '')

  // Password state
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')

  // ─── Profile mutation ───────────────────────────────────────────────────────

  const profileMutation = useMutation({
    mutationFn: () => api.auth.updateMe({ name }),
    onSuccess: (updated: any) => {
      updateUser?.({ name: updated.name, email: updated.email })
      toast({ title: tt(settingsT.profileSaved) })
    },
    onError: (err: any) => toast({ title: err.message || tt(settingsT.title), variant: 'destructive' }),
  })

  // ─── Password mutation ──────────────────────────────────────────────────────

  const passwordMutation = useMutation({
    mutationFn: () => api.auth.changePassword({ current_password: currentPw, new_password: newPw }),
    onSuccess: () => {
      toast({ title: tt(settingsT.passwordChanged) })
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
    },
    onError: (err: any) => toast({ title: err.message || tt(settingsT.security), variant: 'destructive' }),
  })

  function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    if (newPw !== confirmPw) {
      toast({ title: tt(settingsT.passwordMismatch), variant: 'destructive' })
      return
    }
    if (newPw.length < 6) {
      toast({ title: tt(settingsT.passwordShort), variant: 'destructive' })
      return
    }
    passwordMutation.mutate()
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">{tt(settingsT.title)}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{user?.email}</p>
      </div>

      {/* ── Account ── */}
      <Section icon={User} title={tt(settingsT.account)} description={tt(settingsT.accountDesc)}>
        <div className="space-y-1.5">
          <Label className="text-xs">{tt(settingsT.name)}</Label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={tt(settingsT.name)}
            className="h-9 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{tt(settingsT.email)}</Label>
          <Input
            value={user?.email ?? ''}
            readOnly
            disabled
            className="h-9 text-sm opacity-60"
          />
          <p className="text-[11px] text-muted-foreground">{tt(settingsT.emailNote)}</p>
        </div>

        <Button
          size="sm"
          className="h-8 text-xs"
          onClick={() => profileMutation.mutate()}
          disabled={profileMutation.isPending || name === user?.name}
        >
          {profileMutation.isPending ? tt(settingsT.saveProfile) + '…' : tt(settingsT.saveProfile)}
        </Button>
      </Section>

      {/* ── Security ── */}
      <Section icon={KeyRound} title={tt(settingsT.security)} description={tt(settingsT.securityDesc)}>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{tt(settingsT.currentPassword)}</Label>
            <Input
              type="password"
              value={currentPw}
              onChange={e => setCurrentPw(e.target.value)}
              className="h-9 text-sm"
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{tt(settingsT.newPassword)}</Label>
            <Input
              type="password"
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              className="h-9 text-sm"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{tt(settingsT.confirmPassword)}</Label>
            <Input
              type="password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              className="h-9 text-sm"
              autoComplete="new-password"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            className="h-8 text-xs"
            disabled={passwordMutation.isPending || !currentPw || !newPw || !confirmPw}
          >
            {passwordMutation.isPending ? tt(settingsT.changePassword) + '…' : tt(settingsT.changePassword)}
          </Button>
        </form>
      </Section>

      {/* ── Language ── */}
      <Section icon={Globe} title={tt(settingsT.language)} description={tt(settingsT.languageDesc)}>
        <div className="flex gap-2">
          {LANGS.map(l => (
            <button
              key={l.code}
              type="button"
              onClick={() => setLanguage(l.code as Lang)}
              className={cn(
                'flex-1 flex flex-col items-center gap-1.5 py-3 rounded-lg border transition-all text-sm',
                language === l.code
                  ? 'border-primary bg-primary/8 text-foreground font-medium shadow-sm'
                  : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground hover:bg-muted/40'
              )}
            >
              <span className="text-2xl leading-none">{l.flag}</span>
              <span className="text-xs leading-none">{l.label}</span>
              {l.teilweise && (
                <span className="text-[10px] leading-none text-muted-foreground/70">
                  {tt(settingsT.languagePartial)}
                </span>
              )}
              {language === l.code && (
                <span className="w-4 h-4 rounded-full bg-primary flex items-center justify-center mt-0.5">
                  <Check className="w-2.5 h-2.5 text-primary-foreground" />
                </span>
              )}
            </button>
          ))}
        </div>
      </Section>

      {/* ── Appearance ── */}
      <Section icon={Palette} title={tt(settingsT.appearance)} description={tt(settingsT.appearanceDesc)}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{tt(settingsT.darkMode)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{tt(settingsT.darkModeDesc)}</p>
          </div>
          <button
            type="button"
            onClick={toggleDarkMode}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              darkMode ? 'bg-primary' : 'bg-muted-foreground/30'
            )}
            role="switch"
            aria-checked={darkMode}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
                darkMode ? 'translate-x-6' : 'translate-x-1'
              )}
            />
            <span className="sr-only">{tt(settingsT.darkMode)}</span>
          </button>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => { if (darkMode) toggleDarkMode() }}
            className={cn(
              'flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all',
              !darkMode ? 'border-primary bg-primary/8 text-foreground font-medium' : 'border-border/60 text-muted-foreground hover:border-border hover:bg-muted/40'
            )}
          >
            <Sun className="w-3.5 h-3.5" />
            Light
          </button>
          <button
            type="button"
            onClick={() => { if (!darkMode) toggleDarkMode() }}
            className={cn(
              'flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all',
              darkMode ? 'border-primary bg-primary/8 text-foreground font-medium' : 'border-border/60 text-muted-foreground hover:border-border hover:bg-muted/40'
            )}
          >
            <Moon className="w-3.5 h-3.5" />
            Dark
          </button>
        </div>
      </Section>

      {/* ── Benachrichtigungen ── */}
      <PushSection />

      {/* ── Datenschutz & Konto ── */}
      <PrivacySection />
    </div>
  )
}

// ─── Push-Benachrichtigungen ──────────────────────────────────────────────────

function PushSection() {
  const { state, subscribe, unsubscribe } = usePushSubscription()
  const { toast } = useToast()

  // Server ohne VAPID-Keys oder Browser ohne Support: Sektion ausblenden
  if (state === 'unavailable' || state === 'unsupported' || state === 'loading') return null

  return (
    <Section icon={Bell} title="Benachrichtigungen" description="Push-Nachrichten bei Dispo-Versand und Zeitänderungen">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Push-Benachrichtigungen</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {state === 'subscribed'
              ? 'Aktiv auf diesem Gerät'
              : state === 'denied'
                ? 'Im Browser blockiert - bitte in den Browser-Einstellungen erlauben'
                : 'Erhalte sofort Bescheid, wenn sich Drehzeiten ändern'}
          </p>
        </div>
        <button
          type="button"
          disabled={state === 'denied'}
          onClick={async () => {
            const ok = state === 'subscribed' ? await unsubscribe() : await subscribe()
            if (!ok && state !== 'subscribed') {
              toast({ variant: 'destructive', title: 'Aktivierung fehlgeschlagen' })
            }
          }}
          className={cn(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40',
            state === 'subscribed' ? 'bg-primary' : 'bg-muted-foreground/30'
          )}
          role="switch"
          aria-checked={state === 'subscribed'}
        >
          <span className={cn(
            'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
            state === 'subscribed' ? 'translate-x-6' : 'translate-x-1'
          )} />
          <span className="sr-only">Push-Benachrichtigungen</span>
        </button>
      </div>
    </Section>
  )
}

// ─── Datenschutz & Konto (DSGVO) ─────────────────────────────────────────────

function PrivacySection() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePw, setDeletePw] = useState('')

  const handleExport = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(api.authExtra.exportUrl(), { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Export fehlgeschlagen')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'cutsheet-datenexport.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      toast({ variant: 'destructive', title: e.message || 'Export fehlgeschlagen' })
    }
  }

  const deleteMutation = useMutation({
    mutationFn: () => api.authExtra.deleteAccount(deletePw),
    onSuccess: () => {
      logout()
      navigate('/login')
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Löschen fehlgeschlagen', description: e.message }),
  })

  return (
    <Section icon={ShieldCheck} title="Datenschutz & Konto" description="Deine Daten gehören dir - Export und Löschung jederzeit">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Daten exportieren</p>
          <p className="text-xs text-muted-foreground mt-0.5">Alle deine personenbezogenen Daten als JSON (DSGVO Art. 20)</p>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleExport}>
          <Download className="w-3.5 h-3.5" /> Export
        </Button>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border/40">
        <div>
          <p className="text-sm font-medium text-destructive">Konto löschen</p>
          <p className="text-xs text-muted-foreground mt-0.5">Unwiderruflich - eigene Solo-Projekte werden mitgelöscht</p>
        </div>
        <Button variant="destructive" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="w-3.5 h-3.5" /> Löschen
        </Button>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Konto unwiderruflich löschen?</DialogTitle>
            <DialogDescription>
              Deine Solo-Projekte werden gelöscht. Besitzt du Projekte mit weiteren
              Mitgliedern, musst du diese zuerst übergeben oder löschen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs">Passwort zur Bestätigung</Label>
            <Input
              type="password"
              value={deletePw}
              onChange={e => setDeletePw(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Abbrechen</Button>
            <Button
              variant="destructive"
              disabled={!deletePw || deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? 'Wird gelöscht…' : 'Endgültig löschen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  )
}
