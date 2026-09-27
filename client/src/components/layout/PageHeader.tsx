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
      // 548 px - fuenf Knoepfe plus Titel passen dort nicht in eine Zeile.
      'flex flex-col gap-3 mb-7 lg:flex-row lg:items-start lg:justify-between lg:gap-4',
      border && 'pb-5 border-b border-border/50',
      className
    )}>
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-tight truncate">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground/70 mt-1 leading-snug font-medium truncate">{subtitle}</p>
        )}
      </div>
      {actions && (
        // flex-wrap, damit mehrere Knoepfe umbrechen statt hinauszuragen
        <div className="flex items-center gap-2 flex-wrap lg:ml-6 lg:shrink-0 lg:mt-0.5">{actions}</div>
      )}
    </div>
  )
}
