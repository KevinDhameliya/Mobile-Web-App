import { addDays, isValidISODate } from './dates.ts'
import { debtOf, refundShares, refundableOnPurchase, remainingOnDebt, repaymentDirection, usesCard, usesPerson } from './finance.ts'
import { MAX_AMOUNT_PAISE, formatINR } from './money.ts'
import { computeChargeStatuses, isCardCharge, validateAllocations } from './payments.ts'
import type { CreditCard, ISODate, Person, Transaction, TransactionType } from './types.ts'

export type TransactionInput = Omit<Transaction, 'createdAt' | 'updatedAt'>
export type FieldErrors = Partial<Record<keyof TransactionInput | 'form', string>>

/** Types where the money can be paid with / credited to a credit card. */
const CARD_ALLOWED: ReadonlySet<TransactionType> = new Set(['purchase', 'fee', 'lent', 'refund', 'cashback'])

export function cardAllowed(type: TransactionType): boolean {
  return CARD_ALLOWED.has(type)
}

/**
 * Clears fields that do not apply to the transaction type, so a value left
 * over from switching types in the form can never affect a balance.
 */
export function normalizeTransaction(t: TransactionInput): TransactionInput {
  const n: TransactionInput = {
    ...t,
    description: t.description.trim(),
    category: t.category.trim(),
    merchant: t.merchant.trim(),
    notes: t.notes.trim(),
  }
  if (n.type !== 'purchase') n.recoverableAmount = 0
  if (n.type !== 'returned') n.returnDirection = null
  if (n.type !== 'adjustment') {
    n.adjustmentTarget = null
    n.adjustmentDirection = null
  }
  if (n.type === 'card_payment' && n.paymentMethod === 'credit_card') n.paymentMethod = 'net_banking'
  if (n.type === 'adjustment') n.paymentMethod = 'other'
  if (!cardAllowed(n.type) && n.paymentMethod === 'credit_card') n.paymentMethod = 'upi'
  if (!usesCard(n)) n.cardId = null
  // Person is kept as an optional label on purchases/received; only required where it matters.
  if (n.type === 'card_payment' || n.type === 'fee' || n.type === 'cashback' || n.type === 'refund') n.personId = null
  if (n.type === 'adjustment' && n.adjustmentTarget !== 'person') n.personId = null
  if (n.type !== 'returned' && n.type !== 'refund') n.linkedTransactionId = null
  // Only card payments say which purchases they pay.
  if (n.type === 'card_payment') n.allocations = (t.allocations ?? []).filter((a) => a.amount > 0)
  else delete n.allocations
  return n
}

export interface ValidationContext {
  cards: readonly CreditCard[]
  people: readonly Person[]
  transactions: readonly Transaction[]
  today: ISODate
}

export function validateTransaction(input: TransactionInput, ctx: ValidationContext): FieldErrors {
  const t = normalizeTransaction(input)
  const errors: FieldErrors = {}

  if (!Number.isSafeInteger(t.amount) || t.amount <= 0) errors.amount = 'Enter an amount more than ₹0.'
  else if (t.amount > MAX_AMOUNT_PAISE) errors.amount = 'Amount must be ₹10 crore or less.'

  if (!isValidISODate(t.date)) errors.date = 'Choose a valid date.'
  else if (t.date > addDays(ctx.today, 366)) errors.date = 'Date is more than a year in the future.'

  if (t.description === '') errors.description = 'Add a short description.'
  else if (t.description.length > 200) errors.description = 'Keep the description under 200 characters.'

  if (t.notes.length > 2000) errors.notes = 'Notes are too long.'

  // Card
  const needsCard = t.type === 'card_payment' || (t.type === 'adjustment' && t.adjustmentTarget === 'card') || t.paymentMethod === 'credit_card'
  if (needsCard) {
    if (!t.cardId) errors.cardId = 'Choose a credit card.'
    else if (!ctx.cards.some((c) => c.id === t.cardId)) errors.cardId = 'That card no longer exists.'
  }

  // Person
  const needsPerson = usesPerson(t)
  if (needsPerson) {
    if (!t.personId) errors.personId = t.type === 'purchase' ? 'Choose who will pay you back.' : 'Choose a person.'
    else if (!ctx.people.some((p) => p.id === t.personId)) errors.personId = 'That person no longer exists.'
  }

  if (t.type === 'purchase') {
    if (!Number.isSafeInteger(t.recoverableAmount) || t.recoverableAmount < 0) errors.recoverableAmount = 'Enter a valid amount.'
    else if (t.recoverableAmount > t.amount) errors.recoverableAmount = 'Cannot recover more than the purchase amount.'
  }

  if (t.type === 'returned' && !t.returnDirection) errors.returnDirection = 'Choose who returned the money.'

  if (t.type === 'adjustment') {
    if (!t.adjustmentTarget) errors.adjustmentTarget = 'Choose what to adjust.'
    if (!t.adjustmentDirection) errors.adjustmentDirection = 'Choose increase or decrease.'
  }

  // Links
  if (t.linkedTransactionId && !errors.amount) {
    const linked = ctx.transactions.find((x) => x.id === t.linkedTransactionId)
    if (!linked) {
      errors.linkedTransactionId = 'The linked transaction no longer exists.'
    } else if (t.type === 'returned') {
      const debt = debtOf(linked)
      const dir = repaymentDirection(t)
      if (debt?.direction !== dir) errors.linkedTransactionId = 'That entry is not a matching debt.'
      else if (linked.personId !== t.personId) errors.linkedTransactionId = 'That debt belongs to a different person.'
      else {
        const remaining = remainingOnDebt(linked, ctx.transactions, t.id)
        if (t.amount > remaining) {
          errors.amount = `Only ${formatINR(remaining)} is left on the linked debt.`
        }
      }
    } else if (t.type === 'refund') {
      if (linked.type !== 'purchase') errors.linkedTransactionId = 'A refund can only be linked to a purchase.'
      else {
        const left = refundableOnPurchase(linked, ctx.transactions, t.id)
        if (t.amount > left) errors.amount = `Only ${formatINR(left)} of that purchase is left to refund.`
      }
    }
  }

  if (t.type === 'card_payment' && !errors.amount && !errors.cardId) {
    const problem = validateAllocations(t, ctx.transactions)
    if (problem) errors.allocations = problem
  }

  checkDependents(t, ctx.transactions, errors)
  checkPaidCharge(t, ctx.transactions, errors)
  return errors
}

/**
 * When editing an entry that other entries are linked to (repayments of a
 * debt, refunds of a purchase), the edit must not leave those links pointing
 * at something they no longer fit — otherwise a settled debt could silently
 * reopen or a person's balance flip sign.
 */
/**
 * A purchase that card payments have (partly) paid must stay a card charge
 * on the same card, and can't be lowered below what has been paid on it.
 */
function checkPaidCharge(t: TransactionInput, transactions: readonly Transaction[], errors: FieldErrors): void {
  const original = transactions.find((x) => x.id === t.id)
  if (!original || errors.amount) return
  const status = computeChargeStatuses(transactions).get(t.id)
  if (!status || status.paid === 0) return
  const edited: Transaction = { ...t, createdAt: original.createdAt, updatedAt: original.updatedAt }
  if (!isCardCharge(edited) || edited.cardId !== original.cardId) {
    errors.cardId = `${formatINR(status.paid)} of this has been marked as paid by a card payment, so it must stay on the same credit card. Untick it in that payment first.`
    return
  }
  const refundedToCard = original.amount - status.owed
  if (t.amount - refundedToCard < status.paid) {
    errors.amount = `${formatINR(status.paid)} of this has already been paid by card payments, so the amount can’t be lower than ${formatINR(status.paid + refundedToCard)}.`
  }
}

function checkDependents(t: TransactionInput, transactions: readonly Transaction[], errors: FieldErrors): void {
  const deps = transactions.filter((x) => x.linkedTransactionId === t.id && x.id !== t.id)
  if (deps.length === 0 || errors.amount) return
  const refunds = deps.filter((x) => x.type === 'refund')
  const repayments = deps.filter((x) => x.type === 'returned')
  const original = transactions.find((x) => x.id === t.id)

  if (refunds.length > 0) {
    if (t.type !== 'purchase') {
      errors.type = 'Refunds are linked to this purchase, so it must stay a purchase. Delete or unlink the refunds first.'
      return
    }
    const refunded = refunds.reduce((sum, r) => sum + r.amount, 0)
    if (t.amount < refunded) {
      errors.amount = `${formatINR(refunded)} has already been refunded on this purchase, so the amount can’t be less.`
      return
    }
  }

  if (repayments.length > 0) {
    const debt = debtOf({ ...t, createdAt: '', updatedAt: '' })
    const dir = repaymentDirection(repayments[0] ?? { type: 'returned', returnDirection: 'to_me' })
    if (debt?.direction !== dir) {
      errors.type = 'Repayments are linked to this entry. Delete or unlink them before changing its type.'
      return
    }
    if (original && original.personId !== t.personId) {
      errors.personId = 'Repayments from this person are linked to this entry, so the person can’t be changed.'
      return
    }
    const repaid = repayments.reduce((sum, r) => sum + r.amount, 0)
    // Refund shares are recalculated from the edited purchase.
    const asPurchase = { ...t, createdAt: original?.createdAt ?? '', updatedAt: '' }
    const updated = new Map(refundShares(asPurchase, refunds).map((r) => [r.id, r]))
    const refundedShare = refunds.reduce((sum, r) => sum + (updated.get(r.id) ?? r).recoverableAmount, 0)
    if (debt.amount < repaid + refundedShare) {
      const msg = `${formatINR(repaid + refundedShare)} has already been settled on this entry, so it can’t be less.`
      if (t.type === 'purchase') errors.recoverableAmount = msg
      else errors.amount = msg
    }
  }
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0
}

/**
 * Entries that look like the same real-world transaction (same type, amount,
 * date, card and person). The form asks before saving one of these, so an
 * accidental second entry can't silently change balances.
 */
export function findPossibleDuplicates(t: TransactionInput, existing: readonly Transaction[]): Transaction[] {
  const n = normalizeTransaction(t)
  return existing.filter(
    (x) =>
      x.id !== n.id &&
      x.type === n.type &&
      x.amount === n.amount &&
      x.date === n.date &&
      x.cardId === n.cardId &&
      // A refund's person is derived from its purchase, not entered.
      (n.type === 'refund' || x.personId === n.personId),
  )
}

// ─── Cards & people ──────────────────────────────────────────────────────────

export type CardInput = Omit<CreditCard, 'createdAt' | 'updatedAt'>
export type CardErrors = Partial<Record<keyof CardInput, string>>

export function validateCard(c: CardInput): CardErrors {
  const errors: CardErrors = {}
  if (c.nickname.trim() === '') errors.nickname = 'Give the card a nickname.'
  if (c.bankName.trim() === '') errors.bankName = 'Enter the bank name.'
  if (!/^\d{4}$/.test(c.last4)) errors.last4 = 'Enter exactly the last 4 digits.'
  if (c.creditLimit !== null && (!Number.isSafeInteger(c.creditLimit) || c.creditLimit <= 0)) {
    errors.creditLimit = 'Enter a valid limit or leave it empty.'
  }
  if (!Number.isInteger(c.billingDay) || c.billingDay < 1 || c.billingDay > 31) errors.billingDay = 'Choose a day from 1 to 31.'
  if (!Number.isInteger(c.dueDay) || c.dueDay < 1 || c.dueDay > 31) errors.dueDay = 'Choose a day from 1 to 31.'
  return errors
}

export function validatePersonName(name: string, people: readonly Person[], selfId?: string): string | null {
  const trimmed = name.trim()
  if (trimmed === '') return 'Enter a name.'
  if (trimmed.length > 80) return 'Keep the name under 80 characters.'
  const clash = people.find((p) => p.id !== selfId && p.name.trim().toLowerCase() === trimmed.toLowerCase())
  return clash ? 'Someone with this name already exists.' : null
}
