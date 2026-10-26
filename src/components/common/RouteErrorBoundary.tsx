import { Home, RotateCcw } from 'lucide-react'
import { isRouteErrorResponse, useRouteError } from 'react-router'
import { Button } from './Button'

/**
 * Top-level error screen for unexpected render or routing errors.
 * Rendered outside the normal layout, so it uses plain links and reloads.
 */
export function RouteErrorBoundary() {
  const error = useRouteError()
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unknown error'

  if (import.meta.env.DEV) console.error(error)

  return (
    <main className="grid min-h-dvh place-items-center bg-surface px-4 py-10">
      <title>Error · Mobile Web App</title>
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface-raised p-6 text-center shadow-sm">
        <h1 className="text-xl font-bold text-fg">This screen couldn’t be displayed</h1>
        <p className="mt-2 text-fg-muted">
          An unexpected error occurred. Reloading usually fixes it. If you just installed an update, a reload loads the new version.
        </p>
        <p className="mt-3 rounded-lg bg-surface-sunken px-3 py-2 font-mono text-xs break-words text-fg-muted">{detail}</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button icon={<RotateCcw />} onClick={() => { window.location.reload() }}>
            Reload
          </Button>
          <Button variant="secondary" icon={<Home />} onClick={() => { window.location.assign('/') }}>
            Go home
          </Button>
        </div>
      </div>
    </main>
  )
}
