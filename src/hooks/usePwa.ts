import { useContext } from 'react'
import { PwaContext, type PwaContextValue } from './pwaContext'

export function usePwa(): PwaContextValue {
  const context = useContext(PwaContext)
  if (!context) throw new Error('usePwa must be used inside <PwaProvider>.')
  return context
}
