import { Switch as SwitchPrimitive } from '@base-ui/react/switch'

import { cn } from '@/lib/utils'

function Switch({
  className,
  ...props
}: Omit<SwitchPrimitive.Root.Props, 'className'> & { className?: string }) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-input transition-colors duration-100 outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'data-checked:bg-primary',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-4 translate-x-0.5 rounded-full bg-foreground transition-transform duration-150 data-checked:translate-x-4.5 data-checked:bg-primary-foreground" />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
