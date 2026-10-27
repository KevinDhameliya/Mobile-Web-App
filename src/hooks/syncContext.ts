import { createContext } from 'react'

export type SyncStatus = 'off' | 'signed-out' | 'idle' | 'syncing' | 'offline' | 'error'

export interface SyncContextValue {
  /** The app was built with cloud settings (Supabase URL + key). */
  configured: boolean
  /** The saved sign-in has been checked (until then, show a loading screen). */
  authReady: boolean
  /** This device holds data owned by a different account; sync is paused. */
  foreignData: boolean
  /** Removes all data from this device only (nothing changes in the cloud). */
  clearThisDevice: () => Promise<void>
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
  /** Signs in with email + password (no email is sent). */
  signInWithPassword: (email: string, password: string) => Promise<void>
  /** Sets or changes the password of the signed-in account. */
  setPassword: (password: string) => Promise<void>
  signOut: () => Promise<void>
  syncNow: () => Promise<void>
}

export const SyncContext = createContext<SyncContextValue | null>(null)
