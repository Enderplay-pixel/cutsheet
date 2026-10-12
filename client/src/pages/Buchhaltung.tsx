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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { Download, Info, AlertTriangle, ArrowLeft, Save, FileSpreadsheet } from 'lucide-react'

const euro = (cents: number) =>
  (Number(cents || 0) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })

const heute = () => new Date().toISOString().slice(0, 10)
const jahresanfang = () => `${new Date().getFullYear()}-01-01`

export function Component() {
  const { companyId } = useParams()
  const firmaId = Number(companyId)
  const qc = useQueryClient()
  const { toast } = useToast()
  const download = useDownload()

  const [von, setVon] = useState(jahresanfang())
  const [bis, setBis] = useState(heute())

  const { data: firma } = useQuery({ queryKey: ['firma', firmaId], queryFn: () => api.firmen.lesen(firmaId) })
  const { data: pruefung, isLoading } = useQuery({
    queryKey: ['datev-pruefung', firmaId, von, bis],
    queryFn: () => api.buchhaltung.datevPruefung(firmaId, von, bis),
  })

  // Die Felder werden erst gefüllt, wenn die Firma geladen ist. `?? ''` statt
  // `|| ''`, damit eine eingetragene 0 nicht zu einem leeren Feld wird.
  const [entwurf, setEntwurf] = useState<any>(null)
  const werte = entwurf ?? {
    datev_berater: firma?.datev_berater ?? '',
    datev_mandant: firma?.datev_mandant ?? '',
    datev_sachkontenlaenge: String(firma?.datev_sachkontenlaenge ?? 4),
    datev_kontenrahmen: firma?.datev_kontenrahmen ?? 'SKR03',
    base_rate_bp: firma?.base_rate_bp ?? '',
    base_rate_date: firma?.base_rate_date ? String(firma.base_rate_date).slice(0, 10) : '',
    dunning_enabled: firma?.dunning_enabled !== false,
  }
  const setze = (feld: string, wert: any) => setEntwurf({ ...werte, [feld]: wert })

  const speichern = useMutation({
    mutationFn: () => api.buchhaltung.einstellungen(firmaId, {
      datev_berater: werte.datev_berater === '' ? null : Number(werte.datev_berater),
      datev_mandant: werte.datev_mandant === '' ? null : Number(werte.datev_mandant),
      datev_sachkontenlaenge: Number(werte.datev_sachkontenlaenge),
      datev_kontenrahmen: werte.datev_kontenrahmen,
      base_rate_bp: werte.base_rate_bp === '' ? 0 : Number(werte.base_rate_bp),
      base_rate_date: werte.base_rate_date || null,
      dunning_enabled: werte.dunning_enabled,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['firma', firmaId] })
      qc.invalidateQueries({ queryKey: ['datev-pruefung', firmaId] })
      qc.invalidateQueries({ queryKey: ['opos', firmaId] })
      setEntwurf(null)
      toast({ title: 'Gespeichert' })
    },
    onError: (fehler: any) =>
      toast({ title: 'Nicht gespeichert', description: fehler.message, variant: 'destructive' }),
  })

  return (
    <div className="px-5 py-6 sm:p-6 max-w-4xl mx-auto space-y-4">
      <PageHeader
        title="Buchhaltung"
        subtitle={firma?.name || ''}
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/firma/${firmaId}/rechnungen`}>
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Rechnungen
            </Link>
          </Button>
        }
      />

      {/* Zeitraum */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Zeitraum</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="buch-von">Von</Label>
              <Input id="buch-von" type="date" value={von} onChange={(e) => setVon(e.target.value)} className="w-40" />
            </div>
            <div>
              <Label htmlFor="buch-bis">Bis</Label>
              <Input id="buch-bis" type="date" value={bis} onChange={(e) => setBis(e.target.value)} className="w-40" />
            </div>
            <div className="text-sm text-muted-foreground pb-2">
              {isLoading ? 'Lade…' : `${pruefung?.rechnungen ?? 0} Rechnungen`}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => download(api.buchhaltung.csvUrl(firmaId, von, bis), `buchhaltung-${von}-bis-${bis}.csv`)}
            disabled={(pruefung?.rechnungen ?? 0) === 0}
          >
            <FileSpreadsheet className="w-4 h-4 mr-1.5" />
            Einfache Tabelle als CSV
          </Button>
          <p className="text-xs text-muted-foreground">
            Eine Zeile je Rechnung und Steuersatz. Braucht keine Formatzusage - der Weg, wenn der
            Steuerberater nur die Rechnungen sehen will.
          </p>
        </CardContent>
      </Card>

      {/* DATEV */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">DATEV-Buchungsstapel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-2 text-xs p-3 rounded-lg bg-muted">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {pruefung?.hinweis
                ?? 'Der Stapel wird ohne Festschreibung erzeugt und lässt sich in DATEV ansehen und verwerfen.'}
            </span>
          </div>

          {(pruefung?.fehlt ?? []).length > 0 && (
            <div className="flex items-start gap-2 text-xs p-3 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">Dafür fehlt noch:</div>
                <ul className="list-disc pl-4 mt-1 space-y-0.5">
                  {pruefung.fehlt.map((f: string) => <li key={f}>{f}</li>)}
                </ul>
              </div>
            </div>
          )}

          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Buchungen</span>
              <span className="tabular-nums">{pruefung?.buchungen ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Summe</span>
              <span className="tabular-nums">{euro(pruefung?.summe_cents ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Kontenrahmen</span>
              <span>{pruefung?.kontenrahmen ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Erlöskonto 19 %</span>
              <span className="font-mono">{pruefung?.erloeskonten?.regel19 ?? '—'}</span>
            </div>
          </div>

          <Button
            onClick={() =>
              download(api.buchhaltung.datevUrl(firmaId, von, bis), `EXTF_Buchungsstapel_${von}_${bis}.csv`)
            }
            disabled={!pruefung?.bereit}
          >
            <Download className="w-4 h-4 mr-1.5" />
            Buchungsstapel herunterladen
          </Button>
        </CardContent>
      </Card>

      {/* Einstellungen */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Angaben der Kanzlei</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="datev-berater">Beraternummer</Label>
              <Input
                id="datev-berater"
                value={werte.datev_berater}
                onChange={(e) => setze('datev_berater', e.target.value)}
                inputMode="numeric"
                placeholder="vom Steuerberater"
              />
            </div>
            <div>
              <Label htmlFor="datev-mandant">Mandantennummer</Label>
              <Input
                id="datev-mandant"
                value={werte.datev_mandant}
                onChange={(e) => setze('datev_mandant', e.target.value)}
                inputMode="numeric"
                placeholder="vom Steuerberater"
              />
            </div>
            <div>
              <Label htmlFor="datev-rahmen">Kontenrahmen</Label>
              <Select
                value={werte.datev_kontenrahmen}
                onValueChange={(w) => setze('datev_kontenrahmen', w)}
              >
                <SelectTrigger id="datev-rahmen"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SKR03">SKR03</SelectItem>
                  <SelectItem value="SKR04">SKR04</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="datev-laenge">Sachkontenlänge</Label>
              <Select
                value={String(werte.datev_sachkontenlaenge)}
                onValueChange={(w) => setze('datev_sachkontenlaenge', w)}
              >
                <SelectTrigger id="datev-laenge"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[4, 5, 6, 7, 8].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t border-border/60 pt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="basiszins">Basiszinssatz in Basispunkten</Label>
              <Input
                id="basiszins"
                value={werte.base_rate_bp}
                onChange={(e) => setze('base_rate_bp', e.target.value)}
                inputMode="numeric"
                placeholder="152 = 1,52 %"
              />
            </div>
            <div>
              <Label htmlFor="basiszins-stand">Gültig seit</Label>
              <Input
                id="basiszins-stand"
                type="date"
                value={werte.base_rate_date}
                onChange={(e) => setze('base_rate_date', e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Der Basiszinssatz nach § 247 BGB ändert sich zum 1. Januar und zum 1. Juli. Leer heißt:
            CutSheet nimmt seinen eigenen Stand. Wer hier einträgt, trägt auch das Datum ein - sonst
            weiß später niemand, ob der Satz noch gilt.
          </p>

          <div className="flex items-center gap-2 border-t border-border/60 pt-3">
            <input
              id="mahnwesen-an"
              type="checkbox"
              checked={werte.dunning_enabled}
              onChange={(e) => setze('dunning_enabled', e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="mahnwesen-an" className="font-normal">Mahnwesen eingeschaltet</Label>
          </div>

          <Button onClick={() => speichern.mutate()} disabled={speichern.isPending || !entwurf}>
            <Save className="w-4 h-4 mr-1.5" />
            Speichern
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
