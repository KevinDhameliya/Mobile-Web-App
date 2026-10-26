import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { cn } from '../../utils/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors ' +
  'select-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0'

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-brand-fg hover:bg-brand-hover',
  secondary: 'border border-border bg-surface-raised text-fg hover:bg-surface-sunken',
  ghost: 'text-fg hover:bg-surface-sunken',
  danger: 'border border-border bg-surface-raised text-danger hover:bg-danger-soft',
}

// Minimum 44px tap targets (Apple HIG / WCAG 2.5.5).
const sizes: Record<Size, string> = {
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-5 text-base',
}

interface StyleProps {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
}

function buttonClasses({ variant = 'primary', size = 'md', fullWidth }: StyleProps, extra?: string) {
  return cn(base, variants[variant], sizes[size], fullWidth && 'w-full', extra)
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, StyleProps {
  icon?: ReactNode
}

export function Button({ variant, size, fullWidth, icon, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClasses({ variant, size, fullWidth }, className)} {...rest}>
      {icon}
      {children}
    </button>
  )
}

export interface ButtonLinkProps extends LinkProps, StyleProps {
  icon?: ReactNode
}

export function ButtonLink({ variant, size, fullWidth, icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, fullWidth }, typeof className === 'string' ? className : undefined)} {...rest}>
      {icon}
      {children}
    </Link>
  )
}
