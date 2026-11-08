import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { useProjectStore } from '@/store/useProjectStore'
import { usePushSubscription } from '@/hooks/usePushSubscription'
import { useT, useGebietsschema } from '@/lib/useT'
import { settingsT, LANGS, type Lang } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Moon, Sun, Check, KeyRound, User, Globe, Palette, Bell, ShieldCheck, Download, Trash2, LayoutGrid, RotateCcw, HelpCircle } from 'lucide-react'
import { useGeseheneEinfuehrungen } from '@/lib/einfuehrung'
import { einfuehrungT } from '@/lib/texte/Einfuehrung'
import { ArbeitsplatzEditor } from '@/components/arbeitsplatz/Arbeitsplatz'
import { useArbeitsplatz } from '@/lib/einstellungen'
import { istStandard, standardAnordnung, type ArbeitsplatzArt } from '@/lib/bereiche'
import { arbeitsplatzT } from '@/lib/texte/Arbeitsplatz'

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
    if (newPw.length < 8) {
      toast({ title: tt(settingsT.passwordShort), variant: 'destructive' })
      return
    }
    passwordMutation.mutate()
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      {/* Page title */}
      <div>
        <h1 className="font-display text-[28px] sm:text-[34px]">{tt(settingsT.title)}</h1>
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

      {/* ── Zweiter Faktor und Geraete ── */}
      <Sicherheitsabschnitt />

      {/* ── Language ── */}
      <Section icon={Globe} title={tt(settingsT.language)} description={tt(settingsT.languageDesc)}>
        <div className="flex gap-2">
          {LANGS.map(l => (
            <button
              key={l.code}
              type="button"
              onClick={() => setLanguage(l.code as Lang)}
              aria-pressed={language === l.code}
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
            aria-pressed={!darkMode}
            className={cn(
              'flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all',
              !darkMode ? 'border-primary bg-primary/8 text-foreground font-medium' : 'border-border/60 text-muted-foreground hover:border-border hover:bg-muted/40'
            )}
          >
            <Sun className="w-3.5 h-3.5" />
            {tt(settingsT.hell)}
          </button>
          <button
            type="button"
            onClick={() => { if (!darkMode) toggleDarkMode() }}
            aria-pressed={darkMode}
            className={cn(
              'flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all',
              darkMode ? 'border-primary bg-primary/8 text-foreground font-medium' : 'border-border/60 text-muted-foreground hover:border-border hover:bg-muted/40'
            )}
          >
            <Moon className="w-3.5 h-3.5" />
            {tt(settingsT.dunkel)}
          </button>
        </div>
      </Section>

      {/* ── Arbeitsplatz ── */}
      <ArbeitsplatzSection />

      {/* ── Einführungen ── */}
      <EinfuehrungenSection />

      {/* ── Benachrichtigungen ── */}
      <PushSection />

      {/* ── Datenschutz & Konto ── */}
      <PrivacySection />
    </div>
  )
}

// ─── Arbeitsplatz ─────────────────────────────────────────────────────────────

/** Dieselbe Anordnung wie auf der Projektseite, je Projektart. */
function ArbeitsplatzSection() {
  const tt = useT()
  const [art, setArt] = useState<ArbeitsplatzArt>('film')
  const platz = useArbeitsplatz(art)
  return (
    <Section icon={LayoutGrid} title={tt(arbeitsplatzT.einstellungen)} description={tt(arbeitsplatzT.einstellungenText)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(['film', 'creator'] as const).map(a => (
            <button
              key={a}
              type="button"
              onClick={() => setArt(a)}
              aria-pressed={art === a}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all',
                art === a ? 'border-primary bg-primary/8 text-foreground font-medium' : 'border-border/60 text-muted-foreground hover:border-border hover:bg-muted/40'
              )}
            >
              {tt(a === 'film' ? arbeitsplatzT.artFilm : arbeitsplatzT.artCreator)}
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          disabled={istStandard(art, platz.anordnung)}
          onClick={() => platz.setzen(standardAnordnung(art))}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {tt(arbeitsplatzT.standard)}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{tt(arbeitsplatzT.einrichtungText)}</p>
      {platz.bereit && (
        <ArbeitsplatzEditor
          key={art}
          art={art}
          anordnung={platz.anordnung}
          onChange={platz.setzen}
          className="sm:grid-cols-2 lg:grid-cols-2 2xl:grid-cols-2"
        />
      )}
    </Section>
  )
}

// ─── Einführungen ─────────────────────────────────────────────────────────────

function EinfuehrungenSection() {
  const tt = useT()
  const { toast } = useToast()
  const { wert, setzen } = useGeseheneEinfuehrungen()
  const gesehen = (wert ?? []).length
  return (
    <Section icon={HelpCircle} title={tt(einfuehrungT.einstellungen)} description={tt(einfuehrungT.einstellungenText)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground tabular-nums">
          {tt(einfuehrungT.gesehen).replace('{n}', String(gesehen))}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          disabled={gesehen === 0}
          onClick={async () => { await setzen([]); toast({ title: tt(einfuehrungT.erneutFertig) }) }}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {tt(einfuehrungT.erneut)}
        </Button>
      </div>
    </Section>
  )
}

// ─── Push-Benachrichtigungen ──────────────────────────────────────────────────

function PushSection() {
  const { state, subscribe, unsubscribe } = usePushSubscription()
  const { toast } = useToast()
  const tt = useT()

  // Server ohne VAPID-Keys oder Browser ohne Support: Sektion ausblenden
  if (state === 'unavailable' || state === 'unsupported' || state === 'loading') return null

  return (
    <Section icon={Bell} title={tt(settingsT.pushTitel)} description={tt(settingsT.pushBeschreibung)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{tt(settingsT.pushName)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {state === 'subscribed'
              ? tt(settingsT.pushAktiv)
              : state === 'denied'
                ? tt(settingsT.pushBlockiert)
                : tt(settingsT.pushAngebot)}
          </p>
        </div>
        <button
          type="button"
          disabled={state === 'denied'}
          onClick={async () => {
            const ok = state === 'subscribed' ? await unsubscribe() : await subscribe()
            if (!ok && state !== 'subscribed') {
              toast({ variant: 'destructive', title: tt(settingsT.pushFehler) })
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
          <span className="sr-only">{tt(settingsT.pushName)}</span>
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
  const tt = useT()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePw, setDeletePw] = useState('')

  const handleExport = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(api.authExtra.exportUrl(), { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(tt(settingsT.exportFehler))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'cutsheet-datenexport.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      toast({ variant: 'destructive', title: e.message || tt(settingsT.exportFehler) })
    }
  }

  const deleteMutation = useMutation({
    mutationFn: () => api.authExtra.deleteAccount(deletePw),
    onSuccess: () => {
      logout()
      navigate('/login')
    },
    onError: (e: any) => toast({ variant: 'destructive', title: tt(settingsT.loeschenFehler), description: e.message }),
  })

  return (
    <Section icon={ShieldCheck} title={tt(settingsT.datenschutz)} description={tt(settingsT.datenschutzText)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{tt(settingsT.exportTitel)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{tt(settingsT.exportText)}</p>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleExport}>
          <Download className="w-3.5 h-3.5" /> {tt(settingsT.exportKnopf)}
        </Button>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border/40">
        <div>
          <p className="text-sm font-medium text-destructive">{tt(settingsT.kontoLoeschen)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{tt(settingsT.kontoLoeschenText)}</p>
        </div>
        <Button variant="destructive" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="w-3.5 h-3.5" /> {tt(settingsT.loeschen)}
        </Button>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{tt(settingsT.loeschenTitel)}</DialogTitle>
            <DialogDescription>{tt(settingsT.loeschenText)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs">{tt(settingsT.passwortBestaetigung)}</Label>
            <Input
              type="password"
              value={deletePw}
              onChange={e => setDeletePw(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>{tt(settingsT.abbrechen)}</Button>
            <Button
              variant="destructive"
              disabled={!deletePw || deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? tt(settingsT.wirdGeloescht) : tt(settingsT.endgueltig)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  )
}


/**
 * Zweiter Faktor, angemeldete Geräte und Anmeldeverlauf.
 *
 * Ein Passwort allein schützt die Gagen, Telefonnummern und Drehorte einer
 * ganzen Produktion. Wer will, hängt ein Gerät davor - und sieht hier, wo er
 * überall angemeldet ist.
 */
function Sicherheitsabschnitt() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const tt = useT()
  const gs = useGebietsschema()
  const [einrichtung, setEinrichtung] = useState<{ schluessel: string; url: string } | null>(null)
  const [code, setCode] = useState('')
  const [codes, setCodes] = useState<string[] | null>(null)
  const [ausPasswort, setAusPasswort] = useState('')

  const { data: stand } = useQuery({ queryKey: ['2fa'], queryFn: () => api.authExtra.zweiterFaktor() })
  const { data: sitzungen } = useQuery({ queryKey: ['sitzungen'], queryFn: () => api.authExtra.sitzungen() })
  const { data: verlauf } = useQuery({ queryKey: ['anmeldeverlauf'], queryFn: () => api.authExtra.anmeldeverlauf() })

  const einrichten = useMutation({
    mutationFn: () => api.authExtra.zweiterFaktorEinrichten(),
    onSuccess: (daten: any) => setEinrichtung(daten),
    onError: (fehler: any) => toast({ title: tt(settingsT.zfNichtEingerichtet), description: fehler.message, variant: 'destructive' }),
  })

  const bestaetigen = useMutation({
    mutationFn: () => api.authExtra.zweiterFaktorBestaetigen(code),
    onSuccess: (daten: any) => {
      setCodes(daten.wiederherstellungscodes)
      setEinrichtung(null)
      setCode('')
      qc.invalidateQueries({ queryKey: ['2fa'] })
      toast({ title: tt(settingsT.zfIstAktiv) })
    },
    onError: (fehler: any) => toast({ title: tt(settingsT.zfCodeFalsch), description: fehler.message, variant: 'destructive' }),
  })

  const abschalten = useMutation({
    mutationFn: () => api.authExtra.zweiterFaktorAus(ausPasswort),
    onSuccess: () => {
      setAusPasswort('')
      qc.invalidateQueries({ queryKey: ['2fa'] })
      toast({ title: tt(settingsT.zfAbgeschaltet) })
    },
    onError: (fehler: any) => toast({ title: tt(settingsT.zfNichtAbgeschaltet), description: fehler.message, variant: 'destructive' }),
  })

  const beenden = useMutation({
    mutationFn: (sid: string) => api.authExtra.sitzungBeenden(sid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sitzungen'] })
      toast({ title: tt(settingsT.abgemeldet) })
    },
  })

  const andereBeenden = useMutation({
    mutationFn: () => api.authExtra.andereBeenden(),
    onSuccess: (daten: any) => {
      qc.invalidateQueries({ queryKey: ['sitzungen'] })
      toast({ title: tt(settingsT.andereBeendet).replace('{n}', String(daten.beendet)) })
    },
  })

  const geraet = (text: string) => {
    const t = String(text || '')
    if (/iPhone|iPad/i.test(t)) return tt(settingsT.geraet.iphone)
    if (/Android/i.test(t)) return tt(settingsT.geraet.android)
    if (/Macintosh|Mac OS/i.test(t)) return tt(settingsT.geraet.mac)
    if (/Windows/i.test(t)) return tt(settingsT.geraet.windows)
    if (/Linux/i.test(t)) return tt(settingsT.geraet.linux)
    return t.slice(0, 40) || tt(settingsT.geraet.unbekannt)
  }

  const zeitpunkt = (wert: string) =>
    wert ? new Date(wert).toLocaleString(gs, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <Section
      icon={ShieldCheck}
      title={tt(settingsT.zfTitel)}
      description={tt(settingsT.zfText)}
    >
      <div className="space-y-5">
        <div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">
                {stand?.aktiv ? tt(settingsT.zfAktiv) : tt(settingsT.zfNicht)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {stand?.aktiv
                  ? tt(settingsT.zfCodesUebrig).replace('{n}', String(stand.codes_uebrig))
                  : tt(settingsT.zfApp)}
              </p>
            </div>
            {!stand?.aktiv && !einrichtung && (
              <Button size="sm" className="h-8 text-xs" onClick={() => einrichten.mutate()}>
                {tt(settingsT.zfEinrichten)}
              </Button>
            )}
          </div>

          {einrichtung && (
            <div className="mt-3 space-y-3 rounded-lg border border-border/60 p-3">
              <p className="text-xs text-muted-foreground">{tt(settingsT.zfSchluessel)}</p>
              <code className="block text-sm font-mono tracking-wider break-all bg-muted/40 rounded px-2 py-1.5">
                {einrichtung.schluessel}
              </code>
              <a href={einrichtung.url} className="text-xs text-primary underline">
                {tt(settingsT.zfInApp)}
              </a>
              <div className="space-y-1.5">
                <Label className="text-xs">{tt(settingsT.zfCode)}</Label>
                <Input value={code} onChange={e => setCode(e.target.value)} inputMode="numeric"
                  placeholder="123456" className="h-9 text-sm tracking-widest font-mono" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="h-8 text-xs" disabled={code.length < 6}
                  onClick={() => bestaetigen.mutate()}>
                  {tt(settingsT.zfScharf)}
                </Button>
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setEinrichtung(null)}>
                  {tt(settingsT.abbrechen)}
                </Button>
              </div>
            </div>
          )}

          {codes && (
            <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
              <p className="text-sm font-medium">{tt(settingsT.zfCodesTitel)}</p>
              <p className="text-xs text-muted-foreground">{tt(settingsT.zfCodesText)}</p>
              <div className="grid grid-cols-2 gap-1 font-mono text-sm">
                {codes.map(c => <span key={c}>{c}</span>)}
              </div>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setCodes(null)}>
                {tt(settingsT.zfNotiert)}
              </Button>
            </div>
          )}

          {stand?.aktiv && (
            <div className="mt-3 flex gap-2 items-end">
              <div className="space-y-1.5 flex-1 max-w-xs">
                <Label className="text-xs">{tt(settingsT.zfAusPasswort)}</Label>
                <Input type="password" value={ausPasswort} onChange={e => setAusPasswort(e.target.value)}
                  className="h-9 text-sm" autoComplete="current-password" />
              </div>
              <Button variant="ghost" size="sm" className="h-9 text-xs text-destructive"
                disabled={!ausPasswort} onClick={() => abschalten.mutate()}>
                {tt(settingsT.zfAbschalten)}
              </Button>
            </div>
          )}
        </div>

        <div className="border-t border-border/40 pt-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-sm font-medium">{tt(settingsT.geraete)}</p>
            {(sitzungen || []).length > 1 && (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => andereBeenden.mutate()}>
                {tt(settingsT.andereAbmelden)}
              </Button>
            )}
          </div>
          <div className="space-y-1">
            {(sitzungen || []).map((s: any) => (
              <div key={s.id} className="flex items-center gap-3 py-1.5 border-b border-border/40 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">
                    {geraet(s.device)}
                    {s.diese && <span className="text-xs text-muted-foreground ml-2">{tt(settingsT.diesesGeraet)}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tt(settingsT.zuletzt).replace('{zeit}', zeitpunkt(s.last_seen))}{s.ip ? ` · ${s.ip}` : ''}
                  </p>
                </div>
                {!s.diese && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive"
                    onClick={() => beenden.mutate(s.id)}>
                    {tt(settingsT.abmelden)}
                  </Button>
                )}
              </div>
            ))}
            {(sitzungen || []).length === 0 && (
              <p className="text-xs text-muted-foreground py-2">{tt(settingsT.keineSitzungen)}</p>
            )}
          </div>
        </div>

        {(verlauf || []).length > 0 && (
          <div className="border-t border-border/40 pt-4">
            <p className="text-sm font-medium mb-2">{tt(settingsT.letzteAnmeldungen)}</p>
            <div className="space-y-0.5">
              {(verlauf || []).slice(0, 8).map((e: any, i: number) => (
                <div key={i} className="flex items-center gap-3 text-xs py-1">
                  <span className={e.result === 'ok' ? 'text-muted-foreground' : 'text-amber-600 dark:text-amber-400'}>
                    {settingsT.ergebnis[e.result] ? tt(settingsT.ergebnis[e.result]) : e.result}
                  </span>
                  <span className="text-muted-foreground">{zeitpunkt(e.created_at)}</span>
                  <span className="text-muted-foreground truncate">{geraet(e.device)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  )
}
