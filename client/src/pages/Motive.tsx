import { useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency, debounce, cn } from '@/lib/utils'
import { Plus, Trash2, MapPin, Zap, ExternalLink, ChevronDown, ChevronUp, Download } from 'lucide-react'

function LocationCard({ loc, shootDays, onDelete }: { loc: any; shootDays: any[]; onDelete: () => void }) {
  const [form, setForm] = useState(loc)
  const [expanded, setExpanded] = useState(false)
  const queryClient = useQueryClient()
  const { projectId } = useParams()
  const pid = Number(projectId)

  const mutation = useMutation({
    mutationFn: (data: any) => api.locations.update(loc.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['locations', pid] }),
  })
  const debouncedUpdate = useRef(debounce((data: any) => mutation.mutate(data), 500)).current
  const update = (key: string, value: any) => {
    const next = { ...form, [key]: value }
    setForm(next)
    debouncedUpdate(next)
  }

  const daysAtLocation = shootDays.filter(day =>
    day.scenes?.some((s: any) => s.location_id === loc.id)
  ).length
  const totalCost = (form.rental_fee || 0) * Math.max(daysAtLocation, 1)
  const mapsUrl = form.address && form.city
    ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${form.address}, ${form.city}`)}`
    : null

  return (
    <div className={cn(
      'border border-border/60 rounded-xl overflow-hidden bg-card transition-colors',
      expanded && 'border-border'
    )}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/20 transition-colors" onClick={() => setExpanded(!expanded)}>
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <MapPin className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{form.name || '(Kein Name)'}</div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {[form.address, form.city].filter(Boolean).join(', ') || 'Keine Adresse'}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {daysAtLocation > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {daysAtLocation} Drehtage
            </span>
          )}
          {form.power_available && (
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          )}
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button onClick={e => { e.stopPropagation(); onDelete() }}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded form */}
      {expanded && (
        <div className="border-t border-border/40 p-4 bg-muted/20 space-y-3 animate-fade-up">
          <div>
            <Label className="text-xs text-muted-foreground">Name des Motivs</Label>
            <Input value={form.name || ''} onChange={e => update('name', e.target.value)} className="mt-1 h-8 text-sm" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground">Straße & Hausnummer</Label>
              <Input value={form.address || ''} onChange={e => update('address', e.target.value)} className="mt-1 h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">PLZ</Label>
              <Input value={form.zip || ''} onChange={e => update('zip', e.target.value)} className="mt-1 h-8 text-xs" />
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Stadt</Label>
            <Input value={form.city || ''} onChange={e => update('city', e.target.value)} className="mt-1 h-8 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Ansprechpartner</Label>
              <Input value={form.contact_name || ''} onChange={e => update('contact_name', e.target.value)} className="mt-1 h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Telefon</Label>
              <Input value={form.contact_phone || ''} onChange={e => update('contact_phone', e.target.value)} className="mt-1 h-8 text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <Label className="text-xs text-muted-foreground">Miete pro Tag (€)</Label>
              <Input type="number" value={(form.rental_fee || 0) / 100}
                onChange={e => update('rental_fee', Math.round(Number(e.target.value) * 100))}
                className="mt-1 h-8 text-sm" />
            </div>
            <div className="flex items-center gap-2.5 pb-1">
              <Switch checked={!!form.power_available} onCheckedChange={v => update('power_available', v)} id={`power-${loc.id}`} />
              <Label htmlFor={`power-${loc.id}`} className="text-xs cursor-pointer flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-amber-400" />Strom vorhanden
              </Label>
            </div>
          </div>

          {daysAtLocation > 0 && form.rental_fee > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-border/40">
              <span className="text-xs text-muted-foreground">{daysAtLocation} Drehtage × {formatCurrency(form.rental_fee)}</span>
              <span className="text-sm font-semibold">{formatCurrency(totalCost)}</span>
            </div>
          )}

          <div>
            <Label className="text-xs text-muted-foreground">Notizen & Infrastruktur</Label>
            <Textarea value={form.notes || ''} onChange={e => update('notes', e.target.value)}
              rows={2} className="mt-1 text-xs resize-none" placeholder="Parkplätze, WC, Besonderheiten…" />
          </div>
        </div>
      )}
    </div>
  )
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: locations, isLoading } = useQuery({
    queryKey: ['locations', pid],
    queryFn: () => api.locations.list(pid),
  })
  const { data: shootDays } = useQuery({
    queryKey: ['shoot-days', pid],
    queryFn: () => api.drehplan.listDays(pid),
  })

  const createMutation = useMutation({
    mutationFn: () => api.locations.create(pid, { name: 'Neues Motiv', city: '', address: '' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['locations', pid] }),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.locations.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['locations', pid] }),
    onError: () => toast({ title: 'Fehler beim Löschen', variant: 'destructive' }),
  })

  const totalCost = (locations || []).reduce((sum: number, loc: any) => {
    const days = (shootDays || []).filter(d => d.scenes?.some((s: any) => s.location_id === loc.id)).length
    return sum + (loc.rental_fee || 0) * Math.max(days, 0)
  }, 0)

  return (
    <div className="p-7 max-w-4xl mx-auto animate-fade-up">
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-xl font-semibold">Motive & Drehorte</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {locations?.length || 0} Motive
            {totalCost > 0 && ` · ${formatCurrency(totalCost)} Mietkosten gesamt`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href={api.pdf.motivliste(pid)} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <Download className="w-3.5 h-3.5 mr-1.5" />PDF
            </Button>
          </a>
          <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />Neues Motiv
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-2.5">
          {(locations || []).map((loc: any) => (
            <LocationCard key={loc.id} loc={loc} shootDays={shootDays || []} onDelete={() => deleteMutation.mutate(loc.id)} />
          ))}
          {(!locations || locations.length === 0) && (
            <div className="text-center py-20 text-muted-foreground">
              <MapPin className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium mb-1">Noch keine Motive angelegt.</p>
              <Button size="sm" className="mt-3" onClick={() => createMutation.mutate()}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />Erstes Motiv
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
