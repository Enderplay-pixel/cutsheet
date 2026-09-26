import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { useDownload } from '@/lib/useDownload'
import { formatDate, debounce, cn, dauer } from '@/lib/utils'
import { ChevronLeft, ChevronRight, FileText, Clock, Camera, AlertTriangle, Save, Download } from 'lucide-react'
import { TimeInput } from '@/components/ui/time-input'

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const download = useDownload()
  const [selectedDayIdx, setSelectedDayIdx] = useState(0)

  const { data: allDays } = useQuery({
    queryKey: ['shoot-days', pid],
    queryFn: () => api.drehplan.listDays(pid),
  })

  const selectedDay = allDays?.[selectedDayIdx]

  const { data: project } = useQuery({
    queryKey: ['project', pid],
    queryFn: () => api.projects.get(pid),
  })

  const { data: report, isLoading } = useQuery({
    queryKey: ['daily-report', selectedDay?.id],
    queryFn: () => api.dailyReports.get(selectedDay!.id),
    enabled: !!selectedDay?.id,
  })

  const [form, setForm] = useState<any>(null)
  useEffect(() => {
    if (report !== undefined) {
      const defCall = project?.settings?.default_call_time ?? 480
      const defWrap = project?.settings?.default_wrap_time ?? 1140
      setForm(report || {
        call_time: defCall, first_shot: defCall + 30, wrap: defWrap,
        pages_shot: 0, total_setups: 0,
        // Ohne diese beiden bleibt die Zeitanalyse leer: sie teilt die
        // Drehzeit des Tages auf genau die Szenen auf, die hier stehen.
        scenes_completed: [], scenes_partial: [],
        camera_rolls: '', sound_rolls: '', notes: '', production_notes: '',
      })
    }
  }, [report, selectedDay?.id])

  // Gemessene Minuten haengen an der Verbindung Drehtag-Szene, nicht am
  // Bericht - deshalb kommen sie aus dem Drehtag und werden beim Speichern
  // als eigene Abbildung mitgeschickt.
  const [istZeiten, setIstZeiten] = useState<Record<string, string>>({})
  useEffect(() => {
    const karte: Record<string, string> = {}
    for (const s of selectedDay?.scenes ?? []) {
      karte[String(s.scene_id)] = s.actual_minutes == null ? '' : String(s.actual_minutes)
    }
    setIstZeiten(karte)
  }, [selectedDay?.id, selectedDay?.scenes])

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.dailyReports.createOrUpdate(selectedDay!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-report', selectedDay?.id] })
      toast({ title: 'Tagesbericht gespeichert' })
    },
  })

  const debouncedSave = useRef(debounce((data: any) => saveMutation.mutate(data), 700)).current
  const update = (key: string, value: any) => {
    if (!form) return
    const next = { ...form, [key]: value }
    setForm(next)
    debouncedSave(next)
  }

  // Szenenstand des Tages. Eine Szene ist entweder offen, angefangen oder
  // abgedreht — nie zweierlei, deshalb beim Weiterschalten aus beiden Listen
  // entfernen und nur in die neue eintragen.
  const abgedreht: number[] = form?.scenes_completed ?? []
  const angefangen: number[] = form?.scenes_partial ?? []

  const szeneZeitSetzen = (sceneId: number, roh: string) => {
    if (!form) return
    const karte = { ...istZeiten, [String(sceneId)]: roh }
    setIstZeiten(karte)
    // Leeres Feld heisst "nicht gemessen", nicht "null Minuten"
    const abbildung: Record<string, number | null> = {}
    for (const [id, wert] of Object.entries(karte)) {
      abbildung[id] = wert.trim() === '' ? null : Number(wert)
    }
    debouncedSave({ ...form, scene_actuals: abbildung })
  }

  const szeneWeiterschalten = (sceneId: number) => {
    if (!form) return
    const istFertig = abgedreht.includes(sceneId)
    const istTeil = angefangen.includes(sceneId)
    const ohne = (xs: number[]) => xs.filter(x => x !== sceneId)

    let fertig = ohne(abgedreht)
    let teil = ohne(angefangen)
    if (!istFertig && !istTeil) teil = [...teil, sceneId]        // offen → angefangen
    else if (istTeil) fertig = [...fertig, sceneId]              // angefangen → abgedreht
    // abgedreht → offen: beide Listen bleiben ohne die Szene

    const next = { ...form, scenes_completed: fertig, scenes_partial: teil }
    setForm(next)
    debouncedSave(next)
  }

  if (!allDays || allDays.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-center text-muted-foreground">
        <FileText className="w-10 h-10 mb-3 opacity-20" />
        <p className="text-sm">Keine Drehtage vorhanden.</p>
      </div>
    )
  }

  // dauer() trägt den Tageswechsel: ein Nachtdreh von 18:00 bis 02:00 sind
  // acht Stunden, nicht minus sechzehn.
  const shootDuration = form ? dauer(form.call_time, form.wrap) : 0
  const lunchBreak = dauer(form?.lunch_in, form?.lunch_out)
  const shootRatioWarning = form && selectedDay?.total_eighths > 0 && form.pages_shot > selectedDay.total_eighths

  return (
    <div className="p-7 max-w-4xl mx-auto animate-fade-up space-y-5">
      {/* Navigation */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="w-8 h-8"
            disabled={selectedDayIdx <= 0} onClick={() => setSelectedDayIdx(i => i - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Select value={String(selectedDayIdx)} onValueChange={v => setSelectedDayIdx(Number(v))}>
            <SelectTrigger className="w-52 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {allDays.map((d: any, i: number) => (
                <SelectItem key={d.id} value={String(i)} className="text-xs">
                  Tag {d.day_number} – {formatDate(d.date)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="w-8 h-8"
            disabled={selectedDayIdx >= allDays.length - 1} onClick={() => setSelectedDayIdx(i => i + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div>
          <h1 className="text-xl font-semibold leading-tight">Tagesbericht</h1>
          {selectedDay && (
            <p className="text-sm text-muted-foreground">Drehtag {selectedDay.day_number} · {formatDate(selectedDay.date)}</p>
          )}
        </div>
      </div>

      {(isLoading || !form) ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : (
        <>
          {/* Times */}
          <div className="bg-card border border-border/60 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Zeiten</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Call Time</Label>
                <TimeInput value={form.call_time} onChange={v => update('call_time', v)} className="mt-1.5 h-10 text-lg font-bold" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">First Shot</Label>
                <TimeInput value={form.first_shot} onChange={v => update('first_shot', v)} className="mt-1.5 h-10 text-lg font-bold" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Mittagspause</Label>
                <div className="flex gap-1 mt-1.5">
                  <TimeInput value={form.lunch_in || 720} onChange={v => update('lunch_in', v)} className="h-10" />
                  <TimeInput value={form.lunch_out || 780} onChange={v => update('lunch_out', v)} className="h-10" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Drehschluss</Label>
                <TimeInput value={form.wrap} onChange={v => update('wrap', v)} className="mt-1.5 h-10 text-lg font-bold" />
              </div>
            </div>
            {shootDuration > 0 && (
              <div className="mt-4 pt-4 border-t border-border/40 flex gap-6 text-sm text-muted-foreground">
                <span>Drehdauer: <span className="text-foreground font-medium">{Math.round(shootDuration)} Min.</span></span>
                {lunchBreak > 0 && <span>Pause: <span className="text-foreground font-medium">{lunchBreak} Min.</span></span>}
                {lunchBreak > 0 && <span>Netto: <span className="text-foreground font-medium">{Math.round(shootDuration - lunchBreak)} Min.</span></span>}
              </div>
            )}
          </div>

          {/* Production data */}
          <div className="bg-card border border-border/60 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Camera className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Produktionsdaten</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Gedrehte Seiten (Achtel)</Label>
                <Input type="number" value={form.pages_shot || 0} onChange={e => update('pages_shot', Number(e.target.value))}
                  aria-label="Gedrehte Seiten in Achteln"
                  className={cn('mt-1.5 h-9', shootRatioWarning && 'border-amber-500')} />
                {selectedDay?.total_eighths > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1">Geplant: {selectedDay.total_eighths}/8</p>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Setups</Label>
                <Input type="number" value={form.total_setups || 0} onChange={e => update('total_setups', Number(e.target.value))}
                  aria-label="Anzahl Setups"
                  className="mt-1.5 h-9" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Kamerarollen</Label>
                <Input value={form.camera_rolls || ''} onChange={e => update('camera_rolls', e.target.value)}
                  className="mt-1.5 h-9 text-sm" placeholder="A001-A003" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Tonrollen / Dateien</Label>
                <Input value={form.sound_rolls || ''} onChange={e => update('sound_rolls', e.target.value)}
                  className="mt-1.5 h-9 text-sm" placeholder="T001-T003" />
              </div>
            </div>
            {shootRatioWarning && (
              <div className="mt-4 flex items-start gap-2 p-3 bg-amber-500/8 border border-amber-500/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-400">Mehr Seiten gedreht als geplant – Drehabweichung prüfen.</p>
              </div>
            )}
          </div>

          {/* Szenen heute — antippen schaltet offen → angefangen → abgedreht */}
          {selectedDay?.scenes?.length > 0 && (
            <div className="bg-card border border-border/60 rounded-xl p-5">
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                  Szenen heute
                </h2>
                <p className="text-[11px] text-muted-foreground/60">
                  {abgedreht.length} abgedreht · {angefangen.length} angefangen
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground/60 mb-3 leading-snug">
                Antippen schaltet weiter. Die Zeitanalyse verteilt die Drehzeit des Tages
                auf die hier markierten Szenen.
              </p>
              <div className="space-y-1.5">
                {selectedDay.scenes.map((s: any) => {
                  const stand = abgedreht.includes(s.scene_id) ? 'fertig'
                    : angefangen.includes(s.scene_id) ? 'teil' : 'offen'
                  return (
                    <div key={s.scene_id} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => szeneWeiterschalten(s.scene_id)}
                        aria-label={`Szene ${s.scene_number}: ${
                          stand === 'fertig' ? 'abgedreht' : stand === 'teil' ? 'angefangen' : 'offen'
                        }`}
                        className={cn(
                          'flex-1 min-w-0 text-left text-xs px-2.5 py-1.5 rounded-lg border transition-colors min-h-[36px]',
                          stand === 'fertig' && 'bg-success/15 border-success/40 text-success font-semibold',
                          stand === 'teil' && 'bg-warning/15 border-warning/40 text-warning font-semibold',
                          stand === 'offen' && 'bg-muted border-transparent text-muted-foreground hover:border-border',
                        )}
                      >
                        {/* Farbe allein sagt es nicht — der Stand steht als Wort dabei */}
                        {stand === 'fertig' ? '✓ ' : stand === 'teil' ? '· ' : ''}
                        Sz. {s.scene_number} – {s.title}
                        {stand === 'teil' && <span className="ml-1 opacity-70">(angefangen)</span>}
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <Input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={istZeiten[String(s.scene_id)] ?? ''}
                          onChange={e => szeneZeitSetzen(s.scene_id, e.target.value)}
                          placeholder={s.estimated_minutes ? String(s.estimated_minutes) : '—'}
                          aria-label={`Tatsächliche Minuten für Szene ${s.scene_number}`}
                          className="w-20 h-9 text-sm text-right tabular-nums"
                        />
                        <span className="text-[11px] text-muted-foreground/60 w-8">Min.</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-[11px] text-muted-foreground/60 mt-3 leading-snug">
                Das Feld ist die <b>gemessene</b> Zeit. Bleibt es leer, verteilt die Zeitanalyse
                die Drehzeit des Tages nach geplanter Dauer und kennzeichnet den Wert als
                geschätzt. Im Feld steht als Platzhalter die geplante Zeit.
              </p>
            </div>
          )}

          {/* Notes */}
          <div className="bg-card border border-border/60 rounded-xl p-5 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
              Berichte & Notizen
            </h2>
            <div>
              <Label className="text-xs text-muted-foreground">Drehbericht</Label>
              <Textarea value={form.production_notes || ''} onChange={e => update('production_notes', e.target.value)}
                rows={3} className="mt-1.5 text-sm resize-none"
                placeholder="Was lief gut, was war schwierig, besondere Vorkommnisse…" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Interne Notizen</Label>
              <Textarea value={form.notes || ''} onChange={e => update('notes', e.target.value)}
                rows={2} className="mt-1.5 text-sm resize-none" placeholder="Interne Anmerkungen…" />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            {selectedDay?.id && (
              <Button variant="outline" onClick={() => download(api.pdf.tagesbericht(selectedDay.id), 'tagesbericht.pdf')}>
                  <Download className="w-3.5 h-3.5 mr-1.5" />PDF
                </Button>
            )}
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {saveMutation.isPending ? 'Speichere…' : 'Tagesbericht speichern'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
