import type { ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { IconCustomer, IconLogout, IconProfile, IconSchedule } from '../components/Icons'

function initials(name?: string | null) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'A'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function NavItem({
  to,
  label,
  icon,
  end,
}: {
  to: string
  label: string
  icon: ReactNode
  end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `group relative flex flex-1 flex-col items-center gap-1 px-2 py-2.5 transition ${
          isActive ? 'text-teal-800' : 'text-slate-500 hover:text-slate-700'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-2xl transition duration-200 ${
              isActive
                ? 'scale-105 bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-md shadow-teal-600/25'
                : 'bg-slate-100/80 text-slate-500 group-hover:bg-slate-200/80'
            }`}
          >
            {icon}
          </span>
          <span className={`text-[11px] font-semibold tracking-wide ${isActive ? 'text-teal-800' : ''}`}>
            {label}
          </span>
          <span
            className={`absolute inset-x-6 bottom-1 h-0.5 rounded-full transition ${
              isActive ? 'bg-teal-500 opacity-100' : 'opacity-0'
            }`}
          />
        </>
      )}
    </NavLink>
  )
}

export function FieldAgentLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="field-shell relative flex min-h-screen flex-col">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-16 top-0 h-56 w-56 rounded-full bg-teal-300/25 blur-3xl" />
        <div className="absolute -right-10 top-24 h-48 w-48 rounded-full bg-cyan-200/30 blur-3xl" />
        <div className="absolute bottom-24 left-1/3 h-40 w-40 rounded-full bg-emerald-200/20 blur-3xl" />
      </div>

      <header className="sticky top-0 z-10 border-b border-white/50 bg-white/80 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0f3d3e] to-teal-700 text-sm font-bold text-teal-50 shadow-sm">
              {initials(user?.fullName)}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-700">Field Collect</div>
              <div className="truncate text-sm font-semibold text-slate-900">{user?.fullName}</div>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800"
            onClick={() => {
              logout()
              navigate('/login')
            }}
          >
            <IconLogout className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </header>

      <main className="relative z-[1] mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-28">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        <div className="mx-auto max-w-lg overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 shadow-[0_12px_40px_-16px_rgba(15,61,62,0.45)] backdrop-blur-md">
          <div className="flex">
            <NavItem to="/field" label="Due" end icon={<IconSchedule className="h-5 w-5" />} />
            <NavItem to="/field/customers" label="Customers" icon={<IconCustomer className="h-5 w-5" />} />
            <NavItem to="/field/profile" label="Profile" icon={<IconProfile className="h-5 w-5" />} />
          </div>
        </div>
      </nav>
    </div>
  )
}
