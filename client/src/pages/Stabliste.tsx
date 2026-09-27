import { useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { useDownload } from '@/lib/useDownload'
import { formatCurrency, debounce, cn } from '@/lib/utils'
import { Plus, Trash2, Mail, Phone, Copy, Check, ChevronDown, ChevronUp, Users, Download } from 'lucide-react'
import { useProjectPerms } from '@/contexts/ProjectRoleContext'
import { useT } from '@/lib/useT'
import { crewT, uiT } from '@/lib/i18n'

const DEPARTMENTS = [
  'Regie', 'Produktion', 'Aufnahmeleitung', 'Kamera', 'Licht', 'Ton',
  'Maske', 'Kostüm', 'Requisite', 'Ausstattung', 'Schnitt', 'VFX', 'Musik', 'Fahrer', 'Sonstiges'
]

function CrewRow({ member, onDelete }: { member: any; onDelete: () => void }) {
  const [form, setForm] = useState(member)
  const [copied, setCopied] = useState(false)
  const queryClient = useQueryClient()
  const { projectId } = useParams()
  const pid = Number(projectId)
  const { canEdit } = useProjectPerms()
  const tt = useT()

  const mutation = useMutation({
    mutationFn: (data: any) => api.crew.update(member.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crew', pid] }),
  })
  const debouncedUpdate = useRef(debounce((data: any) => mutation.mutate(data), 500)).current
  const update = (key: string, value: any) => {
    const next = { ...form, [key]: value }
    setForm(next)
    debouncedUpdate(next)
  }
  const copyEmail = () => {
    if (form.email) {
      navigator.clipboard.writeText(form.email)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="flex items-center gap-2 lg:gap-3 py-2.5 border-b border-border/30 last:border-0 group flex-wrap lg:flex-nowrap">
      {/* Avatar */}
      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
        {member.name?.[0] || '?'}
      </div>

      {/* Name + Role */}
      <Input value={form.name || ''} onChange={e => update('name', e.target.value)}
        className="h-7 text-sm font-medium basis-full lg:basis-auto lg:flex-1 min-w-0 bg-transparent border-transparent hover:border-border focus:border-border transition-colors" placeholder="Name" />
      <Input value={form.role || ''} onChange={e => update('role', e.target.value)}
        className="h-7 text-xs text-muted-foreground w-32 lg:w-40 bg-transparent border-transparent hover:border-border focus:border-border transition-colors" placeholder="Position" />

      {/* Contact */}
      <div className="flex items-center gap-1 flex-1 min-w-0 lg:flex-none lg:shrink-0">
        <Mail className="w-3 h-3 text-muted-foreground/50" />
        <Input value={form.email || ''} onChange={e => update('email', e.target.value)}
          className="h-7 text-xs w-full lg:w-40 bg-transparent border-transparent hover:border-border focus:border-border transition-colors" type="email" placeholder="email@…" />
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Phone className="w-3 h-3 text-muted-foreground/50" />
        <Input value={form.phone || ''} onChange={e => update('phone', e.target.value)}
          className="h-7 text-xs w-24 lg:w-28 bg-transparent border-transparent hover:border-border focus:border-border transition-colors" placeholder="+49…" />
      </div>

      {/* Fee */}
      <div className="flex items-center gap-1 shrink-0">
        <Input type="number" value={(form.fee_per_day || 0) / 100}
          onChange={e => update('fee_per_day', Math.round(Number(e.target.value) * 100))}
          className="h-7 text-xs w-20 bg-transparent border-transparent hover:border-border focus:border-border transition-colors text-right" />
        <span className="text-xs text-muted-foreground/50">€</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <button onClick={copyEmail} className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors" title={tt(crewT.copyEmail)}>
          {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
        </button>
        {canEdit && (
          <button onClick={onDelete} className="w-6 h-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  )
}

function DepartmentSection({ dept, members, onAdd, onDelete, onCopyEmails }: {
  dept: string; members: any[]; onAdd: () => void; onDelete: (id: number) => void; onCopyEmails: () => void
}) {
  const [open, setOpen] = useState(true)
  const deptTotal = members.reduce((s, m) => s + (m.fee_per_day || 0), 0)
  const { canEdit } = useProjectPerms()
  const tt = useT()

  return (
    <div className="border border-border/60 rounded-xl overflow-hidden bg-card">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <span className="text-sm font-semibold flex-1">{dept}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{members.length} {tt(crewT.persons)}</span>
        {deptTotal > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">{formatCurrency(deptTotal)}{tt(uiT.perDay)}</span>
        )}
        <button
          onClick={e => { e.stopPropagation(); onCopyEmails() }}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary px-2 py-0.5 rounded hover:bg-primary/10 transition-colors"
          title={tt(crewT.copyEmails)}
        >
          <Mail className="w-3 h-3" />
        </button>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border/40 px-4 py-1 bg-card">
          {/* Column headers */}
          <div className="flex items-center gap-3 py-1.5 text-[11px] text-muted-foreground/60 font-medium uppercase tracking-wide border-b border-border/30 mb-1">
            <div className="w-7" />
            <div className="flex-1">{tt(uiT.name)}</div>
            <div className="w-40">{tt(uiT.position)}</div>
            <div className="flex items-center gap-1 w-[188px]"><Mail className="w-3 h-3" />{tt(uiT.email)}</div>
            <div className="flex items-center gap-1 w-[118px]"><Phone className="w-3 h-3" />{tt(uiT.phone)}</div>
            <div className="w-24 text-right">{tt(uiT.feePerDay)}</div>
            <div className="w-[52px]" />
          </div>

          {members.map(m => (
            <CrewRow key={m.id} member={m} onDelete={() => onDelete(m.id)} />
          ))}

          {canEdit && (
            <button
              onClick={onAdd}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors py-2 w-full"
            >
              <Plus className="w-3 h-3" /> {tt(crewT.addMember)}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const download = useDownload()
  const { canEdit } = useProjectPerms()
  const [newDept, setNewDept] = useState('Kamera')
  const [deptFilter, setDeptFilter] = useState<string>('all')

  const tt = useT()

  const { data: crew, isLoading } = useQuery({
    queryKey: ['crew', pid],
    queryFn: () => api.crew.list(pid),
  })

  const createMutation = useMutation({
    mutationFn: (dept: string) => api.crew.create(pid, { name: 'Neues Mitglied', department: dept, role: '' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crew', pid] }),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.crew.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crew', pid] }),
  })

  const grouped = (crew || []).reduce((acc: Record<string, any[]>, m: any) => {
    const dept = m.department || 'Sonstiges'
    if (!acc[dept]) acc[dept] = []
    acc[dept].push(m)
    return acc
  }, {} as Record<string, any[]>)

  const copyAllEmails = (dept: string) => {
    const emails = (grouped[dept] || []).map((m: any) => m.email).filter(Boolean).join(', ')
    if (emails) {
      navigator.clipboard.writeText(emails)
      toast({ title: `${dept} ${tt(crewT.emailsCopied)}` })
    } else {
      toast({ title: tt(crewT.noEmails), variant: 'destructive' })
    }
  }

  const totalGage = (crew || []).reduce((sum: number, m: any) => sum + (m.fee_per_day || 0), 0)
  const activeDepts = DEPARTMENTS.filter(d => grouped[d]?.length > 0)

  const exportCsv = () => {
    const rows = [['Name', 'Abteilung', 'Position', 'E-Mail', 'Telefon', 'Gage/Tag']]
    ;(crew || []).forEach((m: any) => rows.push([
      m.name || '', m.department || '', m.role || '', m.email || '', m.phone || '',
      m.fee_per_day ? String(m.fee_per_day / 100) : '0'
    ]))
    const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a')
    a.href = url; a.download = 'stabliste.csv'; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="p-7 max-w-6xl mx-auto animate-fade-up">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-7">
        <div>
          <h1 className="font-display text-[34px] sm:text-[40px]">{tt(crewT.title)}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tt(crewT.subtitle).replace('{n}', String(crew?.length || 0))}
            {totalGage > 0 && ` · ${formatCurrency(totalGage)} ${tt(crewT.totalFee)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="w-3.5 h-3.5 mr-1.5" />CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => download(api.pdf.stabliste(pid), 'stabliste.pdf')}>
              <Download className="w-3.5 h-3.5 mr-1.5" />PDF
            </Button>
          {canEdit && (
            <>
              <Select value={newDept} onValueChange={setNewDept}>
                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" onClick={() => createMutation.mutate(newDept)} disabled={createMutation.isPending}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />{tt(crewT.add)}
              </Button>
            </>
          )}
        </div>
      </div>

      {!isLoading && activeDepts.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-4">
          <button
            onClick={() => setDeptFilter('all')}
            className={cn(
              'flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              deptFilter === 'all'
                ? 'bg-primary/12 border-primary/30 text-primary'
                : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground'
            )}
          >
            Alle <span className="tabular-nums">{crew?.length || 0}</span>
          </button>
          {activeDepts.map(dept => (
            <button key={dept} onClick={() => setDeptFilter(dept)}
              className={cn(
                'flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                deptFilter === dept
                  ? 'bg-primary/12 border-primary/30 text-primary'
                  : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground'
              )}
            >
              {dept} <span className="tabular-nums">{grouped[dept]?.length || 0}</span>
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : activeDepts.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">{tt(crewT.noMembers)}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(deptFilter === 'all' ? activeDepts : activeDepts.filter(d => d === deptFilter)).map(dept => (
            <DepartmentSection
              key={dept}
              dept={dept}
              members={grouped[dept]}
              onAdd={() => createMutation.mutate(dept)}
              onDelete={(id) => deleteMutation.mutate(id)}
              onCopyEmails={() => copyAllEmails(dept)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
