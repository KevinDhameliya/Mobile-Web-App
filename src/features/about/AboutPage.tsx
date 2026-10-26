import { Gauge, Layers, MonitorSmartphone, ShieldCheck, WifiOff, Zap } from 'lucide-react'
import { Card, CardHeader } from '../../components/common/Card'
import { PageHeader } from '../../components/common/PageHeader'
import { config } from '../../services/config'

const FEATURES = [
  { icon: MonitorSmartphone, title: 'Works everywhere', text: 'One responsive interface for phones, tablets and desktop browsers.' },
  { icon: Zap, title: 'Installable', text: 'Add it to your home screen and launch it in its own window.' },
  { icon: Gauge, title: 'Fast loading', text: 'App files are cached on your device after the first visit.' },
  { icon: WifiOff, title: 'Offline aware', text: 'Shows a clear offline screen instead of a browser error.' },
  { icon: ShieldCheck, title: 'Secure', text: 'Served over HTTPS with strict security headers.' },
  { icon: Layers, title: 'Always current', text: 'You’re told when a new version is ready — no stale screens.' },
] as const

const PLATFORMS = [
  { name: 'Android · Chrome, Edge, Samsung Internet', support: 'Install prompt or menu option; opens in its own window.' },
  { name: 'iPhone & iPad · Safari', support: 'Manual Add to Home Screen from the Share menu; no install prompt.' },
  { name: 'Desktop · Chrome, Edge', support: 'Install icon in the address bar or the in-app button.' },
  { name: 'Desktop · Safari (macOS Sonoma+)', support: 'File → Add to Dock.' },
  { name: 'Desktop · Firefox', support: 'Works as a website; installation is not supported.' },
] as const

export function AboutPage() {
  return (
    <>
      <PageHeader title="About" description="What this app does and how it behaves on different devices." />

      <section aria-labelledby="features-heading" className="mb-8">
        <h2 id="features-heading" className="mb-3 text-sm font-semibold tracking-wide text-fg-muted uppercase">
          Features
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="rounded-2xl border border-border bg-surface-raised p-4 shadow-sm">
              <Icon className="size-5 text-brand" aria-hidden="true" />
              <h3 className="mt-3 font-semibold text-fg">{title}</h3>
              <p className="mt-1 text-sm text-fg-muted">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" aria-labelledby="platforms-heading">
          <CardHeader id="platforms-heading" title="Platform support" description="Installation behaviour differs between browsers." />
          <dl className="divide-y divide-border">
            {PLATFORMS.map((p) => (
              <div key={p.name} className="py-3 first:pt-0 last:pb-0">
                <dt className="font-medium text-fg">{p.name}</dt>
                <dd className="mt-0.5 text-sm text-fg-muted">{p.support}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card aria-labelledby="build-heading">
          <CardHeader id="build-heading" title="Build information" />
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-fg-muted">Version</dt>
              <dd className="font-mono text-fg">{config.appVersion}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-fg-muted">Environment</dt>
              <dd className="font-mono text-fg">{import.meta.env.MODE}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-fg-muted">API</dt>
              <dd className="truncate font-mono text-fg">{config.apiBaseUrl ?? 'not configured'}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </>
  )
}
