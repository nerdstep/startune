import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn } from "@/lib/utils";

type WithClass<P> = Omit<P, "className"> & { className?: string };

function Tabs({ className, ...props }: WithClass<TabsPrimitive.Root.Props>) {
  return <TabsPrimitive.Root className={cn("flex flex-col gap-4", className)} {...props} />;
}
function TabsList({ className, ...props }: WithClass<TabsPrimitive.List.Props>) {
  return (
    <TabsPrimitive.List
      className={cn("inline-flex h-9 w-fit max-w-full items-center gap-0.5 overflow-x-auto rounded-md border bg-background p-0.5", className)}
      {...props}
    />
  );
}
function TabsTrigger({ className, ...props }: WithClass<TabsPrimitive.Tab.Props>) {
  return (
    <TabsPrimitive.Tab
      className={cn(
        "inline-flex h-full items-center justify-center gap-1.5 rounded-sm px-3 text-[13px] font-medium whitespace-nowrap text-muted-foreground transition-colors duration-100 outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5",
        "hover:text-foreground data-[active]:bg-secondary data-[active]:text-foreground data-[active]:shadow-[inset_0_-1px_0_var(--primary)]",
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
