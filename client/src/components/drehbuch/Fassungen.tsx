import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { useT } from '@/lib/useT'
import { fassungT as T, FARBE } from '@/lib/texte/Fassungen'
import { Loader2, ArrowLeft } from 'lucide-react'

/**
 * Dialoge der Drehbuch-Fassungen (Plan Kino-Ausbau, AP A3): eine Datei in ein
 * Projekt mit Szenen einlesen - als neue Fassung mit Vorschau oder angehängt -
 * und die Liste der Fassungen mit dem Vergleich einer Szene.
 */

/** "blau-2" → Blau, 2. Runde */
function farbeTeile(farbe: string): { art: string; runde: number } {
  const [art, runde] = String(farbe ?? 'weiss').split('-')
  return { art, runde: Number(runde) || 1 }
}

export function FarbPunkt({ farbe, className }: { farbe: string; className?: string }) {
  const { art } = farbeTeile(farbe)
  return <span aria-hidden="true" className={cn('inline-block w-3 h-3 rounded-full border border-border', className)} style={{ background: FARBE[art]?.hex ?? '#ffffff' }} />
}

export function useFarbname() {
  const tt = useT()
  return (farbe: string) => {
    const { art, runde } = farbeTeile(farbe)
    const name = FARBE[art] ? tt(FARBE[art].name) : art
    return runde > 1 ? `${name} (${tt(T.runde).replace('{n}', String(runde))})` : name
  }
}

/** Die Fassungen eines Projekts - dieselbe Abfrage für Liste, Sternchen und Import. */
export function useFassungen(pid: number, aktiv = true) {
  return useQuery<any[]>({ queryKey: ['drehbuch-fassungen', pid], queryFn: () => api.screenplay.fassungen(pid), enabled: !!pid && aktiv })
}

function Liste({ titel, eintraege }: { titel: string; eintraege: Array<{ nummer: string; kopf: string }> }) {
  if (eintraege.length === 0) return null
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1">{titel}</p>
      <ul className="text-sm space-y-0.5 max-h-28 overflow-y-auto">
        {eintraege.map((e, i) => (
          <li key={i} className="flex gap-2"><span className="font-mono w-10 shrink-0">{e.nummer || '-'}</span><span className="truncate">{e.kopf}</span></li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Einlesen in ein Projekt, das schon Szenen hat (Soll 2): drei Wege statt
 * einer Rückfrage. "Als neue Fassung" zeigt zuerst, was sich ändert, und
 * schreibt erst nach "Übernehmen".
 */
export function ImportDialog({ offen, pid, datei, vorhanden, onSchliessen, onFertig }: {
  offen: boolean
  pid: number
  datei: { name: string; inhalt: string } | null
  vorhanden: number
  onSchliessen: () => void
  onFertig: () => void
}) {
  const tt = useT()
  const { toast } = useToast()
  const farbname = useFarbname()
  const [vorschau, setVorschau] = useState<any>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [farbe, setFarbe] = useState('auto')
  useEffect(() => { if (offen) { setVorschau(null); setFarbe('auto') } }, [offen, datei])

  const rufe = async (modus: 'fassung' | 'anhaengen', nurZeigen: boolean) => {
    if (!datei) return
    setLaeuft(true)
    try {
      const r = await api.screenplay.importFdx(pid, datei.inhalt, datei.name, {
        modus, nurZeigen, ...(modus === 'fassung' && !nurZeigen && farbe !== 'auto' ? { farbe } : {}),
      })
      if (nurZeigen) { setVorschau(r); return }
      if (modus === 'fassung') {
        toast({
          title: r.nichts ? tt(T.nichts) : tt(T.uebernommen)
            .replace('{nr}', String(r.fassung?.number ?? ''))
            .replace('{g}', String(r.zahlen.geaendert)).replace('{neu}', String(r.zahlen.neu))
            .replace('{e}', String(r.entfallen?.length ?? 0)),
        })
      } else {
        toast({ title: tt(T.anhaengen), description: String(r.scenes_created ?? '') })
      }
      onFertig()
    } catch (e: any) {
      toast({ title: tt(T.importTitel), description: e.message, variant: 'destructive' })
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <Dialog open={offen} onOpenChange={(v) => !v && onSchliessen()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{vorschau ? tt(T.vorschauTitel) : tt(T.importTitel)}</DialogTitle></DialogHeader>
        {!vorschau ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{tt(T.importText).replace('{n}', String(vorhanden)).replace('{datei}', datei?.name ?? '')}</p>
            <button type="button" disabled={laeuft} onClick={() => rufe('fassung', true)}
              className="w-full text-left rounded-lg border-2 border-primary bg-primary/5 px-4 py-3 hover:bg-primary/10 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="block font-medium">{laeuft ? tt(T.vergleicht) : tt(T.alsFassung)}</span>
              <span className="block text-xs text-muted-foreground mt-0.5">{tt(T.alsFassungText)}</span>
            </button>
            <button type="button" disabled={laeuft} onClick={() => rufe('anhaengen', false)}
              className="w-full text-left rounded-lg border border-border px-4 py-3 hover:bg-muted disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="block font-medium">{tt(T.anhaengen)}</span>
              <span className="block text-xs text-muted-foreground mt-0.5">{tt(T.anhaengenText)}</span>
            </button>
          </div>
        ) : vorschau.nichts ? (
          <p role="status" className="text-sm">{tt(T.nichts)}</p>
        ) : (
          <div className="space-y-3">
            <div role="status" className="grid grid-cols-4 gap-2 text-center">
              {([['unveraendert', T.unveraendert], ['geaendert', T.geaendert], ['neu', T.neu], ['fehlt', T.fehlt]] as const).map(([k, text]) => (
                <div key={k} className="rounded-md bg-muted px-2 py-1.5">
                  <div className="text-lg font-semibold tabular-nums">{vorschau.zahlen[k]}</div>
                  <div className="text-[11px] text-muted-foreground">{tt(text)}</div>
                </div>
              ))}
            </div>
            <Liste titel={tt(T.geaendert)} eintraege={vorschau.geaendert} />
            <Liste titel={tt(T.neu)} eintraege={vorschau.neu} />
            <Liste titel={tt(T.fehlt)} eintraege={vorschau.fehlt} />
            {vorschau.fehlt.length > 0 && (
              <p className="text-xs text-muted-foreground">{vorschau.gesperrt ? tt(T.fehltGesperrt) : tt(T.fehltOffen)}</p>
            )}
            <div>
              <Label className="text-xs font-medium block mb-1">{tt(T.farbe)}</Label>
              <Select value={farbe} onValueChange={setFarbe}>
                <SelectTrigger className="h-8 w-48" aria-label={tt(T.farbe)}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">-</SelectItem>
                  {Object.keys(FARBE).filter((f) => f !== 'weiss').map((f) => (
                    <SelectItem key={f} value={f}><span className="flex items-center gap-2"><FarbPunkt farbe={f} />{farbname(f)}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onSchliessen}>{vorschau?.nichts ? tt(T.schliessen) : tt(T.abbrechen)}</Button>
          {vorschau && !vorschau.nichts && (
            <Button onClick={() => rufe('fassung', false)} disabled={laeuft}>
              {laeuft && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" aria-hidden="true" />}{tt(T.uebernehmen)}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Liste aller Fassungen mit Farbe, Datum, Datei und Zahlen; ein Klick auf eine Szene zeigt alt gegen neu (Soll 5). */
export function FassungenDialog({ offen, pid, onSchliessen }: { offen: boolean; pid: number; onSchliessen: () => void }) {
  const tt = useT()
  const farbname = useFarbname()
  const { data: fassungen, isLoading } = useFassungen(pid, offen)
  const [auswahl, setAuswahl] = useState<{ fassung: number; szene: number; nummer: string } | null>(null)
  useEffect(() => { if (!offen) setAuswahl(null) }, [offen])
  const { data: vergleich } = useQuery<any>({
    queryKey: ['drehbuch-vergleich', pid, auswahl?.fassung, auswahl?.szene],
    queryFn: () => api.screenplay.vergleich(pid, auswahl!.fassung, auswahl!.szene),
    enabled: !!auswahl,
  })

  return (
    <Dialog open={offen} onOpenChange={(v) => !v && onSchliessen()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{auswahl ? tt(T.vergleichTitel).replace('{n}', auswahl.nummer) : tt(T.fassungenTitel)}</DialogTitle>
        </DialogHeader>
        {auswahl ? (
          <div className="space-y-2">
            <Button variant="ghost" size="sm" className="h-7" onClick={() => setAuswahl(null)}>
              <ArrowLeft className="w-3.5 h-3.5 mr-1" aria-hidden="true" />{tt(T.zurueck)}
            </Button>
            <div className="font-mono text-xs rounded-md border border-border divide-y divide-border/60">
              {(vergleich?.zeilen ?? []).map((z: any, i: number) => (
                <div key={i} className={cn('px-3 py-1 whitespace-pre-wrap',
                  z.art === 'weg' && 'bg-red-500/10 text-red-800 dark:text-red-300 line-through',
                  z.art === 'neu' && 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300')}>
                  {z.art !== 'gleich' && <span className="sr-only">{z.art === 'weg' ? tt(T.zeileWeg) : tt(T.zeileNeu)}: </span>}
                  <span aria-hidden="true" className="inline-block w-4 text-muted-foreground">{z.art === 'weg' ? '-' : z.art === 'neu' ? '+' : ''}</span>
                  {z.zeile}
                </div>
              ))}
            </div>
          </div>
        ) : isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" aria-hidden="true" />
        ) : (fassungen ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{tt(T.keineFassungen)}</p>
        ) : (
          <ul className="space-y-3">
            {(fassungen ?? []).map((f) => (
              <li key={f.id} className="rounded-lg border border-border px-3 py-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <FarbPunkt farbe={f.color} />
                  <span className="font-medium">{tt(T.fassungNr).replace('{n}', String(f.number))} · {farbname(f.color)}</span>
                  <span className="text-muted-foreground">{formatDate(f.created_at)}</span>
                  {f.filename && <span className="text-muted-foreground truncate max-w-[12rem]" title={f.filename}>{f.filename}</span>}
                  {f.number > 0 && (
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                      {f.unveraendert} {tt(T.unveraendert)} · {f.geaendert} {tt(T.geaendert)} · {f.neu} {tt(T.neu)} · {f.entfaellt} {tt(T.entfaelltZahl)}
                    </span>
                  )}
                </div>
                {(f.aenderungen ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {f.aenderungen.filter((a: any) => a.scene_id).map((a: any) => (
                      <button key={`${a.scene_id}-${a.change}`} type="button"
                        onClick={() => setAuswahl({ fassung: f.id, szene: a.scene_id, nummer: a.scene_number })}
                        aria-label={tt(T.szeneAnsehen).replace('{n}', a.scene_number)}
                        className="text-xs rounded-full border border-border px-2 py-0.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <span className="font-mono">{a.scene_number}</span>
                        <span className="text-muted-foreground"> · {a.change === 'geaendert' ? tt(T.geaendert) : a.change === 'neu' ? tt(T.neu) : tt(T.entfaelltZahl)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onSchliessen}>{tt(T.schliessen)}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
