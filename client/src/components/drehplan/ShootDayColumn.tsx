import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { cn, formatDate, eighthsToString } from '@/lib/utils'
import { SceneStrip } from './SceneStrip'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ShootDayColumnProps {
  day: any
  onRemoveScene: (dayId: number, sceneId: number) => void
  onDeleteDay: (dayId: number) => void
  onStatusChange: (dayId: number, status: string) => void
}

const STATUS_COLORS: Record<string, string> = {
  'Geplant': 'outline',
  'Bestätigt': 'blue',
  'Abgedreht': 'green',
  'Ausgefallen': 'red',
  'Sperrtag': 'amber',
}

export function ShootDayColumn({ day, onRemoveScene, onDeleteDay, onStatusChange }: ShootDayColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${day.id}`,
    data: { type: 'day', dayId: day.id },
  })

  const sceneIds = (day.scenes || []).map((s: any) => `scene-${s.scene_id}`)
  const totalEighths = day.total_eighths || 0
  const isSperrtag = day.status === 'Sperrtag'

  return (
    <div className={cn(
      'flex flex-col shrink-0 w-[200px] border rounded-lg overflow-hidden',
      isSperrtag ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-border bg-card'
    )}>
      {/* Header */}
      <div className={cn('px-3 py-2 border-b border-border', isSperrtag && 'bg-yellow-500/10')}>
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold text-sm">Tag {day.day_number}</span>
          <Button variant="ghost" size="icon" className="h-5 w-5 opacity-50 hover:opacity-100 hover:text-destructive" onClick={() => onDeleteDay(day.id)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          <Calendar className="w-3 h-3" />
          <span>{formatDate(day.date)}</span>
        </div>
        <select
          value={day.status}
          onChange={(e) => onStatusChange(day.id, e.target.value)}
          className={cn(
            'w-full text-xs rounded px-1 py-0.5 border border-input bg-input',
            isSperrtag && 'text-yellow-400'
          )}
        >
          {['Geplant', 'Bestätigt', 'Abgedreht', 'Ausgefallen', 'Sperrtag'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Summary */}
        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
          <span>{day.scenes?.length || 0} Sz.</span>
          <span>·</span>
          <Clock className="w-2.5 h-2.5" />
          <span className="font-mono">{eighthsToString(totalEighths)}</span>
        </div>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 p-2 min-h-[120px] transition-colors',
          isOver && 'bg-primary/10',
          isSperrtag && 'opacity-50 pointer-events-none'
        )}
      >
        {isSperrtag ? (
          <div className="flex items-center justify-center h-full text-xs text-yellow-400 italic">Sperrtag</div>
        ) : (
          <SortableContext items={sceneIds} strategy={verticalListSortingStrategy}>
            {(day.scenes || []).length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground italic">
                Szenen hierhin ziehen
              </div>
            ) : (
              (day.scenes || []).map((scene: any) => (
                <SceneStrip
                  key={scene.scene_id}
                  scene={scene}
                  shootDayId={day.id}
                  onRemove={(sceneId) => onRemoveScene(day.id, sceneId)}
                />
              ))
            )}
          </SortableContext>
        )}
      </div>
    </div>
  )
}
