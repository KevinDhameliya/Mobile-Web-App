import { Cloud, CloudOff, LogOut, RefreshCw } from 'lucide-react'
import { useState, type SubmitEvent } from 'react'
import { Button } from '../../components/common/Button'
import { Card, CardHeader } from '../../components/common/Card'
import { Field, TextInput } from '../../components/common/Field'
import { Note } from '../../components/common/StateViews'
import { useSync } from '../../hooks/useSync'

function when(iso: string | null): string {
  if (!iso) return 'not yet'
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

export function SyncSettings() {
  const sync = useSync()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

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

  function onSend(e: SubmitEvent) {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setMessage({ tone: 'error', text: 'Enter a valid email address.' })
      return
    }
    void run(async () => {
      await sync.sendCode(email)
      setSent(true)
    }, 'Email sent. It can take a minute to arrive — check spam too.')
  }

  function onVerify(e: SubmitEvent) {
    e.preventDefault()
    void run(async () => {
      await sync.verifyCode(email, code)
      setSent(false)
      setCode('')
    })
  }

  if (sync.status === 'signed-out') {
    return (
      <Card aria-labelledby="sync-heading">
        <CardHeader
          id="sync-heading"
          icon={<Cloud />}
          title="Cloud sync"
          description="Sign in with your email to keep your data safe online and the same on all your devices. No password needed."
        />
        {!sent ? (
          <form onSubmit={onSend} noValidate className="space-y-3">
            <Field label="Email">
              {(p) => (
                <TextInput {...p} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value) }} />
              )}
            </Field>
            <Button type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Email me a sign-in link'}
            </Button>
          </form>
        ) : (
          <form onSubmit={onVerify} noValidate className="space-y-3">
            <div className="space-y-2 rounded-xl bg-surface-sunken p-3 text-sm">
              <p className="font-medium text-fg">We emailed a sign-in link to {email}.</p>
              <p className="text-fg-muted">
                <strong className="text-fg">In a browser:</strong> just tap <em>Sign in</em> in the email.
              </p>
              <p className="text-fg-muted">
                <strong className="text-fg">In the app on your iPhone home screen:</strong> press and hold <em>Sign in</em> in the email,
                choose <em>Copy Link</em>, then paste it below. (Tapping it would sign in Safari instead of the app.)
              </p>
            </div>
            <Field label="Paste the sign-in link (or code)">
              {(p) => (
                <TextInput
                  {...p}
                  autoComplete="one-time-code"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="https://…supabase.co/auth/v1/verify?token=…"
                  value={code}
                  onChange={(e) => { setCode(e.target.value.trim()) }}
                />
              )}
            </Field>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" disabled={busy || code.length < 6}>
                {busy ? 'Checking…' : 'Sign in'}
              </Button>
              <Button variant="ghost" onClick={() => { setSent(false); setCode(''); setMessage(null) }}>
                Use a different email
              </Button>
            </div>
          </form>
        )}
        {message && (
          <p role="status" className={message.tone === 'ok' ? 'mt-3 text-sm text-success' : 'mt-3 text-sm font-medium text-danger'}>
            {message.text}
          </p>
        )}
        <div className="mt-3">
          <Note>Entries already on this device are uploaded when you first sign in. Nothing on this device is deleted.</Note>
        </div>
      </Card>
    )
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
      <CardHeader id="sync-heading" icon={<Cloud />} title="Cloud sync" description={`Signed in as ${sync.email ?? ''}`} />
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
        <Button variant="ghost" icon={<LogOut />} onClick={() => void run(sync.signOut, 'Signed out. Your data stays on this device.')}>
          Sign out
        </Button>
      </div>
      {message && (
        <p role="status" className={message.tone === 'ok' ? 'mt-3 text-sm text-success' : 'mt-3 text-sm font-medium text-danger'}>
          {message.text}
        </p>
      )}
    </Card>
  )
}
