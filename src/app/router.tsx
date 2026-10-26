import { createBrowserRouter } from 'react-router'
import { RouteErrorBoundary } from '../components/common/RouteErrorBoundary'
import { AppLayout } from '../components/layout/AppLayout'
import { CardDetailPage } from '../features/cards/CardDetailPage'
import { CardFormPage } from '../features/cards/CardFormPage'
import { CardsPage } from '../features/cards/CardsPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { NotFoundPage } from '../features/NotFoundPage'
import { PeoplePage } from '../features/people/PeoplePage'
import { PersonDetailPage } from '../features/people/PersonDetailPage'
import { ReportsPage } from '../features/reports/ReportsPage'
import { InstallPage } from '../features/settings/InstallPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { TransactionFormPage } from '../features/transactions/TransactionFormPage'
import { TransactionsPage } from '../features/transactions/TransactionsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <DashboardPage /> },
      {
        path: 'transactions',
        children: [
          { index: true, element: <TransactionsPage /> },
          { path: 'new', element: <TransactionFormPage /> },
          { path: ':id/edit', element: <TransactionFormPage /> },
        ],
      },
      {
        path: 'cards',
        children: [
          { index: true, element: <CardsPage /> },
          { path: 'new', element: <CardFormPage /> },
          { path: ':id', element: <CardDetailPage /> },
          { path: ':id/edit', element: <CardFormPage /> },
        ],
      },
      {
        path: 'people',
        children: [
          { index: true, element: <PeoplePage /> },
          { path: ':id', element: <PersonDetailPage /> },
        ],
      },
      { path: 'reports', element: <ReportsPage /> },
      {
        path: 'settings',
        children: [
          { index: true, element: <SettingsPage /> },
          { path: 'install', element: <InstallPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
