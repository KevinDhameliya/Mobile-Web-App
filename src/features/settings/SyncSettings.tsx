import { Cloud, CloudOff, KeyRound, LogOut, RefreshCw, Trash } from 'lucide-react'
import { useState, type SubmitEvent } from 'react'
import { Button } from '../../components/common/Button'
import { Card, CardHeader } from '../../components/common/Card'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { Field, TextInput } from '../../components/common/Field'
import { Note } from '../../components/common/StateViews'
import { useSync } from '../../hooks/useSync'

function when(iso: string | null): string {
  if (!iso) return 'not yet'
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

/** Account and sync status. Signing in happens on the login screen shown before the app. */
export function SyncSettings() {
  const sync = useSync()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  if (!sync.configured) {
    return (
      <Card aria-labelledby="sync-heading">
        <CardHeader id="sync-heading" icon={<CloudOff />} title="Cloud sync" description="Not available in this build." />
        <p className="text-sm text-fg-muted">Data is kept on this device only. Use backups to move it.</p>
      </Card>
    )
  }

  async function run(action: () => Promise<void>, ok?: string) {
    setBusy(true)
    setMessage(null)
    try {
      await action()
      if (ok) setMessage({ tone: 'ok', text: ok })
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Something went wrong.' })
    } finally {
      setBusy(false)
    }
  }

  function onSetPassword(e: SubmitEvent) {
    e.preventDefault()
    if (newPassword.length < 8) {
      setMessage({ tone: 'error', text: 'Use at least 8 characters.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage({ tone: 'error', text: 'The two passwords don’t match.' })
      return
    }
    void run(async () => {
      await sync.setPassword(newPassword)
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordForm(false)
    }, 'Password saved. Use it with your email to sign in on your other devices.')
  }

  const statusText =
    sync.status === 'syncing'
      ? 'Syncing…'
      : sync.status === 'offline'
        ? 'Offline — changes are saved here and upload when you’re back online.'
        : sync.status === 'error'
          ? `Last sync failed: ${sync.error ?? 'unknown error'}`
          : sync.pending > 0
            ? `${String(sync.pending)} change${sync.pending === 1 ? '' : 's'} waiting to upload`
            : 'Up to date'

  return (
    <Card aria-labelledby="sync-heading">
      <CardHeader id="sync-heading" icon={<Cloud />} title="Account & cloud sync" description={`Signed in as ${sync.email ?? ''}`} />

      {sync.foreignData && (
        <div className="mb-4 space-y-3">
          <Note tone="warning">
            This device holds data from a different account, so nothing is synced to keep the two accounts separate. Sign out and sign
            in with that account, or remove its data from this device.
          </Note>
          <Button variant="danger" icon={<Trash />} onClick={() => { setConfirmClear(true) }}>
            Remove other account’s data from this device…
          </Button>
        </div>
      )}

      <dl className="space-y-1.5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-fg-muted">Status</dt>
          <dd className={sync.status === 'error' ? 'text-right font-medium text-danger' : 'text-right'}>{statusText}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-fg-muted">Last synced</dt>
          <dd>{when(sync.lastSyncAt)}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button
          variant="secondary"
          icon={<RefreshCw />}
          disabled={sync.status === 'syncing' || sync.status === 'offline'}
          onClick={() => void run(sync.syncNow)}
        >
          Sync now
        </Button>
        <Button variant="ghost" icon={<LogOut />} onClick={() => { setConfirmSignOut(true) }}>
          Sign out
        </Button>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        {!showPasswordForm ? (
          <Button variant="secondary" icon={<KeyRound />} onClick={() => { setShowPasswordForm(true); setMessage(null) }}>
            Set or change password
          </Button>
        ) : (
          <form onSubmit={onSetPassword} noValidate className="space-y-3">
            <p className="text-sm text-fg-muted">
              Sign in on other devices with {sync.email ?? 'your email'} and this password. Your records are not changed.
            </p>
            {/* Lets password managers save the new password against the right account. */}
            <input type="email" autoComplete="username" value={sync.email ?? ''} readOnly hidden />
            <Field label="New password" hint="At least 8 characters.">
              {(p) => (
                <TextInput {...p} type="password" autoComplete="new-password" value={newPassword} onChange={(e) => { setNewPassword(e.target.value) }} />
              )}
            </Field>
            <Field label="Repeat new password">
              {(p) => (
                <TextInput {...p} type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value) }} />
              )}
            </Field>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save password'}
              </Button>
              <Button variant="ghost" onClick={() => { setShowPasswordForm(false); setNewPassword(''); setConfirmPassword('') }}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>

      {message && (
        <p role="status" className={message.tone === 'ok' ? 'mt-3 text-sm text-success' : 'mt-3 text-sm font-medium text-danger'}>
          {message.text}
        </p>
      )}

      <ConfirmDialog
        open={confirmSignOut}
        title="Sign out?"
        confirmLabel="Sign out"
        onCancel={() => { setConfirmSignOut(false) }}
        onConfirm={() => {
          setConfirmSignOut(false)
          void run(sync.signOut)
        }}
      >
        <p>You’ll return to the login screen. Your data stays on this device and in the cloud, and comes back when you sign in again.</p>
        {sync.pending > 0 && (
          <p className="font-medium text-fg">
            {sync.pending} change{sync.pending === 1 ? ' hasn’t' : 's haven’t'} been uploaded yet. They stay on this device and upload
            after you sign in again — or tap Sync now first.
          </p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmClear}
        title="Remove the other account’s data from this device?"
        confirmLabel="Remove from this device"
        destructive
        busy={busy}
        onCancel={() => { setConfirmClear(false) }}
        onConfirm={() => {
          setConfirmClear(false)
          void run(sync.clearThisDevice, 'Removed from this device. Your own data is downloading now.')
        }}
      >
        <p>
          All cards, people and transactions currently stored in this browser are removed from <strong>this device only</strong>. Nothing
          is deleted from the cloud — the other account still has its data and can sign in to get it back.
        </p>
        <p>Changes that account made here but never uploaded would be lost. Download a backup first if you’re unsure.</p>
      </ConfirmDialog>
    </Card>
  )
}
