import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useBranchScope, withBranchQuery } from '../branch/BranchContext'
import { ActionButton } from '../components/ActionButton'
import { LoadingTableRow } from '../components/ListLoading'
import { StageTag, StatusTag } from '../components/StatusTag'
import { notifyPaymentSchedulesChanged } from '../notify'
import type { LoanProduct } from '../types'
import { useToast } from '../toast/ToastContext'

/** @deprecated Prefer importing from `../notify`. */
export { notifyPaymentSchedulesChanged }

type PendingItem = {
  loanId: number
  loanNumber: string
  customerId: number
  customerName: string
  amount: number
  flowName: string
  currentStageName: string
  status: string
  readyAt: string
  waitingHours: number
  canManage: boolean
}

type ScheduleRow = {
  id: number
  installmentNumber: number
  dueDate: string
  amountDue: number
  principalPortion: number
  interestPortion: number
  status: string
}

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function PaymentSchedulePage() {
  const { can } = useAuth()
  const { filterBranchId } = useBranchScope()
  const canManage = can('paymentSchedule.manage')
  const [items, setItems] = useState<PendingItem[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [schedule, setSchedule] = useState<ScheduleRow[]>([])
  const [products, setProducts] = useState<LoanProduct[]>([])
  const [form, setForm] = useState({
    loanProductId: 0,
    amount: '',
    interestRatePercent: '0',
    termCount: '12',
    paymentFrequency: 'Monthly',
    interestMethod: 'Flat',
    firstDueDate: '',
    notes: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [list, productList] = await Promise.all([
        api<PendingItem[]>(withBranchQuery('/api/payment-schedules/pending', filterBranchId)),
        api<LoanProduct[]>('/api/loan-products?activeOnly=true'),
      ])
      setItems(list)
      setProducts(productList)
      if (selectedId != null && !list.some((x) => x.loanId === selectedId)) {
        setSelectedId(null)
        setSchedule([])
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load payment schedules')
    } finally {
      setLoading(false)
    }
  }, [selectedId, filterBranchId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onChanged = () => void load()
    window.addEventListener('ml:payment-schedules-changed', onChanged)
    return () => window.removeEventListener('ml:payment-schedules-changed', onChanged)
  }, [load])

  const select = (item: PendingItem) => {
    setSelectedId(item.loanId)
    setSchedule([])
    setForm({
      loanProductId: 0,
      amount: String(item.amount),
      interestRatePercent: '0',
      termCount: '12',
      paymentFrequency: 'Monthly',
      interestMethod: 'Flat',
      firstDueDate: '',
      notes: '',
    })
  }

  const selected = items.find((x) => x.loanId === selectedId) ?? null

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!selected || !canManage) return
    setSaving(true)
    try {
      const result = await api<{ schedule: ScheduleRow[] }>(`/api/payment-schedules/${selected.loanId}/terms`, {
        method: 'PUT',
        body: JSON.stringify({
          loanProductId: form.loanProductId || null,
          amount: Number(form.amount),
          interestRatePercent: Number(form.interestRatePercent || 0),
          termCount: Number(form.termCount),
          paymentFrequency: form.paymentFrequency,
          interestMethod: form.interestMethod,
          firstDueDate: form.firstDueDate,
          notes: form.notes || null,
        }),
      })
      setSchedule(result.schedule ?? [])
      toast.success(`Payment schedule created for ${selected.loanNumber}.`)
      notifyPaymentSchedulesChanged()
      await load()
      setSelectedId(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save payment schedule')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Payment Schedule</h2>
          <p className="text-sm text-slate-500">
            Urgent queue — Approved-Final loans that still need a payment schedule.
          </p>
        </div>
        <ActionButton type="button" onClick={() => void load()} loading={loading} loadingText="Refreshing…">
          Refresh
        </ActionButton>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-rose-50 text-rose-900">
              <tr>
                <th className="px-4 py-3 font-medium">Urgency</th>
                <th className="px-4 py-3 font-medium">Loan</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Ready since</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 && (
                <LoadingTableRow colSpan={5} label="Loading payment schedules..." />
              )}
              {items.map((item) => {
                const active = selectedId === item.loanId
                const urgent = item.waitingHours >= 24
                return (
                  <tr
                    key={item.loanId}
                    className={`cursor-pointer border-t border-slate-100 hover:bg-rose-50/40 ${
                      active ? 'bg-rose-50' : ''
                    }`}
                    onClick={() => select(item)}
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          urgent ? 'bg-rose-600 text-white' : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {item.waitingHours < 1 ? '<1h' : `${item.waitingHours}h`}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{item.loanNumber}</td>
                    <td className="px-4 py-3">{item.customerName}</td>
                    <td className="px-4 py-3">{money(item.amount)}</td>
                    <td className="px-4 py-3 text-slate-500">{new Date(item.readyAt).toLocaleString()}</td>
                  </tr>
                )
              })}
              {!loading && items.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={5}>
                    No Approved-Final loans waiting for a payment schedule.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          {!selected ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Select an urgent loan to create its payment schedule.
            </div>
          ) : (
            <form onSubmit={onSave} className="space-y-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-slate-900">{selected.loanNumber}</h3>
                  <StatusTag status={selected.status} />
                  <StageTag stage={selected.currentStageName} />
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {selected.customerName} · {selected.flowName}
                </p>
                <p className="mt-2 text-xs font-medium text-rose-700">
                  Waiting {selected.waitingHours < 1 ? 'under an hour' : `${selected.waitingHours} hour(s)`} — create
                  schedule now.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Loan product</span>
                  <select
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                    value={form.loanProductId}
                    onChange={(e) => {
                      const id = Number(e.target.value)
                      const product = products.find((p) => p.id === id)
                      if (!product) {
                        setForm((prev) => ({ ...prev, loanProductId: 0 }))
                        return
                      }
                      setForm((prev) => ({
                        ...prev,
                        loanProductId: product.id,
                        amount: String(product.amount),
                        interestRatePercent: String(product.interestRatePercent),
                        termCount: String(product.termCount),
                        paymentFrequency: product.paymentFrequency,
                        interestMethod: product.interestMethod,
                      }))
                    }}
                    disabled={!canManage}
                  >
                    <option value={0}>None — enter terms manually</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {money(p.amount)} · {p.interestRatePercent}% · {p.termCount} {p.paymentFrequency}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Principal *</span>
                  <input
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    required
                    disabled={!canManage}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Interest % *</span>
                  <input
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.interestRatePercent}
                    onChange={(e) => setForm({ ...form, interestRatePercent: e.target.value })}
                    required
                    disabled={!canManage}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Term count *</span>
                  <input
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                    type="number"
                    min="1"
                    value={form.termCount}
                    onChange={(e) => setForm({ ...form, termCount: e.target.value })}
                    required
                    disabled={!canManage}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Frequency *</span>
                  <select
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                    value={form.paymentFrequency}
                    onChange={(e) => setForm({ ...form, paymentFrequency: e.target.value })}
                    disabled={!canManage}
                  >
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="BiWeekly">Bi-weekly</option>
                    <option value="Monthly">Monthly</option>
                  </select>
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Interest method *</span>
                  <select
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                    value={form.interestMethod}
                    onChange={(e) => setForm({ ...form, interestMethod: e.target.value })}
                    disabled={!canManage}
                  >
                    <option value="Flat">Flat interest</option>
                    <option value="DecliningBalance">Declining balance</option>
                  </select>
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-slate-500">First due date *</span>
                  <input
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                    type="date"
                    value={form.firstDueDate}
                    onChange={(e) => setForm({ ...form, firstDueDate: e.target.value })}
                    required
                    disabled={!canManage}
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Notes</span>
                  <input
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    disabled={!canManage}
                  />
                </label>
              </div>

              {canManage ? (
                <ActionButton type="submit" loading={saving} loadingText="Creating…">
                  Create payment schedule
                </ActionButton>
              ) : (
                <p className="text-sm text-slate-500">You can view this queue but cannot create schedules.</p>
              )}

              {schedule.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Due</th>
                        <th className="px-3 py-2">Amount</th>
                        <th className="px-3 py-2">Principal</th>
                        <th className="px-3 py-2">Interest</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.map((s) => (
                        <tr key={s.id} className="border-t border-slate-100">
                          <td className="px-3 py-2">{s.installmentNumber}</td>
                          <td className="px-3 py-2">{new Date(s.dueDate).toLocaleDateString()}</td>
                          <td className="px-3 py-2">{money(s.amountDue)}</td>
                          <td className="px-3 py-2">{money(s.principalPortion)}</td>
                          <td className="px-3 py-2">{money(s.interestPortion)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
