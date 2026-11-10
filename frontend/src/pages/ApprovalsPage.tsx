import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useBranchScope, withBranchQuery } from '../branch/BranchContext'
import { ActionButton } from '../components/ActionButton'
import { ApprovalNotesDialog } from '../components/ApprovalNotesDialog'
import { LoadingTableRow } from '../components/ListLoading'
import { LoanApplicationReviewDialog } from '../components/LoanApplicationReviewDialog'
import { StatusTag } from '../components/StatusTag'
import {
  notifyApprovalsChanged,
  notifyLoansChanged,
  notifyPaymentSchedulesChanged,
} from '../notify'
import type { ApprovalItem } from '../types'
import { useToast } from '../toast/ToastContext'

/** @deprecated Prefer importing from `../notify`. */
export { notifyApprovalsChanged }

type PendingDecision = {
  id: number
  action: 'approve' | 'reject'
  loanNumber: string
  customerName: string
  stageName: string
}

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function ApprovalsPage() {
  const { can } = useAuth()
  const { filterBranchId } = useBranchScope()
  const canAct = can('approvals.manage')
  const [items, setItems] = useState<ApprovalItem[]>([])
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<number | null>(null)
  const [mineOnly, setMineOnly] = useState(true)
  const [pending, setPending] = useState<PendingDecision | null>(null)
  const [reviewItem, setReviewItem] = useState<ApprovalItem | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const path = mineOnly ? '/api/approvals?mineOnly=true' : '/api/approvals'
      const list = await api<ApprovalItem[]>(withBranchQuery(path, filterBranchId))
      setItems(list)
      setReviewItem((prev) => (prev && list.some((x) => x.id === prev.id) ? prev : null))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load approvals')
    } finally {
      setLoading(false)
    }
  }, [mineOnly, filterBranchId])

  useEffect(() => {
    void load()
  }, [load])

  const openDecision = (item: ApprovalItem, action: 'approve' | 'reject') => {
    setPending({
      id: item.id,
      action,
      loanNumber: item.loanNumber,
      customerName: item.customerName,
      stageName: item.stageName,
    })
  }

  const decide = async (notes: string) => {
    if (!pending) return
    const { id, action } = pending
    setActingId(id)
    try {
      await api(`/api/approvals/${id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ comments: notes }),
      })
      setPending(null)
      setReviewItem((prev) => (prev?.id === id ? null : prev))
      setItems((prev) => prev.filter((x) => x.id !== id))
      notifyApprovalsChanged()
      notifyLoansChanged()
      notifyPaymentSchedulesChanged()
      await load()
      notifyApprovalsChanged()
      notifyLoansChanged()
      notifyPaymentSchedulesChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
      await load()
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Approvals</h2>
          <p className="text-sm text-slate-500">
            Open Review for the full application — personal details, documents, agent notes, and loan package.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={mineOnly}
              onChange={(e) => setMineOnly(e.target.checked)}
            />
            Only mine
          </label>
          <ActionButton type="button" onClick={() => void load()} loading={loading} loadingText="Refreshing…">
            Refresh
          </ActionButton>
        </div>
      </div>

      <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Loan #</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Stage</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Requested</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 && (
              <LoadingTableRow colSpan={7} label="Loading approvals..." />
            )}
            {items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                <td className="px-4 py-3 font-medium">
                  <button
                    type="button"
                    className="text-sky-700 hover:underline"
                    onClick={() => setReviewItem(item)}
                  >
                    {item.loanNumber}
                  </button>
                </td>
                <td className="px-4 py-3">{item.customerName}</td>
                <td className="px-4 py-3">{item.stageName}</td>
                <td className="px-4 py-3 tabular-nums">{money(item.amount)}</td>
                <td className="px-4 py-3">
                  <StatusTag status={item.decision || 'Pending'} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{new Date(item.requestedAt).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      onClick={() => setReviewItem(item)}
                    >
                      Review
                    </button>
                    {canAct && item.canAct ? (
                      <>
                        <ActionButton
                          type="button"
                          loading={actingId === item.id}
                          loadingText="Working…"
                          onClick={() => openDecision(item, 'approve')}
                          className="px-3 py-1.5 text-xs"
                        >
                          Approve
                        </ActionButton>
                        <ActionButton
                          type="button"
                          variant="danger"
                          loading={actingId === item.id}
                          loadingText="Working…"
                          onClick={() => openDecision(item, 'reject')}
                        >
                          Reject
                        </ActionButton>
                      </>
                    ) : (
                      <span className="self-center text-xs text-slate-500">
                        {!canAct ? 'No permission' : 'Not assigned to you'}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={7}>
                  {mineOnly ? 'No approvals waiting for you.' : 'No pending approvals.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {reviewItem && (
        <LoanApplicationReviewDialog
          loanId={reviewItem.loanId}
          onClose={() => setReviewItem(null)}
          headerActions={
            canAct && reviewItem.canAct ? (
              <>
                <ActionButton
                  type="button"
                  loading={actingId === reviewItem.id}
                  loadingText="Working…"
                  onClick={() => openDecision(reviewItem, 'approve')}
                  className="px-3 py-1.5 text-xs"
                >
                  Approve
                </ActionButton>
                <ActionButton
                  type="button"
                  variant="danger"
                  loading={actingId === reviewItem.id}
                  loadingText="Working…"
                  onClick={() => openDecision(reviewItem, 'reject')}
                  className="px-3 py-1.5 text-xs"
                >
                  Reject
                </ActionButton>
              </>
            ) : undefined
          }
        />
      )}

      <ApprovalNotesDialog
        open={pending != null}
        action={pending?.action ?? 'approve'}
        title={pending ? `${pending.action === 'approve' ? 'Approve' : 'Reject'} ${pending.loanNumber}` : undefined}
        subtitle={pending ? `${pending.customerName} · ${pending.stageName}` : undefined}
        busy={actingId != null}
        onCancel={() => setPending(null)}
        onConfirm={(notes) => void decide(notes)}
      />
    </div>
  )
}
