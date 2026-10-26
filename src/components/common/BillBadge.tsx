import type { CardStatement } from '../../domain/finance'
import { StatusBadge } from './StatusBadge'

export function BillBadge({ statement }: { statement: CardStatement }) {
  switch (statement.status) {
    case 'paid':
      return <StatusBadge tone="success">Paid</StatusBadge>
    case 'no_dues':
      return <StatusBadge tone="neutral">No dues</StatusBadge>
    case 'overdue':
      return <StatusBadge tone="danger">Overdue</StatusBadge>
    case 'pending': {
      const d = statement.daysUntilDue
      return <StatusBadge tone="warning">{d === 0 ? 'Pending · due today' : `Pending · ${String(d)} day${d === 1 ? '' : 's'}`}</StatusBadge>
    }
  }
}
