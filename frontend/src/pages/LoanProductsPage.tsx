import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { ActionButton } from '../components/ActionButton'
import { LoadingTableRow } from '../components/ListLoading'
import { ActiveTag } from '../components/StatusTag'
import type { LoanProduct } from '../types'

const emptyForm = () => ({
  name: '',
  description: '',
  amount: '',
  interestRatePercent: '0',
  termCount: '12',
  paymentFrequency: 'Monthly',
  interestMethod: 'Flat',
  isActive: true,
})

export function LoanProductsPage() {
  const { can } = useAuth()
  const canManage = can('loanProducts.manage')
  const [products, setProducts] = useState<LoanProduct[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      setProducts(await api<LoanProduct[]>('/api/loan-products'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load loan products')
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
    setMessage('')
    setError('')
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
      isActive: product.isActive,
    })
    setMessage('')
    setError('')
  }

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        amount: Number(form.amount),
        interestRatePercent: Number(form.interestRatePercent || 0),
        termCount: Number(form.termCount),
        paymentFrequency: form.paymentFrequency,
        interestMethod: form.interestMethod,
        isActive: form.isActive,
      }
      if (selectedId == null) {
        const created = await api<LoanProduct>('/api/loan-products', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        setMessage('Loan product created.')
        await load()
        selectProduct(created)
      } else {
        const updated = await api<LoanProduct>(`/api/loan-products/${selectedId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        setMessage('Loan product updated.')
        await load()
        selectProduct(updated)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (id: number) => {
    if (!confirm('Delete this loan product?')) return
    setDeletingId(id)
    setError('')
    try {
      await api(`/api/loan-products/${id}`, { method: 'DELETE' })
      if (selectedId === id) resetNew()
      setMessage('Loan product deleted.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Loan Products</h2>
          <p className="text-sm text-slate-500">
            Reusable templates for amount, rate, term, frequency, and interest method.
          </p>
        </div>
        {canManage && (
          <ActionButton type="button" onClick={resetNew}>
            New product
          </ActionButton>
        )}
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {message && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>
      )}

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
                placeholder="e.g. Weekly 10,000 flat"
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
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                required
                disabled={!canManage}
              />
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
                disabled={!canManage}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Term count *</label>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                type="number"
                min="1"
                value={form.termCount}
                onChange={(e) => setForm((prev) => ({ ...prev, termCount: e.target.value }))}
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
