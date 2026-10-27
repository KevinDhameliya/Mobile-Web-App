import { validateCardRecord, validatePersonRecord, validateTransactionRecord } from './backup.ts'
import type { CreditCard, Person, Transaction } from './types.ts'

/**
 * Cloud sync rules (pure, no I/O).
 *
 * Every card, person and transaction is stored in the cloud as one row:
 * `{ kind, id, data, deleted, updated_at }`. Conflicts are resolved per
 * record by "last change wins", using the time the change was made on the
 * device. A deletion is a row with `deleted = true` (a tombstone), so a
 * record deleted on one phone is deleted on the others too.
 */

export const RECORD_KINDS = ['transaction', 'card', 'person'] as const
export type RecordKind = (typeof RECORD_KINDS)[number]

export type RecordOf<K extends RecordKind> = K extends 'transaction' ? Transaction : K extends 'card' ? CreditCard : Person

export interface RemoteRow {
  kind: RecordKind
  id: string
  data: unknown
  deleted: boolean
  /** Time of the change on the device that made it. */
  updated_at: string
  /** Server time the row last changed (pull cursor). */
  synced_at?: string
}

export interface PushItem {
  kind: RecordKind
  id: string
  data: Transaction | CreditCard | Person | null
  deleted: boolean
  updated_at: string
}

export const pendingKey = (kind: RecordKind, id: string) => `${kind}:${id}`

/** Milliseconds since epoch for an ISO time from JS ("…Z") or Postgres ("…+00:00"). */
export function timeOf(iso: string | null | undefined): number {
  if (!iso) return -Infinity
  const t = Date.parse(iso)
  return Number.isNaN(t) ? -Infinity : t
}

export type Decision = 'apply' | 'delete' | 'keep-local' | 'skip'

/**
 * What to do with one row pulled from the cloud.
 *
 * - local: the record on this device (if any) and the time of an
 *   un-uploaded local change to it (if any).
 * - The newer change wins. On a tie the local copy is kept.
 */
export function decide(remote: Pick<RemoteRow, 'deleted' | 'updated_at'>, local: { updatedAt?: string; pendingAt?: string }): Decision {
  const hasLocal = local.updatedAt !== undefined
  const hasPending = local.pendingAt !== undefined
  const remoteTime = timeOf(remote.updated_at)
  const localTime = Math.max(timeOf(local.updatedAt), timeOf(local.pendingAt))

  if (!hasLocal && !hasPending) return remote.deleted ? 'skip' : 'apply'
  if (remoteTime > localTime) return remote.deleted ? (hasLocal ? 'delete' : 'skip') : 'apply'
  return hasPending ? 'keep-local' : 'skip'
}

/** Validates pulled data before it is written locally; bad rows are ignored. */
export function parseRemoteRecord(row: RemoteRow): Transaction | CreditCard | Person | null {
  if (row.deleted || typeof row.data !== 'object' || row.data === null) return null
  const data = row.data as { id?: unknown }
  if (data.id !== row.id) return null
  const problem =
    row.kind === 'transaction' ? validateTransactionRecord(row.data) : row.kind === 'card' ? validateCardRecord(row.data) : validatePersonRecord(row.data)
  return problem === null ? (row.data as Transaction | CreditCard | Person) : null
}

/** Builds the upload payload for one queued change. A missing record is uploaded as a deletion. */
export function toPushItem(
  kind: RecordKind,
  id: string,
  record: Transaction | CreditCard | Person | undefined,
  changedAt: string,
): PushItem {
  if (!record) return { kind, id, data: null, deleted: true, updated_at: changedAt }
  // The record's own updatedAt is the time of its last real change.
  return { kind, id, data: record, deleted: false, updated_at: record.updatedAt || changedAt }
}

/** Overlap when pulling, so rows committed slightly out of order are never missed. Re-applying is harmless. */
export const PULL_OVERLAP_MS = 30_000

export function pullSince(cursor: string | null): string {
  if (!cursor) return '1970-01-01T00:00:00Z'
  return new Date(Math.max(0, timeOf(cursor) - PULL_OVERLAP_MS)).toISOString()
}
