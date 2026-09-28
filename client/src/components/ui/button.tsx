import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-[13px] font-medium tracking-[-0.01em] ring-offset-background transition-[transform,background-color,border-color,color,box-shadow,filter] duration-300 ease-spring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98] [&_svg]:shrink-0 [&>svg]:!mx-0',
  {
    variants: {
      variant: {
        // Deaktiviert wie bei Apple: grau statt verblasstes Orange
        default: 'bg-primary text-primary-foreground shadow-[0_1px_2px_hsl(var(--primary)/0.25)] disabled:bg-foreground/[0.08] disabled:text-foreground/40 disabled:opacity-100 disabled:shadow-none',
        destructive: 'bg-destructive text-destructive-foreground disabled:bg-foreground/[0.08] disabled:text-foreground/40 disabled:opacity-100',
        outline: 'border border-border bg-card text-foreground shadow-sm hover:bg-muted',
        secondary: 'bg-foreground/[0.06] text-foreground hover:bg-foreground/[0.1]',
        ghost: 'text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground',
        link: 'text-primary hover:underline underline-offset-4',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-6 text-[15px]',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
