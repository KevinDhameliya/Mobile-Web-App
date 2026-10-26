import type { InstallPlatform } from '../types/pwa'

interface NavigatorWithStandalone extends Navigator {
  /** Legacy iOS Safari flag for home-screen apps. */
  standalone?: boolean
}

export function isIOS(): boolean {
  const ua = navigator.userAgent
  // iPadOS 13+ reports itself as macOS; detect it through touch support.
  const iPadOS = ua.includes('Macintosh') && navigator.maxTouchPoints > 1
  return /iPad|iPhone|iPod/.test(ua) || iPadOS
}

export function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent)
}

/** True when the app is running as an installed app rather than in a browser tab. */
export function isStandalone(): boolean {
  const nav = navigator as NavigatorWithStandalone
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    nav.standalone === true
  )
}

export function detectPlatform(): InstallPlatform {
  if (isIOS()) return 'ios'
  if (isAndroid()) return 'android'
  if (window.matchMedia('(pointer: fine)').matches) return 'desktop'
  return 'other'
}
