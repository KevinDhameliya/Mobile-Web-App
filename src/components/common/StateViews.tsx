import { Inbox, LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'

/** Loading placeholder announced politely to screen readers. */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 py-6 text-fg-muted">
      <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
      <span className="text-sm">{label}</span>
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

/** Small explanatory note, e.g. "balances are estimates". */
export function Note({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'warning' }) {
  return (
    <p
      className={
        tone === 'warning'
          ? 'rounded-xl border border-border bg-warning-soft px-3 py-2 text-sm text-fg'
          : 'rounded-xl bg-surface-sunken px-3 py-2 text-sm text-fg-muted'
      }
    >
      {children}
    </p>
  )
}
