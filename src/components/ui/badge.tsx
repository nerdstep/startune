import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap transition-colors [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-primary/40 bg-primary/10 text-primary",
        magenta: "border-neon-magenta/40 bg-neon-magenta/10 text-neon-magenta",
        violet: "border-neon-violet/40 bg-neon-violet/10 text-neon-violet",
        lime: "border-neon-lime/40 bg-neon-lime/10 text-neon-lime",
        amber: "border-neon-amber/40 bg-neon-amber/10 text-neon-amber",
        red: "border-neon-red/40 bg-neon-red/10 text-neon-red",
        outline: "border-border bg-white/[0.03] text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
