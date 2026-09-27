import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md border border-border bg-input px-3 py-1 text-sm',
        'placeholder:text-muted-foreground/60 hover:border-foreground/20',
        'transition-[border-color,box-shadow] duration-150',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'focus-visible:outline-none focus-visible:border-foreground/40 focus-visible:shadow-[0_0_0_3px_hsl(var(--foreground)/0.07)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = 'Input'

export { Input }
