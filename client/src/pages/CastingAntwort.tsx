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
import { useT, useGebietsschema } from '@/lib/useT'
import { castingAntwortT } from '@/lib/texte/CastingAntwort'

/**
 * Die Seite, die eine Agentur über den Link aus der Mail öffnet.
 *
 * Ohne Konto, ohne Navigation. Eine Agentur, die auf eine Anfrage antworten
 * soll, legt sich kein Benutzerkonto an - sie würde stattdessen zurückmailen,
 * und dann steht die Antwort in einem Postfach statt im Projekt.
 */

const euro = (cents: number, gebietsschema: string) =>
  (Number(cents || 0) / 100).toLocaleString(gebietsschema, { style: 'currency', currency: 'EUR' })

const datum = (wert: string | null | undefined, gebietsschema: string) =>
  wert ? new Date(String(wert).slice(0, 10)).toLocaleDateString(gebietsschema) : ''

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
  const tt = useT()
  const gebietsschema = useGebietsschema()
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
    onError: (f: any) => toast({ title: tt(castingAntwortT.nichtGesendet), description: f.message, variant: 'destructive' }),
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <p className="text-sm text-muted-foreground">{tt(castingAntwortT.lade)}</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 text-center space-y-2">
            <p className="font-medium">{tt(castingAntwortT.linkUngueltig)}</p>
            <p className="text-sm text-muted-foreground">
              {tt(castingAntwortT.linkUngueltigText)}
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
            {data.betreff || tt(castingAntwortT.besetzungsanfrage)}
          </h1>
          {data.frist && (
            <p className="text-sm text-muted-foreground mt-1">
              {tt(castingAntwortT.rueckmeldungBis).replace('{datum}', datum(data.frist, gebietsschema))}
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
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">{tt(castingAntwortT.gesucht)}</div>
            <div className="space-y-3">
              {rollen.map((r) => (
                <div key={r.id} className="border-b border-border/40 last:border-0 pb-3 last:pb-0">
                  <div className="font-medium">{r.role_name || r.figur || tt(castingAntwortT.rolle)}</div>
                  {r.description && (
                    <div className="text-sm text-muted-foreground mt-0.5">{r.description}</div>
                  )}
                  <div className="text-sm text-muted-foreground mt-1">
                    {r.shoot_from && (
                      <>
                        {datum(r.shoot_from, gebietsschema)}
                        {r.shoot_to && r.shoot_to !== r.shoot_from && tt(castingAntwortT.bisDatum).replace('{datum}', datum(r.shoot_to, gebietsschema))}
                        {' · '}
                      </>
                    )}
                    {r.shoot_days > 0 && `${r.shoot_days} ${r.shoot_days === 1 ? tt(castingAntwortT.drehtag) : tt(castingAntwortT.drehtage)} · `}
                    {r.fee_per_day_cents > 0 ? tt(castingAntwortT.proTag).replace('{betrag}', euro(r.fee_per_day_cents, gebietsschema)) : tt(castingAntwortT.gageNachAbsprache)}
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
              <p className="font-medium">{tt(castingAntwortT.angekommen)}</p>
              <p className="text-sm text-muted-foreground">
                {tt(castingAntwortT.angekommenText)}
              </p>
              {gesendet && (
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setGesendet(false)}>
                  {tt(castingAntwortT.antwortAendern)}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{tt(castingAntwortT.ihreVorschlaege)}</div>

              {zeilen.map((z, i) => (
                <div key={i} className="border border-border/60 rounded-lg p-3 space-y-2">
                  <div className="grid gap-2 sm:grid-cols-12">
                    <div className="sm:col-span-5">
                      <Label htmlFor={`v-name-${i}`}>{tt(castingAntwortT.name)}</Label>
                      <Input
                        id={`v-name-${i}`}
                        value={z.actor_name}
                        onChange={(e) => aendere(i, 'actor_name', e.target.value)}
                        placeholder={tt(castingAntwortT.vorUndNachname)}
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <Label htmlFor={`v-rolle-${i}`}>{tt(castingAntwortT.fuerWelcheRolle)}</Label>
                      <Select
                        value={z.role_id ? String(z.role_id) : ''}
                        onValueChange={(w) => aendere(i, 'role_id', Number(w))}
                      >
                        <SelectTrigger id={`v-rolle-${i}`}><SelectValue placeholder={tt(castingAntwortT.waehlen)} /></SelectTrigger>
                        <SelectContent>
                          {rollen.map((r) => (
                            <SelectItem key={r.id} value={String(r.id)}>
                              {r.role_name || r.figur || tt(castingAntwortT.rolleNr).replace('{n}', String(r.id))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-3">
                      <Label htmlFor={`v-gage-${i}`}>{tt(castingAntwortT.gageTag)}</Label>
                      <Input
                        id={`v-gage-${i}`}
                        value={z.gage}
                        onChange={(e) => aendere(i, 'gage', e.target.value)}
                        placeholder={tt(castingAntwortT.freiwillig)}
                        inputMode="decimal"
                      />
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-12">
                    <div className="sm:col-span-5">
                      <Label htmlFor={`v-frei-${i}`}>{tt(castingAntwortT.verfuegbar)}</Label>
                      <Select
                        value={z.available === null ? 'unklar' : z.available ? 'ja' : 'nein'}
                        onValueChange={(w) =>
                          aendere(i, 'available', w === 'unklar' ? null : w === 'ja')
                        }
                      >
                        <SelectTrigger id={`v-frei-${i}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ja">{tt(castingAntwortT.ja)}</SelectItem>
                          <SelectItem value="nein">{tt(castingAntwortT.nein)}</SelectItem>
                          <SelectItem value="unklar">{tt(castingAntwortT.nochOffen)}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-7">
                      <Label htmlFor={`v-material-${i}`}>{tt(castingAntwortT.linkMaterial)}</Label>
                      <Input
                        id={`v-material-${i}`}
                        value={z.showreel_url}
                        onChange={(e) => aendere(i, 'showreel_url', e.target.value)}
                        placeholder={tt(castingAntwortT.materialBeispiel)}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor={`v-notiz-${i}`}>{tt(castingAntwortT.anmerkung)}</Label>
                    <Textarea
                      id={`v-notiz-${i}`}
                      value={z.note}
                      onChange={(e) => aendere(i, 'note', e.target.value)}
                      rows={2}
                      placeholder={tt(castingAntwortT.freiwillig)}
                    />
                  </div>

                  {zeilen.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setZeilen(zeilen.filter((_, j) => j !== i))}
                      aria-label={tt(castingAntwortT.vorschlagEntfernen)}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      {tt(castingAntwortT.entfernen)}
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
                  {tt(castingAntwortT.weitererVorschlag)}
                </Button>
                <Button onClick={() => senden.mutate()} disabled={!brauchbar || senden.isPending}>
                  <Send className="w-4 h-4 mr-1.5" />
                  {tt(castingAntwortT.absenden)}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {tt(castingAntwortT.zeilenOhneNamen)}
              </p>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground text-center">
          {tt(castingAntwortT.beiFragen)}
        </p>
      </div>
    </div>
  )
}
