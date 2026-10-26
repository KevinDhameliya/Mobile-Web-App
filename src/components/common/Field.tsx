import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

export const inputClass =
  'block w-full min-h-11 rounded-xl border border-border bg-surface-raised px-3 py-2 text-base text-fg ' +
  'placeholder:text-fg-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 ' +
  'disabled:opacity-60 aria-[invalid=true]:border-danger'

interface FieldProps {
  label: string
  error?: string | undefined
  hint?: ReactNode
  required?: boolean
  className?: string
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby': string | undefined }) => ReactNode
}

/** Label + control + hint/error with correct ARIA wiring. */
export function Field({ label, error, hint, required, className, children }: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-fg">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      {hint && !error && (
        <p id={hintId} className="mt-1 text-xs text-fg-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, className)} {...rest} />
}

export function SelectInput({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputClass, 'pr-8', className)} {...rest} />
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClass, 'min-h-20', className)} {...rest} />
}

interface SegmentedProps<T extends string> {
  name: string
  legend: string
  value: T | null
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  error?: string | undefined
}

export function Segmented<T extends string>({ name, legend, value, options, onChange, error }: SegmentedProps<T>) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-fg">{legend}</legend>
      <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-surface-sunken p-1">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              'flex min-h-10 cursor-pointer items-center justify-center rounded-lg px-2 text-center text-sm font-medium',
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus',
              value === o.value ? 'bg-surface-raised text-fg shadow-sm' : 'text-fg-muted hover:text-fg',
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => {
                onChange(o.value)
              }}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
      {error && <p className="mt-1 text-sm font-medium text-danger">{error}</p>}
    </fieldset>
  )
}
