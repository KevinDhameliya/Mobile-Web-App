import { readFileSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string
}

const APP_NAME = 'Mobile Web App'
const APP_SHORT_NAME = 'WebApp'
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
        description: 'An installable, mobile-first progressive web app starter.',
        lang: 'en',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'any',
        theme_color: THEME_COLOR,
        background_color: BACKGROUND_COLOR,
        categories: ['productivity', 'utilities'],
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
        // Precache the hashed build output plus the offline page.
        // index.html is deliberately NOT precached: navigations always go to
        // the network so users never get stuck on stale HTML.
        globPatterns: ['**/*.{js,css,svg,png,ico,woff2}', 'offline.html'],
        globIgnores: ['**/node_modules/**'],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        // Updates are activated only when the user accepts the prompt.
        skipWaiting: false,
        clientsClaim: false,
        runtimeCaching: [
          {
            // Page navigations: network only, falling back to /offline.html
            // when the device is offline.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkOnly',
            options: {
              precacheFallback: { fallbackURL: '/offline.html' },
            },
          },
          // API requests are intentionally not cached: they pass straight to
          // the network. Add a narrowly scoped rule here only for public,
          // non-sensitive endpoints if offline data is ever needed.
        ],
      },
      devOptions: {
        // Keep the service worker off in `npm run dev` to avoid cache confusion.
        // Use `npm run build && npm run preview` to test PWA behaviour.
        enabled: false,
      },
    }),
  ],
})
