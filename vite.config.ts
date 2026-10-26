import { readFileSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string
}

const APP_NAME = 'Money Tracker'
const APP_SHORT_NAME = 'Money'
const THEME_COLOR = '#4f46e5'
const BACKGROUND_COLOR = '#ffffff'

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // "prompt" waits for the user to accept an update instead of swapping
      // code underneath an open page. See src/components/pwa/UpdatePrompt.tsx.
      registerType: 'prompt',
      // Registration happens through the useRegisterSW hook (virtual module).
      injectRegister: false,
      includeAssets: ['icons/favicon.ico', 'icons/apple-touch-icon-180x180.png', 'theme-init.js'],
      manifest: {
        id: '/',
        name: APP_NAME,
        short_name: APP_SHORT_NAME,
        description: 'Track purchases, credit card bills and money owed to and by friends. Works offline; data stays on your device.',
        lang: 'en',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'any',
        theme_color: THEME_COLOR,
        background_color: BACKGROUND_COLOR,
        categories: ['finance', 'productivity'],
        icons: [
          { src: '/icons/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the whole app shell (including index.html) so the app opens
        // and works fully offline. All data lives in IndexedDB, not the cache.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        globIgnores: ['**/node_modules/**'],
        // Any in-app URL (e.g. /cards/abc after a refresh offline) gets the
        // cached app shell; React Router then renders the right screen.
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/sw\.js$/, /^\/workbox-/, /^\/manifest\.webmanifest$/, /^\/icons\//],
        cleanupOutdatedCaches: true,
        // Safe updates: a new version waits until the user taps "Reload" in the
        // update prompt, so code is never swapped under an open form.
        skipWaiting: false,
        clientsClaim: false,
      },
      devOptions: {
        // Keep the service worker off in `npm run dev` to avoid cache confusion.
        // Use `npm run build && npm run preview` to test PWA behaviour.
        enabled: false,
      },
    }),
  ],
})
