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
      // Am Telefon untereinander: nebeneinander schoben die Aktionen den Titel
      // aus dem Bild, weil sie nicht schrumpfen duerfen
      'flex flex-col gap-3 mb-7 sm:flex-row sm:items-start sm:justify-between sm:gap-4',
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
        <div className="flex items-center gap-2 flex-wrap sm:ml-6 sm:shrink-0 sm:mt-0.5">{actions}</div>
      )}
    </div>
  )
}
