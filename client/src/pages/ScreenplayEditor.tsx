import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/useT'
import { useDownload } from '@/lib/useDownload'
import { screenplayT } from '@/lib/i18n'
import {
  ArrowLeft, Plus, Upload, FileText, ChevronRight, ChevronDown, Film,
  AlignLeft, User, MessageSquare, Parentheses, CornerUpRight, StickyNote,
  Clapperboard, CheckCircle2, Loader2, Download, Type, PenLine, ListTree,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ─── Types ────────────────────────────────────────────────────────────────────

type BlockType =
  | 'scene_heading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'note'
  | 'super'
  | 'intercut'
  | 'annotation'

interface ScreenplayBlock {
  id: number
  scene_id: number
  project_id: number
  sort_order: number
  block_type: BlockType
  content: string
  annotation_color: string
  created_at: string
  updated_at: string
  /**
   * Bleibt gleich, auch wenn die id vom Server nachgereicht wird.
   *
   * Eine neue Zeile entsteht sofort im Browser und bekommt ihre id erst mit
   * der Antwort. Stünde die id im `key`, baute React die Zeile in diesem
   * Moment neu auf - mitten im Schreiben, mit verlorenem Schreibstrich.
   */
  schluessel?: string
}

/**
 * Die Zeilen einer Szene in der Reihenfolge, in der der Editor sie zeigt.
 *
 * Die erste Überschrift steht oben, jede andere Zeile an ihrem Platz - auch
 * eine zweite Überschrift. Vorher wurde jede weitere ausgeblendet. Gemessen
 * am 24.10.2026: Eine Zeile, über das Typ-Menü zur Überschrift gemacht,
 * verschwand aus dem Editor, stand aber weiter im PDF.
 *
 * Anzeige und Tastatur nehmen dieselbe Reihenfolge - sonst springt der
 * Pfeil nach oben an eine andere Stelle, als man vor sich sieht.
 */
function zeilenFolge(blocks: ScreenplayBlock[]): ScreenplayBlock[] {
  const kopf = blocks.find(b => b.block_type === 'scene_heading')
  return kopf ? [kopf, ...blocks.filter(b => b !== kopf)] : blocks
}

/** Wohin der Schreibstrich in einer Zeile kommt. */
type Stelle = 'anfang' | 'ende' | number

/** Der Schlüssel, unter dem React eine Zeile wiedererkennt. */
function blockSchluessel(b: ScreenplayBlock): string {
  return b.schluessel ?? `s${b.id}`
}

/** Die Überschriftenzeile, wie sie aus den Feldern der Szene folgt. */
function ueberschriftAusSzene(scene: any): string {
  const ortRoh = String(scene?.int_ext ?? '').trim().toUpperCase() || 'INT'
  const ort = ortRoh.endsWith('.') ? ortRoh : `${ortRoh}.`
  const titel = (String(scene?.title ?? '').trim()
    || `SZENE ${String(scene?.scene_number ?? '').trim()}`.trim()).toUpperCase()
  const zeit = String(scene?.day_night ?? '').trim().toUpperCase()
  return [ort, titel, zeit ? `- ${zeit}` : ''].filter(Boolean).join(' ')
}

interface SceneData {
  scene: any
  blocks: ScreenplayBlock[]
}

// ─── Transitions list ─────────────────────────────────────────────────────────

const TRANSITIONS = [
  'CUT TO:',
  'SMASH CUT TO:',
  'MATCH CUT TO:',
  'JUMP CUT TO:',
  'DISSOLVE TO:',
  'FADE TO:',
  'FADE IN:',
  'FADE OUT:',
  'FADE TO BLACK:',
  'IRIS IN:',
  'IRIS OUT:',
  'WIPE TO:',
  'INTERCUT WITH:',
  'BACK TO:',
  'CONTINUOUS:',
  'TITLE CARD:',
  'THE END.',
]

// Character suffixes
const CHAR_SUFFIXES = ['V.O.', 'O.S.', 'O.C.', "CONT'D"]

// Tab-cycle order for block types
const TAB_CYCLE: BlockType[] = ['action', 'character', 'dialogue', 'parenthetical', 'action']

// What block type to auto-create after pressing Enter in a given type
const ENTER_NEXT_TYPE: Record<BlockType, BlockType> = {
  scene_heading: 'action',
  action: 'action',
  character: 'dialogue',
  dialogue: 'action',
  parenthetical: 'dialogue',
  transition: 'scene_heading',
  note: 'action',
  super: 'action',
  intercut: 'action',
  annotation: 'action',
}

// Predefined annotation colors
const ANNOTATION_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899']

// ─── Block styling ────────────────────────────────────────────────────────────

function getBlockStyle(type: BlockType): string {
  const base = 'w-full bg-transparent border-none outline-none resize-none font-mono text-sm leading-relaxed'
  switch (type) {
    case 'scene_heading':
      return cn(base, 'uppercase font-bold text-foreground')
    case 'action':
      return cn(base, 'text-foreground')
    case 'character':
      return cn(base, 'uppercase text-foreground text-center font-medium')
    case 'dialogue':
      return cn(base, 'text-foreground')
    case 'parenthetical':
      return cn(base, 'italic text-foreground')
    case 'transition':
      return cn(base, 'uppercase text-right text-foreground font-medium')
    case 'note':
      return cn(base, 'italic text-muted-foreground text-xs')
    case 'super':
      return cn(base, 'uppercase text-center font-bold text-primary/80')
    case 'intercut':
      return cn(base, 'uppercase font-bold text-foreground')
    case 'annotation':
      return cn(base, 'text-xs font-sans italic')
  }
}

function getBlockContainerStyle(type: BlockType): string {
  switch (type) {
    case 'scene_heading':
      return 'mt-8 mb-1 pt-3 border-t border-border/30'
    case 'action':
      return 'py-0.5'
    case 'character':
      return 'mt-3 mb-0 px-[20%]'
    case 'dialogue':
      return 'py-0.5 px-[15%]'
    case 'parenthetical':
      return 'py-0.5 px-[17%]'
    case 'transition':
      return 'mt-2 py-0.5'
    case 'note':
      return 'py-1 px-2 bg-yellow-500/5 rounded border border-yellow-500/20 my-1'
    case 'super':
      return 'mt-4 mb-1 py-1 px-[10%] bg-primary/4 rounded'
    case 'intercut':
      return 'mt-6 mb-1 pt-2 border-t-2 border-dashed border-border/50'
    case 'annotation':
      return 'py-1 px-3 my-1 rounded-r border-l-2'
    default:
      return ''
  }
}

// ─── SaveStatus component ─────────────────────────────────────────────────────

function SaveStatus({ saving, tt }: { saving: boolean; tt: (m: any) => string }) {
  if (saving) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" />
        {tt(screenplayT.saving)}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
      <CheckCircle2 className="w-3 h-3" />
      {tt(screenplayT.saved)}
    </span>
  )
}

// ─── BlockEditor component ────────────────────────────────────────────────────

interface BlockEditorProps {
  block: ScreenplayBlock
  isActive: boolean
  sceneNumber?: string
  onFocus: () => void
  onContentChange: (id: number, content: string) => void
  onTypeChange: (id: number, type: BlockType) => void
  onEnterKey: (id: number, von: number, bis: number) => void
  onBackspaceEmpty: (id: number) => void
  onBackspaceStart: (id: number) => void
  onArrow: (id: number, richtung: -1 | 1) => void
  onTabKey: (id: number, shift: boolean) => void
  onPasteLines: (id: number, vorn: string, zeilen: string[], hinten: string) => void
  textareaRef: (el: HTMLTextAreaElement | null) => void
  blockTypeLabel: string
}

function BlockEditor({
  block,
  isActive,
  sceneNumber,
  onFocus,
  onContentChange,
  onTypeChange,
  onEnterKey,
  onBackspaceEmpty,
  onBackspaceStart,
  onArrow,
  onTabKey,
  onPasteLines,
  textareaRef,
  blockTypeLabel,
}: BlockEditorProps) {
  const [localContent, setLocalContent] = useState(block.content)

  useEffect(() => {
    setLocalContent(block.content)
  }, [block.content])

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    // Ein Umbruch, der doch hereinkommt (etwa per Ziehen), wird ein
    // Leerzeichen - vorher klebten die Wörter beiderseits zusammen.
    const val = e.target.value.replace(/[\r\n]+/g, ' ')
    setLocalContent(val)
    onContentChange(block.id, val)
    autoResize(e.target)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget
    if (e.key === 'Enter') {
      e.preventDefault()
      onEnterKey(block.id, el.selectionStart, el.selectionEnd)
      return
    }
    if (e.key === 'Backspace' && localContent === '') {
      e.preventDefault()
      onBackspaceEmpty(block.id)
      return
    }
    if (e.key === 'Backspace' && el.selectionStart === 0 && el.selectionEnd === 0) {
      e.preventDefault()
      onBackspaceStart(block.id)
      return
    }
    // Pfeil hoch und runter verlassen die Zeile, wenn es in ihr nicht weiter
    // geht. Jede Zeile ist ein eigenes Feld; ohne das kam man nur mit der Maus
    // in die nächste. Eine umbrochene Zeile behält ihr eigenes Verhalten: Der
    // erste Druck geht an ihren Anfang oder ihr Ende, erst der zweite hinaus.
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown')
        && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
      const hoch = e.key === 'ArrowUp'
      const zeilenhoehe = parseFloat(getComputedStyle(el).lineHeight) || 20
      const einzeilig = el.scrollHeight <= zeilenhoehe * 1.5
      const amRand = hoch ? el.selectionStart === 0 : el.selectionEnd === el.value.length
      if (einzeilig || amRand) {
        e.preventDefault()
        onArrow(block.id, hoch ? -1 : 1)
      }
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      onTabKey(block.id, e.shiftKey)
      return
    }
  }

  /**
   * Mehrere Zeilen einfügen.
   *
   * Gemessen am 24.10.2026: Vier Zeilen aus einem Textprogramm wurden zu einer
   * einzigen, mit zusammengeklebten Wörtern - "Maschinenraum.Es ist heiss",
   * "flimmert.MARKIst hier jemand?". Jetzt wird jede Zeile eine eigene, so
   * als wäre zwischen ihnen Enter gedrückt worden.
   */
  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const text = e.clipboardData.getData('text/plain')
    // Eine Zeile fügt der Browser selbst richtig ein.
    if (!/[\r\n]/.test(text)) return
    e.preventDefault()
    const zeilen = text.split(/\r\n|\r|\n/).map(z => z.trim()).filter(Boolean)
    if (zeilen.length === 0) return
    const el = e.currentTarget
    onPasteLines(
      block.id,
      localContent.slice(0, el.selectionStart),
      zeilen,
      localContent.slice(el.selectionEnd),
    )
  }

  function handleRef(el: HTMLTextAreaElement | null) {
    textareaRef(el)
    if (el) autoResize(el)
  }

  const placeholder =
    block.block_type === 'scene_heading' ? 'INT. LOCATION - DAY'
    : block.block_type === 'character' ? 'CHARACTER'
    : block.block_type === 'parenthetical' ? '(action)'
    : block.block_type === 'transition' ? 'CUT TO:'
    : block.block_type === 'note' ? 'Note…'
    : block.block_type === 'dialogue' ? 'Dialogue…'
    : block.block_type === 'super' ? 'SUPER: "TEXT"'
    : block.block_type === 'intercut' ? 'INTERCUT WITH:'
    : block.block_type === 'annotation' ? 'Anmerkung…'
    : 'Action…'

  const annotationStyle = block.block_type === 'annotation' ? {
    borderLeftColor: block.annotation_color || '#f59e0b',
    backgroundColor: `${block.annotation_color || '#f59e0b'}18`,
    color: block.annotation_color || '#f59e0b',
  } : undefined

  return (
    <div
      className={cn(
        'group relative rounded transition-colors',
        getBlockContainerStyle(block.block_type),
        isActive && block.block_type !== 'annotation' && 'bg-primary/3'
      )}
      style={annotationStyle}
      onClick={(e) => { e.stopPropagation(); onFocus() }}
    >
      {/* Block type label on left when active */}
      {isActive && (
        <span className="absolute -left-32 top-0 text-[10px] text-muted-foreground/50 whitespace-nowrap pt-0.5 hidden xl:block">
          {blockTypeLabel}
        </span>
      )}

      {/* Scene number on left of heading */}
      {block.block_type === 'scene_heading' && sceneNumber && (
        <span className="absolute -left-8 top-3.5 text-[10px] font-mono text-muted-foreground/40 select-none">
          {sceneNumber}.
        </span>
      )}

      <textarea
        ref={handleRef}
        value={localContent}
        onChange={handleChange}
        aria-label={blockTypeLabel}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onFocus={onFocus}
        rows={1}
        className={cn(
          getBlockStyle(block.block_type),
          'min-h-[1.5rem] overflow-hidden focus:ring-0 focus:outline-none'
        )}
        placeholder={localContent ? '' : placeholder}
        spellCheck
      />

    </div>
  )
}

// ─── SceneSection component ───────────────────────────────────────────────────

interface SceneSectionProps {
  sceneData: SceneData
  sceneIndex: number
  activeBlockId: number | null
  setActiveBlockId: (id: number | null) => void
  onContentChange: (blockId: number, content: string) => void
  onTypeChange: (blockId: number, type: BlockType) => void
  onEnterKey: (blockId: number, von: number, bis: number) => void
  onBackspaceEmpty: (blockId: number) => void
  onBackspaceStart: (blockId: number) => void
  onArrow: (blockId: number, richtung: -1 | 1) => void
  onTabKey: (blockId: number, shift: boolean) => void
  onPasteLines: (blockId: number, vorn: string, zeilen: string[], hinten: string) => void
  onCreateFirstBlock: (sceneId: number) => void
  textareaRefs: React.MutableRefObject<Map<number, HTMLTextAreaElement>>
  onBlockMounted: (blockId: number, el: HTMLTextAreaElement) => void
  sectionRef: (el: HTMLDivElement | null) => void
  blockTypeLabels: Record<BlockType, string>
}

function SceneSection({
  sceneData,
  sceneIndex,
  activeBlockId,
  setActiveBlockId,
  onContentChange,
  onTypeChange,
  onEnterKey,
  onBackspaceEmpty,
  onBackspaceStart,
  onArrow,
  onTabKey,
  onPasteLines,
  onCreateFirstBlock,
  textareaRefs,
  onBlockMounted,
  sectionRef,
  blockTypeLabels,
}: SceneSectionProps) {
  const { scene, blocks } = sceneData

  const headingBlock = blocks.find(b => b.block_type === 'scene_heading')
  const allBlocks = zeilenFolge(blocks)


  return (
    <div ref={sectionRef} className="mb-12" data-scene-id={scene.id}>
      {!headingBlock && (
        <div
          className="mt-8 mb-1 pt-3 border-t border-border/30 relative cursor-text group"
          onClick={(e) => { e.stopPropagation(); onCreateFirstBlock(scene.id) }}
        >
          <span className="absolute -left-8 top-3.5 text-[10px] font-mono text-muted-foreground/40 select-none">
            {scene.scene_number}.
          </span>
          <p className="font-mono text-sm font-bold uppercase text-foreground">
            {ueberschriftAusSzene(scene)}
          </p>
          {allBlocks.length === 0 && (
            <p className="font-mono text-xs text-muted-foreground/30 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
              Klicken um Inhalt hinzuzufügen…
            </p>
          )}
        </div>
      )}

      {allBlocks.map(block => (
        <BlockEditor
          key={blockSchluessel(block)}
          block={block}
          isActive={activeBlockId === block.id}
          sceneNumber={block.block_type === 'scene_heading' ? scene.scene_number : undefined}
          onFocus={() => setActiveBlockId(block.id)}
          onContentChange={onContentChange}
          onTypeChange={onTypeChange}
          onEnterKey={onEnterKey}
          onBackspaceEmpty={onBackspaceEmpty}
          onBackspaceStart={onBackspaceStart}
          onArrow={onArrow}
          onTabKey={onTabKey}
          onPasteLines={onPasteLines}
          textareaRef={el => {
            if (el) {
              textareaRefs.current.set(block.id, el)
              onBlockMounted(block.id, el)
            } else textareaRefs.current.delete(block.id)
          }}
          blockTypeLabel={blockTypeLabels[block.block_type]}
        />
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const tt = useT()
  const download = useDownload()

  const [activeBlockId, setActiveBlockId] = useState<number | null>(null)
  /** Szenenleiste am Telefon - dort liegt sie ueber dem Text statt daneben */
  const [scenesOpen, setScenesOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [localScenes, setLocalScenes] = useState<SceneData[]>([])

  const textareaRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map())
  const sectionRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * Der Stand, auf dem die Tastatur arbeitet.
   *
   * `localScenes` kommt aus dem Zustand und hinkt in Rückrufen eine Runde
   * hinterher. Wer zügig schreibt, löst aber mehrere Ereignisse aus, bevor
   * React neu gezeichnet hat. Deshalb liegt derselbe Stand zusätzlich in
   * einem Ref und wird dort sofort fortgeschrieben.
   */
  const szenenRef = useRef<SceneData[]>([])
  function setzeSzenen(f: (vorher: SceneData[]) => SceneData[]) {
    const neu = f(szenenRef.current)
    szenenRef.current = neu
    setLocalScenes(neu)
  }

  /** Der aktive Block, synchron lesbar - für Rückrufe, die nicht warten können. */
  const aktiverBlockRef = useRef<number | null>(null)
  function waehle(id: number | null) {
    aktiverBlockRef.current = id
    setActiveBlockId(id)
  }

  /** Zeilen, die es bisher nur im Browser gibt: negative Kennungen. */
  const naechsteTempId = useRef(-1)
  const tempZuEcht = useRef(new Map<number, number>())
  /** Zeilen, die wieder gelöscht wurden, bevor der Server geantwortet hat. */
  const verworfen = useRef(new Set<number>())
  /** Was noch nicht beim Server ist - je Zeile gesammelt. */
  const offen = useRef(new Map<number, Record<string, any>>())
  const speicherUhren = useRef(new Map<number, ReturnType<typeof setTimeout>>())
  /** Welche Zeile den Schreibstrich bekommt, sobald sie im Dokument steht. */
  const fokusWunsch = useRef<{ id: number; stelle: Stelle; inhalt?: string } | null>(null)
  /** Anlegen läuft der Reihe nach - siehe `legeBlockAn`. */
  const anlegeKette = useRef<Promise<unknown>>(Promise.resolve())

  // Translated block type labels (computed once per render)
  const blockTypeLabels: Record<BlockType, string> = {
    scene_heading: tt(screenplayT.typeSceneHeading),
    action: tt(screenplayT.typeAction),
    character: tt(screenplayT.typeCharacter),
    dialogue: tt(screenplayT.typeDialogue),
    parenthetical: tt(screenplayT.typeParenthetical),
    transition: tt(screenplayT.typeTransition),
    note: tt(screenplayT.typeNote),
    super: tt(screenplayT.typeSuper),
    intercut: tt(screenplayT.typeIntercut),
    annotation: tt(screenplayT.typeAnnotation),
  }

  const blockTypeIcons: Record<BlockType, React.ElementType> = {
    scene_heading: Clapperboard,
    action: AlignLeft,
    character: User,
    dialogue: MessageSquare,
    parenthetical: Parentheses,
    transition: CornerUpRight,
    note: StickyNote,
    super: Type,
    intercut: Film,
    annotation: PenLine,
  }

  // ─── Data fetching ─────────────────────────────────────────────────────────

  const { data: scenesData, isLoading } = useQuery({
    queryKey: ['screenplay', pid],
    queryFn: () => api.screenplay.full(pid),
  })

  const { data: projectData } = useQuery({
    queryKey: ['project', pid],
    queryFn: () => api.projects.get(pid),
  })

  useEffect(() => {
    if (!scenesData) return
    // Ein Neuladen vom Server darf nicht über ungespeicherte Zeilen laufen.
    // Sonst steht nach dem Zurückkehren ins Fenster der halbe Satz wieder da,
    // den der Server kennt - und der eben getippte ist weg.
    if (offen.current.size > 0) return
    setzeSzenen(() => scenesData as SceneData[])
  }, [scenesData])

  // ─── Speichern ─────────────────────────────────────────────────────────────

  /** Die Kennung beim Server - `null`, solange die Antwort aussteht. */
  function echteId(blockId: number): number | null {
    if (blockId >= 0) return blockId
    return tempZuEcht.current.get(blockId) ?? null
  }

  /** Eine Änderung vormerken und nach kurzer Ruhe schicken. */
  function merkeAenderung(blockId: number, feld: Record<string, any>) {
    offen.current.set(blockId, { ...(offen.current.get(blockId) ?? {}), ...feld })
    setSaving(true)
    const alt = speicherUhren.current.get(blockId)
    if (alt) clearTimeout(alt)
    speicherUhren.current.set(blockId, setTimeout(() => {
      speicherUhren.current.delete(blockId)
      schicke(blockId)
    }, 500))
  }

  /**
   * Das Vorgemerkte zum Server bringen.
   *
   * Hat die Zeile noch keine Kennung, bleibt die Änderung liegen - das
   * Anlegen holt sie nach. Vorher ging genau das verloren: Was während der
   * Antwortzeit getippt wurde, hatte kein Ziel.
   */
  function schicke(blockId: number) {
    const daten = offen.current.get(blockId)
    if (!daten) { setSaving(offen.current.size > 0); return }
    const id = echteId(blockId)
    if (id === null) return
    offen.current.delete(blockId)
    updateBlockMutation.mutate({ blockId: id, data: daten }, {
      onSuccess: (antwort: any) => {
        // Eine geänderte Überschrift führt auf dem Server die Szene nach;
        // die Leiste links soll dasselbe zeigen, nicht den Gründungsstand.
        const szene = antwort?.szene
        if (!szene) return
        setzeSzenen(vorher => vorher.map(sd => (sd.scene.id === szene.id
          ? { ...sd, scene: { ...sd.scene, ...szene } }
          : sd)))
      },
      onError: (fehler: any) => {
        // Nicht stillschweigend verlieren: zurück in die Warteschlange, und
        // der Mensch erfährt, dass sein Satz noch nicht gesichert ist.
        offen.current.set(blockId, { ...daten, ...(offen.current.get(blockId) ?? {}) })
        toast({
          title: tt(screenplayT.errSave),
          description: fehler?.message || String(fehler),
          variant: 'destructive',
        })
      },
      onSettled: () => setSaving(offen.current.size > 0),
    })
  }

  // ─── Mutations ─────────────────────────────────────────────────────────────

  /**
   * Eine Zeile anlegen.
   *
   * Die Zeile steht sofort im Dokument, die Kennung kommt nach. Gemessen am
   * 24.10.2026 bei 1,2 Sekunden Antwortzeit: Vorher entstand die Zeile erst
   * mit der Antwort. Alles, was in dieser Sekunde getippt wurde, landete in
   * der vorigen Zeile, und der Schreibstrich sprang danach mitten im Satz
   * weg. Auf dem freien Plan von Render dauert eine Runde regelmäßig so
   * lange - dort war Weiterschreiben nach jedem Enter unmöglich.
   */
  const createBlockMutation = useMutation({
    mutationFn: ({ sceneId, data }: { tempId: number; sceneId: number; data: any }) =>
      api.screenplay.createBlock(sceneId, data),
    onSuccess: (newBlock: any, { tempId }) => {
      tempZuEcht.current.set(tempId, newBlock.id)

      // Vor der Antwort schon wieder gelöscht: dann auch beim Server weg.
      if (verworfen.current.has(tempId)) {
        verworfen.current.delete(tempId)
        offen.current.delete(tempId)
        deleteBlockMutation.mutate(newBlock.id)
        return
      }

      setzeSzenen(vorher => vorher.map(sd => ({
        ...sd,
        blocks: sd.blocks.map(b => (b.id === tempId
          // Der Inhalt bleibt der aus dem Browser: Während der Server
          // antwortete, ist weitergeschrieben worden.
          ? { ...b, id: newBlock.id, scene_id: newBlock.scene_id, project_id: newBlock.project_id }
          : b)),
      })))

      if (fokusWunsch.current?.id === tempId) {
        fokusWunsch.current = { ...fokusWunsch.current, id: newBlock.id }
      }
      if (aktiverBlockRef.current === tempId) waehle(newBlock.id)
      textareaRefs.current.delete(tempId)

      // Was in der Zwischenzeit getippt wurde, jetzt nachreichen.
      const liegengeblieben = offen.current.get(tempId)
      if (liegengeblieben) {
        offen.current.delete(tempId)
        offen.current.set(newBlock.id, liegengeblieben)
        schicke(newBlock.id)
      }
    },
    onError: (err: any, { tempId }) => {
      // Ohne Kennung steht die Zeile nur im Browser. Sie muss weg - sonst
      // schreibt jemand weiter in etwas, das nirgends ankommt.
      setzeSzenen(vorher => vorher.map(sd => ({ ...sd, blocks: sd.blocks.filter(b => b.id !== tempId) })))
      offen.current.delete(tempId)
      verworfen.current.delete(tempId)
      toast({ title: tt(screenplayT.errCreate), description: err?.message || String(err), variant: 'destructive' })
    },
  })

  /** Eine Zeile im Browser anlegen und dem Server nachmelden. */
  function legeBlockAn(
    sceneId: number, typ: BlockType, sortOrder: number, inhalt = '', stelle: Stelle = 'ende',
  ): number {
    const tempId = naechsteTempId.current--
    const neu: ScreenplayBlock = {
      id: tempId,
      scene_id: sceneId,
      project_id: pid,
      sort_order: sortOrder,
      block_type: typ,
      content: inhalt,
      annotation_color: '#f59e0b',
      created_at: '',
      updated_at: '',
      schluessel: `t${tempId}`,
    }
    setzeSzenen(vorher => vorher.map(sd => {
      if (sd.scene.id !== sceneId) return sd
      // Wie auf dem Server: Alles ab dem neuen Platz rutscht eins nach unten.
      const geschoben = sd.blocks.map(b =>
        b.sort_order >= sortOrder ? { ...b, sort_order: b.sort_order + 1 } : b
      )
      return { ...sd, blocks: [...geschoben, neu].sort((a, b) => a.sort_order - b.sort_order) }
    }))
    fokusWunsch.current = { id: tempId, stelle }
    // Nacheinander, nie gleichzeitig: Der Server schiebt beim Anlegen alle
    // folgenden Zeilen eins nach unten, das Ergebnis hängt also von der
    // Reihenfolge ab, in der die Anfragen ankommen. Gleichzeitig verschickte
    // Anfragen haben keine feste Ankunft. Gemessen am 24.10.2026: Drei Zeilen
    // mitten in eine Szene, Ankunft 1-3-2 statt 1-2-3 - die dritte landete
    // hinter dem Text, der vorher schon dastand. Beim Einfügen mehrerer
    // Zeilen gehen immer mehrere Anfragen auf einmal raus.
    anlegeKette.current = anlegeKette.current
      .then(() => createBlockMutation.mutateAsync({
        tempId, sceneId,
        data: { block_type: typ, content: inhalt, sort_order: sortOrder },
      }))
      // Den Fehler meldet die Mutation selbst; die Kette läuft weiter.
      .catch(() => {})
    return tempId
  }

  function platziere(el: HTMLTextAreaElement, stelle: Stelle) {
    el.focus()
    const pos = stelle === 'anfang' ? 0 : stelle === 'ende' ? el.value.length : stelle
    el.setSelectionRange(pos, pos)
  }

  /**
   * Den Schreibstrich in eine Zeile setzen - jetzt, oder sobald sie dasteht.
   *
   * Mit `inhalt` wartet er, bis die Zeile diesen Text zeigt. Ein Textfeld
   * übernimmt neuen Inhalt eine Runde später; wer vorher setzt, landet beim
   * Zusammenführen am Ende statt an der Nahtstelle.
   */
  function setzeSchreibstrich(id: number, stelle: Stelle, inhalt?: string) {
    const el = textareaRefs.current.get(id)
    if (el && (inhalt === undefined || el.value === inhalt)) {
      fokusWunsch.current = null
      platziere(el, stelle)
      waehle(id)
      return
    }
    fokusWunsch.current = { id, stelle, inhalt }
  }

  /** Den Schreibstrich setzen, sobald die gewünschte Zeile wirklich dasteht. */
  const handleBlockMounted = useCallback((blockId: number, el: HTMLTextAreaElement) => {
    const wunsch = fokusWunsch.current
    if (!wunsch || wunsch.id !== blockId) return
    if (wunsch.inhalt !== undefined && el.value !== wunsch.inhalt) return
    fokusWunsch.current = null
    platziere(el, wunsch.stelle)
    waehle(blockId)
  }, [])

  const updateBlockMutation = useMutation({
    mutationFn: ({ blockId, data }: { blockId: number; data: any }) =>
      api.screenplay.updateBlock(blockId, data),
  })

  // Die Zeile verschwindet schon beim Tastendruck aus dem Dokument; hier
  // bleibt nur die Meldung, falls der Server sie nicht loswird.
  const deleteBlockMutation = useMutation({
    mutationFn: (blockId: number) => api.screenplay.deleteBlock(blockId),
    onError: () => toast({ title: tt(screenplayT.errDelete), variant: 'destructive' }),
  })

  /** Eine Zeile entfernen - im Browser sofort, beim Server sobald möglich. */
  function entferneBlock(blockId: number) {
    const uhr = speicherUhren.current.get(blockId)
    if (uhr) { clearTimeout(uhr); speicherUhren.current.delete(blockId) }
    offen.current.delete(blockId)
    setSaving(offen.current.size > 0)
    setzeSzenen(vorher => vorher.map(sd => ({ ...sd, blocks: sd.blocks.filter(b => b.id !== blockId) })))
    const id = echteId(blockId)
    // Noch keine Kennung: Das Anlegen räumt sie weg, sobald es zurückkommt.
    if (id === null) { verworfen.current.add(blockId); return }
    deleteBlockMutation.mutate(id)
  }

  const createSceneMutation = useMutation({
    mutationFn: () =>
      // Die Nummer vergibt der Server - er kennt die höchste vergebene.
      api.scenes.create(pid, {
        title: 'Neue Szene',
        int_ext: 'INT',
        // TAG und NACHT sind die Werte, nach denen Drehplan und Statistik
        // filtern. Hier stand DAY - diese Szenen zählten nirgends mit.
        day_night: 'TAG',
        eighths: 8,
      }),
    onSuccess: (newScene: any) => {
      // Der Server legt die Überschrift gleich mit an und schickt sie mit.
      // Keine zweite Runde, kein Warten, kein leerer Aktionsblock.
      const bloecke: ScreenplayBlock[] = (newScene.blocks ?? []).map((b: any) => ({ ...b }))
      setzeSzenen(vorher => [...vorher, { scene: newScene, blocks: bloecke }])
      queryClient.invalidateQueries({ queryKey: ['scenes', pid] })
      if (bloecke.length > 0) fokusWunsch.current = { id: bloecke[0].id, stelle: 'ende' }
      // Nur das Scrollen braucht den fertigen Aufbau - der Schreibstrich nicht.
      setTimeout(() => sectionRefs.current.get(newScene.id)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
    },
    onError: () => toast({ title: tt(screenplayT.errScene), variant: 'destructive' }),
  })

  const importFdxMutation = useMutation({
    mutationFn: ({ xml, filename }: { xml: string; filename: string }) =>
      api.screenplay.importFdx(pid, xml, filename),
    onSuccess: (result: any) => {
      toast({
        title: tt(screenplayT.importSuccess),
        description: tt(screenplayT.scenesCreated)
          .replace('{n}', result.scenes_created)
          .replace('{b}', result.blocks_created),
      })
      queryClient.invalidateQueries({ queryKey: ['screenplay', pid] })
      queryClient.invalidateQueries({ queryKey: ['scenes', pid] })
    },
    onError: (err: any) => toast({
      title: tt(screenplayT.errImport),
      description: err?.message,
      variant: 'destructive',
    }),
  })

  // ─── Block operations ──────────────────────────────────────────────────────

  const handleContentChange = useCallback((blockId: number, content: string) => {
    setzeSzenen(vorher => vorher.map(sd => ({
      ...sd,
      blocks: sd.blocks.map(b => (b.id === blockId ? { ...b, content } : b)),
    })))
    merkeAenderung(blockId, { content })
  }, [])

  const handleTypeChange = useCallback((blockId: number, type: BlockType) => {
    setzeSzenen(vorher => vorher.map(sd => ({
      ...sd,
      blocks: sd.blocks.map(b => (b.id === blockId ? { ...b, block_type: type } : b)),
    })))
    merkeAenderung(blockId, { block_type: type })
  }, [])

  /**
   * Enter.
   *
   * Am Zeilenende eine neue Zeile mit dem Folgetyp. Mitten im Satz wird die
   * Zeile geteilt: Was hinter dem Schreibstrich steht, wandert in eine neue
   * Zeile gleichen Typs. Gemessen am 24.10.2026: Vorher blieb der Satz ganz,
   * und darunter erschien eine leere Zeile.
   *
   * Eine Überschrift wird nicht geteilt - sie ist eine Zeile für sich.
   */
  const handleEnterKey = useCallback((blockId: number, von: number, bis: number) => {
    let szene: SceneData | undefined
    let block: ScreenplayBlock | undefined
    for (const sd of szenenRef.current) {
      const b = sd.blocks.find(x => x.id === blockId)
      if (b) { szene = sd; block = b; break }
    }
    if (!szene || !block) return

    const hinten = block.content.slice(bis)
    if (!hinten || block.block_type === 'scene_heading') {
      legeBlockAn(szene.scene.id, ENTER_NEXT_TYPE[block.block_type], block.sort_order + 1)
      return
    }
    handleContentChange(blockId, block.content.slice(0, von))
    legeBlockAn(szene.scene.id, block.block_type, block.sort_order + 1, hinten, 'anfang')
  }, [handleContentChange])

  /**
   * Eingefügte Zeilen verteilen.
   *
   * Die erste kommt an die Schreibstelle der aktuellen Zeile, jede weitere
   * wird eine eigene - mit dem Typ, den Enter an dieser Stelle erzeugt
   * hätte. Was hinter der Schreibstelle stand, hängt hinter der letzten.
   */
  const handlePasteLines = useCallback((blockId: number, vorn: string, zeilen: string[], hinten: string) => {
    let szene: SceneData | undefined
    let block: ScreenplayBlock | undefined
    for (const sd of szenenRef.current) {
      const b = sd.blocks.find(x => x.id === blockId)
      if (b) { szene = sd; block = b; break }
    }
    if (!szene || !block) return

    if (zeilen.length === 1) {
      handleContentChange(blockId, vorn + zeilen[0] + hinten)
      return
    }

    handleContentChange(blockId, vorn + zeilen[0])
    let typ = block.block_type
    let platz = block.sort_order
    zeilen.slice(1).forEach((zeile, i) => {
      typ = ENTER_NEXT_TYPE[typ]
      platz += 1
      const letzte = i === zeilen.length - 2
      legeBlockAn(szene!.scene.id, typ, platz, letzte ? zeile + hinten : zeile)
    })
  }, [handleContentChange])

  /** Die Zeile vor dieser in derselben Szene - so, wie der Editor sie zeigt. */
  function vorigeInSzene(blockId: number): { vorige: ScreenplayBlock | null; diese: ScreenplayBlock | null } {
    for (const sd of szenenRef.current) {
      const folge = zeilenFolge(sd.blocks)
      const i = folge.findIndex(b => b.id === blockId)
      if (i !== -1) return { vorige: i > 0 ? folge[i - 1] : null, diese: folge[i] }
    }
    return { vorige: null, diese: null }
  }

  const handleBackspaceEmpty = useCallback((blockId: number) => {
    const { vorige } = vorigeInSzene(blockId)
    if (!vorige) return
    entferneBlock(blockId)
    setzeSchreibstrich(vorige.id, 'ende')
  }, [])

  /**
   * Rücktaste am Anfang einer Zeile, die nicht leer ist.
   *
   * Hängt die Zeile an die vorige - das Gegenstück zum Teilen mit Enter.
   * Gemessen am 24.10.2026: Vorher geschah nichts. In eine Überschrift wird
   * nichts hineingezogen, und eine Überschrift wandert nirgendwohin.
   */
  const handleBackspaceStart = useCallback((blockId: number) => {
    const { vorige, diese } = vorigeInSzene(blockId)
    if (!vorige || !diese) return
    if (vorige.block_type === 'scene_heading' || diese.block_type === 'scene_heading') {
      setzeSchreibstrich(vorige.id, 'ende')
      return
    }
    const naht = vorige.content.length
    const zusammen = vorige.content + diese.content
    handleContentChange(vorige.id, zusammen)
    entferneBlock(blockId)
    setzeSchreibstrich(vorige.id, naht, zusammen)
  }, [handleContentChange])

  /** Pfeil hoch oder runter über den Zeilenrand - auch in die nächste Szene. */
  const handleArrow = useCallback((blockId: number, richtung: -1 | 1) => {
    const alle = szenenRef.current.flatMap(sd => zeilenFolge(sd.blocks))
    const i = alle.findIndex(b => b.id === blockId)
    const ziel = alle[i + richtung]
    if (i === -1 || !ziel) return
    setzeSchreibstrich(ziel.id, richtung < 0 ? 'ende' : 'anfang')
  }, [])

  const handleTabKey = useCallback((blockId: number, shift: boolean) => {
    let foundBlock: ScreenplayBlock | undefined
    for (const sd of szenenRef.current) {
      foundBlock = sd.blocks.find(b => b.id === blockId)
      if (foundBlock) break
    }
    if (!foundBlock) return
    // Die Überschrift trägt die Szene - INT/EXT, Motiv, Tageszeit, Nummer.
    // Tab machte bis zum 24.10.2026 eine Aktionszeile daraus, und die Szene
    // stand danach mit doppelter Kopfzeile im Export.
    if (foundBlock.block_type === 'scene_heading') return
    const currentIdx = TAB_CYCLE.indexOf(foundBlock.block_type)
    let nextIdx: number
    if (currentIdx === -1) {
      nextIdx = 0
    } else if (shift) {
      nextIdx = (currentIdx - 1 + TAB_CYCLE.length) % TAB_CYCLE.length
    } else {
      nextIdx = (currentIdx + 1) % TAB_CYCLE.length
    }
    handleTypeChange(blockId, TAB_CYCLE[nextIdx])
  }, [handleTypeChange])

  // ─── FDX Import ───────────────────────────────────────────────────────────

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      importFdxMutation.mutate({ xml: content, filename: file.name })
    }
    reader.readAsText(file, 'utf-8')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ─── Annotation color change ──────────────────────────────────────────────

  const handleAnnotationColorChange = useCallback((blockId: number, color: string) => {
    setzeSzenen(vorher => vorher.map(sd => ({
      ...sd,
      blocks: sd.blocks.map(b => (b.id === blockId ? { ...b, annotation_color: color } : b)),
    })))
    merkeAenderung(blockId, { annotation_color: color })
  }, [])

  // ─── Erster Block einer Szene ohne Überschrift ────────────────────────────

  /**
   * Die Kopfzeile, die bisher nur gezeichnet war, wird zur echten Zeile.
   *
   * Vorher entstand hier ein leerer Aktionsblock. Danach galt die Szene als
   * "hat Blöcke" und fiel im Export ohne INT/EXT und ohne Titel heraus.
   */
  const handleCreateFirstBlock = useCallback((sceneId: number) => {
    const sd = szenenRef.current.find(s => s.scene.id === sceneId)
    if (!sd) return
    legeBlockAn(sceneId, 'scene_heading', 0, ueberschriftAusSzene(sd.scene))
  }, [])

  // ─── Character suffix insert ───────────────────────────────────────────────

  function insertCharSuffix(suffix: string) {
    if (!activeBlockId) return
    const block = szenenRef.current.flatMap(sd => sd.blocks).find(b => b.id === activeBlockId)
    if (!block || block.block_type !== 'character') return
    const base = block.content.replace(/\s*\(.*?\)\s*$/, '').trim()
    const newContent = `${base} (${suffix})`
    handleContentChange(activeBlockId, newContent)
  }

  // ─── Active block data ────────────────────────────────────────────────────

  const activeBlock = activeBlockId
    ? localScenes.flatMap(sd => sd.blocks).find(b => b.id === activeBlockId)
    : null

  // ─── Scene navigation ─────────────────────────────────────────────────────

  function scrollToScene(sceneId: number) {
    const el = sectionRefs.current.get(sceneId)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // Am Telefon verdeckt die Leiste sonst genau die Szene, zu der man wollte
    setScenesOpen(false)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden">
      {scenesOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setScenesOpen(false)} aria-hidden />
      )}

      {/* Left: Scene Navigator. Ab md eine Spalte, darunter eine Schublade -
          220 px fest daneben liessen dem Text am Telefon 123 px. */}
      <aside className={cn(
        'flex-col border-r border-border/40 bg-card overflow-hidden',
        'md:flex md:static md:w-[220px] md:shrink-0 md:shadow-none md:z-auto',
        scenesOpen ? 'flex fixed inset-y-0 left-0 z-50 w-[260px] shadow-2xl' : 'hidden',
      )}>
        <div className="px-3 py-3 border-b border-border/40">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1">
            {tt(screenplayT.scenes)}
          </p>
          <p className="text-xs text-muted-foreground">{localScenes.length} {tt(screenplayT.scenes).toLowerCase()}</p>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {isLoading ? (
            <div className="p-3 space-y-1.5">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-8" />)}
            </div>
          ) : localScenes.length === 0 ? (
            <div className="p-4 text-center">
              <Film className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">{tt(screenplayT.noScenes)}</p>
            </div>
          ) : (
            localScenes.map((sd, i) => (
              <button
                key={sd.scene.id}
                onClick={() => scrollToScene(sd.scene.id)}
                className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors group flex items-start gap-2"
              >
                <span className="text-[10px] font-mono text-muted-foreground/50 shrink-0 w-5 mt-0.5">
                  {sd.scene.scene_number || i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate leading-tight">
                    {sd.scene.title || 'Untitled'}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {sd.scene.int_ext} · {sd.scene.day_night} · {sd.blocks.length} {tt(screenplayT.blocks)}
                  </p>
                </div>
                <ChevronRight className="w-3 h-3 text-muted-foreground/30 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))
          )}
        </div>

        <div className="p-2 border-t border-border/40">
          <Button
            variant="outline"
            size="sm"
            className="w-full h-7 text-xs"
            onClick={() => createSceneMutation.mutate()}
            disabled={createSceneMutation.isPending}
          >
            <Plus className="w-3 h-3 mr-1.5" />
            {tt(screenplayT.newScene)}
          </Button>
        </div>
      </aside>

      {/* Right: Editor area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 shrink-0 bg-card flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden h-7 text-xs gap-1.5"
            onClick={() => setScenesOpen(true)}
            aria-label="Szenenliste öffnen"
          >
            <ListTree className="w-3.5 h-3.5" />
            {tt(screenplayT.scenes)}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => navigate(`/projects/${pid}/drehbuch`)}
          >
            <ArrowLeft className="w-3 h-3" />
            {tt(screenplayT.sceneOverview)}
          </Button>

          <div className="h-4 w-px bg-border/60" />

          {/* Block type selector */}
          {(() => {
            const ActiveIcon = activeBlock ? blockTypeIcons[activeBlock.block_type] : AlignLeft
            const activeLabel = activeBlock ? blockTypeLabels[activeBlock.block_type] : '-'
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-44 text-xs justify-start gap-2 font-normal"
                    // Eine Überschrift wechselt den Typ nicht - neue Szenen
                    // entstehen über "Neue Szene".
                    disabled={activeBlock?.block_type === 'scene_heading'}
                  >
                    <ActiveIcon className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1 text-left">{activeLabel}</span>
                    <ChevronDown className="w-3 h-3 opacity-40 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                {activeBlock && (
                  <DropdownMenuContent align="start" className="w-44">
                    {(Object.keys(blockTypeLabels) as BlockType[])
                      // Eine zweite Überschrift mitten in der Szene ist keine
                      // neue Szene - nur eine Zeile, die so aussieht.
                      .filter(type => type !== 'scene_heading')
                      .map(type => {
                      const Icon = blockTypeIcons[type]
                      return (
                        <DropdownMenuItem
                          key={type}
                          className={cn(
                            'text-xs gap-2 cursor-pointer',
                            activeBlock.block_type === type && 'bg-accent'
                          )}
                          onClick={() => handleTypeChange(activeBlock.id, type)}
                        >
                          <Icon className="w-3 h-3 text-muted-foreground" />
                          {blockTypeLabels[type]}
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                )}
              </DropdownMenu>
            )
          })()}

          {/* Character suffix picker (only when character block is active) */}
          {activeBlock?.block_type === 'character' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                  <User className="w-3 h-3" />
                  {tt(screenplayT.charSuffix)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="text-xs">
                <DropdownMenuItem className="text-xs text-muted-foreground cursor-pointer" onClick={() => {
                  const base = activeBlock.content.replace(/\s*\(.*?\)\s*$/, '').trim()
                  handleContentChange(activeBlock.id, base)
                }}>
                  {tt(screenplayT.none)}
                </DropdownMenuItem>
                {CHAR_SUFFIXES.map(s => (
                  <DropdownMenuItem key={s} className="text-xs font-mono cursor-pointer" onClick={() => insertCharSuffix(s)}>
                    ({s})
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Transition picker (only when transition block is active) */}
          {activeBlock?.block_type === 'transition' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                  <CornerUpRight className="w-3 h-3" />
                  {tt(screenplayT.transition)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="text-xs">
                {TRANSITIONS.map(t => (
                  <DropdownMenuItem key={t} className="text-xs font-mono cursor-pointer"
                    onClick={() => handleContentChange(activeBlock.id, t)}>
                    {t}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Annotation color picker (only when annotation block is active) */}
          {activeBlock?.block_type === 'annotation' && (
            <div className="flex items-center gap-1.5 pl-1">
              <PenLine className="w-3 h-3 text-muted-foreground/50" />
              {ANNOTATION_COLORS.map(color => (
                <button
                  key={color}
                  title={color}
                  className={cn(
                    'w-4 h-4 rounded-full border-2 transition-all active:scale-90',
                    activeBlock.annotation_color === color
                      ? 'border-foreground scale-110'
                      : 'border-transparent hover:scale-110'
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => handleAnnotationColorChange(activeBlock.id, color)}
                />
              ))}
            </div>
          )}

          <div className="flex-1" />

          <SaveStatus saving={saving} tt={tt} />

          <div className="h-4 w-px bg-border/60" />

          {/* FDX Import */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".fdx,.celtx,.fountain,.txt,.xml"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => fileInputRef.current?.click()}
            disabled={importFdxMutation.isPending}
          >
            {importFdxMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            {tt(screenplayT.importFdx)}
          </Button>

          {/* Export dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                <Download className="w-3 h-3" />
                {tt(screenplayT.exportPdf)}
                <ChevronDown className="w-3 h-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs">
              <DropdownMenuItem
                className="text-xs cursor-pointer gap-2"
                onClick={() => download(api.pdf.screenplay(pid), 'drehbuch.pdf')}
              >
                <FileText className="w-3 h-3" />
                {tt(screenplayT.exportPdf)}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs cursor-pointer gap-2"
                onClick={() => download(api.pdf.screenplayWithNotes(pid), 'drehbuch-mit-notizen.pdf')}
              >
                <PenLine className="w-3 h-3" />
                {tt(screenplayT.exportPdfNotes)}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs cursor-pointer"
                onClick={() => download(api.screenplayIO.fountainExportUrl(pid), 'drehbuch.fountain')}
              >
                <Download className="w-3 h-3 mr-2" />
                {tt(screenplayT.exportFountain)}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Screenplay editor canvas */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="max-w-2xl mx-auto px-8 py-12 space-y-4">
              {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-5" style={{ width: `${60 + Math.random() * 40}%` }} />)}
            </div>
          ) : localScenes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Film className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-sm font-medium mb-1">{tt(screenplayT.noScenes)}</p>
              <p className="text-xs mb-4">{tt(screenplayT.noScenesDesc)}</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => createSceneMutation.mutate()}>
                  <Plus className="w-3.5 h-3.5 mr-1.5" />{tt(screenplayT.newScene)}
                </Button>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-3.5 h-3.5 mr-1.5" />{tt(screenplayT.importFdx)}
                </Button>
              </div>
            </div>
          ) : (
            <div
              className="max-w-2xl mx-auto px-16 py-12 xl:px-24"
              onClick={() => waehle(null)}
            >
              {/* Screenplay title */}
              <div className="text-center mb-12">
                <p className="font-mono text-xs text-muted-foreground/50 uppercase tracking-widest">
                  {tt(screenplayT.script)}
                </p>
                {(projectData as any)?.title && (
                  <p className="font-mono text-base font-bold uppercase mt-1 tracking-wide">
                    {(projectData as any).title}
                  </p>
                )}
              </div>

              {localScenes.map((sd, i) => (
                <SceneSection
                  key={sd.scene.id}
                  sceneData={sd}
                  sceneIndex={i}
                  activeBlockId={activeBlockId}
                  setActiveBlockId={waehle}
                  onContentChange={handleContentChange}
                  onTypeChange={handleTypeChange}
                  onEnterKey={handleEnterKey}
                  onBackspaceEmpty={handleBackspaceEmpty}
                  onBackspaceStart={handleBackspaceStart}
                  onArrow={handleArrow}
                  onTabKey={handleTabKey}
                  onPasteLines={handlePasteLines}
                  onCreateFirstBlock={handleCreateFirstBlock}
                  textareaRefs={textareaRefs}
                  onBlockMounted={handleBlockMounted}
                  sectionRef={el => {
                    if (el) sectionRefs.current.set(sd.scene.id, el)
                    else sectionRefs.current.delete(sd.scene.id)
                  }}
                  blockTypeLabels={blockTypeLabels}
                />
              ))}

              <div className="h-48" />
            </div>
          )}
        </div>

        {/* Keyboard hints */}
        <div className="px-4 py-1.5 border-t border-border/30 bg-muted/30 flex flex-wrap items-center gap-x-4 gap-y-1 shrink-0">
          <span className="text-[10px] text-muted-foreground/50">
            <kbd className="bg-muted px-1 rounded text-[9px] mr-1">Enter</kbd>{tt(screenplayT.hintEnter)}
          </span>
          <span className="text-[10px] text-muted-foreground/50">
            <kbd className="bg-muted px-1 rounded text-[9px] mr-1">Tab</kbd>{tt(screenplayT.hintTab)}
          </span>
          <span className="text-[10px] text-muted-foreground/50">
            <kbd className="bg-muted px-1 rounded text-[9px] mr-1">⌫</kbd>{tt(screenplayT.hintBackspace)}
          </span>
        </div>
      </div>
    </div>
  )
}
