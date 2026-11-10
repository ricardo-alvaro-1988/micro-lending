import { useEffect, useMemo, useRef, useState } from 'react'
import { UserAvatar } from './UserAvatar'
import type { AgentOption } from '../types'

type Props = {
  agents: AgentOption[]
  value: string
  onChange: (agentUserId: string) => void
  disabled?: boolean
  required?: boolean
  allowEmpty?: boolean
  emptyLabel?: string
  placeholder?: string
  className?: string
}

export function AgentAutocomplete({
  agents,
  value,
  onChange,
  disabled,
  required,
  allowEmpty,
  emptyLabel = 'All agents',
  placeholder = 'Type agent name or email…',
  className = '',
}: Props) {
  const selected = agents.find((a) => a.id === value) ?? null
  const [query, setQuery] = useState(selected?.fullName ?? '')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setQuery(selected?.fullName ?? (value ? query : ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, selected?.fullName])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return agents.slice(0, 12)
    return agents
      .filter(
        (a) =>
          a.fullName.toLowerCase().includes(term) ||
          a.email.toLowerCase().includes(term),
      )
      .slice(0, 12)
  }, [agents, query])

  const pick = (agent: AgentOption) => {
    onChange(agent.id)
    setQuery(agent.fullName)
    setOpen(false)
  }

  const clear = () => {
    onChange('')
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <div className="flex gap-2">
        {selected && (
          <UserAvatar
            userId={selected.id}
            hasPicture={selected.hasProfilePicture}
            name={selected.fullName}
            className="mt-0.5 h-9 w-9 shrink-0 rounded-full text-[10px]"
            textClassName="bg-[#0f2744] text-sky-100"
          />
        )}
        <input
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder={placeholder}
          value={query}
          disabled={disabled}
          required={required && !value}
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value)
            if (value) onChange('')
            setOpen(true)
          }}
          onFocus={() => {
            if (!disabled) setOpen(true)
          }}
        />
        {(value || query) && !disabled && (
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            onClick={clear}
          >
            Clear
          </button>
        )}
      </div>

      {open && !disabled && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {allowEmpty && (
            <li>
              <button
                type="button"
                className="flex w-full px-3 py-2 text-left text-sm text-slate-600 hover:bg-sky-50"
                onClick={clear}
              >
                {emptyLabel}
              </button>
            </li>
          )}
          {filtered.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-sky-50"
                onClick={() => pick(a)}
              >
                <UserAvatar
                  userId={a.id}
                  hasPicture={a.hasProfilePicture}
                  name={a.fullName}
                  className="h-9 w-9 shrink-0 rounded-full text-[10px]"
                  textClassName="bg-slate-200 text-slate-700"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">{a.fullName}</span>
                  <span className="block truncate text-xs text-slate-500">{a.email}</span>
                </span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500">No agents matched.</li>
          )}
        </ul>
      )}
    </div>
  )
}
