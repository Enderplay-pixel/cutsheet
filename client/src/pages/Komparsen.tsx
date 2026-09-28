import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react'

// Muss zu den Werten des Servers passen (extras.tariff_group, Standard: 'Standard')
const TARIFGRUPPEN = ['Standard', 'Kleindarsteller', 'Spezial (eigenes Kfz)', 'Spezial (Uniform)', 'Sonstige']

interface Extra {
  id: number
  name: string
  phone: string
  email: string
  tariff_group: string
  notes: string
}

const EMPTY_EXTRA: Omit<Extra, 'id'> = { name: '', phone: '', email: '', tariff_group: 'Standard', notes: '' }

function ExtraRow({ extra, pid, onEdit }: { extra: Extra; pid: number; onEdit: (e: Extra) => void }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const deleteMutation = useMutation({
    mutationFn: () => api.extras.delete(pid, extra.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extras', pid] })
      toast({ title: 'Komparse gelöscht' })
    },
    onError: () => toast({ variant: 'destructive', title: 'Fehler beim Löschen' }),
  })

  return (
    <tr className="border-b border-border/40 hover:bg-muted/30 transition-colors group">
      <td className="py-2.5 px-4 text-sm font-medium">{extra.name || '—'}</td>
      <td className="py-2.5 px-4 text-sm text-muted-foreground">{extra.phone || '—'}</td>
      <td className="py-2.5 px-4 text-sm text-muted-foreground">{extra.email || '—'}</td>
      <td className="py-2.5 px-4">
        <span className="text-[13px] text-foreground/85">{extra.tariff_group || '—'}</span>
      </td>
      <td className="py-2.5 px-4 text-sm text-muted-foreground max-w-xs truncate">{extra.notes || '—'}</td>
      <td className="py-2.5 px-3 text-right">
        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(extra)}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Bearbeiten"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-destructive"
            title="Löschen"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}

function ExtraFormRow({
  initial,
  pid,
  onDone,
}: {
  initial?: Extra
  pid: number
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [form, setForm] = useState(initial ? { ...initial } : { ...EMPTY_EXTRA })

  const saveMutation = useMutation({
    mutationFn: () =>
      initial
        ? api.extras.update(pid, initial.id, form)
        : api.extras.create(pid, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extras', pid] })
      toast({ title: initial ? 'Komparse aktualisiert' : 'Komparse hinzugefügt' })
      onDone()
    },
    onError: () => toast({ variant: 'destructive', title: 'Fehler beim Speichern' }),
  })

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }))
  const colClass = 'py-1.5 px-3'
  const inputClass = 'h-7 text-sm'

  return (
    <tr className="border-b border-border bg-foreground/[0.025]">
      <td className={colClass}><Input className={inputClass} placeholder="Name" value={form.name} onChange={e => set('name', e.target.value)} /></td>
      <td className={colClass}><Input className={inputClass} placeholder="+49…" value={form.phone} onChange={e => set('phone', e.target.value)} /></td>
      <td className={colClass}><Input className={inputClass} placeholder="email@…" type="email" value={form.email} onChange={e => set('email', e.target.value)} /></td>
      <td className={colClass}>
        <Select value={form.tariff_group} onValueChange={v => set('tariff_group', v)}>
          <SelectTrigger className="h-7 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TARIFGRUPPEN.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </td>
      <td className={colClass}><Input className={inputClass} placeholder="Notizen…" value={form.notes} onChange={e => set('notes', e.target.value)} /></td>
      <td className="py-1.5 px-3">
        <div className="flex items-center gap-1 justify-end">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !form.name.trim()}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-green-500 disabled:opacity-40"
            title="Speichern"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={onDone}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
            title="Abbrechen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [filterTarif, setFilterTarif] = useState<string>('alle')

  const { data: extras = [], isLoading } = useQuery({
    queryKey: ['extras', pid],
    queryFn: () => api.extras.list(pid),
  })

  const filtered = filterTarif === 'alle'
    ? extras
    : extras.filter((e: Extra) => e.tariff_group === filterTarif)

  return (
    <div className="px-5 py-6 sm:p-7 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-[28px] sm:text-[34px]">Komparsen</h1>
            <p className="text-sm text-muted-foreground">{extras.length} Einträge</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Tarif filter */}
          <Select value={filterTarif} onValueChange={setFilterTarif}>
            <SelectTrigger className="h-9 w-36 text-sm">
              <SelectValue placeholder="Tarifgruppe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Gruppen</SelectItem>
              {TARIFGRUPPEN.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => { setAdding(true); setEditingId(null) }} disabled={adding}>
            <Plus className="w-4 h-4 mr-2" />
            Komparse hinzufügen
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Telefon</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">E-Mail</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tarifgruppe</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notizen</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody>
                {adding && (
                  <ExtraFormRow pid={pid} onDone={() => setAdding(false)} />
                )}
                {isLoading ? (
                  [1,2,3].map(i => (
                    <tr key={i} className="border-b border-border/40">
                      {[1,2,3,4,5,6].map(j => (
                        <td key={j} className="py-2.5 px-4">
                          <div className="h-4 bg-muted rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 && !adding ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-muted-foreground text-sm">
                      {filterTarif === 'alle'
                        ? 'Keine Komparsen vorhanden. Füge den ersten hinzu.'
                        : `Keine Komparsen in Tarifgruppe ${filterTarif}.`}
                    </td>
                  </tr>
                ) : (
                  filtered.map((e: Extra) =>
                    editingId === e.id ? (
                      <ExtraFormRow
                        key={e.id}
                        initial={e}
                        pid={pid}
                        onDone={() => setEditingId(null)}
                      />
                    ) : (
                      <ExtraRow
                        key={e.id}
                        extra={e}
                        pid={pid}
                        onEdit={ex => { setEditingId(ex.id); setAdding(false) }}
                      />
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
