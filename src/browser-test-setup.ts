// Setup for *.browser.test.tsx (vitest.config.ts): the app's styles, and demo data, set before
// src/lib/api.ts picks its backend (src/lib/demo.ts).
import '@/styles.css'

localStorage.setItem('startune:demo', '1')
