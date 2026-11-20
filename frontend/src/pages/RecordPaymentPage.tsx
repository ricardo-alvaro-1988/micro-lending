import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import { useBranchScope, withBranchQuery } from '../branch/BranchContext'
import { ActionButton } from '../components/ActionButton'
import { CustomerAvatar } from '../components/CustomerAvatar'
import { RecordPaymentPanel } from '../components/customers/CustomerFinancePanels'
import { StatusTag } from '../components/StatusTag'
import { useToast } from '../toast/ToastContext'
import { todayIso } from '../lib/phDate'
import type { CustomerGroup, CustomerListItem } from '../types'

type Mode = 'single' | 'group'

type GroupDayRow = {
  scheduleItemId: number
  customerId: number
  customerName: string
  customerMobile?: string | null
  loanId: number
  loanNumber: string
  installmentNumber: number
  dueDate: string
  amountDue: number
  penaltyAmount: number
  paidAmount: number
  remaining: number
  status: string
  isOverdue: boolean
  primarySavingsBalance: number
  extraSavingsBalance: number
  alreadyPaidForDay: boolean
}

type RowDraft = {
  checked: boolean
  amount: string
  useExtraSavings: boolean
}

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function RecordPaymentPage() {
  const { filterBranchId } = useBranchScope()
  const [mode, setMode] = useState<Mode>('group')
  const toast = useToast()

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Record Payment</h2>
        <p className="mt-1 text-sm text-slate-500">
          Collect by group for the day, or look up a single customer.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            mode === 'group' ? 'bg-sky-700 text-white' : 'border border-slate-300 bg-white text-slate-700'
          }`}
          onClick={() => setMode('group')}
        >
          By group
        </button>
        <button
          type="button"
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            mode === 'single' ? 'bg-sky-700 text-white' : 'border border-slate-300 bg-white text-slate-700'
          }`}
          onClick={() => setMode('single')}
        >
          Single customer
        </button>
      </div>

      {mode === 'group' ? (
        <GroupDayCollection filterBranchId={filterBranchId} onError={toast.error} onMessage={toast.success} />
      ) : (
        <SingleCustomerCollection filterBranchId={filterBranchId} toast={toast} />
      )}
    </div>
  )
}

function GroupDayCollection({
  filterBranchId,
  onError,
  onMessage,
}: {
  filterBranchId: number | null
  onError: (msg: string) => void
  onMessage: (msg: string) => void
}) {
  const [groups, setGroups] = useState<CustomerGroup[]>([])
  const [groupId, setGroupId] = useState('')
  const [asOf, setAsOf] = useState(todayIso)
  const [paidAt, setPaidAt] = useState(todayIso)
  const [method, setMethod] = useState('Cash')
  const [rows, setRows] = useState<GroupDayRow[]>([])
  const [drafts, setDrafts] = useState<Record<number, RowDraft>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api<CustomerGroup[]>('/api/groups?activeOnly=true')
      .then(setGroups)
      .catch((err) => onError(err instanceof Error ? err.message : 'Failed to load groups'))
  }, [onError])

  const load = async () => {
    if (!groupId) {
      onError('Select a group first.')
      return
    }
    setLoading(true)
    try {
      const list = await api<GroupDayRow[]>(
        withBranchQuery(`/api/payments/group-day?groupId=${groupId}&asOf=${asOf}`, filterBranchId),
      )
      setRows(list)
      const next: Record<number, RowDraft> = {}
      for (const r of list) {
        next[r.scheduleItemId] = {
          checked: false,
          amount: String(r.remaining > 0 ? r.remaining : 0),
          useExtraSavings: false,
        }
      }
      setDrafts(next)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load group dues')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  const openRows = useMemo(() => rows.filter((r) => !r.alreadyPaidForDay && r.remaining > 0.009), [rows])

  const selectedCount = useMemo(
    () => openRows.filter((r) => drafts[r.scheduleItemId]?.checked).length,
    [openRows, drafts],
  )

  const predictStatus = (row: GroupDayRow, draft: RowDraft) => {
    const cash = Number(draft.amount) || 0
    const remaining = row.remaining
    if (remaining <= 0.009) return 'Paid'
    let cover = cash
    if (draft.useExtraSavings && cash < remaining) {
      cover += Math.min(row.extraSavingsBalance, remaining - cash)
    }
    if (cover + 0.009 >= remaining) return 'Paid'
    if (cover > 0) return 'Underpaid'
    return row.status
  }

  const onRecord = async () => {
    const items = openRows
      .filter((r) => drafts[r.scheduleItemId]?.checked)
      .map((r) => {
        const d = drafts[r.scheduleItemId]
        return {
          customerId: r.customerId,
          loanId: r.loanId,
          scheduleItemId: r.scheduleItemId,
          amount: Number(d.amount) || 0,
          useExtraSavings: d.useExtraSavings,
        }
      })
    if (items.length === 0) {
      onError('Check at least one open installment.')
      return
    }
    setSaving(true)
    try {
      const result = await api<{ recorded: number; message: string }>('/api/payments/group-day', {
        method: 'POST',
        body: JSON.stringify({
          groupId: Number(groupId),
          paidAt,
          method,
          items,
        }),
      })
      onMessage(result.message || `${result.recorded} payment(s) recorded.`)
      await load()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Batch payment failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
        <label className="text-sm md:col-span-2">
          <span className="mb-1 block text-xs font-medium text-slate-500">Group *</span>
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          >
            <option value="">Select group</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.customerCount})
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">Due as of</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
          />
        </label>
        <div className="flex items-end">
          <ActionButton type="button" onClick={() => void load()} loading={loading} loadingText="Loading…">
            Load dues
          </ActionButton>
        </div>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">Paid date</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            type="date"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">Method</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <p className="text-sm text-slate-600">
            {rows.length} installment(s) · {selectedCount} selected
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="text-xs font-medium text-sky-700 hover:underline"
              onClick={() =>
                setDrafts((prev) => {
                  const next = { ...prev }
                  for (const r of openRows) {
                    next[r.scheduleItemId] = { ...next[r.scheduleItemId], checked: true }
                  }
                  return next
                })
              }
            >
              Select all open
            </button>
            <button
              type="button"
              className="text-xs font-medium text-slate-600 hover:underline"
              onClick={() =>
                setDrafts((prev) => {
                  const next = { ...prev }
                  for (const key of Object.keys(next)) {
                    next[Number(key)] = { ...next[Number(key)], checked: false }
                  }
                  return next
                })
              }
            >
              Clear
            </button>
            <ActionButton type="button" onClick={() => void onRecord()} loading={saving} loadingText="Recording…">
              Record selected
            </ActionButton>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1020px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Pay</th>
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="px-3 py-2 font-medium">Loan</th>
                <th className="px-3 py-2 font-medium">Inst</th>
                <th className="px-3 py-2 font-medium">Due</th>
                <th className="px-3 py-2 font-medium">Remaining</th>
                <th className="px-3 py-2 font-medium">Cash</th>
                <th className="px-3 py-2 font-medium">Primary</th>
                <th className="px-3 py-2 font-medium">Extra</th>
                <th className="px-3 py-2 font-medium">Use extra</th>
                <th className="px-3 py-2 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                    {groupId ? 'No dues for this group/date.' : 'Select a group and load dues.'}
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const draft = drafts[r.scheduleItemId] ?? {
                    checked: false,
                    amount: String(r.remaining),
                    useExtraSavings: false,
                  }
                  const paid = r.alreadyPaidForDay
                  const predicted = paid ? 'Paid' : predictStatus(r, draft)
                  return (
                    <tr key={r.scheduleItemId} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={paid || draft.checked}
                          disabled={paid}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [r.scheduleItemId]: { ...draft, checked: e.target.checked },
                            }))
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900">{r.customerName}</div>
                        <div className="text-xs text-slate-500">{r.customerMobile || '—'}</div>
                      </td>
                      <td className="px-3 py-2">{r.loanNumber}</td>
                      <td className="px-3 py-2">#{r.installmentNumber}</td>
                      <td className="px-3 py-2">
                        {r.dueDate.slice(0, 10)}
                        {r.isOverdue ? <span className="ml-1 text-xs text-rose-600">overdue</span> : null}
                      </td>
                      <td className="px-3 py-2">{money(r.remaining)}</td>
                      <td className="px-3 py-2">
                        <input
                          className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={paid}
                          value={draft.amount}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [r.scheduleItemId]: { ...draft, amount: e.target.value, checked: true },
                            }))
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500" title="Initial savings — not used for underpay">
                        {money(r.primarySavingsBalance)}
                      </td>
                      <td className="px-3 py-2 text-xs font-medium text-slate-800" title="Daily savings — may offset underpay">
                        {money(r.extraSavingsBalance)}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          disabled={paid || r.extraSavingsBalance <= 0 || Number(draft.amount) >= r.remaining}
                          checked={draft.useExtraSavings}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [r.scheduleItemId]: {
                                ...draft,
                                useExtraSavings: e.target.checked,
                                checked: true,
                              },
                            }))
                          }
                          title="Cover shortfall from extra (daily) savings only — never primary"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <StatusTag status={predicted} />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function SingleCustomerCollection({
  filterBranchId,
  toast,
}: {
  filterBranchId: number | null
  toast: { error: (m: string) => void; success: (m: string) => void }
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CustomerListItem[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<CustomerListItem | null>(null)
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
  }, [query, filterBranchId, selected, toast])

  const pickCustomer = (customer: CustomerListItem) => {
    setSelected(customer)
    setQuery(customer.fullName)
    setResults([])
    setOpen(false)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
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
            />
            {selected && (
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                onClick={() => {
                  setSelected(null)
                  setQuery('')
                  setResults([])
                }}
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
        </div>
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
