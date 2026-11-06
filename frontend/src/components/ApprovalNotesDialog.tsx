import { useEffect, useState, type FormEvent } from 'react'
import { ActionButton } from './ActionButton'

type Props = {
  open: boolean
  action: 'approve' | 'reject'
  title?: string
  subtitle?: string
  busy?: boolean
  onCancel: () => void
  onConfirm: (notes: string) => void
}

export function ApprovalNotesDialog({
  open,
  action,
  title,
  subtitle,
  busy = false,
  onCancel,
  onConfirm,
}: Props) {
  const [notes, setNotes] = useState('')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (open) {
      setNotes('')
      setTouched(false)
    }
  }, [open, action])

  if (!open) return null

  const trimmed = notes.trim()
  const invalid = trimmed.length === 0
  const label = action === 'approve' ? 'Approve' : 'Reject'
  const heading = title ?? `${label} loan stage`

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (invalid || busy) return
    onConfirm(trimmed)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4" role="dialog" aria-modal="true">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-900">{heading}</h3>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        <p className="mt-3 text-sm text-slate-600">
          Approval notes are required before you can {action === 'approve' ? 'approve' : 'reject'} this stage.
        </p>
        <label className="mt-4 block text-xs font-semibold tracking-wide text-slate-500">
          Approval notes *
        </label>
        <textarea
          className={`mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
            touched && invalid
              ? 'border-rose-300 focus:ring-rose-200'
              : 'border-slate-200 focus:ring-sky-200'
          }`}
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={action === 'approve' ? 'Reason for approval…' : 'Reason for rejection…'}
          required
          autoFocus
          disabled={busy}
        />
        {touched && invalid && (
          <p className="mt-1.5 text-xs text-rose-600">Please enter approval notes to continue.</p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <ActionButton type="button" variant="light" onClick={onCancel} disabled={busy}>
            Cancel
          </ActionButton>
          <ActionButton
            type="submit"
            variant={action === 'approve' ? 'primary' : 'dark'}
            loading={busy}
            loadingText="Submitting…"
            disabled={invalid}
            className={action === 'reject' ? '!bg-rose-600 hover:!bg-rose-700' : undefined}
          >
            {label}
          </ActionButton>
        </div>
      </form>
    </div>
  )
}
