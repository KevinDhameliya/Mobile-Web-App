import { CheckCircle2, Server } from 'lucide-react'
import { Card, CardHeader } from '../../components/common/Card'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StateViews'
import { useApiHealth } from '../../hooks/useApiHealth'
import { config } from '../../services/config'

/**
 * Shows the backend connection. With no VITE_API_BASE_URL configured this is
 * an honest empty state — there is no fake backend.
 */
export function ApiStatusCard() {
  const { state, retry } = useApiHealth()

  return (
    <Card aria-labelledby="api-heading">
      <CardHeader id="api-heading" icon={<Server />} title="Backend connection" description="Status of the configured API." />
      {state.status === 'idle' && (
        <EmptyState
          icon={<Server />}
          title="No API connected yet"
          message={
            <>
              Set <code className="rounded bg-surface-sunken px-1 font-mono text-xs">VITE_API_BASE_URL</code> to connect a
              backend. This app checks its health endpoint and shows the result here.
            </>
          }
        />
      )}
      {state.status === 'loading' && <LoadingState label="Checking the API…" />}
      {state.status === 'error' && (
        <ErrorState title="Couldn’t reach the API" message={state.error.message} onRetry={retry} />
      )}
      {state.status === 'success' && (
        <div className="flex items-start gap-3 rounded-xl bg-success-soft/60 p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-fg">API reachable</p>
            <p className="mt-0.5 break-all text-fg-muted">
              {config.apiBaseUrl}
              {config.apiHealthPath} · {state.data.latencyMs} ms
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}
