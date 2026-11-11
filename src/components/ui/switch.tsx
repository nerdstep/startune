import { Switch as P } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

function Switch({ className, ...props }: React.ComponentProps<typeof P.Root>) {
  return (
    <P.Root
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-input bg-white/[0.06] transition-all outline-none",
        "data-[state=checked]:border-primary/60 data-[state=checked]:bg-primary/30 data-[state=checked]:shadow-[0_0_14px_-2px_var(--neon-cyan)]",
        className,
      )}
      {...props}
    >
      <P.Thumb className="pointer-events-none block size-3.5 translate-x-0.5 rounded-full bg-foreground transition-transform data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-primary" />
    </P.Root>
  );
}

export { Switch };
