import { Settings } from 'lucide-react'
import { NavLink } from 'react-router'
import { cn } from '../../utils/cn'
import { InstallButton } from '../pwa/InstallButton'
import { BrandMark } from './BrandMark'

/** Compact header for phones (below md). Respects the notch in standalone mode. */
export function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface-raised/95 pt-safe backdrop-blur md:hidden">
      <div className="flex h-14 items-center justify-between gap-2 px-safe">
        <BrandMark />
        <div className="flex items-center gap-1">
          <InstallButton compact />
          <NavLink
            to="/settings"
            aria-label="Settings"
            className={({ isActive }) =>
              cn('grid size-11 place-items-center rounded-xl', isActive ? 'bg-brand-soft text-brand' : 'text-fg-muted hover:bg-surface-sunken')
            }
          >
            <Settings className="size-5" aria-hidden="true" />
          </NavLink>
        </div>
      </div>
    </header>
  )
}
