import type { PaymentMethod, Transaction, TransactionType } from './types.ts'

export const TYPE_LABELS: Record<TransactionType, string> = {
  purchase: 'Purchase',
  received: 'Money Received',
  refund: 'Refund',
  card_payment: 'Credit Card Payment',
  lent: 'Money Lent',
  borrowed: 'Money Borrowed',
  returned: 'Money Returned',
  cashback: 'Cashback',
  fee: 'Fee/Interest',
  adjustment: 'Adjustment',
}

export const TYPE_HINTS: Record<TransactionType, string> = {
  purchase: 'Something you bought. Counts as spending; if bought for someone, the part they owe is tracked separately.',
  received: 'Money given to you (gift, salary, other). Use “Money Returned” for repayments of a debt.',
  refund: 'Money back for a purchase. Reduces your spending (and the card balance if refunded to a card).',
  card_payment: 'Paying your credit card bill. Reduces the card balance — not counted as spending again.',
  lent: 'Money you gave someone that they must pay back. Not counted as spending.',
  borrowed: 'Money someone gave you that you must pay back. Not counted as income.',
  returned: 'Repayment of a debt — either someone paying you back, or you paying someone back.',
  cashback: 'Cashback or reward credited to you or your card. Tracked separately from income.',
  fee: 'Card fees, late fees, interest or charges. Counted as spending.',
  adjustment: 'Correct a card or person balance to match reality (e.g. bank statement). Not spending or income.',
}

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  credit_card: 'Credit card',
  upi: 'UPI',
  debit_card: 'Debit card',
  net_banking: 'Net banking',
  cash: 'Cash',
  wallet: 'Wallet',
  other: 'Other',
}

export type Tone = 'in' | 'out' | 'neutral'

/** Colour for a transaction in lists: green money in, red spending, neutral transfers/debts. */
export function toneOf(t: Pick<Transaction, 'type' | 'returnDirection'>): Tone {
  switch (t.type) {
    case 'purchase':
    case 'fee':
      return 'out'
    case 'received':
    case 'refund':
    case 'cashback':
      return 'in'
    case 'returned':
      return t.returnDirection === 'to_me' ? 'in' : 'neutral'
    default:
      return 'neutral'
  }
}
