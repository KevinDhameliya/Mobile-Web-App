import { ChevronLeft, Pencil, Trash } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Amount } from '../../components/common/Amount'
import { Button, ButtonLink } from '../../components/common/Button'
import { Card, CardHeader } from '../../components/common/Card'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { Field, TextArea, TextInput } from '../../components/common/Field'
import { PageHeader } from '../../components/common/PageHeader'
import { EmptyState, LoadingState, Note } from '../../components/common/StateViews'
import { StatusBadge } from '../../components/common/StatusBadge'
import { deletePerson, savePerson } from '../../data/repo'
import { useMoneyData } from '../../data/useMoneyData'
import { formatShortDate } from '../../domain/dates'
import { effectOf, type Debt } from '../../domain/finance'
import { formatINR } from '../../domain/money'
import { validatePersonName } from '../../domain/validation'
import { TransactionList } from '../transactions/TransactionList'
import { BalanceLabel } from './PeoplePage'

function DebtRow({ debt, personId }: { debt: Debt; personId: string }) {
  const t = debt.transaction
  const toMe = debt.direction === 'owed_to_me'
  const label = t.type === 'purchase' ? 'Paid on their behalf' : t.type === 'lent' ? 'Lent' : 'Borrowed'
  const repayUrl = `/transactions/new?type=returned&direction=${toMe ? 'to_me' : 'by_me'}&personId=${personId}&linked=${t.id}&amount=${String(debt.remaining / 100)}`
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <Link to={`/transactions/${t.id}/edit`} className="block truncate font-medium hover:text-brand">
          {t.description}
        </Link>
        <p className="text-xs text-fg-muted">
          {label} · {formatShortDate(t.date)} · {formatINR(debt.original)}
          {debt.repaid > 0 && ` · ${formatINR(debt.repaid)} repaid`}
          {debt.refunded > 0 && ` · ${formatINR(debt.refunded)} refunded`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {debt.remaining === 0 ? (
          <StatusBadge tone="success">Settled</StatusBadge>
        ) : (
          <>
            <span className="text-right text-sm">
              <Amount paise={debt.remaining} className="font-semibold" />
              <span className="block text-xs text-fg-muted">left</span>
            </span>
            <ButtonLink to={repayUrl} size="sm" variant="secondary">
              {toMe ? 'Got paid' : 'Paid back'}
            </ButtonLink>
          </>
        )}
      </div>
    </li>
  )
}

export function PersonDetailPage() {
  const data = useMoneyData()
  const { id } = useParams()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  if (!data) return <LoadingState />
  const s = data.overview.people.find((p) => p.person.id === id)
  if (!s) return <EmptyState title="Person not found" message={<Link to="/people" className="font-semibold text-brand">Back to people</Link>} />
  const { person } = s
  const items = data.transactions.filter((t) => t.personId === person.id)
  const owedToMe = s.debts.filter((d) => d.direction === 'owed_to_me')
  const iOwe = s.debts.filter((d) => d.direction === 'i_owe')
  const base = `/transactions/new?personId=${person.id}`

  return (
    <>
      <Link to="/people" className="-ml-1 mb-2 inline-flex min-h-11 items-center gap-1 rounded-lg pr-2 text-sm font-medium text-fg-muted hover:text-fg">
        <ChevronLeft className="size-4" aria-hidden="true" />
        People
      </Link>
      <PageHeader
        title={person.name}
        description={person.notes || undefined}
        action={
          <Button
            variant="secondary"
            icon={<Pencil />}
            aria-label="Edit person"
            onClick={() => {
              setName(person.name)
              setNotes(person.notes)
              setEditing(true)
            }}
          >
            <span className="hidden sm:inline">Edit</span>
          </Button>
        }
      />

      {editing && (
        <Card className="mb-4 space-y-3">
          <Field label="Name" required error={error ?? undefined}>
            {(p) => <TextInput {...p} value={name} onChange={(e) => { setName(e.target.value) }} />}
          </Field>
          <Field label="Notes">
            {(p) => <TextArea {...p} rows={2} value={notes} onChange={(e) => { setNotes(e.target.value) }} />}
          </Field>
          <div className="flex justify-between gap-2">
            <Button variant="danger" icon={<Trash />} onClick={() => { setConfirmDelete(true) }}>
              Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => { setEditing(false) }}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const err = validatePersonName(name, data.people, person.id)
                  setError(err)
                  if (err) return
                  void savePerson({ id: person.id, name, notes }).then(() => { setEditing(false) })
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </Card>
      )}
      {message && (
        <div className="mb-4">
          <Note tone="warning">{message}</Note>
        </div>
      )}

      <Card className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold">Balance</p>
          <BalanceLabel balance={s.balance} />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          {[
            ['Paid on their behalf', s.paidOnBehalf],
            ['Lent', s.lent],
            ['Received back', s.receivedBack],
            ['Borrowed', s.borrowed],
            ['I returned', s.returnedByMe],
            ['Adjustments', s.adjustments],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-fg-muted">{label}</dt>
              <dd className="font-medium tabular-nums">{formatINR(Number(value))}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ButtonLink to={`${base}&type=lent`} variant="secondary" size="sm">Lent money</ButtonLink>
          <ButtonLink to={`${base}&type=returned&direction=to_me`} variant="secondary" size="sm">They paid me</ButtonLink>
          <ButtonLink to={`${base}&type=borrowed`} variant="secondary" size="sm">Borrowed</ButtonLink>
          <ButtonLink to={`${base}&type=returned&direction=by_me`} variant="secondary" size="sm">I paid back</ButtonLink>
        </div>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card aria-labelledby="owed-heading">
          <CardHeader id="owed-heading" title="They owe me" description="Lent or paid on their behalf" />
          {owedToMe.length === 0 ? <p className="text-sm text-fg-muted">Nothing recorded.</p> : (
            <ul className="divide-y divide-border">{owedToMe.map((d) => <DebtRow key={d.transaction.id} debt={d} personId={person.id} />)}</ul>
          )}
          {s.unlinkedToMe > 0 && (
            <p className="mt-2 text-xs text-fg-muted">
              {formatINR(s.unlinkedToMe)} received back without a link to a specific item (included in the balance).
            </p>
          )}
        </Card>
        <Card aria-labelledby="iowe-heading">
          <CardHeader id="iowe-heading" title="I owe them" description="Money I borrowed" />
          {iOwe.length === 0 ? <p className="text-sm text-fg-muted">Nothing recorded.</p> : (
            <ul className="divide-y divide-border">{iOwe.map((d) => <DebtRow key={d.transaction.id} debt={d} personId={person.id} />)}</ul>
          )}
          {s.unlinkedByMe > 0 && (
            <p className="mt-2 text-xs text-fg-muted">{formatINR(s.unlinkedByMe)} paid back without a link to a specific item (included in the balance).</p>
          )}
        </Card>
        <Card className="lg:col-span-2" aria-labelledby="ledger-heading">
          <CardHeader id="ledger-heading" title="All entries" description="Lending and borrowing are kept separate from your spending." />
          {items.length === 0 ? <p className="text-sm text-fg-muted">No entries yet.</p> : (
            <TransactionList items={items.filter((t) => effectOf(t).personId === person.id || t.personId === person.id)} data={data} />
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${person.name}?`}
        confirmLabel="Delete"
        destructive
        onCancel={() => { setConfirmDelete(false) }}
        onConfirm={() => {
          setConfirmDelete(false)
          void deletePerson(person.id).then((r) => {
            if (r === 'deleted') void navigate('/people', { replace: true })
            else {
              setEditing(false)
              setMessage('This person has transactions, so they can’t be deleted without changing balances. Delete or reassign those entries first.')
            }
          })
        }}
      >
        <p>People with transactions can’t be deleted.</p>
      </ConfirmDialog>
    </>
  )
}
