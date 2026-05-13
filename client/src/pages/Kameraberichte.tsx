import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, Download, Camera, Check, Pencil, X } from 'lucide-react'
import { cn } from '@/lib/utils'

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

function TakeRow({ take, onUpdate, onDelete }: { take: any; onUpdate: (data: any) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(take)

  const save = () => {
    onUpdate(form)
    setEditing(false)
  }

  if (editing) {
    return (
      <tr className="bg-muted/30">
        <td className="py-1 px-2">
          <Input value={form.scene_number || ''} onChange={e => setForm((f: any) => ({ ...f, scene_number: e.target.value }))} className="h-7 text-xs w-20" />
        </td>
        <td className="py-1 px-2 text-center text-sm font-mono">{form.take_number}</td>
        <td className="py-1 px-2">
          <Input value={form.tc_in || ''} onChange={e => setForm((f: any) => ({ ...f, tc_in: e.target.value }))} className="h-7 text-xs w-28 font-mono" placeholder="00:00:00:00" />
        </td>
        <td className="py-1 px-2">
          <Input value={form.tc_out || ''} onChange={e => setForm((f: any) => ({ ...f, tc_out: e.target.value }))} className="h-7 text-xs w-28 font-mono" placeholder="00:00:00:00" />
        </td>
        <td className="py-1 px-2">
          <Input value={form.meter || ''} onChange={e => setForm((f: any) => ({ ...f, meter: e.target.value }))} className="h-7 text-xs w-16" />
        </td>
        <td className="py-1 px-2 text-center">
          <Checkbox checked={!!form.circle} onCheckedChange={v => setForm((f: any) => ({ ...f, circle: !!v }))} />
        </td>
        <td className="py-1 px-2 text-center">
          <Checkbox checked={!!form.false_start} onCheckedChange={v => setForm((f: any) => ({ ...f, false_start: !!v }))} />
        </td>
        <td className="py-1 px-2 text-center">
          <Checkbox checked={!!form.mute} onCheckedChange={v => setForm((f: any) => ({ ...f, mute: !!v }))} />
        </td>
        <td className="py-1 px-2">
          <Input value={form.notes || ''} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} className="h-7 text-xs" />
        </td>
        <td className="py-1 px-2">
          <div className="flex gap-1">
            <button onClick={save} className="w-6 h-6 flex items-center justify-center rounded hover:bg-green-500/10 text-green-600"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => setEditing(false)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className={cn(
      'border-b border-border/20 hover:bg-muted/10 group text-sm',
      take.false_start && 'opacity-50',
      take.circle && 'bg-green-500/5'
    )}>
      <td className={cn('py-2 px-2 font-mono', take.false_start && 'line-through')}>{take.scene_number}</td>
      <td className="py-2 px-2 text-center font-mono">{take.take_number}</td>
      <td className="py-2 px-2 font-mono text-xs">{take.tc_in || '–'}</td>
      <td className="py-2 px-2 font-mono text-xs">{take.tc_out || '–'}</td>
      <td className="py-2 px-2 text-center">{take.meter || '–'}</td>
      <td className="py-2 px-2 text-center">
        {take.circle ? <span className="inline-flex w-5 h-5 rounded-full bg-green-500 items-center justify-center"><Check className="w-3 h-3 text-white" /></span> : null}
      </td>
      <td className="py-2 px-2 text-center">
        {take.false_start ? <Badge variant="outline" className="text-[10px] h-4 text-destructive border-destructive/30">FS</Badge> : null}
      </td>
      <td className="py-2 px-2 text-center">
        {take.mute ? <Badge variant="outline" className="text-[10px] h-4">Stumm</Badge> : null}
      </td>
      <td className="py-2 px-2 text-xs text-muted-foreground max-w-[120px] truncate">{take.notes || ''}</td>
      <td className="py-2 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex gap-1">
          <button onClick={() => setEditing(true)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"><Pencil className="w-3 h-3" /></button>
          <button onClick={onDelete} className="w-6 h-6 flex items-center justify-center rounded hover:bg-destructive/10 text-destructive"><Trash2 className="w-3 h-3" /></button>
        </div>
      </td>
    </tr>
  )
}

function AddTakeForm({ reportId, nextTakeNumber, onAdded }: { reportId: number; nextTakeNumber: number; onAdded: () => void }) {
  const [form, setForm] = useState({ scene_number: '', tc_in: '', tc_out: '', notes: '', circle: false, false_start: false, mute: false })

  const mutation = useMutation({
    mutationFn: (data: any) => req<any>(`/camera-reports/${reportId}/takes`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      setForm({ scene_number: '', tc_in: '', tc_out: '', notes: '', circle: false, false_start: false, mute: false })
      onAdded()
    },
  })

  return (
    <div className="flex items-center gap-2 p-3 bg-muted/20 border-t border-border/40 flex-wrap">
      <Input placeholder="Szene" value={form.scene_number} onChange={e => setForm(f => ({ ...f, scene_number: e.target.value }))} className="h-7 text-xs w-20" />
      <span className="text-xs text-muted-foreground font-mono">Take {nextTakeNumber}</span>
      <Input placeholder="TC In" value={form.tc_in} onChange={e => setForm(f => ({ ...f, tc_in: e.target.value }))} className="h-7 text-xs w-28 font-mono" />
      <Input placeholder="TC Out" value={form.tc_out} onChange={e => setForm(f => ({ ...f, tc_out: e.target.value }))} className="h-7 text-xs w-28 font-mono" />
      <Input placeholder="Notiz" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="h-7 text-xs w-32" />
      <div className="flex items-center gap-1">
        <Checkbox id={`circle-${reportId}`} checked={form.circle} onCheckedChange={v => setForm(f => ({ ...f, circle: !!v }))} />
        <Label htmlFor={`circle-${reportId}`} className="text-xs">Circle</Label>
      </div>
      <Button size="sm" className="h-7 text-xs" onClick={() => mutation.mutate({ ...form, take_number: nextTakeNumber })} disabled={mutation.isPending}>
        <Plus className="w-3 h-3 mr-1" /> Take
      </Button>
    </div>
  )
}

function CameraReport({ report, onDelete }: { report: any; onDelete: () => void }) {
  const queryClient = useQueryClient()

  const { data: takes, isLoading } = useQuery({
    queryKey: ['camera-report-takes', report.id],
    queryFn: () => req<any[]>(`/camera-reports/${report.id}/takes`),
  })

  const updateTake = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => req<any>(`/takes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['camera-report-takes', report.id] }),
  })

  const deleteTake = useMutation({
    mutationFn: (id: number) => req<any>(`/takes/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['camera-report-takes', report.id] }),
  })

  const nextTakeNumber = takes ? Math.max(0, ...takes.map((t: any) => t.take_number)) + 1 : 1

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center text-sm font-bold text-primary">
              {report.camera_letter}
            </div>
            Kamera {report.camera_letter}
            {report.magazine && <span className="text-sm font-normal text-muted-foreground">· Magazin {report.magazine}</span>}
            {report.format && <Badge variant="outline" className="text-xs">{report.format}</Badge>}
          </CardTitle>
          <div className="flex items-center gap-2">
            <button onClick={() => alert('PDF-Export: Kommt bald!')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <Download className="w-3.5 h-3.5" /> PDF
            </button>
            <button onClick={onDelete} className="w-7 h-7 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4"><Skeleton className="h-20" /></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                    <th className="text-left py-2 px-2 font-medium w-20">Szene</th>
                    <th className="text-center py-2 px-2 font-medium w-14">Take</th>
                    <th className="text-left py-2 px-2 font-medium w-28">TC In</th>
                    <th className="text-left py-2 px-2 font-medium w-28">TC Out</th>
                    <th className="text-center py-2 px-2 font-medium w-16">Meter</th>
                    <th className="text-center py-2 px-2 font-medium w-14">Circle</th>
                    <th className="text-center py-2 px-2 font-medium w-12">FS</th>
                    <th className="text-center py-2 px-2 font-medium w-14">Stumm</th>
                    <th className="text-left py-2 px-2 font-medium">Notizen</th>
                    <th className="w-14" />
                  </tr>
                </thead>
                <tbody>
                  {(takes || []).length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center py-6 text-muted-foreground text-xs">Noch keine Takes</td>
                    </tr>
                  )}
                  {(takes || []).map((take: any) => (
                    <TakeRow
                      key={take.id}
                      take={take}
                      onUpdate={data => updateTake.mutate({ id: take.id, data })}
                      onDelete={() => deleteTake.mutate(take.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <AddTakeForm
              reportId={report.id}
              nextTakeNumber={nextTakeNumber}
              onAdded={() => queryClient.invalidateQueries({ queryKey: ['camera-report-takes', report.id] })}
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function Kameraberichte() {
  const { id } = useParams<{ id: string }>()
  const pid = Number(id)
  const queryClient = useQueryClient()

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

  const createReport = useMutation({
    mutationFn: () => req<any>(`/shoot-days/${selectedDayId}/camera-reports`, {
      method: 'POST',
      body: JSON.stringify({ camera_letter: newCameraLetter }),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['camera-reports', selectedDayId] }),
  })

  const deleteReport = useMutation({
    mutationFn: (id: number) => req<any>(`/camera-reports/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['camera-reports', selectedDayId] }),
  })

  const usedLetters = new Set((reports || []).map((r: any) => r.camera_letter))
  const availableLetters = CAMERA_LETTERS.filter(l => !usedLetters.has(l))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Kameraberichte</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Takes und Kameraaufzeichnungen pro Drehtag</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => alert('PDF-Export: Kommt bald!')}>
          <Download className="w-4 h-4 mr-1.5" />
          PDF exportieren
        </Button>
      </div>

      {/* Day selector */}
      <div className="flex items-center gap-3">
        <Label className="text-sm shrink-0">Drehtag</Label>
        {daysLoading ? (
          <Skeleton className="h-9 w-48" />
        ) : (
          <Select value={selectedDayId} onValueChange={setSelectedDayId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Drehtag wählen" />
            </SelectTrigger>
            <SelectContent>
              {(shootDays || []).map((d: any) => (
                <SelectItem key={d.id} value={String(d.id)}>
                  {d.date ? new Date(d.date + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : `Tag #${d.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Add camera */}
      {selectedDayId && availableLetters.length > 0 && (
        <div className="flex items-center gap-3">
          <Camera className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Neue Kamera:</span>
          <Select value={newCameraLetter} onValueChange={setNewCameraLetter}>
            <SelectTrigger className="w-20 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableLetters.map(l => (
                <SelectItem key={l} value={l}>Kamera {l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => createReport.mutate()} disabled={createReport.isPending}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            Hinzufügen
          </Button>
        </div>
      )}

      {/* Reports */}
      {!selectedDayId ? (
        <div className="text-center py-16 text-muted-foreground">
          <Camera className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Bitte einen Drehtag auswählen</p>
        </div>
      ) : reportsLoading ? (
        <div className="space-y-4">
          {[1, 2].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : (reports || []).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Camera className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Noch keine Kameraberichte für diesen Tag</p>
          {availableLetters.length > 0 && (
            <Button size="sm" className="mt-4" onClick={() => createReport.mutate()}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Ersten Kamerabericht erstellen
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {(reports || []).map((report: any) => (
            <CameraReport
              key={report.id}
              report={report}
              onDelete={() => deleteReport.mutate(report.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
