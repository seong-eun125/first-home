import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3', {
  variants: {
    variant: {
      default: 'bg-brand-soft text-primary',
      outline: 'border border-border text-muted-foreground',
      good: 'bg-good-soft text-good',
      normal: 'bg-normal-soft text-normal',
      bad: 'bg-bad-soft text-bad',
      unknown: 'bg-unknown-soft text-unknown border border-dashed border-unknown/40',
      muted: 'bg-muted text-muted-foreground',
      solid: 'bg-primary text-primary-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
})

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
