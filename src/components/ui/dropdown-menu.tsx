import { Menu } from '@base-ui/react/menu'
import { CheckIcon } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

const DropdownMenu = Menu.Root
/** Pass the visible control via `render`, e.g. `<DropdownMenuTrigger render={<Button />}>…</DropdownMenuTrigger>`. */
const DropdownMenuTrigger = Menu.Trigger

const itemBase =
  'relative flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none data-highlighted:bg-accent data-disabled:opacity-50 [&_svg]:size-4'

function DropdownMenuContent({
  className,
  align = 'start',
  side = 'bottom',
  sideOffset = 6,
  children,
}: {
  className?: string
  align?: Menu.Positioner.Props['align']
  side?: Menu.Positioner.Props['side']
  sideOffset?: number
  children: React.ReactNode
}) {
  return (
    <Menu.Portal>
      <Menu.Positioner
        className="z-50 outline-none"
        align={align}
        side={side}
        sideOffset={sideOffset}
      >
        <Menu.Popup
          className={cn(
            'max-h-(--available-height) min-w-44 origin-(--transform-origin) overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-xl shadow-black/40 outline-none',
            'transition-[opacity,transform] duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0',
            className,
          )}
        >
          {children}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  )
}

function DropdownMenuItem({
  className,
  variant,
  ...props
}: Omit<Menu.Item.Props, 'className'> & { className?: string; variant?: 'destructive' }) {
  return (
    <Menu.Item
      className={cn(
        itemBase,
        '[&_svg]:text-muted-foreground',
        variant === 'destructive' &&
          'text-destructive data-highlighted:bg-destructive/10 [&_svg]:text-destructive!',
        className,
      )}
      {...props}
    />
  )
}

/** A menu item that navigates: `<DropdownMenuLinkItem render={<Link to="/x" />}>…` or with `href`. */
function DropdownMenuLinkItem({
  className,
  ...props
}: Omit<Menu.LinkItem.Props, 'className'> & { className?: string }) {
  return (
    <Menu.LinkItem
      className={cn(itemBase, '[&_svg]:text-muted-foreground', className)}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: Omit<Menu.CheckboxItem.Props, 'className'> & { className?: string }) {
  return (
    <Menu.CheckboxItem className={cn(itemBase, 'pl-8', className)} {...props}>
      <span className="absolute left-2 flex size-4 items-center justify-center">
        <Menu.CheckboxItemIndicator>
          <CheckIcon className="size-4" />
        </Menu.CheckboxItemIndicator>
      </span>
      {children}
    </Menu.CheckboxItem>
  )
}

function DropdownMenuLabel({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('px-2 py-1.5 text-xs font-medium text-muted-foreground', className)}
      {...props}
    />
  )
}

function DropdownMenuSeparator({ className }: { className?: string }) {
  return <Menu.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} />
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
}
