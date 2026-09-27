import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  className?: string
  border?: boolean
}

export function PageHeader({ title, subtitle, actions, className, border = true }: PageHeaderProps) {
  return (
    <div className={cn(
      // Erst ab lg nebeneinander: Breakpoints messen den Bildschirm, nicht
      // den Platz neben der Sidebar. Bei 768 px (iPad hoch) bleiben dem Inhalt
      // 548 px — fuenf Knoepfe plus Titel passen dort nicht in eine Zeile.
      'flex flex-col gap-4 mb-8 lg:flex-row lg:items-end lg:justify-between lg:gap-6',
      border && 'pb-6 border-b border-border',
      className
    )}>
      <div className="min-w-0">
        <h1 className="font-display text-[34px] sm:text-[40px] text-foreground truncate pb-0.5">{title}</h1>
        {subtitle && (
          <p className="text-[13.5px] text-muted-foreground mt-1.5 leading-snug max-w-[65ch]">{subtitle}</p>
        )}
      </div>
      {actions && (
        // flex-wrap, damit mehrere Knoepfe umbrechen statt hinauszuragen
        <div className="flex items-center gap-2 flex-wrap lg:shrink-0 lg:pb-1">{actions}</div>
      )}
    </div>
  )
}
