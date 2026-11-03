/**
 * Alle Bereiche eines Projekts und ihre Kategorien - eine Quelle für
 * Seitenleiste, Hauptseite und Einstellungen.
 *
 * Florian (03.11.2026): Es gibt keine feste Arbeitsreihenfolge. Jedes Konto
 * ordnet Kategorien und Bereiche selbst an, gespeichert wird nur die
 * Reihenfolge der Kennungen (`Anordnung`). Texte und Symbole kommen immer von
 * hier, damit eine gespeicherte Anordnung nach einem Update nichts Veraltetes
 * zeigt: Neue Bereiche erscheinen in ihrer Standardkategorie, entfernte
 * verschwinden still (`normalisieren`).
 *
 * Das Dashboard gehört nicht dazu: Es ist die Seite, auf der man angeordnet
 * wird, und steht in der Seitenleiste fest ganz oben.
 */
import type { LucideIcon } from 'lucide-react'
import { Activity, AlertTriangle, Archive, BedDouble, BookUser, Briefcase, Building2, Calendar, CalendarClock, CalendarOff, Camera, Car, CheckCircle2, CheckSquare, Clapperboard, ClipboardList, Clock, DollarSign, FileCheck, FileEdit, FileSignature, FileSpreadsheet, FileText, Film, FolderOpen, History, Image, Layers, LayoutDashboard, LayoutGrid, ListChecks, Mail, MapPin, Megaphone, MessageSquare, Music, Package, Scissors, Search, Shield, ShieldCheck, StickyNote, TableProperties, Trash2, TrendingUp, Type, Users, UtensilsCrossed, Video, Wallet } from 'lucide-react'
import { navT, type Lang } from '@/lib/i18n'
import { sidebarT } from '@/lib/texte/komponenten/Layout'
import { arbeitsplatzT } from '@/lib/texte/Arbeitsplatz'

type Text = Record<Lang, string>

export type ArbeitsplatzArt = 'film' | 'creator'

/** Ein Bereich: Pfad relativ zum Projekt, absolute Pfade beginnen mit "/". */
export type Bereich = { pfad: string; text: Text; icon: LucideIcon }

/** Was je Konto gespeichert wird: nur Kennungen, in der gewählten Reihenfolge. */
export type Anordnung = { kategorien: { id: string; bereiche: string[] }[] }

/** Eine Kategorie zum Anzeigen, mit Text und fertigen Bereichen. */
export type Kategorie = { id: string; text: Text; bereiche: Bereich[] }

type KategorieDef = { id: string; text: Text; bereiche: Bereich[] }

const b = (pfad: string, text: Text, icon: LucideIcon): Bereich => ({ pfad, text, icon })

export const DASHBOARD: Bereich = b('', navT.dashboard, LayoutDashboard)

const FILM: KategorieDef[] = [
  { id: 'projekt', text: arbeitsplatzT.kategorieProjekt, bereiche: [
    b('stammdaten', navT.masterData, Film),
    b('aufgaben', navT.tasks, CheckSquare),
  ] },
  { id: 'entwicklung', text: navT.development, bereiche: [
    b('drehbuch', navT.scenes, FileText),
    b('screenplay-editor', navT.scriptEditor, FileEdit),
    b('moodboard', navT.moodboard, Image),
    b('kommentare', navT.sceneComments, MessageSquare),
  ] },
  { id: 'casting-team', text: navT.castingTeam, bereiche: [
    b('besetzung', navT.casting, Users),
    b('sperrtage', navT.blackoutDays, CalendarOff),
    b('komparsen', navT.extras, Users),
    b('stabliste', navT.crew, Briefcase),
    b('kontakte', navT.contacts, BookUser),
    b('agenturen', sidebarT.agenturen, Building2),
    b('vertraege', sidebarT.vertraege, FileSignature),
  ] },
  { id: 'planung', text: navT.planningPrep, bereiche: [
    b('motive', navT.locations, MapPin),
    b('drehplan', navT.shootingPlan, Clapperboard),
    b('staebchenplan', navT.stripboard, LayoutDashboard),
    b('kalender', navT.calendar, Calendar),
    b('konfliktradar', navT.conflicts, AlertTriangle),
    b('equipment', navT.equipment, Package),
    b('equipment-kalender', navT.equipmentCal, CalendarClock),
    b('fahrzeuge', navT.vehicles, Car),
    b('reise', sidebarT.reise, BedDouble),
    b('ablage', sidebarT.ablage, FolderOpen),
    b('abnahme', sidebarT.abnahme, CheckCircle2),
    b('abschluss', sidebarT.abschluss, Archive),
    b('catering', navT.catering, UtensilsCrossed),
    b('budget', navT.budget, DollarSign),
    b('kostenstand', navT.costStatus, Wallet),
    b('versicherungen', navT.insurances, Shield),
  ] },
  { id: 'drehtage', text: navT.shootDays, bereiche: [
    b('tagesdispo', navT.callSheet, ClipboardList),
    b('checkin', navT.checkinBoard, CheckSquare),
    b('shotlist', navT.shotlist, Camera),
    b('setplan', navT.setPlan, LayoutGrid),
    b('vfx', navT.vfxTracking, Layers),
    b('continuity', navT.continuity, Image),
    b('kameraberichte', navT.cameraReports, Video),
    b('tagesbericht', navT.dailyReport, FileCheck),
    b('zeitanalyse', navT.timeAnalysis, TableProperties),
    b('timesheets', navT.timesheets, Clock),
    // Eigene Ansicht fürs Telefon am Set, außerhalb des Projektlayouts
    b('/set', navT.setView, Clapperboard),
  ] },
  { id: 'post', text: navT.postProduction, bereiche: [
    b('dood', navT.doodReport, TableProperties),
    b('postplan', navT.postPlan, CalendarClock),
    b('musikliste', navT.musicCues, Music),
  ] },
  { id: 'werkzeuge', text: navT.toolsComms, bereiche: [
    b('email', navT.email, Mail),
    b('pinboard', navT.pinboard, StickyNote),
    b('aktivitaet', navT.activityFeed, Activity),
    b('suche', navT.search, Search),
    b('audit', navT.auditLog, History),
    b('datenschutz', sidebarT.datenschutz, ShieldCheck),
    b('listen', sidebarT.listen, FileSpreadsheet),
    b('papierkorb', sidebarT.papierkorb, Trash2),
  ] },
]

// Creator hat eigene Bereiche, nicht umbenannte Filmseiten: Ein Kanal wird
// quer über alle Videos geführt.
const CREATOR: KategorieDef[] = [
  { id: 'projekt', text: arbeitsplatzT.kategorieProjekt, bereiche: [
    b('stammdaten', navT.masterData, Film),
    b('aufgaben', navT.tasks, CheckSquare),
  ] },
  { id: 'kanal', text: navT.channelPlanning, bereiche: [
    b('creator/kanal', navT.channel, Activity),
    b('creator/ideen', navT.ideas, StickyNote),
    b('creator/redaktionsplan', navT.editorialPlan, CalendarClock),
    b('creator/serien', navT.seriesFormats, Layers),
    b('kalender', navT.calendar, Calendar),
  ] },
  { id: 'videos', text: navT.videos, bereiche: [
    b('creator', navT.videos, Video),
    b('creator/titel', navT.titlesThumbs, Type),
    b('moodboard', navT.moodboard, Image),
    b('kommentare', navT.comments, MessageSquare),
  ] },
  { id: 'produktion', text: navT.production, bereiche: [
    b('shotlist', navT.shotlist, Camera),
    b('motive', navT.filmingLocations, MapPin),
    b('besetzung', navT.guestsCast, Users),
    b('stabliste', navT.team, Briefcase),
    b('equipment', navT.equipment, Package),
    b('equipment-kalender', navT.equipmentCal, CalendarClock),
    b('/set', navT.setView, Clapperboard),
  ] },
  { id: 'schnitt', text: navT.editRights, bereiche: [
    b('postplan', navT.postProd, Layers),
    b('creator/clips', navT.clips, Scissors),
    b('zeitanalyse', navT.timeAnalysis, TableProperties),
    b('creator/rechte', navT.rightsLicenses, ShieldCheck),
    b('musikliste', navT.musicCues, Music),
  ] },
  { id: 'veroeffentlichung', text: navT.publishing, bereiche: [
    b('creator/checklisten', navT.uploadChecklists, ListChecks),
    b('creator/seo', navT.seoMetadata, Search),
    b('creator/performance', navT.videoPerformance, TrendingUp),
  ] },
  { id: 'geld', text: navT.money, bereiche: [
    b('creator/sponsoren', navT.sponsors, Megaphone),
    b('budget', navT.budget, DollarSign),
    b('kostenstand', navT.costStatus, Wallet),
  ] },
  { id: 'werkzeuge', text: navT.toolsComms, bereiche: [
    b('email', navT.email, Mail),
    b('kontakte', navT.contacts, BookUser),
    b('pinboard', navT.pinboard, StickyNote),
    b('aktivitaet', navT.activityFeed, Activity),
    b('suche', navT.search, Search),
    b('audit', navT.auditLog, History),
    b('datenschutz', sidebarT.datenschutz, ShieldCheck),
    b('listen', sidebarT.listen, FileSpreadsheet),
    b('papierkorb', sidebarT.papierkorb, Trash2),
  ] },
]

const KATALOG: Record<ArbeitsplatzArt, KategorieDef[]> = { film: FILM, creator: CREATOR }

const BEREICHE: Record<ArbeitsplatzArt, Map<string, Bereich>> = {
  film: new Map(FILM.flatMap(k => k.bereiche.map(x => [x.pfad, x] as const))),
  creator: new Map(CREATOR.flatMap(k => k.bereiche.map(x => [x.pfad, x] as const))),
}

/** Schlüssel der Einstellung, unter dem ein Konto seine Anordnung speichert. */
export const arbeitsplatzSchluessel = (art: ArbeitsplatzArt) => `arbeitsplatz:${art}`

export function bereichFuer(art: ArbeitsplatzArt, pfad: string): Bereich | undefined {
  return BEREICHE[art].get(pfad)
}

export function kategorieText(art: ArbeitsplatzArt, id: string): Text {
  return KATALOG[art].find(k => k.id === id)?.text ?? arbeitsplatzT.kategorieProjekt
}

export function standardAnordnung(art: ArbeitsplatzArt): Anordnung {
  return { kategorien: KATALOG[art].map(k => ({ id: k.id, bereiche: k.bereiche.map(x => x.pfad) })) }
}

/**
 * Bringt eine gespeicherte Anordnung auf den Stand des Katalogs.
 *
 * Unbekannte und doppelte Kennungen fallen weg. Kategorien und Bereiche, die
 * die gespeicherte Anordnung noch nicht kennt, kommen dorthin, wo sie im
 * Standard stehen: neue Kategorien ans Ende, neue Bereiche ans Ende ihrer
 * Standardkategorie. Alles andere bleibt, wie das Konto es angeordnet hat.
 */
export function normalisieren(art: ArbeitsplatzArt, gespeichert: unknown): Anordnung {
  const katalog = KATALOG[art]
  const bereiche = BEREICHE[art]
  const roh = (gespeichert as Anordnung | null)?.kategorien
  const vergeben = new Set<string>()
  const ergebnis: Anordnung['kategorien'] = []

  for (const k of Array.isArray(roh) ? roh : []) {
    if (!k || typeof k.id !== 'string' || !katalog.some(d => d.id === k.id)) continue
    if (ergebnis.some(e => e.id === k.id)) continue
    const liste: string[] = []
    for (const p of Array.isArray(k.bereiche) ? k.bereiche : []) {
      // Gleich vermerken: Doppelte gibt es auch innerhalb einer Kategorie
      if (typeof p === 'string' && bereiche.has(p) && !vergeben.has(p)) { liste.push(p); vergeben.add(p) }
    }
    ergebnis.push({ id: k.id, bereiche: liste })
  }
  for (const d of katalog) {
    let ziel = ergebnis.find(e => e.id === d.id)
    if (!ziel) { ziel = { id: d.id, bereiche: [] }; ergebnis.push(ziel) }
    for (const x of d.bereiche) {
      if (!vergeben.has(x.pfad)) { ziel.bereiche.push(x.pfad); vergeben.add(x.pfad) }
    }
  }
  return { kategorien: ergebnis }
}

/** Die Anordnung mit Texten und Symbolen, so wie sie angezeigt wird. */
export function kategorienAus(art: ArbeitsplatzArt, anordnung: Anordnung): Kategorie[] {
  return anordnung.kategorien.map(k => ({
    id: k.id,
    text: kategorieText(art, k.id),
    bereiche: k.bereiche.map(p => BEREICHE[art].get(p)!).filter(Boolean),
  }))
}

export function istStandard(art: ArbeitsplatzArt, anordnung: Anordnung): boolean {
  return JSON.stringify(anordnung) === JSON.stringify(standardAnordnung(art))
}

/** Link eines Bereichs innerhalb eines Projekts. */
export function bereichLink(projektId: string | number, pfad: string): string {
  if (pfad === '') return `/projects/${projektId}`
  return pfad.startsWith('/') ? pfad : `/projects/${projektId}/${pfad}`
}
