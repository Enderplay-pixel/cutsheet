import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { track } from '@/lib/analytics'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Clapperboard, Film, Users, CheckCircle, FileUp, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const TOTAL_STEPS = 5

interface FormData {
  title: string
  genre: string
  format: string
  director: string
  producer: string
  dop: string
}

interface StepIndicatorProps {
  current: number
}

function StepIndicator({ current }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-all duration-300',
            i < current
              ? 'w-6 bg-primary'
              : i === current
                ? 'w-8 bg-primary'
                : 'w-4 bg-muted'
          )}
        />
      ))}
    </div>
  )
}

// ─── Step 1: Willkommen ───────────────────────────────────────────────────────
function StepWillkommen({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <div className="text-center py-4">
      <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
        <Clapperboard className="w-8 h-8 text-primary" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight mb-2">Willkommen bei CutSheet</h2>
      <p className="text-muted-foreground text-sm max-w-xs mx-auto mb-2">
        Die Filmproduktions-Management-App für professionelle Produktionen.
      </p>
      <p className="text-muted-foreground/70 text-sm mb-8">
        Lass uns dein erstes Projekt anlegen.
      </p>
      <Button onClick={onNext} className="w-full">
        Los geht's
      </Button>
      <button
        onClick={onSkip}
        className="mt-4 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
      >
        Überspringen
      </button>
    </div>
  )
}

// ─── Step 2: Projekt ─────────────────────────────────────────────────────────
function StepProjekt({
  data,
  onChange,
  onNext,
  onBack,
}: {
  data: FormData
  onChange: (key: keyof FormData, val: string) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
          <Film className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Projektdetails</h2>
          <p className="text-xs text-muted-foreground">Wie heißt dein Film?</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-xs text-muted-foreground">Titel *</Label>
          <Input
            value={data.title}
            onChange={e => onChange('title', e.target.value)}
            placeholder="Mein Film"
            className="mt-1 h-9"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Genre</Label>
            <Select value={data.genre} onValueChange={v => onChange('genre', v)}>
              <SelectTrigger className="mt-1 h-8 text-xs">
                <SelectValue placeholder="Genre wählen" />
              </SelectTrigger>
              <SelectContent>
                {['Spielfilm', 'Dokumentation', 'Kurzfilm', 'Serie', 'Werbefilm'].map(g => (
                  <SelectItem key={g} value={g} className="text-xs">{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Format</Label>
            <Input
              value={data.format}
              onChange={e => onChange('format', e.target.value)}
              placeholder="z.B. 4K, 16mm"
              className="mt-1 h-8 text-xs"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-6">
        <Button variant="outline" onClick={onBack} className="flex-1">Zurück</Button>
        <Button onClick={onNext} disabled={!data.title.trim()} className="flex-1">Weiter</Button>
      </div>
    </div>
  )
}

// ─── Step 3: Team ────────────────────────────────────────────────────────────
function StepTeam({
  data,
  onChange,
  onNext,
  onBack,
}: {
  data: FormData
  onChange: (key: keyof FormData, val: string) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
          <Users className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Dein Team</h2>
          <p className="text-xs text-muted-foreground">Wer steckt hinter dem Projekt?</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-xs text-muted-foreground">Regisseur/in</Label>
          <Input
            value={data.director}
            onChange={e => onChange('director', e.target.value)}
            placeholder="Name der Regie"
            className="mt-1 h-8"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Produzent/in</Label>
          <Input
            value={data.producer}
            onChange={e => onChange('producer', e.target.value)}
            placeholder="Name des Produzenten"
            className="mt-1 h-8"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">DOP (Director of Photography)</Label>
          <Input
            value={data.dop}
            onChange={e => onChange('dop', e.target.value)}
            placeholder="Name des DOP"
            className="mt-1 h-8"
          />
        </div>
      </div>

      <div className="flex gap-2 mt-6">
        <Button variant="outline" onClick={onBack} className="flex-1">Zurück</Button>
        <Button onClick={onNext} className="flex-1">Projekt erstellen</Button>
      </div>
    </div>
  )
}

// ─── Step 4: Drehbuch importieren — der Aha-Moment ──────────────────────────
function StepDrehbuch({ projectId, onDone, onSkip }: {
  projectId: number
  onDone: (result: { scenes_created: number; blocks_created: number }) => void
  onSkip: () => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text()
      return api.screenplayIO.fdxImport(projectId, text, file.name)
    },
    onSuccess: (result, file) => {
      track('screenplay_imported', { scenes_created: result.scenes_created, source: file.name.split('.').pop() })
      onDone(result)
    },
    onError: (e: any) => setError(e.message || 'Import fehlgeschlagen'),
  })

  const handleFile = (file: File | undefined | null) => {
    if (!file) return
    setError(null)
    importMutation.mutate(file)
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
          <FileUp className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Drehbuch importieren</h2>
          <p className="text-xs text-muted-foreground">Final Draft, Celtx oder Fountain — Szenen entstehen automatisch.</p>
        </div>
      </div>

      {importMutation.isPending ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Loader2 className="w-7 h-7 text-primary animate-spin mb-3" />
          <p className="text-sm font-medium">Drehbuch wird analysiert…</p>
          <p className="text-xs text-muted-foreground mt-1">Szenen, Motive und Figuren werden extrahiert.</p>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]) }}
            className={cn(
              'w-full flex flex-col items-center justify-center gap-2 py-10 rounded-xl border-2 border-dashed',
              'transition-[border-color,background-color] duration-150 cursor-pointer',
              dragging
                ? 'border-primary bg-primary/8'
                : 'border-border hover:border-primary/50 hover:bg-primary/4'
            )}
          >
            <FileUp className={cn('w-7 h-7', dragging ? 'text-primary' : 'text-muted-foreground/50')} />
            <p className="text-sm font-medium">Datei hierher ziehen oder klicken</p>
            <p className="text-[11px] text-muted-foreground">.fdx · .celtx · .fountain · .txt</p>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".fdx,.fountain,.txt,.celtx,.xml"
            className="hidden"
            onChange={e => handleFile(e.target.files?.[0])}
          />
          {error && (
            <div className="mt-3 rounded-lg bg-destructive/8 border border-destructive/20 px-3 py-2 text-[13px] text-destructive font-medium">
              {error}
            </div>
          )}
          <button
            onClick={onSkip}
            className="mt-5 w-full text-center text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            Überspringen — ich lege Szenen später an
          </button>
        </>
      )}
    </div>
  )
}

// ─── Step 5: Fertig ──────────────────────────────────────────────────────────
function StepFertig({ title, importResult, onGo }: {
  title: string
  importResult: { scenes_created: number; blocks_created: number } | null
  onGo: () => void
}) {
  return (
    <div className="text-center py-4">
      {/* CSS-only confetti */}
      <div className="relative flex justify-center mb-5">
        <div className="confetti-container" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="confetti-piece" style={{ '--i': i } as React.CSSProperties} />
          ))}
        </div>
        <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center z-10">
          <CheckCircle className="w-8 h-8 text-green-400" />
        </div>
      </div>
      <h2 className="text-2xl font-bold tracking-tight mb-2">Dein Projekt ist bereit!</h2>
      <p className="text-muted-foreground text-sm mb-1">
        <span className="font-medium text-foreground">"{title}"</span> wurde erfolgreich angelegt.
      </p>
      {importResult ? (
        <p className="text-sm mb-8">
          <span className="text-success font-semibold">{importResult.scenes_created} Szenen</span>
          <span className="text-muted-foreground"> und </span>
          <span className="text-success font-semibold">{importResult.blocks_created} Absätze</span>
          <span className="text-muted-foreground"> aus deinem Drehbuch importiert.</span>
        </p>
      ) : (
        <p className="text-muted-foreground/70 text-xs mb-8">
          Du kannst jetzt loslegen und Szenen, Team und Drehtage verwalten.
        </p>
      )}
      <Button onClick={onGo} className="w-full">
        {importResult ? 'Zum Drehbuch' : 'Zum Projekt Dashboard'}
      </Button>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function OnboardingWizard() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(() => localStorage.getItem('onboarding_done') !== '1')
  const [step, setStep] = useState(0)
  const [createdProjectId, setCreatedProjectId] = useState<number | null>(null)
  const [importResult, setImportResult] = useState<{ scenes_created: number; blocks_created: number } | null>(null)
  const [form, setForm] = useState<FormData>({
    title: '',
    genre: 'Kurzfilm',
    format: '',
    director: '',
    producer: '',
    dop: '',
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => api.projects.create(data),
    onSuccess: (project) => {
      setCreatedProjectId(project.id)
      setStep(3)
    },
  })

  const handleChange = (key: keyof FormData, val: string) => {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  const handleSkip = () => {
    localStorage.setItem('onboarding_done', '1')
    setOpen(false)
  }

  const handleComplete = () => {
    createMutation.mutate(form)
  }

  const handleGoToDashboard = () => {
    localStorage.setItem('onboarding_done', '1')
    setOpen(false)
    if (createdProjectId) {
      navigate(importResult
        ? `/projects/${createdProjectId}/drehbuch`
        : `/projects/${createdProjectId}`)
    }
  }

  if (!open) return null

  return (
    <>
      <style>{`
        .confetti-container {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
          border-radius: 1rem;
        }
        .confetti-piece {
          position: absolute;
          width: 8px;
          height: 8px;
          top: 50%;
          left: 50%;
          border-radius: 2px;
          animation: confetti-fall 1.2s ease-out forwards;
          animation-delay: calc(var(--i) * 0.06s);
          opacity: 0;
          background-color: hsl(calc(var(--i) * 30) 85% 60%);
          transform-origin: center;
        }
        @keyframes confetti-fall {
          0%   { opacity: 1; transform: translate(0, 0) rotate(0deg) scale(1); }
          100% {
            opacity: 0;
            transform: translate(
              calc((var(--i) - 6) * 22px),
              calc(-1 * (40px + var(--i) * 8px))
            ) rotate(calc(var(--i) * 45deg)) scale(0.5);
          }
        }
      `}</style>
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-md"
          onInteractOutside={e => e.preventDefault()}
          onEscapeKeyDown={e => e.preventDefault()}
        >
          <StepIndicator current={step} />

          {step === 0 && (
            <StepWillkommen
              onNext={() => setStep(1)}
              onSkip={handleSkip}
            />
          )}
          {step === 1 && (
            <StepProjekt
              data={form}
              onChange={handleChange}
              onNext={() => setStep(2)}
              onBack={() => setStep(0)}
            />
          )}
          {step === 2 && (
            <StepTeam
              data={form}
              onChange={handleChange}
              onNext={handleComplete}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && createdProjectId && (
            <StepDrehbuch
              projectId={createdProjectId}
              onDone={result => { setImportResult(result); setStep(4) }}
              onSkip={() => setStep(4)}
            />
          )}
          {step === 4 && (
            <StepFertig
              title={form.title}
              importResult={importResult}
              onGo={handleGoToDashboard}
            />
          )}

          {createMutation.isPending && step === 2 && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-lg">
              <div className="text-sm text-muted-foreground animate-pulse">Projekt wird erstellt…</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
