import { Link } from 'react-router'
import { isSampleMode } from '../../data/db'

export function BrandMark() {
  return (
    <Link to="/" className="flex min-h-11 items-center gap-2.5 rounded-lg font-bold text-fg">
      <img src="/icons/pwa-64x64.png" alt="" width={32} height={32} className="size-8 rounded-lg" />
      <span>Money Tracker</span>
      {isSampleMode && <span className="rounded bg-warning-soft px-1.5 py-0.5 text-xs font-semibold text-warning">SAMPLE</span>}
    </Link>
  )
}
