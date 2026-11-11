import { Tabs as P } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

function Tabs({ className, ...props }: React.ComponentProps<typeof P.Root>) {
  return <P.Root className={cn("flex flex-col gap-4", className)} {...props} />;
}
function TabsList({ className, ...props }: React.ComponentProps<typeof P.List>) {
  return (
    <P.List
      className={cn("glass inline-flex h-10 w-fit max-w-full items-center gap-1 overflow-x-auto rounded-xl p-1", className)}
      {...props}
    />
  );
}
function TabsTrigger({ className, ...props }: React.ComponentProps<typeof P.Trigger>) {
  return (
    <P.Trigger
      className={cn(
        "inline-flex h-full items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-all outline-none [&_svg]:size-4",
        "hover:text-foreground data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-[inset_0_0_0_1px_oklch(0.86_0.15_195/40%),0_0_18px_-6px_var(--neon-cyan)]",
        className,
      )}
      {...props}
    />
  );
}
function TabsContent({ className, ...props }: React.ComponentProps<typeof P.Content>) {
  return <P.Content className={cn("outline-none", className)} {...props} />;
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
