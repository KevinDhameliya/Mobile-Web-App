import { CircleCheck, History, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../../components/common/Button'
import { Card } from '../../components/common/Card'
import { PayStatusBadge } from '../../components/common/PayStatusBadge'
import { setPaid } from '../../data/repo'
import { formatINR } from '../../domain/money'
import type { ChargeStatus } from '../../domain/payments'

const whenFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/** Paid / unpaid status of one card purchase, with a one-tap toggle. */
export function ChargeStatusPanel({ transactionId, status }: { transactionId: string; status: ChargeStatus }) {
  const [busy, setBusy] = useState(false)
  const paid = status.status === 'paid'

  const toggle = () => {
    setBusy(true)
    void setPaid(transactionId, !paid).finally(() => { setBusy(false) })
  }

  return (
    <Card className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-fg">Payment status</span>
          <PayStatusBadge status={status} />
        </div>
        <Link to={`/history?txn=${transactionId}`} className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-brand">
          <History className="size-4" aria-hidden="true" />
          History
        </Link>
      </div>
      <p className="mt-1 text-sm text-fg-muted">
        {paid
          ? status.paidAt
            ? `Marked paid on ${whenFmt.format(new Date(status.paidAt))}`
            : 'Paid'
          : `${formatINR(status.owed)} not marked as paid yet`}
      </p>
      <Button
        className="mt-3 w-full sm:w-auto"
        variant={paid ? 'secondary' : 'primary'}
        icon={paid ? <RotateCcw /> : <CircleCheck />}
        disabled={busy}
        onClick={toggle}
      >
        {paid ? 'Mark as unpaid' : 'Mark as paid'}
      </Button>
    </Card>
  )
}
