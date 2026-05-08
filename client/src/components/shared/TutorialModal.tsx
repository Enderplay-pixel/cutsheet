import { useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { tutorialT, t } from '@/lib/i18n'
import { useProjectStore } from '@/store/useProjectStore'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

const STEPS = tutorialT.steps

interface TutorialModalProps {
  open: boolean
  onClose: () => void
}

export function TutorialModal({ open, onClose }: TutorialModalProps) {
  const [step, setStep] = useState(0)
  const { language } = useProjectStore()
  const lang = language

  const isFirst = step === 0
  const isLast  = step === STEPS.length - 1
  const current = STEPS[step]

  const handleClose = () => {
    setStep(0)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent
        className="max-w-lg p-0 overflow-hidden gap-0"
        onInteractOutside={e => e.preventDefault()}
      >
        {/* Progress bar */}
        <div className="h-1 bg-muted w-full">
          <div
            className="h-1 bg-primary transition-all duration-500 ease-out"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            {t(tutorialT.step, lang)} {step + 1} {t(tutorialT.of, lang)} {STEPS.length}
          </span>
          <button
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={t(tutorialT.skip, lang)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pt-6 pb-8 text-center space-y-4 min-h-[260px] flex flex-col items-center justify-center">
          {/* Emoji */}
          <div className="text-6xl leading-none select-none">
            {current.emoji}
          </div>

          {/* Dots */}
          <div className="flex items-center gap-1.5 pt-1">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={cn(
                  'rounded-full transition-all duration-300',
                  i === step
                    ? 'w-5 h-1.5 bg-primary'
                    : 'w-1.5 h-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60'
                )}
              />
            ))}
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold tracking-tight leading-tight">
            {t(current.title, lang)}
          </h2>

          {/* Body */}
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
            {t(current.body, lang)}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border/40 bg-muted/20">
          {/* Back */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep(s => s - 1)}
            disabled={isFirst}
            className="gap-1.5"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            {t(tutorialT.back, lang)}
          </Button>

          {/* Skip / Next / Finish */}
          <div className="flex items-center gap-2">
            {!isLast && (
              <Button variant="ghost" size="sm" onClick={handleClose} className="text-muted-foreground">
                {t(tutorialT.skip, lang)}
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={handleClose} className="gap-1.5 px-5">
                {t(tutorialT.finish, lang)}
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep(s => s + 1)} className="gap-1.5">
                {t(tutorialT.next, lang)}
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
