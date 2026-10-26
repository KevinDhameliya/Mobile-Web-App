/**
 * The `beforeinstallprompt` event is non-standard (Chromium only) and not in
 * TypeScript's DOM lib, so it is typed here.
 */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt: () => Promise<void>
}

export type InstallPlatform = 'ios' | 'android' | 'desktop' | 'other'

export type ThemePreference = 'light' | 'dark' | 'system'
