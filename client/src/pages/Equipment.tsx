import { useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency, debounce } from '@/lib/utils'
import { Plus, Trash2, Package, Check, Download } from 'lucide-react'
import { useProjectPerms } from '@/contexts/ProjectRoleContext'
import { useT } from '@/lib/useT'
import { equipT, uiT } from '@/lib/i18n'

const DEPARTMENTS = ['Kamera', 'Licht', 'Grip', 'Ton', 'Requisite', 'Kostüm', 'Maske', 'Fahrzeuge', 'Sonstiges']

function EquipmentItemRow({ item, shootDayCount, onDelete }: { item: any; shootDayCount: number; onDelete: () => void }) {
  const [form, setForm] = useState(item)
  const queryClient = useQueryClient()
  const { canEdit } = useProjectPerms()
  const tt = useT()

  const mutation = useMutation({
    mutationFn: (data: any) => api.equipment.updateItem(item.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['equipment-items', item.equipment_list_id] }),
  })

  const debouncedUpdate = useRef(debounce((data: any) => mutation.mutate(data), 500)).current
  const update = (key: string, value: any) => {
    const total = key === 'rental_per_day_cents' || key === 'total_days'
      ? (key === 'rental_per_day_cents' ? value : form.rental_per_day_cents) *
        (key === 'total_days' ? value : form.total_days)
      : form.total_cents
    const next = { ...form, [key]: value, total_cents: key === 'quantity' ? form.total_cents : total }
    setForm(next)
    debouncedUpdate(next)
  }

  return (
    <tr className="border-b border-border/20 hover:bg-muted/10 group">
      <td className="py-2 pl-3">
        <Checkbox checked={!!form.checked} onCheckedChange={v => update('checked', v ? 1 : 0)} />
      </td>
      <td className="py-2 px-2">
        <Input value={form.item || ''} onChange={e => update('item', e.target.value)}
          className={`h-7 text-sm border-0 bg-transparent focus-visible:ring-1 ${form.checked ? 'line-through text-muted-foreground' : ''}`} />
      </td>
      <td className="py-2 px-2 w-16">
        <Input type="number" value={form.quantity || 1} onChange={e => update('quantity', Number(e.target.value))}
          className="h-7 text-xs text-center" min="1" />
      </td>
      <td className="py-2 px-2 w-36">
        <Input value={form.supplier || ''} onChange={e => update('supplier', e.target.value)}
          className="h-7 text-xs" placeholder="Verleiher" />
      </td>
      <td className="py-2 px-2 w-28">
        <div className="relative">
          <Input type="number" value={(form.rental_per_day_cents || 0) / 100}
            onChange={e => update('rental_per_day_cents', Math.round(Number(e.target.value) * 100))}
            className="h-7 text-xs text-right pr-5" />
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€/T</span>
        </div>
      </td>
      <td className="py-2 px-2 w-16">
        <Input type="number" value={form.total_days || shootDayCount || 1}
          onChange={e => update('total_days', Number(e.target.value))}
          className="h-7 text-xs text-center" min="1" />
      </td>
      <td className="py-2 px-2 w-24 text-right font-mono text-sm font-medium">
        {formatCurrency((form.rental_per_day_cents || 0) * (form.total_days || 1))}
      </td>
      <td className="py-2 pr-3 w-8">
        {canEdit && (
          <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive" title={tt(uiT.delete)}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </td>
    </tr>
  )
}

function EquipmentListCard({ list, shootDayCount }: { list: any; shootDayCount: number }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { canEdit } = useProjectPerms()
  const tt = useT()

  const { data: items, isLoading } = useQuery({
    queryKey: ['equipment-items', list.id],
    queryFn: () => api.equipment.listItems(list.id),
  })

  const createItem = useMutation({
    mutationFn: () => api.equipment.createItem(list.id, {
      item: 'Neues Equipment', quantity: 1, supplier: '', rental_per_day_cents: 0, total_days: shootDayCount || 1
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['equipment-items', list.id] }),
  })

  const deleteItem = useMutation({
    mutationFn: (id: number) => api.equipment.deleteItem(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['equipment-items', list.id] }),
  })

  const totalCost = (items || []).reduce((sum: number, item: any) =>
    sum + (item.rental_per_day_cents || 0) * (item.total_days || 1), 0)

  return (
    <AccordionItem value={String(list.id)} className="border rounded-lg overflow-hidden">
      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/20">
        <div className="flex items-center gap-3 w-full mr-4">
          <Package className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-sm">{list.name}</span>
          <Badge variant="secondary" className="text-xs">{list.department}</Badge>
          <div className="flex-1" />
          <span className="text-sm font-mono">{formatCurrency(totalCost)}</span>
          {items && <Badge variant="outline" className="text-xs">{items.length} Positionen</Badge>}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        {isLoading ? <Skeleton className="h-32" /> : (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="py-1.5 pl-3 w-8" />
                <th className="text-left py-1.5 px-2">{tt(equipT.labelItem)}</th>
                <th className="text-center py-1.5 px-2 w-16">{tt(equipT.labelQty)}</th>
                <th className="text-left py-1.5 px-2 w-36">Verleiher</th>
                <th className="text-right py-1.5 px-2 w-28">Preis/Tag</th>
                <th className="text-center py-1.5 px-2 w-16">Tage</th>
                <th className="text-right py-1.5 px-2 w-24">Gesamt</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {(items || []).map((item: any) => (
                <EquipmentItemRow key={item.id} item={item} shootDayCount={shootDayCount} onDelete={() => deleteItem.mutate(item.id)} />
              ))}
              {(!items || items.length === 0) && (
                <tr><td colSpan={8} className="py-4 text-center text-muted-foreground text-sm">Noch keine Positionen.</td></tr>
              )}
            </tbody>
            {(items && items.length > 0) && (
              <tfoot className="border-t border-border bg-muted/20">
                <tr>
                  <td colSpan={6} className="py-1.5 pl-3 text-xs font-semibold">Summe</td>
                  <td className="py-1.5 pr-4 text-right font-mono text-sm font-bold">{formatCurrency(totalCost)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        )}
        {canEdit && (
          <Button variant="ghost" size="sm" className="text-xs mt-2 w-full" onClick={() => createItem.mutate()}>
            <Plus className="w-3 h-3 mr-1" />{tt(equipT.addItem)}
          </Button>
        )}
      </AccordionContent>
    </AccordionItem>
  )
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { canEdit } = useProjectPerms()
  const tt = useT()
  const [newListName, setNewListName] = useState('')
  const [newListDept, setNewListDept] = useState('Kamera')

  const { data: lists, isLoading } = useQuery({
    queryKey: ['equipment-lists', pid],
    queryFn: () => api.equipment.listLists(pid),
  })

  const { data: shootDays } = useQuery({
    queryKey: ['shoot-days', pid],
    queryFn: () => api.drehplan.listDays(pid),
  })

  const shootDayCount = shootDays?.length || 1

  const createList = useMutation({
    mutationFn: () => api.equipment.createList(pid, { name: newListName || 'Neue Equipmentliste', department: newListDept }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['equipment-lists', pid] }); setNewListName('') },
  })

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <PageHeader
        title={tt(equipT.title)}
        subtitle={`${lists?.length || 0} Listen · ${shootDayCount} Drehtage geplant`}
        actions={
          <div className="flex gap-2">
            <a href={api.pdf.equipment(pid)} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-1" />PDF
              </Button>
            </a>
            {canEdit && (
              <>
                <Input value={newListName} onChange={e => setNewListName(e.target.value)}
                  placeholder={tt(equipT.newList)} className="h-8 w-40 text-sm" />
                <Select value={newListDept} onValueChange={setNewListDept}>
                  <SelectTrigger className="w-32 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" onClick={() => createList.mutate()} disabled={createList.isPending}>
                  <Plus className="w-4 h-4 mr-1" />{tt(equipT.createList)}
                </Button>
              </>
            )}
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-32" />)}</div>
      ) : (
        <Accordion type="multiple" defaultValue={(lists || []).map((l: any) => String(l.id))} className="space-y-2">
          {(lists || []).map((list: any) => (
            <EquipmentListCard key={list.id} list={list} shootDayCount={shootDayCount} />
          ))}
          {(!lists || lists.length === 0) && (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{tt(equipT.noLists)}</p>
            </div>
          )}
        </Accordion>
      )}
    </div>
  )
}
