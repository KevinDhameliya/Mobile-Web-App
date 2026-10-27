import type { Session } from '@supabase/supabase-js'
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { cloud, cloudConfigured } from '../data/cloud'
import { db, isSampleMode } from '../data/db'
import { onLocalChange } from '../data/repo'
import { lastSyncAt as readLastSync, syncNow as runSync } from '../data/syncEngine'
import { SyncContext, type SyncContextValue, type SyncStatus } from '../hooks/syncContext'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { parseSignInLink } from '../domain/signInLink'

const AFTER_CHANGE_MS = 3_000

const PERIODIC_MS = 5 * 60_000

/**
 * Keeps this device in step with the cloud while the user is signed in:
 * on launch, when the app returns to the foreground, when the connection
 * comes back, a few seconds after each local change, and every 5 minutes.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const enabled = cloudConfigured && !isSampleMode
  const online = useOnlineStatus()
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!enabled)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const pending = useLiveQuery(() => db.pending.count(), [], 0)
  const timer = useRef<number | undefined>(undefined)
  const userId = session?.user.id ?? null

  useEffect(() => {
    const supabase = cloud()
    if (!enabled || !supabase) return
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => {
      data.subscription.unsubscribe()
    }
  }, [enabled])

  const syncNow = useCallback(async () => {
    if (!userId || !navigator.onLine) return
    setSyncing(true)
    try {
      const result = await runSync(userId)
      setLastSyncAt(result.at)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed.')
    } finally {
      setSyncing(false)
    }
  }, [userId])

  // Sync on sign-in / launch, and load the last sync time.
  useEffect(() => {
    if (!userId) return
    void readLastSync(userId).then(setLastSyncAt)
    const t = window.setTimeout(() => void syncNow(), 0)
    return () => {
      window.clearTimeout(t)
    }
  }, [userId, syncNow])

  // Sync when the connection returns, on foreground, periodically and after edits.
  useEffect(() => {
    if (!userId) return
    const kick = online ? window.setTimeout(() => void syncNow(), 0) : undefined
    const onVisible = () => {
      if (document.visibilityState === 'visible') void syncNow()
    }
    document.addEventListener('visibilitychange', onVisible)
    const interval = window.setInterval(() => void syncNow(), PERIODIC_MS)
    const stop = onLocalChange(() => {
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => void syncNow(), AFTER_CHANGE_MS)
    })
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(interval)
      window.clearTimeout(kick)
      window.clearTimeout(timer.current)
      stop()
    }
  }, [userId, online, syncNow])

  const sendCode = useCallback(async (email: string) => {
    const supabase = cloud()
    if (!supabase) throw new Error('Cloud sync is not set up in this build.')
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/settings`, shouldCreateUser: true },
    })
    if (err) throw new Error(err.message)
  }, [])

  const verifyCode = useCallback(async (email: string, input: string) => {
    const supabase = cloud()
    if (!supabase) throw new Error('Cloud sync is not set up in this build.')
    const link = parseSignInLink(input)
    const { error: err } = link
      ? await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: link.type })
      : await supabase.auth.verifyOtp({ email: email.trim(), token: input.replace(/\D/g, ''), type: 'email' })
    if (err) throw new Error(err.message === 'Token has expired or is invalid' ? 'That link or code has expired or was already used. Request a new one.' : err.message)
  }, [])

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const supabase = cloud()
    if (!supabase) throw new Error('Cloud sync is not set up in this build.')
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (err) {
      throw new Error(
        err.message === 'Invalid login credentials'
          ? 'Wrong email or password. If you haven’t set a password yet, set one in Cloud sync on a device where you’re already signed in.'
          : err.message,
      )
    }
  }, [])

  const setPassword = useCallback(async (password: string) => {
    const supabase = cloud()
    if (!supabase) throw new Error('Cloud sync is not set up in this build.')
    // Only changes how you sign in; your records are not touched.
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) throw new Error(err.message)
  }, [])

  const signOut = useCallback(async () => {
    // Local data stays on the device; it simply stops syncing.
    await cloud()?.auth.signOut({ scope: 'local' })
    setLastSyncAt(null)
    setError(null)
  }, [])

  let status: SyncStatus
  if (!enabled) status = 'off'
  else if (!ready || !session) status = 'signed-out'
  else if (!online) status = 'offline'
  else if (syncing) status = 'syncing'
  else if (error) status = 'error'
  else status = 'idle'

  const value = useMemo<SyncContextValue>(
    () => ({
      configured: enabled,
      status,
      email: session?.user.email ?? null,
      lastSyncAt,
      pending,
      error,
      sendCode,
      verifyCode,
      signInWithPassword,
      setPassword,
      signOut,
      syncNow,
    }),
    [enabled, status, session, lastSyncAt, pending, error, sendCode, verifyCode, signInWithPassword, setPassword, signOut, syncNow],
  )

  return <SyncContext value={value}>{children}</SyncContext>
}
