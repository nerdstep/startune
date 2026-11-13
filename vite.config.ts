import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * This project's folder with its on-disk casing. On Windows the shell can hand Vite "c:\…"
 * (VS Code terminals do) while the resolver produces "C:\…" for relative imports. Rolldown treats
 * those as two different modules, so everything reached both ways was bundled twice: two React
 * Query contexts, and every page failed with "No QueryClient set". Root and aliases both use the
 * canonical path.
 */
const ROOT = realpathSync.native(fileURLToPath(new URL('.', import.meta.url)))
const at = (rel: string) => realpathSync.native(`${ROOT}/${rel}`)

export default defineConfig({
  root: ROOT,
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    // Workers AI is always remote. Set CF_LOCAL_ONLY=1 to run without a Cloudflare login (AI calls will fail).
    cloudflare({ remoteBindings: process.env.CF_LOCAL_ONLY !== '1' }),
  ],
  resolve: {
    // Base UI's pre-bundled chunks otherwise embed a second copy of React ("Invalid hook call").
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': at('src'),
      '@shared': at('shared'),
    },
  },
})
