import Dexie, { type EntityTable } from 'dexie'
import type { BackupData } from '../domain/backup'
import type { RecordKind } from '../domain/sync'
import { recomputeAllRefundShares } from '../domain/finance'
import type { CreditCard, Person, Transaction } from '../domain/types'

/**
 * IndexedDB database (via Dexie).
 *
 * Data-safety rules for future changes:
 * - Never delete or rename a table without a `.upgrade()` that copies data.
 * - Always add a NEW `this.version(n + 1)` block; never edit an existing one.
 * - Dexie upgrades run inside a transaction: if one fails, nothing changes.
 */
/** A local change waiting to be uploaded to the cloud (one row per record). */
export interface PendingChange {
  /** `${kind}:${id}` */
  key: string
  kind: RecordKind
  id: string
  /** When the change was made (used as the time of a deletion). */
  at: string
}

/** Small key/value store for sync bookkeeping. */
export interface MetaEntry {
  key: string
  value: unknown
}

export class MoneyDB extends Dexie {
  transactions!: EntityTable<Transaction, 'id'>
  cards!: EntityTable<CreditCard, 'id'>
  people!: EntityTable<Person, 'id'>
  pending!: EntityTable<PendingChange, 'key'>
  meta!: EntityTable<MetaEntry, 'key'>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      transactions: 'id, date, type, cardId, personId, linkedTransactionId',
      cards: 'id, nickname',
      people: 'id, name',
    })
    // v2: refunds of a purchase made for someone now carry that person's share
    // (personId + recoverableAmount). Same tables and indexes; existing
    // refunds are recalculated once. No other record is touched.
    this.version(2)
      .stores({
        transactions: 'id, date, type, cardId, personId, linkedTransactionId',
        cards: 'id, nickname',
        people: 'id, name',
      })
      .upgrade(async (tx) => {
        const table = tx.table<Transaction, string>('transactions')
        const changed = recomputeAllRefundShares(await table.toArray())
        if (changed.length > 0) await table.bulkPut(changed)
      })
    // v3: cloud sync. `pending` queues local changes for upload, `meta` keeps
    // the sync position. Existing tables are unchanged.
    this.version(3).stores({
      transactions: 'id, date, type, cardId, personId, linkedTransactionId',
      cards: 'id, nickname',
      people: 'id, name',
      pending: '&key, kind',
      meta: '&key',
    })
  }
}

export const REAL_DB_NAME = 'money-tracker'
/** Development-only preview database; real records are never mixed with sample data. */
export const SAMPLE_DB_NAME = 'money-tracker-dev-sample'
const SAMPLE_FLAG = 'money-tracker:use-sample-db'

function sampleDbSelected(): boolean {
  if (!import.meta.env.DEV) return false
  try {
    return window.sessionStorage.getItem(SAMPLE_FLAG) === '1'
  } catch {
    return false
  }
}

export const isSampleMode = sampleDbSelected()
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
