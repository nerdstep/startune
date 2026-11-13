import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
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
      '@': new URL('./src', import.meta.url).pathname,
      '@shared': new URL('./shared', import.meta.url).pathname,
    },
  },
})
