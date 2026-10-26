import type { ISODate } from './types.ts'

/**
 * Date helpers that work on local calendar dates (`YYYY-MM-DD`) only.
 * Time-of-day and time zones never enter the calculations, so an entry made
 * at 11:30 pm IST stays on the day the user picked.
 */

const pad = (n: number) => String(n).padStart(2, '0')

export function toISODate(year: number, month1: number, day: number): ISODate {
  return `${String(year)}-${pad(month1)}-${pad(day)}`
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISODate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const { y, m, d } = parts(value)
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m)
}

export function parts(date: ISODate): { y: number; m: number; d: number } {
  return { y: Number(date.slice(0, 4)), m: Number(date.slice(5, 7)), d: Number(date.slice(8, 10)) }
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate()
}

/** The given day in that month, clamped to the month's length (31 → 28/29/30). */
export function clampedDate(year: number, month1: number, day: number): ISODate {
  return toISODate(year, month1, Math.min(day, daysInMonth(year, month1)))
}

export function addMonths(year: number, month1: number, delta: number): { y: number; m: number } {
  const index = year * 12 + (month1 - 1) + delta
  return { y: Math.floor(index / 12), m: (index % 12) + 1 }
}

function toUTC(date: ISODate): number {
  const { y, m, d } = parts(date)
  return Date.UTC(y, m - 1, d)
}

export function addDays(date: ISODate, days: number): ISODate {
  const t = new Date(toUTC(date) + days * 86_400_000)
  return toISODate(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86_400_000)
}

export function monthKey(date: ISODate): string {
  return date.slice(0, 7)
}

/** Monday of the week containing `date`. */
export function weekStart(date: ISODate): ISODate {
  const dow = new Date(toUTC(date)).getUTCDay() // 0 = Sunday
  return addDays(date, -((dow + 6) % 7))
}

const monthFmt = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' })
const dayFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const shortDayFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })

export function formatDate(date: ISODate): string {
  return dayFmt.format(new Date(toUTC(date)))
}

export function formatShortDate(date: ISODate): string {
  return shortDayFmt.format(new Date(toUTC(date)))
}

/** "Oct 2026" from "2026-10". */
export function formatMonthKey(key: string): string {
  return monthFmt.format(new Date(toUTC(`${key}-01`)))
}
