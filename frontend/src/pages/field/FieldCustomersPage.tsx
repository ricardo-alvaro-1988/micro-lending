import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { LoadingBlock } from '../../components/ListLoading'
import type { CustomerListItem } from '../../types'
import { useToast } from '../../toast/ToastContext'

export function FieldCustomersPage() {
  const [list, setList] = useState<CustomerListItem[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  const load = async (term = q) => {
    setLoading(true)
    try {
      const path = term.trim()
        ? `/api/customers?q=${encodeURIComponent(term.trim())}`
        : '/api/customers'
      setList(await api<CustomerListItem[]>(path))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load().catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">My customers</h1>
        <p className="mt-1 text-sm text-slate-500">Customers where you are Field Agent 1.</p>
      </div>

      <div className="flex gap-2">
        <input
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Search name or mobile"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void load()
          }}
        />
        <button
          type="button"
          className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-medium text-white"
          onClick={() => void load()}
        >
          Go
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {loading && list.length === 0 ? (
          <LoadingBlock label="Loading customers..." compact />
        ) : list.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500">No assigned customers.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.map((c) => (
              <li key={c.id}>
                <Link to={`/field/customers/${c.id}`} className="block px-4 py-3 hover:bg-slate-50">
                  <div className="font-semibold text-slate-900">{c.fullName}</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {c.mobile || 'No mobile'}
                    {c.branchName ? ` · ${c.branchName}` : ''}
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
