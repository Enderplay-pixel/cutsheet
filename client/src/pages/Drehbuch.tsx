import { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, eighthsToString, debounce } from '@/lib/utils'
import { Plus, Trash2, Upload, FileText, MapPin, Users, ChevronDown, ChevronUp, Tag, Search, Film } from 'lucide-react'
import { useProjectPerms } from '@/contexts/ProjectRoleContext'

const INT_EXT_OPTIONS = ['INT', 'EXT', 'INT/EXT']
const DAY_NIGHT_OPTIONS = ['TAG', 'NACHT', 'DÄMMERUNG', 'MORGEN']
const INVENTORY_CATS = ['Requisite', 'Kostüm', 'Maske', 'SFX', 'VFX', 'Fahrzeuge', 'Tiere', 'Waffen', 'Stunts', 'Sonstiges']

const SCENE_COLORS: Record<string, { dot: string; row: string; border: string }> = {
  'INT/TAG':     { dot: 'bg-amber-400',   row: 'hover:bg-amber-500/5',   border: 'border-l-amber-400/60' },
  'EXT/TAG':     { dot: 'bg-blue-400',    row: 'hover:bg-blue-500/5',    border: 'border-l-blue-400/60' },
  'INT/NACHT':   { dot: 'bg-indigo-400',  row: 'hover:bg-indigo-500/5',  border: 'border-l-indigo-400/60' },
  'EXT/NACHT':   { dot: 'bg-teal-400',    row: 'hover:bg-teal-500/5',    border: 'border-l-teal-400/60' },
  'INT/DÄMMERUNG':{ dot: 'bg-orange-400', row: 'hover:bg-orange-500/5',  border: 'border-l-orange-400/60' },
  'EXT/DÄMMERUNG':{ dot: 'bg-pink-400',   row: 'hover:bg-pink-500/5',    border: 'border-l-pink-400/60' },
  'INT/MORGEN':  { dot: 'bg-yellow-400',  row: 'hover:bg-yellow-500/5',  border: 'border-l-yellow-400/60' },
  'EXT/MORGEN':  { dot: 'bg-cyan-400',    row: 'hover:bg-cyan-500/5',    border: 'border-l-cyan-400/60' },
}

function getColor(int_ext: string, day_night: string) {
  return SCENE_COLORS[`${int_ext}/${day_night}`] || { dot: 'bg-muted-foreground', row: 'hover:bg-muted/30', border: 'border-l-border' }
}

function SceneRow({ scene, locations, characters, projectId }: { scene: any; locations: any[]; characters: any[]; projectId: number }) {
  const { canEdit } = useProjectPerms()
  const [expanded, setExpanded] = useState(false)
  const [form, setForm] = useState(scene)
  // Sync form when scene data refreshes from server (e.g. after creation)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setForm((prev: any) => ({ ...scene, ...prev, id: scene.id })) }, [scene.id])
  const [newItem, setNewItem] = useState('')
  const [newItemCat, setNewItemCat] = useState('Requisite')
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.scenes.update(scene.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scenes', projectId] }),
  })
  const deleteMutation = useMutation({
    mutationFn: () => api.scenes.delete(scene.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scenes', projectId] }),
    onError: () => toast({ title: 'Fehler beim Löschen', variant: 'destructive' }),
  })
  const addCharMutation = useMutation({
    mutationFn: (charId: number) => api.scenes.addCharacter(scene.id, { character_id: charId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scenes', projectId] }),
  })
  const removeCharMutation = useMutation({
    mutationFn: (charId: number) => api.scenes.removeCharacter(scene.id, charId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scenes', projectId] }),
  })
  const addInventoryMutation = useMutation({
    mutationFn: () => api.scenes.addInventory(scene.id, { item: newItem, category: newItemCat }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['scenes', projectId] }); setNewItem('') },
  })
  const removeInventoryMutation = useMutation({
    mutationFn: (itemId: number) => api.scenes.removeInventory(scene.id, itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scenes', projectId] }),
  })

  const debouncedUpdate = useRef(debounce((data: any) => updateMutation.mutate(data), 500)).current
  const updateField = (key: string, value: any) => {
    const next = { ...form, [key]: value }
    setForm(next)
    debouncedUpdate(next)
  }

  const color = getColor(scene.int_ext, scene.day_night)
  const assignedCharIds = new Set((scene.characters || []).map((c: any) => c.character_id))
  const unassignedChars = characters.filter(c => !assignedCharIds.has(c.id))

  return (
    <div className={cn('border-b border-border/40 last:border-0')}>
      {/* Compact header row */}
      <div
        className={cn(
          'flex items-center gap-4 px-4 py-2.5 cursor-pointer transition-colors border-l-2',
          color.row, color.border
        )}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Color dot + number */}
        <div className="flex items-center gap-2.5 shrink-0 w-14">
          <span className={cn('w-2 h-2 rounded-full shrink-0', color.dot)} />
          <span className="font-mono text-xs font-semibold text-muted-foreground w-6">{scene.scene_number}</span>
        </div>

        {/* Type badges */}
        <div className="flex gap-1 shrink-0">
          <span className="text-[10px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
            {scene.int_ext}
          </span>
          <span className="text-[10px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
            {scene.day_night}
          </span>
        </div>

        {/* Title */}
        <span className="text-sm font-medium flex-1 truncate">{scene.title || '(Ohne Titel)'}</span>

        {/* Location */}
        {scene.location_name && (
          <span className="text-xs text-muted-foreground truncate max-w-[120px] hidden md:block">
            {scene.location_name}
          </span>
        )}

        {/* Characters */}
        {(scene.characters || []).length > 0 && (
          <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
            <Users className="w-3 h-3" />{scene.characters.length}
          </span>
        )}

        {/* Duration */}
        <span className="text-xs text-muted-foreground font-mono shrink-0 w-12 text-right">
          {eighthsToString(scene.eighths || 0)}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {canEdit && (
            <button
              onClick={e => { e.stopPropagation(); deleteMutation.mutate() }}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded edit panel */}
      {expanded && (
        <div className="px-5 py-5 border-t border-border/40 bg-muted/20 space-y-4 animate-fade-up">
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-1">
              <Label className="text-xs text-muted-foreground">Nr.</Label>
              <Input value={form.scene_number || ''} onChange={e => updateField('scene_number', e.target.value)}
                className="mt-1 h-8 text-sm font-mono" />
            </div>
            <div className="col-span-5">
              <Label className="text-xs text-muted-foreground">Titel / Szenenüberschrift</Label>
              <Input value={form.title || ''} onChange={e => updateField('title', e.target.value)}
                className="mt-1 h-8 text-sm" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground">INT / EXT</Label>
              <Select value={form.int_ext || 'INT'} onValueChange={v => updateField('int_ext', v)}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{INT_EXT_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground">Tag / Nacht</Label>
              <Select value={form.day_night || 'TAG'} onValueChange={v => updateField('day_night', v)}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{DAY_NIGHT_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground">Seiten (Achtel)</Label>
              <Input type="number" min="1" max="80" value={form.eighths || 8}
                onChange={e => updateField('eighths', Number(e.target.value))} className="mt-1 h-8 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Motiv</Label>
              <Select value={String(form.location_id || '__none__')} onValueChange={v => updateField('location_id', v === '__none__' ? null : Number(v))}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="Kein Motiv" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Kein Motiv</SelectItem>
                  {locations.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Geschätzte Drehzeit (Min.)</Label>
              <Input type="number" min="0" value={form.estimated_minutes || 60}
                onChange={e => updateField('estimated_minutes', Number(e.target.value))} className="mt-1 h-8 text-sm" />
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Synopsis / Szenenbeschreibung</Label>
            <Textarea value={form.description || ''} onChange={e => updateField('description', e.target.value)}
              rows={2} className="mt-1 text-sm resize-none" />
          </div>

          {/* Characters */}
          <div>
            <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
              <Users className="w-3 h-3" />Figuren in dieser Szene
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {(scene.characters || []).map((c: any) => (
                <button key={c.character_id}
                  onClick={() => removeCharMutation.mutate(c.character_id)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/12 text-primary text-xs font-medium hover:bg-red-500/15 hover:text-red-400 transition-colors"
                >
                  {c.character_name} <span className="opacity-60">×</span>
                </button>
              ))}
              {unassignedChars.map(c => (
                <button key={c.id}
                  onClick={() => addCharMutation.mutate(c.id)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-border/60 text-muted-foreground text-xs hover:border-primary/40 hover:text-primary transition-colors"
                >
                  <Plus className="w-3 h-3" />{c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Inventory */}
          <div>
            <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
              <Tag className="w-3 h-3" />Requisiten & Besonderheiten
            </Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(scene.inventory || []).map((item: any) => (
                <button key={item.id}
                  onClick={() => removeInventoryMutation.mutate(item.id)}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs border border-border/60 text-muted-foreground hover:border-red-500/40 hover:text-red-400 transition-colors"
                >
                  <span className="text-muted-foreground/50">{item.category}:</span>
                  {item.item} <span className="opacity-50">×</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Select value={newItemCat} onValueChange={setNewItemCat}>
                <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{INVENTORY_CATS.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent>
              </Select>
              <Input value={newItem} onChange={e => setNewItem(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && newItem && addInventoryMutation.mutate()}
                placeholder="Eintrag hinzufügen…" className="h-7 text-xs flex-1" />
              <Button size="sm" variant="outline" className="h-7 px-2.5" onClick={() => newItem && addInventoryMutation.mutate()} disabled={!newItem}>
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Anmerkungen</Label>
            <Textarea value={form.notes || ''} onChange={e => updateField('notes', e.target.value)}
              rows={1} className="mt-1 text-sm resize-none" placeholder="Interne Notizen…" />
          </div>
        </div>
      )}
    </div>
  )
}

function ImportDialog({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId: number }) {
  const [text, setText] = useState('')
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const importMutation = useMutation({
    mutationFn: () => api.scenes.import(projectId, text),
    onSuccess: (scenes: any[]) => {
      queryClient.invalidateQueries({ queryKey: ['scenes', projectId] })
      toast({ title: `${scenes.length} Szenen importiert` })
      onClose(); setText('')
    },
    onError: () => toast({ title: 'Import fehlgeschlagen', variant: 'destructive' }),
  })
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Szenen aus Text importieren</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          Format: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">1 INT. WOHNKÜCHE – TAG</code> (eine Szene pro Zeile)
        </p>
        <Textarea value={text} onChange={e => setText(e.target.value)} rows={10}
          placeholder={"1 INT. WOHNKÜCHE – TAG\n2 EXT. PARK – TAG\n3 INT. CAFÉ – NACHT"} className="font-mono text-sm" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={() => importMutation.mutate()} disabled={!text.trim() || importMutation.isPending}>
            {importMutation.isPending ? 'Importiere…' : `Importieren`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { canEdit } = useProjectPerms()
  const [importOpen, setImportOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')

  const { data: scenes, isLoading } = useQuery({
    queryKey: ['scenes', pid],
    queryFn: () => api.scenes.list(pid),
  })
  const { data: locations } = useQuery({
    queryKey: ['locations', pid],
    queryFn: () => api.locations.list(pid),
  })
  const { data: characters } = useQuery({
    queryKey: ['characters', pid],
    queryFn: () => api.characters.list(pid),
  })

  const createMutation = useMutation({
    mutationFn: () => api.scenes.create(pid, {
      scene_number: String((scenes?.length || 0) + 1),
      title: 'Neue Szene', int_ext: 'INT', day_night: 'TAG', eighths: 8,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scenes', pid] })
      queryClient.invalidateQueries({ queryKey: ['screenplay', pid] })
    },
    onError: () => toast({ title: 'Fehler', variant: 'destructive' }),
  })

  const totalEighths = (scenes || []).reduce((s: number, sc: any) => s + (sc.eighths || 0), 0)
  const totalMinutes = Math.round((totalEighths / 8) * 60)
  const intCount = (scenes || []).filter((s: any) => s.int_ext === 'INT').length
  const extCount = (scenes || []).filter((s: any) => s.int_ext === 'EXT').length
  const nightCount = (scenes || []).filter((s: any) => s.day_night === 'NACHT').length

  const filtered = (scenes || []).filter((s: any) => {
    const matchSearch = !search || s.title?.toLowerCase().includes(search.toLowerCase()) ||
      s.scene_number?.includes(search) || s.location_name?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filterType === 'all' || s.int_ext === filterType || s.day_night === filterType
    return matchSearch && matchFilter
  })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-7 pt-7 pb-4 border-b border-border/40 shrink-0">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-xl font-semibold">Szenenübersicht</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {scenes?.length || 0} Szenen · {eighthsToString(totalEighths)} Seiten · ca. {totalMinutes} Min.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="w-3.5 h-3.5 mr-1.5" />Import
            </Button>
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />Neue Szene
            </Button>
          </div>
        </div>

        {/* Stats pills */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {[
            { label: 'Alle', value: 'all', count: scenes?.length || 0 },
            { label: 'INT', value: 'INT', count: intCount },
            { label: 'EXT', value: 'EXT', count: extCount },
            { label: 'Nacht', value: 'NACHT', count: nightCount },
          ].map(f => (
            <button key={f.value}
              onClick={() => setFilterType(f.value)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors border',
                filterType === f.value
                  ? 'bg-primary/12 border-primary/30 text-primary'
                  : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-border'
              )}
            >
              {f.label} <span className={cn('tabular-nums', filterType === f.value ? 'text-primary' : 'text-muted-foreground/60')}>{f.count}</span>
            </button>
          ))}
          <div className="flex-1 max-w-xs ml-auto">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Szene suchen…" className="pl-8 h-7 text-xs" />
            </div>
          </div>
        </div>

        {/* Table header */}
        <div className="flex items-center gap-4 px-4 text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
          <div className="w-14">Nr.</div>
          <div className="w-24">Typ</div>
          <div className="flex-1">Titel</div>
          <div className="w-28 hidden md:block">Motiv</div>
          <div className="w-8">Fig.</div>
          <div className="w-12 text-right">Seiten</div>
          <div className="w-6" />
        </div>
      </div>

      {/* Scene list */}
      <div className="flex-1 overflow-y-auto bg-card rounded-none">
        {isLoading ? (
          <div className="p-4 space-y-0">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-11 rounded-none border-b border-border/30" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Film className="w-10 h-10 mb-3 opacity-20" />
            {search || filterType !== 'all' ? (
              <p className="text-sm">Keine Szenen gefunden</p>
            ) : (
              <>
                <p className="text-sm font-medium mb-1">Noch keine Szenen</p>
                <p className="text-xs mb-4">Erstelle die erste Szene oder importiere aus einem Skript.</p>
                <Button size="sm" onClick={() => createMutation.mutate()}>
                  <Plus className="w-3.5 h-3.5 mr-1.5" />Erste Szene
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="group">
            {filtered.map((scene: any) => (
              <SceneRow key={scene.id} scene={scene} locations={locations || []} characters={characters || []} projectId={pid} />
            ))}
          </div>
        )}
      </div>

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} projectId={pid} />
    </div>
  )
}
