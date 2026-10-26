import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createBackup, parseBackup, planMerge } from './backup.ts'
import { addDays } from './dates.ts'
import {
  computeOverview,
  computeTotals,
  dueDateFor,
  effectOf,
  lastStatementDate,
  summarizeCard,
  summarizePerson,
} from './finance.ts'
import { formatINR, parseRupees } from './money.ts'
import { periodSummaries, purchasesByMerchant, spendingByCategory, transactionsToCSV } from './reports.ts'
import type { CreditCard, Person, Transaction } from './types.ts'
import { findPossibleDuplicates, normalizeTransaction, validateTransaction } from './validation.ts'

/** Minimal expect() on top of node:assert so tests need no extra dependency. */
function expect(actual: unknown) {
  return {
    toBe: (expected: unknown) => { assert.equal(actual, expected) },
    toEqual: (expected: unknown) => { assert.deepEqual(actual, expected) },
    toBeNull: () => { assert.equal(actual, null) },
    toBeDefined: () => { assert.notEqual(actual, undefined) },
    toBeUndefined: () => { assert.equal(actual, undefined) },
    toMatch: (re: RegExp) => { assert.match(String(actual), re) },
    toContain: (part: string) => { assert.ok(String(actual).includes(part), `${String(actual)} should contain ${part}`) },
    toHaveLength: (n: number) => { assert.equal((actual as unknown[]).length, n) },
    toMatchObject: (subset: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(subset)) assert.deepEqual((actual as Record<string, unknown>)[k], v, k)
    },
    not: { toBe: (expected: unknown) => { assert.notEqual(actual, expected) } },
  }
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const R = (rupees: number) => Math.round(rupees * 100)
let seq = 0

function txn(partial: Partial<Transaction> & Pick<Transaction, 'type' | 'amount'>): Transaction {
  seq += 1
  return {
    id: `t${String(seq)}`,
    date: '2026-10-10',
    description: 'test',
    category: 'Other',
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
    createdAt: `2026-10-10T00:00:${String(seq).padStart(2, '0')}Z`,
    updatedAt: '2026-10-10T00:00:00Z',
    ...partial,
  }
}

const hdfc: CreditCard = {
  id: 'hdfc',
  nickname: 'HDFC Millennia',
  bankName: 'HDFC Bank',
  last4: '1234',
  creditLimit: R(100000),
  billingDay: 5,
  dueDay: 25,
  archived: false,
  createdAt: '',
  updatedAt: '',
}
const ravi: Person = { id: 'ravi', name: 'Ravi', notes: '', createdAt: '', updatedAt: '' }
const asha: Person = { id: 'asha', name: 'Asha', notes: '', createdAt: '', updatedAt: '' }
const onCard = { paymentMethod: 'credit_card' as const, cardId: 'hdfc' }

// ─── Money ───────────────────────────────────────────────────────────────────

describe('money parsing and formatting', () => {
  it('parses rupee input into integer paise without floating-point error', () => {
    expect(parseRupees('25,000')).toEqual({ ok: true, value: 2500000 })
    expect(parseRupees('₹ 1,25,000.5')).toEqual({ ok: true, value: 12500050 })
    expect(parseRupees('0.1')).toEqual({ ok: true, value: 10 })
    expect(parseRupees('0.29')).toEqual({ ok: true, value: 29 })
  })
  it('rejects invalid amounts', () => {
    expect(parseRupees('').ok).toBe(false)
    expect(parseRupees('0').ok).toBe(false)
    expect(parseRupees('-500').ok).toBe(false)
    expect(parseRupees('12.345').ok).toBe(false)
    expect(parseRupees('abc').ok).toBe(false)
    expect(parseRupees('2000000000').ok).toBe(false)
  })
  it('formats with Indian digit grouping', () => {
    expect(formatINR(R(125000))).toBe('₹1,25,000')
    expect(formatINR(R(25000.5))).toBe('₹25,000.50')
    expect(formatINR(R(-800))).toContain('800')
  })
})

// ─── Double counting ─────────────────────────────────────────────────────────

describe('credit card purchase and bill payment', () => {
  const purchase = txn({ type: 'purchase', amount: R(25000), description: 'Vivo phone', merchant: 'Flipkart', ...onCard })
  const payment = txn({ type: 'card_payment', amount: R(5000), cardId: 'hdfc', paymentMethod: 'net_banking' })

  it('counts the purchase as spending exactly once', () => {
    const totals = computeTotals([purchase, payment])
    expect(totals.spending).toBe(R(25000))
    expect(totals.purchases).toBe(R(25000))
  })

  it('treats the bill payment as a transfer that only reduces the card balance', () => {
    const e = effectOf(payment)
    expect(e.spending).toBe(0)
    expect(e.income).toBe(0)
    expect(e.card).toBe(-R(5000))
    const s = summarizeCard(hdfc, [purchase, payment], '2026-10-20')
    expect(s.charges).toBe(R(25000))
    expect(s.payments).toBe(R(5000))
    expect(s.outstanding).toBe(R(20000))
    expect(s.availableCredit).toBe(R(80000))
  })

  it('paying the full bill brings the card to zero while spending stays the same', () => {
    const full = txn({ type: 'card_payment', amount: R(20000), cardId: 'hdfc', paymentMethod: 'upi' })
    const o = computeOverview([purchase, payment, full], [hdfc], [], '2026-10-20')
    expect(o.cardOutstanding).toBe(0)
    expect(o.totals.spending).toBe(R(25000))
  })

  it('a purchase paid by UPI does not touch any card', () => {
    const upi = txn({ type: 'purchase', amount: R(999), cardId: 'hdfc', paymentMethod: 'upi' })
    expect(effectOf(upi).card).toBe(0)
    expect(effectOf(upi).cardId).toBeNull()
  })
})

describe('people and settlements', () => {
  it('money lent is a receivable, not an expense', () => {
    const lent = txn({ type: 'lent', amount: R(1000), personId: 'ravi' })
    const o = computeOverview([lent], [], [ravi], '2026-10-20')
    expect(o.totals.spending).toBe(0)
    expect(o.owedToMe).toBe(R(1000))
  })

  it('money borrowed is a liability, not income', () => {
    const borrowed = txn({ type: 'borrowed', amount: R(3000), personId: 'asha' })
    const o = computeOverview([borrowed], [], [asha], '2026-10-20')
    expect(o.totals.income).toBe(0)
    expect(o.iOwePeople).toBe(R(3000))
    expect(o.owedToMe).toBe(0)
  })

  it('a linked repayment reduces what the friend owes and is not counted as income', () => {
    const lent = txn({ type: 'lent', amount: R(1000), personId: 'ravi' })
    const back = txn({ type: 'returned', amount: R(500), personId: 'ravi', returnDirection: 'to_me', linkedTransactionId: lent.id })
    const s = summarizePerson(ravi, [lent, back])
    expect(s.balance).toBe(R(500))
    expect(s.debts[0]?.remaining).toBe(R(500))
    const totals = computeTotals([lent, back])
    expect(totals.income).toBe(0)
    expect(totals.recovered).toBe(R(500))
  })

  it('buying something for a friend splits own spending from the amount to recover', () => {
    const p = txn({ type: 'purchase', amount: R(2000), personId: 'ravi', recoverableAmount: R(2000), ...onCard })
    const o = computeOverview([p], [hdfc], [ravi], '2026-10-20')
    expect(o.totals.spending).toBe(0)
    expect(o.totals.purchases).toBe(R(2000))
    expect(o.owedToMe).toBe(R(2000))
    expect(o.cardOutstanding).toBe(R(2000))
  })

  it('partial recovery on a shared purchase', () => {
    const p = txn({ type: 'purchase', amount: R(3000), personId: 'ravi', recoverableAmount: R(1500) })
    const e = effectOf(p)
    expect(e.spending).toBe(R(1500))
    expect(e.person).toBe(R(1500))
  })

  it('returning borrowed money reduces my liability and is not spending', () => {
    const b = txn({ type: 'borrowed', amount: R(3000), personId: 'asha' })
    const r = txn({ type: 'returned', amount: R(3000), personId: 'asha', returnDirection: 'by_me', linkedTransactionId: b.id })
    const o = computeOverview([b, r], [], [asha], '2026-10-20')
    expect(o.iOwePeople).toBe(0)
    expect(o.totals.spending).toBe(0)
    expect(summarizePerson(asha, [b, r]).debts[0]?.remaining).toBe(0)
  })

  it('keeps owed-to-me and I-owe separate across people instead of netting them', () => {
    const lent = txn({ type: 'lent', amount: R(1000), personId: 'ravi' })
    const borrowed = txn({ type: 'borrowed', amount: R(400), personId: 'asha' })
    const o = computeOverview([lent, borrowed], [], [ravi, asha], '2026-10-20')
    expect(o.owedToMe).toBe(R(1000))
    expect(o.iOwePeople).toBe(R(400))
  })

  it('rejects a repayment larger than what is left on the linked debt', () => {
    const lent = txn({ type: 'lent', amount: R(1000), personId: 'ravi' })
    const first = txn({ type: 'returned', amount: R(800), personId: 'ravi', returnDirection: 'to_me', linkedTransactionId: lent.id })
    const second = txn({ type: 'returned', amount: R(500), personId: 'ravi', returnDirection: 'to_me', linkedTransactionId: lent.id })
    const errors = validateTransaction(second, { cards: [], people: [ravi], transactions: [lent, first], today: '2026-10-20' })
    expect(errors.amount).toMatch(/₹200/)
  })

  it('editing a repayment does not count its own old amount against the debt', () => {
    const lent = txn({ type: 'lent', amount: R(1000), personId: 'ravi' })
    const back = txn({ type: 'returned', amount: R(1000), personId: 'ravi', returnDirection: 'to_me', linkedTransactionId: lent.id })
    const errors = validateTransaction(back, { cards: [], people: [ravi], transactions: [lent, back], today: '2026-10-20' })
    expect(errors.amount).toBeUndefined()
  })

  it('rejects linking a repayment to another person’s debt', () => {
    const lent = txn({ type: 'lent', amount: R(1000), personId: 'ravi' })
    const back = txn({ type: 'returned', amount: R(100), personId: 'asha', returnDirection: 'to_me', linkedTransactionId: lent.id })
    const errors = validateTransaction(back, { cards: [], people: [ravi, asha], transactions: [lent], today: '2026-10-20' })
    expect(errors.linkedTransactionId).toBeDefined()
  })
})

describe('refunds, cashback and income', () => {
  it('a refund to the card reverses spending and the card balance', () => {
    const p = txn({ type: 'purchase', amount: R(25000), ...onCard })
    const refund = txn({ type: 'refund', amount: R(25000), linkedTransactionId: p.id, ...onCard })
    const o = computeOverview([p, refund], [hdfc], [], '2026-10-20')
    expect(o.totals.spending).toBe(0)
    expect(o.totals.refunds).toBe(R(25000))
    expect(o.cardOutstanding).toBe(0)
    expect(o.totals.income).toBe(0)
  })

  it('cashback is tracked separately and is not income or negative spending', () => {
    const cb = txn({ type: 'cashback', amount: R(800), ...onCard })
    const totals = computeTotals([cb])
    expect(totals.cashback).toBe(R(800))
    expect(totals.income).toBe(0)
    expect(totals.spending).toBe(0)
    expect(effectOf(cb).card).toBe(-R(800))
  })

  it('money received counts as received, not as a repayment', () => {
    const r = txn({ type: 'received', amount: R(500), personId: 'ravi' })
    const totals = computeTotals([r])
    expect(totals.income).toBe(R(500))
    expect(effectOf(r).person).toBe(0)
  })

  it('rejects a refund larger than the remaining purchase amount', () => {
    const p = txn({ type: 'purchase', amount: R(1000) })
    const r1 = txn({ type: 'refund', amount: R(700), linkedTransactionId: p.id })
    const r2 = txn({ type: 'refund', amount: R(400), linkedTransactionId: p.id })
    const errors = validateTransaction(r2, { cards: [], people: [], transactions: [p, r1], today: '2026-10-20' })
    expect(errors.amount).toMatch(/₹300/)
  })

  it('fees are spending and increase the card balance', () => {
    const fee = txn({ type: 'fee', amount: R(500), ...onCard })
    expect(effectOf(fee).spending).toBe(R(500))
    expect(effectOf(fee).card).toBe(R(500))
  })
})

describe('adjustments and stale fields', () => {
  it('adjustments only change their target balance', () => {
    const adj = txn({ type: 'adjustment', amount: R(150), cardId: 'hdfc', adjustmentTarget: 'card', adjustmentDirection: 'decrease', paymentMethod: 'other' })
    const e = effectOf(adj)
    expect(e.card).toBe(-R(150))
    expect(e.spending).toBe(0)
    expect(e.income).toBe(0)
  })

  it('normalisation clears fields left over from another type', () => {
    const stale = txn({ type: 'received', amount: R(500), cardId: 'hdfc', paymentMethod: 'credit_card', recoverableAmount: R(500), linkedTransactionId: 'x' })
    const n = normalizeTransaction(stale)
    expect(n.cardId).toBeNull()
    expect(n.paymentMethod).not.toBe('credit_card')
    expect(n.recoverableAmount).toBe(0)
    expect(n.linkedTransactionId).toBeNull()
  })

  it('validates required fields', () => {
    const bad = txn({ type: 'lent', amount: 0, description: '  ', date: '2026-02-30' })
    const errors = validateTransaction(bad, { cards: [], people: [], transactions: [], today: '2026-10-20' })
    expect(errors.amount).toBeDefined()
    expect(errors.description).toBeDefined()
    expect(errors.date).toBeDefined()
    expect(errors.personId).toBeDefined()
  })

  it('requires a card for card payments and credit-card purchases', () => {
    const p = txn({ type: 'card_payment', amount: R(100), cardId: null })
    expect(validateTransaction(p, { cards: [hdfc], people: [], transactions: [], today: '2026-10-20' }).cardId).toBeDefined()
  })
})

describe('duplicates', () => {
  it('flags a second identical entry but not the record being edited', () => {
    const a = txn({ type: 'purchase', amount: R(25000), ...onCard, date: '2026-10-01' })
    const b = { ...a, id: 'new-id' }
    expect(findPossibleDuplicates(b, [a])).toHaveLength(1)
    expect(findPossibleDuplicates(a, [a])).toHaveLength(0)
  })
})

// ─── Statements ──────────────────────────────────────────────────────────────

describe('credit card statements', () => {
  it('finds the last statement date and the due date', () => {
    expect(lastStatementDate(5, '2026-10-20')).toBe('2026-10-05')
    expect(lastStatementDate(5, '2026-10-05')).toBe('2026-10-05')
    expect(lastStatementDate(5, '2026-10-04')).toBe('2026-09-05')
    expect(lastStatementDate(31, '2026-02-15')).toBe('2026-01-31')
    expect(lastStatementDate(31, '2026-02-28')).toBe('2026-02-28')
    expect(dueDateFor('2026-10-05', 5, 25)).toBe('2026-10-25')
    expect(dueDateFor('2026-10-20', 20, 8)).toBe('2026-11-08')
    expect(dueDateFor('2026-12-20', 20, 8)).toBe('2027-01-08')
  })

  it('reports pending, paid and overdue bills', () => {
    const p = txn({ type: 'purchase', amount: R(25000), date: '2026-09-28', ...onCard })
    const later = txn({ type: 'purchase', amount: R(1000), date: '2026-10-08', ...onCard })
    let s = summarizeCard(hdfc, [p, later], '2026-10-20')
    expect(s.statement.statementBalance).toBe(R(25000))
    expect(s.statement.status).toBe('pending')
    expect(s.statement.daysUntilDue).toBe(5)
    expect(s.outstanding).toBe(R(26000))

    s = summarizeCard(hdfc, [p, later], '2026-10-27')
    expect(s.statement.status).toBe('overdue')

    const pay = txn({ type: 'card_payment', amount: R(25000), date: '2026-10-15', cardId: 'hdfc', paymentMethod: 'upi' })
    s = summarizeCard(hdfc, [p, later, pay], '2026-10-27')
    expect(s.statement.status).toBe('paid')
    expect(s.outstanding).toBe(R(1000))
  })

  it('shows no dues when nothing was billed', () => {
    const later = txn({ type: 'purchase', amount: R(1000), date: '2026-10-08', ...onCard })
    expect(summarizeCard(hdfc, [later], '2026-10-20').statement.status).toBe('no_dues')
  })
})

// ─── Reports, backup ─────────────────────────────────────────────────────────

describe('reports', () => {
  const items = [
    txn({ type: 'purchase', amount: R(25000), category: 'Electronics & Mobiles', merchant: 'Flipkart', date: '2026-10-02' }),
    txn({ type: 'purchase', amount: R(500), category: 'Groceries', merchant: 'flipkart', date: '2026-10-03' }),
    txn({ type: 'refund', amount: R(100), category: 'Groceries', date: '2026-10-04' }),
    txn({ type: 'card_payment', amount: R(5000), cardId: 'hdfc', date: '2026-10-05' }),
    txn({ type: 'lent', amount: R(1000), personId: 'ravi', category: 'Personal transfer', date: '2026-10-05' }),
  ]

  it('category totals are net of refunds and exclude transfers and loans', () => {
    const rows = spendingByCategory(items)
    expect(rows).toEqual([
      { label: 'Electronics & Mobiles', amount: R(25000), count: 1 },
      { label: 'Groceries', amount: R(400), count: 2 },
    ])
  })

  it('merchant totals group names case-insensitively', () => {
    expect(purchasesByMerchant(items)[0]).toMatchObject({ amount: R(25500), count: 2 })
  })

  it('monthly summary sums the month', () => {
    const months = periodSummaries(items, 'month', '2026-10-20', 3)
    expect(months[0]?.key).toBe('2026-10')
    expect(months[0]?.totals.spending).toBe(R(25400))
    expect(months[1]?.totals.count).toBe(0)
  })

  it('weekly buckets start on Monday', () => {
    const weeks = periodSummaries(items, 'week', '2026-10-04', 2)
    // 2026-10-04 is a Sunday → week starts Monday 2026-09-28
    expect(weeks[0]?.key).toBe('2026-09-28')
    expect(weeks[0]?.totals.purchases).toBe(R(25500))
    expect(addDays('2026-09-28', 7)).toBe('2026-10-05')
  })

  it('CSV escapes quotes and neutralises formulas', () => {
    const csv = transactionsToCSV([txn({ type: 'purchase', amount: R(10), description: '=HYPERLINK("x")' })], [], [])
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
  })
})

describe('backup', () => {
  const data = {
    cards: [hdfc],
    people: [ravi],
    transactions: [txn({ type: 'lent', amount: R(1000), personId: 'ravi' })],
  }

  it('round-trips through JSON', () => {
    const parsed = parseBackup(JSON.stringify(createBackup(data)))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.backup.data).toEqual(data)
  })

  it('rejects foreign or corrupted files before anything is written', () => {
    expect(parseBackup('not json').ok).toBe(false)
    expect(parseBackup('{"app":"other"}').ok).toBe(false)
    const broken = createBackup({ ...data, transactions: [{ ...data.transactions[0], amount: -5 } as Transaction] })
    expect(parseBackup(JSON.stringify(broken)).ok).toBe(false)
  })

  it('merge adds only new records, so importing twice cannot double balances', () => {
    const plan = planMerge(data, data)
    expect(plan.add.transactions).toHaveLength(0)
    expect(plan.skipped).toBe(3)
  })
})
