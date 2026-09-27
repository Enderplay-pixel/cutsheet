import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { ALL_FORMATS, isCreatorFormat, isCreatorProject } from '@/lib/projectKind'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Film, Copy, Trash2, Archive, ArchiveRestore, Youtube, Smartphone, Mic, Radio } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { OnboardingWizard } from '@/components/OnboardingWizard'
import { useT } from '@/lib/useT'
import { projectsT, uiT } from '@/lib/i18n'

// Status als Phase der Produktion: gedämpfte Punkte statt farbiger Kästen
const STATUS_META: Record<string, { text: string; dot: string }> = {
  'Entwicklung':    { text: 'text-muted-foreground', dot: 'bg-muted-foreground/60' },
  'Vorproduktion':  { text: 'text-info',             dot: 'bg-info' },
  'Produktion':     { text: 'text-signal',           dot: 'bg-signal' },
  'Postproduktion': { text: 'text-violet-600 dark:text-violet-300', dot: 'bg-violet-500' },
  'Abgeschlossen':  { text: 'text-success',          dot: 'bg-success' },
}
Object.assign(STATUS_META, {
  'Development': STATUS_META['Entwicklung'],
  'Pre-Production': STATUS_META['Vorproduktion'],
  'Production': STATUS_META['Produktion'],
  'Post-Production': STATUS_META['Postproduktion'],
  'Completed': STATUS_META['Abgeschlossen'],
})
const DEFAULT_META = { text: 'text-muted-foreground', dot: 'bg-muted-foreground/60' }

const FORMATS = ALL_FORMATS

/**
 * Icon je Projektart. Film und Content sehen in der Liste sonst gleich aus,
 * obwohl dahinter voellig verschiedene Arbeitsweisen stecken — und wer beides
 * macht, sucht sonst in einer gemischten Liste.
 */
function projectIcon(project: any) {
  if (!isCreatorProject(project)) return Film
  switch (project.format) {
    case 'YouTube Shorts':
    case 'Reel / TikTok': return Smartphone
    case 'Podcast': return Mic
    case 'Stream / Live': return Radio
    default: return Youtube
  }
}

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
      const isCreator = isCreatorProject(project) || isCreatorFormat(form.format)
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
    <div className="min-h-full bg-background">
      <div className="max-w-5xl mx-auto px-5 sm:px-10 py-10 sm:py-16">
        {/* Kopf */}
        <header className="flex flex-wrap items-end justify-between gap-6 pb-8 border-b border-border animate-fade-up">
          <div>
            <p className="eyebrow">{showArchived ? tt(projectsT.archived) : 'CutSheet · Produktionen'}</p>
            <h1 className="font-display text-[56px] sm:text-[72px] mt-3">
              {showArchived ? 'Archiv' : tt(projectsT.title)}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowArchived(!showArchived)} aria-pressed={showArchived}>
              <Archive className="w-3.5 h-3.5" />
              {showArchived ? tt(projectsT.hideArchive) : tt(projectsT.showArchive)}
            </Button>
            <Button onClick={() => setShowNew(true)}>
              <Plus className="w-4 h-4" />{tt(projectsT.newProject)}
            </Button>
          </div>
        </header>

        {/* Inhalt */}
        {isLoading ? (
          <div className="divide-y divide-border">
            {[1, 2, 3].map(i => (
              <div key={i} className="py-6 flex items-center gap-6">
                <Skeleton className="h-3 w-6" />
                <div className="flex-1 space-y-2"><Skeleton className="h-7 w-1/3" /><Skeleton className="h-3 w-1/4" /></div>
              </div>
            ))}
          </div>
        ) : !projects || projects.length === 0 ? (
          <div className="py-24 grid sm:grid-cols-[minmax(0,1fr)_auto] items-end gap-8 animate-fade-up">
            <div>
              <p className="font-display text-[40px] sm:text-[52px] leading-[1.02] max-w-[16ch]">
                {tt(projectsT.empty)}
              </p>
              <p className="text-[15px] text-muted-foreground mt-4 max-w-[46ch] leading-relaxed">
                Lege ein Projekt an — danach führt dich CutSheet vom Drehbuch über den Drehplan bis zur Tagesdispo.
              </p>
            </div>
            <Button size="lg" onClick={() => setShowNew(true)}>
              <Plus className="w-4 h-4" />{tt(projectsT.createFirst)}
            </Button>
          </div>
        ) : (
          <>
            <div className="hidden sm:grid grid-cols-[40px_minmax(0,1fr)_150px_168px] gap-6 pt-6 pb-3 eyebrow border-b border-border">
              <span>Nr.</span><span>Titel</span><span>Phase</span><span className="text-right">Drehzeitraum</span>
            </div>
            <ul className="divide-y divide-border border-b border-border stagger-sm">
              {(projects || []).map((project: any, idx: number) => {
                const meta = STATUS_META[project.status] || DEFAULT_META
                const Icon = projectIcon(project)
                return (
                  <li key={project.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => navigate(`/projects/${project.id}`)}
                      className="w-full text-left grid grid-cols-[28px_minmax(0,1fr)] sm:grid-cols-[40px_minmax(0,1fr)_150px_168px] items-center gap-x-4 sm:gap-x-6 gap-y-2 py-6 pr-28 sm:pr-0 transition-colors duration-200 hover:bg-foreground/[0.02] -mx-3 px-3 rounded-lg"
                    >
                      <span className="font-mono text-[12px] text-muted-foreground tabular-nums self-start pt-2.5">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2.5">
                          <span className="font-display text-[30px] sm:text-[34px] leading-tight truncate">{project.title}</span>
                          {project.is_demo && (
                            <span className="chip shrink-0" title="Demo-Projekt zum Ausprobieren — kann jederzeit gelöscht werden">Demo</span>
                          )}
                        </span>
                        <span className="mt-1 flex items-center gap-2 text-[12.5px] text-muted-foreground truncate">
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          {[project.format, project.genre,
                            project.length_minutes ? `${project.length_minutes} Min.` : null,
                            project.director ? `Regie: ${project.director}` : null]
                            .filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className={cn('col-start-2 sm:col-start-auto flex items-center gap-2 text-[12.5px]', meta.text)}>
                        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', meta.dot)} />
                        {project.status}
                      </span>
                      <span className="hidden sm:block text-right font-mono text-[12px] text-muted-foreground tabular-nums">
                        {project.shoot_start
                          ? <>{formatDate(project.shoot_start)}{project.shoot_end ? <><br />{formatDate(project.shoot_end)}</> : null}</>
                          : '—'}
                      </span>
                    </button>

                    {/* Aktionen */}
                    <div className="absolute right-0 top-6 sm:top-1/2 sm:-translate-y-1/2 sm:right-[184px] flex items-center gap-0.5 opacity-100 md:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 bg-background/90 rounded-md">
                      {!showArchived && (
                        <Button variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => duplicateMutation.mutate(project.id)} title="Duplizieren" aria-label="Duplizieren">
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => archiveMutation.mutate({ id: project.id, archived: !showArchived })}
                        title={showArchived ? tt(projectsT.restore) : tt(projectsT.archive)}
                        aria-label={showArchived ? tt(projectsT.restore) : tt(projectsT.archive)}>
                        {showArchived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-danger hover:bg-danger/[0.08]"
                        onClick={() => { if (confirm(`„${project.title}" wirklich löschen?`)) deleteMutation.mutate(project.id) }}
                        title="Projekt löschen" aria-label="Projekt löschen">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
            <p className="mt-4 font-mono text-[11px] text-muted-foreground tabular-nums">
              {projects.length} Projekt{projects.length !== 1 ? 'e' : ''}
            </p>
          </>
        )}
      </div>

      <NewProjectDialog open={showNew} onClose={() => setShowNew(false)} />
      <OnboardingWizard />
    </div>
  )
}
