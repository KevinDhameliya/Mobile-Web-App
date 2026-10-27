import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { computeOverview } from './finance.ts'
import { chargesPaidByTicks, computeChargeStatuses, statusChanges } from './payments.ts'
import type { CreditCard, Transaction } from './types.ts'
import { normalizeTransaction, validateTransaction } from './validation.ts'

const R = (rupees: number) => Math.round(rupees * 100)
let seq = 0
function txn(p: Partial<Transaction> & Pick<Transaction, 'type' | 'amount'>): Transaction {
  seq += 1
  return {
    id: `t${String(seq)}`,
    date: '2026-10-20',
    description: `entry ${String(seq)}`,
    category: '',
    paymentMethod: 'upi',
    cardId: null,
    merchant: '',
    personId: null,
    recoverableAmount: 0,
    returnDirection: null,
    adjustmentTarget: null,
    adjustmentDirection: null,
    linkedTransactionId: null,
    notes: '',
    createdAt: `2026-10-20T00:00:${String(seq).padStart(2, '0')}Z`,
    updatedAt: '2026-10-20T00:00:00Z',
    ...p,
  }
}
const card: CreditCard = { id: 'hdfc', nickname: 'HDFC', bankName: 'B', last4: '1234', creditLimit: null, billingDay: 5, dueDay: 25, archived: false, createdAt: '', updatedAt: '' }
const hdfc = { paymentMethod: 'credit_card' as const, cardId: 'hdfc' }

describe('one-tap paid / unpaid', () => {
  it('a new card purchase is unpaid; marking it paid makes it paid; non-card purchases have no status', () => {
    const a = txn({ type: 'purchase', amount: R(10), ...hdfc })
    const upi = txn({ type: 'purchase', amount: R(10) })
    assert.equal(computeChargeStatuses([a, upi]).get(a.id)?.status, 'unpaid')
    assert.equal(computeChargeStatuses([a, upi]).has(upi.id), false)
    const paid = { ...a, paid: true, paidAt: '2026-10-27T13:00:00.000Z' }
    assert.deepEqual(computeChargeStatuses([paid]).get(a.id), { status: 'paid', owed: R(10), left: 0, paidAt: '2026-10-27T13:00:00.000Z' })
  })

  it('marking paid changes no balance or total', () => {
    const a = txn({ type: 'purchase', amount: R(13400), ...hdfc })
    const before = computeOverview([a], [card], [], '2026-10-27')
    const after = computeOverview([{ ...a, paid: true }], [card], [], '2026-10-27')
    assert.deepEqual([after.cardOutstanding, after.totals.spending], [before.cardOutstanding, before.totals.spending])
  })

  it('a purchase fully refunded to the card counts as paid', () => {
    const a = txn({ type: 'purchase', amount: R(500), ...hdfc })
    const r = txn({ type: 'refund', amount: R(500), linkedTransactionId: a.id, ...hdfc })
    assert.equal(computeChargeStatuses([a, r]).get(a.id)?.status, 'paid')
  })

  it('editing keeps the paid flag; moving off the card drops it', () => {
    const a = txn({ type: 'purchase', amount: R(500), ...hdfc, paid: true, paidAt: 'x' })
    assert.equal(normalizeTransaction({ ...a, description: 'renamed' }).paid, true)
    const moved = normalizeTransaction({ ...a, paymentMethod: 'upi' })
    assert.deepEqual([moved.paid, moved.paidAt], [undefined, undefined])
  })

  it('old v2.5 card payments with ticks still validate and save as they are', () => {
    const a = txn({ type: 'purchase', amount: R(500), ...hdfc })
    const pay = txn({ type: 'card_payment', amount: R(500), cardId: 'hdfc', paymentMethod: 'upi', allocations: [{ transactionId: a.id, amount: R(500) }] })
    assert.deepEqual(validateTransaction(pay, { cards: [card], people: [], transactions: [a, pay], today: '2026-10-27' }), {})
    assert.deepEqual(normalizeTransaction(pay).allocations, pay.allocations)
  })
})

describe('keeping what was marked in v2.5', () => {
  it('purchases fully covered by ticks become paid; partly covered ones stay unpaid', () => {
    const full = txn({ type: 'purchase', amount: R(10), ...hdfc })
    const part = txn({ type: 'purchase', amount: R(560), ...hdfc })
    const none = txn({ type: 'purchase', amount: R(17), ...hdfc })
    const pay = txn({ type: 'card_payment', amount: R(310), cardId: 'hdfc', paymentMethod: 'upi', updatedAt: '2026-10-27T13:10:00.000Z', allocations: [{ transactionId: full.id, amount: R(10) }, { transactionId: part.id, amount: R(300) }] })
    const marked = chargesPaidByTicks([full, part, none, pay])
    assert.deepEqual(marked.map((t) => [t.id, t.paid, t.paidAt]), [[full.id, true, '2026-10-27T13:10:00.000Z']])
  })

  it('does nothing when there are no ticks (existing data unchanged)', () => {
    const a = txn({ type: 'purchase', amount: R(10), ...hdfc })
    assert.equal(chargesPaidByTicks([a, txn({ type: 'card_payment', amount: R(10), cardId: 'hdfc', paymentMethod: 'upi' })]).length, 0)
  })
})

describe('status history', () => {
  const at = '2026-10-27T12:00:00.000Z'
  let n = 0
  const newId = () => `h${String((n += 1))}`

  it('records marking paid and unpaid with the time', () => {
    const a = txn({ type: 'purchase', amount: R(10), description: 'Tea', ...hdfc })
    const paid = { ...a, paid: true, paidAt: at }
    const e1 = statusChanges([a], [paid], { trigger: paid, action: 'marked', at, newId })[0]
    assert.deepEqual([e1.description, e1.fromStatus, e1.toStatus, e1.reason, e1.at, e1.paidAfter], ['Tea', 'unpaid', 'paid', 'Marked as paid', at, R(10)])
    const e2 = statusChanges([paid], [a], { trigger: a, action: 'marked', at, newId })[0]
    assert.deepEqual([e2.fromStatus, e2.toStatus, e2.reason], ['paid', 'unpaid', 'Marked as unpaid'])
  })

  it('records new card purchases and deletions, and nothing when nothing changed', () => {
    const a = txn({ type: 'purchase', amount: R(1000), ...hdfc })
    assert.equal(statusChanges([], [a], { trigger: a, action: 'created', at, newId })[0]?.toStatus, 'unpaid')
    assert.equal(statusChanges([a], [], { trigger: a, action: 'deleted', at, newId })[0]?.toStatus, 'deleted')
    assert.equal(statusChanges([a], [{ ...a, notes: 'x' }], { trigger: a, action: 'saved', at, newId }).length, 0)
  })
})
