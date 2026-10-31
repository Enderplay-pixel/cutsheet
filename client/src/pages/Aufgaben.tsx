import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import {
  CheckSquare, Plus, Trash2, ChevronRight, CalendarDays, User, CircleDashed,
  CircleDot, Eye, CheckCircle2
} from 'lucide-react'
import { cn, heuteISO } from '@/lib/utils'
import { useSchreibrecht } from '@/lib/useSchreibrecht'
import { feiern } from '@/lib/belohnung'
import { useT, useGebietsschema } from '@/lib/useT'
import { uiT, type Lang } from '@/lib/i18n'
import { aufgabenT as at } from '@/lib/texte/Aufgaben'
import { parseISO } from 'date-fns'

// Abnahmeschleife wie bei PreProducer: offen → in Arbeit → Abnahme → erledigt
const STATUS_META: Record<string, { label: Record<Lang, string>; icon: any; cls: string }> = {
  offen:     { label: at.statusOffen, icon: CircleDashed, cls: 'text-muted-foreground' },
  in_arbeit: { label: at.statusInArbeit, icon: CircleDot,    cls: 'text-info' },
  abnahme:   { label: at.statusAbnahme, icon: Eye,          cls: 'text-warning' },
  erledigt:  { label: at.statusErledigt, icon: CheckCircle2, cls: 'text-success' },
}
const STATUS_ORDER = ['offen', 'in_arbeit', 'abnahme', 'erledigt']
const nextStatus = (s: string) => STATUS_ORDER[(STATUS_ORDER.indexOf(s) + 1) % STATUS_ORDER.length]

export function Component() {
  const { darfSchreiben } = useSchreibrecht()
  const { projectId } = useParams()
  const pid = Number(projectId)
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const tt = useT()

  const [newTitle, setNewTitle] = useState('')
  const [newAssignee, setNewAssignee] = useState('')
  const [newDue, setNewDue] = useState('')

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', pid],
    queryFn: () => api.tasks.list(pid),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['tasks', pid] })

  const createMutation = useMutation({
    mutationFn: () => api.tasks.create(pid, { title: newTitle, assignee: newAssignee, due_date: newDue || null }),
    onSuccess: () => { setNewTitle(''); setNewAssignee(''); setNewDue(''); invalidate() },
    onError: (e: any) => toast({ variant: 'destructive', title: tt(uiT.error), description: e.message }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.tasks.update(id, data),
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.tasks.delete(id),
    onSuccess: invalidate,
  })

  if (isLoading) {
    return (
      <div className="page-container space-y-3">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
      </div>
    )
  }

  const open = tasks.filter((t: any) => t.status !== 'erledigt')
  const done = tasks.filter((t: any) => t.status === 'erledigt')

  return (
    <div className="page-container animate-fade-up">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <CheckSquare className="w-[17px] h-[17px] text-primary" />
        </div>
        <div>
          <h1 className="font-display text-[28px] sm:text-[34px]">{tt(at.titel)}</h1>
          <p className="text-[12px] text-muted-foreground mt-1">
            {tt(at.offenErledigt).replace('{offen}', String(open.length)).replace('{erledigt}', String(done.length))}
          </p>
        </div>
      </div>

      {/* Quick-Add */}
      <form
        onSubmit={e => { e.preventDefault(); if (newTitle.trim()) createMutation.mutate() }}
        className="flex flex-col sm:flex-row gap-2 mb-7"
      >
        <Input disabled={!darfSchreiben}
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          placeholder={tt(at.neuPlatzhalter)}
          aria-label={tt(at.neueAufgabe)}
          className="flex-1"
        />
        <Input disabled={!darfSchreiben}
          value={newAssignee}
          onChange={e => setNewAssignee(e.target.value)}
          placeholder={tt(at.zustaendig)}
          aria-label={tt(at.zustaendigePerson)}
          className="sm:w-36"
        />
        <Input disabled={!darfSchreiben}
          type="date"
          value={newDue}
          onChange={e => setNewDue(e.target.value)}
          aria-label={tt(at.faelligAm)}
          className="sm:w-40"
        />
        <Button type="submit" disabled={!newTitle.trim() || createMutation.isPending}>
          <Plus className="w-4 h-4 mr-1" /> {tt(uiT.add)}
        </Button>
      </form>

      {tasks.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">{tt(at.keineAufgaben)}</p>
          <p className="text-[13px] text-muted-foreground/60 mt-1">
            {tt(at.ersteAufgabe)}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {open.length > 0 && (
            <TaskList
              tasks={open}
              gesperrt={!darfSchreiben}
              onCycle={(t: any) => updateMutation.mutate({ id: t.id, data: { status: nextStatus(t.status) } })}
              onDelete={(t: any) => deleteMutation.mutate(t.id)}
            />
          )}
          {done.length > 0 && (
            <div>
              <p className="section-label mb-2">{tt(at.statusErledigt)}</p>
              <TaskList
                tasks={done}
                gesperrt={!darfSchreiben}
                onCycle={(t: any) => updateMutation.mutate({ id: t.id, data: { status: 'offen' } })}
                onDelete={(t: any) => deleteMutation.mutate(t.id)} muted
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TaskList({ tasks, gesperrt, onCycle, onDelete, muted }: {
  tasks: any[]
  /** Lesezugriff: Status und Löschen wie das Eingabeformular sperren, statt den
   *  Klick erst am Server scheitern zu lassen */
  gesperrt: boolean
  onCycle: (t: any) => void
  onDelete: (t: any) => void
  muted?: boolean
}) {
  const today = heuteISO()
  const tt = useT()
  const gs = useGebietsschema()
  return (
    <div className="space-y-1.5">
      {tasks.map((t: any) => {
        const meta = STATUS_META[t.status] ?? STATUS_META.offen
        const Icon = meta.icon
        const overdue = t.due_date && t.status !== 'erledigt' && String(t.due_date).slice(0, 10) < today
        return (
          <div
            key={t.id}
            className={cn(
              'group flex items-center gap-3 px-4 py-3 rounded-xl border border-border/60 bg-card',
              'transition-[border-color,background-color] duration-150 hover:border-border',
              muted && 'opacity-55'
            )}
          >
            <button
              disabled={gesperrt}
              onClick={(e) => { if (nextStatus(t.status) === 'erledigt' && !muted) feiern(e.currentTarget); onCycle(t) }}
              title={tt(at.statusTitel).replace('{status}', tt(meta.label))}
              className={cn('shrink-0 transition-transform duration-150 active:scale-[0.85]', meta.cls)}
            >
              <Icon className="w-[18px] h-[18px]" />
            </button>
            <div className="min-w-0 flex-1">
              <p className={cn('text-sm font-medium truncate', t.status === 'erledigt' && 'line-through text-muted-foreground')}>
                {t.title}
              </p>
              <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                <span className={cn('flex items-center gap-1', meta.cls)}>{tt(meta.label)}</span>
                {t.assignee && <span className="flex items-center gap-1"><User className="w-3 h-3" />{t.assignee}</span>}
                {t.due_date && (
                  <span className={cn('flex items-center gap-1 tabular-nums', overdue && 'text-danger font-semibold')}>
                    <CalendarDays className="w-3 h-3" />
                    {parseISO(t.due_date).toLocaleDateString(gs, { day: '2-digit', month: '2-digit' })}
                    {overdue && ` ${tt(at.ueberfaellig)}`}
                  </span>
                )}
                {t.department && <span>{t.department}</span>}
              </div>
            </div>
            <button
              disabled={gesperrt}
              onClick={() => onCycle(t)}
              className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors shrink-0"
            >
              {t.status !== 'erledigt' && <>{tt(STATUS_META[nextStatus(t.status)].label)}<ChevronRight className="w-3 h-3" /></>}
            </button>
            <button
              disabled={gesperrt}
              onClick={() => onDelete(t)}
              className="shrink-0 p-1.5 rounded-md text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-[color,background-color,opacity] duration-150 active:scale-[0.88]"
              title={tt(at.aufgabeLoeschen)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
