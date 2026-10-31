import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { cn, formatDate, eighthsToString } from '@/lib/utils'
import { SceneStrip } from './SceneStrip'
import { Calendar, Clock, Trash2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { useDownload } from '@/lib/useDownload'
import { useT } from '@/lib/useT'
import { shootDayColumnT, drehtagStatusT } from '@/lib/texte/komponenten/Drehplan'

interface ShootDayColumnProps {
  day: any
  onRemoveScene: (dayId: number, sceneId: number) => void
  onDeleteDay: (dayId: number) => void
  onStatusChange: (dayId: number, status: string) => void
  /** Ohne Schreibrecht: kein Löschen, kein Statuswechsel, keine Szene entfernen */
  darfAendern?: boolean
}

export function ShootDayColumn({ day, onRemoveScene, onDeleteDay, onStatusChange, darfAendern = true }: ShootDayColumnProps) {
  const download = useDownload()
  const tt = useT()
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${day.id}`,
    data: { type: 'day', dayId: day.id },
  })

  const sceneIds = (day.scenes || []).map((s: any) => `scene-${s.scene_id}`)
  const totalEighths = day.total_eighths || 0
  const isSperrtag = day.status === 'Sperrtag'
  // Ein Sperrtag mit Szenen zeigt sie weiter an. Vorher verschwanden sie: nicht
  // in der Spalte, nicht in der Ablage, aber als "geplant" gezählt (gemessen
  // am 31.10.2026). So lassen sie sich wegziehen.
  const leerGesperrt = isSperrtag && (day.scenes || []).length === 0

  return (
    <div
      className={cn(
        'flex flex-col shrink-0 w-[200px] border rounded-lg overflow-hidden',
        isSperrtag ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-border bg-card'
      )}
      aria-label={tt(shootDayColumnT.drehtagDatum).replace('{n}', String(day.day_number)).replace('{d}', formatDate(day.date))}
    >
      {/* Header */}
      <div className={cn('px-3 py-2 border-b border-border', isSperrtag && 'bg-yellow-500/10')}>
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold text-sm">{tt(shootDayColumnT.tagN).replace('{n}', String(day.day_number))}</span>
          {darfAendern && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 opacity-50 hover:opacity-100 hover:text-destructive"
              // Löschen nimmt Dispo, Tagesbericht und Check-ins mit - nicht auf einen Klick
              onClick={() => { if (confirm(tt(shootDayColumnT.loeschenFrage).replace('{n}', String(day.day_number)))) onDeleteDay(day.id) }}
              aria-label={tt(shootDayColumnT.loeschen).replace('{n}', String(day.day_number))}
            >
              <Trash2 className="w-3 h-3" aria-hidden="true" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          <Calendar className="w-3 h-3" aria-hidden="true" />
          <span>{formatDate(day.date)}</span>
        </div>
        <select
          value={day.status}
          disabled={!darfAendern}
          onChange={(e) => onStatusChange(day.id, e.target.value)}
          aria-label={tt(shootDayColumnT.statusFuer).replace('{n}', String(day.day_number))}
          className={cn(
            'w-full text-xs rounded px-1 py-0.5 border border-input bg-input',
            isSperrtag && 'text-yellow-400'
          )}
        >
          {['Geplant', 'Bestätigt', 'Abgedreht', 'Ausgefallen', 'Sperrtag'].map(s => (
            <option key={s} value={s}>{tt(drehtagStatusT[s])}</option>
          ))}
        </select>

        {/* Summary */}
        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
          <span>{tt(shootDayColumnT.szAbk).replace('{n}', String(day.scenes?.length || 0))}</span>
          <span>·</span>
          <Clock className={cn('w-2.5 h-2.5', totalEighths > 96 ? 'text-red-500' : totalEighths > 80 ? 'text-amber-500' : '')} aria-hidden="true" />
          <span className={cn(
            'font-mono',
            totalEighths > 96 ? 'text-red-500 font-bold' : totalEighths > 80 ? 'text-amber-500' : ''
          )}>{eighthsToString(totalEighths)}</span>
          {totalEighths > 80 && <span title={totalEighths > 96 ? tt(shootDayColumnT.ueberladen) : tt(shootDayColumnT.vorsicht)}>⚠</span>}
          <button
            type="button"
            onClick={() => download(api.morningBrief.pdf(day.id), `morning-brief-drehtag-${day.day_number}.pdf`)}
            className="ml-auto flex items-center gap-0.5 text-muted-foreground/60 hover:text-primary transition-colors"
            title={tt(shootDayColumnT.morningBriefPdf)}
            aria-label={tt(shootDayColumnT.morningBriefDl).replace('{n}', String(day.day_number))}
          >
            <FileText className="w-2.5 h-2.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 p-2 min-h-[120px] transition-colors',
          isOver && 'bg-primary/10',
          leerGesperrt && 'opacity-50 pointer-events-none'
        )}
        aria-label={isSperrtag ? tt(shootDayColumnT.sperrtagN).replace('{n}', String(day.day_number)) : tt(shootDayColumnT.szenenFuer).replace('{n}', String(day.day_number))}
      >
        {leerGesperrt ? (
          <div className="flex items-center justify-center h-full text-xs text-yellow-400 italic">{tt(drehtagStatusT.Sperrtag)}</div>
        ) : (
          <SortableContext items={sceneIds} strategy={verticalListSortingStrategy}>
            {isSperrtag && (
              <p role="alert" className="text-[11px] text-yellow-500 mb-1.5">{tt(shootDayColumnT.sperrtagMitSzenen)}</p>
            )}
            {(day.scenes || []).length === 0 ? (
              <div
                className="flex items-center justify-center h-full text-xs text-muted-foreground italic"
                aria-label={tt(shootDayColumnT.keineSzenen)}
              >
                {tt(shootDayColumnT.hierhinZiehen)}
              </div>
            ) : (
              <div role="list" aria-label={tt(shootDayColumnT.szenenAn).replace('{n}', String(day.day_number))}>
                {(day.scenes || []).map((scene: any) => (
                  <SceneStrip
                    key={scene.scene_id}
                    scene={scene}
                    shootDayId={day.id}
                    onRemove={darfAendern ? (sceneId) => onRemoveScene(day.id, sceneId) : undefined}
                  />
                ))}
              </div>
            )}
          </SortableContext>
        )}
      </div>
    </div>
  )
}
