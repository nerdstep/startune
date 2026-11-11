import { Tooltip as P } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

const TooltipProvider = P.Provider;

function Tooltip({ children, content, side = "top" }: { children: React.ReactNode; content: React.ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <P.Root delayDuration={200}>
      <P.Trigger asChild>{children}</P.Trigger>
      <P.Portal>
        <P.Content
          side={side}
          sideOffset={6}
          className={cn(
            "z-50 max-w-xs rounded-lg border border-primary/30 bg-popover px-2.5 py-1.5 text-xs text-foreground shadow-[0_0_24px_-8px_var(--neon-cyan)] backdrop-blur-xl",
            "data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95",
          )}
        >
          {content}
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}

export { Tooltip, TooltipProvider };
