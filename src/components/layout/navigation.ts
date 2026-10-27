import { ChartColumn, CreditCard, History, LayoutDashboard, ListOrdered, Settings, Users, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Match only the exact path (needed for "/"). */
  end?: boolean
  /** Shown in the phone bottom bar (Settings lives in the top bar there). */
  mobile: boolean
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, mobile: true },
  { to: '/transactions', label: 'Transactions', icon: ListOrdered, mobile: true },
  { to: '/cards', label: 'Cards', icon: CreditCard, mobile: true },
  { to: '/people', label: 'People', icon: Users, mobile: true },
  { to: '/reports', label: 'Reports', icon: ChartColumn, mobile: true },
  { to: '/history', label: 'Payment history', icon: History, mobile: false },
  { to: '/settings', label: 'Settings', icon: Settings, mobile: false },
]
