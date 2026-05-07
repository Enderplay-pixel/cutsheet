import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { cn, getStripClass, eighthsToString } from '@/lib/utils'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

function PoolSceneStrip({ scene }: { scene: any }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `scene-${scene.id}`,
    data: { type: 'scene', scene: { ...scene, scene_id: scene.id }, shootDayId: null },
  })

  const style = { transform: CSS.Transform.toString(transform), transition }
  const stripClass = getStripClass(scene.int_ext, scene.day_night)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-1 rounded text-xs mb-1 cursor-grab active:cursor-grabbing select-none',
        stripClass,
        isDragging && 'opacity-50 ring-1 ring-primary'
      )}
    >
      <div {...attributes} {...listeners} className="px-1 py-2 text-muted-foreground">
        <GripVertical className="w-3 h-3" />
      </div>
      <div className="flex-1 py-1.5 min-w-0">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="font-mono font-semibold text-xs shrink-0">{scene.scene_number}</span>
          <span className="truncate text-xs opacity-80">{scene.title}</span>
        </div>
        <div className="flex gap-1 mt-0.5 opacity-60 text-[10px]">
          <span className="font-mono">{scene.int_ext}</span>
          <span>{scene.day_night}</span>
          <span className="ml-auto font-mono">{eighthsToString(scene.eighths)}</span>
        </div>
      </div>
    </div>
  )
}

interface ScenePoolProps {
  scenes: any[]
}

export function ScenePool({ scenes }: ScenePoolProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'scene-pool',
    data: { type: 'pool' },
  })

  const sceneIds = scenes.map(s => `scene-${s.id}`)

  return (
    <div className="w-[200px] shrink-0 border border-border rounded-lg overflow-hidden bg-card flex flex-col">
      <div className="px-3 py-2 border-b border-border">
        <h3 className="text-sm font-semibold">Ablage</h3>
        <p className="text-xs text-muted-foreground">{scenes.length} ungeplante Szenen</p>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 p-2 overflow-y-auto min-h-[200px]',
          isOver && 'bg-primary/10'
        )}
      >
        {scenes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground italic">Alle Szenen geplant</div>
        ) : (
          <SortableContext items={sceneIds} strategy={verticalListSortingStrategy}>
            {scenes.map(scene => <PoolSceneStrip key={scene.id} scene={scene} />)}
          </SortableContext>
        )}
      </div>
    </div>
  )
}
