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
import type { Lang } from '@/lib/i18n'
import { useT, useGebietsschema } from '@/lib/useT'
import { angeboteT, angebotStatusT } from '@/lib/texte/Angebote'
import { parseISO } from 'date-fns'

const euro = (cents: number, gebietsschema: string) =>
  (Number(cents || 0) / 100).toLocaleString(gebietsschema, { style: 'currency', currency: 'EUR' })

const datum = (wert: string | null | undefined, gebietsschema: string) =>
  wert ? parseISO(String(wert).slice(0, 10)).toLocaleDateString(gebietsschema) : '-'

const heute = () => new Date().toISOString().slice(0, 10)

const STATUS: Record<string, { label: Record<Lang, string>; klasse: string }> = {
  entwurf:    { label: angebotStatusT.entwurf,    klasse: 'bg-muted text-muted-foreground' },
  versendet:  { label: angebotStatusT.versendet,  klasse: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  angenommen: { label: angebotStatusT.angenommen, klasse: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  abgelehnt:  { label: angebotStatusT.abgelehnt,  klasse: 'bg-destructive/15 text-destructive' },
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
  const tt = useT()
  const gs = useGebietsschema()

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
      toast({ title: tt(angeboteT.nichtAngelegt), description: fehler.message, variant: 'destructive' }),
  })

  const liste: any[] = angebote ?? []
  const offen = liste.filter((a) => a.status === 'versendet' && !a.abgelaufen)
  const offenSumme = offen.reduce((s, a) => s + Number(a.gross_cents || 0), 0)

  return (
    <div className="px-5 py-6 sm:p-6 max-w-6xl mx-auto space-y-4">
      <PageHeader
        title={tt(angeboteT.titel)}
        subtitle={firma?.name || ''}
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/firma/${firmaId}/rechnungen`}>
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                {tt(angeboteT.rechnungen)}
              </Link>
            </Button>
            <Button size="sm" onClick={() => anlegen.mutate()} disabled={anlegen.isPending}>
              <Plus className="w-4 h-4 mr-1.5" />
              {tt(angeboteT.neuesAngebot)}
            </Button>
          </div>
        }
      />

      {offen.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{tt(angeboteT.inDerSchwebe)}</div>
            <div className="text-2xl font-semibold mt-1">{euro(offenSumme, gs)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {tt(offen.length === 1 ? angeboteT.angebotOffen : angeboteT.angeboteOffen).replace('{n}', String(offen.length))}
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
                  <th className="text-left py-2.5 px-4">{tt(angeboteT.nummer)}</th>
                  <th className="text-left py-2.5 px-4">{tt(angeboteT.auftraggeber)}</th>
                  <th className="text-left py-2.5 px-4">{tt(angeboteT.datum)}</th>
                  <th className="text-left py-2.5 px-4">{tt(angeboteT.gueltigBis)}</th>
                  <th className="text-right py-2.5 px-4">{tt(angeboteT.betrag)}</th>
                  <th className="text-left py-2.5 px-4">{tt(angeboteT.stand)}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="py-14 text-center text-muted-foreground">{tt(angeboteT.lade)}</td></tr>
                ) : liste.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-14 text-center text-muted-foreground">
                      {tt(angeboteT.nochKeins)}
                      <span className="block text-xs mt-1">
                        {tt(angeboteT.nochKeinsText)}
                      </span>
                    </td>
                  </tr>
                ) : (
                  liste.map((a) => (
                    <tr key={a.id} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="py-2.5 px-4 font-mono text-xs">
                        <Link to={`/firma/${firmaId}/angebote/${a.id}`} className="hover:underline">
                          {a.number || tt(angeboteT.entwurf)}
                        </Link>
                      </td>
                      <td className="py-2.5 px-4">
                        {a.client_name || <span className="text-muted-foreground">{tt(angeboteT.keinAuftraggeber)}</span>}
                        {a.project_title && (
                          <span className="text-xs text-muted-foreground block">{a.project_title}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">{datum(a.issue_date, gs)}</td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {datum(a.valid_until, gs)}
                        {a.abgelaufen && (
                          <span className="text-xs text-amber-600 dark:text-amber-400 block">{tt(angeboteT.abgelaufen)}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums">{euro(a.gross_cents, gs)}</td>
                      <td className="py-2.5 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS[a.status]?.klasse ?? ''}`}>
                          {STATUS[a.status] ? tt(STATUS[a.status].label) : a.status}
                        </span>
                        {a.rechnung_id && (
                          <Link
                            to={`/firma/${firmaId}/rechnungen/${a.rechnung_id}`}
                            className="text-xs text-muted-foreground block hover:underline"
                          >
                            → {a.rechnung_nummer || tt(angeboteT.rechnungsentwurf)}
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
  const tt = useT()
  const gs = useGebietsschema()
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
      toast({ title: tt(angeboteT.nichtGespeichert), description: fehler.message, variant: 'destructive' }),
  })

  const positionen = useMutation({
    mutationFn: (items: any[]) => api.angebote.positionen(firmaId, id, items),
    onSuccess: neuLaden,
    onError: (fehler: any) =>
      toast({ title: tt(angeboteT.nichtGespeichert), description: fehler.message, variant: 'destructive' }),
  })

  const festschreiben = useMutation({
    mutationFn: () => api.angebote.festschreiben(firmaId, id),
    onSuccess: (ergebnis: any) => {
      neuLaden()
      toast({ title: tt(angeboteT.angebotNummer).replace('{n}', String(ergebnis.number)), description: tt(angeboteT.festgeschriebenBereit) })
    },
    onError: (fehler: any) =>
      toast({ title: tt(angeboteT.nichtFestgeschrieben), description: fehler.message, variant: 'destructive' }),
  })

  const annehmen = useMutation({
    mutationFn: () => api.angebote.annehmen(firmaId, id, { accepted_on: heute(), issue_date: heute() }),
    onSuccess: (ergebnis: any) => {
      neuLaden()
      setFrage(null)
      toast({
        title: tt(angeboteT.angebotAngenommen),
        description: tt(angeboteT.angebotAngenommenText),
      })
      if (ergebnis?.rechnung?.id) navigate(`/firma/${firmaId}/rechnungen/${ergebnis.rechnung.id}`)
    },
    onError: (fehler: any) =>
      toast({ title: tt(angeboteT.nichtAngenommen), description: fehler.message, variant: 'destructive' }),
  })

  const ablehnen = useMutation({
    mutationFn: () => api.angebote.ablehnen(firmaId, id, grund),
    onSuccess: () => { neuLaden(); setFrage(null); toast({ title: tt(angeboteT.alsAbgelehntVermerkt) }) },
    onError: (fehler: any) =>
      toast({ title: tt(angeboteT.nichtVermerkt), description: fehler.message, variant: 'destructive' }),
  })

  const loeschen = useMutation({
    mutationFn: () => api.angebote.loeschen(firmaId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['angebote', firmaId] })
      navigate(`/firma/${firmaId}/angebote`)
    },
    onError: (fehler: any) =>
      toast({ title: tt(angeboteT.nichtGeloescht), description: fehler.message, variant: 'destructive' }),
  })

  if (isLoading) {
    return <div className="px-5 py-10 text-center text-sm text-muted-foreground">{tt(angeboteT.lade)}</div>
  }
  if (!angebot) {
    return <div className="px-5 py-10 text-center text-sm text-muted-foreground">{tt(angeboteT.nichtGefunden)}</div>
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
        title={angebot.number || tt(angeboteT.angebotsentwurf)}
        subtitle={angebot.client_name || tt(angeboteT.keinAuftraggeber)}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/firma/${firmaId}/angebote`}>
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                {tt(angeboteT.uebersicht)}
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => download(api.angebote.pdfUrl(firmaId, id), `angebot-${angebot.number || id}.pdf`)}
            >
              <FileText className="w-4 h-4 mr-1.5" />
              {tt(angeboteT.blatt)}
            </Button>
            {istEntwurf && (
              <Button
                size="sm"
                disabled={festschreiben.isPending}
                onClick={() => {
                  if (confirm(tt(angeboteT.festschreibenFrage))) festschreiben.mutate()
                }}
              >
                <Lock className="w-4 h-4 mr-1.5" />
                {tt(angeboteT.festschreiben)}
              </Button>
            )}
            {angebot.status === 'versendet' && (
              <>
                <Button variant="outline" size="sm" onClick={() => setFrage('ablehnen')}>
                  <X className="w-4 h-4 mr-1.5" />
                  {tt(angeboteT.abgelehnt)}
                </Button>
                <Button size="sm" onClick={() => setFrage('annehmen')}>
                  <Check className="w-4 h-4 mr-1.5" />
                  {tt(angeboteT.angenommen)}
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="flex items-center gap-2 text-sm">
        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS[angebot.status]?.klasse ?? ''}`}>
          {STATUS[angebot.status] ? tt(STATUS[angebot.status].label) : angebot.status}
        </span>
        {angebot.accepted_on && (
          <span className="text-xs text-muted-foreground">
            {tt(angeboteT.angenommenAm).replace('{datum}', datum(angebot.accepted_on, gs))}
          </span>
        )}
        {angebot.status === 'versendet' && angebot.valid_until && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {tt(angeboteT.gueltigBisDatum).replace('{datum}', datum(angebot.valid_until, gs))}
          </span>
        )}
      </div>

      {/* Kopfdaten */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">{tt(angeboteT.angaben)}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="angebot-kunde">{tt(angeboteT.auftraggeber)}</Label>
            <Select
              value={angebot.client_id ? String(angebot.client_id) : ''}
              onValueChange={(w) => speichern.mutate({ client_id: Number(w) })}
              disabled={!bearbeitbar}
            >
              <SelectTrigger id="angebot-kunde"><SelectValue placeholder={tt(angeboteT.waehlen)} /></SelectTrigger>
              <SelectContent>
                {(kunden ?? []).map((k: any) => (
                  <SelectItem key={k.id} value={String(k.id)}>{k.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="angebot-projekt">{tt(angeboteT.projekt)}</Label>
            <Select
              value={angebot.project_id ? String(angebot.project_id) : ''}
              onValueChange={(w) => speichern.mutate({ project_id: Number(w) })}
              disabled={!bearbeitbar}
            >
              <SelectTrigger id="angebot-projekt"><SelectValue placeholder={tt(angeboteT.freiwillig)} /></SelectTrigger>
              <SelectContent>
                {(projekte ?? []).map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="angebot-datum">{tt(angeboteT.datum)}</Label>
            <Input
              id="angebot-datum"
              type="date"
              defaultValue={angebot.issue_date ? String(angebot.issue_date).slice(0, 10) : ''}
              onBlur={(e) => speichern.mutate({ issue_date: e.target.value })}
              disabled={!bearbeitbar}
            />
          </div>
          <div>
            <Label htmlFor="angebot-gueltig">{tt(angeboteT.gueltigBis)}</Label>
            <Input
              id="angebot-gueltig"
              type="date"
              defaultValue={angebot.valid_until ? String(angebot.valid_until).slice(0, 10) : ''}
              onBlur={(e) => speichern.mutate({ valid_until: e.target.value })}
              disabled={!bearbeitbar}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="angebot-einleitung">{tt(angeboteT.einleitung)}</Label>
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
          <CardTitle className="text-base">{tt(angeboteT.positionen)}</CardTitle>
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
              {tt(angeboteT.position)}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {tt(angeboteT.keinePosition)}
            </p>
          ) : (
            items.map((p, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-12 items-end">
                <div className="sm:col-span-5">
                  {i === 0 && <Label htmlFor={`pos-text-${i}`}>{tt(angeboteT.leistung)}</Label>}
                  <Input
                    id={`pos-text-${i}`}
                    aria-label={tt(angeboteT.leistung)}
                    defaultValue={p.description}
                    onBlur={(e) => posten(i, 'description', e.target.value)}
                    disabled={!bearbeitbar}
                  />
                </div>
                <div className="sm:col-span-2">
                  {i === 0 && <Label htmlFor={`pos-menge-${i}`}>{tt(angeboteT.menge)}</Label>}
                  <Input
                    id={`pos-menge-${i}`}
                    aria-label={tt(angeboteT.menge)}
                    defaultValue={(Number(p.quantity_milli) / 1000).toString().replace('.', ',')}
                    onBlur={(e) =>
                      posten(i, 'quantity_milli', Math.round(Number(e.target.value.replace(',', '.')) * 1000))
                    }
                    disabled={!bearbeitbar}
                    inputMode="decimal"
                  />
                </div>
                <div className="sm:col-span-1">
                  {i === 0 && <Label htmlFor={`pos-einheit-${i}`}>{tt(angeboteT.einheit)}</Label>}
                  <Input
                    id={`pos-einheit-${i}`}
                    aria-label={tt(angeboteT.einheit)}
                    defaultValue={p.unit}
                    onBlur={(e) => posten(i, 'unit', e.target.value)}
                    disabled={!bearbeitbar}
                  />
                </div>
                <div className="sm:col-span-2">
                  {i === 0 && <Label htmlFor={`pos-preis-${i}`}>{tt(angeboteT.einzelpreis)}</Label>}
                  <Input
                    id={`pos-preis-${i}`}
                    aria-label={tt(angeboteT.einzelpreis)}
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
                    aria-label={tt(angeboteT.steuersatz)}
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
                      aria-label={tt(angeboteT.positionEntfernen)}
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
              <span className="text-muted-foreground">{tt(angeboteT.netto)}</span>
              <span className="tabular-nums">{euro(angebot.net_cents, gs)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tt(angeboteT.umsatzsteuer)}</span>
              <span className="tabular-nums">{euro(angebot.tax_cents, gs)}</span>
            </div>
            <div className="flex justify-between font-semibold text-base">
              <span>{tt(angeboteT.gesamt)}</span>
              <span className="tabular-nums">{euro(angebot.gross_cents, gs)}</span>
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
          {tt(angeboteT.entwurfLoeschen)}
        </Button>
      )}

      {frage === 'annehmen' && (
        <Dialog open onOpenChange={() => setFrage(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{tt(angeboteT.annehmenTitel).replace('{n}', String(angebot.number ?? ''))}</DialogTitle>
              <DialogDescription>
                {tt(angeboteT.annehmenText)}
              </DialogDescription>
            </DialogHeader>
            <div className="text-sm flex justify-between">
              <span className="text-muted-foreground">{tt(angeboteT.betrag)}</span>
              <span className="tabular-nums font-semibold">{euro(angebot.gross_cents, gs)}</span>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setFrage(null)}>{tt(angeboteT.abbrechen)}</Button>
              <Button onClick={() => annehmen.mutate()} disabled={annehmen.isPending}>
                <Receipt className="w-4 h-4 mr-1.5" />
                {tt(angeboteT.rechnungsentwurfAnlegen)}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {frage === 'ablehnen' && (
        <Dialog open onOpenChange={() => setFrage(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{tt(angeboteT.ablehnenTitel).replace('{n}', String(angebot.number ?? ''))}</DialogTitle>
              <DialogDescription>
                {tt(angeboteT.ablehnenText)}
              </DialogDescription>
            </DialogHeader>
            <div>
              <Label htmlFor="ablehnen-grund">{tt(angeboteT.grund)}</Label>
              <Textarea
                id="ablehnen-grund"
                value={grund}
                onChange={(e) => setGrund(e.target.value)}
                rows={3}
                placeholder={tt(angeboteT.grundBeispiel)}
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setFrage(null)}>{tt(angeboteT.abbrechen)}</Button>
              <Button variant="destructive" onClick={() => ablehnen.mutate()} disabled={ablehnen.isPending}>
                {tt(angeboteT.vermerken)}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
