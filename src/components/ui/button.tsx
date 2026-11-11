import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring data-[disabled]:pointer-events-none data-[disabled]:opacity-50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
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
          "border border-border bg-white/[0.03] hover:bg-white/[0.07] hover:border-primary/40 hover:text-primary data-[popup-open]:border-primary/40 data-[popup-open]:text-primary",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-white/[0.06] hover:text-foreground text-muted-foreground data-[popup-open]:bg-white/[0.06]",
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

type ButtonProps = Omit<ButtonPrimitive.Props, "className"> & VariantProps<typeof buttonVariants> & { className?: string };

/** Use `render={<a href=… />}` (with `nativeButton={false}`) to render a link. */
function Button({ className, variant, size, ...props }: ButtonProps) {
  return <ButtonPrimitive data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
