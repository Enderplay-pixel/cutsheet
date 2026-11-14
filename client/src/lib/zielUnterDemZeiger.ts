import { closestCenter, pointerWithin, rectIntersection, type CollisionDetection } from '@dnd-kit/core'

/**
 * Wohin eine gezogene Szene fällt: dorthin, wo der Mauszeiger steht.
 *
 * Vorher closestCenter - der nächste Mittelpunkt. Gemessen im Testbericht
 * SALZWIND (09.11.2026, 1440 × 900, 32 Szenen in der Ablage): Im oberen
 * Drittel eines leeren Drehtags losgelassen, passierte nichts oder die Szene
 * landete still beim Nachbartag - dessen Szenen lagen näher als die Mitte der
 * hohen, leeren Spalte. Erst unter dem Zeiger, dann was sich überlappt, und
 * nur ohne beides der nächste Mittelpunkt.
 *
 * Seit dem 14.11.2026 eine eigene Datei: Spaltenansicht (Drehplan) und Board
 * (Stäbchenplan) ziehen mit derselben Regel.
 */
export const zielUnterDemZeiger: CollisionDetection = (args) => {
  const unterDemZeiger = pointerWithin(args)
  if (unterDemZeiger.length > 0) return unterDemZeiger
  const ueberlappend = rectIntersection(args)
  if (ueberlappend.length > 0) return ueberlappend
  return closestCenter(args)
}
