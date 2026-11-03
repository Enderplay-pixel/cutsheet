/**
 * Anordenbare Abschnitte innerhalb einer Seite (Florian, 03.11.2026: "je
 * Seite sinnvoll"). Die Seite gibt ihre Abschnitte in der Standardreihenfolge
 * an; gespeichert wird je Konto unter "seite:<name>" nur die Reihenfolge der
 * Kennungen, gleich für alle Projekte.
 *
 * Zum Anordnen klappen die Abschnitte zu Leisten zusammen: Einen Block von
 * Bildschirmhöhe zieht niemand gern, eine Leiste mit Namen schon.
 */
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, closestCenter,
  useSensor, useSensors, type Announcements, type DragEndEvent, type DragStartEvent, type Modifier,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, GripVertical, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/useT'
import type { Lang } from '@/lib/i18n'
import { prefersReducedMotion } from '@/lib/motion'
import { useEinstellung } from '@/lib/einstellungen'
import { useSeitenAnordnung } from '@/lib/seitenAnordnung'
import { arbeitsplatzT } from '@/lib/texte/Arbeitsplatz'

type Text = Record<Lang, string>

export type SeitenBlock = {
  id: string
  titel: Text
  /** Was die Seite an dieser Stelle zeigt; leer heißt: gerade nichts, Platz behält er trotzdem. */
  inhalt: ReactNode
}

/** Gespeicherte Reihenfolge auf die Abschnitte der Seite bringen; neue kommen ans Ende. */
function ordnen(ids: string[], gespeichert: unknown): string[] {
  const roh = Array.isArray(gespeichert) ? gespeichert.filter((x): x is string => typeof x === 'string') : []
  const bekannt = roh.filter((id, i) => ids.includes(id) && roh.indexOf(id) === i)
  return [...bekannt, ...ids.filter(id => !bekannt.includes(id))]
}

/** Leisten wandern nur nach oben und unten. */
const nurSenkrecht: Modifier = ({ transform }) => ({ ...transform, x: 0 })

const fuellen = (text: string, werte: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (_, k) => werte[k] ?? '')

export function SeitenBloecke({ seite, bloecke, className }: {
  seite: string
  bloecke: SeitenBlock[]
  className?: string
}) {
  const { wert, bereit, setzen } = useEinstellung<string[]>(`seite:${seite}`)
  const { anordnen, anmelden, abmelden } = useSeitenAnordnung()
  const ids = bloecke.map(b => b.id)
  const schluessel = ids.join('|')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reihenfolge = useMemo(() => ordnen(ids, wert), [schluessel, wert])

  useEffect(() => {
    anmelden(seite)
    return () => abmelden(seite)
  }, [seite, anmelden, abmelden])

  // Bis die Reihenfolge geladen ist, nichts zeigen statt kurz die falsche
  if (!bereit) return null

  if (anordnen) {
    return (
      <Anordnen
        bloecke={reihenfolge.map(id => bloecke.find(b => b.id === id)!)}
        istStandard={reihenfolge.join('|') === schluessel}
        onChange={setzen}
        onStandard={() => setzen(ids)}
        className={className}
      />
    )
  }

  return (
    <div className={className}>
      {reihenfolge.map(id => {
        const block = bloecke.find(b => b.id === id)!
        return block.inhalt ? <Fragment key={id}>{block.inhalt}</Fragment> : null
      })}
    </div>
  )
}

function Anordnen({ bloecke, istStandard, onChange, onStandard, className }: {
  bloecke: SeitenBlock[]
  istStandard: boolean
  onChange: (ids: string[]) => void
  onStandard: () => void
  className?: string
}) {
  const tt = useT()
  const setAnordnen = useSeitenAnordnung(s => s.setAnordnen)
  const [aktiv, setAktiv] = useState<string | null>(null)
  const ref = useRef<HTMLElement>(null)

  // Der Schalter sitzt oben in der Kopfleiste, die Abschnitte oft weiter
  // unten - also dorthin, wo jetzt angeordnet wird.
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
    ref.current?.focus({ preventScroll: true })
  }, [])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const titel = (id: unknown) => {
    const b = bloecke.find(x => x.id === id)
    return b ? tt(b.titel) : ''
  }
  const announcements: Announcements = {
    onDragStart: ({ active }) => fuellen(tt(arbeitsplatzT.aufgenommen), { name: titel(active.id) }),
    onDragOver: ({ active, over }) => over && over.id !== active.id
      ? fuellen(tt(arbeitsplatzT.ueber), { name: titel(active.id), ziel: titel(over.id) })
      : undefined,
    onDragEnd: ({ active }) => fuellen(tt(arbeitsplatzT.abgelegt), { name: titel(active.id) }),
    onDragCancel: ({ active }) => fuellen(tt(arbeitsplatzT.abgebrochen), { name: titel(active.id) }),
  }

  function beimStart({ active }: DragStartEvent) {
    setAktiv(String(active.id))
  }

  function beimAblegen({ active, over }: DragEndEvent) {
    setAktiv(null)
    if (!over || over.id === active.id) return
    const ids = bloecke.map(b => b.id)
    onChange(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }

  const aktiverBlock = bloecke.find(b => b.id === aktiv)

  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-labelledby="seite-anordnen-titel"
      className={cn('rounded-2xl border border-primary/25 bg-primary/[0.035] p-4 sm:p-5 scroll-mt-20 outline-none animate-fade-up', className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 max-w-[62ch]">
          <h2 id="seite-anordnen-titel" className="text-[17px] font-semibold tracking-[-0.02em]">{tt(arbeitsplatzT.seiteTitel)}</h2>
          <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{tt(arbeitsplatzT.seiteText)}</p>
          <p className="text-[12px] text-muted-foreground/80 mt-0.5 [@media(hover:hover)]:hidden">{tt(arbeitsplatzT.seiteTelefon)}</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {!istStandard && (
            <Button variant="ghost" size="sm" onClick={onStandard}>
              <RotateCcw className="w-3.5 h-3.5" />
              {tt(arbeitsplatzT.standard)}
            </Button>
          )}
          <Button size="sm" onClick={() => setAnordnen(false)}>
            <Check className="w-3.5 h-3.5" />
            {tt(arbeitsplatzT.fertig)}
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[nurSenkrecht]}
        onDragStart={beimStart}
        onDragEnd={beimAblegen}
        onDragCancel={() => setAktiv(null)}
        accessibility={{ announcements, screenReaderInstructions: { draggable: tt(arbeitsplatzT.anleitung) } }}
      >
        <SortableContext items={bloecke.map(b => b.id)} strategy={verticalListSortingStrategy}>
          <ol className="mt-4 space-y-2">
            {bloecke.map((b, i) => <Leiste key={b.id} block={b} nummer={i + 1} />)}
          </ol>
        </SortableContext>
        {createPortal(
          <DragOverlay modifiers={[nurSenkrecht]}>
            {aktiverBlock ? <LeisteInhalt titel={tt(aktiverBlock.titel)} nummer={bloecke.indexOf(aktiverBlock) + 1} schwebend /> : null}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>
    </section>
  )
}

function Leiste({ block, nummer }: { block: SeitenBlock; nummer: number }) {
  const tt = useT()
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: block.id,
    attributes: { roleDescription: tt(arbeitsplatzT.verschiebbar) },
  })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(
        'rounded-xl cursor-grab active:cursor-grabbing touch-manipulation select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isDragging && 'opacity-40',
      )}
    >
      <LeisteInhalt titel={tt(block.titel)} nummer={nummer} />
    </li>
  )
}

function LeisteInhalt({ titel, nummer, schwebend }: { titel: string; nummer: number; schwebend?: boolean }) {
  return (
    <div className={cn(
      'flex items-center gap-3 h-12 pl-3 pr-4 rounded-xl border border-border/60 bg-card',
      schwebend ? 'shadow-xl ring-1 ring-border/80 scale-[1.01] cursor-grabbing' : 'shadow-sm hover:border-border transition-colors duration-150',
    )}>
      <GripVertical className="w-4 h-4 shrink-0 text-muted-foreground/70" aria-hidden />
      <span className="w-6 h-6 shrink-0 rounded-md bg-foreground/[0.06] text-[12px] font-semibold tabular-nums flex items-center justify-center text-muted-foreground">
        {nummer}
      </span>
      <span className="flex-1 min-w-0 truncate text-[14px] font-medium">{titel}</span>
    </div>
  )
}
