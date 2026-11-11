import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-lg border border-input bg-white/[0.03] px-3 py-1 text-sm outline-none transition-[box-shadow,border-color] placeholder:text-muted-foreground/70",
        "focus-visible:border-primary/60 focus-visible:shadow-[0_0_0_3px_oklch(0.86_0.15_195/15%),0_0_24px_-6px_var(--neon-cyan)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
