import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Clock, Type, Trash2, ChevronRight, Youtube } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Pipeline-Stufen in Workflow-Reihenfolge - Serverseite kennt dieselbe Liste. */
const STATUS = ['Idee', 'Skript', 'Dreh', 'Schnitt', 'Thumbnail', 'Upload', 'Veröffentlicht'] as const
type Status = typeof STATUS[number]

const STATUS_STYLE: Record<Status, string> = {
  'Idee': 'bg-muted/50 text-muted-foreground border-border',
  'Skript': 'bg-blue-500/10 text-blue-400 border-blue-500/25',
  'Dreh': 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  'Schnitt': 'bg-violet-500/10 text-violet-400 border-violet-500/25',
  'Thumbnail': 'bg-pink-500/10 text-pink-400 border-pink-500/25',
  'Upload': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25',
  'Veröffentlicht': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
}

const PLATFORMS = ['YouTube', 'YouTube Shorts', 'TikTok', 'Instagram', 'Twitch', 'Podcast']

function timecode(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds || 0))
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const two = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${two(m % 60)}:${two(s % 60)}` : `${m}:${two(s % 60)}`
}

function NewVideoDialog({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId: number }) {
  const [form, setForm] = useState({ title: '', platform: 'YouTube', hook: '', targetMinutes: '8' })
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { toast } = useToast()

  const create = useMutation({
    mutationFn: () => api.creator.createVideo(projectId, {
      title: form.title.trim() || 'Neues Video',
      platform: form.platform,
      hook: form.hook,
      target_seconds: Math.round((Number(form.targetMinutes) || 0) * 60),
    }),
    onSuccess: (video: any) => {
      queryClient.invalidateQueries({ queryKey: ['creator-videos', projectId] })
      onClose()
      navigate(`/projects/${projectId}/creator/${video.id}`)
    },
    onError: (err: any) => toast({ title: 'Video konnte nicht angelegt werden', description: err?.message, variant: 'destructive' }),
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Neues Video</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs text-muted-foreground">Arbeitstitel</Label>
            <Input
              value={form.title} autoFocus className="mt-1 h-10 text-base font-medium"
              placeholder="Wie ich in 30 Tagen …"
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Plattform</Label>
              <Select value={form.platform} onValueChange={v => setForm(p => ({ ...p, platform: v }))}>
                <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map(p => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Ziel-Laufzeit (Minuten)</Label>
              <Input
                type="number" min="0" step="0.5" value={form.targetMinutes} className="mt-1"
                onChange={e => setForm(p => ({ ...p, targetMinutes: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Hook – die ersten Sekunden entscheiden</Label>
            <Textarea
              value={form.hook} rows={2} className="mt-1 text-sm"
              placeholder="Womit haeltst du die Leute in den ersten fuenf Sekunden?"
              onChange={e => setForm(p => ({ ...p, hook: e.target.value }))}
            />
          </div>
          <p className="text-xs text-muted-foreground/70">
            Das Skript wird mit der ueblichen Gliederung angelegt: Hook, Intro, zwei Hauptteile, Call to Action, Outro.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? 'Wird angelegt…' : 'Anlegen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// React Router laedt die Seiten per `lazy` und erwartet einen Export namens
// `Component` - wie alle anderen Seiten hier.
export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data: videos, isLoading } = useQuery({
    queryKey: ['creator-videos', pid],
    queryFn: () => api.creator.videos(pid),
  })

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => api.creator.updateVideo(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['creator-videos', pid] }),
    onError: (err: any) => toast({ title: 'Status nicht gespeichert', description: err?.message, variant: 'destructive' }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => api.creator.deleteVideo(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-videos', pid] })
      toast({ title: 'Video gelöscht' })
    },
    onError: (err: any) => toast({ title: 'Löschen fehlgeschlagen', description: err?.message, variant: 'destructive' }),
  })

  const list = (videos || []) as any[]
  const published = list.filter(v => v.status === 'Veröffentlicht').length
  const totalSeconds = list.reduce((n, v) => n + (v.total_seconds || 0), 0)

  return (
    <div className="p-6 max-w-[1400px]">
      <PageHeader
        title="Videos"
        subtitle={
          list.length === 0
            ? 'Noch keine Videos angelegt'
            : `${list.length} Video${list.length === 1 ? '' : 's'} · ${published} veröffentlicht · ${timecode(totalSeconds)} Material geskriptet`
        }
        actions={
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />Neues Video
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : list.length === 0 ? (
        <div className="border border-dashed border-border/60 rounded-lg py-16 text-center">
          <Youtube className="w-10 h-10 mx-auto text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium">Leg dein erstes Video an</p>
          <p className="mt-1 text-xs text-muted-foreground/70 max-w-md mx-auto">
            Jedes Video bekommt ein Skript in Abschnitten, eine geschätzte Laufzeit
            aus dem Sprechtext und ein Upload-Paket mit Titeln, Thumbnail-Ideen und Kapitelmarken.
          </p>
          <Button size="sm" className="mt-4" onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />Neues Video
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map(v => (
            <div
              key={v.id}
              className="group flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-card hover:border-border transition-colors cursor-pointer"
              onClick={() => navigate(`/projects/${pid}/creator/${v.id}`)}
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{v.title || 'Unbenanntes Video'}</div>
                <div className="text-xs text-muted-foreground/70 mt-0.5 truncate">
                  {v.platform}
                  {v.hook ? ` · ${v.hook}` : ''}
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0 text-xs text-muted-foreground">
                <span className="flex items-center gap-1" title="Geschätzte Laufzeit aus dem Sprechtext">
                  <Clock className="w-3.5 h-3.5" />{timecode(v.total_seconds)}
                  {v.target_seconds > 0 && (
                    <span className={cn(
                      'ml-1',
                      v.total_seconds > v.target_seconds ? 'text-amber-400' : 'text-emerald-400'
                    )}>
                      / {timecode(v.target_seconds)}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1" title="Wörter im Sprechtext">
                  <Type className="w-3.5 h-3.5" />{v.total_words}
                </span>
              </div>

              <div onClick={e => e.stopPropagation()} className="shrink-0">
                <Select value={v.status} onValueChange={s => setStatus.mutate({ id: v.id, status: s })}>
                  <SelectTrigger className={cn('h-7 w-[136px] text-xs border', STATUS_STYLE[v.status as Status] ?? STATUS_STYLE['Idee'])}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="ghost" size="sm"
                className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                onClick={e => {
                  e.stopPropagation()
                  if (confirm(`"${v.title || 'Video'}" mit allen Skript-Abschnitten löschen?`)) remove.mutate(v.id)
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
              <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground/40" />
            </div>
          ))}
        </div>
      )}

      <NewVideoDialog open={dialogOpen} onClose={() => setDialogOpen(false)} projectId={pid} />
    </div>
  )
}
