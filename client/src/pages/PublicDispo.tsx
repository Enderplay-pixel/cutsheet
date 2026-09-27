import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { track } from '@/lib/analytics'
import {
  Clapperboard, MapPin, CheckCircle2, Clock, CloudSun, Sunrise, Sunset, UserPlus
} from 'lucide-react'
import { BrandMark } from '@/components/shared/BrandMark'
import { cn } from '@/lib/utils'

const fmtTime = (mins: number | null | undefined) =>
  mins == null ? '—' : `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`

export function Component() {
  const { token } = useParams<{ token: string }>()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['public-dispo', token],
    queryFn: () => api.publicDispo.get(token!),
    enabled: !!token,
    retry: false,
  })

  const confirmMutation = useMutation({
    mutationFn: () => api.publicDispo.confirm(token!),
    onSuccess: () => refetch(),
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-5">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 text-center">
        <Clapperboard className="w-10 h-10 text-muted-foreground/30 mb-4" />
        <h1 className="font-display text-[34px] sm:text-[40px] mb-1">Link ungültig</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          Dieser Dispo-Link existiert nicht oder wurde zurückgezogen. Bitte wende dich an deine Produktionsleitung.
        </p>
      </div>
    )
  }

  const { project, day, sheet, location, me, schedule, has_account } = data
  const confirmed = !!me.confirmed_at
  const dateStr = day.date
    ? new Date(day.date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Header */}
      <header className="border-b border-border bg-card/60">
        <div className="max-w-md mx-auto px-5 h-14 flex items-center gap-2.5">
          <BrandMark className="w-[22px] h-[22px] text-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-tight truncate leading-none">{project.title}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Drehtag {day.day_number} · {dateStr}</p>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-5 pt-6 space-y-4 animate-fade-up">
        {/* Persönliche Call Time — die eine Info, die zählt */}
        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-6 text-center relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at top, hsl(var(--signal)/0.06) 0%, transparent 60%)' }} />
          <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-primary mb-2">
            Deine Call Time{me.name ? ` — ${me.name}` : ''}
          </p>
          <div className="text-6xl font-black tabular-nums tracking-tight leading-none">
            {fmtTime(me.call_time)}
          </div>
          {me.role && <p className="text-sm text-muted-foreground mt-2">{me.role}</p>}
          {me.notes && (
            <p className="text-[13px] text-foreground/80 mt-3 px-3 py-2 rounded-lg bg-background/50 border border-border/50 inline-block">
              {me.notes}
            </p>
          )}

          <div className="mt-5">
            {confirmed ? (
              <div className="flex items-center justify-center gap-2 text-success font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4" /> Zusage bestätigt
              </div>
            ) : (
              <Button
                className="w-full h-11 text-sm font-semibold"
                onClick={() => confirmMutation.mutate()}
                disabled={confirmMutation.isPending}
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                {confirmMutation.isPending ? 'Wird bestätigt…' : 'Zusage bestätigen'}
              </Button>
            )}
          </div>
        </div>

        {/* Ort + Rahmendaten */}
        <div className="rounded-xl border border-border/60 bg-card p-4 space-y-2.5 text-sm">
          {location && (
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-muted-foreground/60 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">{location.name}</p>
                <p className="text-muted-foreground text-[13px]">
                  {[location.address, location.zip, location.city].filter(Boolean).join(', ')}
                </p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-muted-foreground/60 shrink-0" />
            <p className="text-muted-foreground text-[13px]">
              Allgemeiner Call: <span className="text-foreground font-medium tabular-nums">{fmtTime(sheet.general_call)}</span>
              {' · '}Drehbeginn: <span className="text-foreground font-medium tabular-nums">{fmtTime(sheet.shooting_call)}</span>
            </p>
          </div>
          {sheet.weather_forecast && (
            <div className="flex items-center gap-2.5">
              <CloudSun className="w-4 h-4 text-muted-foreground/60 shrink-0" />
              <p className="text-muted-foreground text-[13px]">{sheet.weather_forecast}</p>
            </div>
          )}
          {(sheet.sunrise || sheet.sunset) && (
            <div className="flex items-center gap-4 text-[13px] text-muted-foreground">
              {sheet.sunrise && <span className="flex items-center gap-1.5"><Sunrise className="w-4 h-4 text-muted-foreground/60" /> {sheet.sunrise}</span>}
              {sheet.sunset && <span className="flex items-center gap-1.5"><Sunset className="w-4 h-4 text-muted-foreground/60" /> {sheet.sunset}</span>}
            </div>
          )}
          {sheet.notes && <p className="text-[13px] text-muted-foreground pt-1 border-t border-border/40">{sheet.notes}</p>}
        </div>

        {/* Tagesplan */}
        {schedule?.length > 0 && (
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <p className="px-4 pt-3.5 pb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">
              Tagesplan
            </p>
            <div className="divide-y divide-border/40">
              {schedule.map((s: any, i: number) => (
                <div key={i} className={cn('flex items-center gap-3 px-4 py-2.5', s.is_me && 'bg-primary/6')}>
                  <span className="text-sm font-bold tabular-nums w-12 shrink-0">{fmtTime(s.call_time)}</span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm truncate', s.is_me && 'font-semibold text-primary')}>
                      {s.name}{s.is_me ? ' (du)' : ''}
                    </p>
                    {s.role && <p className="text-[11px] text-muted-foreground truncate">{s.role}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Viral-Hook: One-Click-Account */}
        {!has_account && me.email && <ClaimCard token={token!} project={project} myName={me.name} email={me.email} />}
        {has_account && (
          <p className="text-center text-[13px] text-muted-foreground">
            Du hast bereits ein CutSheet-Konto — <Link to="/login" className="text-primary hover:underline">hier anmelden</Link>, um das ganze Projekt zu sehen.
          </p>
        )}

        <p className="text-center text-[11px] text-muted-foreground/40 pt-4 space-x-3">
          <span>Erstellt mit CutSheet</span>
          <Link to="/impressum" className="hover:text-muted-foreground">Impressum</Link>
          <Link to="/datenschutz" className="hover:text-muted-foreground">Datenschutz</Link>
        </p>
      </main>
    </div>
  )
}

function ClaimCard({ token, project, myName, email }: { token: string; project: any; myName: string; email: string }) {
  const [password, setPassword] = useState('')
  const [name, setName] = useState(myName || '')
  const [error, setError] = useState<string | null>(null)

  const claimMutation = useMutation({
    mutationFn: () => api.publicDispo.claim(token, { password, name }),
    onSuccess: (data) => {
      track('callsheet_claim_account')
      localStorage.setItem('token', data.token)
      // Voller Reload, damit der AuthContext den neuen Token sauber lädt
      window.location.href = `/projects/${data.project_id}`
    },
    onError: (err: any) => setError(err.message || 'Ein Fehler ist aufgetreten'),
  })

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5">
      <div className="flex items-center gap-2 mb-2">
        <UserPlus className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold">Du bist Teil der Crew von „{project.title}"</p>
      </div>
      <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">
        Erstelle dein kostenloses Konto, um Drehplan, Shotlist und Check-in des Projekts zu sehen.
      </p>
      <form
        onSubmit={e => { e.preventDefault(); setError(null); claimMutation.mutate() }}
        className="space-y-3"
      >
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Dein Name" autoComplete="name" />
        <Input value={email} disabled readOnly className="opacity-60" />
        <Input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Passwort wählen (min. 6 Zeichen)"
          minLength={6}
          required
          autoComplete="new-password"
        />
        {error && (
          <div className="rounded-lg bg-destructive/8 border border-destructive/20 px-3 py-2 text-[13px] text-destructive font-medium">
            {error}
          </div>
        )}
        <Button type="submit" className="w-full h-10 text-sm font-semibold" disabled={claimMutation.isPending || password.length < 6}>
          {claimMutation.isPending ? 'Konto wird erstellt…' : 'Konto erstellen & Projekt öffnen'}
        </Button>
      </form>
    </div>
  )
}
