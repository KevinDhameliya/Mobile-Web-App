import { addDays, addMonths, monthKey, parts, toISODate, weekStart } from './dates.ts'
import { addToTotals, effectOf, emptyTotals, type Totals } from './finance.ts'
import { TYPE_LABELS } from './labels.ts'
import { paiseToRupeeString } from './money.ts'
import type { CreditCard, ISODate, Paise, Person, Transaction } from './types.ts'

export type RangeKey = 'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'all'

export const RANGE_LABELS: Record<RangeKey, string> = {
  this_month: 'This month',
  last_month: 'Last month',
  last_3_months: 'Last 3 months',
  this_year: 'This year',
  all: 'All time',
}

export function rangeBounds(range: RangeKey, today: ISODate): { from: ISODate | null; to: ISODate | null } {
  const { y, m } = parts(today)
  switch (range) {
    case 'this_month':
      return { from: toISODate(y, m, 1), to: null }
    case 'last_month': {
      const p = addMonths(y, m, -1)
      return { from: toISODate(p.y, p.m, 1), to: addDays(toISODate(y, m, 1), -1) }
    }
    case 'last_3_months': {
      const p = addMonths(y, m, -2)
      return { from: toISODate(p.y, p.m, 1), to: null }
    }
    case 'this_year':
      return { from: toISODate(y, 1, 1), to: null }
    case 'all':
      return { from: null, to: null }
  }
}

export function inRange(t: Transaction, from: ISODate | null, to: ISODate | null): boolean {
  return (from === null || t.date >= from) && (to === null || t.date <= to)
}

export interface PeriodRow {
  key: string
  totals: Totals
}

export type Granularity = 'day' | 'week' | 'month'

/** Totals per day / week (Mon–Sun) / month for the most recent `count` periods. */
export function periodSummaries(transactions: readonly Transaction[], granularity: Granularity, today: ISODate, count: number): PeriodRow[] {
  const keys: string[] = []
  if (granularity === 'day') for (let i = count - 1; i >= 0; i--) keys.push(addDays(today, -i))
  if (granularity === 'week') {
    const start = weekStart(today)
    for (let i = count - 1; i >= 0; i--) keys.push(addDays(start, -7 * i))
  }
  if (granularity === 'month') {
    const { y, m } = parts(today)
    for (let i = count - 1; i >= 0; i--) {
      const p = addMonths(y, m, -i)
      keys.push(toISODate(p.y, p.m, 1).slice(0, 7))
    }
  }
  const rows = new Map(keys.map((k) => [k, emptyTotals()]))
  const keyOf = (d: ISODate) => (granularity === 'day' ? d : granularity === 'week' ? weekStart(d) : monthKey(d))
  for (const t of transactions) {
    const totals = rows.get(keyOf(t.date))
    if (totals) addToTotals(totals, t)
  }
  return keys.reverse().map((key) => ({ key, totals: rows.get(key) ?? emptyTotals() }))
}

export interface GroupRow {
  label: string
  amount: Paise
  count: number
}

function sortGroups(map: Map<string, GroupRow>): GroupRow[] {
  return [...map.values()].filter((r) => r.amount !== 0).sort((a, b) => b.amount - a.amount)
}

/** Own net spending per category (purchases I keep + fees − refunds). */
export function spendingByCategory(transactions: readonly Transaction[]): GroupRow[] {
  const map = new Map<string, GroupRow>()
  for (const t of transactions) {
    const e = effectOf(t)
    if (e.spending === 0) continue
    const label = t.category || 'Uncategorised'
    const row = map.get(label) ?? { label, amount: 0, count: 0 }
    row.amount += e.spending
    row.count += 1
    map.set(label, row)
  }
  return sortGroups(map)
}

/** Gross purchase value per store / merchant. */
export function purchasesByMerchant(transactions: readonly Transaction[]): GroupRow[] {
  const map = new Map<string, GroupRow>()
  for (const t of transactions) {
    if (t.type !== 'purchase') continue
    const label = t.merchant || 'Not specified'
    const key = label.toLowerCase()
    const row = map.get(key) ?? { label, amount: 0, count: 0 }
    row.amount += t.amount
    row.count += 1
    map.set(key, row)
  }
  return sortGroups(map)
}

export interface CardSpendRow {
  card: CreditCard
  charges: Paise
  credits: Paise
  payments: Paise
}

/** Charges, credits and payments per card within the given transactions. */
export function cardActivity(transactions: readonly Transaction[], cards: readonly CreditCard[]): CardSpendRow[] {
  return cards.map((card) => {
    const row: CardSpendRow = { card, charges: 0, credits: 0, payments: 0 }
    for (const t of transactions) {
      const e = effectOf(t)
      if (e.cardId !== card.id) continue
      if (t.type === 'card_payment') row.payments += t.amount
      else if (t.type === 'adjustment') continue
      else if (e.card > 0) row.charges += e.card
      else row.credits += -e.card
    }
    return row
  })
}

export function receivedBreakdown(transactions: readonly Transaction[]): Totals {
  const totals = emptyTotals()
  for (const t of transactions) addToTotals(totals, t)
  return totals
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

function csvCell(value: string): string {
  // Neutralise spreadsheet formula injection and quote everything.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${safe.replace(/"/g, '""')}"`
}


export function transactionsToCSV(transactions: readonly Transaction[], cards: readonly CreditCard[], people: readonly Person[]): string {
  const cardName = new Map(cards.map((c) => [c.id, `${c.nickname} ••${c.last4}`]))
  const personName = new Map(people.map((p) => [p.id, p.name]))
  const header = [
    'Date', 'Type', 'Direction', 'Amount (INR)', 'Description', 'Category', 'Payment method', 'Credit card',
    'Merchant', 'Person', 'Recoverable (INR)', 'My spending (INR)', 'Card balance change (INR)',
    'Person balance change (INR)', 'Linked to', 'Notes', 'ID',
  ]
  const rows = [...transactions]
    .sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date)))
    .map((t) => {
      const e = effectOf(t)
      const direction =
        t.type === 'returned' ? (t.returnDirection === 'by_me' ? 'I returned' : 'Returned to me')
          : t.type === 'adjustment' ? `${t.adjustmentDirection ?? ''} ${t.adjustmentTarget ?? ''}`.trim()
            : ''
      return [
        t.date, TYPE_LABELS[t.type], direction, paiseToRupeeString(t.amount), t.description, t.category, t.paymentMethod,
        t.cardId ? (cardName.get(t.cardId) ?? '') : '', t.merchant, t.personId ? (personName.get(t.personId) ?? '') : '',
        paiseToRupeeString(t.recoverableAmount), paiseToRupeeString(e.spending), paiseToRupeeString(e.card),
        paiseToRupeeString(e.person), t.linkedTransactionId ?? '', t.notes, t.id,
      ].map(csvCell).join(',')
    })
  return [header.map(csvCell).join(','), ...rows].join('\r\n')
}
