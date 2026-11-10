import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { ActionButton } from '../components/ActionButton'
import { LoadingBlock } from '../components/ListLoading'
import type { AppPage, RolePageAccess } from '../types'

function sameCodes(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((c) => set.has(c))
}

export function PageAccessibilityPage() {
  const { can } = useAuth()
  const canManage = can('pages.manage')
  const [pages, setPages] = useState<AppPage[]>([])
  const [access, setAccess] = useState<RolePageAccess[]>([])
  const [baseline, setBaseline] = useState<Record<string, string[]>>({})
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [p, a] = await Promise.all([
        api<AppPage[]>('/api/pages'),
        api<RolePageAccess[]>('/api/pages/access'),
      ])
      setPages(p)
      setAccess(a)
      const nextBaseline: Record<string, string[]> = {}
      for (const row of a) nextBaseline[row.roleId] = [...row.pageCodes]
      setBaseline(nextBaseline)
      setSelectedRoleId((prev) => prev ?? a[0]?.roleId ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const selected = access.find((r) => r.roleId === selectedRoleId) ?? null
  const selectedCodes = selected?.pageCodes ?? []
  const dirty =
    !!selected && !sameCodes(selectedCodes, baseline[selected.roleId] ?? [])

  const filteredPages = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return pages
    return pages.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.path.toLowerCase().includes(term) ||
        p.groupName.toLowerCase().includes(term) ||
        p.code.toLowerCase().includes(term),
    )
  }, [pages, query])

  const groups = useMemo(() => {
    const map = new Map<string, AppPage[]>()
    for (const page of filteredPages) {
      const list = map.get(page.groupName) ?? []
      list.push(page)
      map.set(page.groupName, list)
    }
    return [...map.entries()].map(([name, items]) => ({
      name,
      items: items.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    }))
  }, [filteredPages])

  const toggle = (pageCode: string) => {
    if (!selectedRoleId || !canManage) return
    setMessage('')
    setAccess((prev) =>
      prev.map((row) => {
        if (row.roleId !== selectedRoleId) return row
        const has = row.pageCodes.includes(pageCode)
        return {
          ...row,
          pageCodes: has ? row.pageCodes.filter((c) => c !== pageCode) : [...row.pageCodes, pageCode],
        }
      }),
    )
  }

  const setGroup = (groupPages: AppPage[], enabled: boolean) => {
    if (!selectedRoleId || !canManage) return
    const codes = groupPages.map((p) => p.code)
    setMessage('')
    setAccess((prev) =>
      prev.map((row) => {
        if (row.roleId !== selectedRoleId) return row
        const keep = row.pageCodes.filter((c) => !codes.includes(c))
        return {
          ...row,
          pageCodes: enabled ? [...keep, ...codes] : keep,
        }
      }),
    )
  }

  const setAllFiltered = (enabled: boolean) => {
    if (!selectedRoleId || !canManage) return
    const codes = filteredPages.map((p) => p.code)
    setMessage('')
    setAccess((prev) =>
      prev.map((row) => {
        if (row.roleId !== selectedRoleId) return row
        const keep = row.pageCodes.filter((c) => !codes.includes(c))
        return {
          ...row,
          pageCodes: enabled ? [...keep, ...codes] : keep,
        }
      }),
    )
  }

  const discard = () => {
    if (!selected) return
    const original = baseline[selected.roleId] ?? []
    setAccess((prev) =>
      prev.map((row) => (row.roleId === selected.roleId ? { ...row, pageCodes: [...original] } : row)),
    )
    setMessage('')
  }

  const save = async () => {
    if (!selected) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const updated = await api<RolePageAccess>(`/api/pages/access/${selected.roleId}`, {
        method: 'PUT',
        body: JSON.stringify({ pageCodes: selected.pageCodes }),
      })
      setAccess((prev) => prev.map((r) => (r.roleId === selected.roleId ? updated : r)))
      setBaseline((prev) => ({ ...prev, [selected.roleId]: [...updated.pageCodes] }))
      setMessage(`Saved page access for ${updated.roleName}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const selectRole = (roleId: string) => {
    if (dirty && !confirm('You have unsaved changes for this role. Switch anyway?')) return
    if (dirty && selected) discard()
    setSelectedRoleId(roleId)
    setMessage('')
    setQuery('')
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Page Accessibility</h2>
        <p className="text-sm text-slate-500">
          Pick a role, then turn pages on or off. Changes apply when you save that role.
        </p>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {message && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </div>
      )}

      {loading && access.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white">
          <LoadingBlock label="Loading page access…" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Roles
            </div>
            <ul className="max-h-[70vh] overflow-auto p-2">
              {access.map((row) => {
                const active = row.roleId === selectedRoleId
                const count = row.pageCodes.length
                const roleDirty =
                  active && !sameCodes(row.pageCodes, baseline[row.roleId] ?? [])
                return (
                  <li key={row.roleId}>
                    <button
                      type="button"
                      onClick={() => selectRole(row.roleId)}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                        active
                          ? 'bg-[#0f2744] text-white'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">{row.roleName}</span>
                      <span
                        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] tabular-nums ${
                          active ? 'bg-white/15 text-sky-100' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {count}
                      </span>
                      {roleDirty && (
                        <span className={`h-2 w-2 shrink-0 rounded-full ${active ? 'bg-amber-300' : 'bg-amber-500'}`} />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </aside>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {!selected ? (
              <div className="px-5 py-16 text-center text-sm text-slate-500">Select a role to manage pages.</div>
            ) : (
              <>
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-5 py-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{selected.roleName}</h3>
                    <p className="text-sm text-slate-500">
                      {selectedCodes.length} of {pages.length} pages enabled
                      {dirty ? ' · unsaved changes' : ''}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        disabled={saving || filteredPages.length === 0}
                        onClick={() => setAllFiltered(true)}
                      >
                        Enable listed
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        disabled={saving || filteredPages.length === 0}
                        onClick={() => setAllFiltered(false)}
                      >
                        Disable listed
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        disabled={!dirty || saving}
                        onClick={discard}
                      >
                        Discard
                      </button>
                      <ActionButton
                        type="button"
                        loading={saving}
                        loadingText="Saving…"
                        disabled={!dirty}
                        onClick={() => void save()}
                        className="px-3 py-1.5 text-sm"
                      >
                        Save role
                      </ActionButton>
                    </div>
                  )}
                </div>

                <div className="border-b border-slate-100 px-5 py-3">
                  <input
                    className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Search pages by name, path, or group…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>

                <div className="max-h-[62vh] space-y-5 overflow-auto px-5 py-4">
                  {groups.length === 0 ? (
                    <div className="py-10 text-center text-sm text-slate-500">No pages match your search.</div>
                  ) : (
                    groups.map((group) => {
                      const enabledCount = group.items.filter((p) => selectedCodes.includes(p.code)).length
                      const allOn = enabledCount === group.items.length
                      const noneOn = enabledCount === 0
                      return (
                        <div key={group.name}>
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              {group.name}
                              <span className="ml-2 font-normal normal-case tracking-normal text-slate-400">
                                {enabledCount}/{group.items.length}
                              </span>
                            </div>
                            {canManage && (
                              <div className="flex gap-2 text-xs">
                                <button
                                  type="button"
                                  className="text-sky-700 hover:underline disabled:opacity-40"
                                  disabled={saving || allOn}
                                  onClick={() => setGroup(group.items, true)}
                                >
                                  All
                                </button>
                                <button
                                  type="button"
                                  className="text-slate-500 hover:underline disabled:opacity-40"
                                  disabled={saving || noneOn}
                                  onClick={() => setGroup(group.items, false)}
                                >
                                  None
                                </button>
                              </div>
                            )}
                          </div>
                          <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
                            {group.items.map((page) => {
                              const checked = selectedCodes.includes(page.code)
                              return (
                                <li key={page.code}>
                                  <label
                                    className={`flex cursor-pointer items-start gap-3 px-3 py-2.5 transition ${
                                      checked ? 'bg-sky-50/60' : 'bg-white hover:bg-slate-50'
                                    } ${!canManage ? 'cursor-default' : ''}`}
                                  >
                                    <input
                                      type="checkbox"
                                      className="mt-1 h-4 w-4 accent-sky-700"
                                      disabled={!canManage || saving}
                                      checked={checked}
                                      onChange={() => toggle(page.code)}
                                    />
                                    <span className="min-w-0 flex-1">
                                      <span className="block text-sm font-medium text-slate-900">{page.name}</span>
                                      <span className="block truncate text-xs text-slate-500">{page.path}</span>
                                    </span>
                                  </label>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )
                    })
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
