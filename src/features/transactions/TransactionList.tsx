import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { Amount } from '../../components/common/Amount'
import { PaidToggle } from '../../components/common/PaidToggle'
import type { MoneyData } from '../../data/useMoneyData'
import { formatShortDate } from '../../domain/dates'
import { TYPE_LABELS, toneOf } from '../../domain/labels'
import type { Transaction } from '../../domain/types'

function subtitle(t: Transaction, data: Pick<MoneyData, 'cardsById' | 'peopleById'>): string {
  const bits: string[] = [TYPE_LABELS[t.type]]
  if (t.type === 'returned') bits[0] = t.returnDirection === 'by_me' ? 'I returned' : 'Returned to me'
  if (t.type === 'adjustment') bits[0] = `Adjustment (${t.adjustmentDirection ?? ''})`
  const card = t.cardId ? data.cardsById.get(t.cardId) : undefined
  if (card) bits.push(`${card.nickname} ••${card.last4}`)
  const person = t.personId ? data.peopleById.get(t.personId) : undefined
  if (person) bits.push(person.name)
  if (t.merchant) bits.push(t.merchant)
  return bits.join(' · ')
}

interface TransactionListProps {
  items: readonly Transaction[]
  data: Pick<MoneyData, 'cardsById' | 'peopleById'> & Partial<Pick<MoneyData, 'chargeStatuses'>>
  showDate?: boolean
}

export function TransactionList({ items, data, showDate = true }: TransactionListProps) {
  return (
    <ul className="divide-y divide-border">
      {items.map((t) => {
        const tone = toneOf(t)
        const status = data.chargeStatuses?.get(t.id)
        return (
          <li key={t.id} className="flex items-center gap-2">
            <Link to={`/transactions/${t.id}/edit`} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2.5 hover:bg-surface-sunken/60 sm:px-2">
              {showDate && (
                <span className="w-12 shrink-0 text-xs leading-tight text-fg-muted tabular-nums">{formatShortDate(t.date)}</span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-fg">{t.description}</span>
                <span className="block truncate text-xs text-fg-muted">{subtitle(t, data)}</span>
              </span>
              <span className="text-right">
                <Amount paise={t.amount} tone={tone} signed={tone !== 'neutral'} className="font-semibold" />
                {t.type === 'purchase' && t.recoverableAmount > 0 && (
                  <span className="block text-xs text-fg-muted">to recover</span>
                )}
              </span>
              {!status && <ChevronRight className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />}
            </Link>
            {status && <PaidToggle transactionId={t.id} paid={status.status === 'paid'} label={t.description} />}
          </li>
        )
      })}
    </ul>
  )
}
