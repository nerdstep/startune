import { CheckIcon } from "lucide-react";
import { DropdownMenu as P } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

const DropdownMenu = P.Root;
const DropdownMenuTrigger = P.Trigger;

function DropdownMenuContent({ className, sideOffset = 6, ...props }: React.ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content
        sideOffset={sideOffset}
        className={cn(
          "glass z-50 min-w-44 overflow-hidden rounded-xl p-1 !bg-popover text-popover-foreground",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className,
        )}
        {...props}
      />
    </P.Portal>
  );
}

function DropdownMenuItem({ className, variant, ...props }: React.ComponentProps<typeof P.Item> & { variant?: "destructive" }) {
  return (
    <P.Item
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none select-none data-[highlighted]:bg-white/[0.07] data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted-foreground",
        variant === "destructive" && "text-neon-red data-[highlighted]:bg-destructive/15 [&_svg]:!text-neon-red",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuCheckboxItem({ className, children, ...props }: React.ComponentProps<typeof P.CheckboxItem>) {
  return (
    <P.CheckboxItem
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-lg py-1.5 pr-2 pl-8 text-sm outline-none select-none data-[highlighted]:bg-white/[0.07]",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-4 items-center justify-center">
        <P.ItemIndicator>
          <CheckIcon className="size-4 text-primary" />
        </P.ItemIndicator>
      </span>
      {children}
    </P.CheckboxItem>
  );
}

function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof P.Label>) {
  return <P.Label className={cn("px-2 py-1.5 text-xs font-medium text-muted-foreground", className)} {...props} />;
}
function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof P.Separator>) {
  return <P.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
};
