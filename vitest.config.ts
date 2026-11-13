import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

const alias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
  '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
}

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: { name: 'unit', include: ['test/**/*.test.ts'], environment: 'node' },
      },
      {
        // Components in a real browser, on demo data: hover, focus and CSS behave as in the app.
        plugins: [react(), tailwindcss()],
        resolve: { alias },
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.tsx'],
          setupFiles: ['src/browser-test-setup.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            // Desktop: row toolbars hide until hover from md (48rem) up.
            viewport: { width: 1280, height: 800 },
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
