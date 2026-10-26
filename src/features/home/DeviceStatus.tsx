import { Download, RefreshCw, Tag, Wifi } from 'lucide-react'
import { config } from '../../services/config'
import { useInstallPrompt } from '../../hooks/useInstallPrompt'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { usePwa } from '../../hooks/usePwa'
import { StatusTile } from './StatusTile'

/** Real, live status of this device and app — no placeholder data. */
export function DeviceStatus() {
  const online = useOnlineStatus()
  const { isInstalled } = useInstallPrompt()
  const { supported, registered, needRefresh } = usePwa()

  const sw = !supported
    ? { value: 'Unsupported', tone: 'warning' as const, hint: 'This browser has no service worker support.' }
    : needRefresh
      ? { value: 'Update ready', tone: 'brand' as const, hint: 'Reload to use the latest version.' }
      : registered
        ? { value: 'Active', tone: 'success' as const, hint: 'Checks for updates automatically.' }
        : { value: 'Not active', tone: 'neutral' as const, hint: import.meta.env.DEV ? 'Disabled in development mode.' : 'Registers after the first load.' }

  return (
    <section aria-labelledby="status-heading" className="mb-8">
      <h2 id="status-heading" className="mb-3 text-sm font-semibold tracking-wide text-fg-muted uppercase">
        This device
      </h2>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatusTile
          label="Connection"
          icon={<Wifi />}
          value={online ? 'Online' : 'Offline'}
          tone={online ? 'success' : 'warning'}
          hint={online ? 'Network connection detected.' : 'Reconnect to load new content.'}
        />
        <StatusTile
          label="Mode"
          icon={<Download />}
          value={isInstalled ? 'Installed' : 'Browser'}
          tone={isInstalled ? 'success' : 'neutral'}
          hint={isInstalled ? 'Running from the home screen.' : 'Running in a browser tab.'}
        />
        <StatusTile label="Updates" icon={<RefreshCw />} {...sw} />
        <StatusTile label="Version" icon={<Tag />} value={`v${config.appVersion}`} tone="neutral" hint="Current app build." />
      </ul>
    </section>
  )
}
