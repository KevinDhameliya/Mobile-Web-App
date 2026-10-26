import { AlertTriangle, Inbox, Loader2, RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './Button'

/** Loading placeholder announced politely to screen readers. */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 py-6 text-fg-muted">
      <Loader2 className="size-5 animate-spin" aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="rounded-xl border border-border bg-danger-soft/60 p-4">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-fg">{title}</p>
          <p className="mt-1 text-sm text-fg-muted">{message}</p>
          {onRetry && (
            <Button variant="secondary" className="mt-3" icon={<RotateCcw />} onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

interface EmptyStateProps {
  title: string
  message: ReactNode
  icon?: ReactNode
  action?: ReactNode
}

export function EmptyState({ title, message, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-4 py-8 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-surface-sunken text-fg-muted [&_svg]:size-6" aria-hidden="true">
        {icon ?? <Inbox />}
      </span>
      <p className="mt-3 font-semibold text-fg">{title}</p>
      <div className="mt-1 max-w-sm text-sm text-fg-muted">{message}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
