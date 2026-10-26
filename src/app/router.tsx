import { createBrowserRouter } from 'react-router'
import { AppLayout } from '../components/layout/AppLayout'
import { RouteErrorBoundary } from '../components/common/RouteErrorBoundary'
import { AboutPage } from '../features/about/AboutPage'
import { HomePage } from '../features/home/HomePage'
import { NotFoundPage } from '../features/home/NotFoundPage'
import { InstallPage } from '../features/settings/InstallPage'
import { SettingsPage } from '../features/settings/SettingsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'about', element: <AboutPage /> },
      {
        path: 'settings',
        children: [
          { index: true, element: <SettingsPage /> },
          // Nested route — also used to verify deep links work after refresh.
          { path: 'install', element: <InstallPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
