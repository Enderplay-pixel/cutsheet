import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useDownload } from '@/lib/useDownload'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import {
  Plus, Trash2, FileText, ArrowLeft, Check, X, Lock, Clock, Receipt,
} from 'lucide-react'

const euro = (cents: number) =>
  (Number(cents || 0) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })

const datum = (wert: string | null | undefined) =>
  wert ? new Date(String(wert).slice(0, 10)).toLocaleDateString('de-DE') : '—'

const heute = () => new Date().toISOString().slice(0, 10)

const STATUS: Record<string, { label: string; klasse: string }> = {
  entwurf:    { label: 'Entwurf',    klasse: 'bg-muted text-muted-foreground' },
  versendet:  { label: 'Offen',      klasse: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  angenommen: { label: 'Angenommen', klasse: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  abgelehnt:  { label: 'Abgelehnt',  klasse: 'bg-destructive/15 text-destructive' },
}

/** Betrag aus einem Textfeld in Cent - ganzzahlig, ohne Fließkomma. */
function alsCents(text: string): number {
  const sauber = String(text).replace(/\s|\./g, '').replace(',', '.')
  const teile = sauber.split('.')
  const ganz = Math.abs(Math.trunc(Number(teile[0] || 0)))
  const rest = teile[1] ? Math.round(Number((teile[1] + '00').slice(0, 2))) : 0
  const betrag = ganz * 100 + rest
  return sauber.trimStart().startsWith('-') ? -betrag : betrag
}

const alsText = (cents: number) => (Number(cents || 0) / 100).toFixed(2).replace('.', ',')

export function Component() {
  const { companyId, quoteId } = useParams()
  const firmaId = Number(companyId)
  if (quoteId) return <AngebotBearbeiten firmaId={firmaId} id={Number(quoteId)} />
  return <Uebersicht firmaId={firmaId} />
}

// ─── Übersicht ───────────────────────────────────────────────────────────────

function Uebersicht({ firmaId }: { firmaId: number }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const navigate = useNavigate()

  const { data: firma } = useQuery({ queryKey: ['firma', firmaId], queryFn: () => api.firmen.lesen(firmaId) })
  const { data: angebote, isLoading } = useQuery({
    queryKey: ['angebote', firmaId],
    queryFn: () => api.angebote.liste(firmaId),
  })

  const anlegen = useMutation({
    mutationFn: () => api.angebote.anlegen(firmaId, { issue_date: heute() }),
    onSuccess: (ergebnis: any) => {
      qc.invalidateQueries({ queryKey: ['angebote', firmaId] })
      navigate(`/firma/${firmaId}/angebote/${ergebnis.id}`)
    },
    onError: (fehler: any) =>
      toast({ title: 'Nicht angelegt', description: fehler.message, variant: 'destructive' }),
  })

  const liste: any[] = angebote ?? []
  const offen = liste.filter((a) => a.status === 'versendet' && !a.abgelaufen)
  const offenSumme = offen.reduce((s, a) => s + Number(a.gross_cents || 0), 0)

  return (
    <div className="px-5 py-6 sm:p-6 max-w-6xl mx-auto space-y-4">
      <PageHeader
        title="Angebote"
        subtitle={firma?.name || ''}
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/firma/${firmaId}/rechnungen`}>
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Rechnungen
              </Link>
            </Button>
            <Button size="sm" onClick={() => anlegen.mutate()} disabled={anlegen.isPending}>
              <Plus className="w-4 h-4 mr-1.5" />
              Neues Angebot
            </Button>
          </div>
        }
      />

      {offen.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">In der Schwebe</div>
            <div className="text-2xl font-semibold mt-1">{euro(offenSumme)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {offen.length} {offen.length === 1 ? 'Angebot' : 'Angebote'} offen
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="text-left py-2.5 px-4">Nummer</th>
                  <th className="text-left py-2.5 px-4">Auftraggeber</th>
                  <th className="text-left py-2.5 px-4">Datum</th>
                  <th className="text-left py-2.5 px-4">Gültig bis</th>
                  <th className="text-right py-2.5 px-4">Betrag</th>
                  <th className="text-left py-2.5 px-4">Stand</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="py-14 text-center text-muted-foreground">Lade…</td></tr>
                ) : liste.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-14 text-center text-muted-foreground">
                      Noch kein Angebot.
                      <span className="block text-xs mt-1">
                        Ein angenommenes Angebot wird mit einem Klick zur Rechnung.
                      </span>
                    </td>
                  </tr>
                ) : (
                  liste.map((a) => (
                    <tr key={a.id} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="py-2.5 px-4 font-mono text-xs">
                        <Link to={`/firma/${firmaId}/angebote/${a.id}`} className="hover:underline">
                          {a.number || 'Entwurf'}
                        </Link>
                      </td>
                      <td className="py-2.5 px-4">
                        {a.client_name || <span className="text-muted-foreground">kein Auftraggeber</span>}
                        {a.project_title && (
                          <span className="text-xs text-muted-foreground block">{a.project_title}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">{datum(a.issue_date)}</td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {datum(a.valid_until)}
                        {a.abgelaufen && (
                          <span className="text-xs text-amber-600 dark:text-amber-400 block">abgelaufen</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums">{euro(a.gross_cents)}</td>
                      <td className="py-2.5 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS[a.status]?.klasse ?? ''}`}>
                          {STATUS[a.status]?.label ?? a.status}
                        </span>
                        {a.rechnung_id && (
                          <Link
                            to={`/firma/${firmaId}/rechnungen/${a.rechnung_id}`}
                            className="text-xs text-muted-foreground block hover:underline"
                          >
                            → {a.rechnung_nummer || 'Rechnungsentwurf'}
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Bearbeiten ──────────────────────────────────────────────────────────────

function AngebotBearbeiten({ firmaId, id }: { firmaId: number; id: number }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const navigate = useNavigate()
  const download = useDownload()
  const [frage, setFrage] = useState<'annehmen' | 'ablehnen' | null>(null)
  const [grund, setGrund] = useState('')

  const { data: angebot, isLoading } = useQuery({
    queryKey: ['angebot', firmaId, id],
    queryFn: () => api.angebote.lesen(firmaId, id),
  })
  const { data: kunden } = useQuery({ queryKey: ['kunden', firmaId], queryFn: () => api.rechnungen.kunden(firmaId) })
  const { data: projekte } = useQuery({ queryKey: ['projects'], queryFn: () => api.projects.list() })

  const neuLaden = () => {
    qc.invalidateQueries({ queryKey: ['angebot', firmaId, id] })
    qc.invalidateQueries({ queryKey: ['angebote', firmaId] })
  }

  const speichern = useMutation({
    mutationFn: (daten: any) => api.angebote.speichern(firmaId, id, daten),
    onSuccess: neuLaden,
    onError: (fehler: any) =>
      toast({ title: 'Nicht gespeichert', description: fehler.message, variant: 'destructive' }),
  })

  const positionen = useMutation({
    mutationFn: (items: any[]) => api.angebote.positionen(firmaId, id, items),
    onSuccess: neuLaden,
    onError: (fehler: any) =>
      toast({ title: 'Nicht gespeichert', description: fehler.message, variant: 'destructive' }),
  })

  const festschreiben = useMutation({
    mutationFn: () => api.angebote.festschreiben(firmaId, id),
    onSuccess: (ergebnis: any) => {
      neuLaden()
      toast({ title: `Angebot ${ergebnis.number}`, description: 'Festgeschrieben und bereit zum Versand.' })
    },
    onError: (fehler: any) =>
      toast({ title: 'Nicht festgeschrieben', description: fehler.message, variant: 'destructive' }),
  })

  const annehmen = useMutation({
    mutationFn: () => api.angebote.annehmen(firmaId, id, { accepted_on: heute(), issue_date: heute() }),
    onSuccess: (ergebnis: any) => {
      neuLaden()
      setFrage(null)
      toast({
        title: 'Angebot angenommen',
        description: 'Der Rechnungsentwurf ist angelegt. Die Rechnungsnummer wird beim Festschreiben gezogen.',
      })
      if (ergebnis?.rechnung?.id) navigate(`/firma/${firmaId}/rechnungen/${ergebnis.rechnung.id}`)
    },
    onError: (fehler: any) =>
      toast({ title: 'Nicht angenommen', description: fehler.message, variant: 'destructive' }),
  })

  const ablehnen = useMutation({
    mutationFn: () => api.angebote.ablehnen(firmaId, id, grund),
    onSuccess: () => { neuLaden(); setFrage(null); toast({ title: 'Als abgelehnt vermerkt' }) },
    onError: (fehler: any) =>
      toast({ title: 'Nicht vermerkt', description: fehler.message, variant: 'destructive' }),
  })

  const loeschen = useMutation({
    mutationFn: () => api.angebote.loeschen(firmaId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['angebote', firmaId] })
      navigate(`/firma/${firmaId}/angebote`)
    },
    onError: (fehler: any) =>
      toast({ title: 'Nicht gelöscht', description: fehler.message, variant: 'destructive' }),
  })

  if (isLoading) {
    return <div className="px-5 py-10 text-center text-sm text-muted-foreground">Lade…</div>
  }
  if (!angebot) {
    return <div className="px-5 py-10 text-center text-sm text-muted-foreground">Angebot nicht gefunden.</div>
  }

  const istEntwurf = angebot.status === 'entwurf'
  const bearbeitbar = angebot.status !== 'angenommen'
  const items: any[] = angebot.items ?? []

  const posten = (index: number, feld: string, wert: any) => {
    const neu = items.map((p, i) => (i === index ? { ...p, [feld]: wert } : p))
    positionen.mutate(neu)
  }

  return (
    <div className="px-5 py-6 sm:p-6 max-w-4xl mx-auto space-y-4">
      <PageHeader
        title={angebot.number || 'Angebotsentwurf'}
        subtitle={angebot.client_name || 'kein Auftraggeber'}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/firma/${firmaId}/angebote`}>
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Übersicht
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => download(api.angebote.pdfUrl(firmaId, id), `angebot-${angebot.number || id}.pdf`)}
            >
              <FileText className="w-4 h-4 mr-1.5" />
              Blatt
            </Button>
            {istEntwurf && (
              <Button size="sm" onClick={() => festschreiben.mutate()} disabled={festschreiben.isPending}>
                <Lock className="w-4 h-4 mr-1.5" />
                Festschreiben
              </Button>
            )}
            {angebot.status === 'versendet' && (
              <>
                <Button variant="outline" size="sm" onClick={() => setFrage('ablehnen')}>
                  <X className="w-4 h-4 mr-1.5" />
                  Abgelehnt
                </Button>
                <Button size="sm" onClick={() => setFrage('annehmen')}>
                  <Check className="w-4 h-4 mr-1.5" />
                  Angenommen
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="flex items-center gap-2 text-sm">
        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS[angebot.status]?.klasse ?? ''}`}>
          {STATUS[angebot.status]?.label ?? angebot.status}
        </span>
        {angebot.accepted_on && (
          <span className="text-xs text-muted-foreground">
            angenommen am {datum(angebot.accepted_on)}
          </span>
        )}
        {angebot.status === 'versendet' && angebot.valid_until && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            gültig bis {datum(angebot.valid_until)}
          </span>
        )}
      </div>

      {/* Kopfdaten */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Angaben</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="angebot-kunde">Auftraggeber</Label>
            <Select
              value={angebot.client_id ? String(angebot.client_id) : ''}
              onValueChange={(w) => speichern.mutate({ client_id: Number(w) })}
              disabled={!bearbeitbar}
            >
              <SelectTrigger id="angebot-kunde"><SelectValue placeholder="wählen" /></SelectTrigger>
              <SelectContent>
                {(kunden ?? []).map((k: any) => (
                  <SelectItem key={k.id} value={String(k.id)}>{k.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="angebot-projekt">Projekt</Label>
            <Select
              value={angebot.project_id ? String(angebot.project_id) : ''}
              onValueChange={(w) => speichern.mutate({ project_id: Number(w) })}
              disabled={!bearbeitbar}
            >
              <SelectTrigger id="angebot-projekt"><SelectValue placeholder="freiwillig" /></SelectTrigger>
              <SelectContent>
                {(projekte ?? []).map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="angebot-datum">Datum</Label>
            <Input
              id="angebot-datum"
              type="date"
              defaultValue={angebot.issue_date ? String(angebot.issue_date).slice(0, 10) : ''}
              onBlur={(e) => speichern.mutate({ issue_date: e.target.value })}
              disabled={!bearbeitbar}
            />
          </div>
          <div>
            <Label htmlFor="angebot-gueltig">Gültig bis</Label>
            <Input
              id="angebot-gueltig"
              type="date"
              defaultValue={angebot.valid_until ? String(angebot.valid_until).slice(0, 10) : ''}
              onBlur={(e) => speichern.mutate({ valid_until: e.target.value })}
              disabled={!bearbeitbar}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="angebot-einleitung">Einleitung</Label>
            <Textarea
              id="angebot-einleitung"
              defaultValue={angebot.intro || ''}
              onBlur={(e) => speichern.mutate({ intro: e.target.value })}
              disabled={!bearbeitbar}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Positionen */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Positionen</CardTitle>
          {bearbeitbar && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                positionen.mutate([
                  ...items,
                  { description: '', quantity_milli: 1000, unit: 'Tag', unit_price_cents: 0, tax_percent: 19 },
                ])
              }
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Position
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Noch keine Position. Ohne Position lässt sich das Angebot nicht festschreiben.
            </p>
          ) : (
            items.map((p, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-12 items-end">
                <div className="sm:col-span-5">
                  {i === 0 && <Label htmlFor={`pos-text-${i}`}>Leistung</Label>}
                  <Input
                    id={`pos-text-${i}`}
                    aria-label="Leistung"
                    defaultValue={p.description}
                    onBlur={(e) => posten(i, 'description', e.target.value)}
                    disabled={!bearbeitbar}
                  />
                </div>
                <div className="sm:col-span-2">
                  {i === 0 && <Label htmlFor={`pos-menge-${i}`}>Menge</Label>}
                  <Input
                    id={`pos-menge-${i}`}
                    aria-label="Menge"
                    defaultValue={(Number(p.quantity_milli) / 1000).toString().replace('.', ',')}
                    onBlur={(e) =>
                      posten(i, 'quantity_milli', Math.round(Number(e.target.value.replace(',', '.')) * 1000))
                    }
                    disabled={!bearbeitbar}
                    inputMode="decimal"
                  />
                </div>
                <div className="sm:col-span-1">
                  {i === 0 && <Label htmlFor={`pos-einheit-${i}`}>Einheit</Label>}
                  <Input
                    id={`pos-einheit-${i}`}
                    aria-label="Einheit"
                    defaultValue={p.unit}
                    onBlur={(e) => posten(i, 'unit', e.target.value)}
                    disabled={!bearbeitbar}
                  />
                </div>
                <div className="sm:col-span-2">
                  {i === 0 && <Label htmlFor={`pos-preis-${i}`}>Einzelpreis</Label>}
                  <Input
                    id={`pos-preis-${i}`}
                    aria-label="Einzelpreis"
                    defaultValue={alsText(p.unit_price_cents)}
                    onBlur={(e) => posten(i, 'unit_price_cents', alsCents(e.target.value))}
                    disabled={!bearbeitbar}
                    inputMode="decimal"
                  />
                </div>
                <div className="sm:col-span-1">
                  {i === 0 && <Label htmlFor={`pos-steuer-${i}`}>%</Label>}
                  <Input
                    id={`pos-steuer-${i}`}
                    aria-label="Steuersatz in Prozent"
                    defaultValue={p.tax_percent}
                    onBlur={(e) => posten(i, 'tax_percent', Math.round(Number(e.target.value) || 0))}
                    disabled={!bearbeitbar}
                    inputMode="numeric"
                  />
                </div>
                <div className="sm:col-span-1 flex justify-end">
                  {bearbeitbar && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => positionen.mutate(items.filter((_, j) => j !== i))}
                      aria-label="Position entfernen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}

          <div className="border-t border-border/60 pt-3 grid gap-1 text-sm max-w-xs ml-auto">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Netto</span>
              <span className="tabular-nums">{euro(angebot.net_cents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Umsatzsteuer</span>
              <span className="tabular-nums">{euro(angebot.tax_cents)}</span>
            </div>
            <div className="flex justify-between font-semibold text-base">
              <span>Gesamt</span>
              <span className="tabular-nums">{euro(angebot.gross_cents)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {istEntwurf && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => loeschen.mutate()}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="w-4 h-4 mr-1.5" />
          Entwurf löschen
        </Button>
      )}

      {frage === 'annehmen' && (
        <Dialog open onOpenChange={() => setFrage(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Angebot {angebot.number} annehmen</DialogTitle>
              <DialogDescription>
                Daraus entsteht ein Rechnungsentwurf mit denselben Positionen. Das Angebot bleibt
                unverändert stehen - es belegt, was vereinbart war.
              </DialogDescription>
            </DialogHeader>
            <div className="text-sm flex justify-between">
              <span className="text-muted-foreground">Betrag</span>
              <span className="tabular-nums font-semibold">{euro(angebot.gross_cents)}</span>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setFrage(null)}>Abbrechen</Button>
              <Button onClick={() => annehmen.mutate()} disabled={annehmen.isPending}>
                <Receipt className="w-4 h-4 mr-1.5" />
                Rechnungsentwurf anlegen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {frage === 'ablehnen' && (
        <Dialog open onOpenChange={() => setFrage(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Angebot {angebot.number} als abgelehnt vermerken</DialogTitle>
              <DialogDescription>
                Der Grund ist freiwillig. Wer nach einem Jahr sieht, dass drei Angebote am Preis
                gescheitert sind, kalkuliert anders.
              </DialogDescription>
            </DialogHeader>
            <div>
              <Label htmlFor="ablehnen-grund">Grund</Label>
              <Textarea
                id="ablehnen-grund"
                value={grund}
                onChange={(e) => setGrund(e.target.value)}
                rows={3}
                placeholder="zu teuer, Termin passte nicht, anderer Anbieter …"
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setFrage(null)}>Abbrechen</Button>
              <Button variant="destructive" onClick={() => ablehnen.mutate()} disabled={ablehnen.isPending}>
                Vermerken
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
