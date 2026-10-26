import type { BeforeInstallPromptEvent } from '../types/pwa'

/**
 * Captures the Chromium `beforeinstallprompt` event as early as possible
 * (before React mounts) and exposes it as a tiny external store.
 * Safari and Firefox never fire this event — callers must handle `null`.
 */
interface InstallPromptState {
  deferredPrompt: BeforeInstallPromptEvent | null
  installed: boolean
}

let state: InstallPromptState = { deferredPrompt: null, installed: false }
const listeners = new Set<() => void>()

function setState(next: Partial<InstallPromptState>): void {
  state = { ...state, ...next }
  listeners.forEach((listener) => {
    listener()
  })
}

export function initInstallPromptCapture(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Stop the mini-infobar so we can show our own button instead.
    event.preventDefault()
    setState({ deferredPrompt: event as BeforeInstallPromptEvent })
  })
  window.addEventListener('appinstalled', () => {
    setState({ deferredPrompt: null, installed: true })
  })
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getInstallPromptState(): InstallPromptState {
  return state
}

/** Shows the native install dialog. The event can only be used once. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const { deferredPrompt } = state
  if (!deferredPrompt) return 'unavailable'
  await deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  setState({ deferredPrompt: null, installed: outcome === 'accepted' || state.installed })
  return outcome
}
