import Dexie, { type EntityTable } from 'dexie'
import type { BackupData } from '../domain/backup'
import type { CreditCard, Person, Transaction } from '../domain/types'

/**
 * IndexedDB database (via Dexie).
 *
 * Data-safety rules for future changes:
 * - Never delete or rename a table without a `.upgrade()` that copies data.
 * - Always add a NEW `this.version(n + 1)` block; never edit an existing one.
 * - Dexie upgrades run inside a transaction: if one fails, nothing changes.
 */
export class MoneyDB extends Dexie {
  transactions!: EntityTable<Transaction, 'id'>
  cards!: EntityTable<CreditCard, 'id'>
  people!: EntityTable<Person, 'id'>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      transactions: 'id, date, type, cardId, personId, linkedTransactionId',
      cards: 'id, nickname',
      people: 'id, name',
    })
  }
}

export const REAL_DB_NAME = 'money-tracker'
/** Development-only preview database; real records are never mixed with sample data. */
export const SAMPLE_DB_NAME = 'money-tracker-dev-sample'
const SAMPLE_FLAG = 'money-tracker:use-sample-db'

function useSampleDb(): boolean {
  if (!import.meta.env.DEV) return false
  try {
    return window.sessionStorage.getItem(SAMPLE_FLAG) === '1'
  } catch {
    return false
  }
}

export const isSampleMode = useSampleDb()
export const db = new MoneyDB(isSampleMode ? SAMPLE_DB_NAME : REAL_DB_NAME)

export function setSampleMode(on: boolean): void {
  if (!import.meta.env.DEV) return
  try {
    if (on) window.sessionStorage.setItem(SAMPLE_FLAG, '1')
    else window.sessionStorage.removeItem(SAMPLE_FLAG)
  } catch {
    /* ignore */
  }
  window.location.reload()
}

export async function readAll(): Promise<BackupData> {
  return db.transaction('r', db.cards, db.people, db.transactions, async () => ({
    cards: await db.cards.toArray(),
    people: await db.people.toArray(),
    transactions: await db.transactions.toArray(),
  }))
}

/** Ask the browser not to evict our data under storage pressure. */
export async function requestPersistentStorage(): Promise<boolean | null> {
  if (!('storage' in navigator) || typeof navigator.storage.persist !== 'function') return null
  try {
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return null
  }
}
