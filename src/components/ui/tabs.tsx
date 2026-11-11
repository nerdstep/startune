import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn } from "@/lib/utils";

type WithClass<P> = Omit<P, "className"> & { className?: string };

function Tabs({ className, ...props }: WithClass<TabsPrimitive.Root.Props>) {
  return <TabsPrimitive.Root className={cn("flex flex-col gap-4", className)} {...props} />;
}
function TabsList({ className, ...props }: WithClass<TabsPrimitive.List.Props>) {
  return (
    <TabsPrimitive.List
      className={cn("glass inline-flex h-10 w-fit max-w-full items-center gap-1 overflow-x-auto rounded-xl p-1", className)}
      {...props}
    />
  );
}
function TabsTrigger({ className, ...props }: WithClass<TabsPrimitive.Tab.Props>) {
  return (
    <TabsPrimitive.Tab
      className={cn(
        "inline-flex h-full items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4",
        "hover:text-foreground data-[active]:bg-primary/15 data-[active]:text-primary data-[active]:shadow-[inset_0_0_0_1px_oklch(0.86_0.15_195/40%),0_0_18px_-6px_var(--neon-cyan)]",
        className,
      )}
      {...props}
    />
  );
}
function TabsContent({ className, ...props }: WithClass<TabsPrimitive.Panel.Props>) {
  return <TabsPrimitive.Panel className={cn("outline-none", className)} {...props} />;
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
