import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useBranchScope, withBranchQuery } from '../branch/BranchContext'
import { ActionButton } from '../components/ActionButton'
import { AgentAutocomplete } from '../components/AgentAutocomplete'
import { LoadingTableRow } from '../components/ListLoading'
import { StatusTag } from '../components/StatusTag'
import type { AgentOption, CashRemittance } from '../types'
import { useToast } from '../toast/ToastContext'

const fieldClass = 'rounded-lg border border-slate-300 px-3 py-2 text-sm w-full'

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const emptyForm = () => ({
  agentUserId: '',
  remittanceDate: new Date().toISOString().slice(0, 10),
  remittedAmount: '',
  notes: '',
})

export function RemittancesPage() {
  const { can } = useAuth()
  const { filterBranchId } = useBranchScope()
  const canManage = can('remittance.manage')
  const canReceive = can('remittance.receive')

  const [rows, setRows] = useState<CashRemittance[]>([])
  const [agents, setAgents] = useState<AgentOption[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [form, setForm] = useState(emptyForm())
  const [expectedCollected, setExpectedCollected] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [receiveAmount, setReceiveAmount] = useState('')
  const [receiveNotes, setReceiveNotes] = useState('')
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [actingId, setActingId] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (agentFilter) params.set('agentUserId', agentFilter)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const qs = params.toString()
      const path = `/api/remittances${qs ? `?${qs}` : ''}`
      setRows(await api<CashRemittance[]>(withBranchQuery(path, filterBranchId)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load remittances')
    } finally {
      setLoading(false)
    }
  }

  const loadAgents = async () => {
    try {
      setAgents(await api<AgentOption[]>(withBranchQuery('/api/users/options', filterBranchId)))
    } catch {
      // options endpoint may be restricted; create form still works with typed id if needed
    }
  }

  useEffect(() => {
    void load()
    void loadAgents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBranchId])

  useEffect(() => {
    const refreshExpected = async () => {
      if (!form.agentUserId || !form.remittanceDate) {
        setExpectedCollected(null)
        return
      }
      try {
        const res = await api<{ expectedCollected: number }>(
          `/api/remittances/expected-collected?agentUserId=${encodeURIComponent(form.agentUserId)}&remittanceDate=${form.remittanceDate}`,
        )
        setExpectedCollected(res.expectedCollected)
      } catch {
        setExpectedCollected(null)
      }
    }
    void refreshExpected()
  }, [form.agentUserId, form.remittanceDate])

  const selected = rows.find((r) => r.id === selectedId) ?? null

  const selectRow = (row: CashRemittance) => {
    setSelectedId(row.id)
    setForm({
      agentUserId: row.agentUserId,
      remittanceDate: row.remittanceDate.slice(0, 10),
      remittedAmount: String(row.remittedAmount),
      notes: row.notes ?? '',
    })
    setReceiveAmount(String(row.remittedAmount))
    setReceiveNotes(row.notes ?? '')
  }

  const resetNew = () => {
    setSelectedId(null)
    setForm(emptyForm())
    setExpectedCollected(null)
    setReceiveAmount('')
    setReceiveNotes('')
  }

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!canManage) return
    setSaving(true)
    try {
      const payload = {
        agentUserId: form.agentUserId,
        remittanceDate: form.remittanceDate,
        remittedAmount: Number(form.remittedAmount) || 0,
        notes: form.notes.trim() || null,
      }
      if (selectedId == null) {
        const created = await api<CashRemittance>('/api/remittances', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        toast.success('Remittance draft created.')
        await load()
        selectRow(created)
      } else {
        const updated = await api<CashRemittance>(`/api/remittances/${selectedId}`, {
          method: 'PUT',
          body: JSON.stringify({
            remittedAmount: payload.remittedAmount,
            notes: payload.notes,
          }),
        })
        toast.success('Draft updated.')
        await load()
        selectRow(updated)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const onSubmit = async (id: number) => {
    setActingId(id)
    try {
      const updated = await api<CashRemittance>(`/api/remittances/${id}/submit`, { method: 'POST' })
      toast.success('Remittance submitted to office.')
      await load()
      selectRow(updated)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submit failed')
    } finally {
      setActingId(null)
    }
  }

  const onReceive = async (id: number) => {
    setActingId(id)
    try {
      const updated = await api<CashRemittance>(`/api/remittances/${id}/receive`, {
        method: 'POST',
        body: JSON.stringify({
          remittedAmount: receiveAmount === '' ? null : Number(receiveAmount),
          notes: receiveNotes.trim() || null,
        }),
      })
      toast.success(
        updated.status === 'Discrepancy'
          ? `Received with discrepancy (variance ${money(updated.variance)}).`
          : 'Remittance received — float balanced.',
      )
      await load()
      selectRow(updated)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Receive failed')
    } finally {
      setActingId(null)
    }
  }

  const varianceClass = (v: number) =>
    v === 0 ? 'text-emerald-700' : v > 0 ? 'text-amber-700' : 'text-rose-700'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Cash remittances</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Track cash collected by agents versus amounts remitted to the office. Variance is collected − remitted
            (positive means cash still held as float).
          </p>
        </div>
        {canManage && (
          <ActionButton type="button" onClick={resetNew}>
            New remittance
          </ActionButton>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm text-slate-600">
          Status
          <select
            className={`${fieldClass} mt-1`}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="Draft">Draft</option>
            <option value="Submitted">Submitted</option>
            <option value="Received">Received</option>
            <option value="Discrepancy">Discrepancy</option>
          </select>
        </label>
        <label className="min-w-[16rem] flex-1 text-sm text-slate-600 sm:max-w-xs">
          Agent
          <div className="mt-1">
            <AgentAutocomplete
              agents={agents}
              value={agentFilter}
              onChange={setAgentFilter}
              allowEmpty
              emptyLabel="All agents"
              placeholder="Search agent…"
            />
          </div>
        </label>
        <label className="text-sm text-slate-600">
          From
          <input type="date" className={`${fieldClass} mt-1`} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-sm text-slate-600">
          To
          <input type="date" className={`${fieldClass} mt-1`} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <ActionButton type="button" onClick={() => void load()}>
          Filter
        </ActionButton>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Agent</th>
                <th className="px-4 py-3 font-medium text-right">Collected</th>
                <th className="px-4 py-3 font-medium text-right">Remitted</th>
                <th className="px-4 py-3 font-medium text-right">Variance</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingTableRow colSpan={6} label="Loading remittances…" />
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>
                    No remittances yet.
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
                    <td className="whitespace-nowrap px-4 py-3">{row.remittanceDate.slice(0, 10)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{row.agentName}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(row.collectedAmount)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(row.remittedAmount)}</td>
                    <td className={`px-4 py-3 text-right font-medium tabular-nums ${varianceClass(row.variance)}`}>
                      {money(row.variance)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusTag status={row.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-4">
          {(canManage || selected) && (
            <form onSubmit={onSave} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-800">
                {selectedId == null ? 'New remittance' : `Remittance #${selectedId}`}
              </h3>

              <label className="block text-sm text-slate-600">
                Agent
                <div className="mt-1">
                  <AgentAutocomplete
                    agents={agents}
                    value={form.agentUserId}
                    onChange={(agentUserId) => setForm({ ...form, agentUserId })}
                    required
                    disabled={selectedId != null || !canManage}
                    placeholder="Search agent name or email…"
                  />
                </div>
              </label>

              <label className="block text-sm text-slate-600">
                Remittance date
                <input
                  type="date"
                  className={`${fieldClass} mt-1`}
                  required
                  disabled={selectedId != null || !canManage}
                  value={form.remittanceDate}
                  onChange={(e) => setForm({ ...form, remittanceDate: e.target.value })}
                />
              </label>

              {expectedCollected != null && (
                <div className="rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-900">
                  Expected collected (payments that day): <strong>{money(expectedCollected)}</strong>
                </div>
              )}

              {selected && (
                <div className="grid grid-cols-3 gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-center text-xs">
                  <div>
                    <div className="text-slate-500">Collected</div>
                    <div className="text-sm font-semibold tabular-nums">{money(selected.collectedAmount)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Remitted</div>
                    <div className="text-sm font-semibold tabular-nums">{money(selected.remittedAmount)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Variance / float</div>
                    <div className={`text-sm font-semibold tabular-nums ${varianceClass(selected.variance)}`}>
                      {money(selected.variance)}
                    </div>
                  </div>
                </div>
              )}

              <label className="block text-sm text-slate-600">
                Remitted amount
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={`${fieldClass} mt-1`}
                  required
                  disabled={!canManage || (selected != null && selected.status !== 'Draft')}
                  value={form.remittedAmount}
                  onChange={(e) => setForm({ ...form, remittedAmount: e.target.value })}
                />
              </label>

              <label className="block text-sm text-slate-600">
                Notes
                <textarea
                  className={`${fieldClass} mt-1`}
                  rows={2}
                  disabled={!canManage || (selected != null && selected.status !== 'Draft')}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>

              {canManage && (selectedId == null || selected?.status === 'Draft') && (
                <ActionButton type="submit" loading={saving} loadingText="Saving…">
                  {selectedId == null ? 'Create draft' : 'Save draft'}
                </ActionButton>
              )}

              {canManage && selected?.status === 'Draft' && (
                <ActionButton
                  type="button"
                  variant="light"
                  loading={actingId === selected.id}
                  loadingText="Submitting…"
                  onClick={() => void onSubmit(selected.id)}
                >
                  Submit to office
                </ActionButton>
              )}
            </form>
          )}

          {canReceive && selected && (selected.status === 'Submitted' || selected.status === 'Discrepancy') && (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-amber-950">Office receive</h3>
              <p className="text-xs text-amber-900/80">
                Confirm the cash turned in. If remitted differs from collected, status becomes Discrepancy.
              </p>
              <label className="block text-sm text-slate-700">
                Actual remitted
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={`${fieldClass} mt-1`}
                  value={receiveAmount}
                  onChange={(e) => setReceiveAmount(e.target.value)}
                />
              </label>
              <label className="block text-sm text-slate-700">
                Notes
                <textarea
                  className={`${fieldClass} mt-1`}
                  rows={2}
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                />
              </label>
              <ActionButton
                type="button"
                loading={actingId === selected.id}
                loadingText="Receiving…"
                onClick={() => void onReceive(selected.id)}
              >
                Mark received
              </ActionButton>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
