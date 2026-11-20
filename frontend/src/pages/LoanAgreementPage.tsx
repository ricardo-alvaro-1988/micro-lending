import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { ActionButton } from '../components/ActionButton'
import { LoanAgreementPrintView } from '../components/LoanAgreementPrintView'
import type { LoanApplicationReview } from '../components/LoanApplicationReviewDialog'
import { LoadingBlock } from '../components/ListLoading'
import { useToast } from '../toast/ToastContext'

export function LoanAgreementPage() {
  const { loanId: loanIdParam } = useParams()
  const [searchParams] = useSearchParams()
  const autoPrint = searchParams.get('autoprint') === '1' || searchParams.get('print') === '1'
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

  useEffect(() => {
    if (!autoPrint || loading || !review) return
    const t = window.setTimeout(() => window.print(), 400)
    return () => window.clearTimeout(t)
  }, [autoPrint, loading, review])

  if (!Number.isFinite(loanId) || loanId <= 0) {
    return <p className="text-sm text-slate-600">Invalid loan.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Payment schedule &amp; terms and conditions
          </h2>
          <p className="text-sm text-slate-500">
            One printable layout: terms and conditions, promissory note, loan terms, and payment schedule.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/transaction/disbursement"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Back to disbursement
          </Link>
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
