import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Trash2, Check, Send } from 'lucide-react'

/**
 * Die Seite, die eine Agentur über den Link aus der Mail öffnet.
 *
 * Ohne Konto, ohne Navigation. Eine Agentur, die auf eine Anfrage antworten
 * soll, legt sich kein Benutzerkonto an - sie würde stattdessen zurückmailen,
 * und dann steht die Antwort in einem Postfach statt im Projekt.
 */

const euro = (cents: number) =>
  (Number(cents || 0) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })

const datum = (wert: string | null | undefined) =>
  wert ? new Date(String(wert).slice(0, 10)).toLocaleDateString('de-DE') : ''

/** Betrag aus einem Textfeld in Cent - ganzzahlig. */
function alsCents(text: string): number {
  const sauber = String(text).replace(/\s|\./g, '').replace(',', '.')
  const teile = sauber.split('.')
  const ganz = Math.abs(Math.trunc(Number(teile[0] || 0)))
  const rest = teile[1] ? Math.round(Number((teile[1] + '00').slice(0, 2))) : 0
  return ganz * 100 + rest
}

type Vorschlag = {
  role_id: number | null
  actor_name: string
  available: boolean | null
  gage: string
  showreel_url: string
  note: string
}

const LEER = (rolleId: number | null): Vorschlag => ({
  role_id: rolleId, actor_name: '', available: true, gage: '', showreel_url: '', note: '',
})

export function Component() {
  const { token = '' } = useParams()
  const { toast } = useToast()
  const [zeilen, setZeilen] = useState<Vorschlag[]>([])
  const [gesendet, setGesendet] = useState(false)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['casting-oeffentlich', token],
    queryFn: () => api.casting.oeffentlich(token),
    retry: false,
  })

  // Beim ersten Laden eine leere Zeile je Rolle vorbereiten - sonst steht die
  // Agentur vor einem leeren Formular und muss erst herausfinden, wo sie
  // anfängt.
  useEffect(() => {
    if (!data || zeilen.length > 0) return
    const vorhanden: Vorschlag[] = (data.vorschlaege ?? []).map((v: any) => ({
      role_id: v.role_id ?? null,
      actor_name: v.actor_name || '',
      available: v.available,
      gage: v.fee_per_day_cents ? (v.fee_per_day_cents / 100).toFixed(2).replace('.', ',') : '',
      showreel_url: v.showreel_url || '',
      note: v.note || '',
    }))
    setZeilen(vorhanden.length > 0
      ? vorhanden
      : (data.rollen ?? []).map((r: any) => LEER(r.id)))
  }, [data])

  const senden = useMutation({
    mutationFn: () => api.casting.antworten(
      token,
      zeilen
        .filter((z) => z.actor_name.trim())
        .map((z) => ({
          role_id: z.role_id,
          actor_name: z.actor_name.trim(),
          available: z.available,
          fee_per_day_cents: alsCents(z.gage),
          showreel_url: z.showreel_url.trim(),
          note: z.note.trim(),
        }))
    ),
    onSuccess: () => { setGesendet(true); refetch() },
    onError: (f: any) => toast({ title: 'Nicht gesendet', description: f.message, variant: 'destructive' }),
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
              Möglicherweise ist die Anfrage zurückgezogen worden. Eine kurze Mail an die
              Produktion genügt, dann bekommen Sie einen neuen Link.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const rollen: any[] = data.rollen ?? []
  const fertig = gesendet || data.status === 'beantwortet'
  const brauchbar = zeilen.some((z) => z.actor_name.trim())

  const aendere = (i: number, feld: keyof Vorschlag, wert: any) =>
    setZeilen(zeilen.map((z, j) => (j === i ? { ...z, [feld]: wert } : z)))

  return (
    <div className="min-h-screen bg-background py-8 px-5">
      <div className="max-w-3xl mx-auto space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{data.projekt}</p>
          <h1 className="font-display text-2xl sm:text-3xl mt-1">
            {data.betreff || 'Besetzungsanfrage'}
          </h1>
          {data.frist && (
            <p className="text-sm text-muted-foreground mt-1">
              Rückmeldung erbeten bis {datum(data.frist)}
            </p>
          )}
        </div>

        {data.text && (
          <Card>
            <CardContent className="pt-6 text-[15px] leading-relaxed">
              {String(data.text).split(/\n{2,}/).map((a, i) => <p key={i} className="mb-2">{a}</p>)}
            </CardContent>
          </Card>
        )}

        {/* Die gesuchten Rollen */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Gesucht</div>
            <div className="space-y-3">
              {rollen.map((r) => (
                <div key={r.id} className="border-b border-border/40 last:border-0 pb-3 last:pb-0">
                  <div className="font-medium">{r.role_name || r.figur || 'Rolle'}</div>
                  {r.description && (
                    <div className="text-sm text-muted-foreground mt-0.5">{r.description}</div>
                  )}
                  <div className="text-sm text-muted-foreground mt-1">
                    {r.shoot_from && (
                      <>
                        {datum(r.shoot_from)}
                        {r.shoot_to && r.shoot_to !== r.shoot_from && ` bis ${datum(r.shoot_to)}`}
                        {' · '}
                      </>
                    )}
                    {r.shoot_days > 0 && `${r.shoot_days} ${r.shoot_days === 1 ? 'Drehtag' : 'Drehtage'} · `}
                    {r.fee_per_day_cents > 0 ? `${euro(r.fee_per_day_cents)} pro Tag` : 'Gage nach Absprache'}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {fertig ? (
          <Card className="border-emerald-500/40">
            <CardContent className="py-6 text-center space-y-1">
              <Check className="w-8 h-8 mx-auto text-emerald-600 dark:text-emerald-400" />
              <p className="font-medium">Ihre Vorschläge sind angekommen</p>
              <p className="text-sm text-muted-foreground">
                Die Produktion meldet sich bei Ihnen. Über diesen Link können Sie Ihre Antwort
                jederzeit überarbeiten.
              </p>
              {gesendet && (
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setGesendet(false)}>
                  Antwort ändern
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Ihre Vorschläge</div>

              {zeilen.map((z, i) => (
                <div key={i} className="border border-border/60 rounded-lg p-3 space-y-2">
                  <div className="grid gap-2 sm:grid-cols-12">
                    <div className="sm:col-span-5">
                      <Label htmlFor={`v-name-${i}`}>Name</Label>
                      <Input
                        id={`v-name-${i}`}
                        value={z.actor_name}
                        onChange={(e) => aendere(i, 'actor_name', e.target.value)}
                        placeholder="Vor- und Nachname"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <Label htmlFor={`v-rolle-${i}`}>Für welche Rolle</Label>
                      <Select
                        value={z.role_id ? String(z.role_id) : ''}
                        onValueChange={(w) => aendere(i, 'role_id', Number(w))}
                      >
                        <SelectTrigger id={`v-rolle-${i}`}><SelectValue placeholder="wählen" /></SelectTrigger>
                        <SelectContent>
                          {rollen.map((r) => (
                            <SelectItem key={r.id} value={String(r.id)}>
                              {r.role_name || r.figur || `Rolle ${r.id}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-3">
                      <Label htmlFor={`v-gage-${i}`}>Gage / Tag</Label>
                      <Input
                        id={`v-gage-${i}`}
                        value={z.gage}
                        onChange={(e) => aendere(i, 'gage', e.target.value)}
                        placeholder="freiwillig"
                        inputMode="decimal"
                      />
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-12">
                    <div className="sm:col-span-5">
                      <Label htmlFor={`v-frei-${i}`}>Im Zeitraum verfügbar</Label>
                      <Select
                        value={z.available === null ? 'unklar' : z.available ? 'ja' : 'nein'}
                        onValueChange={(w) =>
                          aendere(i, 'available', w === 'unklar' ? null : w === 'ja')
                        }
                      >
                        <SelectTrigger id={`v-frei-${i}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ja">Ja</SelectItem>
                          <SelectItem value="nein">Nein</SelectItem>
                          <SelectItem value="unklar">Noch offen</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-7">
                      <Label htmlFor={`v-material-${i}`}>Link zu Material</Label>
                      <Input
                        id={`v-material-${i}`}
                        value={z.showreel_url}
                        onChange={(e) => aendere(i, 'showreel_url', e.target.value)}
                        placeholder="Showreel, Vita, Fotos - freiwillig"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor={`v-notiz-${i}`}>Anmerkung</Label>
                    <Textarea
                      id={`v-notiz-${i}`}
                      value={z.note}
                      onChange={(e) => aendere(i, 'note', e.target.value)}
                      rows={2}
                      placeholder="freiwillig"
                    />
                  </div>

                  {zeilen.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setZeilen(zeilen.filter((_, j) => j !== i))}
                      aria-label="Vorschlag entfernen"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Entfernen
                    </Button>
                  )}
                </div>
              ))}

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => setZeilen([...zeilen, LEER(rollen[0]?.id ?? null)])}
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Weiterer Vorschlag
                </Button>
                <Button onClick={() => senden.mutate()} disabled={!brauchbar || senden.isPending}>
                  <Send className="w-4 h-4 mr-1.5" />
                  Absenden
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Zeilen ohne Namen werden nicht übernommen. Sie können die Antwort über denselben
                Link später ändern.
              </p>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Bei Fragen antworten Sie einfach auf die Mail, mit der Sie diesen Link bekommen haben.
        </p>
      </div>
    </div>
  )
}
