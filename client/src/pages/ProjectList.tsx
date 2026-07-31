import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Film, Copy, ArrowRight, Clapperboard, Trash2, Archive, ArchiveRestore, Youtube, Smartphone, Mic, Radio } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { OnboardingWizard } from '@/components/OnboardingWizard'
import { useT } from '@/lib/useT'
import { projectsT, uiT } from '@/lib/i18n'

const STATUS_META: Record<string, { text: string; bg: string; border: string; dot: string }> = {
  'Entwicklung':    { text: 'text-zinc-400',   bg: 'bg-zinc-400/8',   border: 'border-l-zinc-500/60',   dot: 'bg-zinc-400' },
  'Vorproduktion':  { text: 'text-blue-400',   bg: 'bg-blue-400/8',   border: 'border-l-blue-500/60',   dot: 'bg-blue-400' },
  'Produktion':     { text: 'text-amber-400',  bg: 'bg-amber-400/8',  border: 'border-l-amber-500/60',  dot: 'bg-amber-400' },
  'Postproduktion': { text: 'text-violet-400', bg: 'bg-violet-400/8', border: 'border-l-violet-500/60', dot: 'bg-violet-400' },
  'Abgeschlossen':  { text: 'text-green-400',  bg: 'bg-green-400/8',  border: 'border-l-green-500/60',  dot: 'bg-green-400' },
}
const DEFAULT_META = { text: 'text-muted-foreground', bg: 'bg-muted/40', border: 'border-l-border', dot: 'bg-muted-foreground' }

/**
 * Formate. Die Creator-Formate legen ein Projekt der Art 'creator' an — dort
 * gibt es Videos, Skript-Abschnitte und ein Upload-Paket statt Drehplan,
 * Tagesdispo und Callsheets. Die Zuordnung trifft der Server anhand des
 * Formats (CREATOR_FORMATS in routes/projects.ts).
 */
const FORMATS = [
  'Kurzfilm', 'Spielfilm', 'Dokumentation', 'Serie', 'Werbefilm', 'Imagefilm',
  'YouTube-Video', 'YouTube Shorts', 'Reel / TikTok', 'Podcast', 'Stream / Live',
]

/**
 * Icon je Projektart. Film und Content sehen in der Liste sonst gleich aus,
 * obwohl dahinter voellig verschiedene Arbeitsweisen stecken — und wer beides
 * macht, sucht sonst in einer gemischten Liste.
 */
function projectIcon(project: any) {
  if (project?.project_kind !== 'creator') return Film
  switch (project.format) {
    case 'YouTube Shorts':
    case 'Reel / TikTok': return Smartphone
    case 'Podcast': return Mic
    case 'Stream / Live': return Radio
    default: return Youtube
  }
}

const CREATOR_FORMATS = ['YouTube-Video', 'YouTube Shorts', 'Reel / TikTok', 'Podcast', 'Stream / Live']

function NewProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ title: '', genre: '', format: 'Kurzfilm', director: '', producer: '' })
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { toast } = useToast()
  const tt = useT()

  const createMutation = useMutation({
    mutationFn: (data: any) => api.projects.create(data),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast({ title: 'Projekt erstellt' })
      // Creator-Projekte starten bei den Videos — das Film-Dashboard zeigt
      // Drehtage und Dispo, die es dort nicht gibt.
      const isCreator = (project as any)?.project_kind === 'creator' || CREATOR_FORMATS.includes(form.format)
      navigate(isCreator ? `/projects/${project.id}/creator` : `/projects/${project.id}`)
      onClose()
    },
    onError: () => toast({ title: 'Fehler beim Erstellen', variant: 'destructive' }),
  })

  const f = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{tt(projectsT.modalTitle)}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs text-muted-foreground">{tt(projectsT.labelTitle)}</Label>
            <Input value={form.title} onChange={e => f('title', e.target.value)}
              placeholder="Mein Film" className="mt-1 h-10 text-base font-medium" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">{tt(projectsT.labelGenre)}</Label>
              <Input value={form.genre} onChange={e => f('genre', e.target.value)} placeholder="Drama" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{tt(projectsT.labelFormat)}</Label>
              <Select value={form.format} onValueChange={v => f('format', v)}>
                <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMATS.map(v =>
                    <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Regie</Label>
              <Input value={form.director} onChange={e => f('director', e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Produzent/in</Label>
              <Input value={form.producer} onChange={e => f('producer', e.target.value)} className="mt-1" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={() => createMutation.mutate(form)} disabled={!form.title || createMutation.isPending}>
            {createMutation.isPending ? tt(projectsT.creating) : tt(uiT.create)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function Component() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const tt = useT()
  const [showNew, setShowNew] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects', showArchived],
    queryFn: () => api.projects.list(showArchived),
  })

  const duplicateMutation = useMutation({
    mutationFn: (id: number) => api.projects.duplicate(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); toast({ title: 'Projekt dupliziert' }) },
  })

  const archiveMutation = useMutation({
    mutationFn: ({ id, archived }: { id: number; archived: boolean }) => api.projects.archive(id, archived),
    onSuccess: (_, { archived }) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast({ title: archived ? tt(projectsT.archivedToast) : tt(projectsT.restoredToast) })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.projects.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); toast({ title: 'Projekt gelöscht' }) },
    onError: () => toast({ title: 'Fehler beim Löschen', variant: 'destructive' }),
  })

  return (
    <div className="min-h-screen bg-background">
      {/* Top glow */}
      <div className="fixed top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent pointer-events-none" />

      <div className="max-w-4xl mx-auto px-8 py-14">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-primary rounded-xl flex items-center justify-center shadow-[0_0_24px_hsl(0_72%_51%/0.35)] shrink-0">
              <Clapperboard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight leading-none">CutSheet</h1>
              <p className="text-xs text-muted-foreground/70 mt-1 tracking-wide">Film Production Management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={cn(
                'flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border font-medium',
                'transition-[background-color,border-color,color] duration-150 active:scale-[0.97]',
                showArchived
                  ? 'border-primary/40 bg-primary/8 text-primary'
                  : 'border-border/60 text-muted-foreground hover:bg-foreground/4 hover:border-border'
              )}
            >
              <Archive className="w-3.5 h-3.5" />
              {showArchived ? tt(projectsT.hideArchive) : tt(projectsT.showArchive)}
            </button>
            <Button onClick={() => setShowNew(true)} size="sm" className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />{tt(projectsT.newProject)}
            </Button>
          </div>
        </div>

        {/* Section label */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/40">
            {showArchived ? tt(projectsT.archived) : tt(projectsT.title)}
          </span>
          {projects && projects.length > 0 && (
            <span className="text-[11px] text-muted-foreground/50 tabular-nums">
              {projects.length} Projekt{projects.length !== 1 ? 'e' : ''}
            </span>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-[72px] rounded-xl" />)}
          </div>
        ) : !projects || projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center animate-fade-up">
            <div className="w-20 h-20 rounded-2xl bg-card border border-border/60 flex items-center justify-center mb-6">
              <Film className="w-9 h-9 text-muted-foreground/25" />
            </div>
            <h2 className="text-lg font-bold tracking-tight mb-2">{tt(projectsT.empty)}</h2>
            <p className="text-sm text-muted-foreground mb-7 max-w-xs leading-relaxed">
              Erstelle dein erstes Filmprojekt, um loszulegen.
            </p>
            <Button onClick={() => setShowNew(true)} className="gap-2">
              <Plus className="w-4 h-4" />{tt(projectsT.createFirst)}
            </Button>
          </div>
        ) : (
          <div className="space-y-2 stagger">
            {(projects || []).map((project: any) => {
              const meta = STATUS_META[project.status] || DEFAULT_META
              return (
                <div
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className={cn(
                    'group flex items-center gap-4 px-5 py-4 bg-card rounded-xl cursor-pointer',
                    'border border-l-[3px] border-border/60',
                    'transition-[transform,box-shadow,border-color,background-color] duration-200',
                    'hover:-translate-y-[1px] hover:shadow-[0_4px_20px_hsl(0_0%_0%/0.3)] hover:border-border',
                    meta.border,
                  )}
                >
                  {/* Status dot + icon */}
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', meta.bg)}>
                    {(() => {
                      const Icon = projectIcon(project)
                      return <Icon className={cn('w-4 h-4', meta.text)} />
                    })()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-0.5">
                      <span className="text-sm font-semibold truncate group-hover:text-primary transition-colors duration-150">
                        {project.title}
                      </span>
                      <span className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 border',
                        meta.text, meta.bg,
                        'border-current/20'
                      )}>
                        {project.status}
                      </span>
                      {project.is_demo && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 bg-info/15 text-info border border-info/25"
                          title="Demo-Projekt zum Ausprobieren — kann jederzeit gelöscht werden"
                        >
                          Demo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground/70 truncate">
                      {[project.format, project.genre,
                        project.length_minutes ? `${project.length_minutes} Min.` : null,
                        project.director ? `Regie: ${project.director}` : null]
                        .filter(Boolean).join(' · ')}
                    </p>
                  </div>

                  {/* Date range */}
                  <div className="text-right shrink-0 hidden sm:block">
                    {project.shoot_start && (
                      <p className="text-xs text-muted-foreground/60 tabular-nums">
                        {formatDate(project.shoot_start)}
                        {project.shoot_end ? ` – ${formatDate(project.shoot_end)}` : ''}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    {!showArchived && (
                      <button
                        onClick={e => { e.stopPropagation(); duplicateMutation.mutate(project.id) }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-foreground/6 transition-[background-color,color] duration-150"
                        title="Duplizieren"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); archiveMutation.mutate({ id: project.id, archived: !showArchived }) }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-amber-400 hover:bg-amber-400/10 transition-[background-color,color] duration-150"
                      title={showArchived ? tt(projectsT.restore) : tt(projectsT.archive)}
                    >
                      {showArchived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        if (confirm(`„${project.title}" wirklich löschen?`)) {
                          deleteMutation.mutate(project.id)
                        }
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-[background-color,color] duration-150"
                      title="Projekt löschen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground/20 group-hover:text-primary transition-colors duration-150 shrink-0">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <NewProjectDialog open={showNew} onClose={() => setShowNew(false)} />
      <OnboardingWizard />
    </div>
  )
}
