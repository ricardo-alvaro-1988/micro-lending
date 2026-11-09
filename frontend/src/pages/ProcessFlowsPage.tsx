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
  approverRoleIds: string[]
  approverUserIds: string[]
  isFinal: boolean
  onApproveSortOrder: string
  onDeclineEndsLoan: boolean
  onDeclineSortOrder: string
}

const emptyStage = (order: number): StageDraft => ({
  name: '',
  sortOrder: order,
  requiresApproval: false,
  approverRoleIds: [],
  approverUserIds: [],
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
      approverRoleIds: [],
      approverUserIds: [],
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
    approverRoleIds: s.approverRoleIds,
    approverUserIds: s.approverUserIds,
    isFinal: i === stages.length - 1,
    onApproveSortOrder: s.onApproveSortOrder ? Number(s.onApproveSortOrder) : null,
    onDeclineEndsLoan: s.requiresApproval ? s.onDeclineEndsLoan : true,
    onDeclineSortOrder:
      s.requiresApproval && !s.onDeclineEndsLoan && s.onDeclineSortOrder
        ? Number(s.onDeclineSortOrder)
        : null,
  }))
}

function stageRoleIdsFromApi(s: ProcessFlow['stages'][number]): string[] {
  if (s.approverRoles?.length) return s.approverRoles.map((r) => r.roleId)
  return s.approverRoleId ? [s.approverRoleId] : []
}

function stageUserIdsFromApi(s: ProcessFlow['stages'][number]): string[] {
  if (s.approverUsers?.length) return s.approverUsers.map((u) => u.userId)
  return s.approverUserId ? [s.approverUserId] : []
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
      setUsers(u.filter((x) => !x.isDeleted && x.isActive))
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
              approverRoleIds: stageRoleIdsFromApi(s),
              approverUserIds: stageUserIdsFromApi(s),
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

  const toggleRole = (index: number, roleId: string) => {
    const stage = stages[index]
    const selected = new Set(stage.approverRoleIds)
    if (selected.has(roleId)) selected.delete(roleId)
    else selected.add(roleId)
    const nextRoleIds = [...selected]
    const allowedRoleNames = new Set(
      roles.filter((r) => nextRoleIds.includes(r.id)).map((r) => r.name),
    )
    const nextUserIds =
      nextRoleIds.length === 0
        ? []
        : stage.approverUserIds.filter((uid) => {
            const user = users.find((u) => u.id === uid)
            return user ? allowedRoleNames.has(user.role) : false
          })
    updateStage(index, { approverRoleIds: nextRoleIds, approverUserIds: nextUserIds })
  }

  const toggleUser = (index: number, userId: string) => {
    const stage = stages[index]
    const selected = new Set(stage.approverUserIds)
    if (selected.has(userId)) selected.delete(userId)
    else selected.add(userId)
    updateStage(index, { approverUserIds: [...selected] })
  }

  const usersForRoles = (roleIds: string[]) => {
    if (roleIds.length === 0) return []
    const names = new Set(roles.filter((r) => roleIds.includes(r.id)).map((r) => r.name))
    return users.filter((u) => names.has(u.role))
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
            Define approval stages. Approver roles and users can both be multiple.
          </p>
        </div>
        {canManage && (
          <ActionButton type="button" onClick={resetNew}>
            New flow
          </ActionButton>
        )}
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {message && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>
      )}

      {loading ? (
        <LoadingBlock label="Loading process flows..." />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Flow</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {flows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-slate-500" colSpan={2}>
                      No flows yet.
                    </td>
                  </tr>
                ) : (
                  flows.map((flow) => (
                    <tr
                      key={flow.id}
                      className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${
                        selectedId === flow.id ? 'bg-sky-50' : ''
                      }`}
                      onClick={() => selectFlow(flow)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{flow.name}</div>
                        <div className="text-xs text-slate-500">{flow.stages.length} stage(s)</div>
                      </td>
                      <td className="px-4 py-3">
                        <ActiveTag active={flow.isActive} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <form
            onSubmit={selectedId == null ? onCreateFlow : onSave}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm md:col-span-2">
                <span className="mb-1 block text-slate-600">Name *</span>
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
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  disabled={!canManage}
                />
                Active
              </label>
            </div>

            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Stages</h3>
              {canManage && (
                <ActionButton
                  type="button"
                  variant="light"
                  onClick={() =>
                    setStages((prev) =>
                      ensureApprovedFinalLast([...prev.slice(0, -1), emptyStage(prev.length), prev[prev.length - 1]]),
                    )
                  }
                >
                  Add stage
                </ActionButton>
              )}
            </div>

            <div className="space-y-3">
              {stages.map((stage, index) => {
                const isLast = index === stages.length - 1
                const eligibleUsers = usersForRoles(stage.approverRoleIds)
                return (
                  <div key={index} className="space-y-3 rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-700">Stage {index + 1}</div>
                      {canManage && !isLast && stages.length > 2 && (
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
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
                        Fixed final stage. Reaching <strong>Approved-Final</strong> means the loan is ready for Payment
                        Schedule.
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
                            Pick one or more roles, then optionally pick specific users from those roles.
                            If users are selected, only they can approve; otherwise anyone in the roles can.
                          </p>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-md border border-slate-200 bg-white p-3">
                            <div className="mb-2 text-sm font-medium text-slate-700">Approver roles *</div>
                            <div className="max-h-40 space-y-1.5 overflow-y-auto">
                              {roles.map((r) => (
                                <label key={r.id} className="flex items-center gap-2 text-sm text-slate-700">
                                  <input
                                    type="checkbox"
                                    checked={stage.approverRoleIds.includes(r.id)}
                                    onChange={() => toggleRole(index, r.id)}
                                    disabled={!canManage}
                                  />
                                  {r.name}
                                </label>
                              ))}
                            </div>
                            {stage.approverRoleIds.length === 0 && (
                              <p className="mt-2 text-xs text-amber-700">Select at least one role.</p>
                            )}
                          </div>

                          <div className="rounded-md border border-slate-200 bg-white p-3">
                            <div className="mb-2 text-sm font-medium text-slate-700">Approver users</div>
                            {stage.approverRoleIds.length === 0 ? (
                              <p className="text-xs text-slate-500">Select roles first to list eligible users.</p>
                            ) : eligibleUsers.length === 0 ? (
                              <p className="text-xs text-slate-500">No active users found for the selected roles.</p>
                            ) : (
                              <div className="max-h-40 space-y-1.5 overflow-y-auto">
                                {eligibleUsers.map((u) => (
                                  <label key={u.id} className="flex items-center gap-2 text-sm text-slate-700">
                                    <input
                                      type="checkbox"
                                      checked={stage.approverUserIds.includes(u.id)}
                                      onChange={() => toggleUser(index, u.id)}
                                      disabled={!canManage}
                                    />
                                    <span>
                                      {u.fullName}
                                      <span className="ml-1 text-xs text-slate-400">({u.role})</span>
                                    </span>
                                  </label>
                                ))}
                              </div>
                            )}
                            <p className="mt-2 text-xs text-slate-500">
                              Optional. Leave empty to allow any user in the selected roles.
                            </p>
                          </div>
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
                              {stageOptions
                                .filter((o) => o.value !== String(index + 1))
                                .map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
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
                                  updateStage(index, {
                                    onDeclineEndsLoan: false,
                                    onDeclineSortOrder: e.target.value,
                                  })
                                }
                              }}
                              disabled={!canManage}
                            >
                              <option value="__end__">End loan as Rejected</option>
                              {stageOptions
                                .filter((o) => o.value !== String(index + 1))
                                .map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
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
      )}
    </div>
  )
}
