import { NavLink } from 'react-router'
import { cn } from '../../utils/cn'
import { NAV_ITEMS } from './navigation'

/** Thumb-reachable tab bar for phones and small tablets (below md). */
export function BottomNav() {
  const items = NAV_ITEMS.filter((i) => i.mobile)
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface-raised/95 pb-safe backdrop-blur md:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {items.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  isActive ? 'text-brand' : 'text-fg-muted hover:text-fg',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn('grid h-8 w-12 place-items-center rounded-full transition-colors', isActive && 'bg-brand-soft')}>
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  {label === 'Transactions' ? 'Activity' : label === 'Dashboard' ? 'Home' : label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
