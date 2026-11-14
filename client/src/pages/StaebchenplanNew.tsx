import { useState, useMemo, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent, type DragMoveEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { api, ApiFehler } from '@/lib/api'
import { cn, formatDate, getStripClass, eighthsToString, dauer, heuteISO, SZENEN_ARTEN, type SzenenArt } from '@/lib/utils'
import { LayoutGrid, Film, Plus, Trash2, Pencil, Scissors, Wand2, ArrowRightLeft, AlertTriangle, Sun, Merge, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useToast } from '@/components/ui/use-toast'
import { useT, useGebietsschema } from '@/lib/useT'
import { useProjectPerms } from '@/contexts/ProjectRoleContext'
import { staebchenT as T } from '@/lib/texte/StaebchenplanNew'
import { drehplanT } from '@/lib/texte/Drehplan'
import { shootDayColumnT, drehtagStatusT } from '@/lib/texte/komponenten/Drehplan'
import { zielUnterDemZeiger } from '@/lib/zielUnterDemZeiger'
import {
  zeilenAus, zielBeimAblegen, zielEinenSchritt, jetzigesZiel, gleichesZiel, verschobeneTage, eintraegeDesTags,
  type Ziel, type Zeile,
} from '@/lib/boardZeilen'

/**
 * Stäbchenplan als Board (Plan Kino-Ausbau, AP A2, 14.11.2026).
 *
 * Bis dahin zeigte die Seite die Drehtage nur an - umgestellt wurde in der
 * Spaltenansicht "Drehplan", Szene für Szene (Testbericht SALZWIND: "32
 * Szenen einzeln ziehen"). Jetzt ist sie das Werkzeug zum Planen: eine Liste
 * aller Drehtage mit Tagesgrenzen, darunter die Ablage. Beide Ansichten lesen
 * und schreiben dieselben Tabellen. Wohin eine Auswahl kommt, rechnet
 * `lib/boardZeilen.ts`; geschrieben wird über `…/drehplan/verschieben`.
 */

interface DayScene {
  id?: number
  scene_id: number
  scene_number: string
  title: string
  int_ext: string
  day_night: string
  eighths: number
  estimated_minutes: number
  description?: string
  location_id?: number | null
  location_name?: string | null
  sort_order: number
}

interface Banner {
  id: number
  shoot_day_id: number
  text: string
  minutes: number
  sort_order: number
}

interface ShootDay {
  id: number
  day_number: number
  date: string
  status: string
  scenes: DayScene[]
  banner: Banner[]
}

type SortFeld = '' | 'motiv' | 'ie' | 'tn' | 'nummer'

const LEGENDE: Record<SzenenArt, keyof typeof T> = {
  'int-tag': 'intTag', 'ext-tag': 'extTag', 'int-nacht': 'intNacht', 'ext-nacht': 'extNacht',
}

/** "1:30" aus 90 Minuten - als Dauer, nicht als Uhrzeit. */
function dauerText(minuten: number): string {
  const m = Math.max(0, Math.round(minuten || 0))
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}

/** Sonnenzeit wie in der Tagesdispo (fest de-DE, "07:41") - die Abnahme vergleicht beide. */
const uhrzeit = (iso: string | null | undefined) => iso
  ? new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  : ''

/** Koordinaten wie im Server (`routes/sun.ts`): beide gesetzt und nicht 0. */
const hatKoordinaten = (m: any) => m && m.lat != null && Number(m.lat) !== 0 && m.lng != null && Number(m.lng) !== 0

// ─── Zeilen ─────────────────────────────────────────────────────────────────

/** Die Spalten eines Streifens - auf dem Telefon nur Nummer, Schauplatz, Seiten. */
const SPALTEN = 'grid grid-cols-[3rem_minmax(0,1fr)_auto] md:grid-cols-[3rem_2.5rem_4.5rem_minmax(0,1.2fr)_minmax(0,2fr)_minmax(0,1fr)_3.5rem_3.5rem_minmax(0,0.8fr)] items-center gap-x-2'

function ZielLinie({ unten }: { unten: boolean }) {
  return <div aria-hidden="true" className={cn('absolute left-0 right-0 h-0.5 bg-primary rounded-full z-10', unten ? '-bottom-[3px]' : '-top-[3px]')} />
}

function StripInhalt({ szene, figuren }: { szene: DayScene; figuren: string }) {
  return (
    <>
      <span className="font-mono font-semibold">{szene.scene_number}</span>
      <span className="hidden md:block font-mono">{szene.int_ext}</span>
      <span className="hidden md:block truncate">{szene.day_night}</span>
      <span className="truncate font-medium" title={szene.title}>{szene.title}</span>
      <span className="hidden md:block truncate text-muted-foreground" title={szene.description || undefined}>{szene.description}</span>
      <span className="hidden md:block truncate" title={szene.location_name || undefined}>{szene.location_name}</span>
      <span className="font-mono text-right">{eighthsToString(szene.eighths || 0)}</span>
      <span className="hidden md:block font-mono text-right">{dauerText(szene.estimated_minutes)}</span>
      <span className="hidden md:block font-mono truncate" title={figuren || undefined}>{figuren}</span>
    </>
  )
}

function StripZeile({ zeile, szene, figuren, markiert, darf, ziel, onKlick, onTaste }: {
  zeile: Zeile; szene: DayScene; figuren: string; markiert: boolean; darf: boolean
  ziel: { key: string; unten: boolean } | null
  onKlick: (e: React.MouseEvent) => void
  onTaste: (e: React.KeyboardEvent) => void
}) {
  const tt = useT()
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id: zeile.key, disabled: !darf })
  const name = tt(T.stripName).replace('{n}', szene.scene_number).replace('{titel}', szene.title || '')
  return (
    <div
      ref={setNodeRef}
      {...(darf ? attributes : {})}
      {...(darf ? listeners : {})}
      // Die Zeile selbst ist Greiffläche und Knopf: Ein Klick markiert, ab
      // 8 px Bewegung wird gezogen (MouseSensor). Keine Verschiebung beim
      // Drücken (Falle 2).
      role={darf ? 'button' : undefined}
      tabIndex={darf ? 0 : undefined}
      aria-pressed={darf ? markiert : undefined}
      aria-label={name}
      aria-roledescription={undefined}
      data-strip={szene.scene_id}
      onClick={darf ? onKlick : undefined}
      onKeyDown={darf ? onTaste : undefined}
      className={cn(
        'relative rounded-sm px-2 py-1.5 text-xs select-none',
        SPALTEN,
        getStripClass(szene.int_ext, szene.day_night),
        darf && 'cursor-grab active:cursor-grabbing',
        markiert && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
        isDragging && 'opacity-40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      {ziel?.key === zeile.key && <ZielLinie unten={ziel.unten} />}
      <StripInhalt szene={szene} figuren={figuren} />
    </div>
  )
}

function BannerZeile({ zeile, banner, darf, ziel, onBearbeiten, onLoeschen }: {
  zeile: Zeile; banner: Banner; darf: boolean; ziel: { key: string; unten: boolean } | null
  onBearbeiten: () => void; onLoeschen: () => void
}) {
  const tt = useT()
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id: zeile.key, disabled: !darf })
  return (
    <div
      ref={setNodeRef}
      {...(darf ? attributes : {})}
      {...(darf ? listeners : {})}
      role="group"
      tabIndex={undefined}
      aria-roledescription={undefined}
      aria-label={tt(T.bannerName).replace('{text}', banner.text)}
      className={cn(
        'relative flex items-center gap-2 rounded-sm border border-dashed border-border bg-card px-2 py-1 text-xs select-none',
        darf && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-40',
      )}
    >
      {ziel?.key === zeile.key && <ZielLinie unten={ziel.unten} />}
      <span className="flex-1 min-w-0 truncate font-medium">{banner.text}</span>
      {banner.minutes > 0 && <span className="font-mono text-muted-foreground">{tt(T.minuten).replace('{m}', String(banner.minutes))}</span>}
      {darf && (
        <>
          <button type="button" onClick={onBearbeiten} aria-label={tt(T.bannerBearbeiten).replace('{text}', banner.text)}
            className="p-1 rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button type="button" onClick={onLoeschen} aria-label={tt(T.bannerLoeschen).replace('{text}', banner.text)}
            className="p-1 rounded text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  )
}

function GrenzeZeile({ zeile, tag, achtel, minuten, tageslaenge, sonne, darf, ziel, istLetzter, onBanner, onEntfernen }: {
  zeile: Zeile; tag: ShootDay; achtel: number; minuten: number; tageslaenge: number
  sonne: { auf: string; unter: string } | null
  darf: boolean; ziel: { key: string; unten: boolean } | null; istLetzter: boolean
  onBanner: () => void; onEntfernen: () => void
}) {
  const tt = useT()
  const gebietsschema = useGebietsschema()
  // Nur Ziel, nie gezogen: Die Grenze verschiebt man, indem man Streifen
  // darüber oder darunter legt, oder man fügt eine ein und entfernt sie.
  const { setNodeRef } = useSortable({ id: zeile.key, disabled: { draggable: true, droppable: false } })
  const wochentag = tag.date
    ? new Date(`${tag.date}T12:00:00`).toLocaleDateString(gebietsschema, { weekday: 'short' })
    : ''
  const zuLang = tageslaenge > 0 && minuten > tageslaenge
  return (
    <div
      ref={setNodeRef}
      data-einfuehrung={tag.day_number === 1 ? 'tagesgrenze' : undefined}
      aria-label={tt(T.tagesgrenzeName).replace('{n}', String(tag.day_number))}
      role="group"
      className="relative flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-muted px-3 py-2 mb-2 text-xs"
    >
      {ziel?.key === zeile.key && <ZielLinie unten={ziel.unten} />}
      <span className="font-semibold text-sm">{tt(T.tag).replace('{n}', String(tag.day_number))}</span>
      <span>{tag.date ? `${wochentag} ${formatDate(tag.date)}` : tt(T.ohneDatum)}</span>
      <span className="font-mono">{tt(T.seiten).replace('{s}', eighthsToString(achtel))}</span>
      <span className={cn('font-mono', zuLang && 'text-amber-700 dark:text-amber-400 font-semibold')}>
        {tt(T.stunden).replace('{d}', dauerText(minuten))}
      </span>
      {tag.status !== 'Geplant' && (
        <span className="px-1.5 py-0.5 rounded-full bg-background border border-border">{tt(drehtagStatusT[tag.status] ?? { de: tag.status, en: tag.status, fr: tag.status })}</span>
      )}
      {sonne && (
        <span className="flex items-center gap-1" title={tt(T.sonneTitel)}>
          <Sun className="w-3.5 h-3.5" aria-hidden="true" />
          {tt(T.sonne).replace('{auf}', sonne.auf).replace('{unter}', sonne.unter)}
        </span>
      )}
      {zuLang && (
        <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
          {tt(T.ueberTageslaenge).replace('{d}', dauerText(tageslaenge))}
        </span>
      )}
      {darf && (
        <span className="ml-auto flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onBanner}
            aria-label={tt(T.bannerNeuName).replace('{n}', String(tag.day_number))}>
            <Plus className="w-3.5 h-3.5 mr-1" aria-hidden="true" />{tt(T.bannerNeu)}
          </Button>
          {!istLetzter && (
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onEntfernen}
              aria-label={tt(T.grenzeEntfernenName).replace(/\{n\}/g, String(tag.day_number)).replace('{m}', String(tag.day_number + 1))}>
              <Merge className="w-3.5 h-3.5 mr-1" aria-hidden="true" />{tt(T.grenzeEntfernen)}
            </Button>
          )}
        </span>
      )}
    </div>
  )
}

function AblageKopf({ zeile, anzahl, sortFelder, setSortFelder, ziel }: {
  zeile: Zeile; anzahl: number; sortFelder: SortFeld[]; setSortFelder: (f: SortFeld[]) => void
  ziel: { key: string; unten: boolean } | null
}) {
  const tt = useT()
  const { setNodeRef } = useSortable({ id: zeile.key, disabled: { draggable: true, droppable: false } })
  const felder: Array<[SortFeld, keyof typeof T]> = [['', 'sortKeins'], ['motiv', 'sortMotiv'], ['ie', 'sortIE'], ['tn', 'sortTN'], ['nummer', 'sortNummer']]
  return (
    <div ref={setNodeRef} data-einfuehrung="ablage" className="relative mt-4 mb-2 flex flex-wrap items-center gap-2 border-t-2 border-border pt-3">
      {ziel?.key === zeile.key && <ZielLinie unten={ziel.unten} />}
      <h2 className="font-semibold text-sm">{tt(T.ablage)}</h2>
      <span className="text-xs text-muted-foreground">
        {anzahl > 0 ? tt(T.ablageZahl).replace('{n}', String(anzahl)) : tt(T.alleVerplant)}
      </span>
      {anzahl > 1 && (
        <span className="ml-auto flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">{tt(T.sortieren)}</span>
          {[0, 1, 2].map((i) => (
            <Select key={i} value={sortFelder[i] || 'keins'}
              onValueChange={(v) => { const neu = [...sortFelder]; neu[i] = (v === 'keins' ? '' : v) as SortFeld; setSortFelder(neu) }}>
              <SelectTrigger className="h-7 w-28 text-xs" aria-label={tt(T.sortFeld).replace('{n}', String(i + 1))}><SelectValue /></SelectTrigger>
              <SelectContent>
                {felder.map(([wert, text]) => <SelectItem key={wert || 'keins'} value={wert || 'keins'}>{tt(T[text] as any)}</SelectItem>)}
              </SelectContent>
            </Select>
          ))}
        </span>
      )}
    </div>
  )
}

// ─── Dialoge ────────────────────────────────────────────────────────────────

function BannerDialog({ offen, tagNummer, banner, onSchliessen, onSpeichern }: {
  offen: boolean; tagNummer: number | null; banner: Banner | null
  onSchliessen: () => void; onSpeichern: (text: string, minuten: number) => Promise<void>
}) {
  const tt = useT()
  const [text, setText] = useState('')
  const [minuten, setMinuten] = useState('0')
  const [sendet, setSendet] = useState(false)
  useEffect(() => {
    if (offen) { setText(banner?.text ?? ''); setMinuten(String(banner?.minutes ?? 0)) }
  }, [offen, banner])
  const m = Number(minuten)
  const gueltig = text.trim().length > 0 && Number.isInteger(m) && m >= 0 && m <= 1440
  return (
    <Dialog open={offen} onOpenChange={(v) => !v && onSchliessen()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{banner ? tt(T.bannerDialogBearbeiten) : tt(T.bannerDialogNeu).replace('{n}', String(tagNummer ?? ''))}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!gueltig) return
            setSendet(true)
            try { await onSpeichern(text.trim(), m) } finally { setSendet(false) }
          }}
        >
          <div>
            <Label htmlFor="banner-text" className="text-sm font-medium block mb-1">{tt(T.bannerText)}</Label>
            <Input id="banner-text" value={text} onChange={(e) => setText(e.target.value)} placeholder={tt(T.bannerTextBeispiel)} maxLength={200} autoFocus />
          </div>
          <div>
            <Label htmlFor="banner-minuten" className="text-sm font-medium block mb-1">{tt(T.bannerDauer)}</Label>
            <Input id="banner-minuten" type="number" min={0} max={1440} step={5} value={minuten} onChange={(e) => setMinuten(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onSchliessen}>{tt(T.abbrechen)}</Button>
            <Button type="submit" disabled={!gueltig || sendet}>{tt(T.speichern)}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EinteilenDialog({ offen, pid, ablage, onSchliessen, onFertig }: {
  offen: boolean; pid: number; ablage: number[]; onSchliessen: () => void; onFertig: (tage: number) => void
}) {
  const tt = useT()
  const { toast } = useToast()
  const [nach, setNach] = useState<'achtel' | 'minuten'>('achtel')
  const [wert, setWert] = useState('4')
  const [start, setStart] = useState(heuteISO())
  const [ergebnis, setErgebnis] = useState<any>(null)
  const [laeuft, setLaeuft] = useState(false)
  useEffect(() => { setErgebnis(null) }, [nach, wert, start, ablage.length])

  const zahl = Number(wert.replace(',', '.'))
  // Seiten werden in Achteln gerechnet: 4 Seiten sind 32 Achtel
  const hoechstens = nach === 'achtel' ? Math.round(zahl * 8) : Math.round(zahl)
  const gueltig = Number.isFinite(zahl) && hoechstens > 0 && /^\d{4}-\d{2}-\d{2}$/.test(start) && ablage.length > 0

  const rufe = async (nurZeigen: boolean) => {
    setLaeuft(true)
    try {
      const r = await api.drehplan.einteilen(pid, { nach, hoechstens, start, nurZeigen, szenen: ablage })
      if (nurZeigen) setErgebnis(r)
      else onFertig(r.tage)
    } catch (e: any) {
      toast({ title: tt(T.fehler), description: e.message, variant: 'destructive' })
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <Dialog open={offen} onOpenChange={(v) => !v && onSchliessen()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{tt(T.einteilenTitel)}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{tt(T.einteilenText).replace('{n}', String(ablage.length))}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-sm font-medium block mb-1">{tt(T.grenzeArt)}</Label>
            <Select value={nach} onValueChange={(v) => { setNach(v as any); setWert(v === 'achtel' ? '4' : '480') }}>
              <SelectTrigger className="h-9" aria-label={tt(T.grenzeArt)}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="achtel">{tt(T.nachSeiten)}</SelectItem>
                <SelectItem value="minuten">{tt(T.nachMinuten)}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="einteilen-grenze" className="text-sm font-medium block mb-1">{tt(T.grenze)}</Label>
            <Input id="einteilen-grenze" inputMode="decimal" value={wert} onChange={(e) => setWert(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="einteilen-start" className="text-sm font-medium block mb-1">{tt(T.start)}</Label>
            <Input id="einteilen-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
        </div>
        {ergebnis && (
          <div role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
            <p className="font-medium">
              {tt(T.ergibt).replace('{n}', String(ergebnis.tage)).replace('{von}', formatDate(ergebnis.von)).replace('{bis}', formatDate(ergebnis.bis))}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tt(T.ergibtDavon).replace('{neu}', String(ergebnis.neu)).replace('{gefuellt}', String(ergebnis.gefuellt))}
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onSchliessen}>{tt(T.abbrechen)}</Button>
          <Button variant="outline" onClick={() => rufe(true)} disabled={!gueltig || laeuft}>{tt(T.vorschau)}</Button>
          <Button onClick={() => rufe(false)} disabled={!gueltig || laeuft || !ergebnis}>{tt(T.uebernehmen)}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Seite ──────────────────────────────────────────────────────────────────

function StatBadge({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-4 py-2 bg-muted/60 rounded-lg">
      <span className="text-lg font-bold leading-none">{value}</span>
      <span className="text-[11px] text-muted-foreground leading-none">{label}</span>
    </div>
  )
}

export function Component() {
  const { projectId } = useParams<{ projectId: string }>()
  const pid = Number(projectId)
  const tt = useT()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  // Planen ab Abteilungsleitung, wie der Server es prüft (middleware/projectAuth.ts)
  const { canEdit: darf } = useProjectPerms()

  const { data: days, isLoading: daysLoading } = useQuery<ShootDay[]>({
    queryKey: ['shoot-days', pid],
    queryFn: () => api.drehplan.listDays(pid),
    enabled: !!pid,
  })
  const { data: allScenes, isLoading: scenesLoading } = useQuery<any[]>({
    queryKey: ['scenes', pid],
    queryFn: () => api.scenes.list(pid),
    enabled: !!pid,
  })
  const { data: rollen } = useQuery<any[]>({ queryKey: ['characters', pid], queryFn: () => api.characters.list(pid), enabled: !!pid })
  const { data: motive } = useQuery<any[]>({ queryKey: ['locations', pid], queryFn: () => api.locations.list(pid), enabled: !!pid })
  const { data: projekt } = useQuery<any>({ queryKey: ['project', pid], queryFn: () => api.projects.get(pid), enabled: !!pid })

  const [markiert, setMarkiert] = useState<number[]>([])
  const [anker, setAnker] = useState<number | null>(null)
  const [sortFelder, setSortFelder] = useState<SortFeld[]>(['', '', ''])
  const [gezogen, setGezogen] = useState<{ art: 'szene'; ids: number[] } | { art: 'banner'; id: number } | null>(null)
  const [ziel, setZiel] = useState<{ key: string; unten: boolean } | null>(null)
  const [ansage, setAnsage] = useState('')
  const [fokus, setFokus] = useState<number | null>(null)
  const [bannerDialog, setBannerDialog] = useState<{ tag: ShootDay | null; banner: Banner | null } | null>(null)
  const [einteilenOffen, setEinteilenOffen] = useState(false)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  const tage = useMemo(() => (days ?? []).slice().sort((a, b) => a.day_number - b.day_number), [days])
  const szeneNachId = useMemo(() => new Map((allScenes ?? []).map((s) => [Number(s.id), s])), [allScenes])
  const motivNachId = useMemo(() => new Map((motive ?? []).map((m) => [Number(m.id), m])), [motive])

  // Rollennummern wie auf der Dispo (server/src/routes/pdf.ts): Reihenfolge
  // der Rollenliste nach sort_order, dann Kennung - dieselbe Zählung.
  const rollenNr = useMemo(() => {
    const sortiert = (rollen ?? []).slice().sort((a, b) => (a.sort_order - b.sort_order) || (a.id - b.id))
    return new Map(sortiert.map((r, i) => [Number(r.id), i + 1]))
  }, [rollen])
  const figurenVon = (szeneId: number) => ((szeneNachId.get(szeneId)?.characters ?? []) as any[])
    .map((c) => rollenNr.get(Number(c.character_id)))
    .filter((n): n is number => n !== undefined)
    .sort((a, b) => a - b)
    .join(', ')

  const geplant = useMemo(() => new Set(tage.flatMap((t) => (t.scenes ?? []).map((s) => s.scene_id))), [tage])

  // Die Ablage: ungeplante Szenen, sortiert nach bis zu drei Feldern (Soll 9).
  // Ohne Sortierung die Reihenfolge des Servers (sort_order, Nummer).
  const ablage = useMemo(() => {
    const liste = (allScenes ?? []).filter((s) => !geplant.has(Number(s.id)))
    const wertVon = (s: any, f: SortFeld) =>
      f === 'motiv' ? String(s.location_name ?? '') : f === 'ie' ? String(s.int_ext ?? '') : f === 'tn' ? String(s.day_night ?? '') : String(s.scene_number ?? '')
    const felder = sortFelder.filter(Boolean)
    if (felder.length === 0) return liste.map((s) => Number(s.id))
    return liste
      .map((s, i) => ({ s, i }))
      .sort((a, b) => {
        for (const f of felder) {
          const v = wertVon(a.s, f).localeCompare(wertVon(b.s, f), undefined, { numeric: true, sensitivity: 'base' })
          if (v !== 0) return v
        }
        return a.i - b.i
      })
      .map(({ s }) => Number(s.id))
  }, [allScenes, geplant, sortFelder])

  const zeilen = useMemo(() => zeilenAus(tage, ablage), [tage, ablage])
  const zeilenKeys = useMemo(() => zeilen.map((z) => z.key), [zeilen])
  const markiertSet = useMemo(() => new Set(markiert), [markiert])
  // Die Auswahl in der Reihenfolge des Boards - so zieht sie gemeinsam (Soll 4)
  const auswahl = useMemo(() => zeilen.filter((z) => z.art === 'szene' && markiertSet.has(z.id)).map((z) => (z as any).id as number), [zeilen, markiertSet])

  // Was verschwunden ist, ist nicht mehr markiert
  useEffect(() => {
    const da = new Set(zeilen.filter((z) => z.art === 'szene').map((z) => (z as any).id))
    if (markiert.some((id) => !da.has(id))) setMarkiert(markiert.filter((id) => da.has(id)))
  }, [zeilen])

  // Nach Alt und Pfeil bleibt der Fokus auf dem verschobenen Streifen
  useEffect(() => {
    if (fokus === null) return
    const el = document.querySelector<HTMLElement>(`[data-strip="${fokus}"]`)
    if (el && document.activeElement !== el) el.focus()
    if (el) setFokus(null)
  }, [zeilen, fokus])

  const tageslaenge = projekt?.settings ? dauer(projekt.settings.default_call_time, projekt.settings.default_wrap_time) : 0

  const summen = (tag: ShootDay) => ({
    achtel: (tag.scenes ?? []).reduce((s, x) => s + (x.eighths || 0), 0),
    minuten: (tag.scenes ?? []).reduce((s, x) => s + (x.estimated_minutes || 0), 0)
      + (tag.banner ?? []).reduce((s, b) => s + (Number(b.minutes) || 0), 0),
  })

  // Sonnenstand an der Tagesgrenze (Nachtrag 12.11.2026): nur mit Datum und
  // einem Motiv mit Koordinaten an der ersten Szene - ohne steht dort nichts.
  const sonnenZiele = useMemo(() => tage.map((tag) => {
    const erste = eintraegeDesTags(tag).find((e) => e.art === 'szene')
    const szene = erste ? (szeneNachId.get(erste.id) ?? tag.scenes.find((s) => s.scene_id === erste.id)) : null
    const motiv = szene?.location_id ? motivNachId.get(Number(szene.location_id)) : null
    return tag.date && hatKoordinaten(motiv) ? { tagId: tag.id, motiv: Number(motiv.id), datum: String(tag.date).slice(0, 10) } : null
  }), [tage, szeneNachId, motivNachId])
  const sonnenAbfragen = useQueries({
    queries: sonnenZiele.map((z) => ({
      queryKey: ['sun', z?.motiv ?? 0, z?.datum ?? ''],
      queryFn: () => api.sun.get(z!.motiv, z!.datum),
      enabled: !!z,
      staleTime: 24 * 60 * 60 * 1000,
    })),
  })
  const sonneFuer = (tagId: number) => {
    const i = sonnenZiele.findIndex((z) => z?.tagId === tagId)
    const d: any = i >= 0 ? sonnenAbfragen[i]?.data : null
    if (!d || d.koordinaten !== 'motiv') return null
    const auf = uhrzeit(d.sunrise)
    const unter = uhrzeit(d.sunset)
    return auf && unter ? { auf, unter } : null
  }

  const erneuern = () => {
    for (const k of ['shoot-days', 'scenes', 'stats', 'conflicts', 'dood-report', 'drehtage']) {
      queryClient.invalidateQueries({ queryKey: [k, pid] })
    }
  }

  /** Eintrag für eine Szene aus der Ablage, solange der Server noch nicht geantwortet hat. */
  const neueSzene = (id: number): DayScene => {
    const s = szeneNachId.get(id) ?? {}
    return {
      scene_id: id, scene_number: s.scene_number ?? '', title: s.title ?? '', int_ext: s.int_ext ?? '', day_night: s.day_night ?? '',
      eighths: s.eighths ?? 0, estimated_minutes: s.estimated_minutes ?? 0, description: s.description ?? '',
      location_id: s.location_id ?? null, location_name: s.location_name ?? null, sort_order: 0,
    }
  }

  const ansageFuer = (szenen: number[], ziel: Ziel, neueTage: ShootDay[]) => {
    const erste = szeneNachId.get(szenen[0])
    const was = szenen.length === 1
      ? tt(T.ansageSzene).replace('{n}', String(erste?.scene_number ?? ''))
      : tt(T.ansageSzenen).replace('{n}', String(szenen.length))
    if (ziel.zielTag === null) return tt(T.ansageAblage).replace('{was}', was)
    const tag = neueTage.find((t) => t.id === ziel.zielTag)
    const stelle = tag ? eintraegeDesTags(tag).findIndex((e) => e.art === 'szene' && e.id === szenen[0]) + 1 : 0
    return tt(T.ansageTag).replace('{was}', was).replace('{n}', String(tag?.day_number ?? '')).replace('{stelle}', String(stelle))
  }

  // Optimistisch umsortieren, bei Fehler zurück und die Meldung mit dem Grund
  const verschiebenMutation = useMutation({
    mutationFn: (v: { szenen: number[]; ziel: Ziel }) =>
      api.drehplan.verschieben(pid, { szenen: v.szenen, zielTag: v.ziel.zielTag, vor: v.ziel.vor }),
    onMutate: async (v) => {
      await queryClient.cancelQueries({ queryKey: ['shoot-days', pid] })
      const vorher = queryClient.getQueryData<ShootDay[]>(['shoot-days', pid])
      const nachher = vorher ? verschobeneTage(vorher, v.szenen, v.ziel, neueSzene) : undefined
      if (nachher) queryClient.setQueryData(['shoot-days', pid], nachher)
      return { vorher, nachher }
    },
    onSuccess: (_d, v, ctx) => setAnsage(ansageFuer(v.szenen, v.ziel, ctx?.nachher ?? tage)),
    onError: (e: any, _v, ctx) => {
      if (ctx?.vorher) queryClient.setQueryData(['shoot-days', pid], ctx.vorher)
      toast({ title: tt(T.fehler), description: e.message, variant: 'destructive' })
    },
    onSettled: erneuern,
  })

  const bannerUmstellen = useMutation({
    mutationFn: (v: { id: number; shoot_day_id: number; vor: Ziel['vor'] }) => api.drehplan.bannerAendern(v.id, { shoot_day_id: v.shoot_day_id, vor: v.vor }),
    onError: (e: any) => toast({ title: tt(T.fehler), description: e.message, variant: 'destructive' }),
    onSettled: erneuern,
  })
  const bannerLoeschen = useMutation({
    mutationFn: (id: number) => api.drehplan.bannerLoeschen(id),
    onError: (e: any) => toast({ title: tt(T.fehler), description: e.message, variant: 'destructive' }),
    onSettled: erneuern,
  })

  /** Eine Auswahl an ein Ziel - mit denselben Regeln wie die Spaltenansicht für Sperr- und Reservetage. */
  const verschiebe = async (szenen: number[], ziel: Ziel) => {
    if (szenen.length === 0) return
    const jetzt = jetzigesZiel(zeilen, new Set(szenen.map((id) => `s-${id}`)))
    if (jetzt && gleichesZiel(jetzt.ziel, ziel)) return
    const tag = ziel.zielTag !== null ? tage.find((t) => t.id === ziel.zielTag) : null
    if (tag?.status === 'Sperrtag') {
      toast({ title: tt(drehplanT.sperrtagZiel), variant: 'destructive' })
      return
    }
    // Ein Reservetag zählt für niemanden. Nicht still umstellen (AP A1).
    if (tag?.status === 'Reserve') {
      if (!confirm(tt(drehplanT.reserveZiel).replace('{n}', String(tag.day_number)))) return
      try {
        await api.drehplan.updateDay(tag.id, { status: 'Geplant' })
      } catch (e: any) {
        toast({ title: tt(T.fehler), description: e.message, variant: 'destructive' })
        return
      }
    }
    verschiebenMutation.mutate({ szenen, ziel })
  }

  // ─── Markieren (Soll 4) und Tastatur (Soll 11) ───────────────────────────

  const stripsInReihe = useMemo(() => zeilen.filter((z) => z.art === 'szene').map((z) => (z as any).id as number), [zeilen])

  const klick = (e: React.MouseEvent, id: number) => {
    if (e.ctrlKey || e.metaKey) {
      setMarkiert(markiertSet.has(id) ? markiert.filter((m) => m !== id) : [...markiert, id])
    } else if (e.shiftKey && anker !== null && stripsInReihe.includes(anker)) {
      const a = stripsInReihe.indexOf(anker)
      const b = stripsInReihe.indexOf(id)
      setMarkiert(stripsInReihe.slice(Math.min(a, b), Math.max(a, b) + 1))
      return
    } else {
      setMarkiert(markiertSet.has(id) && markiert.length === 1 ? [] : [id])
    }
    setAnker(id)
  }

  const taste = (e: React.KeyboardEvent, id: number) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      setMarkiert(markiertSet.has(id) ? markiert.filter((m) => m !== id) : [...markiert, id])
      setAnker(id)
      return
    }
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      const welche = markiertSet.has(id) ? auswahl : [id]
      const z = zielEinenSchritt(zeilen, new Set(welche.map((i) => `s-${i}`)), e.key === 'ArrowUp' ? -1 : 1)
      if (!z) return
      setFokus(id)
      verschiebe(welche, z)
    }
  }

  // ─── Ziehen (Soll 3) ──────────────────────────────────────────────────────

  const handleDragStart = (e: DragStartEvent) => {
    const key = String(e.active.id)
    if (key.startsWith('s-')) {
      const id = Number(key.slice(2))
      setGezogen({ art: 'szene', ids: markiertSet.has(id) ? auswahl : [id] })
    } else if (key.startsWith('b-')) {
      setGezogen({ art: 'banner', id: Number(key.slice(2)) })
    }
  }

  // Wohin die Linie gehört: über oder unter die Zeile unter dem Zeiger,
  // je nachdem, ob die Mitte des gezogenen Streifens darüber liegt
  const handleDragMove = (e: DragMoveEvent) => {
    const over = e.over
    const aktiv = e.active.rect.current.translated
    if (!over || !aktiv) { if (ziel) setZiel(null); return }
    const unten = aktiv.top + aktiv.height / 2 > over.rect.top + over.rect.height / 2
    const key = String(over.id)
    if (ziel?.key !== key || ziel.unten !== unten) setZiel({ key, unten })
  }

  const handleDragEnd = (e: DragEndEvent) => {
    // Das Ziel aus dem Loslassen selbst, nicht nur aus der letzten Bewegung:
    // Gemessen am 14.11.2026 kam ein Zug mit nur einer Mausbewegung nicht an,
    // weil die Linie (onDragMove) nie gesetzt war.
    const aktiv = e.active.rect.current.translated
    const z = e.over && aktiv
      ? { key: String(e.over.id), unten: aktiv.top + aktiv.height / 2 > e.over.rect.top + e.over.rect.height / 2 }
      : ziel
    const g = gezogen
    setGezogen(null)
    setZiel(null)
    if (!z || !g) return
    if (g.art === 'szene') {
      const ergebnis = zielBeimAblegen(zeilen, new Set(g.ids.map((id) => `s-${id}`)), z.key, z.unten)
      if (ergebnis) verschiebe(g.ids, ergebnis)
      return
    }
    const ergebnis = zielBeimAblegen(zeilen, new Set([`b-${g.id}`]), z.key, z.unten)
    if (!ergebnis) return
    if (ergebnis.zielTag === null) {
      toast({ title: tt(T.bannerAblageNein), variant: 'destructive' })
      return
    }
    const jetzt = jetzigesZiel(zeilen, new Set([`b-${g.id}`]))
    if (jetzt && gleichesZiel(jetzt.ziel, ergebnis)) return
    bannerUmstellen.mutate({ id: g.id, shoot_day_id: ergebnis.zielTag, vor: ergebnis.vor })
  }

  // ─── Tagesgrenzen (Soll 5, 6) ─────────────────────────────────────────────

  const einzelnerImTag = auswahl.length === 1 && geplant.has(auswahl[0])

  const grenzeEinfuegen = async () => {
    if (!einzelnerImTag) return
    const id = auswahl[0]
    try {
      let neu: any
      try {
        neu = await api.drehplan.tagesgrenzeEinfuegen(pid, id)
      } catch (e) {
        // Der nächste Arbeitstag ist belegt: erst fragen, dann die Folgetage verschieben
        if (!(e instanceof ApiFehler) || e.status !== 409 || !e.daten?.verschiebbar) throw e
        if (!confirm(e.message)) return
        neu = await api.drehplan.tagesgrenzeEinfuegen(pid, id, true)
      }
      toast({ title: tt(T.grenzeEingefuegt).replace('{datum}', formatDate(neu.date)) })
    } catch (e: any) {
      toast({ title: tt(T.fehler), description: e.message, variant: 'destructive' })
    } finally {
      erneuern()
    }
  }

  const grenzeEntfernen = async (tag: ShootDay) => {
    const folgender = tage[tage.findIndex((t) => t.id === tag.id) + 1]
    if (!folgender) return
    try {
      try {
        await api.drehplan.tagesgrenzeEntfernen(pid, tag.id)
      } catch (e) {
        // Dispo, Tagesbericht oder Check-ins gehen mit: dieselbe Rückfrage wie beim Löschen eines Drehtags
        if (!(e instanceof ApiFehler) || e.status !== 409 || !e.daten?.folgen) throw e
        if (!confirm(tt(shootDayColumnT.loeschenFrage).replace('{n}', String(e.daten.tag)))) return
        await api.drehplan.tagesgrenzeEntfernen(pid, tag.id, true)
      }
      toast({ title: tt(T.grenzeEntfernt).replace('{m}', String(folgender.day_number)).replace('{n}', String(tag.day_number)) })
    } catch (e: any) {
      toast({ title: tt(T.fehler), description: e.message, variant: 'destructive' })
    } finally {
      erneuern()
    }
  }

  const bannerSpeichern = async (text: string, minuten: number) => {
    if (!bannerDialog) return
    try {
      if (bannerDialog.banner) await api.drehplan.bannerAendern(bannerDialog.banner.id, { text, minutes: minuten })
      else if (bannerDialog.tag) await api.drehplan.bannerAnlegen(bannerDialog.tag.id, { text, minutes: minuten })
      setBannerDialog(null)
    } catch (e: any) {
      toast({ title: tt(T.fehler), description: e.message, variant: 'destructive' })
    } finally {
      erneuern()
    }
  }

  // ─── Anzeige ──────────────────────────────────────────────────────────────

  const isLoading = daysLoading || scenesLoading
  const totalScenes = allScenes?.length ?? 0
  const totalEighthsAll = (allScenes ?? []).reduce((sum, s) => sum + (s.eighths ?? 0), 0)
  const isEmpty = !isLoading && totalScenes === 0 && tage.length === 0
  const tagVon = (id: number | null) => tage.find((t) => t.id === id)

  const zeileAnzeigen = (zeile: Zeile) => {
    if (zeile.art === 'szene') {
      const tag = zeile.tagId !== null ? tagVon(zeile.tagId) : null
      const szene = (tag?.scenes.find((s) => s.scene_id === zeile.id)) ?? neueSzene(zeile.id)
      const ausDerListe = szeneNachId.get(zeile.id)
      return (
        <StripZeile key={zeile.key} zeile={zeile}
          szene={{ ...szene, description: ausDerListe?.description ?? szene.description, location_name: szene.location_name ?? ausDerListe?.location_name }}
          figuren={figurenVon(zeile.id)} markiert={markiertSet.has(zeile.id)} darf={darf} ziel={ziel}
          onKlick={(e) => klick(e, zeile.id)} onTaste={(e) => taste(e, zeile.id)} />
      )
    }
    if (zeile.art === 'banner') {
      const banner = tagVon(zeile.tagId)?.banner.find((b) => b.id === zeile.id)
      if (!banner) return null
      return (
        <BannerZeile key={zeile.key} zeile={zeile} banner={banner} darf={darf} ziel={ziel}
          onBearbeiten={() => setBannerDialog({ tag: null, banner })} onLoeschen={() => bannerLoeschen.mutate(banner.id)} />
      )
    }
    if (zeile.art === 'grenze') {
      const tag = tagVon(zeile.tagId)
      if (!tag) return null
      const { achtel, minuten } = summen(tag)
      return (
        <GrenzeZeile key={zeile.key} zeile={zeile} tag={tag} achtel={achtel} minuten={minuten} tageslaenge={tageslaenge}
          sonne={sonneFuer(tag.id)} darf={darf} ziel={ziel} istLetzter={tage[tage.length - 1]?.id === tag.id}
          onBanner={() => setBannerDialog({ tag, banner: null })} onEntfernen={() => grenzeEntfernen(tag)} />
      )
    }
    return <AblageKopf key={zeile.key} zeile={zeile} anzahl={ablage.length} sortFelder={sortFelder} setSortFelder={setSortFelder} ziel={ziel} />
  }

  const gezogeneSzene = gezogen?.art === 'szene' && gezogen.ids.length === 1 ? gezogen.ids[0] : null

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 sm:px-6 pt-6 pb-4 border-b border-border bg-background">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <LayoutGrid className="w-5 h-5 text-primary" aria-hidden="true" />
              <h1 className="font-display text-[28px] sm:text-[34px]">{tt(T.titel)}</h1>
            </div>
            <p className="text-sm text-muted-foreground">{tt(T.untertitel)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {SZENEN_ARTEN.map((art) => (
              <div key={art} className="flex items-center gap-1.5">
                <div className={cn('w-5 h-5 rounded-sm', `strip-${art}`)} aria-hidden="true" />
                <span className="text-xs text-muted-foreground">{tt(T[LEGENDE[art]] as any)}</span>
              </div>
            ))}
          </div>
        </div>

        {!isLoading && !isEmpty && (
          <div data-einfuehrung="statistik" className="flex flex-wrap gap-2 mt-4">
            <StatBadge label={tt(T.totalSzenen)} value={totalScenes} />
            <StatBadge label={tt(T.verplanteSzenen)} value={geplant.size} />
            <StatBadge label={tt(T.seitenGesamt)} value={eighthsToString(totalEighthsAll)} />
            <StatBadge label={tt(T.drehtage)} value={tage.length} />
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground px-4 text-center">
            <Film className="w-12 h-12 opacity-20" aria-hidden="true" />
            <p className="text-lg font-medium">{tt(T.keinDrehplan)}</p>
            <p className="text-sm opacity-60 max-w-md">{tt(T.keinDrehplanText)}</p>
          </div>
        ) : (
          <div className="px-4 sm:px-6 py-4">
            {/* Werkzeuge: was mit der Auswahl geht */}
            <div data-einfuehrung="werkzeuge" className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 mb-3 bg-background/95 border-b border-border flex flex-wrap items-center gap-2">
              {darf ? (
                <>
                  <span className="text-sm font-medium min-w-[6rem]">{tt(T.markiert).replace('{n}', String(auswahl.length))}</span>
                  {auswahl.length > 0 && (
                    <Button variant="ghost" size="sm" className="h-8" onClick={() => setMarkiert([])}>
                      <X className="w-3.5 h-3.5 mr-1" aria-hidden="true" />{tt(T.markierungAufheben)}
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8" disabled={auswahl.length === 0}>
                        <ArrowRightLeft className="w-3.5 h-3.5 mr-1" aria-hidden="true" />{tt(T.verschiebenNach)}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
                      {tage.map((t) => (
                        <DropdownMenuItem key={t.id} disabled={t.status === 'Sperrtag'} onSelect={() => verschiebe(auswahl, { zielTag: t.id, vor: null })}>
                          {tt(T.menuTag).replace('{n}', String(t.day_number)).replace('{datum}', t.date ? formatDate(t.date) : tt(T.ohneDatum))}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuItem onSelect={() => verschiebe(auswahl, { zielTag: null, vor: null })}>{tt(T.ablage)}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="outline" size="sm" className="h-8" disabled={!einzelnerImTag} onClick={grenzeEinfuegen} title={tt(T.grenzeEinfuegenTitel)}>
                    <Scissors className="w-3.5 h-3.5 mr-1" aria-hidden="true" />{tt(T.grenzeEinfuegen)}
                  </Button>
                  <Button size="sm" className="h-8 sm:ml-auto" disabled={ablage.length === 0} onClick={() => setEinteilenOffen(true)}>
                    <Wand2 className="w-3.5 h-3.5 mr-1" aria-hidden="true" />{tt(T.einteilen)}
                  </Button>
                  <p className="basis-full text-[11px] text-muted-foreground">{tt(T.hilfeTastatur)}</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">{tt(T.nurLesen)}</p>
              )}
            </div>

            {/* Spaltenköpfe, ab Tablettbreite */}
            <div className={cn(SPALTEN, 'hidden md:grid px-2 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground')} aria-hidden="true">
              <span>{tt(T.spalteNummer)}</span><span>{tt(T.spalteIE)}</span><span>{tt(T.spalteTN)}</span>
              <span>{tt(T.spalteSchauplatz)}</span><span>{tt(T.spalteBeschreibung)}</span><span>{tt(T.spalteMotiv)}</span>
              <span className="text-right">{tt(T.spalteSeiten)}</span><span className="text-right">{tt(T.spalteZeit)}</span><span>{tt(T.spalteFiguren)}</span>
            </div>

            {isLoading ? (
              <div className="space-y-1">
                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-8 rounded-sm bg-muted animate-pulse" />)}
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={zielUnterDemZeiger}
                onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd}
                onDragCancel={() => { setGezogen(null); setZiel(null) }}>
                {/* Eine Liste über alle Zeilen: Streifen, Banner, Tagesgrenzen, Ablage */}
                <SortableContext items={zeilenKeys} strategy={verticalListSortingStrategy}>
                  <div data-einfuehrung="tafel" className="flex flex-col gap-1">
                    {zeilen.map(zeileAnzeigen)}
                  </div>
                </SortableContext>
                <DragOverlay dropAnimation={null}>
                  {gezogen?.art === 'szene' && gezogeneSzene === null && (
                    <div className="rounded-sm bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium shadow-lg w-max">
                      {tt(T.zieheSzenen).replace('{n}', String(gezogen.ids.length))}
                    </div>
                  )}
                  {gezogeneSzene !== null && (() => {
                    const s = neueSzene(gezogeneSzene)
                    return (
                      <div className={cn('rounded-sm px-2 py-1.5 text-xs shadow-lg', SPALTEN, getStripClass(s.int_ext, s.day_night), 'bg-background')}>
                        <StripInhalt szene={s} figuren={figurenVon(gezogeneSzene)} />
                      </div>
                    )
                  })()}
                  {gezogen?.art === 'banner' && (
                    <div className="rounded-sm border border-dashed border-border bg-card px-3 py-1.5 text-xs shadow-lg w-max">
                      {tage.flatMap((t) => t.banner).find((b) => b.id === gezogen.id)?.text}
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
            )}
            {/* Wo ein Streifen gelandet ist - für Vorleseanwendungen (Soll 11) */}
            <div aria-live="polite" className="sr-only">{ansage}</div>
          </div>
        )}
      </div>

      <BannerDialog offen={!!bannerDialog} tagNummer={bannerDialog?.tag?.day_number ?? null} banner={bannerDialog?.banner ?? null}
        onSchliessen={() => setBannerDialog(null)} onSpeichern={bannerSpeichern} />
      <EinteilenDialog offen={einteilenOffen} pid={pid} ablage={ablage} onSchliessen={() => setEinteilenOffen(false)}
        onFertig={(n) => {
          setEinteilenOffen(false)
          toast({ title: tt(T.eingeteilt).replace('{n}', String(n)) })
          erneuern()
          queryClient.invalidateQueries({ queryKey: ['drehplan-versions', pid] })
        }} />
    </div>
  )
}
