import { Database } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/common/Button'
import { Card, CardHeader } from '../../components/common/Card'
import { clearAppStorage } from '../../utils/storage'

export function DataSettings() {
  const [confirming, setConfirming] = useState(false)

  const reset = () => {
    clearAppStorage()
    window.location.reload()
  }

  return (
    <Card aria-labelledby="data-heading">
      <CardHeader
        id="data-heading"
        icon={<Database />}
        title="Stored data"
        description="Preferences are saved only on this device."
      />
      {confirming ? (
        <div className="flex flex-col gap-2 sm:flex-row" role="group" aria-label="Confirm reset">
          <Button variant="danger" onClick={reset}>
            Yes, reset preferences
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setConfirming(false)
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          variant="secondary"
          onClick={() => {
            setConfirming(true)
          }}
        >
          Reset preferences
        </Button>
      )}
    </Card>
  )
}
