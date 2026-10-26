import { ChevronLeft, ShieldCheck } from 'lucide-react'
import { useState, type SubmitEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '../../components/common/Button'
import { Card } from '../../components/common/Card'
import { Field, SelectInput, TextInput } from '../../components/common/Field'
import { PageHeader } from '../../components/common/PageHeader'
import { EmptyState, LoadingState } from '../../components/common/StateViews'
import { newId, saveCard } from '../../data/repo'
import { useMoneyData } from '../../data/useMoneyData'
import { paiseToInput, parseRupees } from '../../domain/money'
import type { CreditCard } from '../../domain/types'
import { validateCard, type CardErrors } from '../../domain/validation'

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

export function CardFormPage() {
  const data = useMoneyData()
  const { id } = useParams()
  if (!data) return <LoadingState />
  const existing = id ? data.cards.find((c) => c.id === id) : undefined
  if (id && !existing) return <EmptyState title="Card not found" message={<Link to="/cards" className="font-semibold text-brand">Back to cards</Link>} />
  return <CardForm key={id ?? 'new'} existing={existing} />
}

function CardForm({ existing }: { existing: CreditCard | undefined }) {
  const navigate = useNavigate()
  const [cardId] = useState(() => existing?.id ?? newId())
  const [nickname, setNickname] = useState(existing?.nickname ?? '')
  const [bankName, setBankName] = useState(existing?.bankName ?? '')
  const [last4, setLast4] = useState(existing?.last4 ?? '')
  const [limit, setLimit] = useState(() => {
    const current = existing?.creditLimit ?? null
    return current === null ? '' : paiseToInput(current)
  })
  const [billingDay, setBillingDay] = useState(existing?.billingDay ?? 1)
  const [dueDay, setDueDay] = useState(existing?.dueDay ?? 20)
  const [errors, setErrors] = useState<CardErrors>({})
  const [saving, setSaving] = useState(false)

  async function onSubmit(e: SubmitEvent) {
    e.preventDefault()
    let creditLimit: number | null = null
    const errs: CardErrors = {}
    if (limit.trim() !== '') {
      const parsed = parseRupees(limit)
      if (parsed.ok) creditLimit = parsed.value
      else errs.creditLimit = parsed.error
    }
    const input = { id: cardId, nickname, bankName, last4, creditLimit, billingDay, dueDay, archived: existing?.archived ?? false }
    const all = { ...validateCard(input), ...errs }
    setErrors(all)
    if (Object.keys(all).length > 0) return
    setSaving(true)
    await saveCard(input)
    void navigate(`/cards/${cardId}`, { replace: true })
  }

  return (
    <>
      <Link to={existing ? `/cards/${existing.id}` : '/cards'} className="-ml-1 mb-2 inline-flex min-h-11 items-center gap-1 rounded-lg pr-2 text-sm font-medium text-fg-muted hover:text-fg">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Back
      </Link>
      <PageHeader title={existing ? 'Edit card' : 'Add credit card'} />
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="space-y-4">
        <Card className="space-y-4">
          <p className="flex gap-2 rounded-xl bg-success-soft/60 p-3 text-sm text-fg">
            <ShieldCheck className="size-5 shrink-0 text-success" aria-hidden="true" />
            Only the last 4 digits are stored. Never enter your full card number, CVV, PIN, banking password or OTP anywhere in this app.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Card nickname" required error={errors.nickname}>
              {(p) => <TextInput {...p} placeholder="e.g. HDFC Millennia" value={nickname} onChange={(e) => { setNickname(e.target.value) }} />}
            </Field>
            <Field label="Bank name" required error={errors.bankName}>
              {(p) => <TextInput {...p} placeholder="e.g. HDFC Bank" value={bankName} onChange={(e) => { setBankName(e.target.value) }} />}
            </Field>
            <Field label="Last 4 digits" required error={errors.last4}>
              {(p) => (
                <TextInput
                  {...p}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  placeholder="1234"
                  value={last4}
                  onChange={(e) => { setLast4(e.target.value.replace(/\D/g, '').slice(0, 4)) }}
                />
              )}
            </Field>
            <Field label="Credit limit (₹, optional)" error={errors.creditLimit}>
              {(p) => <TextInput {...p} inputMode="decimal" placeholder="e.g. 1,00,000" value={limit} onChange={(e) => { setLimit(e.target.value) }} />}
            </Field>
            <Field label="Statement / billing date" required error={errors.billingDay} hint="Day of the month your statement is generated.">
              {(p) => (
                <SelectInput {...p} value={billingDay} onChange={(e) => { setBillingDay(Number(e.target.value)) }}>
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </SelectInput>
              )}
            </Field>
            <Field label="Payment due date" required error={errors.dueDay} hint="If it’s on or before the billing date, it falls in the next month.">
              {(p) => (
                <SelectInput {...p} value={dueDay} onChange={(e) => { setDueDay(Number(e.target.value)) }}>
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </SelectInput>
              )}
            </Field>
          </div>
        </Card>
        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? 'Saving…' : existing ? 'Save changes' : 'Add card'}
          </Button>
        </div>
      </form>
    </>
  )
}
