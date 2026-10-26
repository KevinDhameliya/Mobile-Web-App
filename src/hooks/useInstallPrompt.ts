import { useCallback, useState, useSyncExternalStore } from 'react'
import {
  getInstallPromptState,
  promptInstall,
  subscribeInstallPrompt,
} from '../services/installPrompt'
import type { InstallPlatform } from '../types/pwa'
import { detectPlatform, isStandalone } from '../utils/platform'

export interface InstallPromptInfo {
  platform: InstallPlatform
  /** Running as an installed app (home screen / standalone window). */
  isInstalled: boolean
  /** A native install dialog is available (Chromium browsers only). */
  canPrompt: boolean
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
}

function subscribeDisplayMode(callback: () => void): () => void {
  const query = window.matchMedia('(display-mode: standalone)')
  query.addEventListener('change', callback)
  return () => {
    query.removeEventListener('change', callback)
  }
}

export function useInstallPrompt(): InstallPromptInfo {
  const promptState = useSyncExternalStore(subscribeInstallPrompt, getInstallPromptState)
  const standalone = useSyncExternalStore(subscribeDisplayMode, isStandalone)
  const [platform] = useState(detectPlatform)

  const install = useCallback(() => promptInstall(), [])

  return {
    platform,
    isInstalled: standalone || promptState.installed,
    canPrompt: promptState.deferredPrompt !== null && !standalone,
    install,
  }
}
