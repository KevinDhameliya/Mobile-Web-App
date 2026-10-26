import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { initInstallPromptCapture } from './services/installPrompt'
import './styles/index.css'

// Must run before React mounts: Chromium may fire beforeinstallprompt early.
initInstallPromptCapture()

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root not found in index.html.')

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
