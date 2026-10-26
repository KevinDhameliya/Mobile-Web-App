import { addMonths, clampedDate, daysBetween, parts } from './dates.ts'
import type { CreditCard, ISODate, Paise, Person, Transaction } from './types.ts'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Financial rules — the single source of truth for every number in the app.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Each transaction is translated into an `Effect`: how it changes each
 * separate concept. Concepts never borrow from each other, which is what
 * prevents double counting.
 *
 *   spending   my own net expense (purchases I keep + fees − refunds)
 *   income     money received (gifts, salary, other)          — not debts
 *   cashback   rewards / cashback benefits                     — tracked apart
 *   recovered  money people paid back to me                    — not income
 *   card       credit card outstanding (+ = I owe the bank more)
 *   person     balance with a person   (+ = they owe me more, − = I owe them)
 *
 *  Type            spending  income  cashback  recovered  card            person
 *  purchase        +own part                              +amt if card    +recoverable
 *  fee/interest    +amt                                   +amt if card
 *  refund          −amt                                   −amt if to card
 *  received                  +amt
 *  cashback                          +amt                 −amt if to card
 *  card payment                                           −amt (transfer, NOT spending)
 *  lent                                                   +amt if card    +amt
 *  borrowed                                                               −amt (liability, NOT income)
 *  returned→me                                 +amt                       −amt
 *  returned→them                                                          +amt
 *  adjustment                                             ±amt  or        ±amt (target only)
 */
export interface Effect {
  /** Gross purchase value (includes the part bought for others). */
  purchases: Paise
  spending: Paise
  income: Paise
  refunds: Paise
  cashback: Paise
  recovered: Paise
  paidBack: Paise
  cardId: string | null
  card: Paise
  personId: string | null
  person: Paise
}

const ZERO: Omit<Effect, 'cardId' | 'personId'> = {
  purchases: 0,
  spending: 0,
  income: 0,
  refunds: 0,
  cashback: 0,
  recovered: 0,
  paidBack: 0,
  card: 0,
  person: 0,
}

/** True when this transaction moves money on a credit card. */
export function usesCard(t: Pick<Transaction, 'type' | 'paymentMethod' | 'adjustmentTarget'>): boolean {
  switch (t.type) {
    case 'card_payment':
      return true
    case 'adjustment':
      return t.adjustmentTarget === 'card'
    case 'purchase':
    case 'fee':
    case 'lent':
    case 'refund':
    case 'cashback':
      return t.paymentMethod === 'credit_card'
    case 'received':
    case 'borrowed':
    case 'returned':
      return false
  }
}

export function usesPerson(t: Pick<Transaction, 'type' | 'recoverableAmount' | 'adjustmentTarget'>): boolean {
  switch (t.type) {
    case 'lent':
    case 'borrowed':
    case 'returned':
      return true
    case 'purchase':
      return t.recoverableAmount > 0
    case 'adjustment':
      return t.adjustmentTarget === 'person'
    default:
      return false
  }
}

export function effectOf(t: Transaction): Effect {
  const a = t.amount
  const cardId = usesCard(t) ? t.cardId : null
  const personId = usesPerson(t) ? t.personId : null
  const onCard = cardId !== null
  const e: Effect = { ...ZERO, cardId, personId }

  switch (t.type) {
    case 'purchase': {
      const recoverable = personId ? Math.min(t.recoverableAmount, a) : 0
      e.purchases = a
      e.spending = a - recoverable
      e.person = recoverable
      if (onCard) e.card = a
      break
    }
    case 'fee':
      e.spending = a
      if (onCard) e.card = a
      break
    case 'refund':
      e.refunds = a
      e.spending = -a
      if (onCard) e.card = -a
      break
    case 'received':
      e.income = a
      break
    case 'cashback':
      e.cashback = a
      if (onCard) e.card = -a
      break
    case 'card_payment':
      e.card = -a
      break
    case 'lent':
      e.person = a
      if (onCard) e.card = a
      break
    case 'borrowed':
      e.person = -a
      break
    case 'returned':
      if (t.returnDirection === 'by_me') {
        e.person = a
        e.paidBack = a
      } else {
        e.person = -a
        e.recovered = a
      }
      break
    case 'adjustment': {
      const sign = t.adjustmentDirection === 'decrease' ? -1 : 1
      if (t.adjustmentTarget === 'card') e.card = sign * a
      else if (t.adjustmentTarget === 'person') e.person = sign * a
      break
    }
  }
  // An unknown card/person id contributes nothing to that balance.
  if (e.cardId === null) e.card = 0
  if (e.personId === null) e.person = 0
  return e
}

// ─── Totals ──────────────────────────────────────────────────────────────────

export interface Totals {
  purchases: Paise
  spending: Paise
  income: Paise
  refunds: Paise
  cashback: Paise
  recovered: Paise
  paidBack: Paise
  fees: Paise
  cardPayments: Paise
  count: number
}

export function emptyTotals(): Totals {
  return { purchases: 0, spending: 0, income: 0, refunds: 0, cashback: 0, recovered: 0, paidBack: 0, fees: 0, cardPayments: 0, count: 0 }
}

export function addToTotals(totals: Totals, t: Transaction): void {
  const e = effectOf(t)
  totals.purchases += e.purchases
  totals.spending += e.spending
  totals.income += e.income
  totals.refunds += e.refunds
  totals.cashback += e.cashback
  totals.recovered += e.recovered
  totals.paidBack += e.paidBack
  if (t.type === 'fee') totals.fees += t.amount
  if (t.type === 'card_payment') totals.cardPayments += t.amount
  totals.count += 1
}

export function computeTotals(transactions: readonly Transaction[]): Totals {
  const totals = emptyTotals()
  for (const t of transactions) addToTotals(totals, t)
  return totals
}

// ─── Credit cards ────────────────────────────────────────────────────────────

export type BillStatus = 'paid' | 'pending' | 'overdue' | 'no_dues'

export interface CardStatement {
  statementDate: ISODate
  dueDate: ISODate
  /** Estimated amount billed on the statement date. */
  statementBalance: Paise
  /** Payments and credits made after the statement date. */
  paidSinceStatement: Paise
  /** What is still to be paid for this statement. */
  remaining: Paise
  status: BillStatus
  /** Negative when overdue. */
  daysUntilDue: number
}

export interface CardSummary {
  card: CreditCard
  /** Purchases, fees and money lent using the card. */
  charges: Paise
  payments: Paise
  /** Refunds and cashback credited to the card. */
  credits: Paise
  adjustments: Paise
  /** Estimated current outstanding (negative = credit balance on the card). */
  outstanding: Paise
  availableCredit: Paise | null
  statement: CardStatement
}

/** Most recent statement date on or before `today`. */
export function lastStatementDate(billingDay: number, today: ISODate): ISODate {
  const { y, m } = parts(today)
  const thisMonth = clampedDate(y, m, billingDay)
  if (thisMonth <= today) return thisMonth
  const prev = addMonths(y, m, -1)
  return clampedDate(prev.y, prev.m, billingDay)
}

/** Due date for a statement. A due day after the billing day falls in the same month, otherwise the next. */
export function dueDateFor(statementDate: ISODate, billingDay: number, dueDay: number): ISODate {
  const { y, m } = parts(statementDate)
  if (dueDay > billingDay) return clampedDate(y, m, dueDay)
  const next = addMonths(y, m, 1)
  return clampedDate(next.y, next.m, dueDay)
}

export function summarizeCard(card: CreditCard, transactions: readonly Transaction[], today: ISODate): CardSummary {
  const statementDate = lastStatementDate(card.billingDay, today)
  let charges = 0
  let payments = 0
  let credits = 0
  let adjustments = 0
  let statementBalance = 0
  let paidSinceStatement = 0

  for (const t of transactions) {
    const e = effectOf(t)
    if (e.cardId !== card.id || e.card === 0) continue
    if (t.type === 'card_payment') payments += t.amount
    else if (t.type === 'adjustment') adjustments += e.card
    else if (e.card > 0) charges += e.card
    else credits += -e.card

    if (t.date <= statementDate) statementBalance += e.card
    else if (e.card < 0 && t.date <= today) paidSinceStatement += -e.card
  }

  const outstanding = charges - payments - credits + adjustments
  const dueDate = dueDateFor(statementDate, card.billingDay, card.dueDay)
  const remaining = Math.max(0, statementBalance - paidSinceStatement)
  const daysUntilDue = daysBetween(today, dueDate)
  let status: BillStatus
  if (statementBalance <= 0) status = 'no_dues'
  else if (remaining === 0) status = 'paid'
  else if (daysUntilDue < 0) status = 'overdue'
  else status = 'pending'

  return {
    card,
    charges,
    payments,
    credits,
    adjustments,
    outstanding,
    availableCredit: card.creditLimit === null ? null : card.creditLimit - outstanding,
    statement: { statementDate, dueDate, statementBalance, paidSinceStatement, remaining, status, daysUntilDue },
  }
}

export const DUE_SOON_DAYS = 7

export function isDueSoon(s: CardStatement): boolean {
  return s.status === 'overdue' || (s.status === 'pending' && s.daysUntilDue <= DUE_SOON_DAYS)
}

// ─── People and debts ────────────────────────────────────────────────────────

export type DebtDirection = 'owed_to_me' | 'i_owe'

export interface Debt {
  transaction: Transaction
  direction: DebtDirection
  original: Paise
  repaid: Paise
  remaining: Paise
}

export interface PersonSummary {
  person: Person
  /** + they owe me, − I owe them. */
  balance: Paise
  paidOnBehalf: Paise
  lent: Paise
  borrowed: Paise
  receivedBack: Paise
  returnedByMe: Paise
  adjustments: Paise
  debts: Debt[]
  /** Repayments not linked to a specific debt (still counted in the balance). */
  unlinkedToMe: Paise
  unlinkedByMe: Paise
}

/** The debt a transaction creates, if any. */
export function debtOf(t: Transaction): { direction: DebtDirection; amount: Paise } | null {
  if (!t.personId) return null
  if (t.type === 'lent') return { direction: 'owed_to_me', amount: t.amount }
  if (t.type === 'purchase' && t.recoverableAmount > 0) {
    return { direction: 'owed_to_me', amount: Math.min(t.recoverableAmount, t.amount) }
  }
  if (t.type === 'borrowed') return { direction: 'i_owe', amount: t.amount }
  return null
}

/** Which debt direction a repayment settles. */
export function repaymentDirection(t: Pick<Transaction, 'type' | 'returnDirection'>): DebtDirection | null {
  if (t.type !== 'returned') return null
  return t.returnDirection === 'by_me' ? 'i_owe' : 'owed_to_me'
}

export function summarizePerson(person: Person, transactions: readonly Transaction[]): PersonSummary {
  const s: PersonSummary = {
    person,
    balance: 0,
    paidOnBehalf: 0,
    lent: 0,
    borrowed: 0,
    receivedBack: 0,
    returnedByMe: 0,
    adjustments: 0,
    debts: [],
    unlinkedToMe: 0,
    unlinkedByMe: 0,
  }
  const mine = transactions.filter((t) => effectOf(t).personId === person.id)
  const repaidByDebt = new Map<string, Paise>()

  for (const t of mine) {
    const e = effectOf(t)
    s.balance += e.person
    switch (t.type) {
      case 'purchase':
        s.paidOnBehalf += e.person
        break
      case 'lent':
        s.lent += t.amount
        break
      case 'borrowed':
        s.borrowed += t.amount
        break
      case 'returned':
        if (t.returnDirection === 'by_me') s.returnedByMe += t.amount
        else s.receivedBack += t.amount
        if (t.linkedTransactionId) {
          repaidByDebt.set(t.linkedTransactionId, (repaidByDebt.get(t.linkedTransactionId) ?? 0) + t.amount)
        } else if (t.returnDirection === 'by_me') s.unlinkedByMe += t.amount
        else s.unlinkedToMe += t.amount
        break
      case 'adjustment':
        s.adjustments += e.person
        break
      default:
        break
    }
  }

  for (const t of mine) {
    const debt = debtOf(t)
    if (!debt) continue
    const repaid = repaidByDebt.get(t.id) ?? 0
    s.debts.push({
      transaction: t,
      direction: debt.direction,
      original: debt.amount,
      repaid,
      remaining: Math.max(0, debt.amount - repaid),
    })
  }
  s.debts.sort((a, b) => (a.transaction.date < b.transaction.date ? -1 : a.transaction.date > b.transaction.date ? 1 : 0))
  return s
}

/** Remaining amount on one debt, ignoring the repayment `excludeId` (the one being edited). */
export function remainingOnDebt(debtTxn: Transaction, transactions: readonly Transaction[], excludeId?: string): Paise {
  const debt = debtOf(debtTxn)
  if (!debt) return 0
  let repaid = 0
  for (const t of transactions) {
    if (t.id !== excludeId && t.type === 'returned' && t.linkedTransactionId === debtTxn.id) repaid += t.amount
  }
  return Math.max(0, debt.amount - repaid)
}

/** Refundable amount left on a purchase. */
export function refundableOnPurchase(purchase: Transaction, transactions: readonly Transaction[], excludeId?: string): Paise {
  let refunded = 0
  for (const t of transactions) {
    if (t.id !== excludeId && t.type === 'refund' && t.linkedTransactionId === purchase.id) refunded += t.amount
  }
  return Math.max(0, purchase.amount - refunded)
}

// ─── Overall position ────────────────────────────────────────────────────────

export interface Overview {
  totals: Totals
  /** Sum of positive person balances. */
  owedToMe: Paise
  /** Sum of negative person balances, as a positive number. */
  iOwePeople: Paise
  /** Sum of positive card balances. */
  cardOutstanding: Paise
  /** Credit balances sitting on cards (overpaid), as a positive number. */
  cardCredit: Paise
  /** owedToMe − iOwePeople − cardOutstanding + cardCredit. */
  netPosition: Paise
  cards: CardSummary[]
  people: PersonSummary[]
}

export function computeOverview(
  transactions: readonly Transaction[],
  cards: readonly CreditCard[],
  people: readonly Person[],
  today: ISODate,
): Overview {
  const cardSummaries = cards.map((c) => summarizeCard(c, transactions, today))
  const personSummaries = people.map((p) => summarizePerson(p, transactions))
  let owedToMe = 0
  let iOwePeople = 0
  for (const p of personSummaries) {
    if (p.balance > 0) owedToMe += p.balance
    else iOwePeople += -p.balance
  }
  let cardOutstanding = 0
  let cardCredit = 0
  for (const c of cardSummaries) {
    if (c.outstanding > 0) cardOutstanding += c.outstanding
    else cardCredit += -c.outstanding
  }
  return {
    totals: computeTotals(transactions),
    owedToMe,
    iOwePeople,
    cardOutstanding,
    cardCredit,
    netPosition: owedToMe - iOwePeople - cardOutstanding + cardCredit,
    cards: cardSummaries,
    people: personSummaries,
  }
}
