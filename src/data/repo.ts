import { planMerge, type BackupData } from '../domain/backup'
import { recomputeAllRefundShares, refundShares } from '../domain/finance'
import { isCardCharge, statusChanges, type ChangeContext } from '../domain/payments'
import { pendingKey, type RecordKind } from '../domain/sync'
import { normalizeTransaction, type CardInput, type TransactionInput } from '../domain/validation'
import type { Person, Transaction } from '../domain/types'
import { db, readAll } from './db'

export function newId(): string {
  return crypto.randomUUID()
}

const nowIso = () => new Date().toISOString()

/** Tables every write uses: the data plus the upload queue. */
const ALL = () => [db.cards, db.people, db.transactions, db.history, db.pending] as const

/**
 * Queues records for upload to the cloud. Called inside the same
 * transaction as the change, so a change is never saved without being
 * queued (or queued without being saved). A queued id whose record no
 * longer exists is uploaded as a deletion.
 */
async function queue(kind: RecordKind, ids: Iterable<string>): Promise<void> {
  const at = nowIso()
  const rows = [...ids].map((id) => ({ key: pendingKey(kind, id), kind, id, at }))
  if (rows.length > 0) await db.pending.bulkPut(rows)
}

/** Listeners (the sync engine) are told after every local change. */
const listeners = new Set<() => void>()
export function onLocalChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
function changed(): void {
  for (const fn of listeners) fn()
}

/**
 * Re-allocates the person's share on every refund linked to `purchaseId`.
 * Must run inside a rw transaction on db.transactions and db.pending.
 */
async function syncRefundShares(purchaseId: string | null | undefined): Promise<void> {
  if (!purchaseId) return
  const purchase = await db.transactions.get(purchaseId)
  const refunds = (await db.transactions.where('linkedTransactionId').equals(purchaseId).toArray()).filter((t) => t.type === 'refund')
  const updated = refundShares(purchase, refunds)
  if (updated.length > 0) {
    await db.transactions.bulkPut(updated.map((t) => ({ ...t, updatedAt: nowIso() })))
    await queue('transaction', updated.map((t) => t.id))
  }
}

/** Recomputes every refund share; used after a restore or a cloud pull. */
export async function syncAllRefundShares(): Promise<void> {
  const updated = recomputeAllRefundShares(await db.transactions.toArray())
  if (updated.length > 0) {
    await db.transactions.bulkPut(updated.map((t) => ({ ...t, updatedAt: nowIso() })))
    await queue('transaction', updated.map((t) => t.id))
  }
}

/**
 * Writes payment-status history for every card charge whose status changed
 * compared with `before`. Runs inside the same transaction as the change.
 */
async function recordStatusChanges(before: readonly Transaction[], ctx: Omit<ChangeContext, 'at' | 'newId'>): Promise<void> {
  const after = await db.transactions.toArray()
  const events = statusChanges(before, after, { ...ctx, at: nowIso(), newId })
  if (events.length > 0) {
    await db.history.bulkAdd(events)
    await queue('history', events.map((e) => e.id))
  }
}

/**
 * Saves a transaction under its pre-generated id. Because the id is fixed
 * when the form opens, pressing Save twice (or a retry) overwrites the same
 * record instead of creating a duplicate.
 */
export async function saveTransaction(input: TransactionInput): Promise<Transaction> {
  const n = normalizeTransaction(input)
  const result = await db.transaction('rw', db.transactions, db.history, db.pending, async () => {
    const before = await db.transactions.toArray()
    const existing = before.find((t) => t.id === n.id)
    const now = nowIso()
    const record: Transaction = { ...n, createdAt: existing?.createdAt ?? now, updatedAt: now }
    await db.transactions.put(record)
    await queue('transaction', [record.id])
    // Keep the person's share of linked refunds in step with the purchase.
    if (record.type === 'purchase') await syncRefundShares(record.id)
    if (record.type === 'refund') await syncRefundShares(record.linkedTransactionId)
    if (existing?.type === 'refund' && existing.linkedTransactionId !== record.linkedTransactionId) {
      await syncRefundShares(existing.linkedTransactionId)
    }
    await recordStatusChanges(before, { trigger: record, action: existing ? 'saved' : 'created' })
    return (await db.transactions.get(record.id)) ?? record
  })
  changed()
  return result
}

/** Entries that point at this one (repayments or refunds). */
export async function dependentsOf(id: string): Promise<Transaction[]> {
  return db.transactions.where('linkedTransactionId').equals(id).toArray()
}

/** Deletes a transaction. Linked repayments/refunds are kept but unlinked. */
export async function deleteTransaction(id: string): Promise<void> {
  await db.transaction('rw', db.transactions, db.history, db.pending, async () => {
    const before = await db.transactions.toArray()
    const target = before.find((t) => t.id === id)
    const deps = await db.transactions.where('linkedTransactionId').equals(id).toArray()
    for (const d of deps) {
      // An unlinked refund no longer belongs to anyone's debt.
      const extra = d.type === 'refund' ? { personId: null, recoverableAmount: 0 } : {}
      await db.transactions.update(d.id, { linkedTransactionId: null, ...extra, updatedAt: nowIso() })
    }
    await db.transactions.delete(id)
    await queue('transaction', [id, ...deps.map((d) => d.id)])
    if (target?.type === 'refund') await syncRefundShares(target.linkedTransactionId)
    if (target) await recordStatusChanges(before, { trigger: target, action: 'deleted' })
  })
  changed()
}

/**
 * One-tap "Mark as paid" / "Mark as unpaid" for a credit card charge. Only
 * the paid flag changes; amounts and balances are untouched. The change is
 * written to the payment history with its time.
 */
export async function setPaid(id: string, paid: boolean): Promise<void> {
  await db.transaction('rw', db.transactions, db.history, db.pending, async () => {
    const before = await db.transactions.toArray()
    const t = before.find((x) => x.id === id)
    if (!t || !isCardCharge(t) || (t.paid === true) === paid) return
    const now = nowIso()
    const updated: Transaction = { ...t, paid, paidAt: paid ? now : null, updatedAt: now }
    await db.transactions.put(updated)
    await queue('transaction', [id])
    await recordStatusChanges(before, { trigger: updated, action: 'marked' })
  })
  changed()
}

export async function saveCard(input: CardInput): Promise<void> {
  await db.transaction('rw', db.cards, db.pending, async () => {
    const existing = await db.cards.get(input.id)
    const now = nowIso()
    await db.cards.put({
      ...input,
      nickname: input.nickname.trim(),
      bankName: input.bankName.trim(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    })
    await queue('card', [input.id])
  })
  changed()
}

export async function setCardArchived(id: string, archived: boolean): Promise<void> {
  await db.transaction('rw', db.cards, db.pending, async () => {
    await db.cards.update(id, { archived, updatedAt: nowIso() })
    await queue('card', [id])
  })
  changed()
}

/** Cards with transactions cannot be deleted (balances would silently change); archive them instead. */
export async function deleteCard(id: string): Promise<'deleted' | 'has-transactions'> {
  const result = await db.transaction('rw', db.cards, db.transactions, db.pending, async () => {
    const used = await db.transactions.where('cardId').equals(id).count()
    if (used > 0) return 'has-transactions' as const
    await db.cards.delete(id)
    await queue('card', [id])
    return 'deleted' as const
  })
  changed()
  return result
}

export async function savePerson(p: Pick<Person, 'id' | 'name' | 'notes'>): Promise<void> {
  await db.transaction('rw', db.people, db.pending, async () => {
    const existing = await db.people.get(p.id)
    const now = nowIso()
    await db.people.put({ ...p, name: p.name.trim(), notes: p.notes.trim(), createdAt: existing?.createdAt ?? now, updatedAt: now })
    await queue('person', [p.id])
  })
  changed()
}

export async function deletePerson(id: string): Promise<'deleted' | 'has-transactions'> {
  const result = await db.transaction('rw', db.people, db.transactions, db.pending, async () => {
    const used = await db.transactions.where('personId').equals(id).count()
    if (used > 0) return 'has-transactions' as const
    await db.people.delete(id)
    await queue('person', [id])
    return 'deleted' as const
  })
  changed()
  return result
}

export async function mergeBackup(incoming: BackupData): Promise<{ added: number; skipped: number }> {
  const result = await db.transaction('rw', [...ALL()], async () => {
    const plan = planMerge(await readAll(), incoming)
    await db.cards.bulkAdd(plan.add.cards)
    await db.people.bulkAdd(plan.add.people)
    await db.transactions.bulkAdd(plan.add.transactions)
    await db.history.bulkAdd(plan.add.history)
    await queue('history', plan.add.history.map((h) => h.id))
    await queue('card', plan.add.cards.map((c) => c.id))
    await queue('person', plan.add.people.map((p) => p.id))
    await queue('transaction', plan.add.transactions.map((t) => t.id))
    await syncAllRefundShares()
    return { added: plan.add.cards.length + plan.add.people.length + plan.add.transactions.length, skipped: plan.skipped }
  })
  changed()
  return result
}

/**
 * Replaces everything in one atomic transaction: either all of it is
 * restored or nothing changes. Restored records are stamped as changed now,
 * so with cloud sync on they replace the cloud copy too, and records that
 * are not in the backup are deleted from the cloud.
 */
export async function replaceWithBackup(incoming: BackupData): Promise<void> {
  await db.transaction('rw', [...ALL()], async () => {
    const before = await readAll()
    const now = nowIso()
    await Promise.all([db.cards.clear(), db.people.clear(), db.transactions.clear(), db.history.clear()])
    const history = incoming.history ?? []
    await db.history.bulkAdd(history.map((h) => ({ ...h, updatedAt: now })))
    await queue('history', new Set([...before.history, ...history].map((h) => h.id)))
    await db.cards.bulkAdd(incoming.cards.map((c) => ({ ...c, updatedAt: now })))
    await db.people.bulkAdd(incoming.people.map((p) => ({ ...p, updatedAt: now })))
    await db.transactions.bulkAdd(incoming.transactions.map((t) => ({ ...t, updatedAt: now })))
    await queue('card', new Set([...before.cards, ...incoming.cards].map((c) => c.id)))
    await queue('person', new Set([...before.people, ...incoming.people].map((p) => p.id)))
    await queue('transaction', new Set([...before.transactions, ...incoming.transactions].map((t) => t.id)))
    await syncAllRefundShares()
  })
  changed()
}

/** Deletes every record on this device — and, when cloud sync is on, from the cloud as well. */
export async function deleteAllData(): Promise<void> {
  await db.transaction('rw', [...ALL()], async () => {
    const before = await readAll()
    await Promise.all([db.cards.clear(), db.people.clear(), db.transactions.clear(), db.history.clear()])
    await queue('history', before.history.map((h) => h.id))
    await queue('card', before.cards.map((c) => c.id))
    await queue('person', before.people.map((p) => p.id))
    await queue('transaction', before.transactions.map((t) => t.id))
  })
  changed()
}

/** Queues every local record for upload (first sign-in on this device). */
export async function queueEverything(): Promise<void> {
  await db.transaction('rw', [...ALL()], async () => {
    const all = await readAll()
    await queue('history', all.history.map((h) => h.id))
    await queue('card', all.cards.map((c) => c.id))
    await queue('person', all.people.map((p) => p.id))
    await queue('transaction', all.transactions.map((t) => t.id))
  })
}
