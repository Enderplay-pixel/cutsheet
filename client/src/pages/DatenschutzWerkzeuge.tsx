import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { ShieldCheck, FileSearch, UserX, Users, Download, AlertTriangle } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

const ARTEN = [
  { wert: 'crew', label: 'Stab' },
  { wert: 'cast', label: 'Besetzung' },
  { wert: 'extra', label: 'Komparserie' },
]

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)

  return (
    <div className="px-5 py-6 sm:p-6 max-w-5xl mx-auto space-y-4">
      <PageHeader
        title="Datenschutz"
        subtitle="Auskunft geben, Daten entfernen, Zugriffe sehen"
      />

      <Tabs defaultValue="auskunft">
        <TabsList>
          <TabsTrigger value="auskunft"><FileSearch className="w-3.5 h-3.5 mr-1.5" />Auskunft</TabsTrigger>
          <TabsTrigger value="loeschen"><UserX className="w-3.5 h-3.5 mr-1.5" />Daten entfernen</TabsTrigger>
          <TabsTrigger value="zugriff"><Users className="w-3.5 h-3.5 mr-1.5" />Wer sieht was</TabsTrigger>
        </TabsList>

        <TabsContent value="auskunft" className="mt-4"><Auskunft pid={pid} /></TabsContent>
        <TabsContent value="loeschen" className="mt-4"><Entfernen pid={pid} /></TabsContent>
        <TabsContent value="zugriff" className="mt-4"><Zugriff pid={pid} /></TabsContent>
      </Tabs>
    </div>
  )
}

/** Personen des Projekts, nach Art gruppiert - Grundlage beider Werkzeuge. */
function usePersonen(pid: number) {
  const { data: crew } = useQuery({ queryKey: ['crew', pid], queryFn: () => api.crew.list(pid) })
  const { data: cast } = useQuery({ queryKey: ['cast', pid], queryFn: () => api.cast.list(pid) })
  const { data: extras } = useQuery({ queryKey: ['extras', pid], queryFn: () => api.extras.list(pid) })
  return {
    crew: (crew || []).map((p: any) => ({ id: p.id, name: p.name, zusatz: p.role })),
    cast: (cast || []).map((p: any) => ({ id: p.id, name: p.actor_name, zusatz: p.character_name || '' })),
    extra: (extras || []).map((p: any) => ({ id: p.id, name: p.name, zusatz: p.tariff_group || '' })),
  }
}

function Auskunft({ pid }: { pid: number }) {
  const { toast } = useToast()
  const personen = usePersonen(pid)
  const [art, setArt] = useState('crew')
  const [person, setPerson] = useState('')
  const [ergebnis, setErgebnis] = useState<any | null>(null)

  const abrufen = useMutation({
    mutationFn: () => api.datenschutz.auskunft(pid, art, Number(person)),
    onSuccess: (daten: any) => setErgebnis(daten),
    onError: (fehler: any) => toast({ title: 'Keine Auskunft', description: fehler.message, variant: 'destructive' }),
  })

  const liste = (personen as any)[art] || []

  const herunterladen = () => {
    if (!ergebnis) return
    const text = JSON.stringify(ergebnis, null, 2)
    const datei = new Blob([text], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(datei)
    const a = document.createElement('a')
    a.href = url
    a.download = `auskunft-${ergebnis.person?.name || ergebnis.person?.actor_name || 'person'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">Auskunft nach Artikel 15 DSGVO</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Wer wissen will, was über sie oder ihn gespeichert ist, hat ein Recht darauf.
            Hier steht alles aus diesem Projekt an einer Stelle - zum Weitergeben.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Bereich</Label>
              <Select value={art} onValueChange={v => { setArt(v); setPerson(''); setErgebnis(null) }}>
                <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ARTEN.map(a => <SelectItem key={a.wert} value={a.wert}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Person</Label>
              <Select value={person} onValueChange={setPerson}>
                <SelectTrigger className="h-8 text-sm mt-1"><SelectValue placeholder="Wählen" /></SelectTrigger>
                <SelectContent>
                  {liste.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}{p.zusatz ? ` · ${p.zusatz}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button size="sm" disabled={!person || abrufen.isPending} onClick={() => abrufen.mutate()}>
            <FileSearch className="w-4 h-4 mr-1.5" />Auskunft erstellen
          </Button>
        </CardContent>
      </Card>

      {ergebnis && (
        <Card>
          <CardHeader className="pb-2 pt-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">
              {ergebnis.person?.name || ergebnis.person?.actor_name}
              <span className="text-xs text-muted-foreground font-normal ml-2">
                Stand {new Date(ergebnis.erstellt_am).toLocaleDateString('de-DE')}
              </span>
            </CardTitle>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={herunterladen}>
              <Download className="w-3.5 h-3.5 mr-1" />Als Datei
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {(ergebnis.posten || []).map((posten: any) => (
              <div key={posten.bereich}>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{posten.bereich}</p>
                  <Badge variant="secondary" className="text-xs font-normal">{posten.eintraege.length}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{posten.erklaerung}</p>
                {posten.eintraege.length > 0 && (
                  <pre className="mt-2 text-xs bg-muted/40 rounded-lg p-3 overflow-x-auto max-h-48">
                    {JSON.stringify(posten.eintraege, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Entfernen({ pid }: { pid: number }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const personen = usePersonen(pid)
  const [art, setArt] = useState('crew')
  const [person, setPerson] = useState('')
  const [grund, setGrund] = useState('')
  const [offen, setOffen] = useState(false)

  const entfernen = useMutation({
    mutationFn: () => api.datenschutz.anonymisieren(pid, art, Number(person), grund),
    onSuccess: (daten: any) => {
      qc.invalidateQueries({ queryKey: ['crew', pid] })
      qc.invalidateQueries({ queryKey: ['cast', pid] })
      qc.invalidateQueries({ queryKey: ['extras', pid] })
      setOffen(false)
      setPerson('')
      setGrund('')
      toast({ title: `Jetzt „${daten.ersatzname}"`, description: daten.hinweis })
    },
    onError: (fehler: any) => toast({ title: 'Nicht entfernt', description: fehler.message, variant: 'destructive' }),
  })

  const liste = (personen as any)[art] || []
  const gewaehlt = liste.find((p: any) => String(p.id) === person)

  return (
    <Card>
      <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">Daten entfernen nach Artikel 17 DSGVO</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Gelöscht wird der Bezug zur Person: Name, Kontakt, Freitexte. Was bleibt, sind
            Dispositionen und Arbeitszeiten als Produktionsunterlage - ohne Namen. Das ist
            gewollt: Eine Dispo von vorletztem Jahr muss nachvollziehbar bleiben, und
            Arbeitszeiten sind nach Paragraf 16 ArbZG zwei Jahre aufzubewahren.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Bereich</Label>
            <Select value={art} onValueChange={v => { setArt(v); setPerson('') }}>
              <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ARTEN.map(a => <SelectItem key={a.wert} value={a.wert}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Person</Label>
            <Select value={person} onValueChange={setPerson}>
              <SelectTrigger className="h-8 text-sm mt-1"><SelectValue placeholder="Wählen" /></SelectTrigger>
              <SelectContent>
                {liste.map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}{p.zusatz ? ` · ${p.zusatz}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-xs" htmlFor="d-grund">Grund (kommt ins Protokoll)</Label>
          <Input id="d-grund" value={grund} onChange={e => setGrund(e.target.value)}
            className="mt-1 h-8 text-sm" placeholder="Löschungsersuchen vom …" />
        </div>

        <Button size="sm" variant="destructive" disabled={!person} onClick={() => setOffen(true)}>
          <UserX className="w-4 h-4 mr-1.5" />Personenbezug entfernen
        </Button>

        <Dialog open={offen} onOpenChange={setOffen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{gewaehlt?.name} entfernen?</DialogTitle>
              <DialogDescription>
                Name, E-Mail, Telefon und Notizen werden geleert und durch die Funktion
                ersetzt. Das lässt sich nicht rückgängig machen. Dispositionen und
                Arbeitszeiten bleiben ohne Namen bestehen.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOffen(false)}>Abbrechen</Button>
              <Button variant="destructive" disabled={entfernen.isPending} onClick={() => entfernen.mutate()}>
                {entfernen.isPending ? 'Wird entfernt …' : 'Endgültig entfernen'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

function Zugriff({ pid }: { pid: number }) {
  const { data } = useQuery({ queryKey: ['datenschutz-zugriff', pid], queryFn: () => api.datenschutz.zugriff(pid) })

  const ROLLE: Record<string, string> = {
    admin: 'Alles, auch Löschen',
    producer: 'Alles ausser Projekt löschen',
    director: 'Planung und Inhalte',
    dept_head: 'Eigenes Gewerk',
    read_only: 'Nur lesen',
  }

  return (
    <Card>
      <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">Wer kann die Personendaten sehen</CardTitle></CardHeader>
      <CardContent className="space-y-1">
        {(data?.mitglieder || []).map((m: any, i: number) => (
          <div key={i} className="flex items-center gap-3 py-1.5 border-b border-border/60 last:border-0">
            <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm truncate">{m.name || m.email}</p>
              <p className="text-xs text-muted-foreground truncate">{m.email}</p>
            </div>
            <Badge variant="secondary" className="text-xs font-normal">{ROLLE[m.role] || m.role}</Badge>
          </div>
        ))}
        {data && data.gastzugaenge > 0 && (
          <p className="text-xs text-muted-foreground pt-2">
            Dazu {data.gastzugaenge} Gastzugänge über Links. Sie zeigen nur, was für sie
            freigegeben ist - keine Gagen, keine Telefonnummern.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
