import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckIcon, MinusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function Checkbox({ className, indeterminate, ...props }: Omit<CheckboxPrimitive.Root.Props, "className"> & { className?: string }) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      indeterminate={indeterminate}
      className={cn(
        "peer grid size-4 shrink-0 place-items-center rounded-[5px] border border-input bg-white/[0.03] outline-none transition-all",
        "data-[checked]:border-primary data-[checked]:bg-primary data-[checked]:text-primary-foreground data-[checked]:shadow-[0_0_12px_var(--neon-cyan)]",
        "data-[indeterminate]:border-primary data-[indeterminate]:bg-primary data-[indeterminate]:text-primary-foreground",
        "focus-visible:ring-[3px] focus-visible:ring-ring data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center">
        {indeterminate ? <MinusIcon className="size-3.5" strokeWidth={3} /> : <CheckIcon className="size-3.5" strokeWidth={3} />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
