import { ChevronLeft, Trash } from 'lucide-react'
import { useMemo, useState, type SubmitEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { Button } from '../../components/common/Button'
import { Card } from '../../components/common/Card'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { Field, Segmented, SelectInput, TextArea, TextInput } from '../../components/common/Field'
import { PageHeader } from '../../components/common/PageHeader'
import { EmptyState, LoadingState, Note } from '../../components/common/StateViews'
import { deleteTransaction, newId, savePerson, saveTransaction } from '../../data/repo'
import { useMoneyData, type MoneyData } from '../../data/useMoneyData'
import { formatShortDate, todayISO } from '../../domain/dates'
import { debtOf, refundableOnPurchase, remainingOnDebt, repaymentDirection } from '../../domain/finance'
import { PAYMENT_LABELS, TYPE_HINTS, TYPE_LABELS } from '../../domain/labels'
import { formatINR, paiseToInput, parseRupees } from '../../domain/money'
import {
  DEFAULT_CATEGORIES,
  PAYMENT_METHODS,
  TRANSACTION_TYPES,
  type AdjustmentDirection,
  type AdjustmentTarget,
  type PaymentMethod,
  type ReturnDirection,
  type Transaction,
  type TransactionType,
} from '../../domain/types'
import { ChargeStatusPanel } from './ChargeStatusPanel'
import {
  cardAllowed,
  findPossibleDuplicates,
  hasErrors,
  normalizeTransaction,
  validatePersonName,
  validateTransaction,
  type FieldErrors,
  type TransactionInput,
} from '../../domain/validation'

const OUTFLOW: ReadonlySet<TransactionType> = new Set(['purchase', 'fee', 'lent', 'card_payment'])
const DEFAULT_CATEGORY: Partial<Record<TransactionType, string>> = {
  received: 'Income',
  lent: 'Personal transfer',
  borrowed: 'Personal transfer',
  returned: 'Personal transfer',
  card_payment: 'Credit card bill',
  fee: 'Fees & Interest',
  cashback: 'Cashback & rewards',
  adjustment: 'Other',
}
const NEW_PERSON = '__new__'

interface FormState {
  id: string
  type: TransactionType
  amount: string
  date: string
  description: string
  category: string
  paymentMethod: PaymentMethod
  cardId: string
  merchant: string
  personId: string
  forSomeone: boolean
  recoverable: string
  returnDirection: ReturnDirection | null
  adjustmentTarget: AdjustmentTarget | null
  adjustmentDirection: AdjustmentDirection | null
  linkedTransactionId: string
  notes: string
}

/**
 * Purchases and fees default to a credit card (when one exists); everything
 * else defaults to UPI unless a specific card was passed in the link.
 */
function defaultPaymentMethod(type: TransactionType, hasCards: boolean, cardGiven: boolean): PaymentMethod {
  if (type === 'card_payment') return 'net_banking'
  if (!cardAllowed(type) || !hasCards) return 'upi'
  return type === 'purchase' || type === 'fee' || cardGiven ? 'credit_card' : 'upi'
}

function isType(v: string | null): v is TransactionType {
  return v !== null && (TRANSACTION_TYPES as readonly string[]).includes(v)
}

function initialState(existing: Transaction | undefined, params: URLSearchParams, data: MoneyData): FormState {
  if (existing) {
    return {
      id: existing.id,
      type: existing.type,
      amount: paiseToInput(existing.amount),
      date: existing.date,
      description: existing.description,
      category: existing.category,
      paymentMethod: existing.paymentMethod,
      cardId: existing.cardId ?? '',
      merchant: existing.merchant,
      personId: existing.personId ?? '',
      forSomeone: existing.type === 'purchase' && existing.recoverableAmount > 0,
      recoverable: existing.recoverableAmount > 0 ? paiseToInput(existing.recoverableAmount) : '',
      returnDirection: existing.returnDirection,
      adjustmentTarget: existing.adjustmentTarget,
      adjustmentDirection: existing.adjustmentDirection,
      linkedTransactionId: existing.linkedTransactionId ?? '',
      notes: existing.notes,
    }
  }
  const typeParam = params.get('type')
  const type: TransactionType = isType(typeParam) ? typeParam : 'purchase'
  const cardId = params.get('cardId') ?? ''
  const activeCards = data.cards.filter((c) => !c.archived)
  const defaultCard = cardId || (activeCards.length === 1 ? (activeCards[0]?.id ?? '') : '')
  const linked = params.get('linked') ?? ''
  const linkedTxn = linked ? data.transactions.find((t) => t.id === linked) : undefined
  const direction = params.get('direction')
  return {
    id: newId(),
    type,
    amount: params.get('amount') ?? '',
    date: todayISO(),
    description: params.get('description') ?? '',
    category: DEFAULT_CATEGORY[type] ?? '',
    paymentMethod: defaultPaymentMethod(type, cardId !== '' || activeCards.length > 0, cardId !== ''),
    cardId: defaultCard,
    merchant: '',
    personId: params.get('personId') ?? linkedTxn?.personId ?? '',
    forSomeone: false,
    recoverable: '',
    returnDirection: direction === 'by_me' || direction === 'to_me' ? direction : type === 'returned' ? 'to_me' : null,
    adjustmentTarget: type === 'adjustment' ? (cardId ? 'card' : params.get('personId') ? 'person' : null) : null,
    adjustmentDirection: null,
    linkedTransactionId: linked,
    notes: '',
  }
}

export function TransactionFormPage() {
  const data = useMoneyData()
  const { id } = useParams()
  if (!data) return <LoadingState />
  const existing = id ? data.transactions.find((t) => t.id === id) : undefined
  if (id && !existing) {
    return (
      <EmptyState
        title="Transaction not found"
        message="It may have been deleted."
        action={<Link to="/transactions" className="font-semibold text-brand">Back to transactions</Link>}
      />
    )
  }
  // Keyed so switching between records resets the form.
  return <TransactionForm key={id ?? 'new'} data={data} existing={existing} />
}

function TransactionForm({ data, existing }: { data: MoneyData; existing: Transaction | undefined }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState<FormState>(() => initialState(existing, params, data))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [duplicates, setDuplicates] = useState<Transaction[]>([])
  const [pending, setPending] = useState<TransactionInput | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [newPersonName, setNewPersonName] = useState('')
  const [newPersonError, setNewPersonError] = useState<string | null>(null)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const goBack = () => {
    if (location.key !== 'default') void navigate(-1)
    else void navigate('/transactions')
  }

  const t = form.type
  const isOutflow = OUTFLOW.has(t) || (t === 'returned' && form.returnDirection === 'by_me')
  const cardEnabled = cardAllowed(t)
  const showCardSelect =
    t === 'card_payment' || (t === 'adjustment' && form.adjustmentTarget === 'card') || (cardEnabled && form.paymentMethod === 'credit_card')
  const personRequired =
    t === 'lent' || t === 'borrowed' || t === 'returned' || (t === 'purchase' && form.forSomeone) || (t === 'adjustment' && form.adjustmentTarget === 'person')
  const showPerson = personRequired || t === 'received'
  const showMerchant = t === 'purchase' || t === 'refund' || t === 'fee' || t === 'cashback'
  const paymentOptions = PAYMENT_METHODS.filter((m) => (m === 'credit_card' ? cardEnabled : true))
  const activeCards = data.cards.filter((c) => !c.archived || c.id === form.cardId)

  const categories = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES)
    for (const x of data.transactions) if (x.category) set.add(x.category)
    return [...set]
  }, [data.transactions])
  const merchants = useMemo(() => {
    const set = new Set<string>(['Flipkart', 'Amazon', 'Vivo official store'])
    for (const x of data.transactions) if (x.merchant) set.add(x.merchant)
    return [...set]
  }, [data.transactions])

  // Options for linking a repayment to a debt, or a refund to a purchase.
  const linkOptions = useMemo(() => {
    if (t === 'returned') {
      const dir = repaymentDirection({ type: 'returned', returnDirection: form.returnDirection ?? 'to_me' })
      return data.transactions
        .filter((x) => x.personId === form.personId && form.personId !== '' && debtOf(x)?.direction === dir)
        .map((x) => ({ txn: x, left: remainingOnDebt(x, data.transactions, form.id) }))
        .filter((o) => o.left > 0 || o.txn.id === form.linkedTransactionId)
    }
    if (t === 'refund') {
      return data.transactions
        .filter((x) => x.type === 'purchase')
        .map((x) => ({ txn: x, left: refundableOnPurchase(x, data.transactions, form.id) }))
        .filter((o) => o.left > 0 || o.txn.id === form.linkedTransactionId)
        .slice(0, 150)
    }
    return []
  }, [t, form.personId, form.returnDirection, form.id, form.linkedTransactionId, data.transactions])

  // A refund on something bought for someone reduces what they owe, in proportion.
  const linkedPurchase = t === 'refund' && form.linkedTransactionId ? data.transactions.find((x) => x.id === form.linkedTransactionId) : undefined
  const refundPerson = linkedPurchase?.personId ? data.peopleById.get(linkedPurchase.personId) : undefined
  const refundHint =
    linkedPurchase && refundPerson && linkedPurchase.recoverableAmount > 0
      ? `This purchase was ${linkedPurchase.recoverableAmount === linkedPurchase.amount ? 'fully' : 'partly'} for ${refundPerson.name}. Their share of the refund reduces what they owe you; only your share reduces your spending.`
      : undefined

  const cardSummary = form.cardId ? data.overview.cards.find((c) => c.card.id === form.cardId) : undefined

  function changeType(type: TransactionType) {
    setForm((f) => {
      const keepCategory = f.category !== '' && f.category !== (DEFAULT_CATEGORY[f.type] ?? '')
      // Each type starts from its own default so a card chosen for a purchase
      // never silently carries over to a loan or cashback entry.
      const paymentMethod = defaultPaymentMethod(type, data.cards.some((c) => !c.archived), false)
      return {
        ...f,
        type,
        paymentMethod,
        category: keepCategory ? f.category : (DEFAULT_CATEGORY[type] ?? ''),
        returnDirection: type === 'returned' ? (f.returnDirection ?? 'to_me') : null,
        linkedTransactionId: '',
      }
    })
    setErrors({})
  }

  function buildInput(): { input: TransactionInput | null; errors: FieldErrors } {
    const errs: FieldErrors = {}
    const amount = parseRupees(form.amount)
    if (!amount.ok) errs.amount = amount.error
    let recoverable = 0
    if (t === 'purchase' && form.forSomeone) {
      if (form.recoverable.trim() === '') recoverable = amount.ok ? amount.value : 0
      else {
        const r = parseRupees(form.recoverable)
        if (r.ok) recoverable = r.value
        else errs.recoverableAmount = r.error
      }
    }
    const input: TransactionInput = normalizeTransaction({
      id: form.id,
      type: t,
      amount: amount.ok ? amount.value : 0,
      date: form.date,
      description: form.description,
      category: form.category,
      paymentMethod: form.paymentMethod,
      cardId: form.cardId || null,
      merchant: showMerchant ? form.merchant : '',
      personId: showPerson && form.personId !== NEW_PERSON ? form.personId || null : null,
      recoverableAmount: recoverable,
      returnDirection: form.returnDirection,
      adjustmentTarget: form.adjustmentTarget,
      adjustmentDirection: form.adjustmentDirection,
      linkedTransactionId: form.linkedTransactionId || null,
      // Kept as they are: v2.5 ticks on payments, and the paid flag on purchases.
      allocations: existing?.allocations,
      paid: existing?.paid,
      paidAt: existing?.paidAt,
      notes: form.notes,
    })
    const v = validateTransaction(input, { ...data, today: todayISO() })
    if (!amount.ok) delete v.amount
    const all = { ...v, ...errs }
    return { input: hasErrors(all) ? null : input, errors: all }
  }

  async function persist(input: TransactionInput) {
    setSaving(true)
    try {
      await saveTransaction(input)
      goBack()
    } catch (e) {
      setErrors({ form: e instanceof Error ? `Could not save: ${e.message}` : 'Could not save.' })
      setSaving(false)
    }
  }

  function onSubmit(e: SubmitEvent) {
    e.preventDefault()
    if (saving) return
    const { input, errors: errs } = buildInput()
    setErrors(errs)
    if (!input) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      return
    }
    const dups = findPossibleDuplicates(input, data.transactions)
    if (dups.length > 0 && (existing?.amount !== input.amount || existing.date !== input.date)) {
      setDuplicates(dups)
      setPending(input)
      return
    }
    void persist(input)
  }

  async function addPerson() {
    const err = validatePersonName(newPersonName, data.people)
    setNewPersonError(err)
    if (err) return
    const pid = newId()
    await savePerson({ id: pid, name: newPersonName, notes: '' })
    setNewPersonName('')
    set('personId', pid)
  }

  const dependents = existing ? data.transactions.filter((x) => x.linkedTransactionId === existing.id) : []

  return (
    <>
      <button type="button" onClick={goBack} className="-ml-1 mb-2 inline-flex min-h-11 items-center gap-1 rounded-lg pr-2 text-sm font-medium text-fg-muted hover:text-fg">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Back
      </button>
      <PageHeader title={existing ? 'Edit transaction' : 'Add transaction'} />
      {existing && data.chargeStatuses.get(existing.id) && (
        <ChargeStatusPanel transactionId={existing.id} status={data.chargeStatuses.get(existing.id) ?? { status: 'unpaid', owed: 0, left: 0, paidAt: null }} />
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Card className="space-y-4">
          <Field label="Transaction type" required hint={TYPE_HINTS[t]} error={errors.type}>
            {(p) => (
              <SelectInput {...p} value={t} onChange={(e) => { changeType(e.target.value as TransactionType) }}>
                {TRANSACTION_TYPES.map((x) => (
                  <option key={x} value={x}>
                    {TYPE_LABELS[x]}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>

          {t === 'returned' && (
            <Segmented
              name="returnDirection"
              legend="Who returned the money?"
              value={form.returnDirection}
              onChange={(v) => {
                setForm((f) => ({ ...f, returnDirection: v, linkedTransactionId: '' }))
              }}
              options={[
                { value: 'to_me', label: 'They paid me back' },
                { value: 'by_me', label: 'I paid them back' },
              ]}
              error={errors.returnDirection}
            />
          )}

          {t === 'adjustment' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Segmented
                name="adjustmentTarget"
                legend="Adjust which balance?"
                value={form.adjustmentTarget}
                onChange={(v) => { set('adjustmentTarget', v) }}
                options={[
                  { value: 'card', label: 'Credit card' },
                  { value: 'person', label: 'Person' },
                ]}
                error={errors.adjustmentTarget}
              />
              <Segmented
                name="adjustmentDirection"
                legend="Direction"
                value={form.adjustmentDirection}
                onChange={(v) => { set('adjustmentDirection', v) }}
                options={[
                  { value: 'increase', label: form.adjustmentTarget === 'person' ? 'They owe more' : 'Increase' },
                  { value: 'decrease', label: form.adjustmentTarget === 'person' ? 'They owe less' : 'Decrease' },
                ]}
                error={errors.adjustmentDirection}
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount (₹)" required error={errors.amount}>
              {(p) => (
                <TextInput
                  {...p}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  value={form.amount}
                  onChange={(e) => { set('amount', e.target.value) }}
                  className="text-lg font-semibold"
                />
              )}
            </Field>
            <Field label="Date" required error={errors.date}>
              {(p) => <TextInput {...p} type="date" value={form.date} onChange={(e) => { set('date', e.target.value) }} />}
            </Field>
          </div>

          <Field label="Description" required error={errors.description}>
            {(p) => (
              <TextInput
                {...p}
                maxLength={200}
                placeholder={t === 'purchase' ? 'e.g. Vivo V30 phone' : t === 'card_payment' ? 'e.g. HDFC bill payment' : 'Short description'}
                value={form.description}
                onChange={(e) => { set('description', e.target.value) }}
              />
            )}
          </Field>
        </Card>

        <Card className="space-y-4">
          {t !== 'adjustment' && (
            <Field
              label={t === 'card_payment' ? 'Paid from' : isOutflow ? 'Payment method' : 'Received in / credited to'}
              required
              error={errors.paymentMethod}
            >
              {(p) => (
                <SelectInput {...p} value={form.paymentMethod} onChange={(e) => { set('paymentMethod', e.target.value as PaymentMethod) }}>
                  {paymentOptions
                    .filter((m) => !(t === 'card_payment' && m === 'credit_card'))
                    .map((m) => (
                      <option key={m} value={m}>
                        {PAYMENT_LABELS[m]}
                      </option>
                    ))}
                </SelectInput>
              )}
            </Field>
          )}

          {showCardSelect && (
            <Field
              label={t === 'card_payment' ? 'Card being paid' : t === 'refund' || t === 'cashback' ? 'Credited to card' : 'Credit card'}
              required
              error={errors.cardId}
              hint={
                cardSummary && t === 'card_payment' ? (
                  <>
                    Estimated outstanding {formatINR(Math.max(0, cardSummary.outstanding))} · current statement left {formatINR(cardSummary.statement.remaining)}
                  </>
                ) : undefined
              }
            >
              {(p) =>
                activeCards.length === 0 ? (
                  <p className="text-sm text-fg-muted">
                    No cards yet.{' '}
                    <Link to="/cards/new" className="font-semibold text-brand">
                      Add a card
                    </Link>{' '}
                    first.
                  </p>
                ) : (
                  <SelectInput
                    {...p}
                    value={form.cardId}
                    onChange={(e) => { set('cardId', e.target.value) }}
                  >
                    <option value="">Choose a card…</option>
                    {activeCards.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nickname} ••{c.last4} ({c.bankName})
                      </option>
                    ))}
                  </SelectInput>
                )
              }
            </Field>
          )}

          {t === 'card_payment' && cardSummary && (
            <div className="flex flex-wrap gap-2">
              {cardSummary.statement.remaining > 0 && (
                <Button variant="secondary" size="sm" onClick={() => { set('amount', paiseToInput(cardSummary.statement.remaining)) }}>
                  Pay statement {formatINR(cardSummary.statement.remaining)}
                </Button>
              )}
              {cardSummary.outstanding > 0 && (
                <Button variant="secondary" size="sm" onClick={() => { set('amount', paiseToInput(cardSummary.outstanding)) }}>
                  Pay full {formatINR(cardSummary.outstanding)}
                </Button>
              )}
            </div>
          )}



          {t === 'purchase' && (
            <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl bg-surface-sunken p-3">
              <input
                type="checkbox"
                checked={form.forSomeone}
                onChange={(e) => { set('forSomeone', e.target.checked) }}
                className="mt-0.5 size-5 accent-[var(--brand)]"
              />
              <span className="text-sm">
                <span className="font-medium text-fg">Bought for someone — they will pay me back</span>
                <span className="block text-fg-muted">The amount to recover is tracked under People, not as your spending.</span>
              </span>
            </label>
          )}

          {showPerson && (
            <Field
              label={t === 'received' ? 'From (optional)' : t === 'purchase' ? 'Who will pay you back?' : 'Person'}
              required={personRequired}
              error={errors.personId}
            >
              {(p) => (
                <>
                  <SelectInput
                    {...p}
                    value={form.personId}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, personId: e.target.value, linkedTransactionId: '' }))
                    }}
                  >
                    <option value="">{personRequired ? 'Choose a person…' : 'Nobody in particular'}</option>
                    {data.people.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                    <option value={NEW_PERSON}>+ Add new person…</option>
                  </SelectInput>
                  {form.personId === NEW_PERSON && (
                    <div className="mt-2 flex gap-2">
                      <TextInput
                        aria-label="New person's name"
                        placeholder="Name"
                        value={newPersonName}
                        onChange={(e) => { setNewPersonName(e.target.value) }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            void addPerson()
                          }
                        }}
                      />
                      <Button variant="secondary" onClick={() => void addPerson()}>
                        Add
                      </Button>
                    </div>
                  )}
                  {newPersonError && <p className="mt-1 text-sm font-medium text-danger">{newPersonError}</p>}
                </>
              )}
            </Field>
          )}

          {t === 'purchase' && form.forSomeone && (
            <Field label="Amount to recover (₹)" error={errors.recoverableAmount} hint="Leave empty to recover the full amount. Enter less if you keep part of it.">
              {(p) => (
                <TextInput {...p} inputMode="decimal" placeholder={form.amount || '0'} value={form.recoverable} onChange={(e) => { set('recoverable', e.target.value) }} />
              )}
            </Field>
          )}

          {(t === 'returned' || t === 'refund') && (
            <Field
              label={t === 'returned' ? 'Settles which entry?' : 'Refund for which purchase? (optional)'}
              error={errors.linkedTransactionId}
              hint={t === 'returned' ? 'Link the repayment to the original debt so its remaining amount is tracked.' : refundHint}
            >
              {(p) => (
                <SelectInput
                  {...p}
                  value={form.linkedTransactionId}
                  onChange={(e) => {
                    const value = e.target.value
                    const opt = linkOptions.find((o) => o.txn.id === value)
                    setForm((f) => ({
                      ...f,
                      linkedTransactionId: value,
                      amount: f.amount === '' && opt ? paiseToInput(opt.left) : f.amount,
                      // Refunds usually go back to the original payment method.
                      paymentMethod: t === 'refund' && opt ? opt.txn.paymentMethod : f.paymentMethod,
                      cardId: t === 'refund' && opt ? (opt.txn.cardId ?? '') : f.cardId,
                      category: t === 'refund' && opt && f.category === '' ? opt.txn.category : f.category,
                      merchant: t === 'refund' && opt && f.merchant === '' ? opt.txn.merchant : f.merchant,
                    }))
                  }}
                >
                  <option value="">Not linked to a specific entry</option>
                  {linkOptions.map(({ txn, left }) => (
                    <option key={txn.id} value={txn.id}>
                      {formatShortDate(txn.date)} · {txn.description} · {formatINR(left)} left
                    </option>
                  ))}
                </SelectInput>
              )}
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              {(p) => (
                <>
                  <TextInput {...p} list="category-options" value={form.category} onChange={(e) => { set('category', e.target.value) }} placeholder="Choose or type" />
                  <datalist id="category-options">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </>
              )}
            </Field>
            {showMerchant && (
              <Field label="Store / merchant">
                {(p) => (
                  <>
                    <TextInput {...p} list="merchant-options" value={form.merchant} onChange={(e) => { set('merchant', e.target.value) }} placeholder="e.g. Flipkart" />
                    <datalist id="merchant-options">
                      {merchants.map((m) => (
                        <option key={m} value={m} />
                      ))}
                    </datalist>
                  </>
                )}
              </Field>
            )}
          </div>

          <Field label="Notes" error={errors.notes}>
            {(p) => <TextArea {...p} rows={2} value={form.notes} onChange={(e) => { set('notes', e.target.value) }} />}
          </Field>
        </Card>

        {errors.form && <Note tone="warning">{errors.form}</Note>}
        {hasErrors(errors) && !errors.form && (
          <p role="alert" className="text-sm font-medium text-danger">
            Please fix the highlighted fields.
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {existing ? (
            <Button variant="danger" icon={<Trash />} onClick={() => { setConfirmDelete(true) }}>
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="ghost" onClick={goBack}>
              Cancel
            </Button>
            <Button type="submit" size="lg" disabled={saving}>
              {saving ? 'Saving…' : existing ? 'Save changes' : 'Save transaction'}
            </Button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={pending !== null}
        title="This looks like a duplicate"
        confirmLabel="Save anyway"
        busy={saving}
        onCancel={() => {
          setPending(null)
        }}
        onConfirm={() => {
          if (pending) void persist(pending)
          setPending(null)
        }}
      >
        <p>An entry with the same type, amount, date{t === 'purchase' ? ' and card' : ''} already exists:</p>
        <ul className="list-disc pl-5">
          {duplicates.slice(0, 3).map((d) => (
            <li key={d.id}>
              {formatShortDate(d.date)} · {d.description} · {formatINR(d.amount)}
            </li>
          ))}
        </ul>
        <p>Saving it again would count it twice. Only continue if this is a separate transaction.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this transaction?"
        confirmLabel="Delete"
        destructive
        onCancel={() => { setConfirmDelete(false) }}
        onConfirm={() => {
          if (!existing) return
          void deleteTransaction(existing.id).then(goBack)
        }}
      >
        <p>
          {existing?.description} · {existing ? formatINR(existing.amount) : ''}. Balances will be recalculated. This cannot be undone.
        </p>
        {dependents.length > 0 && (
          <p className="font-medium text-fg">
            {dependents.length} linked {dependents.length === 1 ? 'entry stays' : 'entries stay'} but will no longer be linked to this one.
          </p>
        )}
      </ConfirmDialog>
    </>
  )
}
