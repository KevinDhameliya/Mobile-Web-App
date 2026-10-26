import { CreditCard, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { Amount } from '../../components/common/Amount'
import { BillBadge } from '../../components/common/BillBadge'
import { ButtonLink } from '../../components/common/Button'
import { PageHeader } from '../../components/common/PageHeader'
import { EmptyState, LoadingState, Note } from '../../components/common/StateViews'
import { useMoneyData } from '../../data/useMoneyData'
import { formatShortDate } from '../../domain/dates'
import type { CardSummary } from '../../domain/finance'
import { formatINR } from '../../domain/money'

function CardTile({ s }: { s: CardSummary }) {
  const { card, statement } = s
  return (
    <li>
      <Link to={`/cards/${card.id}`} className="block rounded-2xl border border-border bg-surface-raised p-4 shadow-sm hover:border-brand">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-fg">{card.nickname}</p>
            <p className="text-sm text-fg-muted">
              {card.bankName} ••{card.last4}
            </p>
          </div>
          <BillBadge statement={statement} />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-fg-muted">Outstanding</dt>
            <dd className="text-lg font-bold">
              {s.outstanding < 0 ? <span className="text-success">{formatINR(-s.outstanding)} credit</span> : <Amount paise={s.outstanding} />}
            </dd>
          </div>
          <div>
            <dt className="text-fg-muted">Bill due {formatShortDate(statement.dueDate)}</dt>
            <dd className="text-lg font-bold">
              <Amount paise={statement.remaining} />
            </dd>
          </div>
        </dl>
        {s.availableCredit !== null && card.creditLimit !== null && (
          <div className="mt-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${String(Math.min(100, Math.max(0, (s.outstanding / card.creditLimit) * 100)))}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-fg-muted">
              {formatINR(Math.max(0, s.availableCredit))} available of {formatINR(card.creditLimit)}
            </p>
          </div>
        )}
      </Link>
    </li>
  )
}

export function CardsPage() {
  const data = useMoneyData()
  if (!data) return <LoadingState />
  const active = data.overview.cards.filter((c) => !c.card.archived)
  const archived = data.overview.cards.filter((c) => c.card.archived)

  return (
    <>
      <PageHeader
        title="Credit cards"
        description={`Estimated total outstanding ${formatINR(data.overview.cardOutstanding)}`}
        action={
          <ButtonLink to="/cards/new" icon={<Plus />} variant="secondary">
            Add card
          </ButtonLink>
        }
      />
      {data.cards.length === 0 ? (
        <EmptyState
          icon={<CreditCard />}
          title="No cards yet"
          message="Add a card with its nickname, bank, last 4 digits and billing dates. Never enter the full card number, CVV or PIN."
          action={
            <ButtonLink to="/cards/new" icon={<Plus />}>
              Add a credit card
            </ButtonLink>
          }
        />
      ) : (
        <>
          <ul className="grid gap-3 md:grid-cols-2">
            {active.map((s) => (
              <CardTile key={s.card.id} s={s} />
            ))}
          </ul>
          {archived.length > 0 && (
            <>
              <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-fg-muted uppercase">Archived</h2>
              <ul className="grid gap-3 opacity-75 md:grid-cols-2">
                {archived.map((s) => (
                  <CardTile key={s.card.id} s={s} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
      <div className="mt-4">
        <Note>
          Balances and bill status are <strong>estimates</strong> calculated from the transactions you entered. Interest, fees,
          EMIs or transactions you haven’t recorded are not included — always reconcile with your bank statement and use an
          Adjustment to correct any difference.
        </Note>
      </div>
    </>
  )
}
