import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { Login } from "@/components/login";
import { RepoDetailProvider } from "@/components/repo";
import { Logo, Shell } from "@/components/shell";
import { Starfield } from "@/components/starfield";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useMe } from "@/lib/queries";
import { SyncProvider } from "@/lib/sync-context";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Root,
});

function Root() {
  const me = useMe();
  return (
    <TooltipProvider>
      <div className="nebula" />
      <div className="grid-floor" />
      <Starfield />
      {me.isLoading ? (
        <div className="grid min-h-dvh place-items-center">
          <Logo className="animate-pulse" />
        </div>
      ) : me.data?.user ? (
        <SyncProvider>
          <RepoDetailProvider>
            <Shell>
              <Outlet />
            </Shell>
          </RepoDetailProvider>
        </SyncProvider>
      ) : (
        <Login />
      )}
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: "!bg-popover !border-primary/30 !text-foreground !backdrop-blur-xl !shadow-[0_0_30px_-10px_var(--neon-cyan)] !rounded-xl",
            actionButton: "!bg-primary !text-primary-foreground",
          },
        }}
      />
    </TooltipProvider>
  );
}
