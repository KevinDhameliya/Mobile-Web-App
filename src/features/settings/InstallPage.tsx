import { ChevronLeft } from 'lucide-react'
import { Link } from 'react-router'
import { Card } from '../../components/common/Card'
import { PageHeader } from '../../components/common/PageHeader'
import { InstallButton } from '../../components/pwa/InstallButton'
import { InstallHelp } from '../../components/pwa/InstallHelp'

export function InstallPage() {
  return (
    <>
      <Link to="/settings" className="-ml-1 mb-3 inline-flex min-h-11 items-center gap-1 rounded-lg pr-2 text-sm font-medium text-fg-muted hover:text-fg">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Settings
      </Link>
      <PageHeader
        title="Install the app"
        description="Add it to your home screen to open it full screen, like any other app."
      />
      <Card>
        <InstallHelp />
        <div className="mt-6 border-t border-border pt-5 empty:hidden">
          <InstallButton />
        </div>
      </Card>
    </>
  )
}
