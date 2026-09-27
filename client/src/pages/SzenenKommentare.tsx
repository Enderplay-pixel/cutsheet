import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { MessageSquare, Check, Trash2, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const API_BASE = '/api'
async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}${path}`, { headers: { ...headers, ...options?.headers }, ...options })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Fehler')
  return json.data
}

function formatRelativeTime(ts: string): string {
  const now = Date.now()
  const then = new Date(ts).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return 'gerade eben'
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min.`
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std.`
  return `vor ${Math.floor(diff / 86400)} Tagen`
}

function CommentItem({ comment, onResolve, onDelete }: { comment: any; onResolve: () => void; onDelete: () => void }) {
  const authorName = comment.author_name || comment.user_name || 'Unbekannt'
  const initials = authorName.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className={cn(
      'rounded-xl border p-4 transition-all',
      comment.resolved
        ? 'border-border/30 bg-muted/10 opacity-50'
        : 'border-border/60 bg-card'
    )}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-sm font-semibold">{authorName}</span>
            <span className="text-[11px] text-muted-foreground/50 tabular-nums">{formatRelativeTime(comment.created_at)}</span>
            {comment.resolved && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5">
                <Check className="w-2.5 h-2.5" />
                Gelöst
              </span>
            )}
          </div>
          <p className={cn(
            'text-sm leading-relaxed',
            comment.resolved && 'line-through text-muted-foreground/50'
          )}>
            {comment.content}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          {!comment.resolved && (
            <button
              onClick={onResolve}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-green-500/10 text-muted-foreground/30 hover:text-green-600 transition-colors active:scale-[0.97]"
              title="Als gelöst markieren"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground/30 hover:text-destructive transition-colors active:scale-[0.97]"
            title="Kommentar löschen"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function Component() {
  const { projectId: id } = useParams<{ projectId: string }>()
  const pid = Number(id)
  const queryClient = useQueryClient()

  const [selectedSceneId, setSelectedSceneId] = useState<number | null>(null)
  const [newComment, setNewComment] = useState('')

  const { data: scenes, isLoading: scenesLoading } = useQuery({
    queryKey: ['scenes', pid],
    queryFn: () => req<any[]>(`/projects/${pid}/scenes`),
  })

  const { data: comments, isLoading: commentsLoading } = useQuery({
    queryKey: ['scene-comments', selectedSceneId],
    queryFn: () => req<any[]>(`/scenes/${selectedSceneId}/comments`),
    enabled: selectedSceneId !== null,
  })

  const { data: allCommentCounts } = useQuery({
    queryKey: ['all-comment-counts', pid],
    queryFn: async () => {
      const sceneIds = (scenes || []).map((s: any) => s.id)
      const results = await Promise.all(
        sceneIds.map((sid: number) => req<any[]>(`/scenes/${sid}/comments`).catch(() => []))
      )
      const counts: Record<number, number> = {}
      sceneIds.forEach((sid: number, i: number) => {
        counts[sid] = (results[i] || []).filter((c: any) => !c.resolved).length
      })
      return counts
    },
    enabled: !!scenes && scenes.length > 0,
  })

  const addCommentMutation = useMutation({
    mutationFn: (content: string) => req<any>(`/projects/${pid}/scenes/${selectedSceneId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scene-comments', selectedSceneId] })
      queryClient.invalidateQueries({ queryKey: ['all-comment-counts', pid] })
      setNewComment('')
    },
  })

  const resolveMutation = useMutation({
    mutationFn: (commentId: number) => req<any>(`/comments/${commentId}/resolve`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scene-comments', selectedSceneId] })
      queryClient.invalidateQueries({ queryKey: ['all-comment-counts', pid] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (commentId: number) => req<any>(`/comments/${commentId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scene-comments', selectedSceneId] })
      queryClient.invalidateQueries({ queryKey: ['all-comment-counts', pid] })
    },
  })

  const selectedScene = (scenes || []).find((s: any) => s.id === selectedSceneId)
  const unresolvedComments = (comments || []).filter((c: any) => !c.resolved)
  const resolvedComments = (comments || []).filter((c: any) => c.resolved)
  const totalUnresolved = Object.values(allCommentCounts || {}).reduce((sum: number, n: any) => sum + n, 0)

  return (
    <div className="p-7 max-w-6xl mx-auto animate-fade-up">
      {/* Page hero */}
      <div className="mb-8 pb-7 border-b border-border/40">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-[34px] sm:text-[40px]">Szenen-Kommentare</h1>
            <p className="text-sm text-muted-foreground/60 mt-1.5">
              Projektweite Übersicht aller Kommentare
            </p>
          </div>
          {totalUnresolved > 0 && (
            <div className="pt-1 text-right">
              <div className="text-[2.25rem] font-bold tabular-nums tracking-tight leading-none text-destructive">
                {totalUnresolved}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40 mt-1">
                Ungelöst
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-col md:flex-row gap-5 md:min-h-[620px]">
        {/* Scene list sidebar */}
        <div className="w-full md:w-64 md:shrink-0 max-h-72 md:max-h-none rounded-xl border border-border/60 bg-card overflow-hidden flex flex-col">
          <div className="px-4 py-3.5 border-b border-border/40 bg-muted/20">
            <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40 mb-0.5">Szenen</p>
            <span className="text-sm font-semibold tabular-nums">{scenes?.length || 0} gesamt</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {scenesLoading ? (
              <div className="p-3 space-y-2">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
              </div>
            ) : (
              <div className="divide-y divide-border/25">
                {(scenes || []).map((scene: any) => {
                  const count = allCommentCounts?.[scene.id] || 0
                  const isSelected = selectedSceneId === scene.id
                  return (
                    <button
                      key={scene.id}
                      onClick={() => setSelectedSceneId(scene.id)}
                      className={cn(
                        'w-full text-left px-4 py-3 flex items-center gap-2 transition-colors group',
                        isSelected
                          ? 'bg-primary/8 border-l-2 border-primary'
                          : 'hover:bg-muted/30 border-l-2 border-transparent'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-[0.07em] text-muted-foreground/40 mb-0.5">
                          Szene {scene.scene_number}
                        </div>
                        <div className="text-sm font-medium truncate leading-snug">
                          {scene.title || scene.location || '–'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {count > 0 && (
                          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                            {count}
                          </span>
                        )}
                        <ChevronRight className={cn(
                          'w-3.5 h-3.5 transition-colors',
                          isSelected ? 'text-primary' : 'text-muted-foreground/25 group-hover:text-muted-foreground/50'
                        )} />
                      </div>
                    </button>
                  )
                })}
                {(!scenes || scenes.length === 0) && (
                  <div className="p-8 text-center">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm text-muted-foreground">Keine Szenen</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Comments panel */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {!selectedSceneId ? (
            <div className="flex-1 rounded-xl border border-border/60 bg-card flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium text-muted-foreground/60">
                  Szene auswählen, um Kommentare anzuzeigen
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Selected scene header */}
              <div className="rounded-xl border border-border/60 bg-card px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4 text-muted-foreground/60" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40 mb-0.5">
                      Szene {selectedScene?.scene_number}
                    </p>
                    <h2 className="text-sm font-semibold leading-snug">
                      {selectedScene?.title || selectedScene?.location || '–'}
                    </h2>
                  </div>
                  {unresolvedComments.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive bg-destructive/8 border border-destructive/20 rounded-full px-2.5 py-1">
                      {unresolvedComments.length} offen
                    </span>
                  )}
                </div>
              </div>

              {/* Comments list */}
              <div className="flex-1 space-y-2 overflow-y-auto">
                {commentsLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
                  </div>
                ) : unresolvedComments.length === 0 && resolvedComments.length === 0 ? (
                  <div className="rounded-xl border border-border/60 bg-card flex flex-col items-center justify-center py-16">
                    <MessageSquare className="w-10 h-10 opacity-20 mb-3" />
                    <p className="text-sm text-muted-foreground/60">Noch keine Kommentare für diese Szene</p>
                  </div>
                ) : (
                  <>
                    {unresolvedComments.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40 mb-3 px-1">
                          Offen ({unresolvedComments.length})
                        </p>
                        {unresolvedComments.map((c: any) => (
                          <CommentItem
                            key={c.id}
                            comment={c}
                            onResolve={() => resolveMutation.mutate(c.id)}
                            onDelete={() => deleteMutation.mutate(c.id)}
                          />
                        ))}
                      </div>
                    )}

                    {resolvedComments.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40 mb-3 px-1">
                          Gelöst ({resolvedComments.length})
                        </p>
                        {resolvedComments.map((c: any) => (
                          <CommentItem
                            key={c.id}
                            comment={c}
                            onResolve={() => resolveMutation.mutate(c.id)}
                            onDelete={() => deleteMutation.mutate(c.id)}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* New comment form */}
              <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40">
                  Neuer Kommentar
                </p>
                <Textarea
                  placeholder="Kommentar schreiben..."
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  rows={3}
                  className="resize-none text-sm"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => addCommentMutation.mutate(newComment)}
                    disabled={!newComment.trim() || addCommentMutation.isPending}
                    className="active:scale-[0.97]"
                  >
                    Kommentar hinzufügen
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
