import { planMerge, type BackupData } from '../domain/backup'
import { normalizeTransaction, type CardInput, type TransactionInput } from '../domain/validation'
import type { Person, Transaction } from '../domain/types'
import { db, readAll } from './db'

export function newId(): string {
  return crypto.randomUUID()
}

const nowIso = () => new Date().toISOString()

/**
 * Saves a transaction under its pre-generated id. Because the id is fixed
 * when the form opens, pressing Save twice (or a retry) overwrites the same
 * record instead of creating a duplicate.
 */
export async function saveTransaction(input: TransactionInput): Promise<Transaction> {
  const n = normalizeTransaction(input)
  return db.transaction('rw', db.transactions, async () => {
    const existing = await db.transactions.get(n.id)
    const now = nowIso()
    const record: Transaction = { ...n, createdAt: existing?.createdAt ?? now, updatedAt: now }
    await db.transactions.put(record)
    return record
  })
}

/** Entries that point at this one (repayments or refunds). */
export async function dependentsOf(id: string): Promise<Transaction[]> {
  return db.transactions.where('linkedTransactionId').equals(id).toArray()
}

/** Deletes a transaction. Linked repayments/refunds are kept but unlinked. */
export async function deleteTransaction(id: string): Promise<void> {
  await db.transaction('rw', db.transactions, async () => {
    const deps = await db.transactions.where('linkedTransactionId').equals(id).toArray()
    for (const d of deps) await db.transactions.update(d.id, { linkedTransactionId: null, updatedAt: nowIso() })
    await db.transactions.delete(id)
  })
}

export async function saveCard(input: CardInput): Promise<void> {
  await db.transaction('rw', db.cards, async () => {
    const existing = await db.cards.get(input.id)
    const now = nowIso()
    await db.cards.put({
      ...input,
      nickname: input.nickname.trim(),
      bankName: input.bankName.trim(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    })
  })
}

export async function setCardArchived(id: string, archived: boolean): Promise<void> {
  await db.cards.update(id, { archived, updatedAt: nowIso() })
}

/** Cards with transactions cannot be deleted (balances would silently change); archive them instead. */
export async function deleteCard(id: string): Promise<'deleted' | 'has-transactions'> {
  return db.transaction('rw', db.cards, db.transactions, async () => {
    const used = await db.transactions.where('cardId').equals(id).count()
    if (used > 0) return 'has-transactions'
    await db.cards.delete(id)
    return 'deleted'
  })
}

export async function savePerson(p: Pick<Person, 'id' | 'name' | 'notes'>): Promise<void> {
  await db.transaction('rw', db.people, async () => {
    const existing = await db.people.get(p.id)
    const now = nowIso()
    await db.people.put({ ...p, name: p.name.trim(), notes: p.notes.trim(), createdAt: existing?.createdAt ?? now, updatedAt: now })
  })
}

export async function deletePerson(id: string): Promise<'deleted' | 'has-transactions'> {
  return db.transaction('rw', db.people, db.transactions, async () => {
    const used = await db.transactions.where('personId').equals(id).count()
    if (used > 0) return 'has-transactions'
    await db.people.delete(id)
    return 'deleted'
  })
}

export async function mergeBackup(incoming: BackupData): Promise<{ added: number; skipped: number }> {
  return db.transaction('rw', db.cards, db.people, db.transactions, async () => {
    const plan = planMerge(await readAll(), incoming)
    await db.cards.bulkAdd(plan.add.cards)
    await db.people.bulkAdd(plan.add.people)
    await db.transactions.bulkAdd(plan.add.transactions)
    return { added: plan.add.cards.length + plan.add.people.length + plan.add.transactions.length, skipped: plan.skipped }
  })
}

/** Replaces everything in one atomic transaction: either all of it is restored or nothing changes. */
export async function replaceWithBackup(incoming: BackupData): Promise<void> {
  await db.transaction('rw', db.cards, db.people, db.transactions, async () => {
    await Promise.all([db.cards.clear(), db.people.clear(), db.transactions.clear()])
    await db.cards.bulkAdd(incoming.cards)
    await db.people.bulkAdd(incoming.people)
    await db.transactions.bulkAdd(incoming.transactions)
  })
}

export async function deleteAllData(): Promise<void> {
  await db.transaction('rw', db.cards, db.people, db.transactions, async () => {
    await Promise.all([db.cards.clear(), db.people.clear(), db.transactions.clear()])
  })
}
