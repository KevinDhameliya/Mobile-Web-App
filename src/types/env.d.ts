/// <reference types="vite/client" />

/** Injected at build time from package.json (see vite.config.ts). */
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  /**
   * Base URL of a future backend API, e.g. https://api.example.com.
   * NOTE: every VITE_* variable is embedded in the public JS bundle.
   * Never put secrets here.
   */
  readonly VITE_API_BASE_URL?: string
  /** Path of a lightweight health endpoint on that API. Defaults to /health. */
  readonly VITE_API_HEALTH_PATH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
