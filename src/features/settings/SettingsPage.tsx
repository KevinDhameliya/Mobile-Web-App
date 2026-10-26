import { ArrowRight, Smartphone } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { ButtonLink } from '../../components/common/Button'
import { Card, CardHeader } from '../../components/common/Card'
import { PageHeader } from '../../components/common/PageHeader'
import { InstallButton } from '../../components/pwa/InstallButton'
import { readStorage } from '../../utils/storage'
import { BackupSettings, LAST_BACKUP_KEY } from './BackupSettings'
import { DataSettings } from './DataSettings'
import { ThemeSettings } from './ThemeSettings'
import { UpdateSettings } from './UpdateSettings'

// Development-only; this import is removed from production builds.
const DevSampleSettings = import.meta.env.DEV ? lazy(() => import('./DevSampleSettings')) : null

export function SettingsPage() {
  const [lastBackup, setLastBackup] = useState(() => readStorage(LAST_BACKUP_KEY))
  return (
    <>
      <PageHeader title="Settings" description="Backups, appearance and app updates." />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <BackupSettings lastBackup={lastBackup} onBackedUp={() => { setLastBackup(readStorage(LAST_BACKUP_KEY)) }} />
        <DataSettings />
        <ThemeSettings />
        <Card aria-labelledby="install-settings-heading">
          <CardHeader id="install-settings-heading" icon={<Smartphone />} title="Install" description="Add Money Tracker to your home screen." />
          <div className="flex flex-col gap-2 sm:flex-row">
            <InstallButton />
            <ButtonLink to="/settings/install" variant="secondary" icon={<ArrowRight />}>
              Installation guide
            </ButtonLink>
          </div>
        </Card>
        <UpdateSettings />
        {DevSampleSettings && (
          <Suspense fallback={null}>
            <DevSampleSettings />
          </Suspense>
        )}
      </div>
    </>
  )
}
