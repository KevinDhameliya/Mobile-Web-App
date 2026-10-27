import { createContext } from 'react'

export type SyncStatus = 'off' | 'signed-out' | 'idle' | 'syncing' | 'offline' | 'error'

export interface SyncContextValue {
  /** The app was built with cloud settings (Supabase URL + key). */
  configured: boolean
  status: SyncStatus
  email: string | null
  lastSyncAt: string | null
  /** Local changes not uploaded yet. */
  pending: number
  error: string | null
  /** Emails a one-time sign-in link. */
  sendCode: (email: string) => Promise<void>
  /** Signs in with a pasted sign-in link (or a one-time code). */
  verifyCode: (email: string, linkOrCode: string) => Promise<void>
  signOut: () => Promise<void>
  syncNow: () => Promise<void>
}

export const SyncContext = createContext<SyncContextValue | null>(null)
