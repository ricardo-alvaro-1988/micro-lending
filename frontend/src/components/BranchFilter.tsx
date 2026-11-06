import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useBranchScope } from '../branch/BranchContext'
import type { Branch } from '../types'

let branchesCache: Branch[] | null = null
let branchesInflight: Promise<Branch[]> | null = null

function loadBranchesOnce() {
  if (branchesCache) return Promise.resolve(branchesCache)
  if (!branchesInflight) {
    branchesInflight = api<Branch[]>('/api/branches?activeOnly=true')
      .then((list) => {
        branchesCache = list
        return list
      })
      .finally(() => {
        branchesInflight = null
      })
  }
  return branchesInflight
}

export function BranchFilter({ className = '' }: { className?: string }) {
  const { isAdmin, filterBranchId, setFilterBranchId, userBranchName } = useBranchScope()
  const [branches, setBranches] = useState<Branch[]>(branchesCache ?? [])

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false
    loadBranchesOnce()
      .then((list) => {
        if (!cancelled) setBranches(list)
      })
      .catch(() => {
        if (!cancelled) setBranches([])
      })
    return () => {
      cancelled = true
    }
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <div className={`rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 ${className}`}>
        Branch: <span className="font-semibold text-slate-800">{userBranchName || 'Not assigned'}</span>
      </div>
    )
  }

  return (
    <label className={`flex items-center gap-2 text-sm text-slate-600 ${className}`}>
      <span className="whitespace-nowrap text-xs font-medium uppercase tracking-wide text-slate-500">Branch</span>
      <select
        className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
        value={filterBranchId ?? ''}
        onChange={(e) => setFilterBranchId(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">All branches</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  )
}
