// Runs before first paint to apply the user's saved theme and avoid a flash.
// Kept as an external file so the Content-Security-Policy can forbid inline scripts.
;(function () {
  'use strict'
  var theme = 'system'
  try {
    theme = window.localStorage.getItem('app:theme') || 'system'
  } catch {
    /* storage unavailable (private mode) — fall back to system */
  }
  var dark =
    theme === 'dark' ||
    (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
})()
