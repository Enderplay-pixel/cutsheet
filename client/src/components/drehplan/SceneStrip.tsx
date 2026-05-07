import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn, getStripClass, eighthsToString } from '@/lib/utils'
import { GripVertical, X } from 'lucide-react'

interface SceneStripProps {
  scene: any
  shootDayId: number
  onRemove?: (sceneId: number) => void
  draggable?: boolean
}

export function SceneStrip({ scene, shootDayId, onRemove, draggable = true }: SceneStripProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `scene-${scene.scene_id || scene.id}`,
    data: { type: 'scene', scene, shootDayId },
    disabled: !draggable,
  })

  const style = { transform: CSS.Transform.toString(transform), transition }
  const stripClass = getStripClass(scene.int_ext, scene.day_night)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-1 rounded text-xs mb-1 cursor-grab active:cursor-grabbing select-none',
        stripClass,
        isDragging && 'opacity-50 ring-1 ring-primary',
      )}
    >
      {draggable && (
        <div {...attributes} {...listeners} className="px-1 py-2 text-muted-foreground hover:text-foreground">
          <GripVertical className="w-3 h-3" />
        </div>
      )}

      <div className={cn('flex-1 py-1.5 min-w-0', !draggable && 'pl-2')}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono font-semibold text-xs shrink-0">{scene.scene_number}</span>
          <span className="truncate text-xs opacity-80">{scene.title}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 opacity-60 flex-wrap">
          <span className="font-mono text-[10px]">{scene.int_ext}</span>
          <span className="text-[10px]">{scene.day_night}</span>
          {scene.location_name && <span className="text-[10px] truncate">{scene.location_name}</span>}
          <span className="font-mono text-[10px] ml-auto">{eighthsToString(scene.eighths)}</span>
        </div>
      </div>

      {onRemove && (
        <button
          onClick={() => onRemove(scene.scene_id || scene.id)}
          className="px-1 py-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
