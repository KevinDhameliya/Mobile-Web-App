type LinkType = 'magiclink' | 'signup' | 'email'

/**
 * Reads the one-time token from a pasted sign-in link. On iPhone an app
 * added to the home screen keeps its own storage, separate from Safari, so
 * tapping the emailed link would sign in Safari instead. Copying the link
 * and pasting it into the app signs the app in directly.
 */
export function parseSignInLink(input: string): { tokenHash: string; type: LinkType } | null {
  const text = input.trim()
  if (!/^https?:\/\//i.test(text)) return null
  try {
    const url = new URL(text)
    const tokenHash = url.searchParams.get('token') ?? url.searchParams.get('token_hash')
    if (!tokenHash) return null
    const raw = url.searchParams.get('type')
    const type: LinkType = raw === 'signup' ? 'signup' : raw === 'magiclink' ? 'magiclink' : 'email'
    return { tokenHash, type }
  } catch {
    return null
  }
}
