import { ArrowRight, Smartphone } from 'lucide-react'
import { ButtonLink } from '../../components/common/Button'
import { Card, CardHeader } from '../../components/common/Card'
import { PageHeader } from '../../components/common/PageHeader'
import { InstallButton } from '../../components/pwa/InstallButton'
import { DataSettings } from './DataSettings'
import { ThemeSettings } from './ThemeSettings'
import { UpdateSettings } from './UpdateSettings'

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Personalise the app on this device." />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ThemeSettings />
        <Card aria-labelledby="install-settings-heading">
          <CardHeader
            id="install-settings-heading"
            icon={<Smartphone />}
            title="Installation"
            description="Install on Android, iPhone, iPad or desktop."
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <InstallButton />
            <ButtonLink to="/settings/install" variant="secondary" icon={<ArrowRight />}>
              Installation guide
            </ButtonLink>
          </div>
        </Card>
        <UpdateSettings />
        <DataSettings />
      </div>
    </>
  )
}
