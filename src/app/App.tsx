import { RouterProvider } from 'react-router'
import { LoadingState } from '../components/common/StateViews'
import { LoginPage } from '../features/auth/LoginPage'
import { useSync } from '../hooks/useSync'
import { PwaProvider } from './PwaProvider'
import { router } from './router'
import { SyncProvider } from './SyncProvider'
import { ThemeProvider } from './ThemeProvider'

/**
 * Login first: until the user is signed in, only the login screen is shown.
 * (Builds without cloud sync, and the dev sample preview, skip the login.)
 */
function AuthGate() {
  const sync = useSync()
  if (sync.configured && !sync.authReady) {
    return (
      <div className="grid min-h-dvh place-items-center bg-surface">
        <LoadingState />
      </div>
    )
  }
  if (sync.configured && sync.status === 'signed-out') return <LoginPage />
  return <RouterProvider router={router} />
}

export function App() {
  return (
    <ThemeProvider>
      <PwaProvider>
        <SyncProvider>
          <AuthGate />
        </SyncProvider>
      </PwaProvider>
    </ThemeProvider>
  )
}
