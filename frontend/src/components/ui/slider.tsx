import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@/lib/utils'

export const Slider = React.forwardRef<
  React.ComponentRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, 'aria-label': ariaLabel, ...props }, ref) => (
  <SliderPrimitive.Root ref={ref} className={cn('relative flex w-full touch-none select-none items-center py-1.5', className)} {...props}>
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
      <SliderPrimitive.Range className="absolute h-full bg-primary" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb aria-label={ariaLabel} className="block h-4.5 w-4.5 rounded-full border-2 border-primary bg-white shadow transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 hover:scale-110 cursor-grab" />
  </SliderPrimitive.Root>
))
Slider.displayName = 'Slider'
