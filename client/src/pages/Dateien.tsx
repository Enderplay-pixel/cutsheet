import { useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useDownload } from '@/lib/useDownload'
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

const datum = (wert: string | null | undefined) =>
  wert ? new Date(String(wert).slice(0, 10)).toLocaleDateString('de-DE') : '—'

const FRIST: Record<string, { label: string; klasse: string }> = {
  gueltig:    { label: 'gültig',     klasse: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  laeuft_ab:  { label: 'läuft ab',   klasse: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  abgelaufen: { label: 'abgelaufen', klasse: 'bg-destructive/15 text-destructive' },
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const qc = useQueryClient()
  const { toast } = useToast()
  const download = useDownload()
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
      toast({ title: 'Gelöscht' })
    },
    onError: (f: any) => toast({ title: 'Nicht gelöscht', description: f.message, variant: 'destructive' }),
  })

  const dateien: any[] = data?.dateien ?? []
  const arten: any[] = data?.arten ?? []

  return (
    <div className="px-5 py-6 sm:p-6 max-w-5xl mx-auto space-y-4">
      <PageHeader
        title="Ablage"
        subtitle="Genehmigungen, Nachweise, Verträge und Belege"
      />

      <div className="flex items-start gap-2 text-xs p-3 rounded-lg bg-muted">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Die Dateien liegen in der Datenbank, nicht auf der Platte des Servers - dort überleben sie
          keinen Deploy. Bilder und PDF bis 20 MB.
        </span>
      </div>

      {/* Hochladen */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="datei-feld">Datei</Label>
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
              Hochladen
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant={art === '' ? 'default' : 'outline'} size="sm" onClick={() => setArt('')}>
          Alle
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
            {dateien.length} {dateien.length === 1 ? 'Datei' : 'Dateien'}
          </span>
        )}
      </div>

      {isLoading ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Lade…</CardContent></Card>
      ) : dateien.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            {art ? 'Nichts in dieser Art.' : 'Noch nichts abgelegt.'}
            <span className="block text-xs mt-1">
              Drehgenehmigungen und Versicherungsnachweise bekommen ein Ablaufdatum und melden
              sich dreißig Tage vorher.
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
                    <th className="text-left py-2.5 px-4">Datei</th>
                    <th className="text-left py-2.5 px-4">Art</th>
                    <th className="text-right py-2.5 px-4">Größe</th>
                    <th className="text-left py-2.5 px-4">Gültig bis</th>
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
                            gehört zu {f.entity_type} #{f.entity_id}
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
                            {datum(f.valid_until)}
                            <span className={`text-xs px-2 py-0.5 rounded-full ml-1.5 ${FRIST[f.frist]?.klasse ?? ''}`}>
                              {FRIST[f.frist]?.label ?? ''}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(api.dateien.inhaltUrl(pid, f.id), '_blank', 'noopener')}
                          aria-label={`${f.filename} ansehen`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => download(`${api.dateien.inhaltUrl(pid, f.id)}?download=1`, f.filename)}
                          aria-label={`${f.filename} herunterladen`}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setBearbeite(f)}>Ändern</Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => loeschen.mutate(f.id)}
                          aria-label={`${f.filename} löschen`}
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
            toast({ title: 'Gespeichert' })
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
    onError: (f: any) => toast({ title: 'Nicht gespeichert', description: f.message, variant: 'destructive' }),
  })

  return (
    <Dialog open onOpenChange={(o) => { if (!o) schliessen() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{datei.neu ? 'Datei ablegen' : datei.filename}</DialogTitle>
          <DialogDescription>
            {datei.neu
              ? datei.datei?.name
              : 'Die Datei selbst bleibt, wie sie ist - nur die Angaben ändern sich.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="datei-art">Art</Label>
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
            <Label htmlFor="datei-titel">Bezeichnung</Label>
            <Input
              id="datei-titel"
              value={werte.title}
              onChange={(e) => setWerte({ ...werte, title: e.target.value })}
              placeholder="freiwillig - sonst steht der Dateiname da"
            />
          </div>
          {mitFrist && (
            <div>
              <Label htmlFor="datei-frist">Gültig bis</Label>
              <Input
                id="datei-frist"
                type="date"
                value={werte.valid_until}
                onChange={(e) => setWerte({ ...werte, valid_until: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Meldet sich dreißig Tage vorher. Eine Genehmigung zu verlängern dauert.
              </p>
            </div>
          )}
          <div>
            <Label htmlFor="datei-notizen">Notizen</Label>
            <Textarea
              id="datei-notizen"
              value={werte.notes}
              onChange={(e) => setWerte({ ...werte, notes: e.target.value })}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={schliessen}>Abbrechen</Button>
          <Button onClick={() => speichern.mutate()} disabled={speichern.isPending}>
            {datei.neu ? 'Hochladen' : 'Speichern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
