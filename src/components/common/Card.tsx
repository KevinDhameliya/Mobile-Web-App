import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../utils/cn'

export function Card({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn('rounded-2xl border border-border bg-surface-raised p-5 shadow-sm sm:p-6', className)}
      {...rest}
    />
  )
}

interface CardHeaderProps {
  title: string
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  /** id used to label the surrounding section via aria-labelledby. */
  id?: string
}

export function CardHeader({ title, description, icon, action, id }: CardHeaderProps) {
  return (
    <div className="mb-4 flex items-start gap-3">
      {icon && (
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-soft-fg [&_svg]:size-5" aria-hidden="true">
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h2 id={id} className="text-base font-semibold text-fg">
          {title}
        </h2>
        {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}
