import { Plus } from 'lucide-react'
import { useEffect } from 'react'
import { Link, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { requestPersistentStorage } from '../../data/db'
import { OfflineBanner } from '../pwa/OfflineBanner'
import { UpdatePrompt } from '../pwa/UpdatePrompt'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function AppLayout() {
  const { pathname } = useLocation()
  const onForm = pathname.endsWith('/new') || pathname.endsWith('/edit')

  useEffect(() => {
    // Ask once for durable storage so the browser doesn't evict records.
    void requestPersistentStorage()
  }, [])

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
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-safe pt-5 pb-32 outline-none md:px-8 md:pt-8 md:pb-12">
          <Outlet />
        </main>
      </div>
      {!onForm && (
        <Link
          to="/transactions/new"
          aria-label="Add transaction"
          className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 grid size-14 place-items-center rounded-full bg-brand text-brand-fg shadow-lg hover:bg-brand-hover md:hidden"
        >
          <Plus className="size-6" aria-hidden="true" />
        </Link>
      )}
      <BottomNav />
      <UpdatePrompt />
      <ScrollRestoration />
    </div>
  )
}
