import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Mail, Users, User, Copy, ExternalLink, Check } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

const TEMPLATES: Record<string, { subject: string; body: string }> = {
  'Drehplan-Update': {
    subject: 'Drehplan-Update – [Projekttitel]',
    body: 'Liebes Team,\n\nhiermit übermitteln wir Euch den aktuellen Drehplan.\n\nBitte prüft Eure jeweiligen Drehtage und meldet Euch bei Fragen.\n\nMit freundlichen Grüßen,\nDie Produktion'
  },
  'Dispo-Versand': {
    subject: 'Tagesdisposition Drehtag [Nr.] – [Datum]',
    body: 'Liebes Team,\n\nanbei findet Ihr die Tagesdisposition für morgen.\n\nBitte beachtet die angegebenen Call Times.\n\nBis morgen!\n\nDie Produktion'
  },
  'Motivbesichtigung': {
    subject: 'Einladung zur Motivbesichtigung – [Motiv]',
    body: 'Liebes Team,\n\nwir laden herzlich zur Motivbesichtigung ein.\n\nOrt: [Adresse]\nDatum: [Datum]\nUhrzeit: [Uhrzeit]\n\nBitte gebt kurz Bescheid, ob Ihr teilnehmen könnt.\n\nBeste Grüße,\nDie Regie'
  },
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const { toast } = useToast()

  const { data: crew } = useQuery({
    queryKey: ['crew', pid],
    queryFn: () => api.crew.list(pid),
  })

  const { data: cast } = useQuery({
    queryKey: ['cast', pid],
    queryFn: () => api.cast.list(pid),
  })

  const { data: project } = useQuery({
    queryKey: ['project', pid],
    queryFn: () => api.projects.get(pid),
  })

  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)

  const allCrewEmails = (crew || []).filter((c: any) => c.email).map((c: any) => c.email)
  const allCastEmails = (cast || []).filter((c: any) => c.email).map((c: any) => c.email)
  const allEmails = [...new Set([...allCrewEmails, ...allCastEmails])]

  const toggleRecipient = (email: string) => {
    const next = new Set(selectedRecipients)
    if (next.has(email)) next.delete(email)
    else next.add(email)
    setSelectedRecipients(next)
  }

  const selectGroup = (emails: string[]) => {
    const next = new Set(selectedRecipients)
    const allSelected = emails.every(e => next.has(e))
    if (allSelected) emails.forEach(e => next.delete(e))
    else emails.forEach(e => next.add(e))
    setSelectedRecipients(next)
  }

  const selectedEmails = Array.from(selectedRecipients).filter(e => e)

  const copyEmails = () => {
    if (selectedEmails.length > 0) {
      navigator.clipboard.writeText(selectedEmails.join(', '))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({ title: `${selectedEmails.length} E-Mail-Adressen kopiert` })
    }
  }

  const openMailto = () => {
    if (selectedEmails.length === 0) return
    const params = new URLSearchParams()
    if (subject) params.set('subject', subject)
    if (body) params.set('body', body)
    window.open(`mailto:${selectedEmails.join(',')}?${params.toString()}`)
  }

  const applyTemplate = (name: string) => {
    const t = TEMPLATES[name]
    const title = project?.title || '[Projekttitel]'
    setSubject(t.subject.replace('[Projekttitel]', title))
    setBody(t.body)
  }

  // Group crew by department
  const crewByDept = (crew || []).reduce((acc: Record<string, any[]>, m: any) => {
    const dept = m.department || 'Sonstiges'
    if (!acc[dept]) acc[dept] = []
    acc[dept].push(m)
    return acc
  }, {} as Record<string, any[]>)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <PageHeader
        title="E-Mail Center"
        subtitle="E-Mails an Stab und Darsteller senden"
      />

      <div className="grid grid-cols-3 gap-4">
        {/* Left: Recipients */}
        <div className="col-span-1 space-y-3">
          <Card>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm flex items-center justify-between">
                Empfänger
                <Badge variant="secondary">{selectedEmails.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Quick select buttons */}
              <div className="flex flex-col gap-1">
                <Button variant="outline" size="sm" className="text-xs h-7 justify-start"
                  onClick={() => selectGroup(allEmails)}>
                  <Users className="w-3 h-3 mr-1" />Alle ({allEmails.length})
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-7 justify-start"
                  onClick={() => selectGroup(allCrewEmails)}>
                  Alle Stab ({allCrewEmails.length})
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-7 justify-start"
                  onClick={() => selectGroup(allCastEmails)}>
                  Alle Darsteller ({allCastEmails.length})
                </Button>
              </div>

              <Separator />

              {/* Crew by department */}
              {Object.entries(crewByDept).map(([dept, members]) => (
                <div key={dept}>
                  <button className="text-xs font-semibold text-muted-foreground hover:text-primary w-full text-left mb-1"
                    onClick={() => selectGroup((members as any[]).filter(m => m.email).map(m => m.email))}>
                    {dept}
                  </button>
                  {(members as any[]).filter(m => m.email).map((m: any) => (
                    <label key={m.id} className="flex items-center gap-2 cursor-pointer py-0.5 hover:text-primary">
                      <Checkbox checked={selectedRecipients.has(m.email)} onCheckedChange={() => toggleRecipient(m.email)} className="h-3.5 w-3.5" />
                      <span className="text-xs truncate">{m.name}</span>
                    </label>
                  ))}
                </div>
              ))}

              {(cast || []).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Darsteller</p>
                  {(cast || []).filter((c: any) => c.email).map((c: any) => (
                    <label key={c.id} className="flex items-center gap-2 cursor-pointer py-0.5 hover:text-primary">
                      <Checkbox checked={selectedRecipients.has(c.email)} onCheckedChange={() => toggleRecipient(c.email)} className="h-3.5 w-3.5" />
                      <span className="text-xs truncate">{c.actor_name}</span>
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Compose */}
        <div className="col-span-2 space-y-3">
          {/* Templates */}
          <Card>
            <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">Vorlagen</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                {Object.keys(TEMPLATES).map(name => (
                  <Button key={name} variant="outline" size="sm" className="text-xs h-7" onClick={() => applyTemplate(name)}>
                    {name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Compose */}
          <Card>
            <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">Nachricht verfassen</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Empfänger</Label>
                <div className="mt-1 p-2 bg-muted/30 rounded text-xs min-h-8 flex flex-wrap gap-1">
                  {selectedEmails.length > 0
                    ? selectedEmails.map(e => <Badge key={e} variant="secondary" className="text-xs">{e}</Badge>)
                    : <span className="text-muted-foreground">Noch keine Empfänger ausgewählt</span>
                  }
                </div>
              </div>
              <div>
                <Label className="text-xs">Betreff</Label>
                <Input value={subject} onChange={e => setSubject(e.target.value)}
                  className="mt-1 h-8 text-sm" placeholder="Betreff…" />
              </div>
              <div>
                <Label className="text-xs">Nachricht</Label>
                <Textarea value={body} onChange={e => setBody(e.target.value)}
                  rows={10} className="mt-1 text-sm resize-none" placeholder="Nachrichtentext…" />
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={copyEmails} disabled={selectedEmails.length === 0}>
                  {copied ? <Check className="w-4 h-4 mr-2 text-green-500" /> : <Copy className="w-4 h-4 mr-2" />}
                  E-Mails kopieren
                </Button>
                <Button size="sm" onClick={openMailto} disabled={selectedEmails.length === 0}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  In E-Mail-Programm öffnen
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Tipp: „In E-Mail-Programm öffnen" öffnet Outlook, Thunderbird oder Mail mit vorausgefüllten Feldern.
                Oder kopiere die E-Mail-Adressen manuell.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
