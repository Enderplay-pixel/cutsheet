import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Trash2, Pencil, Check, X, Car } from 'lucide-react'

interface Vehicle {
  id: number
  name: string
  kennzeichen: string
  typ: string
  kapazitaet: string
  fahrer: string
  telefon: string
}

const EMPTY_VEHICLE = { name: '', kennzeichen: '', typ: '', kapazitaet: '', fahrer: '', telefon: '' }

function VehicleRow({
  vehicle,
  pid,
  onEdit,
}: {
  vehicle: Vehicle
  pid: number
  onEdit: (v: Vehicle) => void
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const deleteMutation = useMutation({
    mutationFn: () => api.vehicles.delete(pid, vehicle.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles', pid] })
      toast({ title: 'Fahrzeug gelöscht' })
    },
    onError: () => toast({ variant: 'destructive', title: 'Fehler beim Löschen' }),
  })

  return (
    <tr className="border-b border-border/40 hover:bg-muted/30 transition-colors group">
      <td className="py-2.5 px-4 text-sm font-medium">{vehicle.name || '—'}</td>
      <td className="py-2.5 px-4 text-sm text-muted-foreground font-mono">{vehicle.kennzeichen || '—'}</td>
      <td className="py-2.5 px-4 text-sm text-muted-foreground">{vehicle.typ || '—'}</td>
      <td className="py-2.5 px-4 text-sm text-muted-foreground">{vehicle.kapazitaet || '—'}</td>
      <td className="py-2.5 px-4 text-sm text-muted-foreground">{vehicle.fahrer || '—'}</td>
      <td className="py-2.5 px-4 text-sm text-muted-foreground">{vehicle.telefon || '—'}</td>
      <td className="py-2.5 px-3 text-right">
        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(vehicle)}
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

function VehicleFormRow({
  initial,
  pid,
  onDone,
}: {
  initial?: Vehicle
  pid: number
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [form, setForm] = useState(initial ? { ...initial } : { ...EMPTY_VEHICLE })

  const saveMutation = useMutation({
    mutationFn: () =>
      initial
        ? api.vehicles.update(pid, initial.id, form)
        : api.vehicles.create(pid, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles', pid] })
      toast({ title: initial ? 'Fahrzeug aktualisiert' : 'Fahrzeug hinzugefügt' })
      onDone()
    },
    onError: () => toast({ variant: 'destructive', title: 'Fehler beim Speichern' }),
  })

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }))

  const colClass = 'py-1.5 px-3'
  const inputClass = 'h-7 text-sm'

  return (
    <tr className="border-b border-primary/20 bg-primary/5">
      <td className={colClass}><Input className={inputClass} placeholder="Name" value={form.name} onChange={e => set('name', e.target.value)} /></td>
      <td className={colClass}><Input className={inputClass} placeholder="B-AB 1234" value={form.kennzeichen} onChange={e => set('kennzeichen', e.target.value)} /></td>
      <td className={colClass}><Input className={inputClass} placeholder="Van, PKW…" value={form.typ} onChange={e => set('typ', e.target.value)} /></td>
      <td className={colClass}><Input className={inputClass} placeholder="7 Plätze" value={form.kapazitaet} onChange={e => set('kapazitaet', e.target.value)} /></td>
      <td className={colClass}><Input className={inputClass} placeholder="Fahrername" value={form.fahrer} onChange={e => set('fahrer', e.target.value)} /></td>
      <td className={colClass}><Input className={inputClass} placeholder="+49…" value={form.telefon} onChange={e => set('telefon', e.target.value)} /></td>
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

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['vehicles', pid],
    queryFn: () => api.vehicles.list(pid),
  })

  return (
    <div className="p-7 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Car className="w-5 h-5 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Fahrzeuge</h1>
            <p className="text-sm text-muted-foreground">{vehicles.length} Fahrzeug{vehicles.length !== 1 ? 'e' : ''}</p>
          </div>
        </div>
        <Button onClick={() => { setAdding(true); setEditingId(null) }} disabled={adding}>
          <Plus className="w-4 h-4 mr-2" />
          Fahrzeug hinzufügen
        </Button>
      </div>

      {/* Table */}
      <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kennzeichen</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Typ</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kapazität</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fahrer</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Telefon</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {adding && (
                <VehicleFormRow pid={pid} onDone={() => setAdding(false)} />
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
              ) : vehicles.length === 0 && !adding ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted-foreground text-sm">
                    Keine Fahrzeuge vorhanden. Füge das erste Fahrzeug hinzu.
                  </td>
                </tr>
              ) : (
                vehicles.map((v: Vehicle) =>
                  editingId === v.id ? (
                    <VehicleFormRow
                      key={v.id}
                      initial={v}
                      pid={pid}
                      onDone={() => setEditingId(null)}
                    />
                  ) : (
                    <VehicleRow
                      key={v.id}
                      vehicle={v}
                      pid={pid}
                      onEdit={veh => { setEditingId(veh.id); setAdding(false) }}
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
