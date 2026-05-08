import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/useT'
import { screenplayT } from '@/lib/i18n'
import {
  ArrowLeft, Plus, Upload, FileText, ChevronRight, Film,
  AlignLeft, User, MessageSquare, Parentheses, CornerUpRight, StickyNote,
  Clapperboard, CheckCircle2, Loader2, Download, Type,
} from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
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

interface ScreenplayBlock {
  id: number
  scene_id: number
  project_id: number
  sort_order: number
  block_type: BlockType
  content: string
  created_at: string
  updated_at: string
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
}

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
  }
}

// ─── CONT'D / MORE detection ──────────────────────────────────────────────────

/** Returns a set of block IDs that should show (CONT'D) beside their content. */
function detectContd(blocks: ScreenplayBlock[]): Set<number> {
  const result = new Set<number>()
  for (let i = 2; i < blocks.length; i++) {
    const cur = blocks[i]
    const prev = blocks[i - 1]
    const prev2 = blocks[i - 2]
    // Pattern: character → dialogue/parenthetical → [action/note] → character (same name)
    if (
      cur.block_type === 'character' &&
      (prev.block_type === 'action' || prev.block_type === 'note' || prev.block_type === 'transition') &&
      (prev2.block_type === 'dialogue' || prev2.block_type === 'parenthetical')
    ) {
      // Find the character block above this dialogue chain
      let j = i - 2
      while (j > 0 && (blocks[j].block_type === 'dialogue' || blocks[j].block_type === 'parenthetical')) j--
      if (blocks[j].block_type === 'character') {
        const prevCharName = blocks[j].content.replace(/\s*\(.*?\)\s*$/, '').trim()
        const curCharName = cur.content.replace(/\s*\(.*?\)\s*$/, '').trim()
        if (prevCharName && curCharName && prevCharName.toUpperCase() === curCharName.toUpperCase()) {
          result.add(cur.id)
        }
      }
    }
  }
  return result
}

/** Returns a set of block IDs (dialogue) that should show (MORE) below them. */
function detectMore(blocks: ScreenplayBlock[]): Set<number> {
  const result = new Set<number>()
  for (let i = 0; i < blocks.length - 1; i++) {
    const cur = blocks[i]
    const next = blocks[i + 1]
    if (
      cur.block_type === 'dialogue' &&
      (next.block_type === 'action' || next.block_type === 'transition' || next.block_type === 'note')
    ) {
      // Check if the character speaks again (CONT'D pattern) after the action
      let j = i + 1
      while (j < blocks.length && (blocks[j].block_type === 'action' || blocks[j].block_type === 'note' || blocks[j].block_type === 'transition')) j++
      if (j < blocks.length && blocks[j].block_type === 'character') {
        const charAboveIdx = (() => {
          let k = i
          while (k > 0 && (blocks[k].block_type === 'dialogue' || blocks[k].block_type === 'parenthetical')) k--
          return k
        })()
        if (blocks[charAboveIdx].block_type === 'character') {
          const prevCharName = blocks[charAboveIdx].content.replace(/\s*\(.*?\)\s*$/, '').trim()
          const nextCharName = blocks[j].content.replace(/\s*\(.*?\)\s*$/, '').trim()
          if (prevCharName && nextCharName && prevCharName.toUpperCase() === nextCharName.toUpperCase()) {
            result.add(cur.id)
          }
        }
      }
    }
  }
  return result
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
  showContd: boolean
  showMore: boolean
  sceneNumber?: string
  onFocus: () => void
  onContentChange: (id: number, content: string) => void
  onTypeChange: (id: number, type: BlockType) => void
  onEnterKey: (id: number, atEnd: boolean) => void
  onBackspaceEmpty: (id: number) => void
  onTabKey: (id: number, shift: boolean) => void
  textareaRef: (el: HTMLTextAreaElement | null) => void
  blockTypeLabel: string
}

function BlockEditor({
  block,
  isActive,
  showContd,
  showMore,
  sceneNumber,
  onFocus,
  onContentChange,
  onTypeChange,
  onEnterKey,
  onBackspaceEmpty,
  onTabKey,
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
    const val = e.target.value.replace(/\n/g, '')
    setLocalContent(val)
    onContentChange(block.id, val)
    autoResize(e.target)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const el = e.currentTarget
      const atEnd = el.selectionStart === el.value.length
      onEnterKey(block.id, atEnd)
      return
    }
    if (e.key === 'Backspace' && localContent === '') {
      e.preventDefault()
      onBackspaceEmpty(block.id)
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      onTabKey(block.id, e.shiftKey)
      return
    }
  }

  function handleRef(el: HTMLTextAreaElement | null) {
    textareaRef(el)
    if (el) autoResize(el)
  }

  const placeholder =
    block.block_type === 'scene_heading' ? 'INT. LOCATION – DAY'
    : block.block_type === 'character' ? 'CHARACTER'
    : block.block_type === 'parenthetical' ? '(action)'
    : block.block_type === 'transition' ? 'CUT TO:'
    : block.block_type === 'note' ? 'Note…'
    : block.block_type === 'dialogue' ? 'Dialogue…'
    : block.block_type === 'super' ? 'SUPER: "TEXT"'
    : block.block_type === 'intercut' ? 'INTERCUT WITH:'
    : 'Action…'

  return (
    <div
      className={cn(
        'group relative rounded transition-colors',
        getBlockContainerStyle(block.block_type),
        isActive && 'bg-primary/3'
      )}
      onClick={onFocus}
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

      {/* Character name with CONT'D indicator */}
      {block.block_type === 'character' && showContd && localContent && (
        <span className="block text-center font-mono text-[11px] text-muted-foreground/50 -mb-1 uppercase tracking-wide select-none">
          {localContent.replace(/\s*\(.*?\)\s*$/, '')} <span className="opacity-70">(CONT'D)</span>
        </span>
      )}

      <textarea
        ref={handleRef}
        value={localContent}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        rows={1}
        className={cn(
          getBlockStyle(block.block_type),
          'min-h-[1.5rem] overflow-hidden focus:ring-0 focus:outline-none',
          block.block_type === 'character' && showContd && 'opacity-0 absolute pointer-events-none h-0 min-h-0'
        )}
        placeholder={localContent ? '' : placeholder}
        spellCheck
      />

      {/* When CONT'D is shown, render editable overlay */}
      {block.block_type === 'character' && showContd && (
        <textarea
          ref={el => {
            if (el) {
              textareaRef(el)
              autoResize(el)
            }
          }}
          value={localContent}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={onFocus}
          rows={1}
          className={cn(
            getBlockStyle(block.block_type),
            'min-h-[1.5rem] overflow-hidden focus:ring-0 focus:outline-none'
          )}
          placeholder={placeholder}
          spellCheck
        />
      )}

      {/* MORE indicator below dialogue */}
      {showMore && (
        <div className="text-center mt-0.5">
          <span className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-wider select-none">
            (MORE)
          </span>
        </div>
      )}
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
  onEnterKey: (blockId: number, atEnd: boolean) => void
  onBackspaceEmpty: (blockId: number) => void
  onTabKey: (blockId: number, shift: boolean) => void
  textareaRefs: React.MutableRefObject<Map<number, HTMLTextAreaElement>>
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
  onTabKey,
  textareaRefs,
  sectionRef,
  blockTypeLabels,
}: SceneSectionProps) {
  const { scene, blocks } = sceneData

  const displayBlocks = blocks.filter(b => b.block_type !== 'scene_heading')
  const headingBlock = blocks.find(b => b.block_type === 'scene_heading')
  const allBlocks = headingBlock ? [headingBlock, ...displayBlocks] : displayBlocks

  const contdBlocks = detectContd(allBlocks)
  const moreBlocks = detectMore(allBlocks)

  return (
    <div ref={sectionRef} className="mb-12" data-scene-id={scene.id}>
      {!headingBlock && (
        <div className="mt-8 mb-1 pt-3 border-t border-border/30 relative">
          <span className="absolute -left-8 top-3.5 text-[10px] font-mono text-muted-foreground/40 select-none">
            {scene.scene_number}.
          </span>
          <p className="font-mono text-sm font-bold uppercase text-foreground">
            {scene.int_ext}. {scene.title} – {scene.day_night}
          </p>
        </div>
      )}

      {allBlocks.map(block => (
        <BlockEditor
          key={block.id}
          block={block}
          isActive={activeBlockId === block.id}
          showContd={contdBlocks.has(block.id)}
          showMore={moreBlocks.has(block.id)}
          sceneNumber={block.block_type === 'scene_heading' ? scene.scene_number : undefined}
          onFocus={() => setActiveBlockId(block.id)}
          onContentChange={onContentChange}
          onTypeChange={onTypeChange}
          onEnterKey={onEnterKey}
          onBackspaceEmpty={onBackspaceEmpty}
          onTabKey={onTabKey}
          textareaRef={el => {
            if (el) textareaRefs.current.set(block.id, el)
            else textareaRefs.current.delete(block.id)
          }}
          blockTypeLabel={blockTypeLabels[block.block_type]}
        />
      ))}
    </div>
  )
}

// ─── Fountain export ──────────────────────────────────────────────────────────

function exportFountain(localScenes: SceneData[], projectTitle: string): string {
  const lines: string[] = []
  lines.push(`Title: ${projectTitle}`)
  lines.push('')

  for (const sd of localScenes) {
    for (const block of sd.blocks) {
      switch (block.block_type) {
        case 'scene_heading':
          lines.push('', block.content.toUpperCase(), '')
          break
        case 'action':
          lines.push(block.content, '')
          break
        case 'character':
          lines.push(block.content.toUpperCase())
          break
        case 'dialogue':
          lines.push(block.content, '')
          break
        case 'parenthetical':
          lines.push(block.content.startsWith('(') ? block.content : `(${block.content})`)
          break
        case 'transition':
          lines.push('', `> ${block.content}`, '')
          break
        case 'note':
          lines.push(`[[ ${block.content} ]]`, '')
          break
        case 'super':
          lines.push(`SUPER: "${block.content}"`, '')
          break
        case 'intercut':
          lines.push('', `INTERCUT WITH:`, block.content || '', '')
          break
      }
    }
  }
  return lines.join('\n')
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const tt = useT()

  const [activeBlockId, setActiveBlockId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [localScenes, setLocalScenes] = useState<SceneData[]>([])

  const textareaRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map())
  const sectionRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const pendingSaves = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    if (scenesData) setLocalScenes(scenesData as SceneData[])
  }, [scenesData])

  // ─── Mutations ─────────────────────────────────────────────────────────────

  const createBlockMutation = useMutation({
    mutationFn: ({ sceneId, data }: { sceneId: number; data: any }) =>
      api.screenplay.createBlock(sceneId, data),
    onSuccess: (newBlock) => {
      setLocalScenes(prev =>
        prev.map(sd =>
          sd.scene.id === newBlock.scene_id
            ? { ...sd, blocks: [...sd.blocks, newBlock].sort((a, b) => a.sort_order - b.sort_order) }
            : sd
        )
      )
      setTimeout(() => {
        const el = textareaRefs.current.get(newBlock.id)
        if (el) { el.focus(); setActiveBlockId(newBlock.id) }
      }, 50)
    },
    onError: () => toast({ title: tt(screenplayT.errCreate), variant: 'destructive' }),
  })

  const updateBlockMutation = useMutation({
    mutationFn: ({ blockId, data }: { blockId: number; data: any }) =>
      api.screenplay.updateBlock(blockId, data),
  })

  const deleteBlockMutation = useMutation({
    mutationFn: (blockId: number) => api.screenplay.deleteBlock(blockId),
    onSuccess: (_, blockId) => {
      setLocalScenes(prev =>
        prev.map(sd => ({ ...sd, blocks: sd.blocks.filter(b => b.id !== blockId) }))
      )
    },
    onError: () => toast({ title: tt(screenplayT.errDelete), variant: 'destructive' }),
  })

  const createSceneMutation = useMutation({
    mutationFn: () =>
      api.scenes.create(pid, {
        scene_number: String((localScenes.length || 0) + 1),
        title: 'New Scene',
        int_ext: 'INT',
        day_night: 'DAY',
        eighths: 8,
      }),
    onSuccess: (newScene) => {
      const newSceneData: SceneData = { scene: newScene, blocks: [] }
      setLocalScenes(prev => [...prev, newSceneData])
      queryClient.invalidateQueries({ queryKey: ['scenes', pid] })
      setTimeout(() => {
        const el = sectionRefs.current.get(newScene.id)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        createBlockMutation.mutate({
          sceneId: newScene.id,
          data: { block_type: 'scene_heading', content: 'INT. NEW SCENE – DAY', sort_order: 0 },
        })
      }, 100)
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

  function scheduleSave(blockId: number, content: string) {
    setSaving(true)
    const existing = pendingSaves.current.get(blockId)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      updateBlockMutation.mutate(
        { blockId, data: { content } },
        { onSettled: () => setSaving(false) }
      )
      pendingSaves.current.delete(blockId)
    }, 500)
    pendingSaves.current.set(blockId, timer)
  }

  const handleContentChange = useCallback((blockId: number, content: string) => {
    setLocalScenes(prev =>
      prev.map(sd => ({
        ...sd,
        blocks: sd.blocks.map(b => (b.id === blockId ? { ...b, content } : b)),
      }))
    )
    scheduleSave(blockId, content)
  }, [])

  const handleTypeChange = useCallback((blockId: number, type: BlockType) => {
    setLocalScenes(prev =>
      prev.map(sd => ({
        ...sd,
        blocks: sd.blocks.map(b => (b.id === blockId ? { ...b, block_type: type } : b)),
      }))
    )
    updateBlockMutation.mutate({ blockId, data: { block_type: type } })
  }, [])

  const handleEnterKey = useCallback((blockId: number, _atEnd: boolean) => {
    let foundScene: SceneData | undefined
    let foundBlock: ScreenplayBlock | undefined

    for (const sd of localScenes) {
      const idx = sd.blocks.findIndex(b => b.id === blockId)
      if (idx !== -1) {
        foundScene = sd
        foundBlock = sd.blocks[idx]
        break
      }
    }
    if (!foundScene || !foundBlock) return

    const nextType = ENTER_NEXT_TYPE[foundBlock.block_type]
    const newSortOrder = foundBlock.sort_order + 0.5
    createBlockMutation.mutate({
      sceneId: foundScene.scene.id,
      data: { block_type: nextType, content: '', sort_order: newSortOrder },
    })
  }, [localScenes])

  const handleBackspaceEmpty = useCallback((blockId: number) => {
    let prevBlockId: number | null = null
    for (const sd of localScenes) {
      const idx = sd.blocks.findIndex(b => b.id === blockId)
      if (idx !== -1) {
        if (idx > 0) prevBlockId = sd.blocks[idx - 1].id
        break
      }
    }
    if (prevBlockId === null) return
    deleteBlockMutation.mutate(blockId)
    setTimeout(() => {
      const el = textareaRefs.current.get(prevBlockId!)
      if (el) {
        el.focus()
        setActiveBlockId(prevBlockId!)
        el.setSelectionRange(el.value.length, el.value.length)
      }
    }, 50)
  }, [localScenes])

  const handleTabKey = useCallback((blockId: number, shift: boolean) => {
    let foundBlock: ScreenplayBlock | undefined
    for (const sd of localScenes) {
      foundBlock = sd.blocks.find(b => b.id === blockId)
      if (foundBlock) break
    }
    if (!foundBlock) return
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
  }, [localScenes, handleTypeChange])

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

  // ─── Fountain export ───────────────────────────────────────────────────────

  function handleFountainExport() {
    const title = (projectData as any)?.title || 'screenplay'
    const text = exportFountain(localScenes, title)
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.fountain`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─── Character suffix insert ───────────────────────────────────────────────

  function insertCharSuffix(suffix: string) {
    if (!activeBlockId) return
    const block = localScenes.flatMap(sd => sd.blocks).find(b => b.id === activeBlockId)
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
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Scene Navigator */}
      <aside className="w-[220px] shrink-0 flex flex-col border-r border-border/40 bg-card overflow-hidden">
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
            className="h-7 text-xs gap-1.5"
            onClick={() => navigate(`/projects/${pid}/drehbuch`)}
          >
            <ArrowLeft className="w-3 h-3" />
            {tt(screenplayT.sceneOverview)}
          </Button>

          <div className="h-4 w-px bg-border/60" />

          {/* Block type selector */}
          {activeBlock && (
            <Select
              value={activeBlock.block_type}
              onValueChange={(v) => handleTypeChange(activeBlock.id, v as BlockType)}
            >
              <SelectTrigger className="h-7 w-44 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(blockTypeLabels) as BlockType[]).map(type => {
                  const Icon = blockTypeIcons[type]
                  return (
                    <SelectItem key={type} value={type} className="text-xs">
                      <span className="flex items-center gap-2">
                        <Icon className="w-3 h-3 text-muted-foreground" />
                        {blockTypeLabels[type]}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          )}

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
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs">
              <DropdownMenuItem asChild className="text-xs cursor-pointer">
                <a href={api.pdf.screenplay(pid)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                  <FileText className="w-3 h-3" />
                  {tt(screenplayT.exportPdf)}
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs cursor-pointer" onClick={handleFountainExport}>
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
              onClick={() => setActiveBlockId(null)}
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
                  setActiveBlockId={setActiveBlockId}
                  onContentChange={handleContentChange}
                  onTypeChange={handleTypeChange}
                  onEnterKey={handleEnterKey}
                  onBackspaceEmpty={handleBackspaceEmpty}
                  onTabKey={handleTabKey}
                  textareaRefs={textareaRefs}
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
        <div className="px-4 py-1.5 border-t border-border/30 bg-muted/30 flex items-center gap-4 shrink-0">
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
