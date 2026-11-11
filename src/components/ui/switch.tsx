import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "@/lib/utils";

function Switch({ className, ...props }: Omit<SwitchPrimitive.Root.Props, "className"> & { className?: string }) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-input bg-white/[0.06] transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "data-[checked]:border-primary/60 data-[checked]:bg-primary/30 data-[checked]:shadow-[0_0_14px_-2px_var(--neon-cyan)]",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-3.5 translate-x-0.5 rounded-full bg-foreground transition-transform data-[checked]:translate-x-[18px] data-[checked]:bg-primary" />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
