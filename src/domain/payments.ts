import { effectOf, usesCard } from './finance.ts'
import { formatINR } from './money.ts'
import type { Allocation, HistoryEvent, Paise, PayStatus, Transaction } from './types.ts'

/**
 * Payment status of credit card charges.
 *
 * A card charge (a purchase, fee or money lent paid by credit card) is paid
 * off by the credit card payments that the user explicitly links to it:
 * each card payment carries `allocations` saying which charges it pays and
 * how much of each. Nothing is assigned automatically.
 *
 *   owed  = amount − refunds credited back to the card for this charge
 *   paid  = sum of allocations from card payments
 *   left  = max(0, owed − paid)
 *   status: paid (left = 0) · partly paid (0 < paid, left > 0) · unpaid
 *
 * Purchases not made on a credit card are paid at the time, so they are
 * not tracked here.
 */

/** True for entries that put money on a credit card and so must be paid off. */
export function isCardCharge(t: Transaction): boolean {
  if (t.type === 'adjustment' || t.type === 'card_payment') return false
  const e = effectOf(t)
  return e.cardId !== null && e.card > 0
}

export interface ChargeStatus {
  status: PayStatus
  owed: Paise
  paid: Paise
  left: Paise
  /** Card payments that pay this charge, oldest first. */
  payments: { payment: Transaction; amount: Paise }[]
}

export function allocationsOf(t: Transaction): Allocation[] {
  return t.type === 'card_payment' ? (t.allocations ?? []) : []
}

function statusFor(owed: Paise, paid: Paise): PayStatus {
  if (paid > 0 && paid >= owed) return 'paid'
  if (owed <= 0) return 'paid'
  return paid > 0 ? 'partly_paid' : 'unpaid'
}

/** Status of every card charge in one pass. */
export function computeChargeStatuses(transactions: readonly Transaction[]): Map<string, ChargeStatus> {
  const refundedToCard = new Map<string, Paise>()
  const paidBy = new Map<string, { payment: Transaction; amount: Paise }[]>()
  for (const t of transactions) {
    if (t.type === 'refund' && t.linkedTransactionId && usesCard(t) && t.cardId) {
      refundedToCard.set(t.linkedTransactionId, (refundedToCard.get(t.linkedTransactionId) ?? 0) + t.amount)
    }
    for (const a of allocationsOf(t)) {
      const list = paidBy.get(a.transactionId) ?? []
      list.push({ payment: t, amount: a.amount })
      paidBy.set(a.transactionId, list)
    }
  }
  const result = new Map<string, ChargeStatus>()
  for (const t of transactions) {
    if (!isCardCharge(t)) continue
    const owed = Math.max(0, t.amount - (refundedToCard.get(t.id) ?? 0))
    const payments = (paidBy.get(t.id) ?? []).filter((p) => p.payment.cardId === t.cardId)
    payments.sort((a, b) => a.payment.date.localeCompare(b.payment.date) || a.payment.createdAt.localeCompare(b.payment.createdAt))
    const paid = payments.reduce((s, p) => s + p.amount, 0)
    result.set(t.id, { status: statusFor(owed, paid), owed, paid, left: Math.max(0, owed - paid), payments })
  }
  return result
}

/** What is still unpaid on a charge, ignoring the allocations of `excludePaymentId` (the payment being edited). */
export function leftOnCharge(charge: Transaction, transactions: readonly Transaction[], excludePaymentId?: string): Paise {
  const others = excludePaymentId ? transactions.filter((t) => t.id !== excludePaymentId) : transactions
  return computeChargeStatuses(others).get(charge.id)?.left ?? 0
}

export const STATUS_LABELS: Record<PayStatus, string> = {
  paid: 'Paid',
  partly_paid: 'Partly paid',
  unpaid: 'Unpaid',
}

/** Problems with a card payment's allocations, or null when they are fine. */
export function validateAllocations(payment: Transaction | (Omit<Transaction, 'createdAt' | 'updatedAt'> & { createdAt?: string }), transactions: readonly Transaction[]): string | null {
  const list = payment.allocations ?? []
  if (list.length === 0) return null
  const seen = new Set<string>()
  let total = 0
  const others = transactions.filter((t) => t.id !== payment.id)
  const statuses = computeChargeStatuses(others)
  for (const a of list) {
    if (seen.has(a.transactionId)) return 'The same purchase is selected twice.'
    seen.add(a.transactionId)
    if (!Number.isSafeInteger(a.amount) || a.amount <= 0) return 'Each selected purchase needs an amount above ₹0.'
    const charge = others.find((t) => t.id === a.transactionId)
    if (!charge || !isCardCharge(charge)) return 'A selected purchase no longer exists or is not a card purchase.'
    if (charge.cardId !== payment.cardId) return `“${charge.description}” is on a different card.`
    const left = statuses.get(charge.id)?.left ?? 0
    if (a.amount > left) return `Only ${formatINR(left)} is left to pay on “${charge.description}”.`
    total += a.amount
  }
  if (total > payment.amount) return `The selected purchases add up to ${formatINR(total)}, more than this payment of ${formatINR(payment.amount)}.`
  return null
}

// ─── History ─────────────────────────────────────────────────────────────────

export interface ChangeContext {
  /** The entry being saved or deleted. */
  trigger: Transaction
  action: 'saved' | 'created' | 'deleted'
  at: string
  newId: () => string
}

function reasonFor(ctx: ChangeContext): string {
  const t = ctx.trigger
  if (t.type === 'card_payment') return ctx.action === 'deleted' ? 'Payment deleted' : ctx.action === 'created' ? 'Payment recorded' : 'Payment edited'
  if (t.type === 'refund') return ctx.action === 'deleted' ? 'Refund deleted' : 'Refund recorded'
  return ctx.action === 'deleted' ? 'Purchase deleted' : ctx.action === 'created' ? 'Purchase added' : 'Purchase edited'
}

/**
 * History entries for every card charge whose payment status or paid amount
 * changed between two snapshots of the data.
 */
export function statusChanges(before: readonly Transaction[], after: readonly Transaction[], ctx: ChangeContext): HistoryEvent[] {
  const sBefore = computeChargeStatuses(before)
  const sAfter = computeChargeStatuses(after)
  const byIdBefore = new Map(before.map((t) => [t.id, t]))
  const byIdAfter = new Map(after.map((t) => [t.id, t]))
  const ids = new Set([...sBefore.keys(), ...sAfter.keys()])
  const reason = reasonFor(ctx)
  const paymentId = ctx.trigger.type === 'card_payment' ? ctx.trigger.id : null
  const events: HistoryEvent[] = []
  for (const id of ids) {
    const b = sBefore.get(id)
    const a = sAfter.get(id)
    if (b && b.status === a?.status && b.paid === a.paid && b.owed === a.owed) continue
    const charge = byIdAfter.get(id) ?? byIdBefore.get(id)
    if (!charge) continue
    events.push({
      id: ctx.newId(),
      at: ctx.at,
      transactionId: id,
      description: charge.description,
      cardId: charge.cardId,
      owed: (a ?? b)?.owed ?? charge.amount,
      fromStatus: b?.status ?? null,
      toStatus: a?.status ?? 'deleted',
      paidBefore: b?.paid ?? 0,
      paidAfter: a?.paid ?? 0,
      paymentId,
      reason,
      createdAt: ctx.at,
      updatedAt: ctx.at,
    })
  }
  return events.sort((x, y) => x.description.localeCompare(y.description))
}

/** Removes allocations that point at `chargeId` (used when that charge is deleted). */
export function withoutAllocationTo(payment: Transaction, chargeId: string): Transaction | null {
  const list = payment.allocations ?? []
  if (!list.some((a) => a.transactionId === chargeId)) return null
  return { ...payment, allocations: list.filter((a) => a.transactionId !== chargeId) }
}
