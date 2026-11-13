import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import * as React from "react";

function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <TooltipPrimitive.Provider delay={200}>{children}</TooltipPrimitive.Provider>;
}

/** Wraps a single element; that element becomes the trigger. */
function Tooltip({ children, content, side = "top" }: { children: React.ReactElement; content: React.ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side={side} sideOffset={6} className="z-50">
          <TooltipPrimitive.Popup className="max-w-xs origin-[var(--transform-origin)] rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-lg shadow-black/30 transition-[opacity,transform] duration-150 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0">
            {content}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export { Tooltip, TooltipProvider };
