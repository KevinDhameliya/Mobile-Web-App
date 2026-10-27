import { createBrowserRouter } from 'react-router'
import { RouteErrorBoundary } from '../components/common/RouteErrorBoundary'
import { LoadingState } from '../components/common/StateViews'
import { AppLayout } from '../components/layout/AppLayout'
import { DashboardPage } from '../features/dashboard/DashboardPage'

/*
 * The dashboard (first screen) is in the main bundle; other screens load on
 * demand. The service worker precaches every chunk, so this still works
 * fully offline after the first visit.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteErrorBoundary />,
    hydrateFallbackElement: <LoadingState />,
    children: [
      { index: true, element: <DashboardPage /> },
      {
        path: 'transactions',
        children: [
          { index: true, lazy: () => import('../features/transactions/TransactionsPage').then((m) => ({ Component: m.TransactionsPage })) },
          { path: 'new', lazy: () => import('../features/transactions/TransactionFormPage').then((m) => ({ Component: m.TransactionFormPage })) },
          { path: ':id/edit', lazy: () => import('../features/transactions/TransactionFormPage').then((m) => ({ Component: m.TransactionFormPage })) },
        ],
      },
      {
        path: 'cards',
        children: [
          { index: true, lazy: () => import('../features/cards/CardsPage').then((m) => ({ Component: m.CardsPage })) },
          { path: 'new', lazy: () => import('../features/cards/CardFormPage').then((m) => ({ Component: m.CardFormPage })) },
          { path: ':id', lazy: () => import('../features/cards/CardDetailPage').then((m) => ({ Component: m.CardDetailPage })) },
          { path: ':id/edit', lazy: () => import('../features/cards/CardFormPage').then((m) => ({ Component: m.CardFormPage })) },
        ],
      },
      {
        path: 'people',
        children: [
          { index: true, lazy: () => import('../features/people/PeoplePage').then((m) => ({ Component: m.PeoplePage })) },
          { path: ':id', lazy: () => import('../features/people/PersonDetailPage').then((m) => ({ Component: m.PersonDetailPage })) },
        ],
      },
      { path: 'history', lazy: () => import('../features/history/HistoryPage').then((m) => ({ Component: m.HistoryPage })) },
      { path: 'reports', lazy: () => import('../features/reports/ReportsPage').then((m) => ({ Component: m.ReportsPage })) },
      {
        path: 'settings',
        children: [
          { index: true, lazy: () => import('../features/settings/SettingsPage').then((m) => ({ Component: m.SettingsPage })) },
          { path: 'install', lazy: () => import('../features/settings/InstallPage').then((m) => ({ Component: m.InstallPage })) },
        ],
      },
      { path: '*', lazy: () => import('../features/NotFoundPage').then((m) => ({ Component: m.NotFoundPage })) },
    ],
  },
])
