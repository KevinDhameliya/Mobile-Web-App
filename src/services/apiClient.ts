import { ApiError } from '../types/api'
import { config } from './config'

export interface RequestOptions extends Omit<RequestInit, 'body' | 'signal'> {
  /** JSON-serialisable request body. */
  body?: unknown
  /** Caller-provided abort signal (e.g. from a React effect cleanup). */
  signal?: AbortSignal
  timeoutMs?: number
}

/** True when a backend URL has been configured via VITE_API_BASE_URL. */
export function isApiConfigured(): boolean {
  return config.apiBaseUrl !== null
}

/**
 * Small typed wrapper around fetch for future backend integration.
 * - prefixes VITE_API_BASE_URL
 * - applies a timeout
 * - normalises failures into ApiError
 * - parses JSON responses (204 → undefined)
 *
 * Responses are never cached by the service worker (see vite.config.ts).
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, signal, timeoutMs = config.requestTimeoutMs, headers, ...init } = options

  if (config.apiBaseUrl === null) {
    throw new ApiError('not-configured', 'No API base URL is configured.')
  }

  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal
  const url = `${config.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`

  const requestHeaders = new Headers(headers)
  if (!requestHeaders.has('Accept')) requestHeaders.set('Accept', 'application/json')
  if (body !== undefined && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json')
  }

  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: requestHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: combinedSignal,
    })
  } catch (error) {
    if (timeoutSignal.aborted) {
      throw new ApiError('timeout', `The request took longer than ${timeoutMs / 1000}s.`)
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new ApiError('network', 'Could not reach the server. Check your connection.')
  }

  if (!response.ok) {
    throw new ApiError('http', `The server responded with ${response.status}.`, response.status)
  }

  if (response.status === 204) return undefined as T

  try {
    return (await response.json()) as T
  } catch {
    throw new ApiError('parse', 'The server returned a response that was not valid JSON.')
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
