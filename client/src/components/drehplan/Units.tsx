/**
 * Unit-Wähler und Verwaltung der Units für Drehplan und Stäbchenplan
 * (Plan Kino-Ausbau, AP C2).
 */
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Plus } from 'lucide-react'
import { api, ApiFehler } from '@/lib/api'
import { useT } from '@/lib/useT'
import { unitsT as U } from '@/lib/texte/Units'
import type { Unit } from '@/lib/units'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'

/** "Alle Units" oder eine Unit. Erscheint erst, wenn das Projekt mehr als eine hat. */
export function UnitWaehler({ units, wert, onChange, mitAlle = true, id }: {
  units: Unit[] | undefined; wert: number | 'alle'; onChange: (w: number | 'alle') => void; mitAlle?: boolean; id?: string
}) {
  const tt = useT()
  if (!units || units.length < 2) return null
  return (
    <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      <span>{tt(U.unit)}</span>
      <select id={id} value={String(wert)} onChange={(e) => onChange(e.target.value === 'alle' ? 'alle' : Number(e.target.value))}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground">
        {mitAlle && <option value="alle">{tt(U.alle)}</option>}
        {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
    </label>
  )
}

/** Kleiner Farbpunkt mit Kürzel vor einem Tag einer anderen Unit. */
export function UnitMarke({ kuerzel, farbe }: { kuerzel: string; farbe?: string | null }) {
  if (!kuerzel) return null
  return (
    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-muted text-foreground"
      style={farbe ? { boxShadow: `inset 3px 0 0 ${farbe}` } : undefined}>
      {kuerzel}
    </span>
  )
}

function UnitZeile({ unit, darf, onGespeichert, onLoeschen }: {
  unit: Unit; darf: boolean; onGespeichert: () => void; onLoeschen: () => void
}) {
  const tt = useT()
  const { toast } = useToast()
  const [name, setName] = useState(unit.name)
  const [kurz, setKurz] = useState(unit.short)
  const speichern = useMutation({
    mutationFn: (daten: { name?: string; short?: string; color?: string }) => api.units.update(unit.id, daten),
    onSuccess: onGespeichert,
    onError: (e: any) => {
      setName(unit.name); setKurz(unit.short)
      toast({ title: tt(U.fehler), description: e.message, variant: 'destructive' })
    },
  })
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={unit.color || '#94a3b8'} disabled={!darf}
        aria-label={tt(U.farbeVon).replace('{name}', unit.name)}
        onChange={(e) => speichern.mutate({ color: e.target.value })}
        className="h-8 w-8 shrink-0 rounded border border-input bg-background p-0.5" />
      <Input value={name} disabled={!darf} aria-label={tt(U.nameVon).replace('{name}', unit.name)}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => { if (name.trim() !== unit.name) speichern.mutate({ name }) }}
        className="h-8 text-sm" />
      <Input value={kurz} disabled={!darf} maxLength={6} placeholder={unit.is_main ? '' : tt(U.neuKuerzel)}
        aria-label={tt(U.kuerzelVon).replace('{name}', unit.name)}
        onChange={(e) => setKurz(e.target.value)}
        onBlur={() => { if (kurz.trim() !== unit.short) speichern.mutate({ short: kurz }) }}
        className="h-8 w-20 text-sm" />
      <span className="w-28 shrink-0 text-[11px] text-muted-foreground tabular-nums">
        {unit.is_main ? tt(U.haupt) : tt(U.zahlen).replace('{tage}', String(unit.tage_anzahl ?? 0)).replace('{stab}', String(unit.stab_anzahl ?? 0))}
      </span>
      {darf && !unit.is_main ? (
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onLoeschen}
          aria-label={tt(U.loeschen).replace('{name}', unit.name)}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      ) : <span className="w-8 shrink-0" />}
    </div>
  )
}

/** Units anlegen, umbenennen, einfärben, löschen. */
export function UnitsDialog({ offen, onSchliessen, pid, units, darf }: {
  offen: boolean; onSchliessen: () => void; pid: number; units: Unit[] | undefined; darf: boolean
}) {
  const tt = useT()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [neuName, setNeuName] = useState('')
  const [neuKurz, setNeuKurz] = useState('')
  const neuLaden = () => {
    for (const k of ['units', 'shoot-days', 'conflicts', 'dood-report', 'drehtage', 'crew']) queryClient.invalidateQueries({ queryKey: [k, pid] })
  }
  const anlegen = useMutation({
    mutationFn: () => api.units.create(pid, { name: neuName.trim(), short: neuKurz.trim() }),
    onSuccess: () => { setNeuName(''); setNeuKurz(''); neuLaden() },
    onError: (e: any) => toast({ title: tt(U.fehler), description: e.message, variant: 'destructive' }),
  })
  const loeschen = async (unit: Unit) => {
    if (!confirm(tt(U.loeschenFrage).replace('{name}', unit.name))) return
    try {
      await api.units.delete(unit.id)
    } catch (e) {
      // Mit Drehtagen fragt der Server nach: Die Tage wandern zur Haupteinheit
      if (!(e instanceof ApiFehler) || e.status !== 409) {
        toast({ title: tt(U.fehler), description: (e as Error).message, variant: 'destructive' })
        return
      }
      if (!confirm(tt(U.tageWandern).replace('{meldung}', e.message))) return
      try { await api.units.delete(unit.id, true) } catch (f) {
        toast({ title: tt(U.fehler), description: (f as Error).message, variant: 'destructive' })
        return
      }
    }
    neuLaden()
  }
  return (
    <Dialog open={offen} onOpenChange={(v) => !v && onSchliessen()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{tt(U.titel)}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">{tt(U.erklaerung)}</p>
        <div className="space-y-2">
          {(units ?? []).map((u) => (
            <UnitZeile key={`${u.id}-${u.name}-${u.short}`} unit={u} darf={darf} onGespeichert={neuLaden} onLoeschen={() => loeschen(u)} />
          ))}
        </div>
        {darf && (
          <form className="flex items-center gap-2 pt-2 border-t border-border" onSubmit={(e) => { e.preventDefault(); if (neuName.trim()) anlegen.mutate() }}>
            <Input value={neuName} onChange={(e) => setNeuName(e.target.value)} placeholder={tt(U.neu)} aria-label={tt(U.name)} className="h-8 text-sm" />
            <Input value={neuKurz} onChange={(e) => setNeuKurz(e.target.value)} placeholder={tt(U.neuKuerzel)} aria-label={tt(U.kuerzel)} maxLength={6} className="h-8 w-20 text-sm" />
            <Button type="submit" size="sm" disabled={!neuName.trim() || anlegen.isPending}>
              <Plus className="w-3.5 h-3.5 mr-1" />{tt(U.anlegen)}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
