import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, debounce } from '@/lib/utils'
import {
  ArrowLeft, Plus, Upload, FileText, ChevronRight, Save, Film,
  AlignLeft, User, MessageSquare, Parentheses, CornerUpRight, StickyNote,
  Clapperboard, CheckCircle2, Loader2,
} from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

// ─── Types ────────────────────────────────────────────────────────────────────

type BlockType = 'scene_heading' | 'action' | 'character' | 'dialogue' | 'parenthetical' | 'transition' | 'note'

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

// ─── Constants ────────────────────────────────────────────────────────────────

const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  scene_heading: 'Szenenüberschrift',
  action: 'Aktion',
  character: 'Figur',
  dialogue: 'Dialog',
  parenthetical: 'Anweisung',
  transition: 'Übergang',
  note: 'Notiz',
}

const BLOCK_TYPE_ICONS: Record<BlockType, React.ElementType> = {
  scene_heading: Clapperboard,
  action: AlignLeft,
  character: User,
  dialogue: MessageSquare,
  parenthetical: Parentheses,
  transition: CornerUpRight,
  note: StickyNote,
}

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
  }
}

// ─── SaveStatus component ─────────────────────────────────────────────────────

function SaveStatus({ saving }: { saving: boolean }) {
  if (saving) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" />
        Speichern…
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
      <CheckCircle2 className="w-3 h-3" />
      Gespeichert
    </span>
  )
}

// ─── BlockEditor component ────────────────────────────────────────────────────

interface BlockEditorProps {
  block: ScreenplayBlock
  isActive: boolean
  onFocus: () => void
  onContentChange: (id: number, content: string) => void
  onTypeChange: (id: number, type: BlockType) => void
  onEnterKey: (id: number, atEnd: boolean) => void
  onBackspaceEmpty: (id: number) => void
  onTabKey: (id: number, shift: boolean) => void
  textareaRef: (el: HTMLTextAreaElement | null) => void
}

function BlockEditor({
  block,
  isActive,
  onFocus,
  onContentChange,
  onTypeChange,
  onEnterKey,
  onBackspaceEmpty,
  onTabKey,
  textareaRef,
}: BlockEditorProps) {
  const [localContent, setLocalContent] = useState(block.content)

  // Sync external content changes (e.g. after server save)
  useEffect(() => {
    setLocalContent(block.content)
  }, [block.content])

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    // Prevent newlines in textarea (we handle Enter ourselves)
    const noNewlines = val.replace(/\n/g, '')
    setLocalContent(noNewlines)
    onContentChange(block.id, noNewlines)
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

  return (
    <div
      className={cn(
        'group relative rounded transition-colors',
        getBlockContainerStyle(block.block_type),
        isActive && 'bg-primary/3'
      )}
      onClick={onFocus}
    >
      {/* Block type indicator on left when active */}
      {isActive && (
        <span className="absolute -left-32 top-0 text-[10px] text-muted-foreground/50 whitespace-nowrap pt-0.5 hidden xl:block">
          {BLOCK_TYPE_LABELS[block.block_type]}
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
          'min-h-[1.5rem] overflow-hidden',
          'focus:ring-0 focus:outline-none',
          block.block_type === 'parenthetical' && localContent && !localContent.startsWith('(')
            ? ''
            : ''
        )}
        placeholder={
          block.block_type === 'scene_heading' ? 'INT. MOTIV – TAG'
            : block.block_type === 'character' ? 'FIGUR'
            : block.block_type === 'parenthetical' ? '(Anweisung)'
            : block.block_type === 'transition' ? 'SCHNITT AUF:'
            : block.block_type === 'note' ? 'Notiz…'
            : block.block_type === 'dialogue' ? 'Dialog…'
            : 'Aktion…'
        }
        spellCheck
      />
    </div>
  )
}

// ─── SceneSection component ───────────────────────────────────────────────────

interface SceneSectionProps {
  sceneData: SceneData
  activeBlockId: number | null
  setActiveBlockId: (id: number | null) => void
  onContentChange: (blockId: number, content: string) => void
  onTypeChange: (blockId: number, type: BlockType) => void
  onEnterKey: (blockId: number, atEnd: boolean) => void
  onBackspaceEmpty: (blockId: number) => void
  onTabKey: (blockId: number, shift: boolean) => void
  textareaRefs: React.MutableRefObject<Map<number, HTMLTextAreaElement>>
  sectionRef: (el: HTMLDivElement | null) => void
}

function SceneSection({
  sceneData,
  activeBlockId,
  setActiveBlockId,
  onContentChange,
  onTypeChange,
  onEnterKey,
  onBackspaceEmpty,
  onTabKey,
  textareaRefs,
  sectionRef,
}: SceneSectionProps) {
  const { scene, blocks } = sceneData

  // Filter out scene_heading blocks that duplicate the scene title for display
  const displayBlocks = blocks.filter(b => b.block_type !== 'scene_heading')
  const headingBlock = blocks.find(b => b.block_type === 'scene_heading')

  const allBlocks = headingBlock ? [headingBlock, ...displayBlocks] : displayBlocks

  return (
    <div ref={sectionRef} className="mb-12" data-scene-id={scene.id}>
      {/* Scene header (read-only display if no heading block) */}
      {!headingBlock && (
        <div className="mt-8 mb-1 pt-3 border-t border-border/30">
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

  const [activeBlockId, setActiveBlockId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [localScenes, setLocalScenes] = useState<SceneData[]>([])

  const textareaRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map())
  const sectionRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const pendingSaves = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Data fetching ─────────────────────────────────────────────────────────

  const { data: scenesData, isLoading } = useQuery({
    queryKey: ['screenplay', pid],
    queryFn: () => api.screenplay.full(pid),
  })

  useEffect(() => {
    if (scenesData) {
      setLocalScenes(scenesData as SceneData[])
    }
  }, [scenesData])

  // ─── Mutations ─────────────────────────────────────────────────────────────

  const createBlockMutation = useMutation({
    mutationFn: ({ sceneId, data }: { sceneId: number; data: any }) =>
      api.screenplay.createBlock(sceneId, data),
    onSuccess: (newBlock) => {
      setLocalScenes(prev =>
        prev.map(sd =>
          sd.scene.id === newBlock.scene_id
            ? {
                ...sd,
                blocks: [...sd.blocks, newBlock].sort((a, b) => a.sort_order - b.sort_order),
              }
            : sd
        )
      )
      // Focus the new block after render
      setTimeout(() => {
        const el = textareaRefs.current.get(newBlock.id)
        if (el) {
          el.focus()
          setActiveBlockId(newBlock.id)
        }
      }, 50)
    },
    onError: () => toast({ title: 'Fehler beim Erstellen des Blocks', variant: 'destructive' }),
  })

  const updateBlockMutation = useMutation({
    mutationFn: ({ blockId, data }: { blockId: number; data: any }) =>
      api.screenplay.updateBlock(blockId, data),
  })

  const deleteBlockMutation = useMutation({
    mutationFn: (blockId: number) => api.screenplay.deleteBlock(blockId),
    onSuccess: (_, blockId) => {
      setLocalScenes(prev =>
        prev.map(sd => ({
          ...sd,
          blocks: sd.blocks.filter(b => b.id !== blockId),
        }))
      )
    },
    onError: () => toast({ title: 'Fehler beim Löschen', variant: 'destructive' }),
  })

  const createSceneMutation = useMutation({
    mutationFn: () =>
      api.scenes.create(pid, {
        scene_number: String((localScenes.length || 0) + 1),
        title: 'Neue Szene',
        int_ext: 'INT',
        day_night: 'TAG',
        eighths: 8,
      }),
    onSuccess: (newScene) => {
      const newSceneData: SceneData = { scene: newScene, blocks: [] }
      setLocalScenes(prev => [...prev, newSceneData])
      queryClient.invalidateQueries({ queryKey: ['scenes', pid] })
      // Scroll to new scene and create first block
      setTimeout(() => {
        const el = sectionRefs.current.get(newScene.id)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        // Create a scene_heading block
        createBlockMutation.mutate({
          sceneId: newScene.id,
          data: {
            block_type: 'scene_heading',
            content: `INT. NEUE SZENE – TAG`,
            sort_order: 0,
          },
        })
      }, 100)
    },
    onError: () => toast({ title: 'Fehler beim Erstellen der Szene', variant: 'destructive' }),
  })

  const importFdxMutation = useMutation({
    mutationFn: ({ xml, filename }: { xml: string; filename: string }) =>
      api.screenplay.importFdx(pid, xml, filename),
    onSuccess: (result: any) => {
      toast({
        title: `Import erfolgreich`,
        description: `${result.scenes_created} Szenen, ${result.blocks_created} Blöcke importiert`,
      })
      queryClient.invalidateQueries({ queryKey: ['screenplay', pid] })
      queryClient.invalidateQueries({ queryKey: ['scenes', pid] })
    },
    onError: (err: any) => toast({
      title: 'Import fehlgeschlagen',
      description: err?.message || 'Unbekannter Fehler',
      variant: 'destructive',
    }),
  })

  // ─── Block operations ──────────────────────────────────────────────────────

  // Debounced save for content changes
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
    // Find the block and its scene
    let foundScene: SceneData | undefined
    let foundBlock: ScreenplayBlock | undefined
    let blockIndex = -1

    for (const sd of localScenes) {
      const idx = sd.blocks.findIndex(b => b.id === blockId)
      if (idx !== -1) {
        foundScene = sd
        foundBlock = sd.blocks[idx]
        blockIndex = idx
        break
      }
    }

    if (!foundScene || !foundBlock) return

    const nextType = ENTER_NEXT_TYPE[foundBlock.block_type]
    const newSortOrder = foundBlock.sort_order + 0.5

    createBlockMutation.mutate({
      sceneId: foundScene.scene.id,
      data: {
        block_type: nextType,
        content: '',
        sort_order: newSortOrder,
      },
    })
  }, [localScenes])

  const handleBackspaceEmpty = useCallback((blockId: number) => {
    // Find previous block to focus
    let prevBlockId: number | null = null
    for (const sd of localScenes) {
      const idx = sd.blocks.findIndex(b => b.id === blockId)
      if (idx !== -1) {
        if (idx > 0) {
          prevBlockId = sd.blocks[idx - 1].id
        }
        break
      }
    }

    // Don't delete if it's the only/first block
    if (prevBlockId === null) return

    deleteBlockMutation.mutate(blockId)

    setTimeout(() => {
      const el = textareaRefs.current.get(prevBlockId!)
      if (el) {
        el.focus()
        setActiveBlockId(prevBlockId!)
        // Move cursor to end
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
    const nextType = TAB_CYCLE[nextIdx]
    handleTypeChange(blockId, nextType)
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

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
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
            Szenen
          </p>
          <p className="text-xs text-muted-foreground">{localScenes.length} Szenen</p>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {isLoading ? (
            <div className="p-3 space-y-1.5">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-8" />)}
            </div>
          ) : localScenes.length === 0 ? (
            <div className="p-4 text-center">
              <Film className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Keine Szenen</p>
            </div>
          ) : (
            localScenes.map((sd, i) => (
              <button
                key={sd.scene.id}
                onClick={() => scrollToScene(sd.scene.id)}
                className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors group flex items-start gap-2"
              >
                <span className="text-[10px] font-mono text-muted-foreground/50 shrink-0 w-5 mt-0.5">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate leading-tight">
                    {sd.scene.title || 'Ohne Titel'}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {sd.scene.int_ext} · {sd.scene.day_night} · {sd.blocks.length} Blöcke
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
            Neue Szene
          </Button>
        </div>
      </aside>

      {/* Right: Editor area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/40 shrink-0 bg-card flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => navigate(`/projects/${pid}/drehbuch`)}
          >
            <ArrowLeft className="w-3 h-3" />
            Szenenübersicht
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
                {(Object.keys(BLOCK_TYPE_LABELS) as BlockType[]).map(type => {
                  const Icon = BLOCK_TYPE_ICONS[type]
                  return (
                    <SelectItem key={type} value={type} className="text-xs">
                      <span className="flex items-center gap-2">
                        <Icon className="w-3 h-3 text-muted-foreground" />
                        {BLOCK_TYPE_LABELS[type]}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          )}

          <div className="flex-1" />

          <SaveStatus saving={saving} />

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
            {importFdxMutation.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Upload className="w-3 h-3" />
            )}
            FDX importieren
          </Button>

          {/* PDF link */}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            asChild
          >
            <a href={api.pdf.drehplan(pid)} target="_blank" rel="noopener noreferrer">
              <FileText className="w-3 h-3" />
              Als PDF
            </a>
          </Button>
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
              <p className="text-sm font-medium mb-1">Noch keine Szenen vorhanden</p>
              <p className="text-xs mb-4">Erstelle eine neue Szene oder importiere ein FDX-Skript.</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => createSceneMutation.mutate()}>
                  <Plus className="w-3.5 h-3.5 mr-1.5" />Neue Szene
                </Button>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-3.5 h-3.5 mr-1.5" />FDX importieren
                </Button>
              </div>
            </div>
          ) : (
            <div
              className="max-w-2xl mx-auto px-16 py-12 xl:px-24"
              onClick={() => {
                // If clicking outside any block, deselect
                setActiveBlockId(null)
              }}
            >
              {/* Screenplay title */}
              <div className="text-center mb-12">
                <p className="font-mono text-xs text-muted-foreground/50 uppercase tracking-widest">
                  Drehbuch
                </p>
              </div>

              {localScenes.map(sd => (
                <SceneSection
                  key={sd.scene.id}
                  sceneData={sd}
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
                />
              ))}

              {/* Padding at bottom */}
              <div className="h-48" />
            </div>
          )}
        </div>

        {/* Keyboard hints */}
        <div className="px-4 py-1.5 border-t border-border/30 bg-muted/30 flex items-center gap-4 shrink-0">
          <span className="text-[10px] text-muted-foreground/50">
            <kbd className="bg-muted px-1 rounded text-[9px] mr-1">Enter</kbd>Neuer Block
          </span>
          <span className="text-[10px] text-muted-foreground/50">
            <kbd className="bg-muted px-1 rounded text-[9px] mr-1">Tab</kbd>Typ wechseln
          </span>
          <span className="text-[10px] text-muted-foreground/50">
            <kbd className="bg-muted px-1 rounded text-[9px] mr-1">⌫</kbd>Leeren Block löschen
          </span>
        </div>
      </div>
    </div>
  )
}
