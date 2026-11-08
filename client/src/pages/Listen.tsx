import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Lang } from '@/lib/i18n'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Download, Upload, FileSpreadsheet, Check, AlertTriangle, Plus } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { useT, useGebietsschema } from '@/lib/useT'
import { useDownload } from '@/lib/useDownload'
import { listenT } from '@/lib/texte/Listen'

const LISTEN = [
  { wert: 'crew', label: listenT.stab },
  { wert: 'cast', label: listenT.besetzung },
  { wert: 'extras', label: listenT.komparserie },
]

const AUSGABEN = [
  { wert: 'crew', label: listenT.stab },
  { wert: 'cast', label: listenT.besetzung },
  { wert: 'scenes', label: listenT.szenen },
  { wert: 'shoot-days', label: listenT.drehplan },
]

const WAS: Record<string, { label: Record<Lang, string>; klasse: string }> = {
  neu:           { label: listenT.neu,           klasse: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  ergaenzt:      { label: listenT.ergaenzt,      klasse: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  uebersprungen: { label: listenT.uebersprungen, klasse: 'bg-muted text-muted-foreground' },
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const qc = useQueryClient()
  const { toast } = useToast()
  const tt = useT()
  const gebietsschema = useGebietsschema()
  const herunterladen = useDownload()

  const [art, setArt] = useState('crew')
  const [csv, setCsv] = useState('')
  const [vorschau, setVorschau] = useState<any | null>(null)

  const pruefen = useMutation({
    mutationFn: () => api.listen.importieren(pid, art, csv, false),
    onSuccess: (daten: any) => setVorschau(daten),
    onError: (fehler: any) =>
      toast({ title: tt(listenT.nichtLesbar), description: fehler.message, variant: 'destructive' }),
  })

  const uebernehmen = useMutation({
    mutationFn: () => api.listen.importieren(pid, art, csv, true),
    onSuccess: (daten: any) => {
      qc.invalidateQueries()
      setVorschau(null)
      setCsv('')
      toast({
        title: tt(listenT.angelegtErgaenzt).replace('{neu}', String(daten.neu)).replace('{ergaenzt}', String(daten.ergaenzt)),
        description: daten.uebersprungen > 0 ? tt(listenT.zeilenUebersprungen).replace('{n}', String(daten.uebersprungen)) : undefined,
      })
    },
    onError: (fehler: any) =>
      toast({ title: tt(listenT.nichtUebernommen), description: fehler.message, variant: 'destructive' }),
  })

  const dateiLesen = async (datei: File) => {
    const text = await datei.text()
    setCsv(text)
    setVorschau(null)
  }

  return (
    <div className="px-5 py-6 sm:p-6 max-w-4xl mx-auto space-y-4">
      <PageHeader
        title={tt(listenT.titel)}
        subtitle={tt(listenT.untertitel)}
      />

      <Tabs defaultValue="einlesen">
        <TabsList data-einfuehrung="reiter">
          <TabsTrigger value="einlesen" data-einfuehrung="reiter-einlesen"><Upload className="w-3.5 h-3.5 mr-1.5" />{tt(listenT.einlesen)}</TabsTrigger>
          <TabsTrigger value="ausgeben" data-einfuehrung="reiter-ausgeben"><Download className="w-3.5 h-3.5 mr-1.5" />{tt(listenT.ausgeben)}</TabsTrigger>
        </TabsList>

        <TabsContent value="einlesen" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">{tt(listenT.datei)}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{tt(listenT.wasEingelesen)}</Label>
                  <Select value={art} onValueChange={v => { setArt(v); setVorschau(null) }}>
                    <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LISTEN.map(l => <SelectItem key={l.wert} value={l.wert}>{tt(l.label)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <a href={api.listen.vorlageUrl(art)} download className="w-full">
                    <Button variant="outline" size="sm" className="w-full h-8 text-xs">
                      <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />{tt(listenT.vorlageHerunterladen)}
                    </Button>
                  </a>
                </div>
              </div>

              <div>
                <Label className="text-xs" htmlFor="datei">{tt(listenT.csvWaehlen)}</Label>
                <input
                  id="datei"
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-muted/40 file:px-3 file:py-1.5 file:text-xs file:text-foreground hover:file:bg-muted"
                  onChange={e => { const d = e.target.files?.[0]; if (d) dateiLesen(d) }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {tt(listenT.ausExcel)}
                </p>
              </div>

              <div>
                <Label className="text-xs" htmlFor="csv">{tt(listenT.inhaltEinfuegen)}</Label>
                <Textarea
                  id="csv"
                  value={csv}
                  onChange={e => { setCsv(e.target.value); setVorschau(null) }}
                  rows={6}
                  className="mt-1 text-xs font-mono resize-none"
                  placeholder={'Name;Funktion;Abteilung;E-Mail;Telefon;Tagessatz\nSarah Müller;Regisseurin;Regie;sarah@beispiel.de;0170 1234567;450,00'}
                />
              </div>

              <div className="flex gap-2">
                <Button size="sm" disabled={!csv.trim() || pruefen.isPending} onClick={() => pruefen.mutate()}>
                  {tt(listenT.vorschau)}
                </Button>
                {vorschau && (
                  <Button size="sm" variant="default" disabled={uebernehmen.isPending || vorschau.neu + vorschau.ergaenzt === 0}
                    onClick={() => uebernehmen.mutate()}>
                    <Check className="w-4 h-4 mr-1.5" />
                    {tt(listenT.uebernehmen).replace('{n}', String(vorschau.neu + vorschau.ergaenzt))}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {vorschau && (
            <Card>
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  {tt(listenT.vorschau)}
                  <Badge variant="secondary" className="text-xs font-normal">{tt(listenT.anzahlNeu).replace('{n}', String(vorschau.neu))}</Badge>
                  <Badge variant="secondary" className="text-xs font-normal">{tt(listenT.anzahlErgaenzt).replace('{n}', String(vorschau.ergaenzt))}</Badge>
                  {vorschau.uebersprungen > 0 && (
                    <Badge variant="secondary" className="text-xs font-normal">
                      {tt(listenT.anzahlUebersprungen).replace('{n}', String(vorschau.uebersprungen))}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  {tt(listenT.nichtsGespeichert)}
                </p>
                <div className="space-y-0.5 max-h-96 overflow-y-auto">
                  {vorschau.befunde.map((b: any) => (
                    <div key={b.zeile} className="flex items-center gap-3 py-1.5 border-b border-border/60 last:border-0 text-sm">
                      <span className="text-xs text-muted-foreground tabular-nums w-10 shrink-0">
                        {tt(listenT.zeile).replace('{n}', String(b.zeile))}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs shrink-0 ${WAS[b.was]?.klasse || ''}`}>
                        {WAS[b.was] ? tt(WAS[b.was].label) : b.was}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{b.name || <span className="text-muted-foreground">{tt(listenT.ohneNamen)}</span>}</p>
                        {b.grund && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 shrink-0" />{b.grund}
                          </p>
                        )}
                      </div>
                      {b.werte?.fee_per_day != null && (
                        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                          {(b.werte.fee_per_day / 100).toLocaleString(gebietsschema, { style: 'currency', currency: 'EUR' })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="ausgeben" className="mt-4">
          <Card>
            <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">{tt(listenT.alsCsv)}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {tt(listenT.oeffnetSich)}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {/* Über useDownload mit Anmeldung - ein einfacher Link schickt
                    keine mit, der Export antwortet dann 401 und die Datei
                    enthielt die Fehlermeldung (gemessen am 31.10.2026) */}
                {AUSGABEN.map(a => (
                  <Button key={a.wert} variant="outline" size="sm" className="w-full h-8 text-xs"
                    onClick={() => herunterladen(api.listen.exportUrl(pid, a.wert), `${a.wert}.csv`)}>
                    <Download className="w-3.5 h-3.5 mr-1.5" />{tt(a.label)}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
