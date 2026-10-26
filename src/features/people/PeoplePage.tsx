import { ChevronRight, UserPlus, Users } from 'lucide-react'
import { useState, type SubmitEvent } from 'react'
import { Link } from 'react-router'
import { Amount } from '../../components/common/Amount'
import { Button } from '../../components/common/Button'
import { Card } from '../../components/common/Card'
import { Field, TextInput } from '../../components/common/Field'
import { PageHeader } from '../../components/common/PageHeader'
import { EmptyState, LoadingState } from '../../components/common/StateViews'
import { newId, savePerson } from '../../data/repo'
import { useMoneyData } from '../../data/useMoneyData'
import type { PersonSummary } from '../../domain/finance'
import { validatePersonName } from '../../domain/validation'

export function BalanceLabel({ balance }: { balance: number }) {
  if (balance === 0) return <span className="text-sm text-fg-muted">Settled</span>
  return (
    <span className="text-right">
      <Amount paise={balance} className="font-semibold" />
      <span className={balance > 0 ? 'block text-xs text-success' : 'block text-xs text-danger'}>{balance > 0 ? 'owes you' : 'you owe'}</span>
    </span>
  )
}

export function PeoplePage() {
  const data = useMoneyData()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  if (!data) return <LoadingState />

  const sorted = [...data.overview.people].sort((a: PersonSummary, b: PersonSummary) => Math.abs(b.balance) - Math.abs(a.balance))

  const existingPeople = data.people
  async function onAdd(e: SubmitEvent) {
    e.preventDefault()
    const err = validatePersonName(name, existingPeople)
    setError(err)
    if (err) return
    await savePerson({ id: newId(), name, notes: '' })
    setName('')
  }

  return (
    <>
      <PageHeader title="People & settlements" description="Money you lent, borrowed or paid on someone’s behalf." />

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-surface-raised p-4 shadow-sm">
          <p className="text-xs font-medium text-fg-muted">Others owe me</p>
          <p className="mt-1 text-xl font-bold">
            <Amount paise={data.overview.owedToMe} />
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface-raised p-4 shadow-sm">
          <p className="text-xs font-medium text-fg-muted">I owe others</p>
          <p className="mt-1 text-xl font-bold">
            <Amount paise={data.overview.iOwePeople} />
          </p>
        </div>
      </div>

      <Card className="mb-4">
        <form onSubmit={(e) => void onAdd(e)} noValidate className="flex items-end gap-2">
          <Field label="Add a person" error={error ?? undefined} className="flex-1">
            {(p) => <TextInput {...p} placeholder="Name" value={name} onChange={(e) => { setName(e.target.value) }} />}
          </Field>
          <Button type="submit" icon={<UserPlus />} className={error ? 'mb-7' : undefined}>
            Add
          </Button>
        </form>
      </Card>

      {sorted.length === 0 ? (
        <EmptyState icon={<Users />} title="No people yet" message="Add friends or family you lend to, borrow from or buy things for." />
      ) : (
        <Card className="p-3 sm:p-4">
          <ul className="divide-y divide-border">
            {sorted.map((p) => (
              <li key={p.person.id}>
                <Link to={`/people/${p.person.id}`} className="flex min-h-14 items-center gap-3 py-2 sm:px-2">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft font-semibold text-brand-soft-fg" aria-hidden="true">
                    {p.person.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.person.name}</span>
                    <span className="block text-xs text-fg-muted">
                      {p.debts.filter((d) => d.remaining > 0).length} open {p.debts.filter((d) => d.remaining > 0).length === 1 ? 'item' : 'items'}
                    </span>
                  </span>
                  <BalanceLabel balance={p.balance} />
                  <ChevronRight className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}
