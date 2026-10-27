import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowRight, ChevronLeft, History } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Card } from '../../components/common/Card'
import { SelectInput } from '../../components/common/Field'
import { PageHeader } from '../../components/common/PageHeader'
import { PayStatusBadge } from '../../components/common/PayStatusBadge'
import { StatusBadge } from '../../components/common/StatusBadge'
import { EmptyState, LoadingState } from '../../components/common/StateViews'
import { db } from '../../data/db'
import { useMoneyData } from '../../data/useMoneyData'
import { formatINR } from '../../domain/money'
import type { HistoryEvent } from '../../domain/types'

const dayFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' })

function StatusChip({ status }: { status: HistoryEvent['fromStatus'] | HistoryEvent['toStatus'] }) {
  if (status === null) return <StatusBadge tone="neutral">New</StatusBadge>
  if (status === 'deleted') return <StatusBadge tone="neutral">Deleted</StatusBadge>
  return <PayStatusBadge status={status} compact />
}

/** Every payment-status change of card purchases, newest first, with date and time. */
export function HistoryPage() {
  const data = useMoneyData()
  const [params, setParams] = useSearchParams()
  const txnFilter = params.get('txn') ?? ''
  const cardFilter = params.get('card') ?? ''
  const events = useLiveQuery(() => db.history.orderBy('at').reverse().toArray(), [])

  const filtered = useMemo(
    () => (events ?? []).filter((e) => (!txnFilter || e.transactionId === txnFilter) && (!cardFilter || e.cardId === cardFilter)),
    [events, txnFilter, cardFilter],
  )

  const groups = useMemo(() => {
    const map = new Map<string, HistoryEvent[]>()
    for (const e of filtered) {
      const day = dayFmt.format(new Date(e.at))
      map.set(day, [...(map.get(day) ?? []), e])
    }
    return [...map.entries()]
  }, [filtered])

  if (!data || !events) return <LoadingState />
  const txnName = txnFilter ? (data.transactions.find((t) => t.id === txnFilter)?.description ?? events.find((e) => e.transactionId === txnFilter)?.description) : null

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  return (
    <>
      <Link to="/transactions" className="-ml-1 mb-2 inline-flex min-h-11 items-center gap-1 rounded-lg pr-2 text-sm font-medium text-fg-muted hover:text-fg">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Transactions
      </Link>
      <PageHeader title="Payment history" description="Every change to the paid / unpaid status of your card purchases, with date and time." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SelectInput aria-label="Filter by card" value={cardFilter} onChange={(e) => { setFilter('card', e.target.value) }} className="max-w-60">
          <option value="">All cards</option>
          {data.cards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nickname} ••{c.last4}
            </option>
          ))}
        </SelectInput>
        {txnFilter && (
          <button type="button" onClick={() => { setFilter('txn', '') }} className="min-h-10 rounded-xl bg-brand-soft px-3 text-sm font-medium text-brand-soft-fg">
            Only “{txnName ?? 'this purchase'}” ✕
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<History />}
          title="No status changes yet"
          message="When you add a card purchase or tick purchases in a Credit Card Payment, each change is listed here with its time."
        />
      ) : (
        <div className="space-y-4">
          {groups.map(([day, list]) => (
            <section key={day} aria-label={day}>
              <h2 className="mb-2 text-xs font-semibold tracking-wide text-fg-muted uppercase">{day}</h2>
              <Card className="p-3 sm:p-4">
                <ul className="divide-y divide-border">
                  {list.map((e) => {
                    const card = e.cardId ? data.cardsById.get(e.cardId) : undefined
                    const stillExists = data.transactions.some((t) => t.id === e.transactionId)
                    const payment = e.paymentId ? data.transactions.find((t) => t.id === e.paymentId) : undefined
                    return (
                      <li key={e.id} className="py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            {stillExists ? (
                              <Link to={`/transactions/${e.transactionId}/edit`} className="block truncate font-medium text-fg hover:text-brand">
                                {e.description}
                              </Link>
                            ) : (
                              <span className="block truncate font-medium text-fg">{e.description}</span>
                            )}
                            <span className="block text-xs text-fg-muted">
                              {timeFmt.format(new Date(e.at))} · {e.reason}
                              {card && ` · ${card.nickname} ••${card.last4}`}
                            </span>
                          </div>
                          <span className="shrink-0 text-right text-xs text-fg-muted tabular-nums">
                            Paid {formatINR(e.paidAfter)}
                            <span className="block">of {formatINR(e.owed)}</span>
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <StatusChip status={e.fromStatus} />
                          <ArrowRight className="size-3.5 text-fg-muted" aria-label="changed to" />
                          <StatusChip status={e.toStatus} />
                          {e.paidAfter !== e.paidBefore && e.fromStatus !== null && e.toStatus !== 'deleted' && (
                            <span className="text-xs text-fg-muted">
                              ({e.paidAfter > e.paidBefore ? '+' : '−'}
                              {formatINR(Math.abs(e.paidAfter - e.paidBefore))})
                            </span>
                          )}
                        </div>
                        {payment && (
                          <Link to={`/transactions/${payment.id}/edit`} className="mt-1 inline-block text-xs font-medium text-brand">
                            Card payment: {payment.description} · {formatINR(payment.amount)}
                          </Link>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
