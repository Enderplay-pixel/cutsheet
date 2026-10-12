import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useDownload } from '@/lib/useDownload'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import {
  TrendingUp, Download, ArrowLeft, Info, AlertTriangle, Palette, Check, X, HelpCircle,
} from 'lucide-react'

const euro = (cents: number) =>
  (Number(cents || 0) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })

const heute = () => new Date().toISOString().slice(0, 10)
const jahresanfang = () => `${new Date().getFullYear()}-01-01`

/** Promille als Prozent mit einer Nachkommastelle: 723 wird zu "72,3 %". */
const anteil = (promille: number | null) =>
  promille === null || promille === undefined
    ? '—'
    : `${(promille / 10).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`

const monatsname = (monat: string) => {
  const [j, m] = String(monat).split('-')
  const d = new Date(Number(j), Number(m) - 1, 1)
  return Number.isNaN(d.getTime()) ? monat : d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })
}

export function Component() {
  const { companyId } = useParams()
  const firmaId = Number(companyId)
  const { data: firma } = useQuery({ queryKey: ['firma', firmaId], queryFn: () => api.firmen.lesen(firmaId) })

  return (
    <div className="px-5 py-6 sm:p-6 max-w-5xl mx-auto space-y-4">
      <PageHeader
        title="Auswertungen"
        subtitle={firma?.name || ''}
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/firma/${firmaId}`}>
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Zur Firma
            </Link>
          </Button>
        }
      />

      <Tabs defaultValue="zahlen">
        <TabsList>
          <TabsTrigger value="zahlen">
            <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
            Umsatz und Deckungsbeitrag
          </TabsTrigger>
          <TabsTrigger value="ksk">
            <Palette className="w-3.5 h-3.5 mr-1.5" />
            Künstlersozialabgabe
          </TabsTrigger>
        </TabsList>

        <TabsContent value="zahlen" className="mt-4"><Zahlen firmaId={firmaId} /></TabsContent>
        <TabsContent value="ksk" className="mt-4"><Ksk firmaId={firmaId} /></TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Umsatz und Deckungsbeitrag ──────────────────────────────────────────────

function Zahlen({ firmaId }: { firmaId: number }) {
  const download = useDownload()
  const [von, setVon] = useState(jahresanfang())
  const [bis, setBis] = useState(heute())

  const { data, isLoading } = useQuery({
    queryKey: ['auswertungen', firmaId, von, bis],
    queryFn: () => api.auswertungen.lesen(firmaId, von, bis),
  })

  const monate: any[] = data?.je_monat ?? []
  // Der höchste Monat gibt den Maßstab für die Balken. Ohne Umsatz kein
  // Maßstab - dann bleiben die Balken leer statt durch Null zu teilen.
  const hoechster = Math.max(1, ...monate.map((m) => m.umsatz_cents))

  if (isLoading) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Lade…</CardContent></Card>
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="ausw-von">Von</Label>
              <Input id="ausw-von" type="date" value={von} onChange={(e) => setVon(e.target.value)} className="w-40" />
            </div>
            <div>
              <Label htmlFor="ausw-bis">Bis</Label>
              <Input id="ausw-bis" type="date" value={bis} onChange={(e) => setBis(e.target.value)} className="w-40" />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mb-0.5"
              onClick={() => download(api.auswertungen.csvUrl(firmaId, von, bis), `auswertung-${von}-bis-${bis}.csv`)}
            >
              <Download className="w-4 h-4 mr-1.5" />
              Als CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: 'Umsatz netto', wert: data?.umsatz_cents ?? 0, klasse: '' },
          { label: 'Kosten', wert: data?.kosten_cents ?? 0, klasse: '' },
          {
            label: 'Deckungsbeitrag',
            wert: data?.deckungsbeitrag_cents ?? 0,
            klasse: (data?.deckungsbeitrag_cents ?? 0) < 0
              ? 'text-destructive'
              : 'text-emerald-600 dark:text-emerald-400',
          },
          { label: 'Noch offen', wert: data?.offen_cents ?? 0, klasse: 'text-amber-600 dark:text-amber-400' },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="pt-5">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</div>
              <div className={`text-xl font-semibold mt-1 tabular-nums ${k.klasse}`}>{euro(k.wert)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Umsatz ist der Nettobetrag festgeschriebener Rechnungen - die Umsatzsteuer gehört der Firma
        nicht. "Noch offen" ist dagegen brutto, weil das der Betrag ist, der aufs Konto kommt.
      </p>

      {/* Je Monat */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Je Monat</CardTitle></CardHeader>
        <CardContent>
          {monate.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Keine festgeschriebenen Rechnungen in diesem Zeitraum.
            </p>
          ) : (
            <div className="space-y-1.5">
              {monate.map((m) => (
                <div key={m.monat} className="flex items-center gap-3 text-sm">
                  <span className="w-16 shrink-0 text-xs text-muted-foreground">{monatsname(m.monat)}</span>
                  <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-foreground/30 rounded-full"
                      style={{ width: `${Math.round((m.umsatz_cents / hoechster) * 100)}%` }}
                    />
                  </div>
                  <span className="tabular-nums w-28 text-right">{euro(m.umsatz_cents)}</span>
                  <span className="text-xs text-muted-foreground w-20 text-right">
                    {m.drehtage > 0 ? `${m.drehtage} ${m.drehtage === 1 ? 'Drehtag' : 'Drehtage'}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}

          {(data?.drehtage_ohne_umsatz ?? []).length > 0 && (
            <div className="flex items-start gap-2 text-xs p-3 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 mt-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Gedreht, aber nicht abgerechnet:{' '}
                {data.drehtage_ohne_umsatz.map((d: any) => `${monatsname(d.monat)} (${d.drehtage})`).join(', ')}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Je Auftraggeber */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Je Auftraggeber</CardTitle></CardHeader>
        <CardContent>
          {(data?.je_kunde ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Noch nichts abgerechnet.</p>
          ) : (
            <div className="space-y-1.5">
              {data.je_kunde.map((k: any) => (
                <div key={k.id} className="flex items-center gap-3 text-sm">
                  <span className="flex-1 min-w-0 truncate">{k.name}</span>
                  <span className="text-xs text-muted-foreground w-16 text-right">{anteil(k.anteil_promille)}</span>
                  <span className="tabular-nums w-28 text-right">{euro(k.umsatz_cents)}</span>
                </div>
              ))}
            </div>
          )}
          {(data?.je_kunde ?? []).length > 0 && data.je_kunde[0].anteil_promille > 500 && (
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-3">
              {anteil(data.je_kunde[0].anteil_promille)} des Umsatzes kommen von einem einzigen
              Auftraggeber. Fällt der weg, fällt viel weg.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Je Projekt */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Je Projekt</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-border/60 bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="text-left py-2.5 px-4">Projekt</th>
                  <th className="text-right py-2.5 px-4">Umsatz</th>
                  <th className="text-right py-2.5 px-4">Kosten</th>
                  <th className="text-right py-2.5 px-4">Deckungsbeitrag</th>
                  <th className="text-right py-2.5 px-4">Marge</th>
                </tr>
              </thead>
              <tbody>
                {(data?.je_projekt ?? []).length === 0 ? (
                  <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">Nichts zu zeigen.</td></tr>
                ) : (
                  data.je_projekt.map((p: any) => (
                    <tr key={p.id} className="border-b border-border/40">
                      <td className="py-2.5 px-4">{p.titel}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums">{euro(p.umsatz_cents)}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">
                        {euro(p.kosten_cents)}
                      </td>
                      <td className={`py-2.5 px-4 text-right tabular-nums ${
                        p.deckungsbeitrag_cents < 0 ? 'text-destructive' : ''
                      }`}>
                        {euro(p.deckungsbeitrag_cents)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-xs text-muted-foreground">
                        {anteil(p.marge_promille)}
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

// ─── Künstlersozialabgabe ────────────────────────────────────────────────────

function Ksk({ firmaId }: { firmaId: number }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const download = useDownload()
  const [jahr, setJahr] = useState(new Date().getFullYear() - 1)
  const [nurOffene, setNurOffene] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['ksk', firmaId, jahr],
    queryFn: () => api.ksk.meldung(firmaId, jahr),
  })

  const kennzeichnen = useMutation({
    mutationFn: ({ art, id, wert }: { art: string; id: number; wert: boolean | null }) =>
      api.ksk.kennzeichnen(firmaId, art, id, wert),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ksk', firmaId] }),
    onError: (f: any) => toast({ title: 'Nicht gespeichert', description: f.message, variant: 'destructive' }),
  })

  const personen: any[] = data?.personen ?? []
  const gezeigt = nurOffene ? personen.filter((p) => p.ksk_relevant === null) : personen

  if (isLoading) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Lade…</CardContent></Card>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-xs p-3 rounded-lg bg-muted">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Wer künstlerische Leistungen verwertet, zahlt auf die Honorare an selbständige
          Künstlerinnen und Publizisten eine Abgabe an die Künstlersozialkasse - zusätzlich, aus
          eigener Tasche. Gemeldet wird bis zum 31. März für das Vorjahr. Wer nicht meldet, wird
          geschätzt.
        </span>
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="ksk-jahr">Jahr</Label>
              <Select value={String(jahr)} onValueChange={(w) => setJahr(Number(w))}>
                <SelectTrigger id="ksk-jahr" className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(data?.jahre_mit_satz ?? [jahr]).map((j: number) => (
                    <SelectItem key={j} value={String(j)}>{j}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mb-0.5"
              onClick={() => download(api.ksk.csvUrl(firmaId, jahr), `ksk-${jahr}.csv`)}
              disabled={(data?.gezaehlt ?? 0) === 0}
            >
              <Download className="w-4 h-4 mr-1.5" />
              Aufstellung als CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Bemessungsgrundlage</div>
            <div className="text-xl font-semibold mt-1 tabular-nums">{euro(data?.grundlageCents ?? 0)}</div>
            <div className="text-xs text-muted-foreground mt-1">{data?.gezaehlt ?? 0} Personen</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Abgabesatz {jahr}</div>
            <div className="text-xl font-semibold mt-1">
              {data?.satz_text ? `${data.satz_text} %` : '—'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {data?.ksk_art === 'eigenwerber' ? 'Eigenwerber' : 'Verwerter'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Abgabe</div>
            <div className="text-xl font-semibold mt-1 tabular-nums">{euro(data?.abgabeCents ?? 0)}</div>
            <div className={`text-xs mt-1 ${data?.ueberfaellig ? 'text-destructive' : 'text-muted-foreground'}`}>
              {data?.ueberfaellig ? 'Frist war ' : 'Meldung bis '}
              {data?.frist ? new Date(data.frist).toLocaleDateString('de-DE') : '—'}
            </div>
          </CardContent>
        </Card>
      </div>

      {data?.hinweis && (
        <div className="flex items-start gap-2 text-xs p-3 rounded-lg bg-muted">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{data.hinweis}</span>
        </div>
      )}

      {(data?.unentschieden ?? 0) > 0 && (
        <div className="flex items-start gap-2 text-sm p-3 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Bei <strong>{data.unentschieden}</strong> Personen mit zusammen{' '}
            {euro(data.unentschieden_cents)} Honorar ist noch nicht entschieden, ob sie
            künstlerisch tätig sind. Solange ist die Meldung nicht fertig - egal, wie plausibel die
            Summe aussieht.
          </span>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Honorare {jahr}</CardTitle>
          <Button variant={nurOffene ? 'default' : 'outline'} size="sm" onClick={() => setNurOffene((v) => !v)}>
            Nur offene
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-border/60 bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="text-left py-2.5 px-4">Person</th>
                  <th className="text-left py-2.5 px-4">Funktion</th>
                  <th className="text-right py-2.5 px-4">Tage</th>
                  <th className="text-right py-2.5 px-4">Honorar</th>
                  <th className="text-center py-2.5 px-4">Künstlerisch tätig</th>
                </tr>
              </thead>
              <tbody>
                {gezeigt.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-muted-foreground">
                      {nurOffene ? 'Alles entschieden.' : `Keine Honorare in ${jahr}.`}
                    </td>
                  </tr>
                ) : (
                  gezeigt.map((p) => (
                    <tr key={`${p.art}:${p.id}`} className="border-b border-border/40">
                      <td className="py-2.5 px-4">
                        {p.name}
                        <span className="text-xs text-muted-foreground block">{p.projekt}</span>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-muted-foreground">
                        {p.funktion || (p.art === 'cast' ? 'Darsteller' : '—')}
                        {p.ksk_relevant === null && p.vorschlag && (
                          <span className="block text-amber-600 dark:text-amber-400">Vorschlag: ja</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums">{p.tage}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums">{euro(p.honorar_cents)}</td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant={p.ksk_relevant === true ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => kennzeichnen.mutate({ art: p.art, id: p.id, wert: true })}
                            aria-label={`${p.name} ist künstlerisch tätig`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant={p.ksk_relevant === false ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => kennzeichnen.mutate({ art: p.art, id: p.id, wert: false })}
                            aria-label={`${p.name} ist nicht künstlerisch tätig`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant={p.ksk_relevant === null ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => kennzeichnen.mutate({ art: p.art, id: p.id, wert: null })}
                            aria-label={`${p.name}: noch nicht entschieden`}
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Der Vorschlag richtet sich nach der Funktionsbezeichnung und ersetzt die Entscheidung
        nicht. Die Kasse sieht auf die tatsächliche Tätigkeit, nicht auf die Bezeichnung im
        Abspann - und sie prüft rückwirkend.
      </p>
    </div>
  )
}
