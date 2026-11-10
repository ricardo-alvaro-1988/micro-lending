import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ActionButton } from '../../components/ActionButton'
import { LoadingBlock } from '../../components/ListLoading'
import { useToast } from '../../toast/ToastContext'

export function ReportChrome({
  title,
  description,
  loading,
  error,
  onRefresh,
  onExport,
  filters,
  summary,
  children,
}: {
  title: string
  description?: string
  loading?: boolean
  error?: string
  onRefresh: () => void
  onExport: () => void
  filters?: ReactNode
  summary?: ReactNode
  children: ReactNode
}) {
  const toast = useToast()

  useEffect(() => {
    if (error) toast.error(error)
  }, [error, toast])

  return (
    <div className="space-y-4 print:space-y-2">
      <div className="print:hidden">
        <Link to="/reports" className="text-sm text-sky-700 hover:underline">
          ← Reports
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <ActionButton type="button" variant="light" onClick={onRefresh} disabled={loading}>
            Refresh
          </ActionButton>
          <ActionButton type="button" variant="light" onClick={onExport} disabled={loading}>
            Export CSV
          </ActionButton>
          <ActionButton type="button" onClick={() => window.print()}>
            Print
          </ActionButton>
        </div>
      </div>

      {filters && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 print:hidden">{filters}</div>
      )}

      {summary && !loading ? summary : null}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white">
          <LoadingBlock label="Loading report…" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white print:border-0">
          {children}
        </div>
      )}
    </div>
  )
}

export function ReportSummary({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
}

export function ReportStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'good' | 'bad' | 'neutral'
}) {
  const valueClass =
    tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-700' : 'text-slate-900'

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${valueClass}`}>{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-slate-500">{hint}</div> : null}
    </div>
  )
}

export const filterClass =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 bg-white min-w-0'

export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
      {label}
      {children}
    </label>
  )
}
