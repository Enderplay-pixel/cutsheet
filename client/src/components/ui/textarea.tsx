import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        'flex min-h-[60px] w-full rounded-md border border-border bg-input px-3 py-2 text-sm leading-relaxed placeholder:text-muted-foreground/60 transition-[border-color,box-shadow] duration-150 hover:border-foreground/20 focus-visible:outline-none focus-visible:border-foreground/40 focus-visible:shadow-[0_0_0_3px_hsl(var(--foreground)/0.07)] disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = 'Textarea'

export { Textarea }
