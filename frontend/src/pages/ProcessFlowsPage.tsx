import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { ActionButton } from '../components/ActionButton'
import { LoadingBlock } from '../components/ListLoading'
import { ActiveTag } from '../components/StatusTag'
import type { AppUser, ProcessFlow, Role } from '../types'

type StageDraft = {
  name: string
  sortOrder: number
  requiresApproval: boolean
  approverRoleId: string
  approverUserId: string
  isFinal: boolean
  onApproveSortOrder: string
  onDeclineEndsLoan: boolean
  onDeclineSortOrder: string
}

const emptyStage = (order: number): StageDraft => ({
  name: '',
  sortOrder: order,
  requiresApproval: false,
  approverRoleId: '',
  approverUserId: '',
  isFinal: false,
  onApproveSortOrder: '',
  onDeclineEndsLoan: true,
  onDeclineSortOrder: '',
})

function ensureApprovedFinalLast(stages: StageDraft[]): StageDraft[] {
  if (stages.length === 0) return [{ ...emptyStage(1), name: 'Approved-Final', isFinal: true }]
  return stages.map((s, i) => {
    const isLast = i === stages.length - 1
    if (!isLast) return { ...s, sortOrder: i + 1, isFinal: false }
    return {
      ...s,
      name: 'Approved-Final',
      sortOrder: i + 1,
      requiresApproval: false,
      approverRoleId: '',
      approverUserId: '',
      isFinal: true,
      onApproveSortOrder: '',
      onDeclineEndsLoan: true,
      onDeclineSortOrder: '',
    }
  })
}

function toPayload(stages: StageDraft[]) {
  return ensureApprovedFinalLast(stages).map((s, i) => ({
    name: s.name,
    sortOrder: i + 1,
    requiresApproval: s.requiresApproval,
    approverRoleId: s.approverRoleId || null,
    approverUserId: s.approverUserId || null,
    isFinal: i === stages.length - 1,
    onApproveSortOrder: s.onApproveSortOrder ? Number(s.onApproveSortOrder) : null,
    onDeclineEndsLoan: s.requiresApproval ? s.onDeclineEndsLoan : true,
    onDeclineSortOrder:
      s.requiresApproval && !s.onDeclineEndsLoan && s.onDeclineSortOrder
        ? Number(s.onDeclineSortOrder)
        : null,
  }))
}

export function ProcessFlowsPage() {
  const { can } = useAuth()
  const canManage = can('flows.manage')
  const [flows, setFlows] = useState<ProcessFlow[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [stages, setStages] = useState<StageDraft[]>(() =>
    ensureApprovedFinalLast([emptyStage(1), emptyStage(2)]),
  )
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [f, r, u] = await Promise.all([
        api<ProcessFlow[]>('/api/flows'),
        api<Role[]>('/api/roles'),
        api<AppUser[]>('/api/users'),
      ])
      setFlows(f)
      setRoles(r)
      setUsers(u)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
  }, [])

  const selectFlow = (flow: ProcessFlow) => {
    setSelectedId(flow.id)
    setName(flow.name)
    setDescription(flow.description ?? '')
    setIsActive(flow.isActive)
    setStages(
      ensureApprovedFinalLast(
        flow.stages.length
          ? flow.stages.map((s) => ({
              name: s.name,
              sortOrder: s.sortOrder,
              requiresApproval: s.requiresApproval,
              approverRoleId: s.approverRoleId ?? '',
              approverUserId: s.approverUserId ?? '',
              isFinal: s.isFinal,
              onApproveSortOrder: s.onApproveSortOrder?.toString() ?? '',
              onDeclineEndsLoan: s.onDeclineEndsLoan,
              onDeclineSortOrder: s.onDeclineSortOrder?.toString() ?? '',
            }))
          : [emptyStage(1)],
      ),
    )
    setMessage('')
    setError('')
  }

  const resetNew = () => {
    setSelectedId(null)
    setName('')
    setDescription('')
    setIsActive(true)
    setStages(ensureApprovedFinalLast([emptyStage(1), emptyStage(2)]))
    setMessage('')
    setError('')
  }

  const onCreateFlow = async (e: FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError('')
    try {
      const created = await api<ProcessFlow>('/api/flows', {
        method: 'POST',
        body: JSON.stringify({ name, description, isActive }),
      })
      await api(`/api/flows/${created.id}/stages`, {
        method: 'PUT',
        body: JSON.stringify({ stages: toPayload(stages) }),
      })
      setMessage('Process flow created.')
      await load()
      const refreshed = await api<ProcessFlow>(`/api/flows/${created.id}`)
      selectFlow(refreshed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setCreating(false)
    }
  }

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    if (selectedId == null) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await api(`/api/flows/${selectedId}`, {
        method: 'PUT',
        body: JSON.stringify({ name, description, isActive }),
      })
      await api(`/api/flows/${selectedId}/stages`, {
        method: 'PUT',
        body: JSON.stringify({ stages: toPayload(stages) }),
      })
      setMessage('Process flow saved.')
      await load()
      const refreshed = await api<ProcessFlow>(`/api/flows/${selectedId}`)
      selectFlow(refreshed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const updateStage = (index: number, patch: Partial<StageDraft>) => {
    setStages((prev) =>
      ensureApprovedFinalLast(prev.map((s, i) => (i === index ? { ...s, ...patch } : s))),
    )
  }

  const stageOptions = stages.map((s, i) => ({
    value: String(i + 1),
    label: `Stage ${i + 1}${s.name ? `: ${s.name}` : ''}`,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Process Flows</h2>
          <p className="text-sm text-slate-500">
            Build stages with approve/decline routing conditions.
          </p>
        </div>
        {canManage && (
          <ActionButton type="button" onClick={resetNew}>
            New flow
          </ActionButton>
        )}
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-600">Flows</div>
          <div className="divide-y divide-slate-100">
            {loading && flows.length === 0 ? (
              <LoadingBlock label="Loading flows..." compact />
            ) : (
              <>
                {flows.map((flow) => (
                  <button
                    key={flow.id}
                    type="button"
                    onClick={() => selectFlow(flow)}
                    className={`block w-full px-4 py-3 text-left text-sm hover:bg-slate-50 ${
                      selectedId === flow.id ? 'bg-sky-50 text-sky-900' : ''
                    }`}
                  >
                    <div className="font-medium">{flow.name}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{flow.stages.length} stages</span>
                      <ActiveTag active={flow.isActive} />
                    </div>
                  </button>
                ))}
                {!loading && flows.length === 0 && (
                  <div className="px-4 py-6 text-sm text-slate-500">No flows yet.</div>
                )}
              </>
            )}
          </div>
        </div>

        <form
          onSubmit={selectedId == null ? onCreateFlow : onSave}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm md:col-span-2">
              <span className="mb-1 block text-slate-600">Flow name</span>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={!canManage}
              />
            </label>
            <label className="block text-sm md:col-span-2">
              <span className="mb-1 block text-slate-600">Description</span>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!canManage}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} disabled={!canManage} />
              Active
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Stages</h3>
              {canManage && (
                <button
                  type="button"
                  className="text-sm text-sky-700 hover:underline"
                  onClick={() =>
                    setStages((prev) =>
                      ensureApprovedFinalLast([...prev.slice(0, -1), emptyStage(prev.length), prev[prev.length - 1]]),
                    )
                  }
                >
                  Add stage
                </button>
              )}
            </div>

            {stages.map((stage, index) => {
              const isLast = index === stages.length - 1
              return (
              <div key={index} className={`space-y-2 rounded-lg border p-3 ${isLast ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Stage {index + 1}{isLast ? ' · Approved-Final' : ''}
                  </span>
                  {canManage && stages.length > 1 && !isLast && (
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline"
                      onClick={() =>
                        setStages((prev) => ensureApprovedFinalLast(prev.filter((_, i) => i !== index)))
                      }
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  placeholder="Stage name"
                  value={stage.name}
                  onChange={(e) => updateStage(index, { name: e.target.value })}
                  required
                  disabled={!canManage || isLast}
                />
                {!isLast && (
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={stage.requiresApproval}
                    onChange={(e) => updateStage(index, { requiresApproval: e.target.checked })}
                    disabled={!canManage}
                  />
                  This stage needs a decision (Approve / Decline)
                </label>
                )}

                {isLast && (
                  <p className="text-xs text-emerald-800">
                    Fixed final stage. Reaching <strong>Approved-Final</strong> means the loan is ready for Payment Schedule.
                  </p>
                )}

                {!isLast && !stage.requiresApproval && (
                  <p className="text-xs text-slate-500">
                    No decision here — staff just clicks <strong>Move next</strong> on the loan.
                  </p>
                )}

                {!isLast && stage.requiresApproval && (
                  <div className="space-y-3 rounded-lg border-2 border-amber-300 bg-amber-50 p-3">
                    <div>
                      <div className="text-sm font-semibold text-amber-900">Decision setup</div>
                      <p className="text-xs text-amber-800/80">
                        Who decides, and what happens after Approve or Decline.
                      </p>
                    </div>

                    <div className="grid gap-2 md:grid-cols-2">
                      <label className="block text-sm">
                        <span className="mb-1 block text-slate-700">Approver role</span>
                        <select
                          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                          value={stage.approverRoleId}
                          onChange={(e) => updateStage(index, { approverRoleId: e.target.value })}
                          disabled={!canManage}
                        >
                          <option value="">None</option>
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block text-slate-700">Approver user</span>
                        <select
                          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                          value={stage.approverUserId}
                          onChange={(e) => updateStage(index, { approverUserId: e.target.value })}
                          disabled={!canManage}
                        >
                          <option value="">None</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>{u.fullName}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm">
                        <span className="mb-1 block font-semibold text-emerald-800">If APPROVED → go to</span>
                        <select
                          className="w-full rounded-md border border-emerald-300 bg-white px-3 py-2"
                          value={stage.onApproveSortOrder}
                          onChange={(e) => updateStage(index, { onApproveSortOrder: e.target.value })}
                          disabled={!canManage}
                        >
                          <option value="">Next stage (default)</option>
                          {stageOptions.filter((o) => o.value !== String(index + 1)).map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </label>

                      <label className="block rounded-md border border-red-200 bg-red-50 p-3 text-sm">
                        <span className="mb-1 block font-semibold text-red-800">If DECLINED → go to</span>
                        <select
                          className="w-full rounded-md border border-red-300 bg-white px-3 py-2"
                          value={stage.onDeclineEndsLoan ? '__end__' : stage.onDeclineSortOrder}
                          onChange={(e) => {
                            if (e.target.value === '__end__') {
                              updateStage(index, { onDeclineEndsLoan: true, onDeclineSortOrder: '' })
                            } else {
                              updateStage(index, { onDeclineEndsLoan: false, onDeclineSortOrder: e.target.value })
                            }
                          }}
                          disabled={!canManage}
                        >
                          <option value="__end__">End loan as Rejected</option>
                          {stageOptions.filter((o) => o.value !== String(index + 1)).map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                )}

              </div>
            )})}
          </div>

          {canManage && (
            <ActionButton
              type="submit"
              loading={selectedId == null ? creating : saving}
              loadingText={selectedId == null ? 'Creating…' : 'Saving…'}
            >
              {selectedId == null ? 'Create flow' : 'Save flow'}
            </ActionButton>
          )}
        </form>
      </div>
    </div>
  )
}
