import type { Paise } from './types.ts'

/** Upper bound for a single entry: ₹10 crore. Catches typos such as extra zeros. */
export const MAX_AMOUNT_PAISE: Paise = 10_00_00_000_00

const inrWithPaise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const inrWhole = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
const plainWithPaise = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })

/** ₹25,000 or ₹1,25,000.50 — Indian digit grouping, paise shown only when present. */
export function formatINR(paise: Paise): string {
  const rupees = paise / 100
  return paise % 100 === 0 ? inrWhole.format(rupees) : inrWithPaise.format(rupees)
}

/** Plain decimal rupees for CSV and form fields, e.g. "25000.00". */
export function paiseToRupeeString(paise: Paise): string {
  return plainWithPaise.format(paise / 100)
}

/** Value for an amount input: "25000" or "25000.5". */
export function paiseToInput(paise: Paise): string {
  if (paise % 100 === 0) return String(paise / 100)
  return paiseToRupeeString(paise)
}

export type ParseResult = { ok: true; value: Paise } | { ok: false; error: string }

/**
 * Parses user input such as "25000", "25,000", "₹ 1,25,000.50" into paise
 * using string arithmetic (no floating point).
 */
export function parseRupees(input: string): ParseResult {
  const cleaned = input.replace(/[₹,\s]/g, '').replace(/^Rs\.?/i, '')
  if (cleaned === '') return { ok: false, error: 'Enter an amount.' }
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) {
    return { ok: false, error: 'Enter a valid amount with up to 2 decimal places.' }
  }
  const [whole = '0', fraction = ''] = cleaned.split('.')
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(paise)) return { ok: false, error: 'That amount is too large.' }
  if (paise <= 0) return { ok: false, error: 'Amount must be more than ₹0.' }
  if (paise > MAX_AMOUNT_PAISE) return { ok: false, error: 'Amount must be ₹10 crore or less.' }
  return { ok: true, value: paise }
}

export function sumPaise(values: Iterable<Paise>): Paise {
  let total = 0
  for (const v of values) total += v
  return total
}
