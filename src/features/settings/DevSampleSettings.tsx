import { FlaskConical } from 'lucide-react'
import { Button } from '../../components/common/Button'
import { Card, CardHeader } from '../../components/common/Card'
import { db, isSampleMode, setSampleMode } from '../../data/db'
import { loadSampleData } from '../../data/sampleData'

/**
 * Development preview only (never bundled in production).
 * Sample data lives in a separate IndexedDB database, so it can never mix
 * with real records.
 */
export default function DevSampleSettings() {
  return (
    <Card aria-labelledby="dev-heading">
      <CardHeader
        id="dev-heading"
        icon={<FlaskConical />}
        title="Developer preview"
        description={isSampleMode ? 'Using the separate SAMPLE database.' : 'Using your real database.'}
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        {isSampleMode ? (
          <>
            <Button variant="secondary" onClick={() => void loadSampleData(db).then(() => { window.location.reload() })}>
              Reset sample data
            </Button>
            <Button onClick={() => { setSampleMode(false) }}>Back to real data</Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => { setSampleMode(true) }}>
            Preview with sample data
          </Button>
        )}
      </div>
    </Card>
  )
}
