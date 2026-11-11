import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_0_20px_-4px_var(--neon-cyan)] hover:shadow-[0_0_28px_-2px_var(--neon-cyan)] hover:brightness-110",
        magenta:
          "bg-neon-magenta text-white shadow-[0_0_20px_-4px_var(--neon-magenta)] hover:shadow-[0_0_28px_-2px_var(--neon-magenta)] hover:brightness-110",
        destructive:
          "bg-destructive/15 text-neon-red border border-destructive/40 hover:bg-destructive/25 hover:shadow-[0_0_20px_-6px_var(--neon-red)]",
        outline:
          "border border-border bg-white/[0.03] hover:bg-white/[0.07] hover:border-primary/40 hover:text-primary",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-white/[0.06] hover:text-foreground text-muted-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5 text-xs",
        lg: "h-11 rounded-xl px-6 text-base has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
