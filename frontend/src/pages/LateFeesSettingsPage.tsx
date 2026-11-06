import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { ActionButton } from '../components/ActionButton'
import { LoadingBlock } from '../components/ListLoading'
import type { LateFeeSettings } from '../types'

const fieldClass = 'rounded-lg border border-slate-300 px-3 py-2 text-sm w-full'

export function LateFeesSettingsPage() {
  const { can } = useAuth()
  const canManage = can('lateFees.settings')
  const [form, setForm] = useState({
    isEnabled: false,
    type: 'FlatPerDay',
    amount: '10',
    percent: '1',
    graceDays: '0',
    maxPerInstallment: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const s = await api<LateFeeSettings>('/api/late-fees/settings')
      setForm({
        isEnabled: s.isEnabled,
        type: s.type,
        amount: String(s.amount),
        percent: String(s.percent),
        graceDays: String(s.graceDays),
        maxPerInstallment: s.maxPerInstallment != null ? String(s.maxPerInstallment) : '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load late fee settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!canManage) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const saved = await api<LateFeeSettings>('/api/late-fees/settings', {
        method: 'PUT',
        body: JSON.stringify({
          isEnabled: form.isEnabled,
          type: form.type,
          amount: Number(form.amount) || 0,
          percent: Number(form.percent) || 0,
          graceDays: Number(form.graceDays) || 0,
          maxPerInstallment: form.maxPerInstallment === '' ? null : Number(form.maxPerInstallment),
        }),
      })
      setForm({
        isEnabled: saved.isEnabled,
        type: saved.type,
        amount: String(saved.amount),
        percent: String(saved.percent),
        graceDays: String(saved.graceDays),
        maxPerInstallment: saved.maxPerInstallment != null ? String(saved.maxPerInstallment) : '',
      })
      setMessage(saved.isEnabled ? 'Late fees enabled and saved.' : 'Late fees disabled and saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white">
        <LoadingBlock label="Loading late fee settings…" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Late fees / penalties</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Rules applied to overdue installments. Fees recalculate from due date (after grace days) and add to the
          amount collectors must recover.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {message && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <form onSubmit={onSave} className="max-w-xl space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <input
            type="checkbox"
            checked={form.isEnabled}
            disabled={!canManage}
            onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })}
          />
          Enable late fees
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">Charge type</span>
          <select
            className={fieldClass}
            value={form.type}
            disabled={!canManage}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            <option value="FlatOnce">Flat once (after grace)</option>
            <option value="FlatPerDay">Flat amount per day</option>
            <option value="PercentOfInstallmentPerDay">% of installment per day</option>
          </select>
        </label>

        {(form.type === 'FlatOnce' || form.type === 'FlatPerDay') && (
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">Amount</span>
            <input
              className={fieldClass}
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              disabled={!canManage}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </label>
        )}

        {form.type === 'PercentOfInstallmentPerDay' && (
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">Percent per day</span>
            <input
              className={fieldClass}
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.percent}
              disabled={!canManage}
              onChange={(e) => setForm({ ...form, percent: e.target.value })}
            />
          </label>
        )}

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">Grace days</span>
          <input
            className={fieldClass}
            type="number"
            min="0"
            step="1"
            value={form.graceDays}
            disabled={!canManage}
            onChange={(e) => setForm({ ...form, graceDays: e.target.value })}
          />
          <span className="mt-1 block text-xs text-slate-500">Days after due date before fees start.</span>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">Max per installment (optional)</span>
          <input
            className={fieldClass}
            type="number"
            min="0"
            step="0.01"
            placeholder="No cap"
            value={form.maxPerInstallment}
            disabled={!canManage}
            onChange={(e) => setForm({ ...form, maxPerInstallment: e.target.value })}
          />
        </label>

        {canManage && (
          <ActionButton type="submit" loading={saving} loadingText="Saving…">
            Save settings
          </ActionButton>
        )}
      </form>
    </div>
  )
}
