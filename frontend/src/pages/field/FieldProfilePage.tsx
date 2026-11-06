import { ProfilePage } from '../ProfilePage'

/** Reuse office profile form inside the field shell. */
export function FieldProfilePage() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <ProfilePage />
    </div>
  )
}
