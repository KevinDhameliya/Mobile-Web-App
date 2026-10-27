import { History } from 'lucide-react'
import { Link } from 'react-router'
import { Card } from '../../components/common/Card'
import { PayStatusBadge } from '../../components/common/PayStatusBadge'
import { formatShortDate } from '../../domain/dates'
import { formatINR } from '../../domain/money'
import type { ChargeStatus } from '../../domain/payments'

/** Payment status of one card purchase, shown on its edit screen. */
export function ChargeStatusPanel({ transactionId, status }: { transactionId: string; status: ChargeStatus }) {
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
      <p className="mt-2 text-sm text-fg-muted">
        Paid {formatINR(status.paid)} of {formatINR(status.owed)}
        {status.left > 0 && ` · ${formatINR(status.left)} left`}
      </p>
      {status.payments.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm">
          {status.payments.map(({ payment, amount }) => (
            <li key={payment.id}>
              <Link to={`/transactions/${payment.id}/edit`} className="text-fg hover:text-brand">
                {formatINR(amount)} by card payment on {formatShortDate(payment.date)} ({payment.description})
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-fg-muted">To mark it paid, open (or add) a Credit Card Payment for this card and tick this purchase.</p>
      )}
    </Card>
  )
}
