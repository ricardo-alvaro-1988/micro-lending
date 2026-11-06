import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'dark' | 'danger' | 'ghost' | 'light'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean
  loadingText?: string
  variant?: Variant
  children: ReactNode
}

const variants: Record<Variant, string> = {
  primary: 'bg-[var(--accent)] text-white hover:bg-sky-700',
  dark: 'bg-slate-800 text-white hover:bg-slate-900',
  danger: 'text-red-600 hover:underline bg-transparent px-0 py-0',
  ghost: 'bg-white/10 text-white hover:bg-white/20',
  light: 'border border-slate-200 bg-white text-slate-900 hover:bg-sky-50',
}

function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`h-4 w-4 animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
      />
    </svg>
  )
}

export function ActionButton({
  loading = false,
  loadingText,
  variant = 'primary',
  children,
  className = '',
  disabled,
  ...props
}: Props) {
  const isDanger = variant === 'danger'
  const base = isDanger
    ? 'inline-flex items-center gap-2 text-sm font-medium disabled:opacity-60'
    : 'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60'

  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {loading && <Spinner />}
      <span>{loading ? (loadingText ?? children) : children}</span>
    </button>
  )
}
