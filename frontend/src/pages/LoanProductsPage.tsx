import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { ActionButton } from '../components/ActionButton'
import { LoadingTableRow } from '../components/ListLoading'
import {
  LoanChargeFields,
  LoanProceedsBreakdown,
  chargePayloadFrom,
  chargeStringsFrom,
} from '../components/LoanProceedsBreakdown'
import { ActiveTag } from '../components/StatusTag'
import { computeLoanFees, feeRuleStrings } from '../lib/loanFeeRules'
import type { LoanProduct } from '../types'
import { useToast } from '../toast/ToastContext'

const emptyForm = () => {
  const fees = feeRuleStrings(computeLoanFees(10000, 70))
  return {
    name: '',
    description: '',
    termCount: '70',
    paymentFrequency: 'Daily',
    interestMethod: 'Flat',
    applyFeeRules: true,
    isActive: true,
    ...fees,
  }
}

function applyRulesToForm(
  prev: ReturnType<typeof emptyForm>,
  overrides?: Partial<Pick<ReturnType<typeof emptyForm>, 'amount' | 'termCount'>>,
) {
  const amount = Number(overrides?.amount ?? prev.amount)
  const termCount = Number(overrides?.termCount ?? prev.termCount)
  if (!(amount > 0) || !(termCount > 0)) return { ...prev, ...overrides }
  const fees = computeLoanFees(amount, termCount)
  return {
    ...prev,
    ...overrides,
    ...feeRuleStrings(fees),
    applyFeeRules: true,
  }
}

export function LoanProductsPage() {
  const { can } = useAuth()
  const canManage = can('loanProducts.manage')
  const [products, setProducts] = useState<LoanProduct[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      setProducts(await api<LoanProduct[]>('/api/loan-products'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load loan products')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const resetNew = () => {
    setSelectedId(null)
    setForm(emptyForm())
  }

  const selectProduct = (product: LoanProduct) => {
    setSelectedId(product.id)
    setForm({
      name: product.name,
      description: product.description ?? '',
      amount: String(product.amount),
      interestRatePercent: String(product.interestRatePercent),
      termCount: String(product.termCount),
      paymentFrequency: product.paymentFrequency,
      interestMethod: product.interestMethod,
      applyFeeRules: true,
      isActive: product.isActive,
      ...chargeStringsFrom(product),
    })
  }

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        amount: Number(form.amount),
        interestRatePercent: Number(form.interestRatePercent || 0),
        termCount: Number(form.termCount),
        paymentFrequency: form.paymentFrequency,
        interestMethod: form.interestMethod,
        applyFeeRules: form.applyFeeRules,
        isActive: form.isActive,
        ...chargePayloadFrom(form),
      }
      if (selectedId == null) {
        const created = await api<LoanProduct>('/api/loan-products', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        toast.success('Loan product created.')
        await load()
        selectProduct(created)
      } else {
        const updated = await api<LoanProduct>(`/api/loan-products/${selectedId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        toast.success('Loan product updated.')
        await load()
        selectProduct(updated)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (id: number) => {
    if (!confirm('Delete this loan product?')) return
    setDeletingId(id)
    try {
      await api(`/api/loan-products/${id}`, { method: 'DELETE' })
      if (selectedId === id) resetNew()
      toast.success('Loan product deleted.')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  const interestTotal =
    Number(form.amount) > 0
      ? Math.round((Number(form.amount) * Number(form.interestRatePercent || 0)) / 100 / 10) * 10
      : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Loan Products</h2>
          <p className="text-sm text-slate-500">
            Templates with fee rules: notarial, processing, loan redemption, savings, insurance, tax, 12%
            interest (round to tens).
          </p>
        </div>
        {canManage && (
          <ActionButton type="button" onClick={resetNew}>
            New product
          </ActionButton>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingTableRow colSpan={2} label="Loading products..." />
              ) : products.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={2}>
                    No loan products yet.
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr
                    key={product.id}
                    className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${
                      selectedId === product.id ? 'bg-sky-50' : ''
                    }`}
                    onClick={() => selectProduct(product)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{product.name}</div>
                      <div className="text-xs text-slate-500">
                        {product.amount.toLocaleString()} · {product.interestRatePercent}% · {product.termCount}{' '}
                        {product.paymentFrequency} · {product.interestMethod} · {product.loanCount} loan
                        {product.loanCount === 1 ? '' : 's'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <ActiveTag active={product.isActive} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <form onSubmit={onSave} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Name *</label>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
                disabled={!canManage}
                placeholder="e.g. Daily 10,000"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Interest method *</label>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form.interestMethod}
                onChange={(e) => setForm((prev) => ({ ...prev, interestMethod: e.target.value }))}
                disabled={!canManage}
              >
                <option value="Flat">Flat</option>
                <option value="DecliningBalance">Declining balance</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Description</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              disabled={!canManage}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Amount *</label>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                type="number"
                min="0.01"
                step="10"
                value={form.amount}
                onChange={(e) => {
                  const amount = e.target.value
                  setForm((prev) =>
                    prev.applyFeeRules ? applyRulesToForm(prev, { amount }) : { ...prev, amount },
                  )
                }}
                required
                disabled={!canManage}
              />
              <p className="mt-1 text-xs text-slate-500">Rounded to nearest 10 when fee rules apply.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Interest % *</label>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                type="number"
                min="0"
                step="0.01"
                value={form.interestRatePercent}
                onChange={(e) => setForm((prev) => ({ ...prev, interestRatePercent: e.target.value }))}
                required
                disabled={!canManage || form.applyFeeRules}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Term count *</label>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                type="number"
                min="1"
                value={form.termCount}
                onChange={(e) => {
                  const termCount = e.target.value
                  setForm((prev) =>
                    prev.applyFeeRules ? applyRulesToForm(prev, { termCount }) : { ...prev, termCount },
                  )
                }}
                required
                disabled={!canManage}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Frequency *</label>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form.paymentFrequency}
                onChange={(e) => setForm((prev) => ({ ...prev, paymentFrequency: e.target.value }))}
                disabled={!canManage}
              >
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
                <option value="BiWeekly">Bi-weekly</option>
                <option value="Monthly">Monthly</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.applyFeeRules}
              onChange={(e) => {
                const applyFeeRules = e.target.checked
                setForm((prev) => (applyFeeRules ? applyRulesToForm({ ...prev, applyFeeRules }) : { ...prev, applyFeeRules }))
              }}
              disabled={!canManage}
            />
            Auto-calculate fees from principal (notarial, processing, redemption, savings, insurance, tax, 12%)
          </label>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800">Fees, savings & insurance</h3>
              {canManage && form.applyFeeRules && (
                <button
                  type="button"
                  className="text-xs font-medium text-sky-700 hover:underline"
                  onClick={() => setForm((prev) => applyRulesToForm(prev))}
                >
                  Recalculate now
                </button>
              )}
            </div>
            <LoanChargeFields
              form={form}
              setForm={setForm}
              disabled={!canManage || form.applyFeeRules}
            />
          </div>

          {Number(form.amount) > 0 && Number(form.termCount) > 0 && (
            <LoanProceedsBreakdown
              values={{
                amount: Number(form.amount),
                termCount: Number(form.termCount),
                paymentFrequency: form.paymentFrequency,
                ...chargePayloadFrom(form),
                principalPerPeriod: Number(form.amount) / Number(form.termCount),
                interestPerPeriod: interestTotal / Number(form.termCount),
              }}
            />
          )}

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              disabled={!canManage}
            />
            Active (available in loan application picker)
          </label>

          {canManage && (
            <div className="flex flex-wrap gap-3">
              <ActionButton type="submit" loading={saving} loadingText="Saving…">
                {selectedId == null ? 'Create product' : 'Save product'}
              </ActionButton>
              {selectedId != null && (
                <ActionButton
                  type="button"
                  variant="danger"
                  loading={deletingId === selectedId}
                  loadingText="Deleting…"
                  onClick={() => void onDelete(selectedId)}
                >
                  Delete
                </ActionButton>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
