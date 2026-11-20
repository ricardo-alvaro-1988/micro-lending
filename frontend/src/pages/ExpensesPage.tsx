import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useBranchScope, withBranchQuery } from '../branch/BranchContext'
import { ActionButton } from '../components/ActionButton'
import { LoadingTableRow } from '../components/ListLoading'
import { useToast } from '../toast/ToastContext'

const fieldClass = 'rounded-lg border border-slate-300 px-3 py-2 text-sm w-full'

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const todayIso = () => new Date().toISOString().slice(0, 10)

type ExpenseRow = {
  id: number
  label: string
  amount: number
  expenseDate: string
  branchId?: number | null
  branchName?: string | null
  notes?: string | null
  recordedByName: string
  createdAt: string
}

type Summary = {
  from: string
  to: string
  count: number
  totalAmount: number
}

const emptyForm = () => ({
  label: '',
  amount: '',
  expenseDate: todayIso(),
  notes: '',
})

export function ExpensesPage() {
  const { can } = useAuth()
  const { filterBranchId } = useBranchScope()
  const canManage = can('expenses.manage')
  const toast = useToast()

  const [mode, setMode] = useState<'date' | 'range'>('date')
  const [asOf, setAsOf] = useState(todayIso())
  const [from, setFrom] = useState(todayIso())
  const [to, setTo] = useState(todayIso())
  const [rows, setRows] = useState<ExpenseRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const rangeFrom = mode === 'date' ? asOf : from
  const rangeTo = mode === 'date' ? asOf : to

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ from: rangeFrom, to: rangeTo })
      const [list, sum] = await Promise.all([
        api<ExpenseRow[]>(withBranchQuery(`/api/expenses?${qs}`, filterBranchId)),
        api<Summary>(withBranchQuery(`/api/expenses/summary?${qs}`, filterBranchId)),
      ])
      setRows(list)
      setSummary(sum)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load expenses')
      setRows([])
      setSummary(null)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeFrom, rangeTo, filterBranchId])

  useEffect(() => {
    void load()
  }, [load])

  const resetForm = () => {
    setSelectedId(null)
    setForm(emptyForm())
  }

  const selectRow = (row: ExpenseRow) => {
    setSelectedId(row.id)
    setForm({
      label: row.label,
      amount: String(row.amount),
      expenseDate: row.expenseDate.slice(0, 10),
      notes: row.notes ?? '',
    })
  }

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!canManage) return
    const amount = Number(form.amount)
    if (!form.label.trim()) {
      toast.error('Enter a label (e.g. Salary, Electric bill).')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter an amount greater than zero.')
      return
    }
    setSaving(true)
    try {
      const body = {
        label: form.label.trim(),
        amount,
        expenseDate: form.expenseDate,
        notes: form.notes.trim() || null,
      }
      if (selectedId == null) {
        await api<ExpenseRow>('/api/expenses', { method: 'POST', body: JSON.stringify(body) })
        toast.success('Expense added.')
      } else {
        await api<ExpenseRow>(`/api/expenses/${selectedId}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
        toast.success('Expense updated.')
      }
      resetForm()
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save expense')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (id: number) => {
    if (!canManage) return
    if (!window.confirm('Delete this expense entry?')) return
    setSaving(true)
    try {
      await api(`/api/expenses/${id}`, { method: 'DELETE' })
      toast.success('Expense deleted.')
      if (selectedId === id) resetForm()
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setSaving(false)
    }
  }

  const periodLabel =
    rangeFrom === rangeTo
      ? new Date(rangeFrom + 'T00:00:00').toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : `${rangeFrom} → ${rangeTo}`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Expenses</h1>
        <p className="mt-1 text-sm text-slate-500">
          Record office expenses by label and amount (salary, electric bill, and so on).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-4 shadow-sm sm:col-span-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-rose-700">
            Total expense
          </div>
          <div className="mt-1 text-3xl font-semibold tabular-nums text-rose-900">
            {summary ? money(summary.totalAmount) : '—'}
          </div>
          <div className="mt-1 text-sm text-rose-700/80">
            {summary
              ? `${summary.count} entr${summary.count === 1 ? 'y' : 'ies'} · ${periodLabel}`
              : periodLabel}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Entries</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
            {summary?.count ?? 0}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Period</div>
          <div className="mt-1 text-sm font-medium text-slate-800">{periodLabel}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <label className="flex min-w-[9rem] flex-col gap-1 text-xs font-medium text-slate-600">
          Filter mode
          <select
            className={fieldClass}
            value={mode}
            onChange={(e) => setMode(e.target.value === 'range' ? 'range' : 'date')}
          >
            <option value="date">By date</option>
            <option value="range">By range</option>
          </select>
        </label>
        {mode === 'date' ? (
          <label className="flex min-w-[9rem] flex-col gap-1 text-xs font-medium text-slate-600">
            Date
            <input
              type="date"
              className={fieldClass}
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
            />
          </label>
        ) : (
          <>
            <label className="flex min-w-[9rem] flex-col gap-1 text-xs font-medium text-slate-600">
              From
              <input
                type="date"
                className={fieldClass}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className="flex min-w-[9rem] flex-col gap-1 text-xs font-medium text-slate-600">
              To
              <input
                type="date"
                className={fieldClass}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </>
        )}
        <ActionButton type="button" onClick={() => void load()}>
          Refresh
        </ActionButton>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Label</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Recorded by</th>
                {canManage && <th className="px-4 py-3 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingTableRow colSpan={canManage ? 5 : 4} label="Loading expenses…" />
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={canManage ? 5 : 4}>
                    No expenses in this period.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${
                      selectedId === row.id ? 'bg-sky-50' : ''
                    }`}
                    onClick={() => selectRow(row)}
                  >
                    <td className="whitespace-nowrap px-4 py-3">{row.expenseDate.slice(0, 10)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {row.label}
                      {row.notes ? (
                        <div className="text-xs font-normal text-slate-500">{row.notes}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{money(row.amount)}</td>
                    <td className="px-4 py-3 text-slate-600">{row.recordedByName}</td>
                    {canManage && (
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="text-rose-700 hover:underline"
                          onClick={() => void onDelete(row.id)}
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {canManage && (
          <form
            onSubmit={(e) => void onSave(e)}
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h3 className="text-sm font-semibold text-slate-800">
              {selectedId == null ? 'Add expense' : `Edit expense #${selectedId}`}
            </h3>

            <label className="block text-sm text-slate-600">
              Label
              <input
                className={`${fieldClass} mt-1`}
                required
                placeholder="e.g. Salary, Electric bill"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </label>

            <label className="block text-sm text-slate-600">
              Amount
              <input
                type="number"
                min="0.01"
                step="0.01"
                className={`${fieldClass} mt-1`}
                required
                placeholder="1500"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </label>

            <label className="block text-sm text-slate-600">
              Date
              <input
                type="date"
                className={`${fieldClass} mt-1`}
                required
                value={form.expenseDate}
                onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
              />
            </label>

            <label className="block text-sm text-slate-600">
              Notes <span className="font-normal text-slate-400">(optional)</span>
              <textarea
                className={`${fieldClass} mt-1`}
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>

            <div className="flex flex-wrap gap-2 pt-1">
              <ActionButton type="submit" loading={saving} loadingText="Saving…">
                {selectedId == null ? 'Add expense' : 'Save changes'}
              </ActionButton>
              {selectedId != null && (
                <ActionButton type="button" variant="light" onClick={resetForm}>
                  Cancel
                </ActionButton>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
