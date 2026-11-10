import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { useBranchScope, withBranchQuery } from '../branch/BranchContext'
import { CustomerAvatar } from '../components/CustomerAvatar'
import { RecordPaymentPanel } from '../components/customers/CustomerFinancePanels'
import { useToast } from '../toast/ToastContext'
import type { CustomerListItem } from '../types'

export function RecordPaymentPage() {
  const { filterBranchId } = useBranchScope()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CustomerListItem[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<CustomerListItem | null>(null)
  const toast = useToast()
  const wrapRef = useRef<HTMLDivElement>(null)
  const requestId = useRef(0)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (selected && q === selected.fullName) {
      setResults([])
      setOpen(false)
      return
    }
    if (q.length < 1) {
      setResults([])
      setSearching(false)
      return
    }

    const timer = window.setTimeout(async () => {
      const id = ++requestId.current
      setSearching(true)
      try {
        const list = await api<CustomerListItem[]>(
          withBranchQuery(`/api/customers?q=${encodeURIComponent(q)}`, filterBranchId),
        )
        if (id !== requestId.current) return
        setResults(list.slice(0, 12))
        setOpen(true)
      } catch (err) {
        if (id !== requestId.current) return
        toast.error(err instanceof Error ? err.message : 'Customer search failed')
        setResults([])
      } finally {
        if (id === requestId.current) setSearching(false)
      }
    }, 220)

    return () => window.clearTimeout(timer)
  }, [query, filterBranchId, selected])

  const pickCustomer = (customer: CustomerListItem) => {
    setSelected(customer)
    setQuery(customer.fullName)
    setResults([])
    setOpen(false)
  }

  const clearCustomer = () => {
    setSelected(null)
    setQuery('')
    setResults([])
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Record Payment</h2>
        <p className="mt-1 text-sm text-slate-500">
          Find the customer, confirm the active loan, then post the payment.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Customer</label>
        <div ref={wrapRef} className="relative">
          <div className="flex gap-2">
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm"
              placeholder="Type name or mobile…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                if (selected) setSelected(null)
                setOpen(true)
              }}
              onFocus={() => {
                if (results.length > 0) setOpen(true)
              }}
              autoComplete="off"
              autoFocus
            />
            {selected && (
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                onClick={clearCustomer}
              >
                Clear
              </button>
            )}
          </div>
          {searching && <p className="mt-1 text-xs text-slate-500">Searching…</p>}
          {open && results.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-sky-50"
                    onClick={() => pickCustomer(c)}
                  >
                    <CustomerAvatar
                      customerId={c.id}
                      hasPicture={c.hasProfilePicture}
                      name={c.fullName}
                      className="h-9 w-9 shrink-0 rounded-full text-[10px]"
                      textClassName="bg-slate-200 text-slate-700"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">{c.fullName}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {[c.mobile, c.branchName, c.groupName].filter(Boolean).join(' · ') || 'No mobile'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {open && !searching && query.trim().length > 0 && !selected && results.length === 0 && (
            <p className="mt-2 text-sm text-slate-500">No customers matched.</p>
          )}
        </div>
        {selected && (
          <div className="mt-3 flex items-center gap-3">
            <CustomerAvatar
              customerId={selected.id}
              hasPicture={selected.hasProfilePicture}
              name={selected.fullName}
              className="h-11 w-11 shrink-0 rounded-full text-xs"
              textClassName="bg-[#0f2744] text-sky-100"
            />
            <p className="text-sm text-slate-600">
              Selected: <strong>{selected.fullName}</strong>
              {selected.mobile ? ` · ${selected.mobile}` : ''}
            </p>
          </div>
        )}
      </div>

      {selected ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <RecordPaymentPanel
            customerId={selected.id}
            compact
            onError={toast.error}
            onMessage={toast.success}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
          Start typing a customer name or mobile to continue.
        </div>
      )}
    </div>
  )
}
