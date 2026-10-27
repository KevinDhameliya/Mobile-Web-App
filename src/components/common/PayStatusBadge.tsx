import type { ChargeStatus } from '../../domain/payments'
import { STATUS_LABELS } from '../../domain/payments'
import { formatINR } from '../../domain/money'
import type { PayStatus } from '../../domain/types'
import { StatusBadge } from './StatusBadge'

const TONE: Record<PayStatus, 'success' | 'warning' | 'danger'> = { paid: 'success', partly_paid: 'warning', unpaid: 'danger' }

/** Paid / Partly paid · ₹X left / Unpaid for a credit card charge. */
export function PayStatusBadge({ status, compact = false }: { status: ChargeStatus | PayStatus; compact?: boolean }) {
  const s = typeof status === 'string' ? status : status.status
  const left = typeof status === 'string' ? null : status.left
  const label = s === 'partly_paid' && left !== null && !compact ? `Partly paid · ${formatINR(left)} left` : STATUS_LABELS[s]
  return <StatusBadge tone={TONE[s]}>{label}</StatusBadge>
}
