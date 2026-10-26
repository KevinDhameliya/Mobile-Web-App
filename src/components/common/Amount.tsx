import { formatINR } from '../../domain/money'
import { cn } from '../../utils/cn'

type Tone = 'in' | 'out' | 'neutral'

const tones: Record<Tone, string> = {
  in: 'text-success',
  out: 'text-danger',
  neutral: 'text-fg',
}

interface AmountProps {
  paise: number
  /** in = money received (green), out = expense (red), neutral = balances. */
  tone?: Tone
  /** Prefix with + or − to make direction obvious. */
  signed?: boolean
  className?: string
}

export function Amount({ paise, tone = 'neutral', signed = false, className }: AmountProps) {
  const sign = signed ? (tone === 'in' ? '+' : tone === 'out' ? '−' : '') : ''
  return <span className={cn('tabular-nums', tones[tone], className)}>{sign}{formatINR(Math.abs(paise))}</span>
}
