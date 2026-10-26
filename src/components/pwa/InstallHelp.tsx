import { EllipsisVertical, PlusSquare, Share } from 'lucide-react'
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useInstallPrompt } from '../../hooks/useInstallPrompt'
import { cn } from '../../utils/cn'
import { StatusBadge } from '../common/StatusBadge'

type Tab = 'android' | 'ios'

const TABS: { id: Tab; label: string }[] = [
  { id: 'android', label: 'Android' },
  { id: 'ios', label: 'iPhone & iPad' },
]

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand-soft-fg" aria-hidden="true">
        {n}
      </span>
      <div className="pt-0.5 text-sm leading-relaxed text-fg">{children}</div>
    </li>
  )
}

function InlineIcon({ children, label }: { children: ReactNode; label: string }) {
  return (
    <span className="mx-0.5 inline-flex translate-y-0.5 items-center rounded border border-border bg-surface-sunken px-1 [&_svg]:size-3.5" role="img" aria-label={label}>
      {children}
    </span>
  )
}

function AndroidSteps() {
  return (
    <>
      <ol className="space-y-3">
        <Step n={1}>Open this site in <strong>Chrome</strong>.</Step>
        <Step n={2}>
          Tap <strong>Install app</strong> in this app if it’s shown. Otherwise tap the menu
          <InlineIcon label="three-dot menu"><EllipsisVertical /></InlineIcon> in the top-right corner.
        </Step>
        <Step n={3}>Choose <strong>Install app</strong> (or <strong>Add to Home screen</strong> → <strong>Install</strong>).</Step>
        <Step n={4}>Confirm. The app icon appears on your home screen and opens without the browser toolbar.</Step>
      </ol>
      <p className="mt-4 text-sm text-fg-muted">
        Samsung Internet: menu → <strong>Add page to</strong> → <strong>Home screen</strong>. Other Android browsers may only
        create a shortcut that opens in the browser.
      </p>
    </>
  )
}

function IosSteps() {
  return (
    <>
      <ol className="space-y-3">
        <Step n={1}>Open this site in <strong>Safari</strong>.</Step>
        <Step n={2}>
          Tap the Share button <InlineIcon label="Share"><Share /></InlineIcon>. On newer iOS versions it may be inside the
          <InlineIcon label="more"><span className="px-0.5 text-xs leading-none">•••</span></InlineIcon> menu.
        </Step>
        <Step n={3}>
          Scroll down and tap <strong>Add to Home Screen</strong> <InlineIcon label="Add"><PlusSquare /></InlineIcon>.
        </Step>
        <Step n={4}>Keep <strong>Open as Web App</strong> switched on if shown, then tap <strong>Add</strong>.</Step>
      </ol>
      <p className="mt-4 text-sm text-fg-muted">
        iOS doesn’t offer an install button to websites, so this has to be done manually. On iOS 16.4 and later, some
        other browsers also show <strong>Add to Home Screen</strong> in their Share menu.
      </p>
    </>
  )
}

export function InstallHelp() {
  const { platform, isInstalled } = useInstallPrompt()
  const [active, setActive] = useState<Tab>(platform === 'ios' ? 'ios' : 'android')
  const baseId = useId()
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ android: null, ios: null })

  // Arrow-key navigation between tabs (WAI-ARIA tabs pattern).
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    const next: Tab = active === 'android' ? 'ios' : 'android'
    setActive(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <div>
      {isInstalled && (
        <p className="mb-4">
          <StatusBadge tone="success">Installed — you’re using the app</StatusBadge>
        </p>
      )}
      <div role="tablist" aria-label="Device type" onKeyDown={onKeyDown} className="mb-5 inline-flex w-full rounded-xl bg-surface-sunken p-1 sm:w-auto">
        {TABS.map((tab) => {
          const selected = tab.id === active
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[tab.id] = el
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => {
                setActive(tab.id)
              }}
              className={cn(
                'min-h-10 flex-1 rounded-lg px-4 text-sm font-semibold transition-colors sm:flex-none',
                selected ? 'bg-surface-raised text-fg shadow-sm' : 'text-fg-muted hover:text-fg',
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      {TABS.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== active}
          tabIndex={0}
        >
          {tab.id === 'android' ? <AndroidSteps /> : <IosSteps />}
        </div>
      ))}
    </div>
  )
}
