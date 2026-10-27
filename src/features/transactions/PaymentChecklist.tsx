import { useMemo } from 'react'
import { PayStatusBadge } from '../../components/common/PayStatusBadge'
import type { MoneyData } from '../../data/useMoneyData'
import { formatShortDate } from '../../domain/dates'
import { formatINR, paiseToInput, parseRupees } from '../../domain/money'
import { computeChargeStatuses, isCardCharge } from '../../domain/payments'
import { cn } from '../../utils/cn'

interface Props {
  data: MoneyData
  cardId: string
  /** Id of the card payment being added/edited (its own ticks don't count against purchases). */
  paymentId: string
  /** purchase id → amount text; present = ticked */
  alloc: Record<string, string>
  error?: string
  onChange: (alloc: Record<string, string>, totalPaise: number) => void
}

function total(alloc: Record<string, string>): number {
  let sum = 0
  for (const v of Object.values(alloc)) {
    const r = parseRupees(v)
    if (r.ok) sum += r.value
  }
  return sum
}

/**
 * "Which purchases does this payment pay?" — the user ticks card purchases
 * that are not fully paid yet and can lower the amount for a partial payment.
 */
export function PaymentChecklist({ data, cardId, paymentId, alloc, error, onChange }: Props) {
  // Status as if this payment didn't exist, so editing it shows its purchases as payable again.
  const rows = useMemo(() => {
    const others = data.transactions.filter((t) => t.id !== paymentId)
    const statuses = computeChargeStatuses(others)
    return others
      .filter((t) => isCardCharge(t) && t.cardId === cardId)
      .map((t) => ({ txn: t, status: statuses.get(t.id) }))
      .filter((r) => r.status && (r.status.left > 0 || r.txn.id in alloc))
      .sort((a, b) => a.txn.date.localeCompare(b.txn.date) || a.txn.createdAt.localeCompare(b.txn.createdAt))
  }, [data.transactions, paymentId, cardId, alloc])

  const selectedTotal = total(alloc)

  const toggle = (id: string, left: number) => {
    const next = id in alloc ? Object.fromEntries(Object.entries(alloc).filter(([k]) => k !== id)) : { ...alloc, [id]: paiseToInput(left) }
    onChange(next, total(next))
  }

  const setAmount = (id: string, value: string) => {
    const next = { ...alloc, [id]: value }
    onChange(next, total(next))
  }

  const allLeft = rows.reduce((s, r) => s + (r.status?.left ?? 0), 0)

  return (
    <fieldset className="rounded-xl border border-border p-3">
      <legend className="px-1 text-sm font-medium text-fg">Which purchases does this payment pay?</legend>
      {rows.length === 0 ? (
        <p className="text-sm text-fg-muted">No unpaid purchases on this card.</p>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-fg-muted">
            <span>
              {rows.length} unpaid · {formatINR(allLeft)} in total
            </span>
            <button
              type="button"
              className="min-h-9 rounded-lg px-2 font-semibold text-brand hover:bg-surface-sunken"
              onClick={() => {
                const everything = Object.keys(alloc).length === rows.length
                const next = everything ? {} : Object.fromEntries(rows.map((r) => [r.txn.id, paiseToInput(r.status?.left ?? 0)]))
                onChange(next, total(next))
              }}
            >
              {Object.keys(alloc).length === rows.length ? 'Untick all' : 'Tick all'}
            </button>
          </div>
          <ul className="divide-y divide-border">
            {rows.map(({ txn, status }) => {
              const ticked = txn.id in alloc
              const left = status?.left ?? 0
              return (
                <li key={txn.id} className="py-2">
                  <div className="flex items-start gap-3">
                    <input
                      id={`pay-${txn.id}`}
                      type="checkbox"
                      checked={ticked}
                      onChange={() => { toggle(txn.id, left) }}
                      className="mt-1 size-5 shrink-0 accent-[var(--brand)]"
                    />
                    <label htmlFor={`pay-${txn.id}`} className="min-w-0 flex-1 cursor-pointer">
                      <span className="block truncate text-sm font-medium text-fg">{txn.description}</span>
                      <span className="block text-xs text-fg-muted">
                        {formatShortDate(txn.date)} · {formatINR(txn.amount)}
                        {status && status.paid > 0 && ` · ${formatINR(status.paid)} paid before`}
                      </span>
                      {status && (
                        <span className="mt-1 block">
                          <PayStatusBadge status={status} />
                        </span>
                      )}
                    </label>
                    {ticked && (
                      <div className="w-28 shrink-0">
                        <label htmlFor={`amt-${txn.id}`} className="sr-only">
                          Amount paid for {txn.description}
                        </label>
                        <input
                          id={`amt-${txn.id}`}
                          inputMode="decimal"
                          value={alloc[txn.id]}
                          onChange={(e) => { setAmount(txn.id, e.target.value) }}
                          className={cn(
                            'h-10 w-full rounded-lg border bg-surface-raised px-2 text-right text-sm tabular-nums text-fg',
                            'border-border focus:border-brand focus:outline-none',
                          )}
                        />
                        <span className="mt-0.5 block text-right text-[11px] text-fg-muted">of {formatINR(left)} left</span>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-sm text-fg">
            Ticked: <strong className="tabular-nums">{formatINR(selectedTotal)}</strong>
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <p className="mt-2 text-xs text-fg-muted">
        Tick the purchases this payment covers. Lower an amount for a part payment. The payment can be more than the ticked total (e.g. old
        dues).
      </p>
    </fieldset>
  )
}
