import { useState, useRef, useEffect, useCallback } from 'react'
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
import { useDownload } from '@/lib/useDownload'
import { formatCurrency, debounce, cn } from '@/lib/utils'
import { Plus, Trash2, MapPin, Zap, ExternalLink, ChevronDown, ChevronUp, Download, PenLine, FileSignature, RotateCcw } from 'lucide-react'
import { useProjectPerms } from '@/contexts/ProjectRoleContext'
import { useT } from '@/lib/useT'
import { locT, uiT } from '@/lib/i18n'

// ─── Signature Canvas ────────────────────────────────────────────────────────

function SignatureCanvas({ onSave, disabled }: { onSave: (dataUrl: string) => void; disabled?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const src = 'touches' in e ? e.touches[0] : e
    return { x: src.clientX - rect.left, y: src.clientY - rect.top }
  }

  const startDraw = useCallback((e: MouseEvent | TouchEvent) => {
    if (disabled) return
    e.preventDefault()
    drawing.current = true
    const canvas = canvasRef.current!
    lastPos.current = getPos(e, canvas)
  }, [disabled])

  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    if (!drawing.current || disabled) return
    e.preventDefault()
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    lastPos.current = pos
  }, [disabled])

  const stopDraw = useCallback(() => { drawing.current = false }, [])

  useEffect(() => {
    const canvas = canvasRef.current!
    canvas.addEventListener('mousedown', startDraw)
    canvas.addEventListener('mousemove', draw)
    canvas.addEventListener('mouseup', stopDraw)
    canvas.addEventListener('mouseleave', stopDraw)
    canvas.addEventListener('touchstart', startDraw, { passive: false })
    canvas.addEventListener('touchmove', draw, { passive: false })
    canvas.addEventListener('touchend', stopDraw)
    return () => {
      canvas.removeEventListener('mousedown', startDraw)
      canvas.removeEventListener('mousemove', draw)
      canvas.removeEventListener('mouseup', stopDraw)
      canvas.removeEventListener('mouseleave', stopDraw)
      canvas.removeEventListener('touchstart', startDraw)
      canvas.removeEventListener('touchmove', draw)
      canvas.removeEventListener('touchend', stopDraw)
    }
  }, [startDraw, draw, stopDraw])

  const clear = () => {
    const canvas = canvasRef.current!
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
  }

  const save = () => {
    const canvas = canvasRef.current!
    onSave(canvas.toDataURL('image/png'))
  }

  return (
    <div className="space-y-2">
      <div className="relative rounded-lg border border-border/60 bg-muted/10 overflow-hidden" style={{ touchAction: 'none' }}>
        <canvas
          ref={canvasRef}
          width={480}
          height={120}
          className={cn('w-full block', disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-crosshair')}
        />
        {!disabled && (
          <div className="absolute top-2 right-2 text-[10px] text-muted-foreground/40 select-none pointer-events-none">
            Hier unterschreiben
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={clear} disabled={disabled}>
          <RotateCcw className="w-3 h-3" />Löschen
        </Button>
        <Button type="button" size="sm" className="h-7 text-xs gap-1.5" onClick={save} disabled={disabled}>
          <PenLine className="w-3 h-3" />Unterschrift speichern
        </Button>
      </div>
    </div>
  )
}

// ─── Location Release Section ────────────────────────────────────────────────

function LocationReleaseSection({ locId, locName }: { locId: number; locName: string }) {
  const { toast } = useToast()
  const download = useDownload()
  const queryClient = useQueryClient()
  const [ownerName, setOwnerName] = useState('')
  const [showCanvas, setShowCanvas] = useState(false)

  const { data: release, isLoading } = useQuery({
    queryKey: ['location-release', locId],
    queryFn: () => api.locationRelease.get(locId),
    retry: false,
  })

  useEffect(() => {
    if (release?.owner_name) setOwnerName(release.owner_name)
  }, [release?.owner_name])

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.locationRelease.save(locId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['location-release', locId] }),
  })

  const signMutation = useMutation({
    mutationFn: (signatureData: string) => api.locationRelease.sign(locId, { signature_data: signatureData }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-release', locId] })
      setShowCanvas(false)
      toast({ title: 'Motivvertrag unterschrieben' })
    },
    onError: (e: any) => toast({ title: 'Fehler', description: e.message, variant: 'destructive' }),
  })

  const isSigned = release?.status === 'Unterschrieben'
  const statusColors: Record<string, string> = {
    Entwurf: 'bg-muted text-muted-foreground',
    Versendet: 'bg-blue-500/15 text-blue-400',
    Unterschrieben: 'bg-green-500/15 text-green-400',
  }

  if (isLoading) return <div className="h-6 animate-pulse bg-muted/30 rounded" />

  return (
    <div className="pt-3 border-t border-border/40 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSignature className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Motivvertrag</span>
          {release?.status && (
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', statusColors[release.status] ?? 'bg-muted text-muted-foreground')}>
              {release.status}
            </span>
          )}
        </div>
        <button type="button" onClick={() => download(api.locationRelease.pdf(locId), 'motivfreigabe.pdf')}
          className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-primary transition-colors">
          <Download className="w-3 h-3" />PDF
        </button>
      </div>

      <div className="space-y-2">
        <div>
          <Label className="text-xs text-muted-foreground">Eigentümer / Vermieter</Label>
          <div className="flex gap-2 mt-1">
            <Input
              value={ownerName}
              onChange={e => setOwnerName(e.target.value)}
              placeholder="Name des Eigentümers"
              className="h-7 text-xs flex-1"
              disabled={isSigned}
            />
            <Button
              variant="outline" size="sm" className="h-7 text-xs shrink-0"
              disabled={isSigned || saveMutation.isPending}
              onClick={() => saveMutation.mutate({ owner_name: ownerName, location_name: locName, status: release?.status ?? 'Entwurf' })}
            >
              Speichern
            </Button>
          </div>
        </div>

        {!isSigned && (
          <Button
            variant="outline" size="sm" className="h-7 text-xs w-full gap-1.5"
            onClick={() => setShowCanvas(v => !v)}
          >
            <PenLine className="w-3 h-3" />{showCanvas ? 'Abbrechen' : 'Unterschrift erfassen'}
          </Button>
        )}

        {isSigned && (
          <p className="text-xs text-green-400 flex items-center gap-1.5">
            <FileSignature className="w-3 h-3" />
            Unterschrieben am {new Date(release.signed_at).toLocaleDateString('de-DE')}
          </p>
        )}

        {showCanvas && !isSigned && (
          <SignatureCanvas
            onSave={(dataUrl) => signMutation.mutate(dataUrl)}
            disabled={signMutation.isPending}
          />
        )}
      </div>
    </div>
  )
}

function LocationCard({ loc, shootDays, onDelete }: { loc: any; shootDays: any[]; onDelete: () => void }) {
  const [form, setForm] = useState(loc)
  const [expanded, setExpanded] = useState(false)
  const queryClient = useQueryClient()
  const { projectId } = useParams()
  const pid = Number(projectId)
  const { canEdit } = useProjectPerms()
  const tt = useT()

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
              {daysAtLocation} {tt(locT.scenesUsed)}
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
          {canEdit && (
            <button onClick={e => { e.stopPropagation(); onDelete() }}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors"
              title={tt(uiT.delete)}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded form */}
      {expanded && (
        <div className="border-t border-border/40 p-4 bg-muted/20 space-y-3 animate-fade-up">
          <div>
            <Label className="text-xs text-muted-foreground">{tt(locT.labelName)}</Label>
            <Input value={form.name || ''} onChange={e => update('name', e.target.value)} className="mt-1 h-8 text-sm" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Label className="text-xs text-muted-foreground">{tt(locT.labelAddress)}</Label>
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
            <Label className="text-xs text-muted-foreground">{tt(locT.labelNotes)}</Label>
            <Textarea value={form.notes || ''} onChange={e => update('notes', e.target.value)}
              rows={2} className="mt-1 text-xs resize-none" placeholder="Parkplätze, WC, Besonderheiten…" />
          </div>

          <LocationReleaseSection locId={loc.id} locName={form.name || 'Motiv'} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Breitengrad (lat)</Label>
              <Input type="number" value={form.lat || ''} onChange={e => update('lat', e.target.value ? Number(e.target.value) : null)}
                className="mt-1 h-8 text-xs font-mono" placeholder="52.520008" step="any" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Längengrad (lng)</Label>
              <Input type="number" value={form.lng || ''} onChange={e => update('lng', e.target.value ? Number(e.target.value) : null)}
                className="mt-1 h-8 text-xs font-mono" placeholder="13.404954" step="any" />
            </div>
          </div>

          {form.lat && form.lng ? (
            <div className="rounded-lg overflow-hidden border border-border/60 h-44">
              <iframe
                title="Karte"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${form.lng - 0.01},${form.lat - 0.007},${form.lng + 0.01},${form.lat + 0.007}&layer=mapnik&marker=${form.lat},${form.lng}`}
                className="w-full h-full border-0"
                loading="lazy"
              />
            </div>
          ) : (form.address || form.city) ? (
            <a
              href={`https://www.openstreetmap.org/search?query=${encodeURIComponent([form.address, form.zip, form.city].filter(Boolean).join(', '))}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" />Auf OpenStreetMap suchen & Koordinaten eintragen
            </a>
          ) : null}
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
  const download = useDownload()
  const { canEdit } = useProjectPerms()
  const tt = useT()

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
          <h1 className="font-display text-[34px] sm:text-[40px]">{tt(locT.title)}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tt(locT.subtitle).replace('{n}', String(locations?.length || 0))}
            {totalCost > 0 && ` · ${formatCurrency(totalCost)} Mietkosten gesamt`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => download(api.pdf.motivliste(pid), 'motivliste.pdf')}>
              <Download className="w-3.5 h-3.5 mr-1.5" />PDF
            </Button>
          {canEdit && (
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />{tt(locT.newLocation)}
            </Button>
          )}
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
              <p className="text-sm font-medium mb-1">{tt(locT.noLocations)}</p>
              {canEdit && (
                <Button size="sm" className="mt-3" onClick={() => createMutation.mutate()}>
                  <Plus className="w-3.5 h-3.5 mr-1.5" />{tt(locT.newLocation)}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
