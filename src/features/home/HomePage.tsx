import { ArrowRight, Info, Smartphone } from 'lucide-react'
import { Link } from 'react-router'
import { ButtonLink } from '../../components/common/Button'
import { Card, CardHeader } from '../../components/common/Card'
import { PageHeader } from '../../components/common/PageHeader'
import { InstallButton } from '../../components/pwa/InstallButton'
import { useInstallPrompt } from '../../hooks/useInstallPrompt'
import { ApiStatusCard } from './ApiStatusCard'
import { DeviceStatus } from './DeviceStatus'

export function HomePage() {
  const { isInstalled } = useInstallPrompt()

  return (
    <>
      <PageHeader
        title="Welcome"
        documentTitle="Home"
        description="A fast, installable web app that works on phones, tablets and desktops from a single link."
      />

      <DeviceStatus />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {!isInstalled && (
          <Card aria-labelledby="install-heading">
            <CardHeader
              id="install-heading"
              icon={<Smartphone />}
              title="Add to your home screen"
              description="Launch it like a native app, full screen and one tap away."
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <InstallButton />
              <ButtonLink to="/settings/install" variant="secondary" icon={<ArrowRight />}>
                Installation guide
              </ButtonLink>
            </div>
          </Card>
        )}

        <ApiStatusCard />

        <Card aria-labelledby="next-heading">
          <CardHeader id="next-heading" icon={<Info />} title="Explore" description="Learn more and adjust the app to your liking." />
          <ul className="divide-y divide-border">
            {[
              { to: '/about', label: 'About this app', hint: 'Features and platform support' },
              { to: '/settings', label: 'Settings', hint: 'Theme, updates and stored data' },
            ].map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="flex min-h-14 items-center justify-between gap-3 rounded-lg py-2 hover:text-brand">
                  <span>
                    <span className="block font-medium">{item.label}</span>
                    <span className="block text-sm text-fg-muted">{item.hint}</span>
                  </span>
                  <ArrowRight className="size-5 shrink-0 text-fg-muted" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}
