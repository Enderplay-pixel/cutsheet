import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Trash2, Pencil, Check, X, Car } from 'lucide-react'
import { useProjectPerms } from '@/contexts/ProjectRoleContext'
import { useT } from '@/lib/useT'
import { vehicleT, uiT } from '@/lib/i18n'

interface Vehicle {
  id: number
  name: string
  license_plate: string
  type: string
  capacity: number | string
  driver_name: string
  driver_phone: string
  notes: string
}

const EMPTY: Omit<Vehicle, 'id'> = {
  name: '', license_plate: '', type: 'PKW', capacity: 4, driver_name: '', driver_phone: '', notes: ''
}

function VehicleRow({ vehicle, pid, onEdit }: { vehicle: Vehicle; pid: number; onEdit: (v: Vehicle) => void }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { canEdit } = useProjectPerms()
  const tt = useT()
  const deleteMutation = useMutation({
    mutationFn: () => api.vehicles.delete(pid, vehicle.id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vehicles', pid] }); toast({ title: 'Fahrzeug gelöscht' }) },
    onError: () => toast({ variant: 'destructive', title: 'Fehler beim Löschen' }),
  })
  return (
    <tr className="border-b border-border/40 hover:bg-muted/30 transition-colors group">
      <td className="py-2.5 px-4 text-sm font-medium">{vehicle.name || '—'}</td>
      <td className="py-2.5 px-4 text-sm text-muted-foreground font-mono">{vehicle.license_plate || '—'}</td>
      <td className="py-2.5 px-4 text-sm text-muted-foreground">{vehicle.type || '—'}</td>
      <td className="py-2.5 px-4 text-sm text-muted-foreground">{vehicle.capacity ?? '—'}</td>
      <td className="py-2.5 px-4 text-sm text-muted-foreground">{vehicle.driver_name || '—'}</td>
      <td className="py-2.5 px-4 text-sm text-muted-foreground">{vehicle.driver_phone || '—'}</td>
      <td className="py-2.5 px-3 text-right">
        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          {canEdit && (
            <>
              <button onClick={() => onEdit(vehicle)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground" title={tt(uiT.edit)}>
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-destructive" title={tt(uiT.delete)}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

function VehicleFormRow({ initial, pid, onDone }: { initial?: Vehicle; pid: number; onDone: () => void }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [form, setForm] = useState<Omit<Vehicle, 'id'>>(initial ? { ...initial } : { ...EMPTY })
  const set = (key: string, value: string | number) => setForm(f => ({ ...f, [key]: value }))

  const saveMutation = useMutation({
    mutationFn: () => initial ? api.vehicles.update(pid, initial.id, form) : api.vehicles.create(pid, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles', pid] })
      toast({ title: initial ? 'Fahrzeug aktualisiert' : 'Fahrzeug hinzugefügt' })
      onDone()
    },
    onError: () => toast({ variant: 'destructive', title: 'Fehler beim Speichern' }),
  })

  const c = 'py-1.5 px-3'
  const i = 'h-7 text-sm'
  return (
    <tr className="border-b border-primary/20 bg-primary/5">
      <td className={c}><Input className={i} placeholder="Fahrzeugname" value={form.name} onChange={e => set('name', e.target.value)} /></td>
      <td className={c}><Input className={i} placeholder="B-AB 1234" value={form.license_plate} onChange={e => set('license_plate', e.target.value)} /></td>
      <td className={c}><Input className={i} placeholder="Van, PKW, LKW…" value={form.type} onChange={e => set('type', e.target.value)} /></td>
      <td className={c}><Input className={i} type="number" min={1} placeholder="7" value={String(form.capacity)} onChange={e => set('capacity', Number(e.target.value))} /></td>
      <td className={c}><Input className={i} placeholder="Fahrername" value={form.driver_name} onChange={e => set('driver_name', e.target.value)} /></td>
      <td className={c}><Input className={i} placeholder="+49 151…" value={form.driver_phone} onChange={e => set('driver_phone', e.target.value)} /></td>
      <td className="py-1.5 px-3">
        <div className="flex items-center gap-1 justify-end">
          <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name.trim()} className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-green-500 disabled:opacity-40" title="Speichern">
            <Check className="w-4 h-4" />
          </button>
          <button onClick={onDone} className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground" title="Abbrechen">
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
  const { canEdit } = useProjectPerms()
  const tt = useT()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['vehicles', pid],
    queryFn: () => api.vehicles.list(pid),
  })

  return (
    <div className="px-5 py-6 sm:p-7 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Car className="w-5 h-5 text-muted-foreground" />
          <div>
            <h1 className="font-display text-[28px] sm:text-[34px]">{tt(vehicleT.title)}</h1>
            <p className="text-sm text-muted-foreground">{tt(vehicleT.subtitle).replace('{n}', String(vehicles?.length || 0))}</p>
          </div>
        </div>
        {canEdit && (
          <Button onClick={() => { setAdding(true); setEditingId(null) }} disabled={adding}>
            <Plus className="w-4 h-4 mr-2" /> {tt(vehicleT.addVehicle)}
          </Button>
        )}
      </div>

      <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                {['Name', tt(vehicleT.labelPlate), tt(vehicleT.labelType), 'Plätze', tt(vehicleT.labelDriver), 'Telefon', ''].map((h, i) => (
                  <th key={i} className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {adding && <VehicleFormRow pid={pid} onDone={() => setAdding(false)} />}
              {isLoading ? (
                [1,2,3].map(i => (
                  <tr key={i} className="border-b border-border/40">
                    {[1,2,3,4,5,6,7].map(j => <td key={j} className="py-2.5 px-4"><div className="h-4 bg-muted rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : vehicles.length === 0 && !adding ? (
                <tr><td colSpan={7} className="py-16 text-center text-muted-foreground text-sm">{tt(vehicleT.noVehicles)}</td></tr>
              ) : (
                (vehicles as Vehicle[]).map(v =>
                  editingId === v.id ? (
                    <VehicleFormRow key={v.id} initial={v} pid={pid} onDone={() => setEditingId(null)} />
                  ) : (
                    <VehicleRow key={v.id} vehicle={v} pid={pid} onEdit={veh => { setEditingId(veh.id); setAdding(false) }} />
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
