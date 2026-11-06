type SpinnerProps = {
  className?: string
}

/** Ring spinner matching the app loading design. */
export function Spinner({ className = 'h-10 w-10' }: SpinnerProps) {
  return (
    <svg
      className={`animate-spin text-sky-500 ${className}`}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path
        d="M42 24a18 18 0 00-18-18"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        className="opacity-95"
      />
    </svg>
  )
}

type PageLoadingProps = {
  /** e.g. "Loading loans..." */
  label?: string
  className?: string
  compact?: boolean
}

/** Centered loading state used on every listing page. */
export function PageLoading({
  label = 'Loading...',
  className = '',
  compact = false,
}: PageLoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'px-4 py-10' : 'px-6 py-16'
      } ${className}`}
    >
      <Spinner className={compact ? 'h-8 w-8' : 'h-10 w-10'} />
      <p className={`mt-4 font-medium text-slate-700 ${compact ? 'text-sm' : 'text-base'}`}>{label}</p>
      <p className={`mt-1 text-slate-400 ${compact ? 'text-xs' : 'text-sm'}`}>Please wait a moment</p>
    </div>
  )
}

/** @deprecated Prefer PageLoading — kept as alias for existing imports. */
export function LoadingBlock(props: PageLoadingProps) {
  return <PageLoading {...props} />
}

type LoadingTableRowProps = {
  colSpan: number
  label?: string
}

/** Full-width table placeholder that uses the same loading design. */
export function LoadingTableRow({ colSpan, label = 'Loading...' }: LoadingTableRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="bg-white px-4 py-2">
        <PageLoading label={label} />
      </td>
    </tr>
  )
}
