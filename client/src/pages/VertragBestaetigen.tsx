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

/**
 * Die Seite, die eine Darstellerin oder eine erziehungsberechtigte Person über
 * den Link aus der Mail öffnet.
 *
 * Ohne Anmeldung, ohne Navigation, ohne alles andere. Wer hier landet, hat
 * genau eine Aufgabe: den Text lesen und zustimmen oder nicht. Jede weitere
 * Schaltfläche wäre eine Gelegenheit, etwas Falsches zu treffen.
 */

const zeitpunkt = (wert: string | null | undefined) => {
  if (!wert) return ''
  const d = new Date(wert)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('de-DE')
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
          const punkte = a.split('\n')
          const nummeriert = /^\d+\.\s/.test(a)
          const Liste = nummeriert ? 'ol' : 'ul'
          return (
            <Liste key={i} className={`pl-5 space-y-1 ${nummeriert ? 'list-decimal' : 'list-disc'}`}>
              {punkte.map((p, j) => <li key={j}>{fett(p.replace(/^(\d+\.|-)\s*/, ''))}</li>)}
            </Liste>
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
    onError: (f: any) => toast({ title: 'Nicht gespeichert', description: f.message, variant: 'destructive' }),
  })

  const ablehnen = useMutation({
    mutationFn: () => api.vertraege.ablehnen(token, grund),
    onSuccess: () => { setErledigt('abgelehnt'); refetch() },
    onError: (f: any) => toast({ title: 'Nicht gespeichert', description: f.message, variant: 'destructive' }),
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <p className="text-sm text-muted-foreground">Lade…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 text-center space-y-2">
            <p className="font-medium">Dieser Link gilt nicht mehr</p>
            <p className="text-sm text-muted-foreground">
              Möglicherweise wurde der Vertrag zurückgezogen. Melden Sie sich bei der Produktion,
              dann bekommen Sie einen neuen Link.
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
          Als PDF öffnen
        </Button>

        {schonBestaetigt ? (
          <Card className="border-emerald-500/40">
            <CardContent className="py-6 text-center space-y-1">
              <Check className="w-8 h-8 mx-auto text-emerald-600 dark:text-emerald-400" />
              <p className="font-medium">Zustimmung ist eingegangen</p>
              <p className="text-sm text-muted-foreground">
                {data.bestaetigt_von ? `${data.bestaetigt_von}, ` : ''}
                {zeitpunkt(data.bestaetigt_am)}
              </p>
              <p className="text-xs text-muted-foreground pt-2">
                Sie können diese Seite schließen. Eine Kopie liegt bei der Produktion.
              </p>
            </CardContent>
          </Card>
        ) : schonAbgelehnt ? (
          <Card>
            <CardContent className="py-6 text-center space-y-1">
              <X className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="font-medium">Sie haben nicht zugestimmt</p>
              <p className="text-sm text-muted-foreground">
                Die Produktion ist benachrichtigt und meldet sich bei Ihnen.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6 space-y-3">
              <p className="text-sm">
                Mit Ihrem Namen erklären Sie Ihre Zustimmung zu dem oben stehenden Text.
                Zeitpunkt und Name werden festgehalten.
              </p>
              <div>
                <Label htmlFor="zustimmung-name">Ihr Name</Label>
                <Input
                  id="zustimmung-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Vor- und Nachname"
                  autoComplete="name"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => bestaetigen.mutate()}
                  disabled={!name.trim() || bestaetigen.isPending}
                >
                  <Check className="w-4 h-4 mr-1.5" />
                  Zustimmen
                </Button>
                <Button variant="ghost" onClick={() => setZeigeAblehnen((v) => !v)}>
                  Ich stimme nicht zu
                </Button>
              </div>

              {zeigeAblehnen && (
                <div className="border-t border-border/60 pt-3 space-y-2">
                  <Label htmlFor="ablehnung-grund">Grund (freiwillig)</Label>
                  <Textarea
                    id="ablehnung-grund"
                    value={grund}
                    onChange={(e) => setGrund(e.target.value)}
                    rows={3}
                    placeholder="Was spricht dagegen?"
                  />
                  <Button
                    variant="destructive"
                    onClick={() => ablehnen.mutate()}
                    disabled={ablehnen.isPending}
                  >
                    Nicht zustimmen
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
          <FileText className="w-3 h-3" />
          Bei Fragen antworten Sie einfach auf die Mail, mit der Sie diesen Link bekommen haben.
        </p>
      </div>
    </div>
  )
}
