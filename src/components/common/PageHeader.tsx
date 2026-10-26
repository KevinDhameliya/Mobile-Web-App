import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: ReactNode
  /** Rendered into <title>; defaults to `title`. */
  documentTitle?: string
  action?: ReactNode
}

export function PageHeader({ title, description, documentTitle, action }: PageHeaderProps) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      {/* React 19 hoists <title> into <head>. */}
      <title>{`${documentTitle ?? title} · Money Tracker`}</title>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-prose text-sm text-fg-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}
