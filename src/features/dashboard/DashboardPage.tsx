import { ArrowDownLeft, ArrowUpRight, CalendarClock, CreditCard, HandCoins, Plus, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Amount } from '../../components/common/Amount'
import { BillBadge } from '../../components/common/BillBadge'
import { ButtonLink } from '../../components/common/Button'
import { Card, CardHeader } from '../../components/common/Card'
import { PageHeader } from '../../components/common/PageHeader'
import { EmptyState, LoadingState, Note } from '../../components/common/StateViews'
import { useMoneyData } from '../../data/useMoneyData'
import { formatDate, formatMonthKey } from '../../domain/dates'
import { computeTotals, isDueSoon } from '../../domain/finance'
import { formatINR } from '../../domain/money'
import { periodSummaries } from '../../domain/reports'
import { TransactionList } from '../transactions/TransactionList'

function Stat({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-raised p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs font-medium text-fg-muted [&_svg]:size-4">
        <span aria-hidden="true">{icon}</span>
        {label}
      </p>
      <p className="mt-1.5 text-xl font-bold sm:text-2xl">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-fg-muted">{hint}</p>}
    </div>
  )
}

export function DashboardPage() {
  const data = useMoneyData()
  if (!data) return <LoadingState />

  const { overview, transactions, today } = data
  const t = overview.totals
  const monthPrefix = today.slice(0, 7)
  const thisMonth = computeTotals(transactions.filter((x) => x.date.startsWith(monthPrefix)))
  const dueSoon = overview.cards.filter((c) => !c.card.archived && isDueSoon(c.statement))
  const months = periodSummaries(transactions, 'month', today, 6)
  const maxMonth = Math.max(1, ...months.map((m) => m.totals.spending))

  if (transactions.length === 0 && data.cards.length === 0) {
    return (
      <>
        <PageHeader title="Dashboard" description="Track purchases, card bills and money between you and others." />
        <EmptyState
          icon={<Wallet />}
          title="Start tracking"
          message="Add your credit cards first, then record purchases, payments and money you lend or receive."
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <ButtonLink to="/cards/new" icon={<CreditCard />} variant="secondary">
                Add a credit card
              </ButtonLink>
              <ButtonLink to="/transactions/new" icon={<Plus />}>
                Add transaction
              </ButtonLink>
            </div>
          }
        />
      </>
    )
  }

  return (
    <>
      <PageHeader title="Dashboard" description={`All-time totals · ${formatDate(today)}`} />

      {/* What I owe vs what is owed to me */}
      <section aria-labelledby="balances-heading" className="mb-6">
        <h2 id="balances-heading" className="sr-only">
          Balances
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface-raised p-4 shadow-sm">
            <p className="text-sm font-semibold text-fg">I owe</p>
            <dl className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">Credit cards (estimated)</dt>
                <dd className="font-semibold">
                  <Amount paise={overview.cardOutstanding} />
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">People</dt>
                <dd className="font-semibold">
                  <Amount paise={overview.iOwePeople} />
                </dd>
              </div>
            </dl>
          </div>
          <div className="rounded-2xl border border-border bg-surface-raised p-4 shadow-sm">
            <p className="text-sm font-semibold text-fg">Owed to me</p>
            <dl className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">People still owe me</dt>
                <dd className="font-semibold">
                  <Amount paise={overview.owedToMe} />
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">Recovered so far</dt>
                <dd className="font-semibold">
                  <Amount paise={t.recovered} />
                </dd>
              </div>
            </dl>
          </div>
        </div>
        <p className="mt-2 text-sm text-fg-muted">
          Net position (owed to me − I owe):{' '}
          <span className="font-semibold text-fg tabular-nums">
            {overview.netPosition < 0 ? '−' : ''}
            {formatINR(Math.abs(overview.netPosition))}
          </span>
        </p>
      </section>

      <section aria-labelledby="totals-heading" className="mb-6">
        <h2 id="totals-heading" className="mb-2 text-sm font-semibold tracking-wide text-fg-muted uppercase">
          Totals
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            icon={<ArrowUpRight />}
            label="Total purchases"
            value={<Amount paise={t.purchases} tone="out" />}
            hint={`My spending: ${formatINR(t.spending)}`}
          />
          <Stat
            icon={<ArrowDownLeft />}
            label="Money received"
            value={<Amount paise={t.income + t.refunds + t.cashback} tone="in" />}
            hint={`Income ${formatINR(t.income)} · Refunds ${formatINR(t.refunds)} · Cashback ${formatINR(t.cashback)}`}
          />
          <Stat icon={<HandCoins />} label="Owed to me" value={<Amount paise={overview.owedToMe} />} hint="Not yet paid back" />
          <Stat icon={<CreditCard />} label="Card outstanding" value={<Amount paise={overview.cardOutstanding} />} hint="Estimate · check statement" />
        </div>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card aria-labelledby="due-heading">
          <CardHeader id="due-heading" icon={<CalendarClock />} title="Bills due soon" description="Overdue or due within 7 days (estimated)." />
          {dueSoon.length === 0 ? (
            <p className="text-sm text-fg-muted">No card bills due in the next 7 days.</p>
          ) : (
            <ul className="divide-y divide-border">
              {dueSoon.map((c) => (
                <li key={c.card.id}>
                  <Link to={`/cards/${c.card.id}`} className="flex min-h-14 items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {c.card.nickname} ••{c.card.last4}
                      </span>
                      <span className="block text-xs text-fg-muted">Due {formatDate(c.statement.dueDate)}</span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <Amount paise={c.statement.remaining} className="font-semibold" />
                      <BillBadge statement={c.statement} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card aria-labelledby="month-heading">
          <CardHeader id="month-heading" title="Monthly spending" description={`This month: ${formatINR(thisMonth.spending)} spent · ${formatINR(thisMonth.income + thisMonth.refunds + thisMonth.cashback)} received`} />
          <ul className="space-y-2">
            {months.map((m) => (
              <li key={m.key} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 text-sm">
                <span className="text-fg-muted">{formatMonthKey(m.key)}</span>
                <span className="h-2 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
                  <span className="block h-full rounded-full bg-danger/70" style={{ width: `${String(Math.max(0, (m.totals.spending / maxMonth) * 100))}%` }} />
                </span>
                <Amount paise={Math.max(0, m.totals.spending)} className="font-medium" />
              </li>
            ))}
          </ul>
        </Card>

        <Card aria-labelledby="recent-heading" className="lg:col-span-2">
          <CardHeader
            id="recent-heading"
            title="Recent transactions"
            action={
              <Link to="/transactions" className="text-sm font-semibold text-brand">
                See all
              </Link>
            }
          />
          {transactions.length === 0 ? (
            <p className="text-sm text-fg-muted">No transactions yet.</p>
          ) : (
            <TransactionList items={transactions.slice(0, 8)} data={data} />
          )}
        </Card>
      </div>

      <div className="mt-4">
        <Note>
          Card balances and bill status are estimates based only on what you have entered here. Always reconcile with your bank
          statement.
        </Note>
      </div>
    </>
  )
}
