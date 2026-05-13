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
  return (
    <div className={cn('p-4 rounded-xl border transition-colors', comment.resolved ? 'border-border/30 bg-muted/20 opacity-60' : 'border-border/50 bg-card')}>
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
          {(comment.author_name || comment.user_name || '?')[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold">{comment.author_name || comment.user_name || 'Unbekannt'}</span>
            <span className="text-xs text-muted-foreground">{formatRelativeTime(comment.created_at)}</span>
            {comment.resolved && (
              <Badge variant="secondary" className="text-[10px] h-4 bg-green-500/10 text-green-600 border-green-500/20">Gelöst</Badge>
            )}
          </div>
          <p className={cn('text-sm leading-relaxed', comment.resolved && 'line-through text-muted-foreground')}>{comment.content}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!comment.resolved && (
            <button
              onClick={onResolve}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-green-500/10 text-muted-foreground/40 hover:text-green-600 transition-colors"
              title="Als gelöst markieren"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors"
            title="Löschen"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SzenenKommentare() {
  const { id } = useParams<{ id: string }>()
  const pid = Number(id)
  const queryClient = useQueryClient()

  const [selectedSceneId, setSelectedSceneId] = useState<number | null>(null)
  const [newComment, setNewComment] = useState('')

  const { data: scenes, isLoading: scenesLoading } = useQuery({
    queryKey: ['scenes', pid],
    queryFn: () => req<any[]>(`/projects/${pid}/scenes`),
  })

  // Fetch comments for selected scene
  const { data: comments, isLoading: commentsLoading } = useQuery({
    queryKey: ['scene-comments', selectedSceneId],
    queryFn: () => req<any[]>(`/scenes/${selectedSceneId}/comments`),
    enabled: selectedSceneId !== null,
  })

  // Fetch unresolved counts for all scenes
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
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Szenen-Kommentare</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Projektweite Übersicht aller Kommentare
          {totalUnresolved > 0 && ` · ${totalUnresolved} ungelöst`}
        </p>
      </div>

      <div className="flex gap-4 min-h-[600px]">
        {/* Scene list sidebar */}
        <div className="w-64 shrink-0 rounded-xl border border-border overflow-hidden flex flex-col">
          <div className="p-3 border-b border-border bg-muted/30">
            <span className="text-sm font-semibold">Szenen ({scenes?.length || 0})</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {scenesLoading ? (
              <div className="p-3 space-y-2">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {(scenes || []).map((scene: any) => {
                  const count = allCommentCounts?.[scene.id] || 0
                  const isSelected = selectedSceneId === scene.id
                  return (
                    <button
                      key={scene.id}
                      onClick={() => setSelectedSceneId(scene.id)}
                      className={cn(
                        'w-full text-left p-3 flex items-center gap-2 hover:bg-muted/30 transition-colors',
                        isSelected && 'bg-primary/8 border-l-2 border-primary'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-muted-foreground">Szene {scene.scene_number}</div>
                        <div className="text-sm truncate">{scene.title || scene.location || '–'}</div>
                      </div>
                      {count > 0 && (
                        <Badge variant="destructive" className="text-[10px] h-5 shrink-0">{count}</Badge>
                      )}
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                    </button>
                  )
                })}
                {(!scenes || scenes.length === 0) && (
                  <div className="p-6 text-center text-sm text-muted-foreground">Keine Szenen</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Comments panel */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {!selectedSceneId ? (
            <div className="flex-1 rounded-xl border border-border flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Szene auswählen, um Kommentare anzuzeigen</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 pb-1">
                <h2 className="font-semibold">
                  Szene {selectedScene?.scene_number}
                  {selectedScene?.title && <span className="font-normal text-muted-foreground ml-2">– {selectedScene.title}</span>}
                </h2>
                {unresolvedComments.length > 0 && (
                  <Badge variant="destructive" className="text-xs">{unresolvedComments.length} offen</Badge>
                )}
              </div>

              {commentsLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
                </div>
              ) : (
                <div className="flex-1 space-y-2">
                  {unresolvedComments.length === 0 && resolvedComments.length === 0 && (
                    <div className="text-center py-10 text-muted-foreground">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">Noch keine Kommentare für diese Szene</p>
                    </div>
                  )}

                  {unresolvedComments.map((c: any) => (
                    <CommentItem
                      key={c.id}
                      comment={c}
                      onResolve={() => resolveMutation.mutate(c.id)}
                      onDelete={() => deleteMutation.mutate(c.id)}
                    />
                  ))}

                  {resolvedComments.length > 0 && (
                    <div className="pt-2">
                      <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">Gelöst</div>
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
                </div>
              )}

              {/* New comment form */}
              <div className="rounded-xl border border-border p-4 space-y-3 bg-card">
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
