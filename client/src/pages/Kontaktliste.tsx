import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Search, Mail, Phone, Copy, Check, Users, User, Download } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { useT } from '@/lib/useT'
import { contactsT, uiT } from '@/lib/i18n'

const DEPT_COLORS: Record<string, string> = {
  Regie: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  Produktion: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  Kamera: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  Licht: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  Ton: 'bg-green-500/10 text-green-600 dark:text-green-400',
  Maske: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  Kostüm: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const tt = useT()
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={copy} title={tt(uiT.copy)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground/50 hover:text-primary transition-colors shrink-0">
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
    </button>
  )
}

function ContactRow({ name, role, dept, email, phone, type }: {
  name: string; role?: string; dept?: string; email?: string; phone?: string; type: 'crew' | 'cast'
}) {
  return (
    <tr className="border-b border-border/30 hover:bg-muted/20 transition-colors group">
      <td className="py-2.5 px-4">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
            type === 'crew' ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-500'
          )}>
            {name?.[0]?.toUpperCase() || '?'}
          </div>
          <span className="text-sm font-medium">{name || '—'}</span>
        </div>
      </td>
      <td className="py-2.5 px-4 text-sm text-muted-foreground">{role || '—'}</td>
      <td className="py-2.5 px-4">
        {dept && (
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', DEPT_COLORS[dept] || 'bg-muted text-muted-foreground')}>
            {dept}
          </span>
        )}
      </td>
      <td className="py-2.5 px-4">
        {email ? (
          <div className="flex items-center gap-1.5">
            <a href={`mailto:${email}`} className="text-sm text-primary hover:underline truncate max-w-[200px]">{email}</a>
            <CopyBtn text={email} />
          </div>
        ) : <span className="text-sm text-muted-foreground/40">—</span>}
      </td>
      <td className="py-2.5 px-4">
        {phone ? (
          <div className="flex items-center gap-1.5">
            <a href={`tel:${phone}`} className="text-sm hover:text-primary transition-colors">{phone}</a>
            <CopyBtn text={phone} />
          </div>
        ) : <span className="text-sm text-muted-foreground/40">—</span>}
      </td>
    </tr>
  )
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const { toast } = useToast()
  const tt = useT()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'crew' | 'cast'>('all')

  const { data: crew, isLoading: crewLoading } = useQuery({
    queryKey: ['crew', pid],
    queryFn: () => api.crew.list(pid),
  })
  const { data: castList, isLoading: castLoading } = useQuery({
    queryKey: ['cast', pid],
    queryFn: () => api.cast.list(pid),
  })
  const { data: characters } = useQuery({
    queryKey: ['characters', pid],
    queryFn: () => api.characters.list(pid),
  })

  const isLoading = crewLoading || castLoading

  const crewContacts = (crew || []).map((c: any) => ({
    ...c, type: 'crew' as const, role: c.role, dept: c.department,
  }))
  const castContacts = (castList || []).map((c: any) => {
    const char = (characters || []).find((ch: any) => ch.id === c.character_id)
    return { ...c, type: 'cast' as const, role: char ? `als ${char.name}` : 'Darsteller', dept: 'Cast' }
  })

  const allContacts = [
    ...(filter !== 'cast' ? crewContacts : []),
    ...(filter !== 'crew' ? castContacts : []),
  ].filter(c =>
    !search || [c.name, c.role, c.dept, c.email, c.phone]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()))
  )

  const copyAllEmails = () => {
    const emails = allContacts.map(c => c.email).filter(Boolean).join(', ')
    if (!emails) { toast({ title: 'Keine E-Mail-Adressen vorhanden', variant: 'destructive' }); return }
    navigator.clipboard.writeText(emails)
    toast({ title: tt(contactsT.copiedToast) })
  }

  const exportCsv = () => {
    const rows = [['Name', 'Funktion', 'Abteilung', 'E-Mail', 'Telefon']]
    allContacts.forEach(c => rows.push([c.name || '', c.role || '', c.dept || '', c.email || '', c.phone || '']))
    const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'kontakte.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-7 max-w-6xl mx-auto animate-fade-up">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-[28px] sm:text-[34px]">{tt(contactsT.title)}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tt(contactsT.subtitle).replace('{n}', String(crewContacts.length + castContacts.length))}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copyAllEmails} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
            <Mail className="w-3.5 h-3.5" /> {tt(contactsT.copyAllEmails)}
          </button>
          <button onClick={exportCsv} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
            <Download className="w-3.5 h-3.5" /> CSV Export
          </button>
          <button
            onClick={async () => {
              // vCard-Export: alle Kontakte (Stab, Besetzung, Motiv-Kontakte) fürs Adressbuch
              const token = localStorage.getItem('token')
              const res = await fetch(api.contactsExport.vcfUrl(pid), { headers: { Authorization: `Bearer ${token}` } })
              if (!res.ok) return
              const blob = await res.blob()
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a'); a.href = url; a.download = 'cutsheet-kontakte.vcf'; a.click()
              URL.revokeObjectURL(url)
            }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
            title="Alle Kontakte als vCard fürs Adressbuch (iOS/Android/Outlook)"
          >
            <Download className="w-3.5 h-3.5" /> vCard
          </button>
        </div>
      </div>

      {/* Filter + Search */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={tt(contactsT.search)} className="pl-8 h-8 text-sm" />
        </div>
        <div className="flex gap-1 bg-muted/40 rounded-lg p-0.5">
          {(['all', 'crew', 'cast'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors font-medium',
                filter === f ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}>
              {f === 'all' ? tt(contactsT.filterAll) : f === 'crew' ? <><Users className="w-3 h-3" />{tt(contactsT.filterCrew)}</> : <><User className="w-3 h-3" />{tt(contactsT.filterCast)}</>}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                {[tt(contactsT.colName), tt(contactsT.colType), tt(contactsT.colDept), tt(contactsT.colEmail), tt(contactsT.colPhone)].map(h => (
                  <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [1,2,3,4,5].map(i => (
                  <tr key={i} className="border-b border-border/30">
                    {[1,2,3,4,5].map(j => <td key={j} className="py-2.5 px-4"><div className="h-4 bg-muted rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : allContacts.length === 0 ? (
                <tr><td colSpan={5} className="py-16 text-center text-sm text-muted-foreground">{tt(contactsT.noContacts)}</td></tr>
              ) : (
                allContacts.map((c, i) => (
                  <ContactRow key={i} name={c.name} role={c.role} dept={c.dept} email={c.email} phone={c.phone} type={c.type} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
