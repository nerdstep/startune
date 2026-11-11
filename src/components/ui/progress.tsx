import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { cn } from "@/lib/utils";

function Progress({ className, value, thin }: { className?: string; value: number | null; thin?: boolean }) {
  return (
    <ProgressPrimitive.Root value={value} className={cn("w-full", className)}>
      <ProgressPrimitive.Track className={cn("relative w-full overflow-hidden bg-white/[0.07]", thin ? "h-0.5" : "h-1.5 rounded-full")}>
        <ProgressPrimitive.Indicator className="h-full rounded-full bg-gradient-to-r from-neon-cyan via-neon-violet to-neon-magenta shadow-[0_0_12px_var(--neon-cyan)] transition-all duration-500" />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  );
}

export { Progress };
