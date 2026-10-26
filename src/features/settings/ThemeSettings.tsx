import { Monitor, Moon, Palette, Sun } from 'lucide-react'
import { Card, CardHeader } from '../../components/common/Card'
import { useTheme } from '../../hooks/useTheme'
import type { ThemePreference } from '../../types/pwa'
import { cn } from '../../utils/cn'

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export function ThemeSettings() {
  const { preference, setPreference } = useTheme()

  return (
    <Card aria-labelledby="theme-heading">
      <CardHeader id="theme-heading" icon={<Palette />} title="Appearance" description="Choose a colour theme for this device." />
      <fieldset>
        <legend className="sr-only">Theme</legend>
        <div className="grid grid-cols-3 gap-2">
          {OPTIONS.map(({ value, label, icon: Icon }) => (
            <label
              key={value}
              className={cn(
                'flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border text-sm font-medium transition-colors',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus',
                preference === value
                  ? 'border-brand bg-brand-soft text-brand-soft-fg'
                  : 'border-border text-fg-muted hover:bg-surface-sunken hover:text-fg',
              )}
            >
              <input
                type="radio"
                name="theme"
                value={value}
                checked={preference === value}
                onChange={() => {
                  setPreference(value)
                }}
                className="sr-only"
              />
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
    </Card>
  )
}
