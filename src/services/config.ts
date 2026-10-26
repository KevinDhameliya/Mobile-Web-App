/**
 * Runtime configuration read from Vite env variables.
 *
 * IMPORTANT: VITE_* variables are compiled into the JavaScript bundle and are
 * visible to anyone who loads the app. Only put public values here (such as an
 * API base URL) — never API keys, tokens or other secrets.
 */
function normaliseBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return trimmed.replace(/\/+$/, '')
}

const healthPath = import.meta.env.VITE_API_HEALTH_PATH?.trim() ?? ''

export const config = {
  appVersion: __APP_VERSION__,
  apiBaseUrl: normaliseBaseUrl(import.meta.env.VITE_API_BASE_URL),
  apiHealthPath: healthPath.length > 0 ? healthPath : '/health',
  requestTimeoutMs: 10_000,
} as const
