/**
 * Der Arbeitsplatz: alle Bereiche eines Projekts in Kategorien, in der
 * Reihenfolge des Kontos. `ArbeitsplatzRaster` zeigt ihn als Links,
 * `ArbeitsplatzEditor` macht ihn verschiebbar - mit Maus, Finger (langes
 * Drücken, damit Scrollen frei bleibt) und Tastatur. Beide teilen das Raster,
 * damit der Wechsel zwischen Ansehen und Anordnen nichts umsortiert.
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import {
  DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor,
  closestCenter, pointerWithin, rectIntersection, defaultDropAnimationSideEffects,
  useSensor, useSensors,
  type Announcements, type CollisionDetection, type DragEndEvent, type DragOverEvent,
  type DragStartEvent, type KeyboardCoordinateGetter, type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronRight, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/useT'
import { arbeitsplatzT } from '@/lib/texte/Arbeitsplatz'
import {
  bereichFuer, bereichLink, kategorieText,
  type Anordnung, type ArbeitsplatzArt, type Bereich, type Kategorie,
} from '@/lib/bereiche'

const RASTER = 'grid grid-cols-1 gap-3 items-start sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'
const KARTE = 'rounded-2xl border border-border/60 bg-card shadow-sm'
const ZEILE = 'flex items-center gap-2.5 h-9 px-2.5 rounded-lg text-[13.5px] text-foreground/90'

function Kopf({ titel, anzahl, griff }: { titel: string; anzahl: number; griff?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 px-4 pt-3.5 pb-1.5">
      {griff}
      <h3 className="flex-1 min-w-0 truncate text-[13px] font-semibold tracking-[-0.01em]">{titel}</h3>
      <span className="text-[11px] tabular-nums text-muted-foreground">{anzahl}</span>
    </div>
  )
}

// ─── Ansehen ──────────────────────────────────────────────────────────────────

export function ArbeitsplatzRaster({ kategorien, projektId, badges, className }: {
  kategorien: Kategorie[]
  projektId: string | number
  /** Zahl an einem Bereich, etwa offene Konflikte */
  badges?: Record<string, number | undefined>
  className?: string
}) {
  const tt = useT()
  return (
    <div className={cn(RASTER, className)}>
      {kategorien.filter(k => k.bereiche.length > 0).map(k => (
        <section key={k.id} className={KARTE} aria-label={tt(k.text)}>
          <Kopf titel={tt(k.text)} anzahl={k.bereiche.length} />
          <ul className="px-1.5 pb-1.5">
            {k.bereiche.map(x => {
              const zahl = badges?.[x.pfad]
              return (
                <li key={x.pfad}>
                  <Link
                    to={bereichLink(projektId, x.pfad)}
                    className={cn(ZEILE, 'group transition-colors duration-150 hover:bg-foreground/[0.04] hover:text-foreground focus-visible:bg-foreground/[0.05]')}
                  >
                    <x.icon className="w-4 h-4 shrink-0 text-primary" aria-hidden />
                    <span className="flex-1 truncate">{tt(x.text)}</span>
                    {zahl ? (
                      <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-foreground/[0.08] text-muted-foreground text-[11px] font-medium flex items-center justify-center tabular-nums">
                        {zahl}
                      </span>
                    ) : null}
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground/60 opacity-0 -translate-x-0.5 transition-[opacity,transform] duration-150 group-hover:opacity-100 group-hover:translate-x-0" aria-hidden />
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

// ─── Anordnen ─────────────────────────────────────────────────────────────────

// Kategorien und Bereiche teilen sich einen DndContext; die Vorsilbe sagt, was gezogen wird.
const KAT = 'kat:'
const BER = 'ber:'
const istKat = (id: UniqueIdentifier) => String(id).startsWith(KAT)
const ohne = (id: UniqueIdentifier) => String(id).slice(4)
const kategorieVon = (a: Anordnung, pfad: string) => a.kategorien.find(k => k.bereiche.includes(pfad))?.id

const fuellen = (text: string, werte: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (_, k) => werte[k] ?? '')

export function ArbeitsplatzEditor({ art, anordnung, onChange, className }: {
  art: ArbeitsplatzArt
  anordnung: Anordnung
  onChange: (anordnung: Anordnung) => void
  className?: string
}) {
  const tt = useT()
  // Während des Ziehens wandert ein Bereich nur im Entwurf von Kategorie zu
  // Kategorie; gespeichert wird einmal beim Ablegen.
  const [entwurf, setEntwurf] = useState<Anordnung | null>(null)
  const [aktiv, setAktiv] = useState<string | null>(null)
  const sicht = entwurf ?? anordnung

  // Nach einem Wechsel der Kategorie einen Takt lang beim alten Ziel bleiben,
  // sonst springt der Bereich an der Kante zwischen zwei Karten hin und her.
  const letztesZiel = useRef<UniqueIdentifier | null>(null)
  const gewechselt = useRef(false)
  useEffect(() => {
    const r = requestAnimationFrame(() => { gewechselt.current = false })
    return () => cancelAnimationFrame(r)
  }, [entwurf])

  // Mit der Tastatur sucht dnd-kit das nächste Ziel unter allen Flächen. Eine
  // Kategorie darf aber nur auf Kategorien zielen, ein Bereich nur auf
  // Bereiche oder eine leere Kategorie - sonst landet die Karte auf einem
  // Bereich darüber und springt zurück (gemessen am 03.11.2026).
  const sichtRef = useRef(sicht)
  sichtRef.current = sicht
  const tastatur: KeyboardCoordinateGetter = (event, args) => {
    const { context } = args
    const alle = context.droppableContainers
    const katAktiv = !!context.active && istKat(context.active.id)
    const leer = new Set(sichtRef.current.kategorien.filter(k => k.bereiche.length === 0).map(k => KAT + k.id))
    const passend = {
      getEnabled: () => alle.getEnabled().filter(c => katAktiv ? istKat(c.id) : !istKat(c.id) || leer.has(String(c.id))),
      get: (id: UniqueIdentifier) => alle.get(id),
    } as unknown as typeof alle
    return sortableKeyboardCoordinates(event, { ...args, context: { ...context, droppableContainers: passend } })
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: tastatur }),
  )

  const name = (id: UniqueIdentifier) => istKat(id)
    ? tt(kategorieText(art, ohne(id)))
    : (() => { const x = bereichFuer(art, ohne(id)); return x ? tt(x.text) : '' })()

  const kollision: CollisionDetection = (args) => {
    if (istKat(args.active.id)) {
      return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter(c => istKat(c.id)) })
    }
    if (gewechselt.current && letztesZiel.current) return [{ id: letztesZiel.current }]
    const imZeiger = pointerWithin(args)
    const treffer = imZeiger.length > 0 ? imZeiger : rectIntersection(args)
    let ergebnis = treffer.filter(x => !istKat(x.id)).slice(0, 1)
    if (ergebnis.length === 0) {
      const kat = treffer.find(x => istKat(x.id))
      if (kat) {
        // Über einer Karte, aber zwischen ihren Bereichen: den nächsten darin nehmen
        const darin = new Set(sicht.kategorien.find(k => k.id === ohne(kat.id))?.bereiche.map(p => BER + p))
        ergebnis = darin.size === 0 ? [kat] : closestCenter({
          ...args, droppableContainers: args.droppableContainers.filter(c => darin.has(String(c.id))),
        })
      }
    }
    if (ergebnis.length > 0) letztesZiel.current = ergebnis[0].id
    return ergebnis
  }

  function beimStart({ active }: DragStartEvent) {
    setAktiv(String(active.id))
    setEntwurf(anordnung)
    letztesZiel.current = active.id
  }

  function beimZiehen({ active, over }: DragOverEvent) {
    if (!over || istKat(active.id)) return
    setEntwurf(alt => {
      const a = alt ?? anordnung
      const pfad = ohne(active.id)
      const von = kategorieVon(a, pfad)
      const nach = istKat(over.id) ? ohne(over.id) : kategorieVon(a, ohne(over.id))
      if (!von || !nach || von === nach) return a
      const ziel = a.kategorien.find(k => k.id === nach)!.bereiche
      let index = ziel.length
      if (!istKat(over.id)) {
        const unten = active.rect.current.translated
        const darunter = !!unten && unten.top > over.rect.top + over.rect.height / 2
        index = ziel.indexOf(ohne(over.id)) + (darunter ? 1 : 0)
      }
      gewechselt.current = true
      return {
        kategorien: a.kategorien.map(k =>
          k.id === von ? { ...k, bereiche: k.bereiche.filter(p => p !== pfad) }
          : k.id === nach ? { ...k, bereiche: [...k.bereiche.slice(0, index), pfad, ...k.bereiche.slice(index)] }
          : k),
      }
    })
  }

  function beimAblegen({ active, over }: DragEndEvent) {
    const a = entwurf ?? anordnung
    let ergebnis = a
    if (over && istKat(active.id) && istKat(over.id)) {
      const ids = a.kategorien.map(k => k.id)
      const von = ids.indexOf(ohne(active.id))
      const nach = ids.indexOf(ohne(over.id))
      if (von >= 0 && nach >= 0 && von !== nach) ergebnis = { kategorien: arrayMove(a.kategorien, von, nach) }
    } else if (over && !istKat(active.id) && !istKat(over.id)) {
      const pfad = ohne(active.id)
      const ziel = ohne(over.id)
      const kat = kategorieVon(a, pfad)
      if (kat && kat === kategorieVon(a, ziel)) {
        ergebnis = {
          kategorien: a.kategorien.map(k => {
            if (k.id !== kat) return k
            const i = k.bereiche.indexOf(pfad)
            const j = k.bereiche.indexOf(ziel)
            return i === j ? k : { ...k, bereiche: arrayMove(k.bereiche, i, j) }
          }),
        }
      }
    }
    setEntwurf(null)
    setAktiv(null)
    if (JSON.stringify(ergebnis) !== JSON.stringify(anordnung)) onChange(ergebnis)
  }

  function beimAbbruch() {
    setEntwurf(null)
    setAktiv(null)
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => fuellen(tt(arbeitsplatzT.aufgenommen), { name: name(active.id) }),
    onDragOver: ({ active, over }) => over && over.id !== active.id
      ? fuellen(tt(arbeitsplatzT.ueber), { name: name(active.id), ziel: name(over.id) })
      : undefined,
    onDragEnd: ({ active }) => fuellen(tt(arbeitsplatzT.abgelegt), { name: name(active.id) }),
    onDragCancel: ({ active }) => fuellen(tt(arbeitsplatzT.abgebrochen), { name: name(active.id) }),
  }

  const aktiveKategorie = aktiv && istKat(aktiv) ? sicht.kategorien.find(k => k.id === ohne(aktiv)) : undefined
  const aktiverBereich = aktiv && !istKat(aktiv) ? bereichFuer(art, ohne(aktiv)) : undefined

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={kollision}
      onDragStart={beimStart}
      onDragOver={beimZiehen}
      onDragEnd={beimAblegen}
      onDragCancel={beimAbbruch}
      accessibility={{ announcements, screenReaderInstructions: { draggable: tt(arbeitsplatzT.anleitung) } }}
    >
      <SortableContext items={sicht.kategorien.map(k => KAT + k.id)} strategy={rectSortingStrategy}>
        <div className={cn(RASTER, className)}>
          {sicht.kategorien.map(k => (
            <KategorieKarte key={k.id} art={art} id={k.id} bereiche={k.bereiche} />
          ))}
        </div>
      </SortableContext>
      {createPortal(
        <DragOverlay
          dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.35' } } }) }}
        >
          {aktiveKategorie ? (
            <KarteInhalt art={art} id={aktiveKategorie.id} bereiche={aktiveKategorie.bereiche} schwebend />
          ) : aktiverBereich ? (
            <BereichInhalt bereich={aktiverBereich} schwebend />
          ) : null}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  )
}

function KategorieKarte({ art, id, bereiche }: { art: ArbeitsplatzArt; id: string; bereiche: string[] }) {
  const tt = useT()
  const titel = tt(kategorieText(art, id))
  const {
    setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging,
  } = useSortable({ id: KAT + id, attributes: { roleDescription: tt(arbeitsplatzT.verschiebbar) } })

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(KARTE, isDragging && 'opacity-40')}
      aria-label={titel}
    >
      <Kopf
        titel={titel}
        anzahl={bereiche.length}
        griff={
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={fuellen(tt(arbeitsplatzT.griff), { name: titel })}
            className="-ml-2 w-7 h-7 shrink-0 rounded-md flex items-center justify-center text-muted-foreground/70 cursor-grab active:cursor-grabbing touch-manipulation hover:text-foreground hover:bg-foreground/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <GripVertical className="w-4 h-4" />
          </button>
        }
      />
      <SortableContext items={bereiche.map(p => BER + p)} strategy={verticalListSortingStrategy}>
        <ul className="px-1.5 pb-1.5 min-h-[44px]">
          {bereiche.map(p => {
            const x = bereichFuer(art, p)
            return x ? <BereichZeile key={p} bereich={x} /> : null
          })}
          {bereiche.length === 0 && (
            <li className="mx-1 mb-1 h-9 rounded-lg border border-dashed border-border flex items-center justify-center text-[12px] text-muted-foreground">
              {tt(arbeitsplatzT.leer)}
            </li>
          )}
        </ul>
      </SortableContext>
    </section>
  )
}

function BereichZeile({ bereich }: { bereich: Bereich }) {
  const tt = useT()
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: BER + bereich.pfad,
    attributes: { roleDescription: tt(arbeitsplatzT.verschiebbar) },
  })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(
        'rounded-lg cursor-grab active:cursor-grabbing touch-manipulation select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isDragging && 'opacity-40',
      )}
    >
      <BereichInhalt bereich={bereich} />
    </li>
  )
}

function BereichInhalt({ bereich, schwebend }: { bereich: Bereich; schwebend?: boolean }) {
  const tt = useT()
  return (
    <div className={cn(
      ZEILE, 'group transition-colors duration-150',
      schwebend ? 'bg-card shadow-lg ring-1 ring-border/80 scale-[1.02] cursor-grabbing' : 'hover:bg-foreground/[0.04]',
    )}>
      <bereich.icon className="w-4 h-4 shrink-0 text-primary" aria-hidden />
      <span className="flex-1 truncate">{tt(bereich.text)}</span>
      <GripVertical className={cn('w-3.5 h-3.5 shrink-0 text-muted-foreground/50', !schwebend && 'opacity-60 group-hover:opacity-100')} aria-hidden />
    </div>
  )
}

/** Die Karte, wie sie beim Ziehen am Zeiger hängt. */
function KarteInhalt({ art, id, bereiche, schwebend }: {
  art: ArbeitsplatzArt; id: string; bereiche: string[]; schwebend?: boolean
}) {
  const tt = useT()
  return (
    <section className={cn(KARTE, schwebend && 'shadow-xl ring-1 ring-border/80 scale-[1.01] cursor-grabbing')}>
      <Kopf
        titel={tt(kategorieText(art, id))}
        anzahl={bereiche.length}
        griff={<span className="-ml-2 w-7 h-7 shrink-0 flex items-center justify-center text-foreground"><GripVertical className="w-4 h-4" /></span>}
      />
      <ul className="px-1.5 pb-1.5">
        {bereiche.map(p => {
          const x = bereichFuer(art, p)
          return x ? <li key={p}><BereichInhalt bereich={x} /></li> : null
        })}
      </ul>
    </section>
  )
}
