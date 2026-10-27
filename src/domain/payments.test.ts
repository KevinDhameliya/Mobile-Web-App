import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { computeChargeStatuses, statusChanges, validateAllocations, withoutAllocationTo } from './payments.ts'
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
const card = (id: string): CreditCard => ({ id, nickname: id, bankName: 'B', last4: '1234', creditLimit: null, billingDay: 5, dueDay: 25, archived: false, createdAt: '', updatedAt: '' })
const hdfc = { paymentMethod: 'credit_card' as const, cardId: 'hdfc' }
const ctx = (transactions: Transaction[]) => ({ cards: [card('hdfc'), card('sbi')], people: [], transactions, today: '2026-10-27' })

describe('payment status of card purchases', () => {
  it('a card purchase with no linked payment is unpaid; non-card purchases are not tracked', () => {
    const a = txn({ type: 'purchase', amount: R(13400), ...hdfc })
    const upi = txn({ type: 'purchase', amount: R(500) })
    const s = computeChargeStatuses([a, upi])
    assert.equal(s.get(a.id)?.status, 'unpaid')
    assert.equal(s.has(upi.id), false)
  })

  it('a payment that ticks purchases marks them paid / partly paid', () => {
    const a = txn({ type: 'purchase', amount: R(13400), ...hdfc })
    const b = txn({ type: 'purchase', amount: R(560), ...hdfc })
    const pay = txn({ type: 'card_payment', amount: R(10000), cardId: 'hdfc', paymentMethod: 'net_banking', allocations: [{ transactionId: a.id, amount: R(9440) }, { transactionId: b.id, amount: R(560) }] })
    const s = computeChargeStatuses([a, b, pay])
    assert.deepEqual([s.get(a.id)?.status, s.get(a.id)?.left], ['partly_paid', R(3960)])
    assert.equal(s.get(b.id)?.status, 'paid')
  })

  it('two payments together can complete one purchase', () => {
    const a = txn({ type: 'purchase', amount: R(1000), ...hdfc })
    const p1 = txn({ type: 'card_payment', amount: R(400), cardId: 'hdfc', paymentMethod: 'upi', allocations: [{ transactionId: a.id, amount: R(400) }] })
    const p2 = txn({ type: 'card_payment', amount: R(600), cardId: 'hdfc', paymentMethod: 'upi', allocations: [{ transactionId: a.id, amount: R(600) }] })
    assert.equal(computeChargeStatuses([a, p1, p2]).get(a.id)?.status, 'paid')
  })

  it('a refund back to the card lowers what is owed', () => {
    const a = txn({ type: 'purchase', amount: R(1000), ...hdfc })
    const r = txn({ type: 'refund', amount: R(300), linkedTransactionId: a.id, ...hdfc })
    const pay = txn({ type: 'card_payment', amount: R(700), cardId: 'hdfc', paymentMethod: 'upi', allocations: [{ transactionId: a.id, amount: R(700) }] })
    const s = computeChargeStatuses([a, r, pay]).get(a.id)
    assert.deepEqual([s?.owed, s?.status], [R(700), 'paid'])
  })

  it('old card payments without allocations change nothing (existing data stays valid)', () => {
    const a = txn({ type: 'purchase', amount: R(1000), ...hdfc })
    const oldPay = txn({ type: 'card_payment', amount: R(1000), cardId: 'hdfc', paymentMethod: 'upi' })
    assert.equal(computeChargeStatuses([a, oldPay]).get(a.id)?.status, 'unpaid')
    assert.deepEqual(validateTransaction(oldPay, ctx([a, oldPay])), {})
  })
})

describe('validating which purchases a payment pays', () => {
  it('rejects paying more than is left on a purchase, more than the payment, or a purchase on another card', () => {
    const a = txn({ type: 'purchase', amount: R(500), ...hdfc })
    const b = txn({ type: 'purchase', amount: R(500), ...hdfc })
    const s = txn({ type: 'purchase', amount: R(500), paymentMethod: 'credit_card', cardId: 'sbi' })
    const base = { type: 'card_payment' as const, amount: R(600), cardId: 'hdfc', paymentMethod: 'upi' as const }
    assert.match(validateAllocations(txn({ ...base, allocations: [{ transactionId: a.id, amount: R(501) }] }), [a, b]) ?? '', /left/)
    assert.match(validateAllocations(txn({ ...base, allocations: [{ transactionId: a.id, amount: R(500) }, { transactionId: b.id, amount: R(500) }] }), [a, b]) ?? '', /more than this payment/)
    assert.match(validateAllocations(txn({ ...base, allocations: [{ transactionId: s.id, amount: R(100) }] }), [s]) ?? '', /different card/)
  })

  it('editing a payment does not count its own ticks against the purchase', () => {
    const a = txn({ type: 'purchase', amount: R(500), ...hdfc })
    const pay = txn({ type: 'card_payment', amount: R(500), cardId: 'hdfc', paymentMethod: 'upi', allocations: [{ transactionId: a.id, amount: R(500) }] })
    assert.equal(validateAllocations(pay, [a, pay]), null)
  })

  it('a paid purchase cannot be lowered below what was paid or moved off the card', () => {
    const a = txn({ type: 'purchase', amount: R(1000), ...hdfc })
    const pay = txn({ type: 'card_payment', amount: R(800), cardId: 'hdfc', paymentMethod: 'upi', allocations: [{ transactionId: a.id, amount: R(800) }] })
    assert.match(validateTransaction({ ...a, amount: R(700) }, ctx([a, pay])).amount ?? '', /800/)
    assert.equal(validateTransaction({ ...a, amount: R(900) }, ctx([a, pay])).amount, undefined)
    assert.ok(validateTransaction({ ...a, paymentMethod: 'upi' }, ctx([a, pay])).cardId)
    assert.ok(validateTransaction({ ...a, cardId: 'sbi' }, ctx([a, pay])).cardId)
  })

  it('only card payments keep allocations after normalising', () => {
    const p = normalizeTransaction({ ...txn({ type: 'purchase', amount: 1 }), allocations: [{ transactionId: 'x', amount: 1 }] })
    assert.equal(p.allocations, undefined)
  })
})

describe('status history', () => {
  const at = '2026-10-27T12:00:00.000Z'
  let n = 0
  const newId = () => `h${String((n += 1))}`

  it('records a change for each purchase a payment affects, with before/after', () => {
    const a = txn({ type: 'purchase', amount: R(1000), description: 'Jio mart', ...hdfc })
    const b = txn({ type: 'purchase', amount: R(500), description: 'Bus', ...hdfc })
    const pay = txn({ type: 'card_payment', amount: R(1200), cardId: 'hdfc', paymentMethod: 'upi', allocations: [{ transactionId: a.id, amount: R(1000) }, { transactionId: b.id, amount: R(200) }] })
    const events = statusChanges([a, b], [a, b, pay], { trigger: pay, action: 'created', at, newId })
    assert.deepEqual(
      events.map((e) => [e.description, e.fromStatus, e.toStatus, e.paidAfter, e.reason, e.paymentId]),
      [
        ['Bus', 'unpaid', 'partly_paid', R(200), 'Payment recorded', pay.id],
        ['Jio mart', 'unpaid', 'paid', R(1000), 'Payment recorded', pay.id],
      ],
    )
  })

  it('records new card purchases and deletions, and nothing when nothing changed', () => {
    const a = txn({ type: 'purchase', amount: R(1000), ...hdfc })
    assert.equal(statusChanges([], [a], { trigger: a, action: 'created', at, newId })[0]?.toStatus, 'unpaid')
    assert.equal(statusChanges([a], [], { trigger: a, action: 'deleted', at, newId })[0]?.toStatus, 'deleted')
    assert.equal(statusChanges([a], [{ ...a, notes: 'x' }], { trigger: a, action: 'saved', at, newId }).length, 0)
  })

  it('deleting a payment reverts its purchases to unpaid', () => {
    const a = txn({ type: 'purchase', amount: R(1000), ...hdfc })
    const pay = txn({ type: 'card_payment', amount: R(1000), cardId: 'hdfc', paymentMethod: 'upi', allocations: [{ transactionId: a.id, amount: R(1000) }] })
    const e = statusChanges([a, pay], [a], { trigger: pay, action: 'deleted', at, newId })[0]
    assert.deepEqual([e.fromStatus, e.toStatus, e.reason], ['paid', 'unpaid', 'Payment deleted'])
  })

  it('deleting a purchase removes it from the payments that ticked it', () => {
    const pay = txn({ type: 'card_payment', amount: R(1000), cardId: 'hdfc', paymentMethod: 'upi', allocations: [{ transactionId: 'gone', amount: R(600) }, { transactionId: 'kept', amount: R(400) }] })
    assert.deepEqual(withoutAllocationTo(pay, 'gone')?.allocations, [{ transactionId: 'kept', amount: R(400) }])
    assert.equal(withoutAllocationTo(pay, 'other'), null)
  })
})
