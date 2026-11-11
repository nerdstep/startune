import { Progress as P } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

function Progress({ className, value, ...props }: React.ComponentProps<typeof P.Root>) {
  return (
    <P.Root className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]", className)} {...props}>
      <P.Indicator
        className="h-full rounded-full bg-gradient-to-r from-neon-cyan via-neon-violet to-neon-magenta shadow-[0_0_12px_var(--neon-cyan)] transition-all duration-500"
        style={{ width: `${value ?? 0}%` }}
      />
    </P.Root>
  );
}

export { Progress };
