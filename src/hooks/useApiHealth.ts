import { useCallback, useEffect, useState } from 'react'
import { isAbortError, isApiConfigured } from '../services/apiClient'
import { checkApiHealth, type HealthResult } from '../services/healthService'
import { ApiError, type AsyncState } from '../types/api'

/**
 * Loads the API health status. Returns `idle` when no API is configured so the
 * UI can show an empty state instead of a fake result.
 */
export function useApiHealth(): { state: AsyncState<HealthResult>; retry: () => void } {
  const configured = isApiConfigured()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<AsyncState<HealthResult>>(
    configured ? { status: 'loading' } : { status: 'idle' },
  )

  useEffect(() => {
    if (!configured) return
    const controller = new AbortController()
    checkApiHealth(controller.signal)
      .then((data) => {
        setState({ status: 'success', data })
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return
        setState({
          status: 'error',
          error:
            error instanceof ApiError ? error : new ApiError('network', 'Something went wrong.'),
        })
      })
    return () => {
      controller.abort()
    }
  }, [configured, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  return { state, retry }
}
