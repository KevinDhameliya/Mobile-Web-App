import { Compass, House } from 'lucide-react'
import { ButtonLink } from '../components/common/Button'
import { PageHeader } from '../components/common/PageHeader'
import { EmptyState } from '../components/common/StateViews'

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" />
      <EmptyState
        icon={<Compass />}
        title="Nothing here"
        message="The page you’re looking for doesn’t exist or may have moved."
        action={
          <ButtonLink to="/" icon={<House />}>
            Back to dashboard
          </ButtonLink>
        }
      />
    </>
  )
}
