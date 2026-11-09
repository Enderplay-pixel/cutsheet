import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Trash2, Pencil, Check, X, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/useT'
import { useSchreibrecht } from '@/lib/useSchreibrecht'
import { komparsenT as k } from '@/lib/texte/Komparsen'

/**
 * Vorschläge für die Tarifgruppe. Die Spalte ist Freitext: In den Daten stehen
 * auch "Spezial (Uniform)" oder "Spezial (eigenes Kfz)", und die Vorschläge
 * ergänzen sich um alles, was im Projekt schon vorkommt.
 */
const TARIF_VORSCHLAEGE = ['Standard', 'Kleindarsteller']

/**
 * Felder heißen wie auf dem Server. Vorher schickte die Seite telefon,
 * tarifgruppe und notizen - der Server kennt phone, tariff_group und notes:
 * Telefon, Tarifgruppe und Notiz gingen beim Speichern verloren, und die
 * Tabelle zeigte bei jedem Komparsen "-" (gemessen am 26.10.2026).
 */
interface Extra {
  id: number
  name: string
  phone: string
  email: string
  tariff_group: string
  notes: string
  /** Drehtage, in deren Dispo der Komparse steht */
  drehtage: number[]
}

type Drehtag = { id: number; day_number: number; date: string }

const EMPTY_EXTRA = { name: '', phone: '', email: '', tariff_group: 'Standard', notes: '', drehtage: [] as number[] }

function tagText(tag: Drehtag, tt: ReturnType<typeof useT>) {
  const datum = tag.date ? ` · ${tag.date.slice(8, 10)}.${tag.date.slice(5, 7)}.` : ''
  return `${tt(k.tagKurz).replace('{n}', String(tag.day_number))}${datum}`
}

function ExtraRow({ extra, pid, tage, onEdit }: { extra: Extra; pid: number; tage: Drehtag[]; onEdit: (e: Extra) => void }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const tt = useT()
  const { darfSchreiben } = useSchreibrecht()

  const deleteMutation = useMutation({
    mutationFn: () => api.extras.delete(pid, extra.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extras', pid] })
      queryClient.invalidateQueries({ queryKey: ['call-sheet'] })
      toast({ title: tt(k.geloescht), description: tt(k.imPapierkorb) })
    },
    onError: () => toast({ variant: 'destructive', title: tt(k.fehlerLoeschen) }),
  })

  const eigene = tage.filter(t => (extra.drehtage ?? []).includes(t.id))

  return (
    <tr className="border-b border-border/40 hover:bg-muted/30 transition-colors group">
      <td className="py-2.5 px-4 text-sm font-medium">{extra.name || '-'}</td>
      <td className="py-2.5 px-4 text-sm text-muted-foreground">{extra.phone || '-'}</td>
      <td className="py-2.5 px-4 text-sm text-muted-foreground">{extra.email || '-'}</td>
      <td className="py-2.5 px-4">
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
          {extra.tariff_group || '-'}
        </span>
      </td>
      <td className="py-2.5 px-4">
        {eigene.length === 0 ? (
          <span className="text-xs text-muted-foreground/60">-</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {eigene.map(t => (
              <span key={t.id} className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground tabular-nums">
                {tagText(t, tt)}
              </span>
            ))}
          </div>
        )}
      </td>
      <td className="py-2.5 px-4 text-sm text-muted-foreground max-w-xs truncate">{extra.notes || '-'}</td>
      <td className="py-2.5 px-3 text-right">
        {darfSchreiben && (
          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(extra)}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              title={tt(k.bearbeiten)}
              aria-label={`${extra.name}: ${tt(k.bearbeiten)}`}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-destructive"
              title={tt(k.loeschen)}
              aria-label={`${extra.name}: ${tt(k.loeschen)}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}

function ExtraFormRow({
  initial,
  pid,
  tage,
  tarife,
  onDone,
}: {
  initial?: Extra
  pid: number
  tage: Drehtag[]
  tarife: string[]
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const tt = useT()
  const [form, setForm] = useState(initial ? { ...initial, drehtage: initial.drehtage ?? [] } : { ...EMPTY_EXTRA })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { drehtage, ...stamm } = form
      const gespeichert = initial // texte-ok
        ? await api.extras.update(pid, initial.id, stamm)
        : await api.extras.create(pid, stamm)
      const vorher = [...(initial?.drehtage ?? [])].sort().join(',')
      if ([...drehtage].sort().join(',') !== vorher) {
        await api.extras.setDrehtage(pid, gespeichert.id, drehtage)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extras', pid] })
      // Die Zuordnung steht in der Dispo des Tages - und in allem, was sie liest
      queryClient.invalidateQueries({ queryKey: ['call-sheet'] })
      queryClient.invalidateQueries({ queryKey: ['catering-list'] })
      toast({ title: initial ? tt(k.aktualisiert) : tt(k.hinzugefuegt) })
      onDone()
    },
    onError: () => toast({ variant: 'destructive', title: tt(k.fehlerSpeichern) }),
  })

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }))
  const umschalten = (tagId: number) => setForm(f => ({
    ...f,
    drehtage: f.drehtage.includes(tagId) ? f.drehtage.filter(t => t !== tagId) : [...f.drehtage, tagId],
  }))
  const colClass = 'py-1.5 px-3 align-top'
  const inputClass = 'h-7 text-sm'
  const listenId = `tarife-${initial?.id ?? 'neu'}`

  return (
    <tr className="border-b border-primary/20 bg-primary/5">
      <td className={colClass}><Input className={inputClass} placeholder={tt(k.name)} aria-label={tt(k.name)} value={form.name} onChange={e => set('name', e.target.value)} /></td>
      <td className={colClass}><Input className={inputClass} placeholder="+49…" aria-label={tt(k.telefon)} value={form.phone} onChange={e => set('phone', e.target.value)} /></td>
      <td className={colClass}><Input className={inputClass} placeholder={tt(k.mailPlatzh)} aria-label={tt(k.email)} type="email" value={form.email} onChange={e => set('email', e.target.value)} /></td>
      <td className={colClass}>
        <Input className={inputClass} list={listenId} aria-label={tt(k.tarifgruppe)} value={form.tariff_group} onChange={e => set('tariff_group', e.target.value)} />
        <datalist id={listenId}>
          {tarife.map(t => <option key={t} value={t} />)}
        </datalist>
      </td>
      <td className={colClass}>
        {tage.length === 0 ? (
          <span className="text-xs text-muted-foreground">{tt(k.keineDrehtage)}</span>
        ) : (
          <div className="flex flex-wrap gap-1 min-w-[160px]" role="group" aria-label={tt(k.drehtage)}>
            {tage.map(t => {
              const an = form.drehtage.includes(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={an}
                  onClick={() => umschalten(t.id)}
                  className={cn(
                    'text-[11px] px-1.5 py-0.5 rounded border tabular-nums transition-colors',
                    an ? 'border-primary bg-primary/15 text-primary font-semibold' : 'border-border/60 text-muted-foreground hover:border-primary/40',
                  )}
                >
                  {tagText(t, tt)}
                </button>
              )
            })}
          </div>
        )}
      </td>
      <td className={colClass}><Input className={inputClass} placeholder={tt(k.notizenPlatzh)} aria-label={tt(k.notizen)} value={form.notes} onChange={e => set('notes', e.target.value)} /></td>
      <td className="py-1.5 px-3 align-top">
        <div className="flex items-center gap-1 justify-end">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !form.name.trim()}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-green-500 disabled:opacity-40"
            title={tt(k.speichern)}
            aria-label={tt(k.speichern)}
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={onDone}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
            title={tt(k.abbrechen)}
            aria-label={tt(k.abbrechen)}
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
  const tt = useT()
  const { darfSchreiben } = useSchreibrecht()

  const { data: extras = [], isLoading } = useQuery<Extra[]>({
    queryKey: ['extras', pid],
    queryFn: () => api.extras.list(pid),
  })
  const { data: tage = [] } = useQuery<Drehtag[]>({
    queryKey: ['shoot-days', pid],
    queryFn: () => api.drehplan.listDays(pid),
  })

  const tarife = [...new Set([...TARIF_VORSCHLAEGE, ...extras.map(e => e.tariff_group).filter(Boolean)])]
  const filtered = filterTarif === 'alle'
    ? extras
    : extras.filter(e => e.tariff_group === filterTarif)

  return (
    <div className="px-5 py-6 sm:p-7 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Users className="w-5 h-5 text-muted-foreground" />
          <div>
            <h1 className="font-display text-[28px] sm:text-[34px]">{tt(k.titel)}</h1>
            <p className="text-sm text-muted-foreground">{tt(k.eintraege).replace('{n}', String(extras.length))}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Tarif filter */}
          <Select value={filterTarif} onValueChange={setFilterTarif}>
            <SelectTrigger className="h-9 w-44 text-sm" aria-label={tt(k.tarifgruppe)}>
              <SelectValue placeholder={tt(k.tarifgruppe)} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">{tt(k.alleGruppen)}</SelectItem>
              {tarife.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          {darfSchreiben && (
            <Button data-einfuehrung="neu" onClick={() => { setAdding(true); setEditingId(null) }} disabled={adding}>
              <Plus className="w-4 h-4 mr-2" />
              {tt(k.hinzufuegen)}
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{tt(k.drehtageHinweis)}</p>

      {/* Table */}
      <div data-einfuehrung="liste" className="bg-card border border-border/60 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tt(k.name)}</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tt(k.telefon)}</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tt(k.email)}</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tt(k.tarifgruppe)}</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tt(k.drehtage)}</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tt(k.notizen)}</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {adding && (
                <ExtraFormRow pid={pid} tage={tage} tarife={tarife} onDone={() => setAdding(false)} />
              )}
              {isLoading ? (
                [1,2,3].map(i => (
                  <tr key={i} className="border-b border-border/40">
                    {[1,2,3,4,5,6,7].map(j => (
                      <td key={j} className="py-2.5 px-4">
                        <div className="h-4 bg-muted rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 && !adding ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted-foreground text-sm">
                    {filterTarif === 'alle'
                      ? tt(k.leer)
                      : tt(k.leerGruppe).replace('{gruppe}', filterTarif)}
                  </td>
                </tr>
              ) : (
                filtered.map(e =>
                  editingId === e.id ? (
                    <ExtraFormRow
                      key={e.id}
                      initial={e}
                      pid={pid}
                      tage={tage}
                      tarife={tarife}
                      onDone={() => setEditingId(null)}
                    />
                  ) : (
                    <ExtraRow
                      key={e.id}
                      extra={e}
                      pid={pid}
                      tage={tage}
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
  )
}
