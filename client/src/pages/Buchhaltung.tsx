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
import { useT, useGebietsschema } from '@/lib/useT'
import { buchhaltungT } from '@/lib/texte/Buchhaltung'
import { Download, Info, AlertTriangle, ArrowLeft, Save, FileSpreadsheet } from 'lucide-react'

const euro = (cents: number, gebietsschema: string) =>
  (Number(cents || 0) / 100).toLocaleString(gebietsschema, { style: 'currency', currency: 'EUR' })

const heute = () => new Date().toISOString().slice(0, 10)
const jahresanfang = () => `${new Date().getFullYear()}-01-01`

export function Component() {
  const { companyId } = useParams()
  const firmaId = Number(companyId)
  const qc = useQueryClient()
  const { toast } = useToast()
  const download = useDownload()
  const tt = useT()
  const gebietsschema = useGebietsschema()

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
      toast({ title: tt(buchhaltungT.gespeichert) })
    },
    onError: (fehler: any) =>
      toast({ title: tt(buchhaltungT.nichtGespeichert), description: fehler.message, variant: 'destructive' }),
  })

  return (
    <div className="px-5 py-6 sm:p-6 max-w-4xl mx-auto space-y-4">
      <PageHeader
        title={tt(buchhaltungT.titel)}
        subtitle={firma?.name || ''}
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/firma/${firmaId}/rechnungen`}>
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              {tt(buchhaltungT.rechnungen)}
            </Link>
          </Button>
        }
      />

      {/* Zeitraum */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{tt(buchhaltungT.zeitraum)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="buch-von">{tt(buchhaltungT.von)}</Label>
              <Input id="buch-von" type="date" value={von} onChange={(e) => setVon(e.target.value)} className="w-40" />
            </div>
            <div>
              <Label htmlFor="buch-bis">{tt(buchhaltungT.bis)}</Label>
              <Input id="buch-bis" type="date" value={bis} onChange={(e) => setBis(e.target.value)} className="w-40" />
            </div>
            <div className="text-sm text-muted-foreground pb-2">
              {isLoading ? tt(buchhaltungT.lade) : tt(buchhaltungT.anzahlRechnungen).replace('{n}', String(pruefung?.rechnungen ?? 0))}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => download(api.buchhaltung.csvUrl(firmaId, von, bis), `buchhaltung-${von}-bis-${bis}.csv`)}
            disabled={(pruefung?.rechnungen ?? 0) === 0}
          >
            <FileSpreadsheet className="w-4 h-4 mr-1.5" />
            {tt(buchhaltungT.einfacheTabelle)}
          </Button>
          <p className="text-xs text-muted-foreground">
            {tt(buchhaltungT.einfacheTabelleText)}
          </p>
        </CardContent>
      </Card>

      {/* DATEV */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{tt(buchhaltungT.datevStapel)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-2 text-xs p-3 rounded-lg bg-muted">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {pruefung?.hinweis
                ?? tt(buchhaltungT.datevHinweis)}
            </span>
          </div>

          {(pruefung?.fehlt ?? []).length > 0 && (
            <div className="flex items-start gap-2 text-xs p-3 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">{tt(buchhaltungT.dafuerFehlt)}</div>
                <ul className="list-disc pl-4 mt-1 space-y-0.5">
                  {pruefung.fehlt.map((f: string) => <li key={f}>{f}</li>)}
                </ul>
              </div>
            </div>
          )}

          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tt(buchhaltungT.buchungen)}</span>
              <span className="tabular-nums">{pruefung?.buchungen ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tt(buchhaltungT.summe)}</span>
              <span className="tabular-nums">{euro(pruefung?.summe_cents ?? 0, gebietsschema)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tt(buchhaltungT.kontenrahmen)}</span>
              <span>{pruefung?.kontenrahmen ?? '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tt(buchhaltungT.erloeskonto19)}</span>
              <span className="font-mono">{pruefung?.erloeskonten?.regel19 ?? '-'}</span>
            </div>
          </div>

          <Button
            onClick={() =>
              download(api.buchhaltung.datevUrl(firmaId, von, bis), `EXTF_Buchungsstapel_${von}_${bis}.csv`)
            }
            disabled={!pruefung?.bereit}
          >
            <Download className="w-4 h-4 mr-1.5" />
            {tt(buchhaltungT.stapelHerunterladen)}
          </Button>
        </CardContent>
      </Card>

      {/* Einstellungen */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{tt(buchhaltungT.kanzlei)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="datev-berater">{tt(buchhaltungT.beraternummer)}</Label>
              <Input
                id="datev-berater"
                value={werte.datev_berater}
                onChange={(e) => setze('datev_berater', e.target.value)}
                inputMode="numeric"
                placeholder={tt(buchhaltungT.vomSteuerberater)}
              />
            </div>
            <div>
              <Label htmlFor="datev-mandant">{tt(buchhaltungT.mandantennummer)}</Label>
              <Input
                id="datev-mandant"
                value={werte.datev_mandant}
                onChange={(e) => setze('datev_mandant', e.target.value)}
                inputMode="numeric"
                placeholder={tt(buchhaltungT.vomSteuerberater)}
              />
            </div>
            <div>
              <Label htmlFor="datev-rahmen">{tt(buchhaltungT.kontenrahmen)}</Label>
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
              <Label htmlFor="datev-laenge">{tt(buchhaltungT.sachkontenlaenge)}</Label>
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
              <Label htmlFor="basiszins">{tt(buchhaltungT.basiszins)}</Label>
              <Input
                id="basiszins"
                value={werte.base_rate_bp}
                onChange={(e) => setze('base_rate_bp', e.target.value)}
                inputMode="numeric"
                placeholder={tt(buchhaltungT.basiszinsBeispiel)}
              />
            </div>
            <div>
              <Label htmlFor="basiszins-stand">{tt(buchhaltungT.gueltigSeit)}</Label>
              <Input
                id="basiszins-stand"
                type="date"
                value={werte.base_rate_date}
                onChange={(e) => setze('base_rate_date', e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {tt(buchhaltungT.basiszinsText)}
          </p>

          <div className="flex items-center gap-2 border-t border-border/60 pt-3">
            <input
              id="mahnwesen-an"
              type="checkbox"
              checked={werte.dunning_enabled}
              onChange={(e) => setze('dunning_enabled', e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="mahnwesen-an" className="font-normal">{tt(buchhaltungT.mahnwesen)}</Label>
          </div>

          <Button onClick={() => speichern.mutate()} disabled={speichern.isPending || !entwurf}>
            <Save className="w-4 h-4 mr-1.5" />
            {tt(buchhaltungT.speichern)}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
