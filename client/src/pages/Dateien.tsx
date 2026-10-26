import { useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useDownload, useAnsehen } from '@/lib/useDownload'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import {
  Upload, FileText, Image as ImageIcon, Trash2, Download, Eye,
  AlertTriangle, Clock, Info,
} from 'lucide-react'
import { useT, useGebietsschema } from '@/lib/useT'
import { dateienT as T, FRIST_TEXT } from '@/lib/texte/Dateien'

const datum = (wert: string | null | undefined, gs: string) =>
  wert ? new Date(String(wert).slice(0, 10)).toLocaleDateString(gs) : '-'

const FRIST: Record<string, { label: (typeof FRIST_TEXT)[string]; klasse: string }> = {
  gueltig:    { label: FRIST_TEXT.gueltig,    klasse: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  laeuft_ab:  { label: FRIST_TEXT.laeuft_ab,  klasse: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  abgelaufen: { label: FRIST_TEXT.abgelaufen, klasse: 'bg-destructive/15 text-destructive' },
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const qc = useQueryClient()
  const { toast } = useToast()
  const download = useDownload()
  const ansehen = useAnsehen()
  const tt = useT()
  const gs = useGebietsschema()
  const dateiFeld = useRef<HTMLInputElement>(null)

  const [art, setArt] = useState('')
  const [neueDatei, setNeueDatei] = useState<File | null>(null)
  const [bearbeite, setBearbeite] = useState<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['dateien', pid, art],
    queryFn: () => api.dateien.liste(pid, art ? { art } : {}),
  })

  const loeschen = useMutation({
    mutationFn: (id: number) => api.dateien.loeschen(pid, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dateien', pid] })
      toast({ title: tt(T.geloescht) })
    },
    onError: (f: any) => toast({ title: tt(T.nichtGeloescht), description: f.message, variant: 'destructive' }),
  })

  const dateien: any[] = data?.dateien ?? []
  const arten: any[] = data?.arten ?? []

  return (
    <div className="px-5 py-6 sm:p-6 max-w-5xl mx-auto space-y-4">
      <PageHeader
        title={tt(T.titel)}
        subtitle={tt(T.untertitel)}
      />

      <div className="flex items-start gap-2 text-xs p-3 rounded-lg bg-muted">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          {tt(T.hinweis)}
        </span>
      </div>

      {/* Hochladen */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="datei-feld">{tt(T.datei)}</Label>
              <Input
                id="datei-feld"
                ref={dateiFeld}
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setNeueDatei(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button
              onClick={() => setBearbeite({ neu: true, datei: neueDatei })}
              disabled={!neueDatei}
            >
              <Upload className="w-4 h-4 mr-1.5" />
              {tt(T.hochladen)}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant={art === '' ? 'default' : 'outline'} size="sm" onClick={() => setArt('')}>
          {tt(T.alle)}
        </Button>
        {arten.map((a) => (
          <Button
            key={a.art}
            variant={art === a.art ? 'default' : 'outline'}
            size="sm"
            onClick={() => setArt(a.art)}
          >
            {a.name}
          </Button>
        ))}
        {data && (
          <span className="text-xs text-muted-foreground ml-auto">
            {dateien.length} {dateien.length === 1 ? tt(T.dateiEinzahl) : tt(T.dateien)}
          </span>
        )}
      </div>

      {isLoading ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">{tt(T.lade)}</CardContent></Card>
      ) : dateien.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            {art ? tt(T.nichtsInArt) : tt(T.nochNichts)}
            <span className="block text-xs mt-1">
              {tt(T.ablaufHinweis)}
            </span>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="text-left py-2.5 px-4">{tt(T.datei)}</th>
                    <th className="text-left py-2.5 px-4">{tt(T.art)}</th>
                    <th className="text-right py-2.5 px-4">{tt(T.groesse)}</th>
                    <th className="text-left py-2.5 px-4">{tt(T.gueltigBis)}</th>
                    <th className="py-2.5 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {dateien.map((f) => (
                    <tr key={f.id} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          {String(f.mime).startsWith('image/')
                            ? <ImageIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            : <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                          <span className="truncate">{f.title || f.filename}</span>
                        </div>
                        {f.title && (
                          <span className="text-xs text-muted-foreground block pl-5.5">{f.filename}</span>
                        )}
                        {f.entity_type && (
                          <span className="text-xs text-muted-foreground block pl-5.5">
                            {tt(T.gehoertZu).replace('{typ}', String(f.entity_type)).replace('{id}', String(f.entity_id))}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground">
                        {arten.find((a) => a.art === f.kind)?.name ?? f.kind}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">
                        {f.groesse}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {f.valid_until ? (
                          <>
                            {datum(f.valid_until, gs)}
                            <span className={`text-xs px-2 py-0.5 rounded-full ml-1.5 ${FRIST[f.frist]?.klasse ?? ''}`}>
                              {FRIST[f.frist] ? tt(FRIST[f.frist].label) : ''}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => ansehen(api.dateien.inhaltUrl(pid, f.id))}
                          aria-label={tt(T.ansehen).replace('{name}', f.filename)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => download(`${api.dateien.inhaltUrl(pid, f.id)}?download=1`, f.filename)}
                          aria-label={tt(T.herunterladen).replace('{name}', f.filename)}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setBearbeite(f)}>{tt(T.aendern)}</Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => loeschen.mutate(f.id)}
                          aria-label={tt(T.loeschenAria).replace('{name}', f.filename)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {bearbeite && (
        <DateiDialog
          pid={pid}
          datei={bearbeite}
          arten={arten}
          schliessen={() => {
            setBearbeite(null)
            setNeueDatei(null)
            if (dateiFeld.current) dateiFeld.current.value = ''
          }}
          fertig={() => {
            qc.invalidateQueries({ queryKey: ['dateien', pid] })
            toast({ title: tt(T.gespeichert) })
          }}
        />
      )}
    </div>
  )
}

function DateiDialog({ pid, datei, arten, schliessen, fertig }: {
  pid: number; datei: any; arten: any[]; schliessen: () => void; fertig: () => void
}) {
  const { toast } = useToast()
  const tt = useT()
  const [werte, setWerte] = useState({
    kind: datei.kind || 'sonstiges',
    title: datei.title || '',
    notes: datei.notes || '',
    valid_until: datei.valid_until ? String(datei.valid_until).slice(0, 10) : '',
  })

  const mitFrist = arten.find((a) => a.art === werte.kind)?.mitFrist === true

  const speichern = useMutation({
    mutationFn: () => datei.neu
      ? api.dateien.hochladen(pid, datei.datei, {
          kind: werte.kind,
          title: werte.title,
          notes: werte.notes,
          valid_until: mitFrist ? werte.valid_until : '',
        })
      : api.dateien.speichern(pid, datei.id, {
          kind: werte.kind,
          title: werte.title,
          notes: werte.notes,
          valid_until: mitFrist ? (werte.valid_until || null) : null,
        }),
    onSuccess: () => { fertig(); schliessen() },
    onError: (f: any) => toast({ title: tt(T.nichtGespeichert), description: f.message, variant: 'destructive' }),
  })

  return (
    <Dialog open onOpenChange={(o) => { if (!o) schliessen() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{datei.neu ? tt(T.dateiAblegen) : datei.filename}</DialogTitle>
          <DialogDescription>
            {datei.neu
              ? datei.datei?.name
              : tt(T.dateiBleibt)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="datei-art">{tt(T.art)}</Label>
            <Select value={werte.kind} onValueChange={(w) => setWerte({ ...werte, kind: w })}>
              <SelectTrigger id="datei-art"><SelectValue /></SelectTrigger>
              <SelectContent>
                {arten.map((a) => (
                  <SelectItem key={a.art} value={a.art}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="datei-titel">{tt(T.bezeichnung)}</Label>
            <Input
              id="datei-titel"
              value={werte.title}
              onChange={(e) => setWerte({ ...werte, title: e.target.value })}
              placeholder={tt(T.bezeichnungPlatz)}
            />
          </div>
          {mitFrist && (
            <div>
              <Label htmlFor="datei-frist">{tt(T.gueltigBis)}</Label>
              <Input
                id="datei-frist"
                type="date"
                value={werte.valid_until}
                onChange={(e) => setWerte({ ...werte, valid_until: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {tt(T.fristHinweis)}
              </p>
            </div>
          )}
          <div>
            <Label htmlFor="datei-notizen">{tt(T.notizen)}</Label>
            <Textarea
              id="datei-notizen"
              value={werte.notes}
              onChange={(e) => setWerte({ ...werte, notes: e.target.value })}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={schliessen}>{tt(T.abbrechen)}</Button>
          <Button onClick={() => speichern.mutate()} disabled={speichern.isPending}>
            {datei.neu ? tt(T.hochladen) : tt(T.speichern)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
