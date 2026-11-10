import { useEffect, useState, type ReactNode } from 'react'
import { StatusTag } from './StatusTag'
import type { LoanApprovalHistory } from '../types'

type Props = {
  entry: LoanApprovalHistory
  className?: string
}

/** Truncated approval notes that open a readable popup for the next reviewer. */
export function ApprovalCommentViewer({ entry, className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const comments = entry.comments?.trim() ?? ''

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!comments) {
    return <span className={`text-slate-400 ${className}`}>—</span>
  }

  return (
    <>
      <button
        type="button"
        className={`max-w-xs truncate text-left text-sky-700 hover:underline ${className}`}
        title="View full approval note"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
      >
        {comments}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Approval note"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Approval note</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {entry.stageName}
                  {entry.decidedBy ? ` · by ${entry.decidedBy}` : ''}
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Meta label="Decision">
                <StatusTag status={entry.decision} />
              </Meta>
              <Meta label="Approver / actor" value={entry.decidedBy || '—'} />
              <Meta label="Requested" value={new Date(entry.requestedAt).toLocaleString()} />
              <Meta
                label="Decided"
                value={entry.decidedAt ? new Date(entry.decidedAt).toLocaleString() : '—'}
              />
            </div>

            <div className="mt-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Notes
              </div>
              <div className="mt-2 max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-800">
                {comments}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Meta({
  label,
  value,
  children,
}: {
  label: string
  value?: string
  children?: ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm text-slate-900">{children ?? value}</div>
    </div>
  )
}
