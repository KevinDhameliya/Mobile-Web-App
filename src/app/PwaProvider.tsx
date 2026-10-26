import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { PwaContext, type PwaContextValue, type UpdateCheckResult } from '../hooks/pwaContext'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000 // hourly while the app stays open

/**
 * Owns the single service-worker registration and shares its state.
 * registerType is "prompt": a new version waits until the user accepts it,
 * so code is never swapped underneath an open page.
 */
export function PwaProvider({ children }: { children: ReactNode }) {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)
  const [registered, setRegistered] = useState(false)
  const [registrationError, setRegistrationError] = useState<string | null>(null)
  const supported = 'serviceWorker' in navigator

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      registrationRef.current = registration
      setRegistered(true)
    },
    onRegisterError(error: unknown) {
      setRegistrationError(error instanceof Error ? error.message : 'Service worker registration failed.')
    },
  })

  // Periodically look for a new deployment while the app is open, and also
  // whenever the app returns to the foreground (common on phones).
  useEffect(() => {
    if (!registered) return
    const check = () => {
      const registration = registrationRef.current
      if (!registration || !navigator.onLine || registration.installing) return
      registration.update().catch(() => {
        /* transient network failure — next check will retry */
      })
    }
    const interval = window.setInterval(check, UPDATE_CHECK_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [registered])

  const checkForUpdate = useCallback(async (): Promise<UpdateCheckResult> => {
    const registration = registrationRef.current
    if (!supported || !registration) return 'unsupported'
    try {
      await registration.update()
      return registration.installing || registration.waiting ? 'update-found' : 'up-to-date'
    } catch {
      return 'error'
    }
  }, [supported])

  const applyUpdate = useCallback(() => updateServiceWorker(true), [updateServiceWorker])
  const dismissUpdate = useCallback(() => {
    setNeedRefresh(false)
  }, [setNeedRefresh])
  const dismissOfflineReady = useCallback(() => {
    setOfflineReady(false)
  }, [setOfflineReady])

  const value = useMemo<PwaContextValue>(
    () => ({
      supported,
      registered,
      registrationError,
      needRefresh,
      offlineReady,
      applyUpdate,
      dismissUpdate,
      dismissOfflineReady,
      checkForUpdate,
    }),
    [supported, registered, registrationError, needRefresh, offlineReady, applyUpdate, dismissUpdate, dismissOfflineReady, checkForUpdate],
  )

  return <PwaContext value={value}>{children}</PwaContext>
}
