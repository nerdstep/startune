import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { Toaster } from 'sonner'

import { Login } from '@/components/login'
import { RepoDetailProvider } from '@/components/repo'
import { Logo, Shell } from '@/components/shell'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useMe } from '@/lib/queries'
import { SyncProvider } from '@/lib/sync-context'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Root,
})

function Gate() {
  const me = useMe()
  if (me.isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Logo className="opacity-60" />
      </div>
    )
  }
  if (!me.data?.user) {
    return <Login />
  }
  return (
    <SyncProvider>
      <RepoDetailProvider>
        <Shell>
          <Outlet />
        </Shell>
      </RepoDetailProvider>
    </SyncProvider>
  )
}

function Root() {
  return (
    <TooltipProvider>
      <Gate />
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast:
              'bg-popover! border-border! text-foreground! shadow-xl! shadow-black/40! rounded-lg!',
            actionButton: 'bg-transparent! border! border-primary/80! text-primary! rounded-md!',
          },
        }}
      />
    </TooltipProvider>
  )
}
