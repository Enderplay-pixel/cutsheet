import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Users, Trash2, ShieldCheck, UserPlus, Crown } from 'lucide-react'
import { Navigate } from 'react-router-dom'

const ROLES: { value: string; label: string; color: string }[] = [
  { value: 'admin',      label: 'Admin',              color: 'text-red-500' },
  { value: 'producer',   label: 'Produzent',          color: 'text-amber-500' },
  { value: 'director',   label: 'Regisseur',          color: 'text-blue-500' },
  { value: 'dept_head',  label: 'Abteilungsleitung',  color: 'text-purple-500' },
  { value: 'read_only',  label: 'Lesezugriff',        color: 'text-muted-foreground' },
]
const roleLabel = (r: string) => ROLES.find(x => x.value === r)?.label ?? r
const roleColor = (r: string) => ROLES.find(x => x.value === r)?.color ?? ''

interface UserRow { id: number; email: string; name: string; role: string; created_at: string }

async function apiFetch(path: string, init?: RequestInit) {
  const token = localStorage.getItem('token')
  const r = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init?.headers } })
  const json = await r.json()
  if (json.error) throw new Error(json.error)
  return json.data
}

export function Component() {
  const { user: me } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePassword, setInvitePassword] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState('read_only')
  const [inviting, setInviting] = useState(false)

  // Redirect non-admins
  if (me && me.role !== 'admin') return <Navigate to="/" replace />

  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ['users'],
    queryFn: () => apiFetch('/api/auth/users'),
  })

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) =>
      apiFetch(`/api/auth/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast({ title: 'Rolle geändert' }) },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Fehler', description: e.message }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/auth/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast({ title: 'Benutzer gelöscht' }) },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Fehler', description: e.message }),
  })

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true)
    try {
      // Register user then immediately set their role
      const token = localStorage.getItem('token')
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: inviteEmail, password: invitePassword, name: inviteName }),
      })
      const { data, error } = await r.json()
      if (error) throw new Error(error)
      // Set the desired role (register always defaults to read_only for non-first users)
      if (inviteRole !== 'read_only') {
        await apiFetch(`/api/auth/users/${data.user.id}/role`, { method: 'PUT', body: JSON.stringify({ role: inviteRole }) })
      }
      qc.invalidateQueries({ queryKey: ['users'] })
      toast({ title: `${inviteName || inviteEmail} wurde eingeladen` })
      setInviteEmail(''); setInvitePassword(''); setInviteName(''); setInviteRole('read_only')
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Einladung fehlgeschlagen', description: e.message })
    } finally {
      setInviting(false)
    }
  }

  return (
    <div className="p-7 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-5 h-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Benutzerverwaltung</h1>
          <p className="text-sm text-muted-foreground">{users.length} registrierte Benutzer · nur für Admins</p>
        </div>
      </div>

      {/* Role legend */}
      <div className="flex flex-wrap gap-3">
        {ROLES.map(r => (
          <div key={r.value} className="flex items-center gap-1.5 text-xs bg-muted/50 rounded-full px-3 py-1">
            <span className={`font-semibold ${r.color}`}>{r.label}</span>
          </div>
        ))}
      </div>

      {/* User table */}
      <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Alle Benutzer</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                {['Name', 'E-Mail', 'Rolle', 'Dabei seit', ''].map(h => (
                  <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [1,2,3].map(i => (
                  <tr key={i} className="border-b border-border/40">
                    {[1,2,3,4,5].map(j => <td key={j} className="py-3 px-4"><div className="h-4 bg-muted rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-muted-foreground text-sm">Keine Benutzer gefunden.</td></tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 text-sm font-medium">
                      <div className="flex items-center gap-2">
                        {u.id === me?.id && <Crown className="w-3.5 h-3.5 text-amber-500" aria-label="Das bist du" />}
                        {u.name || '—'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{u.email}</td>
                    <td className="py-3 px-4">
                      {u.id === me?.id ? (
                        <span className={`text-sm font-semibold ${roleColor(u.role)}`}>{roleLabel(u.role)}</span>
                      ) : (
                        <Select
                          value={u.role}
                          onValueChange={role => roleMutation.mutate({ id: u.id, role })}
                        >
                          <SelectTrigger className="h-7 w-44 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map(r => (
                              <SelectItem key={r.value} value={r.value} className="text-xs">
                                <span className={r.color}>{r.label}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString('de-DE')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {u.id !== me?.id && (
                        <button
                          onClick={() => {
                            if (confirm(`${u.name || u.email} wirklich löschen?`)) deleteMutation.mutate(u.id)
                          }}
                          disabled={deleteMutation.isPending}
                          className="w-7 h-7 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                          title="Benutzer löschen"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite form */}
      <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Neuen Benutzer einladen</span>
        </div>
        <form onSubmit={handleInvite} className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Name</label>
            <Input placeholder="Vorname Nachname" value={inviteName} onChange={e => setInviteName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">E-Mail</label>
            <Input type="email" placeholder="person@beispiel.de" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Initialpasswort</label>
            <Input type="password" placeholder="Mindestens 6 Zeichen" value={invitePassword} onChange={e => setInvitePassword(e.target.value)} required minLength={6} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rolle</label>
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map(r => (
                  <SelectItem key={r.value} value={r.value}>
                    <span className={r.color}>{r.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={inviting || !inviteEmail || !invitePassword}>
              <UserPlus className="w-4 h-4 mr-2" />
              {inviting ? 'Wird eingeladen…' : 'Einladen'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
