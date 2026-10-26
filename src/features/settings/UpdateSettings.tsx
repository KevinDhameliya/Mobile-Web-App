import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/common/Button'
import { Card, CardHeader } from '../../components/common/Card'
import type { UpdateCheckResult } from '../../hooks/pwaContext'
import { usePwa } from '../../hooks/usePwa'
import { config } from '../../services/config'

const MESSAGES: Record<UpdateCheckResult, string> = {
  'update-found': 'A new version was found. It will be ready to install in a moment.',
  'up-to-date': 'You’re on the latest version.',
  unsupported: 'Update checks aren’t available here (service worker inactive — e.g. development mode or an unsupported browser).',
  error: 'Couldn’t check for updates. Check your connection and try again.',
}

export function UpdateSettings() {
  const { checkForUpdate, needRefresh, applyUpdate, registrationError } = usePwa()
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<UpdateCheckResult | null>(null)

  const handleCheck = async () => {
    setChecking(true)
    setResult(null)
    try {
      setResult(await checkForUpdate())
    } finally {
      setChecking(false)
    }
  }

  return (
    <Card aria-labelledby="updates-heading">
      <CardHeader
        id="updates-heading"
        icon={<RefreshCw />}
        title="Updates"
        description={`Version ${config.appVersion}. New versions are detected automatically.`}
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        {needRefresh ? (
          <Button onClick={() => void applyUpdate()}>Reload to update</Button>
        ) : (
          <Button variant="secondary" disabled={checking} onClick={() => void handleCheck()}>
            {checking ? 'Checking…' : 'Check for updates'}
          </Button>
        )}
      </div>
      <p aria-live="polite" className="mt-3 min-h-5 text-sm text-fg-muted">
        {registrationError ? `Service worker error: ${registrationError}` : result ? MESSAGES[result] : ''}
      </p>
    </Card>
  )
}
