import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("scanline rounded-lg bg-white/[0.05]", className)} {...props} />;
}

export { Skeleton };
