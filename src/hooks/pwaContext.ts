import { createContext } from 'react'

export type UpdateCheckResult = 'update-found' | 'up-to-date' | 'unsupported' | 'error'

export interface PwaContextValue {
  /** Service workers are available in this browser (requires HTTPS or localhost). */
  supported: boolean
  /** A service worker is registered and controlling caching. */
  registered: boolean
  registrationError: string | null
  /** A new version has been downloaded and is waiting for the user. */
  needRefresh: boolean
  /** App shell assets are cached for faster and offline-capable loading. */
  offlineReady: boolean
  /** Activates the waiting version and reloads the page. */
  applyUpdate: () => Promise<void>
  dismissUpdate: () => void
  dismissOfflineReady: () => void
  checkForUpdate: () => Promise<UpdateCheckResult>
}

export const PwaContext = createContext<PwaContextValue | null>(null)
