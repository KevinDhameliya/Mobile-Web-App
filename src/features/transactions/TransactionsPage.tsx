import { History, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Amount } from '../../components/common/Amount'
import { ButtonLink } from '../../components/common/Button'
import { Card } from '../../components/common/Card'
import { SelectInput, TextInput } from '../../components/common/Field'
import { PageHeader } from '../../components/common/PageHeader'
import { EmptyState, LoadingState } from '../../components/common/StateViews'
import { useMoneyData } from '../../data/useMoneyData'
import { formatMonthKey, monthKey } from '../../domain/dates'
import { computeTotals } from '../../domain/finance'
import { TYPE_LABELS } from '../../domain/labels'
import { FILTER_STATUSES, STATUS_LABELS } from '../../domain/payments'
import { TRANSACTION_TYPES, type TransactionType } from '../../domain/types'
import { TransactionList } from './TransactionList'

const PAGE = 100

export function TransactionsPage() {
  const data = useMoneyData()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE)

  const type = params.get('type') ?? ''
  const month = params.get('month') ?? ''
  const cardId = params.get('card') ?? ''
  const personId = params.get('person') ?? ''
  const payStatus = params.get('status') ?? ''

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
    setLimit(PAGE)
  }

  const months = useMemo(() => [...new Set((data?.transactions ?? []).map((t) => monthKey(t.date)))], [data])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    return data.transactions.filter(
      (t) =>
        (!type || t.type === type) &&
        (!month || t.date.startsWith(month)) &&
        (!cardId || t.cardId === cardId) &&
        (!personId || t.personId === personId) &&
        (!payStatus || data.chargeStatuses.get(t.id)?.status === payStatus) &&
        (!q || [t.description, t.merchant, t.category, t.notes].some((s) => s.toLowerCase().includes(q))),
    )
  }, [data, query, type, month, cardId, personId, payStatus])

  if (!data) return <LoadingState />
  const totals = computeTotals(filtered)
  const filtering = Boolean(type || month || cardId || personId || payStatus || query)

  return (
    <>
      <PageHeader
        title="Transactions"
        description={`${String(data.transactions.length)} entries`}
        action={
          <div className="flex gap-2">
            <ButtonLink to="/history" variant="secondary" icon={<History />}>
              History
            </ButtonLink>
            <span className="hidden md:inline-flex">
              <ButtonLink to="/transactions/new" icon={<Plus />}>
                Add
              </ButtonLink>
            </span>
          </div>
        }
      />

      <div className="mb-4 space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
          <TextInput
            type="search"
            aria-label="Search transactions"
            placeholder="Search description, store, category…"
            value={query}
            onChange={(e) => { setQuery(e.target.value) }}
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          <SelectInput aria-label="Filter by type" value={type} onChange={(e) => { setFilter('type', e.target.value) }}>
            <option value="">All types</option>
            {TRANSACTION_TYPES.map((x: TransactionType) => (
              <option key={x} value={x}>
                {TYPE_LABELS[x]}
              </option>
            ))}
          </SelectInput>
          <SelectInput aria-label="Filter by month" value={month} onChange={(e) => { setFilter('month', e.target.value) }}>
            <option value="">All months</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {formatMonthKey(m)}
              </option>
            ))}
          </SelectInput>
          <SelectInput aria-label="Filter by card" value={cardId} onChange={(e) => { setFilter('card', e.target.value) }}>
            <option value="">All cards</option>
            {data.cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nickname} ••{c.last4}
              </option>
            ))}
          </SelectInput>
          <SelectInput aria-label="Filter by payment status" value={payStatus} onChange={(e) => { setFilter('status', e.target.value) }}>
            <option value="">Paid & unpaid</option>
            {FILTER_STATUSES.map((k) => (
              <option key={k} value={k}>
                {STATUS_LABELS[k]} (card)
              </option>
            ))}
          </SelectInput>
          <SelectInput aria-label="Filter by person" value={personId} onChange={(e) => { setFilter('person', e.target.value) }}>
            <option value="">All people</option>
            {data.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectInput>
        </div>
      </div>

      {payStatus === 'unpaid' && filtered.length > 0 && (
        <p className="mb-1 text-sm font-medium text-fg">
          Still to pay on these: <Amount paise={filtered.reduce((sum, t) => sum + (data.chargeStatuses.get(t.id)?.left ?? 0), 0)} tone="out" />
        </p>
      )}
      {filtering && filtered.length > 0 && (
        <p className="mb-3 text-sm text-fg-muted">
          {filtered.length} shown · spending <Amount paise={totals.spending} tone="out" /> · received{' '}
          <Amount paise={totals.income + totals.refunds + totals.cashback} tone="in" />
        </p>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          title={filtering ? 'No matching transactions' : 'No transactions yet'}
          message={filtering ? 'Try changing the filters.' : 'Tap + to record your first purchase, payment or loan.'}
        />
      ) : (
        <Card className="p-3 sm:p-4">
          <TransactionList items={filtered.slice(0, limit)} data={data} />
          {filtered.length > limit && (
            <button type="button" className="mt-2 min-h-11 w-full rounded-xl text-sm font-semibold text-brand hover:bg-surface-sunken" onClick={() => { setLimit((l) => l + PAGE) }}>
              Show more ({filtered.length - limit} left)
            </button>
          )}
        </Card>
      )}
    </>
  )
}
