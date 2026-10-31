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
import { Check, ExternalLink, Plus, MessageSquare, Clock } from 'lucide-react'
import { useT, useGebietsschema } from '@/lib/useT'
import { abnahmeAnsichtT as T } from '@/lib/texte/AbnahmeAnsicht'
import { parseISO } from 'date-fns'

/**
 * Die Seite, die ein Auftraggeber über den Link aus der Mail öffnet.
 *
 * Ohne Konto, ohne Navigation. Zwei Dinge sind hier zu tun: Anmerkungen
 * hinterlassen und entscheiden. Alles andere wäre Gelegenheit, etwas Falsches
 * zu treffen.
 *
 * Die Zeitstelle steht vor dem Text, nicht dahinter - "bei 2:14 ist der Ton zu
 * laut" ist brauchbar, "der Ton ist zu laut" nicht, und die Reihenfolge der
 * Felder entscheidet darüber, was jemand ausfüllt.
 */

const datum = (wert: string | null | undefined, gebietsschema: string) =>
  wert ? parseISO(String(wert).slice(0, 10)).toLocaleDateString(gebietsschema) : ''

const zeitpunkt = (wert: string | null | undefined, gebietsschema: string) => {
  if (!wert) return ''
  const d = new Date(wert)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(gebietsschema)
}

/** Nur Webadressen öffnen - ältere Einträge können anderes enthalten. */
function oeffneSichtungslink(link: string) {
  if (/^https?:\/\//i.test(String(link ?? '').trim())) window.open(link, '_blank', 'noopener')
}

export function Component() {
  const { token = '' } = useParams()
  const { toast } = useToast()
  const tt = useT()
  const gebietsschema = useGebietsschema()
  const [name, setName] = useState('')
  const [zeitstelle, setZeitstelle] = useState('')
  const [text, setText] = useState('')
  const [entscheidung, setEntscheidung] = useState('')
  const [zeigeEntscheidung, setZeigeEntscheidung] = useState(false)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['abnahme-oeffentlich', token],
    queryFn: () => api.abnahmen.oeffentlich(token),
    retry: false,
  })

  const anmerken = useMutation({
    mutationFn: () => api.abnahmen.anmerken(token, { zeitstelle, body: text, author: name }),
    onSuccess: () => {
      setZeitstelle('')
      setText('')
      refetch()
      toast({ title: tt(T.anmerkungGespeichert) })
    },
    onError: (f: any) => toast({ title: tt(T.nichtGespeichert), description: f.message, variant: 'destructive' }),
  })

  const entscheiden = useMutation({
    mutationFn: (abgenommen: boolean) =>
      api.abnahmen.entscheiden(token, { name, abgenommen, decision: entscheidung }),
    onSuccess: () => { refetch(); setZeigeEntscheidung(false) },
    onError: (f: any) => toast({ title: tt(T.nichtGespeichert), description: f.message, variant: 'destructive' }),
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <p className="text-sm text-muted-foreground">{tt(T.lade)}</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 text-center space-y-2">
            <p className="font-medium">{tt(T.linkUngueltig)}</p>
            <p className="text-sm text-muted-foreground">
              {tt(T.linkUngueltigText)}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const abgenommen = data.status === 'abgenommen'

  return (
    <div className="min-h-screen bg-background py-8 px-5">
      <div className="max-w-2xl mx-auto space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{data.projekt}</p>
          <h1 className="font-display text-2xl sm:text-3xl mt-1">{data.fassung}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {/* Nur vorhandene Angaben, mit Trenner dazwischen - vorher begann die
                Zeile ohne Länge mit " · " */}
            {[
              data.dauer && tt(T.laenge).replace('{n}', String(data.dauer)),
              data.format,
              data.frist && tt(T.rueckmeldungBis).replace('{datum}', datum(data.frist, gebietsschema)),
            ].filter(Boolean).join(' · ')}
          </p>
        </div>

        {data.nachricht && (
          <Card>
            <CardContent className="pt-6 text-[15px] leading-relaxed">
              {String(data.nachricht).split(/\n{2,}/).map((a: string, i: number) => (
                <p key={i} className="mb-2">{a}</p>
              ))}
            </CardContent>
          </Card>
        )}

        {data.watch_url && (
          <Button
            className="w-full"
            size="lg"
            onClick={() => oeffneSichtungslink(data.watch_url)}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            {tt(T.fassungAnsehen)}
          </Button>
        )}

        {abgenommen ? (
          <Card className="border-emerald-500/40">
            <CardContent className="py-6 text-center space-y-1">
              <Check className="w-8 h-8 mx-auto text-emerald-600 dark:text-emerald-400" />
              <p className="font-medium">{tt(T.abgenommen)}</p>
              <p className="text-sm text-muted-foreground">
                {data.entschieden_von ? `${data.entschieden_von}, ` : ''}
                {zeitpunkt(data.entschieden_am, gebietsschema)}
              </p>
              <p className="text-xs text-muted-foreground pt-2">
                {tt(T.seiteSchliessen)}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Anmerkung schreiben */}
            <Card>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MessageSquare className="w-4 h-4" />
                  {tt(T.anmerkung)}
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div>
                    <Label htmlFor="anm-zeit">{tt(T.stelle)}</Label>
                    <Input
                      id="anm-zeit"
                      value={zeitstelle}
                      onChange={(e) => setZeitstelle(e.target.value)}
                      placeholder="2:14"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Label htmlFor="anm-name">{tt(T.ihrName)}</Label>
                    <Input
                      id="anm-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="anm-text">{tt(T.wasFaelltAuf)}</Label>
                  <Textarea
                    id="anm-text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={3}
                    placeholder={tt(T.beispiel)}
                  />
                </div>
                <Button
                  onClick={() => anmerken.mutate()}
                  disabled={!text.trim() || anmerken.isPending}
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  {tt(T.hinzufuegen)}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {tt(T.stelleFreiwillig)}
                </p>
              </CardContent>
            </Card>

            {/* Bisherige Anmerkungen */}
            {data.anmerkungen.length > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                    {tt(T.bisher).replace('{n}', String(data.anmerkungen.length))}
                  </div>
                  <div className="space-y-1.5">
                    {data.anmerkungen.map((a: any) => (
                      <div key={a.id} className="flex gap-2 text-sm">
                        <span className="font-mono text-xs text-muted-foreground w-14 shrink-0 pt-0.5">
                          {a.zeitstelle || '-'}
                        </span>
                        <span className="flex-1">{a.body}</span>
                        {a.status === 'erledigt' && (
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        )}
                        {a.status === 'offen' && (
                          <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Entscheiden */}
            <Card>
              <CardContent className="pt-6 space-y-3">
                <p className="text-sm">
                  {tt(T.entscheidenText)}
                </p>
                {!name.trim() && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {tt(T.nameEintragen)}
                  </p>
                )}
                {zeigeEntscheidung && (
                  <div>
                    <Label htmlFor="ent-text">{tt(T.anmerkungEntscheidung)}</Label>
                    <Textarea
                      id="ent-text"
                      value={entscheidung}
                      onChange={(e) => setEntscheidung(e.target.value)}
                      rows={2}
                      placeholder={tt(T.freiwillig)}
                    />
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => entscheiden.mutate(true)}
                    disabled={!name.trim() || entscheiden.isPending}
                  >
                    <Check className="w-4 h-4 mr-1.5" />
                    {tt(T.abnehmen)}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!zeigeEntscheidung) { setZeigeEntscheidung(true); return }
                      entscheiden.mutate(false)
                    }}
                    disabled={!name.trim() || entscheiden.isPending}
                  >
                    {tt(T.nochEineRunde)}
                  </Button>
                </div>
                {data.status === 'nachbesserung' && (
                  <p className="text-xs text-muted-foreground">
                    {tt(T.nachbesserung)}
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <p className="text-xs text-muted-foreground text-center">
          {tt(T.fragen)}
        </p>
      </div>
    </div>
  )
}
