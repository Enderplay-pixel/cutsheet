import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { useDownload } from '@/lib/useDownload'
import { formatDate, formatDateLong, debounce, cn, eighthsToString } from '@/lib/utils'
import {
  ChevronLeft, ChevronRight, MapPin, Clock, Users,
  Plus, Minus, ClipboardList, Save, Download, Trash2, Clapperboard,
  CloudSun, Sunrise, Sunset, Film, Send, Eye, CheckCircle2, AlertTriangle
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { TimeInput } from '@/components/ui/time-input'
import { useT } from '@/lib/useT'
import { dispoT, uiT } from '@/lib/i18n'
import { track } from '@/lib/analytics'

// ─── Dispo versenden ─────────────────────────────────────────────────────────

function entryStatus(e: any): { label: string; cls: string; icon: any } | null {
  if (e.confirmed_at) return { label: 'Bestätigt', cls: 'text-success', icon: CheckCircle2 }
  if (e.viewed_at) return { label: 'Gesehen', cls: 'text-info', icon: Eye }
  if (e.sent_at) return { label: 'Versendet', cls: 'text-muted-foreground', icon: Send }
  return null
}

function SendDispoButton({ dayId, entries, onSent }: {
  dayId: number
  entries: any[]
  onSent: () => void
}) {
  const [open, setOpen] = useState(false)
  const { toast } = useToast()

  const sendMutation = useMutation({
    mutationFn: () => api.callsheetSend.send(dayId),
    onSuccess: (result) => {
      track('call_sheet_sent', { recipients: result.sent })
      setOpen(false)
      onSent()
      toast({
        title: `Dispo an ${result.sent} ${result.sent === 1 ? 'Person' : 'Personen'} versendet`,
        description: [
          result.skipped_no_email.length > 0 && `Ohne E-Mail übersprungen: ${result.skipped_no_email.join(', ')}`,
          result.failed.length > 0 && `Fehlgeschlagen: ${result.failed.join(', ')}`,
        ].filter(Boolean).join(' · ') || 'Alle Empfänger erreicht.',
      })
    },
    onError: (e: any) => {
      setOpen(false)
      toast({ variant: 'destructive', title: 'Versand fehlgeschlagen', description: e.message })
    },
  })

  const withEmail = entries.filter((e: any) => e.email || e.person_email)
  const recipientCount = withEmail.length
  // Server löst E-Mails selbst auf - die Client-Zählung ist nur eine Vorschau;
  // wenn der Call Sheet-Endpoint keine E-Mails liefert, zeigen wir alle Einträge.
  const previewEntries = recipientCount > 0 ? withEmail : entries

  return (
    <>
      <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)} disabled={entries.length === 0}>
        <Send className="w-3.5 h-3.5" />
        Dispo versenden
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dispo versenden</DialogTitle>
            <DialogDescription>
              Jede Person erhält eine personalisierte E-Mail mit ihrer Call Time, einem
              Bestätigungs-Link und der Dispo als PDF-Anhang.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-56 overflow-y-auto rounded-lg border border-border/60 divide-y divide-border/40">
            {previewEntries.map((e: any) => (
              <div key={e.id} className="flex items-center gap-2.5 px-3 py-2 text-sm">
                <span className="font-medium flex-1 truncate">{e.person_name || e.name || '—'}</span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {e.call_time != null ? `${String(Math.floor(e.call_time / 60)).padStart(2, '0')}:${String(e.call_time % 60).padStart(2, '0')}` : ''}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2 text-[12px] text-muted-foreground">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-warning" />
            <span>Personen ohne hinterlegte E-Mail-Adresse werden übersprungen und im Ergebnis aufgelistet.</span>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending} className="gap-1.5">
              <Send className="w-3.5 h-3.5" />
              {sendMutation.isPending ? 'Wird versendet…' : 'Jetzt versenden'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── helpers ────────────────────────────────────────────────────────────────

function sceneStripColor(int_ext: string, day_night: string) {
  const ie = (int_ext || '').toUpperCase()
  const dn = (day_night || '').toUpperCase()
  if (ie === 'INT' && dn === 'TAG')   return 'bg-yellow-400'
  if (ie === 'EXT' && dn === 'TAG')   return 'bg-sky-400'
  if (ie === 'INT' && dn === 'NACHT') return 'bg-orange-500'
  return 'bg-indigo-500'  // EXT/NACHT
}

function sceneRowBg(int_ext: string, day_night: string) {
  const ie = (int_ext || '').toUpperCase()
  const dn = (day_night || '').toUpperCase()
  if (ie === 'INT' && dn === 'TAG')   return 'bg-yellow-500/5'
  if (ie === 'EXT' && dn === 'TAG')   return 'bg-sky-500/5'
  if (ie === 'INT' && dn === 'NACHT') return 'bg-orange-500/5'
  return 'bg-indigo-500/5'
}

function sceneBadgeColor(int_ext: string, day_night: string) {
  const ie = (int_ext || '').toUpperCase()
  const dn = (day_night || '').toUpperCase()
  if (ie === 'INT' && dn === 'TAG')   return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
  if (ie === 'EXT' && dn === 'TAG')   return 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300'
  if (ie === 'INT' && dn === 'NACHT') return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300'
  return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300'
}

// ─── Add-person inline panel ─────────────────────────────────────────────────

function AddPersonPanel({
  callSheet, projectId, onAdded, onClose
}: {
  callSheet: any; projectId: number; onAdded: () => void; onClose: () => void
}) {
  const tt = useT()
  const { data: crew } = useQuery({
    queryKey: ['crew', projectId],
    queryFn: () => api.crew.list(projectId),
  })
  const { data: castList } = useQuery({
    queryKey: ['cast', projectId],
    queryFn: () => api.cast.list(projectId),
  })

  const addEntryMutation = useMutation({
    mutationFn: (data: { person_type: string; person_id: number; call_time: number }) =>
      api.callSheets.addEntry(callSheet.id, data),
    onSuccess: () => onAdded(),
  })

  const assignedIds = new Set((callSheet?.entries || []).map((e: any) => `${e.person_type}:${e.person_id}`))
  const availableCrew = (crew || []).filter((c: any) => !assignedIds.has(`crew:${c.id}`))
  const availableCast = (castList || []).filter((c: any) => !assignedIds.has(`cast:${c.id}`))
  const defaultCall = callSheet?.general_call || 480

  return (
    <div className="p-4 border border-border/60 rounded-xl bg-muted/20 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {tt(dispoT.addPerson)}
        </span>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
      </div>

      {availableCast.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wide">
              {tt(dispoT.castSection)}
            </p>
            <button
              onClick={() => availableCast.forEach(c => addEntryMutation.mutate({ person_type: 'cast', person_id: c.id, call_time: defaultCall }))}
              className="text-[11px] text-primary hover:underline"
            >
              Alle hinzufügen
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableCast.map((c: any) => (
              <button key={c.id}
                onClick={() => addEntryMutation.mutate({ person_type: 'cast', person_id: c.id, call_time: defaultCall })}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-primary/30 text-xs hover:border-primary/60 hover:bg-primary/10 transition-colors bg-card"
              >
                <Plus className="w-3 h-3" />
                <span className="font-medium">{c.actor_name}</span>
                {c.character_name && <span className="text-muted-foreground">· {c.character_name}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {availableCrew.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wide">
              {tt(dispoT.crewSection)}
            </p>
            <button
              onClick={() => availableCrew.forEach(c => addEntryMutation.mutate({ person_type: 'crew', person_id: c.id, call_time: defaultCall }))}
              className="text-[11px] text-primary hover:underline"
            >
              Alle hinzufügen
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableCrew.map((c: any) => (
              <button key={c.id}
                onClick={() => addEntryMutation.mutate({ person_type: 'crew', person_id: c.id, call_time: defaultCall })}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-border/60 text-xs hover:border-primary/40 hover:bg-muted/40 transition-colors bg-card"
              >
                <Plus className="w-3 h-3" />
                <span className="font-medium">{c.name}</span>
                {c.role && <span className="text-muted-foreground">· {c.role}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {availableCrew.length === 0 && availableCast.length === 0 && (
        <p className="text-xs text-muted-foreground">{tt(dispoT.allPersonsAdded)}</p>
      )}
    </div>
  )
}

// ─── Cast / Crew section table ────────────────────────────────────────────────

function PersonSection({
  title, entries, onUpdate, onDelete, isCast
}: {
  title: string
  entries: any[]
  onUpdate: (idx: number, key: string, value: any) => void
  onDelete: (id: number) => void
  isCast: boolean
}) {
  const tt = useT()
  if (entries.length === 0) return null

  return (
    <div>
      {/* Section header */}
      <div className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-t-lg border-b border-border/40',
        isCast ? 'bg-primary/8' : 'bg-muted/40'
      )}>
        <Users className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {title}
        </span>
        <span className="ml-auto text-xs text-muted-foreground/60">{entries.length} {tt(uiT.persons)}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="border-b border-border/30 bg-muted/20">
              <th className="text-left text-[10px] text-muted-foreground/50 font-semibold uppercase tracking-wider py-2 pl-4 pr-2 w-40">
                {tt(dispoT.colName)}
              </th>
              <th className="text-left text-[10px] text-muted-foreground/50 font-semibold uppercase tracking-wider py-2 px-2 w-36">
                {isCast ? tt(dispoT.colRole) : tt(dispoT.colFunction)}
              </th>
              <th className="text-left text-[10px] text-muted-foreground/50 font-semibold uppercase tracking-wider py-2 px-2 w-28">
                {tt(dispoT.colCallTime)}
              </th>
              <th className="text-left text-[10px] text-muted-foreground/50 font-semibold uppercase tracking-wider py-2 px-2">
                {tt(dispoT.colPickup)}
              </th>
              <th className="text-left text-[10px] text-muted-foreground/50 font-semibold uppercase tracking-wider py-2 px-2">
                {tt(dispoT.colNotes)}
              </th>
              <th className="text-left text-[10px] text-muted-foreground/50 font-semibold uppercase tracking-wider py-2 px-2 w-24">
                Status
              </th>
              <th className="py-2 pr-4 w-8" />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry: any) => (
              <tr key={entry.id} className="border-b border-border/20 last:border-0 hover:bg-muted/10 transition-colors group">
                <td className="py-2.5 pl-4 pr-2">
                  <span className="font-semibold text-sm">{entry.person_name || '–'}</span>
                </td>
                <td className="py-2.5 px-2">
                  <span className="text-sm text-muted-foreground">{entry.role || '–'}</span>
                </td>
                <td className="py-2.5 px-2">
                  <TimeInput
                    value={entry.call_time || 480}
                    onChange={v => onUpdate(entry._idx, 'call_time', v)}
                    className="w-20 h-7 text-xs font-mono font-bold"
                  />
                </td>
                <td className="py-2.5 px-2">
                  <Input
                    value={entry.pickup_location || ''}
                    onChange={e => onUpdate(entry._idx, 'pickup_location', e.target.value)}
                    className="h-7 text-xs w-36"
                    placeholder="—"
                  />
                </td>
                <td className="py-2.5 px-2">
                  <Input
                    value={entry.notes || ''}
                    onChange={e => onUpdate(entry._idx, 'notes', e.target.value)}
                    className="h-7 text-xs w-44"
                    placeholder="—"
                  />
                </td>
                <td className="py-2.5 px-2">
                  {(() => {
                    const st = entryStatus(entry)
                    if (!st) return <span className="text-[11px] text-muted-foreground/30">–</span>
                    const StIcon = st.icon
                    return (
                      <span
                        className={cn('inline-flex items-center gap-1 text-[11px] font-semibold', st.cls)}
                        title={[
                          entry.sent_at && `Versendet: ${new Date(entry.sent_at).toLocaleString('de-DE')}`,
                          entry.viewed_at && `Gesehen: ${new Date(entry.viewed_at).toLocaleString('de-DE')}`,
                          entry.confirmed_at && `Bestätigt: ${new Date(entry.confirmed_at).toLocaleString('de-DE')}`,
                        ].filter(Boolean).join('\n')}
                      >
                        <StIcon className="w-3 h-3" />
                        {st.label}
                      </span>
                    )
                  })()}
                </td>
                <td className="py-2.5 pr-4">
                  <button
                    onClick={() => onDelete(entry.id)}
                    className="w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main call sheet entries block ───────────────────────────────────────────

function CallSheetBlock({ callSheet, projectId, onSaveEntries, onRefresh }: {
  callSheet: any; projectId: number; onSaveEntries: (entries: any[]) => void; onRefresh: () => void
}) {
  const tt = useT()
  const [entries, setEntries] = useState<any[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    setEntries((callSheet?.entries || []).map((e: any, i: number) => ({ ...e, _idx: i })))
  }, [callSheet?.entries])

  const updateEntry = (idx: number, key: string, value: any) => {
    setEntries(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [key]: value }
      return next
    })
  }

  const deleteEntryMutation = useMutation({
    mutationFn: (entryId: number) => api.callSheets.deleteEntry(callSheet.id, entryId),
    onSuccess: () => onRefresh(),
  })

  const rawOriginal = (callSheet?.entries || []).map((e: any, i: number) => ({ ...e, _idx: i }))
  const hasChanges = JSON.stringify(
    entries.map(({ _idx, ...rest }) => rest)
  ) !== JSON.stringify(
    rawOriginal.map(({ _idx, ...rest }: any) => rest)
  )

  const castEntries = entries.filter(e => e.person_type === 'cast')
  const crewEntries = entries.filter(e => e.person_type === 'crew')

  return (
    <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
      {/* Block header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/40 bg-muted/30">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-bold uppercase tracking-widest">{tt(dispoT.disposition)}</span>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button size="sm" onClick={() => onSaveEntries(entries.map(({ _idx, ...rest }) => rest))}>
              <Save className="w-3.5 h-3.5 mr-1.5" />{tt(uiT.save)}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowAdd(v => !v)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />{tt(dispoT.addPerson)}
          </Button>
        </div>
      </div>

      {showAdd && callSheet && (
        <div className="p-4 border-b border-border/40">
          <AddPersonPanel
            callSheet={callSheet}
            projectId={projectId}
            onAdded={() => { onRefresh(); setShowAdd(false) }}
            onClose={() => setShowAdd(false)}
          />
        </div>
      )}

      {/* Cast section */}
      <PersonSection
        title={tt(dispoT.castSection)}
        entries={castEntries}
        isCast={true}
        onUpdate={updateEntry}
        onDelete={(id) => deleteEntryMutation.mutate(id)}
      />

      {/* Divider between sections */}
      {castEntries.length > 0 && crewEntries.length > 0 && (
        <div className="border-t border-border/40" />
      )}

      {/* Crew section */}
      <PersonSection
        title={tt(dispoT.crewSection)}
        entries={crewEntries}
        isCast={false}
        onUpdate={updateEntry}
        onDelete={(id) => deleteEntryMutation.mutate(id)}
      />

      {castEntries.length === 0 && crewEntries.length === 0 && (
        <div className="py-10 text-center text-muted-foreground">
          <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-20" />
          <p className="text-sm">{tt(dispoT.noPeople)}</p>
          <p className="text-xs mt-1 opacity-60">{tt(dispoT.noPeopleHint)}</p>
        </div>
      )}
    </div>
  )
}

// ─── Scenes table ─────────────────────────────────────────────────────────────

function ScenesTable({ scenes }: { scenes: any[] }) {
  const tt = useT()
  if (!scenes || scenes.length === 0) return null

  return (
    <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
      {/* Table header */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border/40 bg-muted/30">
        <Film className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-bold uppercase tracking-widest">{tt(dispoT.scenesSection)}</span>
        <span className="ml-auto text-xs text-muted-foreground/60">{scenes.length} {tt(uiT.scenes)}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="border-b border-border/30 bg-muted/20">
              <th className="text-center text-[10px] text-muted-foreground/50 font-semibold uppercase tracking-wider py-2 pl-4 pr-2 w-14">#</th>
              <th className="text-left text-[10px] text-muted-foreground/50 font-semibold uppercase tracking-wider py-2 px-3">Set & Beschreibung</th>
              <th className="text-center text-[10px] text-muted-foreground/50 font-semibold uppercase tracking-wider py-2 px-2 w-20">INT/EXT</th>
              <th className="text-center text-[10px] text-muted-foreground/50 font-semibold uppercase tracking-wider py-2 px-2 w-16">T/N</th>
              <th className="text-center text-[10px] text-muted-foreground/50 font-semibold uppercase tracking-wider py-2 px-2 w-16">Seiten</th>
              <th className="text-left text-[10px] text-muted-foreground/50 font-semibold uppercase tracking-wider py-2 px-2">Motiv</th>
            </tr>
          </thead>
          <tbody>
            {scenes.map((s: any) => {
              const stripColor = sceneStripColor(s.int_ext, s.day_night)
              const rowBg = sceneRowBg(s.int_ext, s.day_night)
              const badgeColor = sceneBadgeColor(s.int_ext, s.day_night)
              return (
                <tr key={s.scene_id} className={cn('border-b border-border/20 last:border-0 group', rowBg)}>
                  {/* Colored left strip + scene number */}
                  <td className="py-3 pl-0 pr-2 text-center">
                    <div className="flex items-center">
                      <div className={cn('w-1 self-stretch rounded-r mr-3 flex-shrink-0', stripColor)} style={{ minHeight: '100%' }} />
                      <span className="font-mono font-bold text-base tabular-nums">{s.scene_number}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-medium">{s.title || '–'}</span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className={cn('text-[11px] px-2 py-0.5 rounded font-bold uppercase', badgeColor)}>
                      {s.int_ext || '–'}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      {s.day_night === 'TAG' ? 'Tag' : s.day_night === 'NACHT' ? 'Nacht' : (s.day_night || '–')}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {s.eighths != null ? eighthsToString(s.eighths) : '–'}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    {s.location_name ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        {s.location_name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40 text-xs">–</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap px-5 py-2.5 border-t border-border/30 bg-muted/10">
        {[
          { label: 'INT/Tag', color: 'bg-yellow-400' },
          { label: 'EXT/Tag', color: 'bg-sky-400' },
          { label: 'INT/Nacht', color: 'bg-orange-500' },
          { label: 'EXT/Nacht', color: 'bg-indigo-500' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={cn('w-2.5 h-2.5 rounded-sm', color)} />
            <span className="text-[11px] text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Component() {
  const tt = useT()
  const { projectId, dayId } = useParams()
  const pid = Number(projectId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const download = useDownload()

  const { data: allDays } = useQuery({
    queryKey: ['shoot-days', pid],
    queryFn: () => api.drehplan.listDays(pid),
  })

  const { data: project } = useQuery({
    queryKey: ['project', pid],
    queryFn: () => api.projects.get(pid),
  })

  const selectedDayId = dayId ? Number(dayId) : allDays?.[0]?.id
  const currentDay = allDays?.find((d: any) => d.id === selectedDayId)
  const currentIndex = allDays?.findIndex((d: any) => d.id === selectedDayId) ?? -1

  const { data: callSheet, isLoading } = useQuery({
    queryKey: ['call-sheet', selectedDayId],
    queryFn: () => api.callSheets.get(selectedDayId!),
    enabled: !!selectedDayId,
    // Solange versendete, aber unbestätigte Einträge existieren, den
    // Bestätigungs-Status alle 30 s aktualisieren
    refetchInterval: (query) => {
      const entries = (query.state.data as any)?.entries || []
      return entries.some((e: any) => e.sent_at && !e.confirmed_at) ? 30_000 : false
    },
  })

  const [headerForm, setHeaderForm] = useState<any>(null)
  useEffect(() => {
    if (callSheet !== undefined) {
      const defCall = project?.settings?.default_call_time ?? 480
      setHeaderForm(callSheet || {
        general_call: defCall,
        shooting_call: defCall + 30,
        weather_forecast: '',
        sunrise: '',
        sunset: '',
        notes: '',
      })
    }
  }, [callSheet, selectedDayId])

  // Fehler sichtbar machen: Ohne onError schlug das Speichern still fehl, und
  // die Aenderung war beim naechsten Laden einfach wieder weg.
  const saveFailed = (err: any) =>
    toast({ title: 'Nicht gespeichert', description: err?.message, variant: 'destructive' })

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.callSheets.createOrUpdate(selectedDayId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-sheet', selectedDayId] })
      toast({ title: tt(dispoT.saved) })
    },
    onError: saveFailed,
  })

  const saveEntriesMutation = useMutation({
    mutationFn: (entries: any[]) => api.callSheets.updateEntries(callSheet?.id!, entries),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-sheet', selectedDayId] })
      toast({ title: tt(dispoT.updated) })
    },
    onError: saveFailed,
  })

  // Offene Aenderung mitfuehren, damit sie nicht verlorengeht, wenn man direkt
  // nach dem Tippen die Seite wechselt oder das PDF erzeugt - der Speicher-
  // vorgang ist um 600 ms verzoegert und waere sonst noch nicht gelaufen.
  const pendingHeader = useRef<any>(null)
  const debouncedSave = useRef(debounce((data: any) => {
    pendingHeader.current = null
    saveMutation.mutate(data)
  }, 600)).current

  const updateHeader = (key: string, value: any) => {
    const next = { ...headerForm, [key]: value }
    setHeaderForm(next)
    pendingHeader.current = next
    debouncedSave(next)
  }

  /** Offene Aenderung sofort schreiben, ohne auf den Debounce zu warten. */
  const flushHeader = () => {
    if (!pendingHeader.current) return
    const data = pendingHeader.current
    pendingHeader.current = null
    saveMutation.mutate(data)
  }

  useEffect(() => () => { flushHeader() }, [])

  const shiftMutation = useMutation({
    mutationFn: (mins: number) => api.callSheets.shiftTimes(callSheet?.id!, mins),
    onSuccess: (_data, mins) => {
      queryClient.invalidateQueries({ queryKey: ['call-sheet', selectedDayId] })
      toast({ title: tt(dispoT.shiftedToast).replace('{n}', mins > 0 ? `+${mins}` : String(mins)) })
    },
  })

  const [shiftAmount, setShiftAmount] = useState(15)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [sonneLaedt, setSonneLaedt] = useState(false)

  // First scene location for header display
  const firstScene = currentDay?.scenes?.[0]
  const locationName = firstScene?.location_name

  /**
   * Sonnenzeiten aus dem Motiv des Tages. Die Werte kamen bisher nur aus dem
   * Kopf: die Rechnung lag im Server, die Felder im Formular, dazwischen war
   * nichts. Golden Hour ist keine Nebensache - danach wird gedreht.
   */
  const holeSonnenzeiten = async () => {
    const motivId = firstScene?.location_id
    if (!motivId || !currentDay?.date) {
      toast({ title: 'Kein Motiv oder Datum am Drehtag', variant: 'destructive' }); return
    }
    setSonneLaedt(true)
    try {
      const d = await api.sun.get(Number(motivId), String(currentDay.date).slice(0, 10))
      const uhr = (iso: string | null) => iso
        ? new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
        : ''
      const auf = uhr(d.sunrise)
      const unter = uhr(d.sunset)
      if (!auf && !unter) { toast({ title: 'Keine Sonnenzeiten berechenbar', variant: 'destructive' }); return }
      if (auf) updateHeader('sunrise', auf)
      if (unter) updateHeader('sunset', unter)
      const golden = uhr(d.golden_hour_evening_start)
      toast({
        title: `Sonne: ${auf} – ${unter}`,
        description: d.koordinaten === 'standard'
          // Nicht verschweigen: ohne Koordinaten am Motiv ist das geraten.
          ? 'Ohne Koordinaten am Motiv gerechnet (Standardort München) - im Motiv Lat/Lng eintragen für genaue Zeiten.'
          : golden ? `Golden Hour abends ab ${golden}` : undefined,
      })
    } catch {
      toast({ title: 'Sonnenzeiten nicht abrufbar', variant: 'destructive' })
    } finally {
      setSonneLaedt(false)
    }
  }

  const fetchWeather = async () => {
    const city = locationName || (project as any)?.location || ''
    if (!city || !currentDay?.date) {
      toast({ title: 'Kein Drehort oder Datum', variant: 'destructive' }); return
    }
    setWeatherLoading(true)
    try {
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=de&format=json`)
      const geoData = await geoRes.json()
      const loc = geoData.results?.[0]
      if (!loc) { toast({ title: 'Ort nicht gefunden', variant: 'destructive' }); return }

      const dateStr = currentDay.date.slice(0, 10)
      const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&daily=weathercode,temperature_2m_max,temperature_2m_min&start_date=${dateStr}&end_date=${dateStr}&timezone=Europe%2FBerlin`)
      const wData = await wRes.json()
      const code = wData.daily?.weathercode?.[0]
      const max = wData.daily?.temperature_2m_max?.[0]
      const min = wData.daily?.temperature_2m_min?.[0]

      const WMO: Record<number, string> = {
        0:'Klar', 1:'Leicht bewölkt', 2:'Bewölkt', 3:'Bedeckt',
        45:'Nebel', 48:'Raureif', 51:'Leichter Niesel', 53:'Niesel', 55:'Starker Niesel',
        61:'Leichter Regen', 63:'Regen', 65:'Starker Regen', 71:'Leichter Schnee', 73:'Schnee',
        75:'Starker Schnee', 80:'Regenschauer', 81:'Schauer', 82:'Starke Schauer', 95:'Gewitter', 99:'Starkes Gewitter'
      }
      const condition = WMO[code] ?? `Code ${code}`
      const forecast = `${condition}, ${Math.round(min)}–${Math.round(max)}°C`
      updateHeader('weather_forecast', forecast)
      toast({ title: `Wetter: ${forecast}` })
    } catch {
      toast({ title: 'Wetterdaten nicht abrufbar', variant: 'destructive' })
    } finally {
      setWeatherLoading(false)
    }
  }

  if (!allDays || allDays.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-center text-muted-foreground">
        <Clock className="w-10 h-10 mb-3 opacity-20" />
        <p className="text-sm">{tt(dispoT.nodays)}</p>
        <p className="text-xs mt-1">{tt(dispoT.nodaysHint)}</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-up space-y-5">

      {/* ── Top navigation bar ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="w-8 h-8"
            disabled={currentIndex <= 0}
            onClick={() => navigate(`/projects/${pid}/tagesdispo/${allDays[currentIndex - 1].id}`)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Select value={String(selectedDayId)} onValueChange={v => navigate(`/projects/${pid}/tagesdispo/${v}`)}>
            <SelectTrigger className="w-52 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {allDays.map((d: any) => (
                <SelectItem key={d.id} value={String(d.id)} className="text-xs">
                  {tt(dispoT.dayLabel)} {d.day_number} – {formatDate(d.date)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="w-8 h-8"
            disabled={currentIndex >= allDays.length - 1}
            onClick={() => navigate(`/projects/${pid}/tagesdispo/${allDays[currentIndex + 1].id}`)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* PDF download */}
        {selectedDayId && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={async () => {
            // Erst offene Aenderungen schreiben, sonst druckt der Server den
            // Stand von vor der letzten Eingabe
            flushHeader()
            await new Promise(r => setTimeout(r, 250))
            download(api.pdf.tagesdispo(selectedDayId), 'tagesdispo.pdf')
          }}>
              <Download className="w-3.5 h-3.5" />PDF
            </Button>
        )}

        {/* Dispo versenden */}
        {selectedDayId && callSheet && (
          <SendDispoButton
            dayId={Number(selectedDayId)}
            entries={callSheet.entries || []}
            onSent={() => queryClient.invalidateQueries({ queryKey: ['call-sheet', selectedDayId] })}
          />
        )}
      </div>

      {/* ── Call Sheet header card ───────────────────────────────────────────── */}
      <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm">
        {/* Production title bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border/40 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <Clapperboard className="w-4 h-4 text-muted-foreground" />
            <span className="font-bold text-sm uppercase tracking-widest">
              {project?.title || 'Produktion'}
            </span>
            {currentDay && (
              <span className="text-xs text-muted-foreground font-medium ml-1">
                · {tt(dispoT.dayLabel)} {currentDay.day_number} von {allDays.length}
              </span>
            )}
          </div>
          {currentDay?.date && (
            <span className="text-sm font-medium text-muted-foreground">
              {formatDateLong(currentDay.date)}
            </span>
          )}
        </div>

        {isLoading || !headerForm ? (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {/* ── Big call time cards ─────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4">
              {/* General Call */}
              <div className="bg-foreground/5 border border-border/60 rounded-xl p-5 text-center">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  {tt(dispoT.generalCall)}
                </p>
                <TimeInput
                  value={headerForm.general_call || 480}
                  onChange={v => updateHeader('general_call', v)}
                  className="h-16 text-5xl font-black text-center border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0 shadow-none"
                />
              </div>
              {/* Shooting Call */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 text-center">
                <p className="text-[11px] font-bold uppercase tracking-widest text-primary/60 mb-2">
                  {tt(dispoT.shootingCall)}
                </p>
                <TimeInput
                  value={headerForm.shooting_call || 510}
                  onChange={v => updateHeader('shooting_call', v)}
                  className="h-16 text-5xl font-black text-center border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0 shadow-none text-primary"
                />
              </div>
            </div>

            {/* ── Info strip: location, weather, sunrise, sunset ─────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Location */}
              <div className="bg-muted/30 border border-border/50 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <MapPin className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{tt(dispoT.location)}</span>
                </div>
                <p className="text-sm font-semibold truncate">
                  {locationName || <span className="text-muted-foreground font-normal">–</span>}
                </p>
              </div>

              {/* Weather */}
              <div className="bg-muted/30 border border-border/50 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <CloudSun className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{tt(dispoT.weather)}</span>
                  <button
                    onClick={fetchWeather}
                    disabled={weatherLoading}
                    className="ml-auto -my-2 -mr-2 px-2 py-2 text-[10px] text-primary hover:underline disabled:opacity-50"
                    title={tt(dispoT.weather)}
                  >
                    {weatherLoading ? tt(dispoT.weatherFetching) : tt(dispoT.weatherFetch)}
                  </button>
                </div>
                <Input
                  value={headerForm.weather_forecast || ''}
                  onChange={e => updateHeader('weather_forecast', e.target.value)}
                  className="h-7 text-xs border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0 font-semibold shadow-none"
                  placeholder={tt(dispoT.weatherPlaceholder)}
                />
              </div>

              {/* Sunrise */}
              <div className="bg-muted/30 border border-border/50 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sunrise className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{tt(dispoT.sunrise)}</span>
                  <button
                    onClick={holeSonnenzeiten}
                    disabled={sonneLaedt}
                    className="ml-auto -my-2 -mr-2 px-2 py-2 text-[10px] text-primary hover:underline disabled:opacity-50"
                    title="Sonnenauf- und -untergang aus dem Motiv des Tages"
                  >
                    {sonneLaedt ? tt(dispoT.weatherFetching) : tt(dispoT.weatherFetch)}
                  </button>
                </div>
                <Input
                  value={headerForm.sunrise || ''}
                  onChange={e => updateHeader('sunrise', e.target.value)}
                  className="h-7 text-xs border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0 font-mono font-semibold shadow-none"
                  placeholder="05:30"
                />
              </div>

              {/* Sunset */}
              <div className="bg-muted/30 border border-border/50 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sunset className="w-3 h-3 text-orange-400" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{tt(dispoT.sunset)}</span>
                </div>
                <Input
                  value={headerForm.sunset || ''}
                  onChange={e => updateHeader('sunset', e.target.value)}
                  className="h-7 text-xs border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0 font-mono font-semibold shadow-none"
                  placeholder="20:45"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Scenes table ──────────────────────────────────────────────────────── */}
      {currentDay?.scenes?.length > 0 && (
        <ScenesTable scenes={currentDay.scenes} />
      )}

      {/* ── Cast & Crew disposition ───────────────────────────────────────────── */}
      {!isLoading && headerForm && (
        <>
          {!callSheet?.id ? (
            <div className="bg-card border border-border/60 rounded-xl p-8 text-center">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground mb-1">{tt(dispoT.callSheetNotCreated)}</p>
              <p className="text-xs text-muted-foreground/60 mb-4">
                {tt(dispoT.callSheetHint)}
              </p>
              <Button size="sm" onClick={() => saveMutation.mutate(headerForm)}>
                <Save className="w-3.5 h-3.5 mr-1.5" />{tt(dispoT.createDispo)}
              </Button>
            </div>
          ) : (
            <CallSheetBlock
              callSheet={callSheet}
              projectId={pid}
              onSaveEntries={(entries) => saveEntriesMutation.mutate(entries)}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ['call-sheet', selectedDayId] })}
            />
          )}
        </>
      )}

      {/* ── Time shift + Notes ────────────────────────────────────────────────── */}
      {!isLoading && headerForm && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Time shift card */}
          <div className="lg:col-span-2 bg-card border border-border/60 rounded-xl p-4 h-fit">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
              {tt(dispoT.shiftTimes)}
            </p>
            <div className="flex items-center gap-2 mb-3">
              <Button variant="outline" size="icon" className="w-7 h-7"
                onClick={() => setShiftAmount(Math.max(5, shiftAmount - 5))}>
                <Minus className="w-3 h-3" />
              </Button>
              <span className="text-sm font-mono font-bold w-14 text-center tabular-nums">
                {shiftAmount} Min
              </span>
              <Button variant="outline" size="icon" className="w-7 h-7"
                onClick={() => setShiftAmount(shiftAmount + 5)}>
                <Plus className="w-3 h-3" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 h-8 text-xs font-bold"
                onClick={() => shiftMutation.mutate(-shiftAmount)} disabled={!callSheet?.id}>
                −{shiftAmount} Min
              </Button>
              <Button variant="outline" size="sm" className="flex-1 h-8 text-xs font-bold"
                onClick={() => shiftMutation.mutate(shiftAmount)} disabled={!callSheet?.id}>
                +{shiftAmount} Min
              </Button>
            </div>
          </div>

          {/* Notes + Catering card */}
          <div className="lg:col-span-3 space-y-3">
            <div className="bg-card border border-border/60 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {tt(dispoT.generalNotes)}
                </p>
              </div>
              <Textarea
                value={headerForm?.notes || ''}
                onChange={e => updateHeader('notes', e.target.value)}
                rows={3}
                className="text-sm resize-none"
                placeholder={tt(dispoT.notesPlaceholder)}
              />
            </div>
            <div className="bg-card border border-border/60 rounded-xl p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                🍽 {tt(dispoT.catering)}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" size="icon" className="w-8 h-8"
                  onClick={() => {
                    const n = Math.max(0, (currentDay?.catering_count || 0) - 1)
                    api.drehplan.updateDay(selectedDayId!, { catering_count: n }).then(() =>
                      queryClient.invalidateQueries({ queryKey: ['shoot-days', pid] })
                    )
                  }}>
                  <Minus className="w-3.5 h-3.5" />
                </Button>
                <div className="text-center">
                  <div className="text-2xl font-black tabular-nums">{currentDay?.catering_count || 0}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{tt(dispoT.cateringPersons)}</div>
                </div>
                <Button variant="outline" size="icon" className="w-8 h-8"
                  onClick={() => {
                    const n = (currentDay?.catering_count || 0) + 1
                    api.drehplan.updateDay(selectedDayId!, { catering_count: n }).then(() =>
                      queryClient.invalidateQueries({ queryKey: ['shoot-days', pid] })
                    )
                  }}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground ml-2">
                  {(currentDay?.catering_count || 0) === 0 ? tt(dispoT.cateringEmpty) : tt(dispoT.cateringPlan)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
