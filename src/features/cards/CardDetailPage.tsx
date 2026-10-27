import { Archive, ChevronLeft, Pencil, Plus, Trash, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Amount } from '../../components/common/Amount'
import { BillBadge } from '../../components/common/BillBadge'
import { Button, ButtonLink } from '../../components/common/Button'
import { Card, CardHeader } from '../../components/common/Card'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { PageHeader } from '../../components/common/PageHeader'
import { EmptyState, LoadingState, Note } from '../../components/common/StateViews'
import { deleteCard, setCardArchived } from '../../data/repo'
import { useMoneyData } from '../../data/useMoneyData'
import { formatDate } from '../../domain/dates'
import { effectOf } from '../../domain/finance'
import { formatINR } from '../../domain/money'
import { TransactionList } from '../transactions/TransactionList'

export function CardDetailPage() {
  const data = useMoneyData()
  const { id } = useParams()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState<'delete' | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  if (!data) return <LoadingState />
  const s = data.overview.cards.find((c) => c.card.id === id)
  if (!s) return <EmptyState title="Card not found" message={<Link to="/cards" className="font-semibold text-brand">Back to cards</Link>} />
  const { card, statement } = s
  const items = data.transactions.filter((t) => effectOf(t).cardId === card.id)

  return (
    <>
      <Link to="/cards" className="-ml-1 mb-2 inline-flex min-h-11 items-center gap-1 rounded-lg pr-2 text-sm font-medium text-fg-muted hover:text-fg">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Cards
      </Link>
      <PageHeader
        title={card.nickname}
        description={`${card.bankName} ••${card.last4} · statement on day ${String(card.billingDay)}, due on day ${String(card.dueDay)}${card.archived ? ' · archived' : ''}`}
        action={
          <ButtonLink to={`/cards/${card.id}/edit`} variant="secondary" icon={<Pencil />} aria-label="Edit card">
            <span className="hidden sm:inline">Edit</span>
          </ButtonLink>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card aria-labelledby="bill-heading">
          <CardHeader id="bill-heading" title="Current bill (estimated)" action={<BillBadge statement={statement} />} />
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-fg-muted">Statement date</dt>
              <dd>{formatDate(statement.statementDate)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-fg-muted">Due date</dt>
              <dd className="font-medium">{formatDate(statement.dueDate)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-fg-muted">Billed on statement</dt>
              <dd>
                <Amount paise={Math.max(0, statement.statementBalance)} />
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-fg-muted">Paid / credited since</dt>
              <dd>
                <Amount paise={statement.paidSinceStatement} />
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-border pt-2 text-base">
              <dt className="font-semibold">Left to pay</dt>
              <dd className="font-bold">
                <Amount paise={statement.remaining} />
              </dd>
            </div>
          </dl>
          <ButtonLink to={`/transactions/new?type=card_payment&cardId=${card.id}`} icon={<Wallet />} fullWidth className="mt-4">
            Record a payment
          </ButtonLink>
        </Card>

        <Card aria-labelledby="balance-heading">
          <CardHeader id="balance-heading" title="Card balance (estimated)" />
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-fg-muted">Purchases, fees & lent</dt>
              <dd>
                <Amount paise={s.charges} tone="out" />
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-fg-muted">Bill payments made</dt>
              <dd>
                <Amount paise={s.payments} />
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-fg-muted">Refunds & cashback to card</dt>
              <dd>
                <Amount paise={s.credits} tone="in" />
              </dd>
            </div>
            {s.adjustments !== 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">Adjustments</dt>
                <dd>
                  {s.adjustments < 0 ? '−' : '+'}
                  {formatINR(Math.abs(s.adjustments))}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-3 border-t border-border pt-2 text-base">
              <dt className="font-semibold">Total outstanding</dt>
              <dd className="font-bold">
                {s.outstanding < 0 ? <span className="text-success">{formatINR(-s.outstanding)} credit</span> : <Amount paise={s.outstanding} />}
              </dd>
            </div>
            {s.availableCredit !== null && (
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">Available credit</dt>
                <dd>
                  <Amount paise={Math.max(0, s.availableCredit)} />
                </dd>
              </div>
            )}
            {(() => {
              let left = 0
              let count = 0
              for (const t of data.transactions) {
                const st = t.cardId === card.id ? data.chargeStatuses.get(t.id) : undefined
                if (st && st.left > 0) {
                  left += st.left
                  count += 1
                }
              }
              return (
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-muted">Purchases not marked paid</dt>
                  <dd>
                    <Link to={`/transactions?card=${card.id}&status=unpaid`} className="hover:text-brand">
                      {count} · <Amount paise={left} />
                    </Link>
                  </dd>
                </div>
              )
            })()}
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <ButtonLink to={`/transactions/new?type=purchase&cardId=${card.id}`} variant="secondary" size="sm" icon={<Plus />}>
              Purchase
            </ButtonLink>
            <ButtonLink to={`/transactions/new?type=adjustment&cardId=${card.id}`} variant="secondary" size="sm">
              Adjust to statement
            </ButtonLink>
          </div>
        </Card>

        <Card className="lg:col-span-2" aria-labelledby="card-txn-heading">
          <CardHeader id="card-txn-heading" title="Transactions on this card" description={`${String(items.length)} entries`} />
          {items.length === 0 ? <p className="text-sm text-fg-muted">Nothing recorded on this card yet.</p> : <TransactionList items={items} data={data} />}
        </Card>
      </div>

      <div className="mt-4 space-y-3">
        <Note>
          These figures are estimates from your entries. Check them against your bank statement; if they differ, record an
          Adjustment instead of editing old entries.
        </Note>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            icon={<Archive />}
            onClick={() => void setCardArchived(card.id, !card.archived)}
          >
            {card.archived ? 'Unarchive card' : 'Archive card'}
          </Button>
          <Button variant="danger" icon={<Trash />} onClick={() => { setConfirm('delete') }}>
            Delete card
          </Button>
        </div>
        {message && <Note tone="warning">{message}</Note>}
      </div>

      <ConfirmDialog
        open={confirm === 'delete'}
        title="Delete this card?"
        confirmLabel="Delete card"
        destructive
        onCancel={() => { setConfirm(null) }}
        onConfirm={() => {
          setConfirm(null)
          void deleteCard(card.id).then((result) => {
            if (result === 'deleted') void navigate('/cards', { replace: true })
            else setMessage('This card has transactions, so it can’t be deleted without changing your balances. Archive it instead, or delete its transactions first.')
          })
        }}
      >
        <p>
          {card.nickname} ••{card.last4}. Cards that have transactions can’t be deleted — archive them instead.
        </p>
      </ConfirmDialog>
    </>
  )
}
