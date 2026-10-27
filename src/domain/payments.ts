import { effectOf, usesCard } from './finance.ts'
import type { HistoryEvent, Paise, PayStatus, Transaction } from './types.ts'

/**
 * Paid / unpaid status of credit card charges.
 *
 * A card charge (a purchase, fee or money lent paid by credit card) is
 * Unpaid until the user taps "Mark as paid" — one tap, no other entries
 * needed. Tapping again marks it unpaid. Every change is written to the
 * payment history with its time.
 *
 * Purchases not made on a credit card are paid at the time, so they have
 * no status. The flag does not affect any balance: card balances still come
 * from Credit Card Payment entries.
 */

/** True for entries that put money on a credit card and so need paying off. */
export function isCardCharge(t: Omit<Transaction, 'createdAt' | 'updatedAt'>): boolean {
  if (t.type === 'adjustment' || t.type === 'card_payment') return false
  const e = effectOf({ ...t, createdAt: '', updatedAt: '' })
  return e.cardId !== null && e.card > 0
}

export interface ChargeStatus {
  status: PayStatus
  /** Amount on the card for this charge (minus refunds credited back to the card). */
  owed: Paise
  /** What is left to pay: 0 when paid, otherwise `owed`. */
  left: Paise
  /** When it was marked paid, if it is paid. */
  paidAt: string | null
}

/** Status of every card charge in one pass. */
export function computeChargeStatuses(transactions: readonly Transaction[]): Map<string, ChargeStatus> {
  const refundedToCard = new Map<string, Paise>()
  for (const t of transactions) {
    if (t.type === 'refund' && t.linkedTransactionId && usesCard(t) && t.cardId) {
      refundedToCard.set(t.linkedTransactionId, (refundedToCard.get(t.linkedTransactionId) ?? 0) + t.amount)
    }
  }
  const result = new Map<string, ChargeStatus>()
  for (const t of transactions) {
    if (!isCardCharge(t)) continue
    const owed = Math.max(0, t.amount - (refundedToCard.get(t.id) ?? 0))
    const paid = t.paid === true || owed === 0
    result.set(t.id, { status: paid ? 'paid' : 'unpaid', owed, left: paid ? 0 : owed, paidAt: t.paid ? (t.paidAt ?? null) : null })
  }
  return result
}

export const STATUS_LABELS: Record<PayStatus, string> = {
  paid: 'Paid',
  partly_paid: 'Partly paid',
  unpaid: 'Unpaid',
}

/** The two choices offered in filters (partly paid only exists in old history). */
export const FILTER_STATUSES = ['paid', 'unpaid'] as const

// ─── Migration from v2.5 ticks ───────────────────────────────────────────────

/**
 * v2.5 marked purchases paid by ticking them in a Credit Card Payment. To
 * keep what the user already did, charges fully covered by those ticks are
 * marked paid (at the time of the latest covering payment). Nothing else
 * changes; the ticks themselves stay stored.
 */
export function chargesPaidByTicks(transactions: readonly Transaction[]): Transaction[] {
  const ticked = new Map<string, { amount: Paise; at: string }>()
  for (const p of transactions) {
    if (p.type !== 'card_payment') continue
    for (const a of p.allocations ?? []) {
      const prev = ticked.get(a.transactionId)
      ticked.set(a.transactionId, { amount: (prev?.amount ?? 0) + a.amount, at: prev && prev.at > p.updatedAt ? prev.at : p.updatedAt })
    }
  }
  const statuses = computeChargeStatuses(transactions)
  const out: Transaction[] = []
  for (const t of transactions) {
    const tick = ticked.get(t.id)
    const s = statuses.get(t.id)
    if (!tick || !s || t.paid) continue
    if (tick.amount >= s.owed) out.push({ ...t, paid: true, paidAt: tick.at })
  }
  return out
}

// ─── History ─────────────────────────────────────────────────────────────────

export interface ChangeContext {
  /** The entry being saved or deleted. */
  trigger: Transaction
  action: 'saved' | 'created' | 'deleted' | 'marked'
  at: string
  newId: () => string
}

function reasonFor(ctx: ChangeContext, to: PayStatus | 'deleted'): string {
  if (ctx.action === 'marked') return to === 'paid' ? 'Marked as paid' : 'Marked as unpaid'
  const t = ctx.trigger
  if (t.type === 'refund') return ctx.action === 'deleted' ? 'Refund deleted' : 'Refund recorded'
  return ctx.action === 'deleted' ? 'Purchase deleted' : ctx.action === 'created' ? 'Purchase added' : 'Purchase edited'
}

/**
 * History entries for every card charge whose status (or amount owed)
 * changed between two snapshots of the data.
 */
export function statusChanges(before: readonly Transaction[], after: readonly Transaction[], ctx: ChangeContext): HistoryEvent[] {
  const sBefore = computeChargeStatuses(before)
  const sAfter = computeChargeStatuses(after)
  const byIdBefore = new Map(before.map((t) => [t.id, t]))
  const byIdAfter = new Map(after.map((t) => [t.id, t]))
  const ids = new Set([...sBefore.keys(), ...sAfter.keys()])
  const events: HistoryEvent[] = []
  for (const id of ids) {
    const b = sBefore.get(id)
    const a = sAfter.get(id)
    if (b && b.status === a?.status && b.owed === a.owed) continue
    const charge = byIdAfter.get(id) ?? byIdBefore.get(id)
    if (!charge) continue
    const to = a?.status ?? 'deleted'
    events.push({
      id: ctx.newId(),
      at: ctx.at,
      transactionId: id,
      description: charge.description,
      cardId: charge.cardId,
      owed: (a ?? b)?.owed ?? charge.amount,
      fromStatus: b?.status ?? null,
      toStatus: to,
      paidBefore: b ? b.owed - b.left : 0,
      paidAfter: a ? a.owed - a.left : 0,
      paymentId: null,
      reason: reasonFor(ctx, to),
      createdAt: ctx.at,
      updatedAt: ctx.at,
    })
  }
  return events.sort((x, y) => x.description.localeCompare(y.description))
}
