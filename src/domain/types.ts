/**
 * Core data model.
 *
 * All money values are stored as integer paise (₹1 = 100 paise) so that sums
 * never suffer from floating-point rounding. Dates are stored as local
 * calendar dates in `YYYY-MM-DD` form, which sort and compare as strings.
 */

/** Integer number of paise. */
export type Paise = number

/** Local calendar date, `YYYY-MM-DD`. */
export type ISODate = string

export const TRANSACTION_TYPES = [
  'purchase',
  'received',
  'refund',
  'card_payment',
  'lent',
  'borrowed',
  'returned',
  'cashback',
  'fee',
  'adjustment',
] as const
export type TransactionType = (typeof TRANSACTION_TYPES)[number]

export const PAYMENT_METHODS = [
  'credit_card',
  'upi',
  'debit_card',
  'net_banking',
  'cash',
  'wallet',
  'other',
] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/**
 * For "Money Returned": who gave the money back.
 * - `to_me`: someone repaid me (reduces what they owe me).
 * - `by_me`: I repaid someone (reduces what I owe them).
 */
export type ReturnDirection = 'to_me' | 'by_me'

/** For "Adjustment": which balance is being corrected. */
export type AdjustmentTarget = 'card' | 'person'
/** `increase` raises the target balance (more owed on the card / more owed to me by the person). */
export type AdjustmentDirection = 'increase' | 'decrease'

export interface Transaction {
  id: string
  type: TransactionType
  /** Always positive. Direction comes from the type. */
  amount: Paise
  date: ISODate
  description: string
  category: string
  /**
   * How the money moved. For outflows (purchase, lent, fee, card payment,
   * returned by me) this is what I paid with; for inflows (received, refund,
   * cashback, borrowed, returned to me) it is where the money landed.
   */
  paymentMethod: PaymentMethod
  /** Card used (purchase/fee/lent paid by card), credited (refund/cashback to card) or being paid (card_payment). */
  cardId: string | null
  merchant: string
  personId: string | null
  /**
   * Purchases only: part of the purchase that someone else must pay back to
   * me (bought on their behalf). The rest is my own spending.
   */
  recoverableAmount: Paise
  /** Returned only. */
  returnDirection: ReturnDirection | null
  /** Adjustment only. */
  adjustmentTarget: AdjustmentTarget | null
  adjustmentDirection: AdjustmentDirection | null
  /**
   * Links a repayment to the debt it settles (lent / purchase-on-behalf /
   * borrowed), or a refund to the original purchase.
   */
  linkedTransactionId: string | null
  /**
   * Credit card payments only (v2.5): purchases this payment was ticked
   * against. Kept for older data; since v2.6 the paid status is the
   * `paid` flag on each purchase instead.
   */
  allocations?: Allocation[]
  /**
   * Credit card charges only: marked as paid by the user (one tap).
   * Absent on older records, which count as unpaid.
   */
  paid?: boolean
  /** When it was last marked paid (ISO time), or null. */
  paidAt?: string | null
  notes: string
  createdAt: string
  updatedAt: string
}

/** Part of a credit card payment applied to one card charge. */
export interface Allocation {
  transactionId: string
  amount: Paise
}

/** Payment status of a credit card charge ('partly_paid' only appears in v2.5 history). */
export type PayStatus = 'paid' | 'partly_paid' | 'unpaid'

/**
 * One entry in the payment-status history. Stores a snapshot of the
 * purchase's name and amount so it stays readable after later edits or
 * deletion. Entries are never changed once written.
 */
export interface HistoryEvent {
  id: string
  /** When the change happened (ISO time). */
  at: string
  transactionId: string
  description: string
  cardId: string | null
  /** What is owed on the charge (amount minus refunds to the card). */
  owed: Paise
  fromStatus: PayStatus | null
  /** `deleted` when the purchase itself was deleted. */
  toStatus: PayStatus | 'deleted'
  paidBefore: Paise
  paidAfter: Paise
  /** The card payment that caused the change, if any. */
  paymentId: string | null
  /** e.g. "Marked as paid", "Purchase added". */
  reason: string
  createdAt: string
  updatedAt: string
}

export interface CreditCard {
  id: string
  nickname: string
  bankName: string
  /** Last four digits only. Full card numbers, CVV and PINs are never stored. */
  last4: string
  creditLimit: Paise | null
  /** Day of month the statement is generated (1–31; clamped in short months). */
  billingDay: number
  /** Day of month payment is due (1–31). If ≤ billingDay it falls in the following month. */
  dueDay: number
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface Person {
  id: string
  name: string
  notes: string
  createdAt: string
  updatedAt: string
}

export const DEFAULT_CATEGORIES = [
  'Electronics & Mobiles',
  'Shopping',
  'Groceries',
  'Food & Dining',
  'Travel',
  'Fuel',
  'Bills & Utilities',
  'Health',
  'Education',
  'Entertainment',
  'Gifts',
  'Fees & Interest',
  'Credit card bill',
  'Cashback & rewards',
  'Income',
  'Personal transfer',
  'Other',
] as const
