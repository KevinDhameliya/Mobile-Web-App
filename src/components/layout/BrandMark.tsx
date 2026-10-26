import { Link } from 'react-router'

export function BrandMark() {
  return (
    <Link to="/" className="flex min-h-11 items-center gap-2.5 rounded-lg font-bold text-fg">
      <img src="/icons/pwa-64x64.png" alt="" width={32} height={32} className="size-8 rounded-lg" />
      <span>Mobile Web App</span>
    </Link>
  )
}
