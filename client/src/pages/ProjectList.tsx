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
import { Plus, Film, Copy, ArrowRight, Clapperboard } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  'Entwicklung':    'text-zinc-400 bg-zinc-400/10',
  'Vorproduktion':  'text-blue-400 bg-blue-400/10',
  'Produktion':     'text-amber-400 bg-amber-400/10',
  'Postproduktion': 'text-violet-400 bg-violet-400/10',
  'Abgeschlossen':  'text-green-400 bg-green-400/10',
}

function NewProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ title: '', genre: '', format: 'Kurzfilm', director: '', producer: '' })
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { toast } = useToast()

  const createMutation = useMutation({
    mutationFn: (data: any) => api.projects.create(data),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast({ title: 'Projekt erstellt' })
      navigate(`/projects/${project.id}`)
      onClose()
    },
    onError: () => toast({ title: 'Fehler beim Erstellen', variant: 'destructive' }),
  })

  const f = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Neues Projekt erstellen</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs text-muted-foreground">Projekttitel</Label>
            <Input value={form.title} onChange={e => f('title', e.target.value)}
              placeholder="Mein Film" className="mt-1 h-9 text-base font-medium" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Genre</Label>
              <Input value={form.genre} onChange={e => f('genre', e.target.value)} placeholder="Drama" className="mt-1 h-8" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Format</Label>
              <Select value={form.format} onValueChange={v => f('format', v)}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Kurzfilm', 'Spielfilm', 'Dokumentation', 'Serie', 'Werbefilm', 'Imagefilm'].map(v =>
                    <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Regie</Label>
              <Input value={form.director} onChange={e => f('director', e.target.value)} className="mt-1 h-8" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Produzent/in</Label>
              <Input value={form.producer} onChange={e => f('producer', e.target.value)} className="mt-1 h-8" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={() => createMutation.mutate(form)} disabled={!form.title || createMutation.isPending}>
            {createMutation.isPending ? 'Erstellen…' : 'Projekt erstellen'}
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
  const [showNew, setShowNew] = useState(false)

  const { data: projects, isLoading } = useQuery({ queryKey: ['projects'], queryFn: api.projects.list })

  const duplicateMutation = useMutation({
    mutationFn: (id: number) => api.projects.duplicate(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); toast({ title: 'Projekt dupliziert' }) },
  })

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-8 py-14">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-sm">
              <Clapperboard className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight leading-none">CutSheet</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Filmproduktions-Management</p>
            </div>
          </div>
          <Button onClick={() => setShowNew(true)} size="sm">
            <Plus className="w-3.5 h-3.5 mr-1.5" />Neues Projekt
          </Button>
        </div>

        {/* Project section header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
            Meine Projekte
          </h2>
          {projects && projects.length > 0 && (
            <span className="text-xs text-muted-foreground">{projects.length} Projekt{projects.length !== 1 ? 'e' : ''}</span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : !projects || projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-5">
              <Film className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <h2 className="text-lg font-semibold mb-1.5">Noch keine Projekte</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              Erstelle dein erstes Filmprojekt, um loszulegen.
            </p>
            <Button onClick={() => setShowNew(true)}>
              <Plus className="w-4 h-4 mr-2" />Erstes Projekt erstellen
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {(projects || []).map((project: any) => (
              <div
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="group flex items-center gap-4 p-4 bg-card border border-border/60 rounded-xl cursor-pointer hover:border-primary/30 hover:bg-primary/3 transition-all"
              >
                {/* Icon */}
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Film className="w-4 h-4 text-muted-foreground" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold group-hover:text-primary transition-colors truncate">
                      {project.title}
                    </span>
                    <span className={cn(
                      'text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0',
                      STATUS_COLORS[project.status] || 'text-muted-foreground bg-muted'
                    )}>
                      {project.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {[project.format, project.genre, project.length_minutes ? `${project.length_minutes} Min.` : null,
                      project.director ? `Regie: ${project.director}` : null]
                      .filter(Boolean).join(' · ')}
                  </p>
                </div>

                {/* Meta */}
                <div className="text-right shrink-0 hidden sm:block">
                  {project.shoot_start && (
                    <p className="text-xs text-muted-foreground">
                      {formatDate(project.shoot_start)}
                      {project.shoot_end ? ` – ${formatDate(project.shoot_end)}` : ''}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={e => { e.stopPropagation(); duplicateMutation.mutate(project.id) }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted transition-colors"
                    title="Duplizieren"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <div className="w-8 h-8 flex items-center justify-center rounded-lg text-primary/40 group-hover:text-primary transition-colors">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <NewProjectDialog open={showNew} onClose={() => setShowNew(false)} />
    </div>
  )
}
