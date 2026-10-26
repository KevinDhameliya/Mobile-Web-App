import { Outlet, ScrollRestoration } from 'react-router'
import { OfflineBanner } from '../pwa/OfflineBanner'
import { UpdatePrompt } from '../pwa/UpdatePrompt'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function AppLayout() {
  return (
    <div className="min-h-dvh md:flex">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-brand px-4 py-2 font-semibold text-brand-fg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <OfflineBanner />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-safe pt-6 pb-28 outline-none md:px-8 md:pt-10 md:pb-12">
          <Outlet />
        </main>
      </div>
      <BottomNav />
      <UpdatePrompt />
      <ScrollRestoration />
    </div>
  )
}
