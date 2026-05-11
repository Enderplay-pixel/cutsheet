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
      'flex items-start justify-between mb-7',
      border && 'pb-5 border-b border-border/50',
      className
    )}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground leading-tight truncate">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground/70 mt-1 leading-snug font-medium truncate">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 ml-6 shrink-0 mt-0.5">{actions}</div>
      )}
    </div>
  )
}
