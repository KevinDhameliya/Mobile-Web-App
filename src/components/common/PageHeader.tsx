import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: ReactNode
  /** Rendered into <title>; defaults to `title`. */
  documentTitle?: string
}

export function PageHeader({ title, description, documentTitle }: PageHeaderProps) {
  return (
    <header className="mb-6">
      {/* React 19 hoists <title> into <head>. */}
      <title>{`${documentTitle ?? title} · Mobile Web App`}</title>
      <h1 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">{title}</h1>
      {description && <p className="mt-2 max-w-prose text-fg-muted">{description}</p>}
    </header>
  )
}
