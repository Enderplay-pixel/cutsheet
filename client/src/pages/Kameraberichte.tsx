import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Trash2, Download, Camera, Check, Pencil, X, Film, CircleDot, VolumeX, Clapperboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT, useGebietsschema } from '@/lib/useT'
import { kameraberichteT as T } from '@/lib/texte/Kameraberichte'
import { csvHerunterladen } from '@/lib/csv'
import { useSchreibrecht } from '@/lib/useSchreibrecht'

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

const CAMERA_LETTERS = ['A', 'B', 'C', 'D']

const CAMERA_COLORS: Record<string, { bg: string; text: string; ring: string; badge: string }> = {
  A: { bg: 'bg-blue-500/15', text: 'text-blue-600 dark:text-blue-400', ring: 'ring-blue-500/30', badge: 'bg-blue-500' },
  B: { bg: 'bg-violet-500/15', text: 'text-violet-600 dark:text-violet-400', ring: 'ring-violet-500/30', badge: 'bg-violet-500' },
  C: { bg: 'bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-500/30', badge: 'bg-amber-500' },
  D: { bg: 'bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-500/30', badge: 'bg-emerald-500' },
}

/**
 * Nächste Take-Nummer je Szene. Vorher zählte sie über alle Szenen des
 * Berichts weiter - gemessen am 01.11.2026: nach Szene 5 Take 1 bis 3 bekam
 * Szene 6 "Take 4". Auf der Klappe beginnt jede Szene wieder bei 1.
 */
function naechsterTake(takes: any[], szene: string): number {
  const s = szene.trim().toLowerCase()
  const nummern = takes.filter(t => String(t.scene_number ?? '').trim().toLowerCase() === s).map(t => Number(t.take_number) || 0)
  return Math.max(0, ...nummern) + 1
}

function CameraLetterCircle({ letter, size = 'md', selected = false }: { letter: string; size?: 'sm' | 'md' | 'lg'; selected?: boolean }) {
  const c = CAMERA_COLORS[letter] ?? CAMERA_COLORS['A']
  const sizeClass = size === 'lg' ? 'w-14 h-14 text-xl' : size === 'sm' ? 'w-7 h-7 text-xs' : 'w-10 h-10 text-sm'
  return (
    <div className={cn(
      'rounded-full flex items-center justify-center font-bold ring-2 transition-all',
      c.bg, c.text, c.ring,
      sizeClass,
      selected && 'ring-4 scale-110 shadow-lg'
    )}>
      {letter}
    </div>
  )
}

function TakeRow({ take, szenenListe, darf, onUpdate, onDelete }: { take: any; szenenListe: string; darf: boolean; onUpdate: (data: any) => void; onDelete: () => void }) {
  const tt = useT()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(take)
  const von = (feld: typeof T.szene) => tt(T.feldVon).replace('{feld}', tt(feld)).replace('{n}', String(take.take_number))

  // Beim Öffnen den aktuellen Stand nehmen - vorher blieb ein abgebrochener
  // Entwurf stehen und erschien beim nächsten Bearbeiten wieder.
  const bearbeiten = () => { setForm(take); setEditing(true) }

  const save = () => {
    // Meter ist eine Zahlenspalte: leeres Feld als null, Komma als Dezimaltrenner
    const roh = String(form.meters ?? '').trim().replace(',', '.')
    const meters = roh === '' ? null : Number(roh)
    onUpdate({ ...form, meters: Number.isFinite(meters as number) ? meters : null })
    setEditing(false)
  }

  if (editing) {
    return (
      <tr className="bg-muted/30">
        <td className="py-2 px-3">
          <Input value={form.scene_number || ''} onChange={e => setForm((f: any) => ({ ...f, scene_number: e.target.value }))}
            list={szenenListe} aria-label={von(T.szene)} className="h-7 text-xs w-20 bg-background" />
        </td>
        <td className="py-2 px-3 text-center text-sm font-mono">{form.take_number}</td>
        <td className="py-2 px-3">
          <Input value={form.timecode_in || ''} onChange={e => setForm((f: any) => ({ ...f, timecode_in: e.target.value }))} aria-label={von(T.tcIn)} className="h-7 text-xs w-28 font-mono bg-background" placeholder="00:00:00:00" />
        </td>
        <td className="py-2 px-3">
          <Input value={form.timecode_out || ''} onChange={e => setForm((f: any) => ({ ...f, timecode_out: e.target.value }))} aria-label={von(T.tcOut)} className="h-7 text-xs w-28 font-mono bg-background" placeholder="00:00:00:00" />
        </td>
        <td className="py-2 px-3">
          <Input value={form.meters ?? ''} onChange={e => setForm((f: any) => ({ ...f, meters: e.target.value }))} aria-label={von(T.meter)} className="h-7 text-xs w-16 bg-background" />
        </td>
        <td className="py-2 px-3 text-center">
          <Checkbox checked={!!form.circle} onCheckedChange={v => setForm((f: any) => ({ ...f, circle: !!v }))} aria-label={von(T.circle)} />
        </td>
        <td className="py-2 px-3 text-center">
          <Checkbox checked={!!form.false_start} onCheckedChange={v => setForm((f: any) => ({ ...f, false_start: !!v }))} aria-label={von(T.fehlstart)} />
        </td>
        <td className="py-2 px-3 text-center">
          <Checkbox checked={!!form.mute} onCheckedChange={v => setForm((f: any) => ({ ...f, mute: !!v }))} aria-label={von(T.tonAus)} />
        </td>
        <td className="py-2 px-3">
          <Input value={form.notes || ''} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} aria-label={von(T.notizen)} className="h-7 text-xs bg-background" />
        </td>
        <td className="py-2 px-3">
          <div className="flex gap-1">
            <button onClick={save} aria-label={tt(T.speichern)} title={tt(T.speichern)} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-green-500/15 text-green-600 transition-colors">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setEditing(false)} aria-label={tt(T.abbrechen)} title={tt(T.abbrechen)} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className={cn(
      'border-b border-border/20 hover:bg-muted/20 group text-sm transition-colors',
      take.false_start && 'opacity-40',
      take.circle && 'bg-green-500/5'
    )}>
      <td className={cn('py-2.5 px-3 font-mono text-xs', take.false_start && 'line-through text-muted-foreground')}>{take.scene_number}</td>
      <td className="py-2.5 px-3 text-center font-mono text-xs font-semibold tabular-nums">{take.take_number}</td>
      <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">{take.timecode_in || '-'}</td>
      <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">{take.timecode_out || '-'}</td>
      <td className="py-2.5 px-3 text-center text-xs tabular-nums">{take.meters || '-'}</td>
      <td className="py-2.5 px-3 text-center">
        {take.circle ? (
          <span className="inline-flex w-5 h-5 rounded-full bg-green-500 items-center justify-center shadow-sm">
            <Check className="w-2.5 h-2.5 text-white" />
          </span>
        ) : (
          <span className="text-muted-foreground/20 text-xs">-</span>
        )}
      </td>
      <td className="py-2.5 px-3 text-center">
        {take.false_start ? (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-destructive/15 text-[9px] font-bold text-destructive">
            FS
          </span>
        ) : (
          <span className="text-muted-foreground/20 text-xs">-</span>
        )}
      </td>
      <td className="py-2.5 px-3 text-center">
        {take.mute ? (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-muted text-muted-foreground">
            <VolumeX className="w-2.5 h-2.5" />
          </span>
        ) : (
          <span className="text-muted-foreground/20 text-xs">-</span>
        )}
      </td>
      <td className="py-2.5 px-3 text-xs text-muted-foreground max-w-[120px] truncate">{take.notes || ''}</td>
      <td className="py-2.5 px-3 opacity-0 group-hover:opacity-100 transition-opacity">
        {darf && (
          <div className="flex gap-1">
            <button onClick={bearbeiten} aria-label={tt(T.takeBearbeiten).replace('{n}', String(take.take_number))} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors">
              <Pencil className="w-3 h-3" />
            </button>
            <button onClick={onDelete} aria-label={tt(T.takeLoeschen).replace('{n}', String(take.take_number))} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}

function AddTakeForm({ reportId, takes, szenenListe, onAdded }: { reportId: number; takes: any[]; szenenListe: string; onAdded: () => void }) {
  const [form, setForm] = useState({ scene_number: '', timecode_in: '', timecode_out: '', notes: '', circle: false, false_start: false, mute: false })
  const tt = useT()
  const nextTakeNumber = naechsterTake(takes, form.scene_number)

  const mutation = useMutation({
    mutationFn: (data: any) => req<any>(`/camera-reports/${reportId}/takes`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      // Szene bleibt stehen: der nächste Take ist meist dieselbe Szene
      setForm(f => ({ scene_number: f.scene_number, timecode_in: '', timecode_out: '', notes: '', circle: false, false_start: false, mute: false }))
      onAdded()
    },
  })

  return (
    <div className="flex items-center gap-2 px-3 py-3 bg-muted/10 border-t border-border/30 flex-wrap">
      <div className="w-5 h-5 rounded-full bg-muted/60 flex items-center justify-center shrink-0">
        <Plus className="w-3 h-3 text-muted-foreground" />
      </div>
      <Input placeholder={tt(T.szene)} aria-label={tt(T.szene)} list={szenenListe} value={form.scene_number} onChange={e => setForm(f => ({ ...f, scene_number: e.target.value }))} className="h-7 text-xs w-20 bg-background" />
      <span className="text-xs text-muted-foreground/50 font-mono">{tt(T.takeNr).replace('{n}', String(nextTakeNumber))}</span>
      <Input placeholder={tt(T.tcIn)} aria-label={tt(T.tcIn)} value={form.timecode_in} onChange={e => setForm(f => ({ ...f, timecode_in: e.target.value }))} className="h-7 text-xs w-28 font-mono bg-background" />
      <Input placeholder={tt(T.tcOut)} aria-label={tt(T.tcOut)} value={form.timecode_out} onChange={e => setForm(f => ({ ...f, timecode_out: e.target.value }))} className="h-7 text-xs w-28 font-mono bg-background" />
      <Input placeholder={tt(T.notiz)} aria-label={tt(T.notiz)} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="h-7 text-xs w-32 bg-background" />
      <div className="flex items-center gap-1.5">
        <Checkbox id={`circle-${reportId}`} checked={form.circle} onCheckedChange={v => setForm(f => ({ ...f, circle: !!v }))} className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500" />
        <Label htmlFor={`circle-${reportId}`} className="text-xs text-muted-foreground cursor-pointer">{tt(T.circle)}</Label>
      </div>
      <Button
        size="sm"
        className="h-7 text-xs active:scale-[0.97]"
        onClick={() => mutation.mutate({ ...form, take_number: nextTakeNumber })}
        disabled={mutation.isPending}
      >
        <Plus className="w-3 h-3 mr-1" />
        {tt(T.takeHinzufuegen)}
      </Button>
    </div>
  )
}

function CameraReport({ report, szenenListe, darf, onDelete }: { report: any; szenenListe: string; darf: boolean; onDelete: (anzahlTakes: number) => void }) {
  const queryClient = useQueryClient()
  const tt = useT()

  const { data: takes, isLoading } = useQuery({
    queryKey: ['camera-report-takes', report.id],
    queryFn: () => req<any[]>(`/camera-reports/${report.id}/takes`),
  })

  // Die Kennzahlen oben rechnen aus der Berichtsliste. Vorher wurde nur die
  // Take-Liste des Berichts erneuert - gemessen am 01.11.2026: 4 Takes in der
  // Tabelle, "Takes gesamt" 3.
  const erneuern = () => {
    queryClient.invalidateQueries({ queryKey: ['camera-report-takes', report.id] })
    queryClient.invalidateQueries({ queryKey: ['camera-reports'] })
  }

  const updateTake = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => req<any>(`/camera-takes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: erneuern,
  })

  const deleteTake = useMutation({
    mutationFn: (id: number) => req<any>(`/camera-takes/${id}`, { method: 'DELETE' }),
    onSuccess: erneuern,
  })
  const takeLoeschen = (take: any) => {
    if (!window.confirm(tt(T.takeLoeschenFrage).replace('{s}', take.scene_number || '-').replace('{n}', String(take.take_number)))) return
    deleteTake.mutate(take.id)
  }

  const circleTakes = (takes ?? []).filter((t: any) => t.circle).length
  const totalTakes = (takes ?? []).length

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      {/* Reel info header bar */}
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border/30 bg-muted/20">
        <div className="flex flex-wrap items-center gap-3">
          <CameraLetterCircle letter={report.camera} size="md" />
          <div>
            <div className="font-semibold text-sm leading-tight">{tt(T.kamera).replace('{k}', report.camera)}</div>
            <div className="text-xs text-muted-foreground/60 mt-0.5 flex items-center gap-2">
              {report.magazine && <span>{tt(T.magazin).replace('{m}', report.magazine)}</span>}
              {report.magazine && report.format && <span className="text-muted-foreground/30">·</span>}
              {report.format && <span>{report.format}</span>}
              {!report.magazine && !report.format && <span>{tt(T.keineMagazin)}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Mini stats */}
          {!isLoading && (
            <div className="hidden sm:flex items-center gap-4 text-center">
              <div>
                <div className="text-xs font-bold tabular-nums">{totalTakes}</div>
                <div className="text-[10px] text-muted-foreground/40 uppercase tracking-wide">{tt(T.takes)}</div>
              </div>
              <div>
                <div className="text-xs font-bold tabular-nums text-green-600">{circleTakes}</div>
                <div className="text-[10px] text-muted-foreground/40 uppercase tracking-wide">{tt(T.circle)}</div>
              </div>
            </div>
          )}
          {darf && (
            <button
              onClick={() => onDelete(totalTakes)}
              aria-label={tt(T.berichtLoeschen).replace('{k}', report.camera)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground/30 hover:text-destructive transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Takes table */}
      {isLoading ? (
        <div className="p-5">
          <Skeleton className="h-20 rounded-lg" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/20 bg-muted/10">
                  <th className="text-left py-2.5 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground w-20">{tt(T.szene)}</th>
                  <th className="text-center py-2.5 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground w-14">{tt(T.take)}</th>
                  <th className="text-left py-2.5 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground w-28">{tt(T.tcIn)}</th>
                  <th className="text-left py-2.5 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground w-28">{tt(T.tcOut)}</th>
                  <th className="text-center py-2.5 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground w-16">{tt(T.meter)}</th>
                  <th className="text-center py-2.5 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground w-14" aria-label={tt(T.circle)}>
                    <CircleDot className="w-3.5 h-3.5 mx-auto text-green-600" />
                  </th>
                  <th className="text-center py-2.5 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground w-12" title={tt(T.fehlstart)}>{tt(T.fs)}</th>
                  <th className="text-center py-2.5 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground w-14" aria-label={tt(T.tonAus)}>
                    <VolumeX className="w-3.5 h-3.5 mx-auto" />
                  </th>
                  <th className="text-left py-2.5 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{tt(T.notizen)}</th>
                  <th className="w-16" />
                </tr>
              </thead>
              <tbody>
                {(takes || []).length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-muted-foreground/40 text-xs">
                      {tt(T.keineTakes)}
                    </td>
                  </tr>
                )}
                {(takes || []).map((take: any) => (
                  <TakeRow
                    key={take.id}
                    take={take}
                    szenenListe={szenenListe}
                    darf={darf}
                    onUpdate={data => updateTake.mutate({ id: take.id, data })}
                    onDelete={() => takeLoeschen(take)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {darf && (
            <AddTakeForm
              reportId={report.id}
              takes={takes ?? []}
              szenenListe={szenenListe}
              onAdded={erneuern}
            />
          )}
        </>
      )}
    </div>
  )
}

export function Component() {
  const { projectId: id } = useParams<{ projectId: string }>()
  const pid = Number(id)
  const queryClient = useQueryClient()
  const tt = useT()
  const gebietsschema = useGebietsschema()
  const { darfSchreiben } = useSchreibrecht()

  const [selectedDayId, setSelectedDayId] = useState<string>('')
  const [newCameraLetter, setNewCameraLetter] = useState('A')

  const { data: shootDays, isLoading: daysLoading } = useQuery({
    queryKey: ['shoot-days', pid],
    queryFn: () => req<any[]>(`/projects/${pid}/shoot-days`),
  })

  const { data: reports, isLoading: reportsLoading } = useQuery({
    queryKey: ['camera-reports', selectedDayId],
    queryFn: () => req<any[]>(`/shoot-days/${selectedDayId}/camera-reports`),
    enabled: !!selectedDayId,
  })

  // Der Server nennt die Spalte `camera`. Die Seite schickte und las
  // `camera_letter` - gemessen am 01.11.2026: jeder Bericht hieß
  // "Kamera undefined", "Kamera B hinzufügen" speicherte A.
  const usedLetters = new Set((reports || []).map((r: any) => r.camera))
  const availableLetters = CAMERA_LETTERS.filter(l => !usedLetters.has(l))
  const kamera = availableLetters.includes(newCameraLetter) ? newCameraLetter : availableLetters[0]

  const createReport = useMutation({
    mutationFn: () => req<any>(`/shoot-days/${selectedDayId}/camera-reports`, {
      method: 'POST',
      body: JSON.stringify({ camera: kamera }),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['camera-reports', selectedDayId] }),
  })

  const deleteReport = useMutation({
    mutationFn: (id: number) => req<any>(`/camera-reports/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['camera-reports', selectedDayId] }),
  })
  // Ein Bericht nimmt alle seine Takes mit (ON DELETE CASCADE)
  const berichtLoeschen = (report: any, anzahlTakes: number) => {
    if (!window.confirm(tt(T.berichtLoeschenFrage).replace('{k}', report.camera).replace('{n}', String(anzahlTakes)))) return
    deleteReport.mutate(report.id)
  }

  const tag = (shootDays || []).find((d: any) => String(d.id) === selectedDayId)
  // Szenen des gewählten Drehtags als Vorschlag im Szenenfeld
  const szenenListe = `kamera-szenen-${selectedDayId}`

  // Aggregate stats
  const totalReports = (reports || []).length
  const totalTakes = (reports || []).reduce((a: number, r: any) => a + (r.takes?.length ?? 0), 0)
  const circleTakes = (reports || []).reduce((a: number, r: any) => a + (r.takes ?? []).filter((t: any) => t.circle).length, 0)

  // Vorher standen hier zwei Knöpfe "PDF", die nur "Kommt bald!" meldeten.
  // Die Takes des Tages gehen als CSV an Schnitt und DIT.
  const csvAusfuhr = () => {
    const ja = tt(T.ja)
    csvHerunterladen(
      tt(T.dateiname).replace('{n}', String(tag?.day_number ?? selectedDayId)),
      [T.kameraSpalte, T.magazinSpalte, T.szene, T.take, T.tcIn, T.tcOut, T.meter, T.circle, T.fehlstart, T.tonAus, T.notizen].map(t => tt(t)),
      (reports || []).flatMap((r: any) => (r.takes ?? []).map((t: any) => [
        r.camera, r.magazine, t.scene_number, t.take_number, t.timecode_in, t.timecode_out, t.meters ?? '',
        t.circle ? ja : '', t.false_start ? ja : '', t.mute ? ja : '', t.notes,
      ])),
    )
  }

  return (
    <div className="px-5 py-6 sm:p-7 max-w-6xl mx-auto animate-fade-up">
      {/* Page hero */}
      <div className="mb-8 pb-7 border-b border-border/40 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] sm:text-[34px]">{tt(T.titel)}</h1>
          <p className="text-sm text-muted-foreground/60 mt-1.5">{tt(T.untertitel)}</p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 active:scale-[0.97]" onClick={csvAusfuhr} disabled={totalTakes === 0}>
          <Download className="w-4 h-4 mr-1.5" />
          {tt(T.alsCsv)}
        </Button>
      </div>

      {tag && (
        <datalist id={szenenListe}>
          {(tag.scenes ?? []).map((s: any) => <option key={s.id} value={s.scene_number} />)}
        </datalist>
      )}

      {/* Stats row - only when day is selected and reports loaded */}
      {selectedDayId && !reportsLoading && totalReports > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
          <div className="rounded-xl border border-border/60 bg-card p-5 card-lift group">
            <div className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
              <Clapperboard className="w-4 h-4 text-muted-foreground/70" />
            </div>
            <div className="text-[2.25rem] font-bold tabular-nums leading-none mb-1">{totalReports}</div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">{tt(T.berichte)}</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-5 card-lift group">
            <div className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
              <Film className="w-4 h-4 text-muted-foreground/70" />
            </div>
            <div className="text-[2.25rem] font-bold tabular-nums leading-none mb-1">{totalTakes}</div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">{tt(T.takesGesamt)}</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-5 card-lift group">
            <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center mb-3">
              <CircleDot className="w-4 h-4 text-green-600" />
            </div>
            <div className="text-[2.25rem] font-bold tabular-nums leading-none mb-1 text-green-600">{circleTakes}</div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">{tt(T.circleTakes)}</div>
          </div>
        </div>
      )}

      {/* Day selector */}
      <div data-einfuehrung="tag" className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40 mb-3">{tt(T.drehtag)}</p>
        <div className="rounded-xl border border-border/60 bg-card p-5">
          {daysLoading ? (
            <Skeleton className="h-9 w-56 rounded-lg" />
          ) : (
            <Select value={selectedDayId} onValueChange={setSelectedDayId}>
              <SelectTrigger className="w-full sm:w-64 bg-muted/30 border-border/40" aria-label={tt(T.drehtag)}>
                <SelectValue placeholder={tt(T.drehtagWaehlen)} />
              </SelectTrigger>
              <SelectContent>
                {(shootDays || []).map((d: any) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.date
                      ? new Date(d.date + 'T00:00:00').toLocaleDateString(gebietsschema, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                      : tt(T.tagNr).replace('{n}', String(d.day_number))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Camera letter selector + new report button */}
      {darfSchreiben && selectedDayId && availableLetters.length > 0 && (
        <div data-einfuehrung="kamera" className="mb-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40 mb-3">{tt(T.neuerBericht)}</p>
          <div className="rounded-xl border border-border/60 bg-card p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {availableLetters.map(l => (
                <button
                  key={l}
                  onClick={() => setNewCameraLetter(l)}
                  aria-label={tt(T.kameraWaehlen).replace('{k}', l)}
                  aria-pressed={kamera === l}
                  className="transition-transform hover:scale-105 active:scale-95"
                >
                  <CameraLetterCircle letter={l} size="lg" selected={kamera === l} />
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <Button
              onClick={() => createReport.mutate()}
              disabled={createReport.isPending}
              className="active:scale-[0.97]"
            >
              <Plus className="w-4 h-4 mr-2" />
              {tt(T.kameraHinzu).replace('{k}', kamera)}
            </Button>
          </div>
        </div>
      )}

      {/* Reports */}
      {!selectedDayId ? (
        <div className="text-center py-20 text-muted-foreground/30">
          <Camera className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-sm">{tt(T.drehtagAuswaehlen)}</p>
        </div>
      ) : reportsLoading ? (
        <div className="space-y-4">
          {[1, 2].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : (reports || []).length === 0 ? (
        <div className="text-center py-20 text-muted-foreground/30">
          <Camera className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-sm mb-4">{tt(T.keineBerichte)}</p>
          {darfSchreiben && availableLetters.length > 0 && (
            <Button onClick={() => createReport.mutate()} className="active:scale-[0.97]">
              <Plus className="w-4 h-4 mr-2" />
              {tt(T.ersterBericht)}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40">
            {tt(T.berichteAnzahl).replace('{n}', String(totalReports))}
          </p>
          {(reports || []).map((report: any) => (
            <CameraReport
              key={report.id}
              report={report}
              szenenListe={szenenListe}
              darf={darfSchreiben}
              onDelete={anzahl => berichtLoeschen(report, anzahl)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
