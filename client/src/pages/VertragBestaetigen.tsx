import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { FileText, Check, X, Download } from 'lucide-react'
import { useT, useGebietsschema } from '@/lib/useT'
import { vertragBestaetigenT } from '@/lib/texte/VertragBestaetigen'

/**
 * Die Seite, die eine Darstellerin oder eine erziehungsberechtigte Person über
 * den Link aus der Mail öffnet.
 *
 * Ohne Anmeldung, ohne Navigation, ohne alles andere. Wer hier landet, hat
 * genau eine Aufgabe: den Text lesen und zustimmen oder nicht. Jede weitere
 * Schaltfläche wäre eine Gelegenheit, etwas Falsches zu treffen.
 */

const zeitpunkt = (wert: string | null | undefined, gebietsschema: string) => {
  if (!wert) return ''
  const d = new Date(wert)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(gebietsschema)
}

/**
 * Der Vertragstext in der einfachen Auszeichnung, in der er gespeichert ist.
 *
 * Kein Markdown-Paket dafür: Der Text kennt Überschriften, Absätze, Listen und
 * Fettes, und mehr darf er auch nicht können. Was nicht erkannt wird, bleibt
 * schlicht stehen - ein Vertrag, der Zeichen verschluckt, wäre schlimmer als
 * einer ohne Formatierung.
 */
function Vertragstext({ text }: { text: string }) {
  const absaetze = String(text).split(/\n{2,}/)
  const fett = (t: string) => {
    const teile = t.split(/\*\*(.+?)\*\*/g)
    return teile.map((s, i) => (i % 2 === 1 ? <strong key={i}>{s}</strong> : s))
  }

  return (
    <div className="space-y-3 text-[15px] leading-relaxed">
      {absaetze.map((roh, i) => {
        const a = roh.trim()
        if (!a) return null
        if (a.startsWith('## ') || a.startsWith('# ')) {
          // Die Überschrift ist die erste Zeile, nicht der ganze Block: In den
          // Vorlagen folgt der Absatz direkt darunter, ohne Leerzeile.
          const umbruch = a.indexOf('\n')
          const kopf = (umbruch === -1 ? a : a.slice(0, umbruch)).trim()
          const rest = umbruch === -1 ? '' : a.slice(umbruch + 1).trim()
          const klein = kopf.startsWith('## ')
          return (
            <div key={i}>
              {klein
                ? <h2 className="text-base font-semibold mt-5 mb-1">{kopf.slice(3)}</h2>
                : <h1 className="font-display text-xl sm:text-2xl mt-2 mb-1">{kopf.slice(2)}</h1>}
              {rest && (
                <p>
                  {rest.split('\n').map((zeile, j) => (
                    <span key={j}>{fett(zeile)}{j < rest.split('\n').length - 1 && <br />}</span>
                  ))}
                </p>
              )}
            </div>
          )
        }
        if (a.startsWith('- ') || /^\d+\.\s/.test(a)) {
          // Wie das PDF (server/src/routes/vertraege.ts): Folgezeilen gehören
          // zum Punkt davor, und ein Punkt in eigenem Absatz zählt weiter.
          const punkte: string[] = []
          for (const zeile of a.split('\n')) {
            const t = zeile.trim()
            if (!t) continue
            if (/^(\d+\.|-)\s/.test(t) || punkte.length === 0) punkte.push(t.replace(/^(\d+\.|-)\s*/, ''))
            else punkte[punkte.length - 1] += ' ' + t
          }
          const nummeriert = /^\d+\.\s/.test(a)
          const start = nummeriert ? parseInt(a, 10) : 1
          if (nummeriert) {
            return (
              <ol key={i} start={start > 1 ? start : undefined} className="pl-5 space-y-1 list-decimal">
                {punkte.map((p, j) => <li key={j}>{fett(p)}</li>)}
              </ol>
            )
          }
          return (
            <ul key={i} className="pl-5 space-y-1 list-disc">
              {punkte.map((p, j) => <li key={j}>{fett(p)}</li>)}
            </ul>
          )
        }
        return (
          <p key={i}>
            {a.split('\n').map((zeile, j) => (
              <span key={j}>{fett(zeile)}{j < a.split('\n').length - 1 && <br />}</span>
            ))}
          </p>
        )
      })}
    </div>
  )
}

export function Component() {
  const { token = '' } = useParams()
  const { toast } = useToast()
  const tt = useT()
  const gebietsschema = useGebietsschema()
  const [name, setName] = useState('')
  const [grund, setGrund] = useState('')
  const [zeigeAblehnen, setZeigeAblehnen] = useState(false)
  const [erledigt, setErledigt] = useState<'bestaetigt' | 'abgelehnt' | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['vertrag-oeffentlich', token],
    queryFn: () => api.vertraege.oeffentlich(token),
    retry: false,
  })

  const bestaetigen = useMutation({
    mutationFn: () => api.vertraege.bestaetigen(token, name),
    onSuccess: () => { setErledigt('bestaetigt'); refetch() },
    onError: (f: any) => toast({ title: tt(vertragBestaetigenT.nichtGespeichert), description: f.message, variant: 'destructive' }),
  })

  const ablehnen = useMutation({
    mutationFn: () => api.vertraege.ablehnen(token, grund),
    onSuccess: () => { setErledigt('abgelehnt'); refetch() },
    onError: (f: any) => toast({ title: tt(vertragBestaetigenT.nichtGespeichert), description: f.message, variant: 'destructive' }),
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <p className="text-sm text-muted-foreground">{tt(vertragBestaetigenT.lade)}</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 text-center space-y-2">
            <p className="font-medium">{tt(vertragBestaetigenT.linkUngueltig)}</p>
            <p className="text-sm text-muted-foreground">
              {tt(vertragBestaetigenT.linkUngueltigText)}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const schonBestaetigt = data.status === 'bestaetigt' || erledigt === 'bestaetigt'
  const schonAbgelehnt = data.status === 'abgelehnt' || erledigt === 'abgelehnt'

  return (
    <div className="min-h-screen bg-background py-8 px-5">
      <div className="max-w-2xl mx-auto space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{data.projekt}</p>
          <h1 className="font-display text-2xl sm:text-3xl mt-1">{data.titel}</h1>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Vertragstext text={data.text} />
          </CardContent>
        </Card>

        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(api.vertraege.oeffentlichPdfUrl(token), '_blank', 'noopener')}
        >
          <Download className="w-4 h-4 mr-1.5" />
          {tt(vertragBestaetigenT.alsPdf)}
        </Button>

        {schonBestaetigt ? (
          <Card className="border-emerald-500/40">
            <CardContent className="py-6 text-center space-y-1">
              <Check className="w-8 h-8 mx-auto text-emerald-600 dark:text-emerald-400" />
              <p className="font-medium">{tt(vertragBestaetigenT.zustimmungDa)}</p>
              <p className="text-sm text-muted-foreground">
                {data.bestaetigt_von ? `${data.bestaetigt_von}, ` : ''}
                {zeitpunkt(data.bestaetigt_am, gebietsschema)}
              </p>
              <p className="text-xs text-muted-foreground pt-2">
                {tt(vertragBestaetigenT.seiteSchliessen)}
              </p>
            </CardContent>
          </Card>
        ) : schonAbgelehnt ? (
          <Card>
            <CardContent className="py-6 text-center space-y-1">
              <X className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="font-medium">{tt(vertragBestaetigenT.nichtZugestimmt)}</p>
              <p className="text-sm text-muted-foreground">
                {tt(vertragBestaetigenT.benachrichtigt)}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6 space-y-3">
              <p className="text-sm">
                {tt(vertragBestaetigenT.erklaerung)}
              </p>
              <div>
                <Label htmlFor="zustimmung-name">{tt(vertragBestaetigenT.ihrName)}</Label>
                <Input
                  id="zustimmung-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={tt(vertragBestaetigenT.vorNachname)}
                  autoComplete="name"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => bestaetigen.mutate()}
                  disabled={!name.trim() || bestaetigen.isPending}
                >
                  <Check className="w-4 h-4 mr-1.5" />
                  {tt(vertragBestaetigenT.zustimmen)}
                </Button>
                <Button variant="ghost" onClick={() => setZeigeAblehnen((v) => !v)}>
                  {tt(vertragBestaetigenT.ichStimmeNichtZu)}
                </Button>
              </div>

              {zeigeAblehnen && (
                <div className="border-t border-border/60 pt-3 space-y-2">
                  <Label htmlFor="ablehnung-grund">{tt(vertragBestaetigenT.grund)}</Label>
                  <Textarea
                    id="ablehnung-grund"
                    value={grund}
                    onChange={(e) => setGrund(e.target.value)}
                    rows={3}
                    placeholder={tt(vertragBestaetigenT.wasSprichtDagegen)}
                  />
                  <Button
                    variant="destructive"
                    onClick={() => ablehnen.mutate()}
                    disabled={ablehnen.isPending}
                  >
                    {tt(vertragBestaetigenT.nichtZustimmen)}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
          <FileText className="w-3 h-3" />
          {tt(vertragBestaetigenT.fragen)}
        </p>
      </div>
    </div>
  )
}
