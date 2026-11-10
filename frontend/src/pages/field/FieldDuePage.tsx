import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { LoadingBlock } from '../../components/ListLoading'
import type { FieldDuePayment } from '../../types'
import { useToast } from '../../toast/ToastContext'

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function FieldDuePage() {
  const [items, setItems] = useState<FieldDuePayment[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  useEffect(() => {
    setLoading(true)
    api<FieldDuePayment[]>('/api/field/due-payments')
      .then(setItems)
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load due payments'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return items
    return items.filter((item) => {
      const haystack = [
        item.customerName,
        item.customerMobile,
        item.loanNumber,
        String(item.installmentNumber),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [items, q])

  if (loading && items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white">
        <LoadingBlock label="Loading due payments..." />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Due today</h1>
        <p className="mt-1 text-sm text-slate-500">
          Installments due or overdue for customers assigned to you (Agent 1).
        </p>
      </div>

      <input
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        placeholder="Search name, mobile, or loan number"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
      />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500">
            {items.length === 0 ? 'No due payments right now.' : 'No matches for your search.'}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((item) => (
              <li key={item.scheduleItemId}>
                <Link
                  to={`/field/customers/${item.customerId}?loanId=${item.loanId}`}
                  className="block px-4 py-3 hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900">{item.customerName}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {item.loanNumber} · Inst. #{item.installmentNumber}
                        {item.customerMobile ? ` · ${item.customerMobile}` : ''}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-slate-900">{money(item.remaining)}</div>
                      {item.penaltyAmount > 0 && (
                        <div className="mt-0.5 text-[11px] font-medium text-rose-600">
                          penalty {money(item.penaltyAmount)}
                        </div>
                      )}
                      <div
                        className={`mt-0.5 text-[11px] font-medium ${
                          item.isOverdue ? 'text-rose-600' : 'text-amber-700'
                        }`}
                      >
                        {item.isOverdue ? 'Overdue' : 'Due'} ·{' '}
                        {new Date(item.dueDate).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
