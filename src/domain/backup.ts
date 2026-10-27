import { isValidISODate } from './dates.ts'
import { MAX_AMOUNT_PAISE } from './money.ts'
import {
  PAYMENT_METHODS,
  TRANSACTION_TYPES,
  type CreditCard,
  type Person,
  type Transaction,
} from './types.ts'

export const BACKUP_APP_ID = 'personal-money-tracker'
export const BACKUP_FORMAT_VERSION = 1

export interface BackupData {
  cards: CreditCard[]
  people: Person[]
  transactions: Transaction[]
}

export interface BackupFile {
  app: typeof BACKUP_APP_ID
  formatVersion: number
  exportedAt: string
  data: BackupData
}

export function createBackup(data: BackupData, now: Date = new Date()): BackupFile {
  return { app: BACKUP_APP_ID, formatVersion: BACKUP_FORMAT_VERSION, exportedAt: now.toISOString(), data }
}

export type ParseBackupResult = { ok: true; backup: BackupFile } | { ok: false; error: string }

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): v is string => typeof v === 'string'
const strOrNull = (v: unknown) => v === null || typeof v === 'string'
const int = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v)

/** Returns a problem description, or null when the record is valid. */
export function validateTransactionRecord(v: unknown): string | null {
  if (!isObj(v)) return 'not an object'
  if (!str(v.id) || v.id === '') return 'missing id'
  if (!str(v.type) || !(TRANSACTION_TYPES as readonly string[]).includes(v.type)) return 'unknown type'
  if (!int(v.amount) || v.amount <= 0 || v.amount > MAX_AMOUNT_PAISE) return 'invalid amount'
  if (!str(v.date) || !isValidISODate(v.date)) return 'invalid date'
  if (!str(v.paymentMethod) || !(PAYMENT_METHODS as readonly string[]).includes(v.paymentMethod)) return 'invalid payment method'
  for (const k of ['description', 'category', 'merchant', 'notes', 'createdAt', 'updatedAt'] as const) {
    if (!str(v[k])) return `invalid ${k}`
  }
  for (const k of ['cardId', 'personId', 'returnDirection', 'adjustmentTarget', 'adjustmentDirection', 'linkedTransactionId'] as const) {
    if (!strOrNull(v[k])) return `invalid ${k}`
  }
  if (!int(v.recoverableAmount) || v.recoverableAmount < 0) return 'invalid recoverableAmount'
  return null
}

/** Returns a problem description, or null when the record is valid. */
export function validateCardRecord(v: unknown): string | null {
  if (!isObj(v)) return 'not an object'
  if (!str(v.id) || !str(v.nickname) || !str(v.bankName)) return 'missing name'
  if (!str(v.last4) || !/^\d{4}$/.test(v.last4)) return 'last4 must be 4 digits'
  if (!(v.creditLimit === null || int(v.creditLimit))) return 'invalid credit limit'
  if (!int(v.billingDay) || v.billingDay < 1 || v.billingDay > 31) return 'invalid billing day'
  if (!int(v.dueDay) || v.dueDay < 1 || v.dueDay > 31) return 'invalid due day'
  if (typeof v.archived !== 'boolean' || !str(v.createdAt) || !str(v.updatedAt)) return 'invalid fields'
  return null
}

/** Returns a problem description, or null when the record is valid. */
export function validatePersonRecord(v: unknown): string | null {
  if (!isObj(v)) return 'not an object'
  if (!str(v.id) || !str(v.name) || !str(v.notes) || !str(v.createdAt) || !str(v.updatedAt)) return 'invalid fields'
  return null
}

/**
 * Validates a backup file completely before anything is written, so a bad or
 * foreign file can never partially overwrite data.
 */
export function parseBackup(text: string): ParseBackupResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' }
  }
  if (!isObj(raw) || raw.app !== BACKUP_APP_ID) return { ok: false, error: 'This is not a Money Tracker backup file.' }
  if (!int(raw.formatVersion) || raw.formatVersion > BACKUP_FORMAT_VERSION) {
    return { ok: false, error: 'This backup was made by a newer version of the app. Update the app first.' }
  }
  const data = raw.data
  if (!isObj(data) || !Array.isArray(data.cards) || !Array.isArray(data.people) || !Array.isArray(data.transactions)) {
    return { ok: false, error: 'The backup file is incomplete.' }
  }
  const groups: [string, unknown[], (v: unknown) => string | null][] = [
    ['card', data.cards, validateCardRecord],
    ['person', data.people, validatePersonRecord],
    ['transaction', data.transactions, validateTransactionRecord],
  ]
  for (const [label, list, check] of groups) {
    const ids = new Set<string>()
    for (let i = 0; i < list.length; i++) {
      const problem = check(list[i])
      if (problem) return { ok: false, error: `The ${label} at position ${String(i + 1)} is invalid (${problem}).` }
      const id = (list[i] as Obj).id as string
      if (ids.has(id)) return { ok: false, error: `The backup contains the same ${label} twice.` }
      ids.add(id)
    }
  }
  return {
    ok: true,
    backup: {
      app: BACKUP_APP_ID,
      formatVersion: raw.formatVersion,
      exportedAt: str(raw.exportedAt) ? raw.exportedAt : '',
      data: data as unknown as BackupData,
    },
  }
}

export interface MergePlan {
  add: BackupData
  /** Records whose id already exists here; they are kept as they are. */
  skipped: number
}

/** Merge = add only records that don't exist yet (by id). Existing data is never overwritten. */
export function planMerge(current: BackupData, incoming: BackupData): MergePlan {
  const cardIds = new Set(current.cards.map((c) => c.id))
  const personIds = new Set(current.people.map((p) => p.id))
  const txnIds = new Set(current.transactions.map((t) => t.id))
  const add: BackupData = {
    cards: incoming.cards.filter((c) => !cardIds.has(c.id)),
    people: incoming.people.filter((p) => !personIds.has(p.id)),
    transactions: incoming.transactions.filter((t) => !txnIds.has(t.id)),
  }
  const total = incoming.cards.length + incoming.people.length + incoming.transactions.length
  const added = add.cards.length + add.people.length + add.transactions.length
  return { add, skipped: total - added }
}
