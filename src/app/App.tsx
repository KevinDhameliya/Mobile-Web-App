import { RouterProvider } from 'react-router'
import { PwaProvider } from './PwaProvider'
import { router } from './router'
import { SyncProvider } from './SyncProvider'
import { ThemeProvider } from './ThemeProvider'

export function App() {
  return (
    <ThemeProvider>
      <PwaProvider>
        <SyncProvider>
          <RouterProvider router={router} />
        </SyncProvider>
      </PwaProvider>
    </ThemeProvider>
  )
}
