import { Download } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Amount } from '../../components/common/Amount'
import { Button } from '../../components/common/Button'
import { Card, CardHeader } from '../../components/common/Card'
import { Segmented, SelectInput } from '../../components/common/Field'
import { PageHeader } from '../../components/common/PageHeader'
import { LoadingState, Note } from '../../components/common/StateViews'
import { useMoneyData } from '../../data/useMoneyData'
import { formatMonthKey, formatShortDate, todayISO } from '../../domain/dates'
import { computeTotals } from '../../domain/finance'
import { formatINR } from '../../domain/money'
import {
  RANGE_LABELS,
  cardActivity,
  inRange,
  periodSummaries,
  purchasesByMerchant,
  rangeBounds,
  spendingByCategory,
  transactionsToCSV,
  type Granularity,
  type GroupRow,
  type RangeKey,
} from '../../domain/reports'
import { downloadText } from '../../utils/download'

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-fg-muted">
            {head.map((h, i) => (
              <th key={h} scope="col" className={i === 0 ? 'px-1 py-2 font-medium' : 'px-1 py-2 text-right font-medium'}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  )
}

function GroupTable({ rows, label, empty }: { rows: GroupRow[]; label: string; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-fg-muted">{empty}</p>
  const total = rows.reduce((s, r) => s + r.amount, 0)
  return (
    <Table head={[label, 'Entries', 'Amount']}>
      {rows.map((r) => (
        <tr key={r.label}>
          <td className="px-1 py-2">
            {r.label}
            <span className="block h-1 rounded-full bg-surface-sunken" aria-hidden="true">
              <span className="block h-full rounded-full bg-brand/60" style={{ width: `${String(total > 0 ? Math.max(0, (r.amount / total) * 100) : 0)}%` }} />
            </span>
          </td>
          <td className="px-1 py-2 text-right text-fg-muted tabular-nums">{r.count}</td>
          <td className="px-1 py-2 text-right font-medium tabular-nums">{formatINR(r.amount)}</td>
        </tr>
      ))}
    </Table>
  )
}

const PERIOD_COUNT: Record<Granularity, number> = { day: 14, week: 8, month: 12 }

export function ReportsPage() {
  const data = useMoneyData()
  const [range, setRange] = useState<RangeKey>('this_month')
  const [granularity, setGranularity] = useState<Granularity>('month')

  const scoped = useMemo(() => {
    if (!data) return []
    const { from, to } = rangeBounds(range, data.today)
    return data.transactions.filter((t) => inRange(t, from, to))
  }, [data, range])

  if (!data) return <LoadingState />
  const totals = computeTotals(scoped)
  const periods = periodSummaries(data.transactions, granularity, data.today, PERIOD_COUNT[granularity])
  const owedPeople = data.overview.people.filter((p) => p.balance !== 0).sort((a, b) => b.balance - a.balance)

  const exportCSV = () => {
    downloadText(`money-tracker-transactions-${todayISO()}.csv`, `﻿${transactionsToCSV(data.transactions, data.cards, data.people)}`, 'text/csv;charset=utf-8')
  }

  return (
    <>
      <PageHeader
        title="Reports"
        action={
          <Button variant="secondary" icon={<Download />} onClick={exportCSV} disabled={data.transactions.length === 0}>
            CSV
          </Button>
        }
      />

      <Card className="mb-4">
        <CardHeader title="Summary over time" />
        <Segmented
          name="granularity"
          legend="Group by"
          value={granularity}
          onChange={setGranularity}
          options={[
            { value: 'day', label: 'Daily' },
            { value: 'week', label: 'Weekly' },
            { value: 'month', label: 'Monthly' },
          ]}
        />
        <div className="mt-3">
          <Table head={[granularity === 'week' ? 'Week of' : granularity === 'day' ? 'Day' : 'Month', 'Spent', 'Received', 'Card paid']}>
            {periods.map((p) => (
              <tr key={p.key}>
                <td className="px-1 py-2 whitespace-nowrap">{granularity === 'month' ? formatMonthKey(p.key) : formatShortDate(p.key)}</td>
                <td className="px-1 py-2 text-right">
                  <Amount paise={p.totals.spending} tone={p.totals.spending > 0 ? 'out' : 'neutral'} />
                </td>
                <td className="px-1 py-2 text-right">
                  <Amount paise={p.totals.income + p.totals.refunds + p.totals.cashback} tone={p.totals.income + p.totals.refunds + p.totals.cashback > 0 ? 'in' : 'neutral'} />
                </td>
                <td className="px-1 py-2 text-right text-fg-muted">{formatINR(p.totals.cardPayments)}</td>
              </tr>
            ))}
          </Table>
        </div>
      </Card>

      <div className="mb-3 flex items-center gap-2">
        <label htmlFor="range" className="text-sm font-medium">
          Period
        </label>
        <SelectInput id="range" value={range} onChange={(e) => { setRange(e.target.value as RangeKey) }} className="max-w-48">
          {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => (
            <option key={k} value={k}>
              {RANGE_LABELS[k]}
            </option>
          ))}
        </SelectInput>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Spending & money received" description={RANGE_LABELS[range]} />
          <dl className="space-y-2 text-sm">
            {(
              [
                ['Purchases (total value)', totals.purchases, 'out'],
                ['Fees & interest', totals.fees, 'out'],
                ['Refunds', -totals.refunds, 'in'],
                ['My net spending', totals.spending, 'out'],
              ] as const
            ).map(([label, v, tone]) => (
              <div key={label} className={label.startsWith('My') ? 'flex justify-between border-t border-border pt-2 font-semibold' : 'flex justify-between'}>
                <dt className={label.startsWith('My') ? '' : 'text-fg-muted'}>{label}</dt>
                <dd>
                  <Amount paise={v} tone={tone} signed={label === 'Refunds'} />
                </dd>
              </div>
            ))}
            <div className="pt-3" />
            {(
              [
                ['Money received (income)', totals.income],
                ['Refunds', totals.refunds],
                ['Cashback', totals.cashback],
                ['Recovered from people', totals.recovered],
              ] as const
            ).map(([label, v]) => (
              <div key={label} className="flex justify-between">
                <dt className="text-fg-muted">{label}</dt>
                <dd>
                  <Amount paise={v} tone="in" />
                </dd>
              </div>
            ))}
            <div className="flex justify-between">
              <dt className="text-fg-muted">Credit card bills paid</dt>
              <dd>
                <Amount paise={totals.cardPayments} />
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-fg-muted">
            Purchases made for others aren’t counted in “My net spending”. Loans, borrowing and card bill payments are never counted as
            spending or income.
          </p>
        </Card>

        <Card>
          <CardHeader title="Spending by category" description="Net of refunds" />
          <GroupTable rows={spendingByCategory(scoped)} label="Category" empty="No spending in this period." />
        </Card>

        <Card>
          <CardHeader title="Purchases by store" description="Total purchase value" />
          <GroupTable rows={purchasesByMerchant(scoped)} label="Store" empty="No purchases in this period." />
        </Card>

        <Card>
          <CardHeader title="Credit card activity" description={RANGE_LABELS[range]} />
          {data.cards.length === 0 ? (
            <p className="text-sm text-fg-muted">No cards added.</p>
          ) : (
            <Table head={['Card', 'Spent', 'Credits', 'Paid']}>
              {cardActivity(scoped, data.cards).map((r) => (
                <tr key={r.card.id}>
                  <td className="px-1 py-2">
                    {r.card.nickname} <span className="text-fg-muted">••{r.card.last4}</span>
                  </td>
                  <td className="px-1 py-2 text-right tabular-nums">{formatINR(r.charges)}</td>
                  <td className="px-1 py-2 text-right tabular-nums">{formatINR(r.credits)}</td>
                  <td className="px-1 py-2 text-right tabular-nums">{formatINR(r.payments)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Outstanding card balances" description="Now · estimated" />
          {data.overview.cards.length === 0 ? (
            <p className="text-sm text-fg-muted">No cards added.</p>
          ) : (
            <Table head={['Card', 'Bill left', 'Outstanding']}>
              {data.overview.cards.map((c) => (
                <tr key={c.card.id}>
                  <td className="px-1 py-2">
                    <Link to={`/cards/${c.card.id}`} className="hover:text-brand">
                      {c.card.nickname} <span className="text-fg-muted">••{c.card.last4}</span>
                    </Link>
                  </td>
                  <td className="px-1 py-2 text-right tabular-nums">{formatINR(c.statement.remaining)}</td>
                  <td className="px-1 py-2 text-right font-medium tabular-nums">
                    {c.outstanding < 0 ? `${formatINR(-c.outstanding)} cr` : formatINR(c.outstanding)}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Outstanding by person" description="Now" />
          {owedPeople.length === 0 ? (
            <p className="text-sm text-fg-muted">Everyone is settled.</p>
          ) : (
            <Table head={['Person', 'Owes me', 'I owe']}>
              {owedPeople.map((p) => (
                <tr key={p.person.id}>
                  <td className="px-1 py-2">
                    <Link to={`/people/${p.person.id}`} className="hover:text-brand">
                      {p.person.name}
                    </Link>
                  </td>
                  <td className="px-1 py-2 text-right tabular-nums">{p.balance > 0 ? formatINR(p.balance) : '—'}</td>
                  <td className="px-1 py-2 text-right tabular-nums">{p.balance < 0 ? formatINR(-p.balance) : '—'}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
      <div className="mt-4">
        <Note>Backups (JSON) and restore are in Settings.</Note>
      </div>
    </>
  )
}
