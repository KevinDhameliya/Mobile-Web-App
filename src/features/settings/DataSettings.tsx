import { Database } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../../components/common/Button'
import { Card, CardHeader } from '../../components/common/Card'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { TextInput } from '../../components/common/Field'
import { requestPersistentStorage } from '../../data/db'
import { deleteAllData } from '../../data/repo'
import { useMoneyData } from '../../data/useMoneyData'

export function DataSettings() {
  const data = useMoneyData()
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    void requestPersistentStorage().then(setPersisted)
  }, [])

  return (
    <Card aria-labelledby="data-heading">
      <CardHeader id="data-heading" icon={<Database />} title="Stored data" description="Saved in this browser’s IndexedDB on this device." />
      <dl className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-fg-muted">Transactions</dt>
          <dd>{data?.transactions.length ?? '…'}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-fg-muted">Cards / people</dt>
          <dd>
            {data?.cards.length ?? '…'} / {data?.people.length ?? '…'}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-fg-muted">Protected from automatic cleanup</dt>
          <dd>{persisted === null ? 'Unknown' : persisted ? 'Yes' : 'No — keep backups'}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-fg-muted">
        Clearing this site’s data in browser settings, or uninstalling the browser, deletes your records. App updates never erase
        them.
      </p>
      <Button variant="danger" className="mt-4" onClick={() => { setConfirming(true) }}>
        Delete all data…
      </Button>
      {done && <p className="mt-2 text-sm text-fg-muted">All data deleted.</p>}

      <ConfirmDialog
        open={confirming}
        title="Delete all data permanently?"
        confirmLabel="Delete everything"
        destructive
        onCancel={() => {
          setConfirming(false)
          setTyped('')
        }}
        onConfirm={() => {
          if (typed.trim().toUpperCase() !== 'DELETE') return
          void deleteAllData().then(() => {
            setConfirming(false)
            setTyped('')
            setDone(true)
          })
        }}
      >
        <p>All cards, people and transactions on this device will be removed. Download a backup first if you may need them.</p>
        <label className="block">
          <span className="text-fg">
            Type <strong>DELETE</strong> to confirm
          </span>
          <TextInput className="mt-1" value={typed} onChange={(e) => { setTyped(e.target.value) }} autoComplete="off" />
        </label>
      </ConfirmDialog>
    </Card>
  )
}
