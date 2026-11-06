import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ActionButton } from '../components/ActionButton'

function NavItem({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center gap-0.5 px-2 py-2 text-xs font-medium ${
          isActive ? 'text-sky-700' : 'text-slate-500'
        }`
      }
    >
      <span className="text-sm">{label}</span>
    </NavLink>
  )
}

export function FieldAgentLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700">
              Field Agent
            </div>
            <div className="text-sm font-semibold text-slate-900">{user?.fullName}</div>
          </div>
          <ActionButton
            type="button"
            variant="light"
            className="px-3 py-1.5 text-xs"
            onClick={() => {
              logout()
              navigate('/login')
            }}
          >
            Logout
          </ActionButton>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-24">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg">
          <NavItem to="/field" label="Due" end />
          <NavItem to="/field/customers" label="Customers" />
          <NavItem to="/field/profile" label="Profile" />
        </div>
      </nav>
    </div>
  )
}
