import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { ActionButton } from '../components/ActionButton'
import { LoadingBlock } from '../components/ListLoading'
import type { AgentOption } from '../types'
import { useToast } from '../toast/ToastContext'

type Assignee = {
  userId: string
  fullName: string
  email: string
}

export function PaymentScheduleSettingsPage() {
  const { can } = useAuth()
  const canManage = can('paymentSchedule.settings')
  const [users, setUsers] = useState<AgentOption[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [options, assignees] = await Promise.all([
        api<AgentOption[]>('/api/users/options'),
        api<Assignee[]>('/api/payment-schedules/assignees'),
      ])
      setUsers(options)
      setSelected(assignees.map((a) => a.userId))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const toggle = (userId: string) => {
    setSelected((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    )
  }

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!canManage) return
    setSaving(true)
    try {
      const saved = await api<Assignee[]>('/api/payment-schedules/assignees', {
        method: 'PUT',
        body: JSON.stringify({ userIds: selected }),
      })
      setSelected(saved.map((a) => a.userId))
      toast.success(
        saved.length === 0
          ? 'No users assigned. Approved-Final loans will not notify anyone.'
          : `${saved.length} user${saved.length === 1 ? '' : 's'} will be notified for Approved-Final payment schedules.`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Payment Schedule Notify</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          When a loan reaches <strong>Approved-Final</strong>, assigned users are notified urgently to create the
          payment schedule under Transaction → Payment Schedule. You can assign multiple users.
        </p>
      </div>

      <form onSubmit={onSave} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Assigned users</h3>
            <p className="text-xs text-slate-500">{selected.length} selected</p>
          </div>
          {canManage && (
            <ActionButton type="submit" loading={saving} loadingText="Saving…">
              Save assignees
            </ActionButton>
          )}
        </div>

        {loading ? (
          <LoadingBlock label="Loading users..." compact />
        ) : (
          <div className="max-h-[28rem] space-y-1 overflow-auto rounded-lg border border-slate-100 p-2">
            {users.map((u) => {
              const checked = selected.includes(u.id)
              return (
                <label
                  key={u.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${
                    checked ? 'border-sky-200 bg-sky-50' : 'border-transparent hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(u.id)}
                    disabled={!canManage}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-slate-900">{u.fullName}</span>
                    <span className="block truncate text-xs text-slate-500">{u.email}</span>
                  </span>
                </label>
              )
            })}
            {users.length === 0 && (
              <div className="px-3 py-6 text-sm text-slate-500">No active users available.</div>
            )}
          </div>
        )}
      </form>
    </div>
  )
}
