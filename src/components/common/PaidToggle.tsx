import { Check } from 'lucide-react'
import { useState } from 'react'
import { setPaid } from '../../data/repo'
import { cn } from '../../utils/cn'

/** One tap: Unpaid → Paid, tap again: Paid → Unpaid. */
export function PaidToggle({ transactionId, paid, label }: { transactionId: string; paid: boolean; label: string }) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      aria-pressed={paid}
      aria-label={paid ? `${label}: paid. Tap to mark as unpaid` : `${label}: unpaid. Tap to mark as paid`}
      disabled={busy}
      onClick={() => {
        setBusy(true)
        void setPaid(transactionId, !paid).finally(() => { setBusy(false) })
      }}
      className={cn(
        'inline-flex min-h-11 min-w-[5.5rem] shrink-0 items-center justify-center gap-1 rounded-full px-3 text-xs font-semibold transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60',
        paid ? 'bg-success-soft text-success hover:opacity-80' : 'border border-danger/40 bg-danger-soft text-danger hover:border-danger',
      )}
    >
      {paid && <Check className="size-3.5" aria-hidden="true" />}
      {paid ? 'Paid' : 'Unpaid'}
    </button>
  )
}
