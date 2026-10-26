import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'

export function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null
  return (
    <div role="status" className="border-b border-border bg-warning-soft px-safe py-2.5 text-sm text-fg md:px-8">
      <p className="mx-auto flex max-w-5xl items-center gap-2">
        <WifiOff className="size-4 shrink-0 text-warning" aria-hidden="true" />
        You’re offline. Screens already open keep working, but new data and pages need a connection.
      </p>
    </div>
  )
}
