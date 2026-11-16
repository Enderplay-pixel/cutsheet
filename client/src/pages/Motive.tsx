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
import { useT, useGebietsschema } from '@/lib/useT'
import { locT, uiT } from '@/lib/i18n'
import { useSchreibrecht } from '@/lib/useSchreibrecht'
import { drehortT as DT, GENEHMIGUNG_STATUS, GENEHMIGUNG_STATUS_TEXT } from '@/lib/texte/MotivDrehort'

// ─── Signature Canvas ────────────────────────────────────────────────────────

function SignatureCanvas({ onSave, disabled }: { onSave: (dataUrl: string) => void; disabled?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)
  // Leer gibt es keine Unterschrift - vorher ging eine leere Fläche als
  // "Unterschrieben" durch (gemessen am 01.11.2026)
  const [gezeichnet, setGezeichnet] = useState(false)
  const tt = useT()

  // Die Fläche ist intern 480 px breit, angezeigt wird sie auf voller Breite.
  // Ohne Umrechnung lag der Strich neben dem Finger (Faktor 0,75 gemessen).
  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const src = 'touches' in e ? e.touches[0] : e
    return {
      x: (src.clientX - rect.left) * (canvas.width / rect.width),
      y: (src.clientY - rect.top) * (canvas.height / rect.height),
    }
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
    // Dunkle Tinte auf weißer Fläche - das Bild landet im PDF auf Papier.
    // Vorher #e2e8f0: auf Weiß kaum zu sehen
    ctx.strokeStyle = '#111827'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    lastPos.current = pos
    setGezeichnet(true)
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
    setGezeichnet(false)
  }

  const save = () => {
    const canvas = canvasRef.current!
    onSave(canvas.toDataURL('image/png'))
  }

  return (
    <div className="space-y-2">
      <div className="relative rounded-lg border border-border/60 bg-white overflow-hidden" style={{ touchAction: 'none' }}>
        <canvas
          ref={canvasRef}
          width={480}
          height={120}
          className={cn('w-full block', disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-crosshair')}
        />
        {!disabled && (
          <div className="absolute top-2 right-2 text-[10px] text-slate-400 select-none pointer-events-none">
            {tt(locT.hierUnterschreiben)}
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={clear} disabled={disabled}>
          <RotateCcw className="w-3 h-3" />{tt(locT.flaecheLeeren)}
        </Button>
        <Button type="button" size="sm" className="h-7 text-xs gap-1.5" onClick={save} disabled={disabled || !gezeichnet}>
          <PenLine className="w-3 h-3" />{tt(locT.unterschriftSpeichern)}
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
  const tt = useT()
  const gs = useGebietsschema()
  const { darfSchreiben } = useSchreibrecht()

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

  // Ohne gespeicherten Vertrag scheiterte das Unterschreiben mit "Kein
  // Motivvertrag gefunden", und der Unterzeichner blieb leer, obwohl der
  // Eigentümer daneben stand. Jetzt: Vertrag bei Bedarf anlegen, Eigentümer
  // als Unterzeichner.
  const signMutation = useMutation({
    mutationFn: async (signatureData: string) => {
      if (!release?.id) {
        await api.locationRelease.save(locId, { owner_name: ownerName, location_name: locName, status: 'Entwurf' })
      }
      return api.locationRelease.sign(locId, { signature_data: signatureData, signed_by: ownerName.trim() })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-release', locId] })
      setShowCanvas(false)
      toast({ title: tt(locT.unterschrieben) })
    },
    onError: (e: any) => toast({ title: tt(locT.fehler), description: e.message, variant: 'destructive' }),
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
          <span className="text-xs font-medium">{tt(locT.motivvertrag)}</span>
          {release?.status && (
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', statusColors[release.status] ?? 'bg-muted text-muted-foreground')}>
              {locT.vertragStatus[release.status] ? tt(locT.vertragStatus[release.status]) : release.status}
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
          <Label className="text-xs text-muted-foreground">{tt(locT.eigentuemer)}</Label>
          <div className="flex gap-2 mt-1">
            <Input
              value={ownerName}
              onChange={e => setOwnerName(e.target.value)}
              placeholder={tt(locT.eigentuemerPh)}
              className="h-7 text-xs flex-1"
              disabled={isSigned || !darfSchreiben}
            />
            <Button
              variant="outline" size="sm" className="h-7 text-xs shrink-0"
              disabled={isSigned || !darfSchreiben || saveMutation.isPending}
              onClick={() => saveMutation.mutate({ owner_name: ownerName, location_name: locName, status: release?.status ?? 'Entwurf' })}
            >
              {tt(locT.speichern)}
            </Button>
          </div>
        </div>

        {!isSigned && darfSchreiben && (
          <Button
            variant="outline" size="sm" className="h-7 text-xs w-full gap-1.5"
            onClick={() => setShowCanvas(v => !v)}
            disabled={!ownerName.trim()}
          >
            <PenLine className="w-3 h-3" />{showCanvas ? tt(locT.abbrechen) : tt(locT.unterschriftErfassen)}
          </Button>
        )}
        {!isSigned && darfSchreiben && !ownerName.trim() && (
          <p className="text-[11px] text-muted-foreground">{tt(locT.eigentuemerZuerst)}</p>
        )}

        {isSigned && (
          <p className="text-xs text-green-400 flex items-center gap-1.5">
            <FileSignature className="w-3 h-3" />
            {tt(locT.unterschriebenAm).replace('{datum}', new Date(release.signed_at).toLocaleDateString(gs))}
          </p>
        )}

        {showCanvas && !isSigned && darfSchreiben && ownerName.trim() && (
          <SignatureCanvas
            onSave={(dataUrl) => signMutation.mutate(dataUrl)}
            disabled={signMutation.isPending}
          />
        )}
      </div>
    </div>
  )
}

// ─── Sets, Genehmigungen, Sonnenstand am Motiv (AP C3) ────────────────────────

/** Sets unter dem Motiv: Name und Notiz speichern beim Verlassen, Löschen geht in den Papierkorb. */
function SetsAbschnitt({ loc }: { loc: any }) {
  const tt = useT()
  const queryClient = useQueryClient()
  const { projectId } = useParams()
  const pid = Number(projectId)
  const { darfSchreiben } = useSchreibrecht()
  const { toast } = useToast()
  const [neu, setNeu] = useState('')
  const neuLaden = () => { queryClient.invalidateQueries({ queryKey: ['locations', pid] }); queryClient.invalidateQueries({ queryKey: ['scenes', pid] }) }
  const fehler = (e: any) => toast({ variant: 'destructive', title: tt(DT.fehler), description: e.message })
  const anlegen = useMutation({ mutationFn: () => api.locations.setAnlegen(loc.id, { name: neu }), onSuccess: () => { setNeu(''); neuLaden() }, onError: fehler })
  const aendern = useMutation({ mutationFn: ({ id, daten }: { id: number; daten: any }) => api.locations.setAendern(id, daten), onSuccess: neuLaden, onError: fehler })
  const loeschen = useMutation({ mutationFn: (id: number) => api.locations.setLoeschen(id), onSuccess: neuLaden, onError: fehler })
  const sets: any[] = loc.sets ?? []
  return (
    <div data-einfuehrung="sets" className="pt-3 border-t border-border/40 space-y-2">
      <p className="text-xs font-medium">{tt(DT.sets)}</p>
      <p className="text-[11px] text-muted-foreground">{tt(DT.setsHilfe)}</p>
      {sets.length === 0 && <p className="text-[11px] italic text-muted-foreground">{tt(DT.keineSets)}</p>}
      {sets.map((st) => (
        <div key={`${st.id}-${st.name}-${st.notes}`} className="flex flex-wrap items-center gap-2">
          <Input defaultValue={st.name} disabled={!darfSchreiben} aria-label={tt(DT.setName).replace('{name}', st.name)}
            onBlur={e => { const v = e.target.value.trim(); if (v && v !== st.name) aendern.mutate({ id: st.id, daten: { name: v } }); else e.target.value = st.name }}
            className="h-7 text-xs w-36" />
          <Input defaultValue={st.notes} disabled={!darfSchreiben} aria-label={tt(DT.setNotiz).replace('{name}', st.name)}
            onBlur={e => { if (e.target.value.trim() !== (st.notes ?? '')) aendern.mutate({ id: st.id, daten: { notes: e.target.value } }) }}
            placeholder={tt(locT.notizenPh)} className="h-7 text-xs flex-1 min-w-[8rem]" />
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">{st.szenen === 1 ? tt(DT.szeneEins) : tt(DT.setSzenen).replace('{n}', String(st.szenen ?? 0))}</span>
          {darfSchreiben && (
            <button type="button" aria-label={tt(DT.setLoeschen).replace('{name}', st.name)} onClick={() => loeschen.mutate(st.id)}
              className="text-muted-foreground/60 hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
          )}
        </div>
      ))}
      {darfSchreiben && (
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (neu.trim()) anlegen.mutate() }}>
          <Input value={neu} onChange={e => setNeu(e.target.value)} placeholder={tt(DT.neuesSet)} aria-label={tt(DT.neuesSet)} className="h-7 text-xs w-48" />
          <Button type="submit" size="sm" variant="outline" className="h-7 text-xs" disabled={!neu.trim() || anlegen.isPending}>
            <Plus className="w-3 h-3 mr-1" />{tt(DT.anlegen)}
          </Button>
        </form>
      )}
    </div>
  )
}

/**
 * Eine Genehmigung: Text speichert beim Verlassen, Auswahl sofort, ein Datum,
 * sobald es vollständig dasteht - Chrome meldet ein halb getipptes Datum als
 * leer, und Tab bleibt im Datumsfeld (gemessen in AP B2 an den Raten).
 */
function GenehmigungZeile({ g, dateien }: { g: any; dateien: any[] }) {
  const tt = useT()
  const queryClient = useQueryClient()
  const { projectId } = useParams()
  const pid = Number(projectId)
  const { darfSchreiben } = useSchreibrecht()
  const { toast } = useToast()
  const speichern = useMutation({
    mutationFn: (daten: any) => api.genehmigungen.update(g.id, daten),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['genehmigungen', pid] }); queryClient.invalidateQueries({ queryKey: ['locations', pid] }); queryClient.invalidateQueries({ queryKey: ['conflicts'] }) },
    onError: (e: any) => toast({ variant: 'destructive', title: tt(DT.fehler), description: e.message }),
  })
  const loeschen = useMutation({
    mutationFn: () => api.genehmigungen.delete(g.id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['genehmigungen', pid] }); queryClient.invalidateQueries({ queryKey: ['locations', pid] }) },
  })
  const text = (k: string) => (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { if (e.target.value.trim() !== (g[k] ?? '')) speichern.mutate({ [k]: e.target.value }) }
  const datum = (k: 'valid_from' | 'valid_until') => ({
    defaultValue: g[k] ? String(g[k]).slice(0, 10) : '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value) && e.target.value !== String(g[k] ?? '').slice(0, 10)) speichern.mutate({ [k]: e.target.value }) },
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => { if (e.target.value === '' && g[k]) speichern.mutate({ [k]: null }) },
  })
  const name = g.title || tt(DT.neueGenehmigung)
  return (
    <fieldset disabled={!darfSchreiben} className="rounded-lg border border-border/50 p-2.5 space-y-2 min-w-0">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="text-[11px] text-muted-foreground space-y-1"><span>{tt(DT.titel)}</span>
          <Input defaultValue={g.title} onBlur={text('title')} placeholder={tt(DT.titelPh)} className="h-7 text-xs" /></label>
        <label className="text-[11px] text-muted-foreground space-y-1"><span>{tt(DT.behoerde)}</span>
          <Input defaultValue={g.authority} onBlur={text('authority')} className="h-7 text-xs" /></label>
        <label className="text-[11px] text-muted-foreground space-y-1"><span>{tt(DT.status)}</span>
          <select value={g.status} onChange={e => speichern.mutate({ status: e.target.value })}
            className={cn('h-7 w-full rounded-md border border-input bg-background px-2 text-xs', g.status === 'liegt vor' ? 'text-green-600 dark:text-green-400' : g.status === 'abgelehnt' ? 'text-destructive' : '')}>
            {GENEHMIGUNG_STATUS.map(s => <option key={s} value={s}>{tt(GENEHMIGUNG_STATUS_TEXT[s])}</option>)}
          </select></label>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <label className="text-[11px] text-muted-foreground space-y-1"><span>{tt(DT.gueltigVon)}</span>
          <Input type="date" {...datum('valid_from')} className="h-7 text-xs" /></label>
        <label className="text-[11px] text-muted-foreground space-y-1"><span>{tt(DT.gueltigBis)}</span>
          <Input type="date" {...datum('valid_until')} className="h-7 text-xs" /></label>
        <label className="text-[11px] text-muted-foreground space-y-1 col-span-2 sm:col-span-1"><span>{tt(DT.datei)}</span>
          <select value={g.file_id ?? ''} onChange={e => speichern.mutate({ file_id: e.target.value ? Number(e.target.value) : null })}
            className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs">
            <option value="">{tt(DT.keineDatei)}</option>
            {dateien.map((d: any) => <option key={d.id} value={d.id}>{d.title || d.filename}</option>)}
          </select></label>
      </div>
      <div className="flex items-start gap-2">
        <label className="text-[11px] text-muted-foreground space-y-1 flex-1"><span>{tt(DT.auflagen)}</span>
          <Textarea defaultValue={g.conditions} onBlur={text('conditions')} rows={2} className="text-xs resize-none" /></label>
        {darfSchreiben && (
          <button type="button" aria-label={tt(DT.genehmigungLoeschen).replace('{name}', name)} onClick={() => loeschen.mutate()}
            className="mt-5 text-muted-foreground/60 hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
        )}
      </div>
    </fieldset>
  )
}

function GenehmigungenAbschnitt({ loc, genehmigungen, dateien }: { loc: any; genehmigungen: any[]; dateien: any[] }) {
  const tt = useT()
  const queryClient = useQueryClient()
  const { projectId } = useParams()
  const pid = Number(projectId)
  const { darfSchreiben } = useSchreibrecht()
  const { toast } = useToast()
  const anlegen = useMutation({
    mutationFn: () => api.genehmigungen.create(pid, { location_id: loc.id, title: '', status: 'offen' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['genehmigungen', pid] }); queryClient.invalidateQueries({ queryKey: ['locations', pid] }) },
    onError: (e: any) => toast({ variant: 'destructive', title: tt(DT.fehler), description: e.message }),
  })
  const eigene = genehmigungen.filter((g) => g.location_id === loc.id)
  return (
    <div data-einfuehrung="genehmigungen" className="pt-3 border-t border-border/40 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">{tt(DT.genehmigungen)}</p>
        {darfSchreiben && (
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => anlegen.mutate()} disabled={anlegen.isPending}>
            <Plus className="w-3 h-3 mr-1" />{tt(DT.neueGenehmigung)}
          </Button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">{tt(DT.genehmigungenHilfe)}</p>
      {eigene.length === 0 && <p className="text-[11px] italic text-muted-foreground">{tt(DT.keineGenehmigungen)}</p>}
      {eigene.map((g) => <GenehmigungZeile key={g.id} g={g} dateien={dateien} />)}
    </div>
  )
}

/** Sonnenauf- und -untergang am Motiv, vorbelegt mit dem ersten Drehtag hier - dieselbe Rechnung wie die Tagesdispo. */
function SonnenAbschnitt({ loc }: { loc: any }) {
  const tt = useT()
  const vorgabe = loc.erster_drehtag ? String(loc.erster_drehtag).slice(0, 10) : new Date().toISOString().slice(0, 10)
  const [datum, setDatum] = useState(vorgabe)
  const mitKoordinaten = loc.lat !== null && loc.lat !== undefined && loc.lng !== null && loc.lng !== undefined
  const { data: sonne } = useQuery({
    queryKey: ['sonne', loc.id, datum, loc.lat, loc.lng],
    queryFn: () => api.sun.get(loc.id, datum),
    enabled: mitKoordinaten && /^\d{4}-\d{2}-\d{2}$/.test(datum),
  })
  // Wie die Tagesdispo (pages/Tagesdispo.tsx): fest de-DE, 24 Stunden
  const uhr = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '-'
  return (
    <div data-einfuehrung="sonne" className="pt-3 border-t border-border/40 space-y-2">
      <p className="text-xs font-medium">{tt(DT.sonne)}</p>
      {!mitKoordinaten ? <p className="text-[11px] text-muted-foreground">{tt(DT.sonneOhneKoordinaten)}</p> : (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <Input type="date" value={datum} onChange={e => setDatum(e.target.value)} aria-label={tt(DT.sonneDatum)} className="h-7 text-xs w-40" />
          {sonne && (
            <span data-sonne className="tabular-nums">
              {tt(DT.aufgang).replace('{zeit}', uhr(sonne.sunrise))} · {tt(DT.untergang).replace('{zeit}', uhr(sonne.sunset))}
              {sonne.golden_hour_evening_start && <span className="text-muted-foreground"> · {tt(DT.goldenHour).replace('{zeit}', uhr(sonne.golden_hour_evening_start))}</span>}
            </span>
          )}
          {loc.erster_drehtag && datum === vorgabe && <span className="text-[11px] text-muted-foreground">({tt(DT.sonneErsterDrehtag)})</span>}
        </div>
      )}
    </div>
  )
}

function LocationCard({ loc, shootDays, onDelete, genehmigungen, dateien }: { loc: any; shootDays: any[]; onDelete: () => void; genehmigungen: any[]; dateien: any[] }) {
  const [form, setForm] = useState(loc)
  const [expanded, setExpanded] = useState(false)
  const queryClient = useQueryClient()
  const { projectId } = useParams()
  const pid = Number(projectId)
  const { canEdit } = useProjectPerms()
  const { darfSchreiben } = useSchreibrecht()
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
      <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/20 transition-colors"
        data-einfuehrung="motiv"
        role="button" tabIndex={0} aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setExpanded(!expanded) } }}>
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <MapPin className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{form.name || tt(locT.keinName)}</div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {[form.address, form.city].filter(Boolean).join(', ') || tt(locT.keineAdresse)}
          </div>
          {/* Sets, Szenen, Vertrag, Genehmigung (AP C3) */}
          <div data-einfuehrung="kennzeichen" className="flex flex-wrap gap-1.5 mt-1.5 text-[10px]">
            {loc.szenen_anzahl > 0 && <span className="px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{loc.szenen_anzahl === 1 ? tt(DT.szeneEins) : tt(DT.szenenKurz).replace('{n}', String(loc.szenen_anzahl))}</span>}
            {(loc.sets ?? []).length > 0 && <span className="px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground" title={(loc.sets ?? []).map((st: any) => st.name).join(', ')}>{loc.sets.length === 1 ? tt(DT.setEins) : tt(DT.setsKurz).replace('{n}', String(loc.sets.length))}</span>}
            {loc.vertrag_status && <span className="px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{tt(DT.vertrag).replace('{status}', locT.vertragStatus[loc.vertrag_status] ? tt(locT.vertragStatus[loc.vertrag_status]) : loc.vertrag_status)}</span>}
            {loc.permit_required && (loc.genehmigungen?.liegt_vor > 0
              ? <span className="px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-600 dark:text-green-400">{tt(DT.genehmigungLiegtVor)}</span>
              : <span className="px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive">{tt(DT.genehmigungFehlt)}</span>)}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {daysAtLocation > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {/* Gezählt werden Drehtage - vorher stand "Szenen" daneben */}
              {daysAtLocation} {tt(locT.drehtage)}
            </span>
          )}
          {form.power_available && (
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          )}
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              aria-label={tt(locT.aufKarte)} title={tt(locT.aufKarte)}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          {canEdit && (
            <button onClick={e => { e.stopPropagation(); onDelete() }}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors"
              title={tt(uiT.delete)} aria-label={tt(locT.motivLoeschen).replace('{name}', form.name || '')}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded form */}
      {expanded && (
        <div className="border-t border-border/40 p-4 bg-muted/20 space-y-3 animate-fade-up">
          {/* Ohne Schreibrecht gesperrt; der Motivvertrag regelt das selbst */}
          <fieldset disabled={!darfSchreiben} className="space-y-3 border-0 p-0 m-0 min-w-0">
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
              <Label className="text-xs text-muted-foreground">{tt(locT.plz)}</Label>
              <Input value={form.zip || ''} onChange={e => update('zip', e.target.value)} className="mt-1 h-8 text-xs" />
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">{tt(locT.stadt)}</Label>
            <Input value={form.city || ''} onChange={e => update('city', e.target.value)} className="mt-1 h-8 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">{tt(locT.ansprechpartner)}</Label>
              <Input value={form.contact_name || ''} onChange={e => update('contact_name', e.target.value)} className="mt-1 h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{tt(locT.telefon)}</Label>
              <Input value={form.contact_phone || ''} onChange={e => update('contact_phone', e.target.value)} className="mt-1 h-8 text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <Label className="text-xs text-muted-foreground">{tt(locT.mieteTag)}</Label>
              <Input type="number" value={(form.rental_fee || 0) / 100}
                onChange={e => update('rental_fee', Math.round(Number(e.target.value) * 100))}
                className="mt-1 h-8 text-sm" />
            </div>
            <div className="flex items-center gap-2.5 pb-1">
              <Switch checked={!!form.power_available} onCheckedChange={v => update('power_available', v)} id={`power-${loc.id}`} />
              <Label htmlFor={`power-${loc.id}`} className="text-xs cursor-pointer flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-amber-400" />{tt(locT.strom)}
              </Label>
            </div>
          </div>

          {/* Drehort-Angaben (AP C3): einmal eintragen, überall benutzt */}
          <div data-einfuehrung="drehort" className="pt-3 border-t border-border/40 space-y-3">
            <div>
              <p className="text-xs font-medium">{tt(DT.drehort)}</p>
              <p className="text-[11px] text-muted-foreground">{tt(DT.drehortHilfe)}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">{tt(DT.krankenhaus)}</Label>
                <Input value={form.hospital_name || ''} onChange={e => update('hospital_name', e.target.value)} className="mt-1 h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{tt(DT.krankenhausAdresse)}</Label>
                <Input value={form.hospital_address || ''} onChange={e => update('hospital_address', e.target.value)} className="mt-1 h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{tt(DT.krankenhausTelefon)}</Label>
                <Input value={form.hospital_phone || ''} onChange={e => update('hospital_phone', e.target.value)} className="mt-1 h-8 text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">{tt(DT.basecamp)}</Label>
                <Input value={form.basecamp || ''} onChange={e => update('basecamp', e.target.value)} className="mt-1 h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{tt(DT.parken)}</Label>
                <Input value={form.parking_info || ''} onChange={e => update('parking_info', e.target.value)} className="mt-1 h-8 text-xs" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{tt(DT.anfahrt)}</Label>
              <Textarea value={form.directions || ''} onChange={e => update('directions', e.target.value)} rows={2} className="mt-1 text-xs resize-none" />
            </div>
            <div className="flex items-center gap-2.5">
              <Switch checked={!!form.permit_required} onCheckedChange={v => update('permit_required', v)} id={`genehmigung-${loc.id}`} />
              <Label htmlFor={`genehmigung-${loc.id}`} className="text-xs cursor-pointer">{tt(DT.genehmigungNoetig)}</Label>
            </div>
          </div>

          {daysAtLocation > 0 && form.rental_fee > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-border/40">
              <span className="text-xs text-muted-foreground">{tt(locT.tageMal).replace('{n}', String(daysAtLocation)).replace('{betrag}', formatCurrency(form.rental_fee))}</span>
              <span className="text-sm font-semibold">{formatCurrency(totalCost)}</span>
            </div>
          )}

          <div>
            <Label className="text-xs text-muted-foreground">{tt(locT.labelNotes)}</Label>
            <Textarea value={form.notes || ''} onChange={e => update('notes', e.target.value)}
              rows={2} className="mt-1 text-xs resize-none" placeholder={tt(locT.notizenPh)} />
          </div>
          </fieldset>

          <SetsAbschnitt loc={loc} />
          <GenehmigungenAbschnitt loc={loc} genehmigungen={genehmigungen} dateien={dateien} />

          <LocationReleaseSection locId={loc.id} locName={form.name || tt(locT.motivFallback)} />

          <fieldset disabled={!darfSchreiben} className="grid grid-cols-2 gap-3 border-0 p-0 m-0 min-w-0">
            <div>
              <Label className="text-xs text-muted-foreground">{tt(locT.breitengrad)}</Label>
              <Input type="number" value={form.lat || ''} onChange={e => update('lat', e.target.value ? Number(e.target.value) : null)}
                className="mt-1 h-8 text-xs font-mono" placeholder="52.520008" step="any" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{tt(locT.laengengrad)}</Label>
              <Input type="number" value={form.lng || ''} onChange={e => update('lng', e.target.value ? Number(e.target.value) : null)}
                className="mt-1 h-8 text-xs font-mono" placeholder="13.404954" step="any" />
            </div>
          </fieldset>

          {form.lat && form.lng ? (
            <div className="rounded-lg overflow-hidden border border-border/60 h-44">
              <iframe
                title={tt(locT.karte)}
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
              <ExternalLink className="w-3 h-3" />{tt(locT.osmSuchen)}
            </a>
          ) : null}
          <SonnenAbschnitt loc={loc} />
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
  // Genehmigungen und die Dateien der Ablage zum Anhängen (AP C3)
  const { data: genehmigungen } = useQuery({ queryKey: ['genehmigungen', pid], queryFn: () => api.genehmigungen.list(pid) })
  const { data: ablage } = useQuery({ queryKey: ['dateien', pid, 'motive'], queryFn: () => api.dateien.liste(pid) })
  const dateien: any[] = [...(ablage?.dateien ?? [])].sort((a: any, b: any) => (a.kind === 'genehmigung' ? 0 : 1) - (b.kind === 'genehmigung' ? 0 : 1))

  const createMutation = useMutation({
    mutationFn: () => api.locations.create(pid, { name: tt(locT.neuesMotivName), city: '', address: '' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['locations', pid] }),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.locations.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['locations', pid] }),
    onError: () => toast({ title: tt(locT.fehlerLoeschen), variant: 'destructive' }),
  })

  const totalCost = (locations || []).reduce((sum: number, loc: any) => {
    const days = (shootDays || []).filter(d => d.scenes?.some((s: any) => s.location_id === loc.id)).length
    return sum + (loc.rental_fee || 0) * Math.max(days, 0)
  }, 0)

  return (
    <div className="px-5 py-6 sm:p-7 max-w-4xl mx-auto animate-fade-up">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-7">
        <div>
          <h1 className="font-display text-[28px] sm:text-[34px]">{tt(locT.title)}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tt(locT.subtitle).replace('{n}', String(locations?.length || 0))}
            {totalCost > 0 && ` · ${tt(locT.mietkosten).replace('{betrag}', formatCurrency(totalCost))}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => download(api.pdf.motivliste(pid), 'motivliste.pdf')}>
              <Download className="w-3.5 h-3.5 mr-1.5" />PDF
            </Button>
          {canEdit && (
            <Button size="sm" data-einfuehrung="neu" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
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
            <LocationCard key={loc.id} loc={loc} shootDays={shootDays || []} onDelete={() => deleteMutation.mutate(loc.id)}
              genehmigungen={genehmigungen ?? []} dateien={dateien} />
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
