import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { decide, parseRemoteRecord, pullSince, toPushItem, type RemoteRow } from './sync.ts'
import type { Transaction } from './types.ts'

const T1 = '2026-10-27T10:00:00.000Z'
const T2 = '2026-10-27T11:00:00.000Z'
/** Postgres returns timestamps as "+00:00", not "Z". */
const T2pg = '2026-10-27T11:00:00+00:00'

const txn: Transaction = {
  id: 'a',
  type: 'purchase',
  amount: 50000,
  date: '2026-10-27',
  description: 'Shoes',
  category: 'Shopping',
  paymentMethod: 'upi',
  cardId: null,
  merchant: '',
  personId: null,
  recoverableAmount: 0,
  returnDirection: null,
  adjustmentTarget: null,
  adjustmentDirection: null,
  linkedTransactionId: null,
  notes: '',
  createdAt: T1,
  updatedAt: T1,
}

describe('sync conflict rules (last change wins)', () => {
  it('applies a new record from the cloud', () => {
    assert.equal(decide({ deleted: false, updated_at: T1 }, {}), 'apply')
  })

  it('ignores a cloud deletion of something this device never had', () => {
    assert.equal(decide({ deleted: true, updated_at: T1 }, {}), 'skip')
  })

  it('a newer cloud edit replaces the local copy, whatever the timestamp format', () => {
    assert.equal(decide({ deleted: false, updated_at: T2pg }, { updatedAt: T1 }), 'apply')
  })

  it('a newer cloud deletion deletes the local copy', () => {
    assert.equal(decide({ deleted: true, updated_at: T2 }, { updatedAt: T1 }), 'delete')
  })

  it('keeps a newer local edit that is waiting to upload', () => {
    assert.equal(decide({ deleted: false, updated_at: T1 }, { updatedAt: T2, pendingAt: T2 }), 'keep-local')
  })

  it('keeps a newer local deletion that is waiting to upload', () => {
    assert.equal(decide({ deleted: false, updated_at: T1 }, { pendingAt: T2 }), 'keep-local')
  })

  it('does nothing when the cloud copy is the one already here', () => {
    assert.equal(decide({ deleted: false, updated_at: T2pg }, { updatedAt: T2 }), 'skip')
  })
})

describe('sync payloads', () => {
  it('uploads a missing record as a deletion at the time it was deleted', () => {
    const item = toPushItem('transaction', 'gone', undefined, T2)
    assert.deepEqual(item, { kind: 'transaction', id: 'gone', data: null, deleted: true, updated_at: T2 })
  })

  it('uploads an existing record with its own change time', () => {
    const item = toPushItem('transaction', 'a', txn, T2)
    assert.equal(item.updated_at, T1)
    assert.equal(item.deleted, false)
  })

  it('rejects malformed or mismatched rows from the cloud', () => {
    const ok: RemoteRow = { kind: 'transaction', id: 'a', data: txn, deleted: false, updated_at: T1 }
    assert.notEqual(parseRemoteRecord(ok), null)
    assert.equal(parseRemoteRecord({ ...ok, id: 'other' }), null)
    assert.equal(parseRemoteRecord({ ...ok, data: { ...txn, amount: -1 } }), null)
    assert.equal(parseRemoteRecord({ ...ok, kind: 'card' }), null)
  })

  it('pulls with an overlap so late-committed rows are not missed', () => {
    assert.equal(pullSince(null), '1970-01-01T00:00:00Z')
    assert.equal(pullSince('2026-10-27T11:00:30.000Z'), '2026-10-27T11:00:00.000Z')
  })
})

describe('pasted sign-in links', () => {
  it('reads the token and type from a Supabase sign-in link', async () => {
    const { parseSignInLink } = await import('./signInLink.ts')
    const link = 'https://abc.supabase.co/auth/v1/verify?token=pkce_123abc&type=magiclink&redirect_to=https://mobilewebapplication.netlify.app/settings'
    assert.deepEqual(parseSignInLink(link), { tokenHash: 'pkce_123abc', type: 'magiclink' })
    assert.deepEqual(parseSignInLink(link.replace('magiclink', 'signup')), { tokenHash: 'pkce_123abc', type: 'signup' })
  })

  it('treats anything that is not a link as a code', async () => {
    const { parseSignInLink } = await import('./signInLink.ts')
    assert.equal(parseSignInLink('123456'), null)
    assert.equal(parseSignInLink('https://example.com/no-token'), null)
  })
})
