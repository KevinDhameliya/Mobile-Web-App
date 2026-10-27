import { useState, type SubmitEvent } from 'react'
import { Button } from '../../components/common/Button'
import { Card } from '../../components/common/Card'
import { Field, Segmented, TextInput } from '../../components/common/Field'
import { Note } from '../../components/common/StateViews'
import { OfflineBanner } from '../../components/pwa/OfflineBanner'
import { UpdatePrompt } from '../../components/pwa/UpdatePrompt'
import { useSync } from '../../hooks/useSync'

const EMAIL_RE = /^\S+@\S+\.\S+$/

/**
 * First screen of the app. Nothing else (dashboard, transactions, …) is
 * shown until the user signs in. Rendered outside the router, so it uses
 * no links.
 */
export function LoginPage() {
  const sync = useSync()
  const [method, setMethod] = useState<'password' | 'link'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [linkSent, setLinkSent] = useState(false)
  const [pasted, setPasted] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

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

  function onPasswordSignIn(e: SubmitEvent) {
    e.preventDefault()
    if (!EMAIL_RE.test(email.trim()) || password === '') {
      setMessage({ tone: 'error', text: 'Enter your email and password.' })
      return
    }
    void run(() => sync.signInWithPassword(email, password))
  }

  function onSendLink(e: SubmitEvent) {
    e.preventDefault()
    if (!EMAIL_RE.test(email.trim())) {
      setMessage({ tone: 'error', text: 'Enter a valid email address.' })
      return
    }
    void run(async () => {
      await sync.sendCode(email)
      setLinkSent(true)
    }, 'Email sent. It can take a minute to arrive — check spam too.')
  }

  function onPasteLink(e: SubmitEvent) {
    e.preventDefault()
    void run(() => sync.verifyCode(email, pasted))
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <OfflineBanner />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-safe py-10 pt-safe">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/icons/pwa-192x192.png" alt="" width={64} height={64} className="mb-3 size-16 rounded-2xl shadow-sm" />
          <h1 className="text-2xl font-bold text-fg">Money Tracker</h1>
          <p className="mt-1 text-sm text-fg-muted">Sign in to see your purchases, cards and balances.</p>
        </div>

        <Card>
          <div className="mb-4">
            <Segmented
              name="loginMethod"
              legend="Sign in with"
              value={method}
              onChange={(v) => {
                setMethod(v)
                setMessage(null)
              }}
              options={[
                { value: 'password', label: 'Password' },
                { value: 'link', label: 'Email link' },
              ]}
            />
          </div>

          {method === 'password' && (
            <form onSubmit={onPasswordSignIn} noValidate className="space-y-3">
              <Field label="Email">
                {(p) => (
                  <TextInput {...p} type="email" inputMode="email" autoComplete="username" value={email} onChange={(e) => { setEmail(e.target.value) }} />
                )}
              </Field>
              <Field label="Password">
                {(p) => (
                  <TextInput {...p} type="password" autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value) }} />
                )}
              </Field>
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </Button>
              <p className="text-xs text-fg-muted">
                No password yet, or forgot it? Choose <strong>Email link</strong>, sign in, then set a new password in Settings → Cloud sync.
              </p>
            </form>
          )}

          {method === 'link' && !linkSent && (
            <form onSubmit={onSendLink} noValidate className="space-y-3">
              <Field label="Email">
                {(p) => (
                  <TextInput {...p} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value) }} />
                )}
              </Field>
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? 'Sending…' : 'Email me a sign-in link'}
              </Button>
              <p className="text-xs text-fg-muted">Only 2 sign-in emails can be sent per hour. Password sign-in has no limit.</p>
            </form>
          )}

          {method === 'link' && linkSent && (
            <form onSubmit={onPasteLink} noValidate className="space-y-3">
              <div className="space-y-2 rounded-xl bg-surface-sunken p-3 text-sm">
                <p className="font-medium text-fg">We emailed a sign-in link to {email}.</p>
                <p className="text-fg-muted">
                  <strong className="text-fg">In a browser:</strong> tap <em>Sign in</em> in the email.
                </p>
                <p className="text-fg-muted">
                  <strong className="text-fg">In the app on your iPhone home screen:</strong> press and hold <em>Sign in</em>, choose{' '}
                  <em>Copy Link</em>, and paste it below.
                </p>
              </div>
              <Field label="Paste the sign-in link">
                {(p) => (
                  <TextInput
                    {...p}
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="https://…supabase.co/auth/v1/verify?token=…"
                    value={pasted}
                    onChange={(e) => { setPasted(e.target.value.trim()) }}
                  />
                )}
              </Field>
              <div className="flex flex-col gap-2">
                <Button type="submit" size="lg" className="w-full" disabled={busy || pasted.length < 6}>
                  {busy ? 'Checking…' : 'Sign in'}
                </Button>
                <Button variant="ghost" onClick={() => { setLinkSent(false); setPasted(''); setMessage(null) }}>
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
        </Card>

        <div className="mt-4">
          <Note>After signing in your data is downloaded to this device and works offline. You stay signed in until you sign out.</Note>
        </div>
      </main>
      <UpdatePrompt />
    </div>
  )
}
