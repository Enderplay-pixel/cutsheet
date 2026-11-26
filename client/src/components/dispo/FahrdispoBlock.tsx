/**
 * Fahrdispo einer Tagesdispo (Plan Kino-Ausbau, AP E7): Fahrten mit
 * Abfahrt, von, nach, Fahrzeug, Fahrer und Mitfahrenden. Hinweise rechnet
 * der Server (lib/fahrdispo.ts) - hier stehen sie nur.
 */
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Car, Plus, Trash2, Wand2, X, AlertTriangle } from 'lucide-react'
import { api } from '@/lib/api'
import { useT } from '@/lib/useT'
import { fahrT } from '@/lib/texte/Fahrdispo'
import { formatTime, parseTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'

function Feld({ value, onSpeichern, label, disabled, className }: {
  value: string; onSpeichern: (v: string) => void; label: string; disabled?: boolean; className?: string
}) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  return (
    <Input value={text} disabled={disabled} aria-label={label} placeholder={label}
      onChange={(e) => setText(e.target.value)} onBlur={() => { if (text.trim() !== value) onSpeichern(text.trim()) }}
      className={className ?? 'h-8 text-sm'} />
  )
}

function Abfahrt({ value, onSpeichern, label, disabled }: { value: number | null; onSpeichern: (v: number | null) => void; label: string; disabled?: boolean }) {
  const { toast } = useToast()
  const [text, setText] = useState(value == null ? '' : formatTime(value))
  useEffect(() => setText(value == null ? '' : formatTime(value)), [value])
  const verlassen = () => {
    const roh = text.trim()
    if (!roh) { if (value != null) onSpeichern(null); return }
    const m = parseTime(roh)
    if (Number.isNaN(m)) { setText(value == null ? '' : formatTime(value)); toast({ variant: 'destructive', title: label }); return }
    if (m !== value) onSpeichern(m)
  }
  return <Input value={text} disabled={disabled} aria-label={label} placeholder="--:--" onChange={(e) => setText(e.target.value)} onBlur={verlassen}
    className="h-8 w-20 text-sm font-mono" />
}

export function FahrdispoBlock({ callSheet, pid, darf, onGeaendert }: { callSheet: any; pid: number; darf: boolean; onGeaendert: () => void }) {
  const tt = useT()
  const { toast } = useToast()
  const { data: fahrzeuge } = useQuery<any[]>({ queryKey: ['vehicles', pid], queryFn: () => api.vehicles.list(pid) })
  const { data: stab } = useQuery<any[]>({ queryKey: ['crew', pid], queryFn: () => api.crew.list(pid) })
  const fahrten: any[] = callSheet.fahrten ?? []
  const eintraege: any[] = callSheet.entries ?? []
  const name = (id: number) => eintraege.find((e) => e.id === id)?.person_name || '-'
  const fehler = (e: any) => toast({ variant: 'destructive', title: e.message })
  const aendern = async (f: any, daten: any) => { try { await api.callSheets.fahrtAendern(f.id, daten); onGeaendert() } catch (e) { fehler(e) } }

  return (
    <section data-einfuehrung="fahrdispo" aria-label={tt(fahrT.fahrdispo)} className="bg-card border border-border/60 rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-border/40 bg-muted/30">
        <Car className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-bold uppercase tracking-widest">{tt(fahrT.fahrdispo)}</span>
        {darf && (
          <span className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={async () => {
              try { const r = await api.callSheets.fahrtenVorschlagen(callSheet.id); toast({ title: tt(fahrT.vorgeschlagen).replace('{n}', String(r.neu)) }); onGeaendert() } catch (e) { fehler(e) }
            }}><Wand2 className="w-3.5 h-3.5 mr-1.5" />{tt(fahrT.vorschlagen)}</Button>
            <Button variant="outline" size="sm" onClick={async () => {
              try { await api.callSheets.fahrtNeu(callSheet.id, {}); onGeaendert() } catch (e) { fehler(e) }
            }}><Plus className="w-3.5 h-3.5 mr-1.5" />{tt(fahrT.neueFahrt)}</Button>
          </span>
        )}
      </div>
      <p className="px-5 pt-2 text-xs text-muted-foreground">{tt(fahrT.fahrdispoHilfe)}</p>
      {fahrten.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted-foreground">{tt(fahrT.keineFahrten)}</p>
      ) : (
        <ul className="divide-y divide-border/30">
          {fahrten.map((f, i) => {
            const nr = tt(fahrT.fahrtVon).replace('{nr}', String(i + 1))
            const frei = eintraege.filter((e) => !f.entry_ids.includes(e.id))
            return (
              <li key={f.id} className="px-5 py-3 space-y-2" aria-label={nr}>
                <div className="flex flex-wrap items-center gap-2">
                  <Abfahrt value={f.depart_time} disabled={!darf} label={`${tt(fahrT.abfahrt)} - ${nr}`} onSpeichern={(v) => aendern(f, { depart_time: v })} />
                  <Feld value={f.from_place} disabled={!darf} label={`${tt(fahrT.von)} - ${nr}`} onSpeichern={(v) => aendern(f, { from_place: v })} className="h-8 text-sm w-40" />
                  <Feld value={f.to_place} disabled={!darf} label={`${tt(fahrT.nach)} - ${nr}`} onSpeichern={(v) => aendern(f, { to_place: v })} className="h-8 text-sm w-40" />
                  <select value={f.vehicle_id ?? ''} disabled={!darf} aria-label={`${tt(fahrT.fahrzeug)} - ${nr}`}
                    onChange={(e) => aendern(f, { vehicle_id: e.target.value === '' ? null : Number(e.target.value) })}
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm">
                    <option value="">{tt(fahrT.keinFahrzeug)}</option>
                    {(fahrzeuge ?? []).map((v) => <option key={v.id} value={v.id}>{[v.name, v.license_plate].filter(Boolean).join(' · ')} ({v.capacity})</option>)}
                  </select>
                  <select value={f.driver_crew_id ?? ''} disabled={!darf} aria-label={`${tt(fahrT.fahrer)} - ${nr}`}
                    onChange={(e) => aendern(f, { driver_crew_id: e.target.value === '' ? null : Number(e.target.value) })}
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm">
                    <option value="">{tt(fahrT.fahrer)}: -</option>
                    {(stab ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {f.driver_crew_id == null && (
                    <Feld value={f.driver_name} disabled={!darf} label={`${tt(fahrT.fahrerText)} - ${nr}`} onSpeichern={(v) => aendern(f, { driver_name: v })} className="h-8 text-sm w-36" />
                  )}
                  {darf && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto" onClick={async () => { try { await api.callSheets.fahrtLoeschen(f.id); onGeaendert() } catch (e) { fehler(e) } }}
                      aria-label={tt(fahrT.fahrtLoeschen).replace('{zeit}', f.depart_time == null ? '--:--' : formatTime(f.depart_time))}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground mr-1">{tt(fahrT.mitfahrende)}:</span>
                  {f.entry_ids.map((id: number) => (
                    <span key={id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                      {name(id)}
                      {darf && (
                        <button type="button" aria-label={tt(fahrT.ausFahrt).replace('{name}', name(id))}
                          onClick={() => aendern(f, { entry_ids: f.entry_ids.filter((x: number) => x !== id) })}><X className="w-3 h-3" /></button>
                      )}
                    </span>
                  ))}
                  {darf && frei.length > 0 && (
                    <select value="" aria-label={`${tt(fahrT.mitfahrendeDazu)} - ${nr}`} onChange={(e) => e.target.value && aendern(f, { entry_ids: [...f.entry_ids, Number(e.target.value)] })}
                      className="h-7 rounded-md border border-input bg-background px-1 text-xs">
                      <option value="">+ {tt(fahrT.mitfahrendeDazu)}</option>
                      {frei.map((e) => <option key={e.id} value={e.id}>{e.person_name}</option>)}
                    </select>
                  )}
                </div>
                {f.hinweise?.map((h: string) => (
                  <p key={h} role="status" className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />{h}
                  </p>
                ))}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
