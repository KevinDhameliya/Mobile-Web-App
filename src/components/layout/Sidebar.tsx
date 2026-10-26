import { Plus } from 'lucide-react'
import { NavLink } from 'react-router'
import { cn } from '../../utils/cn'
import { ButtonLink } from '../common/Button'
import { InstallButton } from '../pwa/InstallButton'
import { BrandMark } from './BrandMark'
import { NAV_ITEMS } from './navigation'

/** Desktop / tablet-landscape navigation (md and up). */
export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface-raised px-4 py-5 md:flex">
      <BrandMark />
      <ButtonLink to="/transactions/new" icon={<Plus />} className="mt-6" fullWidth>
        Add transaction
      </ButtonLink>
      <nav aria-label="Main" className="mt-6 flex-1">
        <ul className="space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
                    isActive ? 'bg-brand-soft text-brand-soft-fg' : 'text-fg-muted hover:bg-surface-sunken hover:text-fg',
                  )
                }
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <InstallButton fullWidth />
    </aside>
  )
}
