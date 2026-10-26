import { CheckCircle2, RefreshCw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { usePwa } from '../../hooks/usePwa'
import { Button } from '../common/Button'

const OFFLINE_READY_DISMISS_MS = 6000

/** Toast shown when a new version is waiting, or when caching first completes. */
export function UpdatePrompt() {
  const { needRefresh, offlineReady, applyUpdate, dismissUpdate, dismissOfflineReady } = usePwa()
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (!offlineReady) return
    const timer = window.setTimeout(dismissOfflineReady, OFFLINE_READY_DISMISS_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [offlineReady, dismissOfflineReady])

  if (!needRefresh && !offlineReady) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-safe md:bottom-6 md:justify-end md:px-6">
      <div role="status" aria-live="polite" className="pointer-events-auto w-full max-w-sm rounded-2xl border border-border bg-surface-raised p-4 shadow-lg">
        {needRefresh ? (
          <>
            <div className="flex gap-3">
              <RefreshCw className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
              <div>
                <p className="font-semibold text-fg">Update available</p>
                <p className="mt-0.5 text-sm text-fg-muted">A new version of the app is ready. Reload to start using it.</p>
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" onClick={dismissUpdate}>
                Later
              </Button>
              <Button
                disabled={updating}
                onClick={() => {
                  setUpdating(true)
                  void applyUpdate()
                }}
              >
                {updating ? 'Updating…' : 'Reload'}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
            <p className="flex-1 text-sm text-fg">App files are cached on this device for faster loading.</p>
            <button
              type="button"
              onClick={dismissOfflineReady}
              aria-label="Dismiss"
              className="-m-2 grid size-11 place-items-center rounded-lg text-fg-muted hover:bg-surface-sunken"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
