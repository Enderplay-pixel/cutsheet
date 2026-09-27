import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-[10px] border border-border bg-input px-3 py-1 text-sm',
        'placeholder:text-muted-foreground/70',
        'transition-[border-color,box-shadow] duration-150',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'focus-visible:outline-none focus-visible:border-primary focus-visible:shadow-[0_0_0_4px_hsl(var(--primary)/0.18)]',
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
