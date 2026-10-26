import { apiRequest } from './apiClient'
import { config } from './config'

export interface HealthResult {
  latencyMs: number
  checkedAt: Date
}

/** Pings the configured API health endpoint and measures round-trip time. */
export async function checkApiHealth(signal?: AbortSignal): Promise<HealthResult> {
  const started = performance.now()
  await apiRequest<unknown>(config.apiHealthPath, { method: 'GET', signal })
  return { latencyMs: Math.round(performance.now() - started), checkedAt: new Date() }
}
