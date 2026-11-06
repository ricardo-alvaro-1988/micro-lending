import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useBranchScope, withBranchQuery } from '../branch/BranchContext'
import { ActionButton } from '../components/ActionButton'
import { LoadingTableRow } from '../components/ListLoading'
import { StatusTag } from '../components/StatusTag'
import type { Loan } from '../types'

export function notifyLoansChanged() {
  window.dispatchEvent(new Event('ml:loans-changed'))
}

export function LoansPage() {
  const { can } = useAuth()
  const { filterBranchId } = useBranchScope()
  const canManage = can('loans.manage')
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [advancingId, setAdvancingId] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      setLoans(await api<Loan[]>(withBranchQuery('/api/loans', filterBranchId)))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBranchId])

  useEffect(() => {
    const onChanged = () => void load().catch(() => undefined)
    window.addEventListener('ml:loans-changed', onChanged)
    window.addEventListener('ml:approvals-changed', onChanged)
    return () => {
      window.removeEventListener('ml:loans-changed', onChanged)
      window.removeEventListener('ml:approvals-changed', onChanged)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBranchId])

  const onAdvance = async (id: number) => {
    setAdvancingId(id)
    setError('')
    try {
      await api(`/api/loans/${id}/advance`, { method: 'POST' })
      notifyLoansChanged()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Advance failed')
    } finally {
      setAdvancingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Loans</h2>
        <p className="text-sm text-slate-500">
          Track loan progress. New applications are created under Transaction → Customers → Loan Application.
        </p>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Loan #</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Flow</th>
              <th className="px-4 py-3 font-medium">Stage</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && loans.length === 0 ? (
              <LoadingTableRow colSpan={7} label="Loading loans..." />
            ) : (
              <>
                {loans.map((loan) => (
                  <tr key={loan.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium">{loan.loanNumber}</td>
                    <td className="px-4 py-3">{loan.customerName}</td>
                    <td className="px-4 py-3">{loan.flowName}</td>
                    <td className="px-4 py-3">{loan.currentStageName}</td>
                    <td className="px-4 py-3">{loan.amount.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <StatusTag status={loan.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {canManage && loan.canAdvance && (
                          <ActionButton
                            type="button"
                            loading={advancingId === loan.id}
                            loadingText="Moving…"
                            onClick={() => void onAdvance(loan.id)}
                            className="px-3 py-1.5 text-xs"
                          >
                            Move next
                          </ActionButton>
                        )}
                        {loan.status === 'PendingApproval' && (
                          <StatusTag status="Pending" label="Waiting approval" />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && loans.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={7}>
                      No loans yet.
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
