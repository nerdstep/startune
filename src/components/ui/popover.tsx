import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import * as React from 'react'

import { cn } from '@/lib/utils'

const Popover = PopoverPrimitive.Root
/** Pass the visible control via `render`, e.g. `<PopoverTrigger render={<Button />}>…</PopoverTrigger>`. */
const PopoverTrigger = PopoverPrimitive.Trigger

function PopoverContent({
  className,
  align = 'center',
  side = 'bottom',
  sideOffset = 6,
  children,
  ...props
}: Omit<PopoverPrimitive.Popup.Props, 'className'> & {
  className?: string
  align?: PopoverPrimitive.Positioner.Props['align']
  side?: PopoverPrimitive.Positioner.Props['side']
  sideOffset?: number
  children: React.ReactNode
}) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        className="z-50"
        align={align}
        side={side}
        sideOffset={sideOffset}
      >
        <PopoverPrimitive.Popup
          className={cn(
            'w-72 origin-(--transform-origin) rounded-lg border bg-popover p-3 text-popover-foreground shadow-xl shadow-black/40 outline-none',
            'transition-[opacity,transform] duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0',
            className,
          )}
          {...props}
        >
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

export { Popover, PopoverContent, PopoverTrigger }
