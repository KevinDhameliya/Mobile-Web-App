import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { db, isSampleMode } from './data/db'
import { initInstallPromptCapture } from './services/installPrompt'
import './styles/index.css'

// Must run before React mounts: Chromium may fire beforeinstallprompt early.
initInstallPromptCapture()

// Development preview only: fill the separate sample database on first use.
if (import.meta.env.DEV && isSampleMode) {
  void import('./data/sampleData').then((m) => m.seedIfEmpty(db))
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root not found in index.html.')

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
