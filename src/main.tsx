import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { ApiError } from './lib/api'
import { qk } from './lib/queries'
import { routeTree } from './routeTree.gen'

import './styles.css'

/**
 * A 401 means the session ended (signed out elsewhere, removed from ALLOWED_USERS, or a GitHub
 * sign-in that could no longer be refreshed): re-read /api/me, which then reports nobody, and the
 * root route shows the sign-in page.
 */
const onAuthError = (e: unknown) => {
  if (e instanceof ApiError && e.status === 401) {
    void queryClient.invalidateQueries({ queryKey: qk.me })
  }
}

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onAuthError }),
  mutationCache: new MutationCache({ onError: onAuthError }),
  defaultOptions: {
    queries: {
      retry: (n, e) => !(e instanceof ApiError && e.status < 500) && n < 2,
      refetchOnWindowFocus: false,
    },
  },
})

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('Missing #root element in index.html')
}

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
