import * as React from "react";
import { useSpotlight } from "@/lib/use-spotlight";
import { cn } from "@/lib/utils";

function Card({ className, spotlight = true, ...props }: React.ComponentProps<"div"> & { spotlight?: boolean }) {
  const ref = useSpotlight<HTMLDivElement>(spotlight);
  return (
    <div
      ref={ref}
      data-slot="card"
      className={cn("glass flex flex-col gap-4 rounded-2xl py-5 text-card-foreground", spotlight && "spotlight", className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-start justify-between gap-3 px-5", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("text-sm font-semibold tracking-wide", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("text-xs text-muted-foreground", className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-5", className)} {...props} />;
}

export { Card, CardContent, CardDescription, CardHeader, CardTitle };
