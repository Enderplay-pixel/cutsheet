import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { track } from '@/lib/analytics'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { MessageSquarePlus, Bug, Lightbulb, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  { value: 'fehler', label: 'Fehler', icon: Bug },
  { value: 'idee', label: 'Idee', icon: Lightbulb },
  { value: 'allgemein', label: 'Allgemein', icon: MessageCircle },
] as const

export function FeedbackWidget({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<string>('allgemein')
  const [message, setMessage] = useState('')
  const location = useLocation()
  const { toast } = useToast()

  const submitMutation = useMutation({
    mutationFn: () => api.feedback.submit({ category, message, page_path: location.pathname }),
    onSuccess: () => {
      track('feedback_submitted', { category })
      setOpen(false)
      setMessage('')
      toast({ title: 'Danke für dein Feedback', description: 'Wir lesen jede Nachricht.' })
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Fehler', description: e.message }),
  })

  return (
    <>
      <div className="px-2 pt-2">
        <button
          onClick={() => setOpen(true)}
          title="Feedback geben"
          className={cn(
            'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px]',
            'text-muted-foreground hover:text-foreground hover:bg-foreground/5',
            'transition-[background-color,color,transform] duration-150 active:scale-[0.97]',
            collapsed && 'justify-center'
          )}
        >
          <MessageSquarePlus className="w-[14px] h-[14px] shrink-0" />
          {!collapsed && <span>Feedback</span>}
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Feedback</DialogTitle>
            <DialogDescription>
              Was funktioniert gut, was fehlt dir? Dein Feedback fließt direkt in die Entwicklung ein.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2">
            {CATEGORIES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                className={cn(
                  'flex-1 flex flex-col items-center gap-1.5 py-3 rounded-lg border text-xs font-medium',
                  'transition-[background-color,border-color,color] duration-150 active:scale-[0.97]',
                  category === value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={category === 'fehler'
              ? 'Was ist passiert? Was hättest du erwartet?'
              : 'Erzähl uns davon…'}
            rows={4}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />

          <Button
            onClick={() => submitMutation.mutate()}
            disabled={!message.trim() || submitMutation.isPending}
            className="w-full"
          >
            {submitMutation.isPending ? 'Wird gesendet…' : 'Feedback senden'}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
