import { RouterProvider } from 'react-router'
import { PwaProvider } from './PwaProvider'
import { router } from './router'
import { ThemeProvider } from './ThemeProvider'

export function App() {
  return (
    <ThemeProvider>
      <PwaProvider>
        <RouterProvider router={router} />
      </PwaProvider>
    </ThemeProvider>
  )
}
