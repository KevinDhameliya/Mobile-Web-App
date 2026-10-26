import { Download, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { useInstallPrompt } from '../../hooks/useInstallPrompt'
import { Button, ButtonLink } from '../common/Button'

interface InstallButtonProps {
  /** Smaller variant for the mobile top bar. */
  compact?: boolean
  fullWidth?: boolean
}

/**
 * - Chromium (Android Chrome, desktop Chrome/Edge): triggers the native prompt.
 * - iOS: no prompt API exists, so links to manual Add to Home Screen steps.
 * - Already installed or unsupported browser: renders nothing.
 */
export function InstallButton({ compact = false, fullWidth = false }: InstallButtonProps) {
  const { isInstalled, canPrompt, platform, install } = useInstallPrompt()
  const [busy, setBusy] = useState(false)

  if (isInstalled) return null

  if (canPrompt) {
    const handleClick = async () => {
      setBusy(true)
      try {
        await install()
      } finally {
        setBusy(false)
      }
    }
    return (
      <Button
        icon={<Download />}
        fullWidth={fullWidth}
        disabled={busy}
        className={compact ? 'min-h-10 px-3' : undefined}
        onClick={() => void handleClick()}
      >
        {compact ? 'Install' : 'Install app'}
      </Button>
    )
  }

  if (platform === 'ios') {
    return (
      <ButtonLink
        to="/settings/install"
        variant="secondary"
        icon={<Smartphone />}
        fullWidth={fullWidth}
        className={compact ? 'min-h-10 px-3' : undefined}
      >
        {compact ? 'Install' : 'How to install'}
      </ButtonLink>
    )
  }

  return null
}
