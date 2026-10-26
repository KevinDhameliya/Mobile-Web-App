import type { ReactNode } from 'react'
import { StatusBadge } from '../../components/common/StatusBadge'

interface StatusTileProps {
  label: string
  icon: ReactNode
  value: string
  tone: 'neutral' | 'success' | 'warning' | 'danger' | 'brand'
  hint: string
}

export function StatusTile({ label, icon, value, tone, hint }: StatusTileProps) {
  return (
    <li className="flex flex-col rounded-2xl border border-border bg-surface-raised p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-fg-muted [&_svg]:size-4">
        <span aria-hidden="true">{icon}</span>
        {label}
      </div>
      <div className="mt-3">
        <StatusBadge tone={tone}>{value}</StatusBadge>
      </div>
      <p className="mt-2 text-xs text-fg-muted">{hint}</p>
    </li>
  )
}
