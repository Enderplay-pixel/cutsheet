import { useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency, debounce, cn } from '@/lib/utils'
import { Plus, Trash2, User, Users, Phone, Mail, ChevronDown, ChevronUp, Download } from 'lucide-react'
import { useProjectPerms } from '@/contexts/ProjectRoleContext'

function Avatar({ name, color = 'primary' }: { name: string; color?: string }) {
  return (
    <div className={cn(
      'w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0',
      color === 'primary' ? 'bg-primary/15 text-primary' : 'bg-amber-500/15 text-amber-400'
    )}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  )
}

function CharacterCard({ char, scenes, onDelete }: { char: any; scenes: any[]; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [form, setForm] = useState(char)
  const queryClient = useQueryClient()
  const { projectId } = useParams()
  const pid = Number(projectId)
  const { canEdit } = useProjectPerms()

  const mutation = useMutation({
    mutationFn: (data: any) => api.characters.update(char.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['characters', pid] }),
  })
  const debouncedUpdate = useRef(debounce((data: any) => mutation.mutate(data), 500)).current
  const update = (key: string, value: any) => {
    const next = { ...form, [key]: value }
    setForm(next)
    debouncedUpdate(next)
  }

  const sceneList = scenes.filter(s => s.characters?.some((c: any) => c.character_id === char.id))

  return (
    <div className="border border-border/60 rounded-xl overflow-hidden bg-card hover:border-border transition-colors">
      <div
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <Avatar name={form.name} color="primary" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate">{form.name || '(Kein Name)'}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {[form.age_range, form.gender].filter(Boolean).join(' · ')}
            {sceneList.length > 0 && ` · ${sceneList.length} Szenen`}
          </p>
        </div>
        {canEdit && (
          <button onClick={e => { e.stopPropagation(); onDelete() }}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </div>

      {expanded && (
        <div className="border-t border-border/40 p-4 bg-muted/20 space-y-3 animate-fade-up">
          <div>
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input value={form.name || ''} onChange={e => update('name', e.target.value)} className="mt-1 h-8 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Alter</Label>
              <Input value={form.age_range || ''} onChange={e => update('age_range', e.target.value)} className="mt-1 h-8 text-sm" placeholder="z.B. 25–35" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Geschlecht</Label>
              <Select value={form.gender || ''} onValueChange={v => update('gender', v)}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="–" /></SelectTrigger>
                <SelectContent>
                  {['Männlich', 'Weiblich', 'Divers', 'Keine Angabe'].map(g =>
                    <SelectItem key={g} value={g} className="text-xs">{g}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Figurenbeschreibung</Label>
            <Textarea value={form.description || ''} onChange={e => update('description', e.target.value)}
              rows={2} className="mt-1 text-xs resize-none" />
          </div>
          {sceneList.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Szenen</Label>
              <div className="flex flex-wrap gap-1">
                {sceneList.map((s: any) => (
                  <span key={s.id} className="text-[11px] bg-muted px-2 py-0.5 rounded text-muted-foreground">
                    Sz. {s.scene_number}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CastCard({ castMember, characters, shootDays, onDelete }: { castMember: any; characters: any[]; shootDays: any[]; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [form, setForm] = useState(castMember)
  const queryClient = useQueryClient()
  const { projectId } = useParams()
  const pid = Number(projectId)
  const { canEdit } = useProjectPerms()

  const mutation = useMutation({
    mutationFn: (data: any) => api.cast.update(castMember.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cast', pid] }),
  })
  const debouncedUpdate = useRef(debounce((data: any) => mutation.mutate(data), 500)).current
  const update = (key: string, value: any) => {
    const next = { ...form, [key]: value }
    setForm(next)
    debouncedUpdate(next)
  }

  const character = characters.find(c => c.id === castMember.character_id)
  const daysCount = shootDays.filter(day =>
    day.scenes?.some((s: any) =>
      s.characters?.some((c: any) => c.character_id === castMember.character_id)
    )
  ).length
  const totalFee = (form.fee_per_day || 0) * daysCount

  return (
    <div className="border border-border/60 rounded-xl overflow-hidden bg-card hover:border-border transition-colors">
      <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <Avatar name={form.actor_name} color="amber" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{form.actor_name || '(Kein Name)'}</div>
          <p className="text-xs text-muted-foreground">
            {character ? `als ${character.name}` : 'Keine Rolle'}
            {daysCount > 0 && ` · ${daysCount} Drehtage`}
            {totalFee > 0 && ` · ${formatCurrency(totalFee)}`}
          </p>
        </div>
        {canEdit && (
          <button onClick={e => { e.stopPropagation(); onDelete() }}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </div>

      {expanded && (
        <div className="border-t border-border/40 p-4 bg-muted/20 space-y-3 animate-fade-up">
          <div>
            <Label className="text-xs text-muted-foreground">Name des Darstellers</Label>
            <Input value={form.actor_name || ''} onChange={e => update('actor_name', e.target.value)} className="mt-1 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Rolle</Label>
            <Select value={String(form.character_id || '__none__')} onValueChange={v => update('character_id', v === '__none__' ? null : Number(v))}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="Rolle wählen" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" className="text-xs">– Keine Rolle –</SelectItem>
                {characters.map(c => <SelectItem key={c.id} value={String(c.id)} className="text-xs">{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />E-Mail</Label>
              <Input value={form.email || ''} onChange={e => update('email', e.target.value)} className="mt-1 h-8 text-xs" type="email" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />Telefon</Label>
              <Input value={form.phone || ''} onChange={e => update('phone', e.target.value)} className="mt-1 h-8 text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Agentur</Label>
              <Input value={form.agency || ''} onChange={e => update('agency', e.target.value)} className="mt-1 h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Tagesgage (€)</Label>
              <Input type="number" value={(form.fee_per_day || 0) / 100}
                onChange={e => update('fee_per_day', Math.round(Number(e.target.value) * 100))}
                className="mt-1 h-8 text-xs" />
            </div>
          </div>
          {form.fee_per_day > 0 && daysCount > 0 && (
            <div className="pt-2 border-t border-border/40 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{daysCount} Drehtage × {formatCurrency(form.fee_per_day)}</span>
              <span className="text-sm font-semibold">{formatCurrency(totalFee)}</span>
            </div>
          )}
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
  const { canEdit } = useProjectPerms()

  const { data: characters, isLoading: charsLoading } = useQuery({
    queryKey: ['characters', pid],
    queryFn: () => api.characters.list(pid),
  })
  const { data: castList, isLoading: castLoading } = useQuery({
    queryKey: ['cast', pid],
    queryFn: () => api.cast.list(pid),
  })
  const { data: scenes } = useQuery({
    queryKey: ['scenes', pid],
    queryFn: () => api.scenes.list(pid),
  })
  const { data: shootDays } = useQuery({
    queryKey: ['shoot-days', pid],
    queryFn: () => api.drehplan.listDays(pid),
  })

  const createChar = useMutation({
    mutationFn: () => api.characters.create(pid, { name: 'Neue Figur', gender: '', age_range: '' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['characters', pid] }),
  })
  const deleteChar = useMutation({
    mutationFn: (id: number) => api.characters.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['characters', pid] }),
  })
  const createCast = useMutation({
    mutationFn: () => api.cast.create(pid, { actor_name: 'Neuer Darsteller' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cast', pid] }),
  })
  const deleteCast = useMutation({
    mutationFn: (id: number) => api.cast.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cast', pid] }),
  })

  const totalCastFee = (castList || []).reduce((sum: number, c: any) => {
    const days = (shootDays || []).filter(d =>
      d.scenes?.some((s: any) => s.characters?.some((ch: any) => ch.character_id === c.character_id))
    ).length
    return sum + (c.fee_per_day || 0) * days
  }, 0)

  const exportCsv = () => {
    const rows = [['Darsteller', 'Figur', 'E-Mail', 'Telefon', 'Agentur', 'Gage/Tag']]
    ;(castList || []).forEach((c: any) => {
      const char = (characters || []).find((ch: any) => ch.id === c.character_id)
      rows.push([c.actor_name || '', char?.name || '', c.email || '', c.phone || '', c.agency || '', c.fee_per_day ? String(c.fee_per_day / 100) : '0'])
    })
    const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a')
    a.href = url; a.download = 'besetzung.csv'; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="p-7 max-w-5xl mx-auto animate-fade-up">
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-xl font-semibold">Besetzung & Rollen</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {characters?.length || 0} Figuren · {castList?.length || 0} Darsteller
            {totalCastFee > 0 && ` · ${formatCurrency(totalCastFee)} Darstellergagen`}
          </p>
        </div>
      </div>

      <div className="flex justify-end mb-5 gap-2">
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="w-3.5 h-3.5 mr-1.5" />CSV
        </Button>
        <a href={api.pdf.besetzung(pid)} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm">
            <Download className="w-3.5 h-3.5 mr-1.5" />PDF
          </Button>
        </a>
      </div>

      <Tabs defaultValue="characters">
        <TabsList className="h-9 mb-6">
          <TabsTrigger value="characters" className="gap-2 text-xs">
            <Users className="w-3.5 h-3.5" />Figuren ({characters?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="cast" className="gap-2 text-xs">
            <User className="w-3.5 h-3.5" />Darsteller ({castList?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="characters">
          {canEdit && (
            <div className="flex justify-end mb-4">
              <Button size="sm" onClick={() => createChar.mutate()} disabled={createChar.isPending}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />Neue Figur
              </Button>
            </div>
          )}
          {charsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(characters || []).map((char: any) => (
                <CharacterCard key={char.id} char={char} scenes={scenes || []} onDelete={() => deleteChar.mutate(char.id)} />
              ))}
              {(!characters || characters.length === 0) && (
                <div className="col-span-2 text-center py-16 text-muted-foreground">
                  <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Noch keine Figuren angelegt.</p>
                  {canEdit && (
                    <Button size="sm" className="mt-4" onClick={() => createChar.mutate()}>
                      <Plus className="w-3.5 h-3.5 mr-1.5" />Erste Figur
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="cast">
          {canEdit && (
            <div className="flex justify-end mb-4">
              <Button size="sm" onClick={() => createCast.mutate()} disabled={createCast.isPending}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />Neuer Darsteller
              </Button>
            </div>
          )}
          {castLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[1,2].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(castList || []).map((c: any) => (
                <CastCard key={c.id} castMember={c} characters={characters || []} shootDays={shootDays || []} onDelete={() => deleteCast.mutate(c.id)} />
              ))}
              {(!castList || castList.length === 0) && (
                <div className="col-span-2 text-center py-16 text-muted-foreground">
                  <User className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Noch keine Darsteller angelegt.</p>
                  {canEdit && (
                    <Button size="sm" className="mt-4" onClick={() => createCast.mutate()}>
                      <Plus className="w-3.5 h-3.5 mr-1.5" />Ersten Darsteller
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
