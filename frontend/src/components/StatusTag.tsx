type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple'

const toneClass: Record<Tone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  danger: 'border-rose-200 bg-rose-50 text-rose-800',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
  neutral: 'border-slate-200 bg-slate-100 text-slate-700',
  purple: 'border-violet-200 bg-violet-50 text-violet-800',
}

function humanize(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
}

function toneFor(raw: string): Tone {
  const key = raw.replace(/[\s_-]/g, '').toLowerCase()
  if (['active', 'approved', 'approvedfinal', 'paid', 'closed', 'restored', 'received', 'created', 'submitted'].includes(key)) return 'success'
  if (['inactive', 'deleted', 'ended', 'draft'].includes(key)) return 'neutral'
  if (['pending', 'pendingapproval', 'partial', 'inprogress', 'waiting', 'updated'].includes(key)) return 'warning'
  if (['rejected', 'overdue', 'declined', 'failed', 'discrepancy'].includes(key)) return 'danger'
  if (['charge', 'debit'].includes(key)) return 'info'
  if (['payment', 'credit'].includes(key)) return 'purple'
  return 'info'
}

type Props = {
  status: string | null | undefined
  label?: string
  className?: string
}

function displayLabel(raw: string) {
  const key = raw.replace(/[\s_-]/g, '').toLowerCase()
  if (key === 'approvedfinal') return 'Approved-Final'
  if (key === 'closed') return 'Matured / Closed'
  return humanize(raw)
}

export function StatusTag({ status, label, className = '' }: Props) {
  if (!status && !label) return null
  const text = label ?? displayLabel(String(status))
  const tone = toneFor(String(status ?? label))

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide ${toneClass[tone]} ${className}`}
    >
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {text}
    </span>
  )
}

export function ActiveTag({ active }: { active: boolean }) {
  return <StatusTag status={active ? 'Active' : 'Inactive'} />
}
