import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { ActionButton } from '../components/ActionButton'
import { LoanAgreementPrintView } from '../components/LoanAgreementPrintView'
import type { LoanApplicationReview } from '../components/LoanApplicationReviewDialog'
import { LoadingBlock } from '../components/ListLoading'
import { useToast } from '../toast/ToastContext'

export function LoanAgreementPage() {
  const { loanId: loanIdParam } = useParams()
  const loanId = Number(loanIdParam)
  const toast = useToast()
  const [review, setReview] = useState<LoanApplicationReview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!Number.isFinite(loanId) || loanId <= 0) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    api<LoanApplicationReview>(`/api/loans/${loanId}/review`)
      .then((data) => {
        if (!cancelled) setReview(data)
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load agreement')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loanId])

  if (!Number.isFinite(loanId) || loanId <= 0) {
    return <p className="text-sm text-slate-600">Invalid loan.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Loan application &amp; agreement</h2>
          <p className="text-sm text-slate-500">
            Printable contract, promissory note, loan terms, and payment schedule.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/lending/loans"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Back to loans
          </Link>
          <ActionButton type="button" onClick={() => window.print()} disabled={!review}>
            Print
          </ActionButton>
        </div>
      </div>

      {loading && <LoadingBlock label="Loading agreement…" />}
      {!loading && review && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm print:border-0 print:p-0 print:shadow-none">
          <LoanAgreementPrintView
            loan={review.loan}
            customer={review.customer}
            schedule={review.schedule}
            collaterals={review.collaterals ?? review.loan.collaterals}
          />
        </div>
      )}
      {!loading && !review && (
        <p className="text-sm text-slate-600">Could not load this loan application.</p>
      )}
    </div>
  )
}
