import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase connection. The URL and the public "anon" key are safe to ship
 * in the app: every row is protected by row-level security, so a signed-in
 * user can only ever read or write their own records.
 */
const DEFAULT_URL = 'https://ubymovosfskkndmfrmxn.supabase.co'
const DEFAULT_KEY = 'sb_publishable_xgn6DCvNfKIXrIeTjekWkA_jW-mUyqT'

// Set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY to point a build at another
// project, or VITE_CLOUD_SYNC=off to build without cloud sync.
const disabled = import.meta.env.VITE_CLOUD_SYNC === 'off'
const url = disabled ? undefined : ((import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? DEFAULT_URL)
const anonKey = disabled ? undefined : ((import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? DEFAULT_KEY)

export const cloudConfigured = Boolean(url && anonKey)

let client: SupabaseClient | null = null

export function cloud(): SupabaseClient | null {
  if (!cloudConfigured || !url || !anonKey) return null
  client ??= createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Lets the emailed sign-in link work when opened in this browser.
      detectSessionInUrl: true,
      storageKey: 'money-tracker-auth',
    },
  })
  return client
}
