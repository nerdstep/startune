import { Label as P } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

function Label({ className, ...props }: React.ComponentProps<typeof P.Root>) {
  return <P.Root className={cn("text-sm font-medium select-none", className)} {...props} />;
}

export { Label };
