/**
 * localStorage wrappers that never throw (storage can be disabled in private
 * browsing or by browser settings).
 */
export const STORAGE_PREFIX = 'app:'

export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + key)
  } catch {
    return null
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, value)
  } catch {
    /* ignore — preference just won't persist */
  }
}

/** Removes every key this app has written. */
export function clearAppStorage(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key?.startsWith(STORAGE_PREFIX)) keys.push(key)
    }
    keys.forEach((key) => {
      window.localStorage.removeItem(key)
    })
  } catch {
    /* ignore */
  }
}
