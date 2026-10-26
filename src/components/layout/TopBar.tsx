import { InstallButton } from '../pwa/InstallButton'
import { BrandMark } from './BrandMark'

/** Compact header for phones (below md). Respects the notch in standalone mode. */
export function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface-raised/95 pt-safe backdrop-blur md:hidden">
      <div className="flex h-14 items-center justify-between gap-3 px-safe">
        <BrandMark />
        <InstallButton compact />
      </div>
    </header>
  )
}
