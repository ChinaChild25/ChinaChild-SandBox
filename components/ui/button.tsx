import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/** Variants follow Figmadasboard / ds-figma-tokens — no generic shadcn chrome. */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--ds-radius-md)] text-ds-body font-medium transition-[opacity,background-color,color] duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*=\'size-\'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-[rgb(26_26_26/0.22)]',
  {
    variants: {
      variant: {
        default:
          'bg-ds-ink text-white hover:opacity-92 dark:bg-white dark:text-[#1a1a1a] dark:hover:opacity-95 dark:focus-visible:ring-white/40',
        destructive: 'bg-destructive text-white hover:opacity-92',
        outline:
          'rounded-[10px] bg-white text-ds-ink shadow-none hover:bg-ds-surface-hover dark:bg-ds-surface dark:hover:bg-white/5',
        secondary:
          'rounded-[10px] bg-ds-neutral-chrome text-ds-ink shadow-none hover:bg-ds-neutral-chrome-hover dark:text-ds-ink',
        ghost: 'text-ds-ink hover:bg-ds-surface-hover',
        link: 'rounded-none text-ds-sage-strong underline-offset-4 hover:text-ds-sage-hover hover:underline',
        /** Lingua / cc-glass header: прозрачные кнопки на «стеклянной» панели */
        chinaGlass:
          'border-0 bg-transparent text-foreground shadow-none backdrop-blur-sm hover:bg-black/[0.06] dark:hover:bg-white/[0.08]',
      },
      size: {
        default: 'h-10 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-9 gap-1.5 px-3 has-[>svg]:px-2.5 [font-size:var(--ds-text-body-sm)] leading-[var(--ds-leading-body)]',
        lg: 'h-11 px-6 has-[>svg]:px-4',
        icon: 'size-10',
        'icon-sm': 'size-9',
        'icon-lg': 'size-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<'button'> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean
    }
>(function Button({ className, variant, size, asChild = false, ...props }, ref) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
})
Button.displayName = 'Button'

export { Button, buttonVariants }
