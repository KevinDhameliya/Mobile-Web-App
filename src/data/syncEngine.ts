import { decide, parseRemoteRecord, pendingKey, pullSince, timeOf, toPushItem, type PushItem, type RecordKind, type RemoteRow } from '../domain/sync'
import type { CreditCard, Person, Transaction } from '../domain/types'
import { cloud } from './cloud'
import { db, isSampleMode } from './db'
import { queueEverything, syncAllRefundShares } from './repo'

/**
 * Two-way sync between this device (IndexedDB) and the cloud (Supabase).
 *
 *  1. Push: upload every queued local change (inserts, edits, deletions).
 *     The server keeps whichever version was changed last and returns any
 *     row where its own copy is newer, which is then applied here.
 *  2. Pull: download rows that changed on the server since the last sync
 *     and apply them unless this device has a newer change.
 *
 * Local data is never cleared by syncing; it is the app's offline copy.
 */

const PUSH_BATCH = 400
const PULL_PAGE = 1000

interface SyncMeta {
  cursor: string | null
  lastSyncAt: string | null
}

const metaKey = (userId: string) => `sync:${userId}`

async function readMeta(userId: string): Promise<SyncMeta | null> {
  const row = await db.meta.get(metaKey(userId))
  return (row?.value as SyncMeta | undefined) ?? null
}

async function writeMeta(userId: string, meta: SyncMeta): Promise<void> {
  await db.meta.put({ key: metaKey(userId), value: meta })
}

function tableFor(kind: RecordKind) {
  return kind === 'transaction' ? db.transactions : kind === 'card' ? db.cards : db.people
}

/** Applies cloud rows locally, respecting newer un-uploaded local changes. Returns how many records changed. */
async function applyRemote(rows: readonly RemoteRow[]): Promise<number> {
  if (rows.length === 0) return 0
  let applied = 0
  await db.transaction('rw', db.cards, db.people, db.transactions, db.pending, async () => {
    for (const row of rows) {
      const table = tableFor(row.kind)
      const local = await table.get(row.id)
      const pending = await db.pending.get(pendingKey(row.kind, row.id))
      const decision = decide(row, { updatedAt: local?.updatedAt, pendingAt: pending?.at })
      if (decision === 'apply') {
        const record = parseRemoteRecord(row)
        if (!record) continue
        if (row.kind === 'transaction') await db.transactions.put(record as Transaction)
        else if (row.kind === 'card') await db.cards.put(record as CreditCard)
        else await db.people.put(record as Person)
        await db.pending.delete(pendingKey(row.kind, row.id))
        applied += 1
      } else if (decision === 'delete') {
        await table.delete(row.id)
        await db.pending.delete(pendingKey(row.kind, row.id))
        applied += 1
      }
    }
    // Derived values (refund shares) are recalculated after remote changes.
    if (applied > 0) await syncAllRefundShares()
  })
  return applied
}

async function push(): Promise<{ uploaded: number; applied: number }> {
  const supabase = cloud()
  if (!supabase) return { uploaded: 0, applied: 0 }
  let uploaded = 0
  let applied = 0
  for (;;) {
    const batch = await db.pending.limit(PUSH_BATCH).toArray()
    if (batch.length === 0) break
    const items: PushItem[] = []
    for (const p of batch) {
      const record = await tableFor(p.kind).get(p.id)
      items.push(toPushItem(p.kind, p.id, record, p.at))
    }
    const res = await supabase.rpc('push_records', { items })
    if (res.error) throw new Error(res.error.message)
    const newerOnServer = (res.data ?? []) as RemoteRow[]
    // Remove only queue entries that were not changed again while uploading.
    await db.transaction('rw', db.pending, async () => {
      for (const p of batch) {
        const current = await db.pending.get(p.key)
        if (current?.at === p.at) await db.pending.delete(p.key)
      }
    })
    uploaded += batch.length
    applied += await applyRemote(newerOnServer)
    if (batch.length < PUSH_BATCH) break
  }
  return { uploaded, applied }
}

async function pull(userId: string, meta: SyncMeta): Promise<{ applied: number; cursor: string | null }> {
  const supabase = cloud()
  if (!supabase) return { applied: 0, cursor: meta.cursor }
  const since = pullSince(meta.cursor)
  let cursor = meta.cursor
  let applied = 0
  for (let from = 0; ; from += PULL_PAGE) {
    const { data, error } = await supabase
      .from('records')
      .select('kind,id,data,deleted,updated_at,synced_at')
      .eq('user_id', userId)
      .gt('synced_at', since)
      .order('synced_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PULL_PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = data as RemoteRow[]
    applied += await applyRemote(rows)
    for (const r of rows) if (r.synced_at && timeOf(r.synced_at) > timeOf(cursor)) cursor = r.synced_at
    if (rows.length < PULL_PAGE) break
  }
  return { applied, cursor }
}

// ─── Device owner ────────────────────────────────────────────────────────────
// The records on a device belong to the first account that syncs them. If a
// different account signs in on that device, its data must never be mixed
// with (or uploaded into) the other account, so sync stops until the device
// is cleared or the owner signs back in.

const OWNER_KEY = 'device-owner'

interface DeviceOwner {
  userId: string
  email: string | null
}

export class ForeignDataError extends Error {
  readonly ownerEmail: string | null
  constructor(ownerEmail: string | null) {
    super(
      `This device holds data from another account${ownerEmail ? ` (${ownerEmail})` : ''}. ` +
        'Sign in with that account, or remove its data from this device in Settings.',
    )
    this.name = 'ForeignDataError'
    this.ownerEmail = ownerEmail
  }
}

async function hasLocalData(): Promise<boolean> {
  const counts = await Promise.all([db.transactions.count(), db.cards.count(), db.people.count(), db.pending.count()])
  return counts.some((n) => n > 0)
}

/** Confirms the device's data belongs to `userId`, claiming it when it has no owner yet. */
async function ensureOwner(userId: string, email: string | null): Promise<void> {
  const stored = (await db.meta.get(OWNER_KEY))?.value as DeviceOwner | undefined
  let owner = stored
  if (!owner) {
    // Devices that synced before owners were recorded: the account that synced is the owner.
    const synced = (await db.meta.where('key').startsWith('sync:').primaryKeys()).map((k) => k.slice('sync:'.length))
    const other = synced.find((id) => id !== userId)
    if (other && !synced.includes(userId)) owner = { userId: other, email: null }
  }
  if (owner && owner.userId !== userId) {
    // An empty device can simply change hands.
    if (await hasLocalData()) throw new ForeignDataError(owner.email)
    await db.meta.clear()
  }
  if (stored?.userId !== userId || stored.email !== email) await db.meta.put({ key: OWNER_KEY, value: { userId, email } })
}

/**
 * Removes every record, queued change and sync bookmark from THIS device
 * only. Nothing is uploaded or deleted in the cloud.
 */
export async function clearThisDevice(): Promise<void> {
  await db.transaction('rw', [db.cards, db.people, db.transactions, db.pending, db.meta], async () => {
    await Promise.all([db.cards.clear(), db.people.clear(), db.transactions.clear(), db.pending.clear(), db.meta.clear()])
  })
}

export interface SyncResult {
  uploaded: number
  downloaded: number
  at: string
}

let running: Promise<SyncResult> | null = null

/** Runs one full sync. Concurrent calls share the same run. */
export function syncNow(userId: string, email: string | null = null): Promise<SyncResult> {
  if (isSampleMode) return Promise.reject(new Error('Sync is off while previewing sample data.'))
  running ??= (async () => {
    try {
      await ensureOwner(userId, email)
      let meta = await readMeta(userId)
      if (!meta) {
        // First sync for this account on this device: upload everything
        // already here, then download everything from the cloud.
        await queueEverything()
        meta = { cursor: null, lastSyncAt: null }
      }
      const pushed = await push()
      const pulled = await pull(userId, meta)
      const at = new Date().toISOString()
      await writeMeta(userId, { cursor: pulled.cursor, lastSyncAt: at })
      return { uploaded: pushed.uploaded, downloaded: pushed.applied + pulled.applied, at }
    } finally {
      running = null
    }
  })()
  return running
}

export async function lastSyncAt(userId: string): Promise<string | null> {
  return (await readMeta(userId))?.lastSyncAt ?? null
}

export async function pendingCount(): Promise<number> {
  return db.pending.count()
}
