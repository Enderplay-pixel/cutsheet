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
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Trash2, Lightbulb, ArrowRight, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'

const STATUS = ['offen', 'geplant', 'verworfen'] as const

const STATUS_STYLE: Record<string, string> = {
  offen: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  geplant: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  verworfen: 'bg-muted/50 text-muted-foreground border-border',
}

/** Farbe nach Prioritaet - hohe Werte sollen ins Auge springen. */
function scoreStyle(score: number): string {
  if (score >= 70) return 'text-emerald-400'
  if (score >= 40) return 'text-amber-400'
  return 'text-muted-foreground'
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [draft, setDraft] = useState({ title: '', note: '', impact: '3', effort: '3' })

  const { data: ideas, isLoading } = useQuery({
    queryKey: ['creator-ideas', pid],
    queryFn: () => api.creator.ideas(pid),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['creator-ideas', pid] })
  const fail = (title: string) => (err: any) =>
    toast({ title, description: err?.message, variant: 'destructive' })

  const create = useMutation({
    mutationFn: () => api.creator.createIdea(pid, {
      title: draft.title.trim(),
      note: draft.note,
      impact: Number(draft.impact),
      effort: Number(draft.effort),
    }),
    onSuccess: () => { setDraft({ title: '', note: '', impact: '3', effort: '3' }); invalidate() },
    onError: fail('Idee nicht gespeichert'),
  })

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: any }) => api.creator.updateIdea(id, patch),
    onSuccess: invalidate,
    onError: fail('Änderung nicht gespeichert'),
  })

  const remove = useMutation({
    mutationFn: (id: number) => api.creator.deleteIdea(id),
    onSuccess: invalidate,
    onError: fail('Löschen fehlgeschlagen'),
  })

  const convert = useMutation({
    mutationFn: (id: number) => api.creator.convertIdea(id),
    onSuccess: (video: any) => {
      queryClient.invalidateQueries({ queryKey: ['creator-videos', pid] })
      invalidate()
      navigate(`/projects/${pid}/creator/${video.id}`)
    },
    onError: fail('Umwandeln fehlgeschlagen'),
  })

  const list = (ideas || []) as any[]
  const open = list.filter(i => i.status === 'offen')

  return (
    <div className="p-6 max-w-[1100px]">
      <PageHeader
        title="Ideen"
        subtitle={
          list.length === 0
            ? 'Der Vorrat, aus dem die Videos kommen'
            : `${open.length} offen von ${list.length} · sortiert nach Wirkung im Verhältnis zum Aufwand`
        }
      />

      {/* Schnellerfassung: Ideen kommen selten dann, wenn man Zeit für Formulare hat */}
      <div className="p-4 rounded-lg border border-border/50 bg-card mb-6">
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <Label className="text-xs text-muted-foreground">Idee</Label>
            <Input
              value={draft.title}
              onChange={e => setDraft(p => ({ ...p, title: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter' && draft.title.trim()) create.mutate() }}
              placeholder="Worum geht es?"
              className="mt-1"
            />
          </div>
          <div className="w-[110px]">
            <Label className="text-xs text-muted-foreground">Wirkung</Label>
            <Select value={draft.impact} onValueChange={v => setDraft(p => ({ ...p, impact: v }))}>
              <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[110px]">
            <Label className="text-xs text-muted-foreground">Aufwand</Label>
            <Select value={draft.effort} onValueChange={v => setDraft(p => ({ ...p, effort: v }))}>
              <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => create.mutate()} disabled={!draft.title.trim() || create.isPending}>
            <Plus className="w-4 h-4 mr-1.5" />Aufnehmen
          </Button>
        </div>
        <Textarea
          value={draft.note}
          onChange={e => setDraft(p => ({ ...p, note: e.target.value }))}
          placeholder="Notiz – Winkel, Hook, Quelle (optional)"
          rows={2}
          className="mt-3 text-sm"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : list.length === 0 ? (
        <div className="border border-dashed border-border/60 rounded-lg py-14 text-center">
          <Lightbulb className="w-9 h-9 mx-auto text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium">Noch keine Ideen gesammelt</p>
          <p className="mt-1 text-xs text-muted-foreground/70 max-w-md mx-auto">
            Wirkung und Aufwand von 1 bis 5. Die Reihenfolge ergibt sich aus dem Verhältnis -
            eine kleine Idee mit großer Wirkung landet vor einem aufwendigen Großprojekt.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map(idea => (
            <div
              key={idea.id}
              className={cn(
                'group flex items-start gap-4 p-3.5 rounded-lg border border-border/50 bg-card',
                idea.status === 'verworfen' && 'opacity-50'
              )}
            >
              <div className="w-11 shrink-0 text-center">
                <div className={cn('text-lg font-bold leading-none', scoreStyle(idea.score))}>{idea.score}</div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mt-0.5">Prio</div>
              </div>

              <div className="min-w-0 flex-1">
                <Input
                  defaultValue={idea.title}
                  onBlur={e => e.target.value !== idea.title && update.mutate({ id: idea.id, patch: { title: e.target.value } })}
                  className="h-7 px-0 border-0 bg-transparent font-medium focus-visible:ring-0"
                />
                {idea.note && <div className="text-xs text-muted-foreground/70 mt-0.5 whitespace-pre-wrap">{idea.note}</div>}
                <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Flame className="w-3 h-3" />Wirkung
                    <Select value={String(idea.impact)} onValueChange={v => update.mutate({ id: idea.id, patch: { impact: Number(v) } })}>
                      <SelectTrigger className="h-5 w-11 px-1 text-[11px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </span>
                  <span className="flex items-center gap-1">
                    Aufwand
                    <Select value={String(idea.effort)} onValueChange={v => update.mutate({ id: idea.id, patch: { effort: Number(v) } })}>
                      <SelectTrigger className="h-5 w-11 px-1 text-[11px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Select value={idea.status} onValueChange={s => update.mutate({ id: idea.id, patch: { status: s } })}>
                  <SelectTrigger className={cn('h-7 w-[104px] text-xs border', STATUS_STYLE[idea.status])}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                  </SelectContent>
                </Select>

                {idea.video_id ? (
                  <Button variant="ghost" size="sm" className="h-7 text-xs"
                    onClick={() => navigate(`/projects/${pid}/creator/${idea.video_id}`)}>
                    Zum Video<ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="h-7 text-xs"
                    disabled={convert.isPending}
                    onClick={() => convert.mutate(idea.id)}>
                    Video daraus<ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                )}

                <Button
                  variant="ghost" size="sm"
                  className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={() => remove.mutate(idea.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
