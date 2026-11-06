import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api, apiForm } from '../../api/client'
import { ActionButton } from '../../components/ActionButton'
import { LoadingBlock } from '../../components/ListLoading'
import { StatusTag } from '../../components/StatusTag'
import type {
  CustomerDetail,
  Loan,
  LoanDetailBundle,
  LoanFieldNote,
  LoanPayment,
  LoanScheduleItem,
} from '../../types'

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Scheduled installment amountDue on the next open row (not including late fees). */
function defaultPayAmount(schedule: LoanScheduleItem[], installmentAmount?: number) {
  const open = schedule.find((s) => s.balance > 0)
  if (open) return open.amountDue.toFixed(2)
  if (installmentAmount != null && installmentAmount > 0) return installmentAmount.toFixed(2)
  return ''
}

export function FieldCustomerSheetPage() {
  const { id } = useParams()
  const customerId = Number(id)
  const [search] = useSearchParams()
  const initialLoanId = search.get('loanId')

  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [loans, setLoans] = useState<Loan[]>([])
  const [loanId, setLoanId] = useState<number | ''>('')
  const [schedule, setSchedule] = useState<LoanScheduleItem[]>([])
  const [payments, setPayments] = useState<LoanPayment[]>([])
  const [notes, setNotes] = useState<LoanFieldNote[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [payForm, setPayForm] = useState({
    amount: '',
    paidAt: new Date().toISOString().slice(0, 10),
    method: 'Cash',
    reference: '',
    notes: '',
  })
  const [noteBody, setNoteBody] = useState('')
  const [noteFile, setNoteFile] = useState<File | null>(null)
  const [notePreviewUrl, setNotePreviewUrl] = useState<string | null>(null)
  const noteFileInputId = useId()
  const noteFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!noteFile || !noteFile.type.startsWith('image/')) {
      setNotePreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(noteFile)
    setNotePreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [noteFile])

  const clearNoteFile = () => {
    setNoteFile(null)
    if (noteFileInputRef.current) noteFileInputRef.current.value = ''
  }

  const loadCustomer = async () => {
    setCustomer(await api<CustomerDetail>(`/api/customers/${customerId}`))
  }

  const loadLoans = async (preferredLoanId?: number | '') => {
    const list = await api<Loan[]>(`/api/customers/${customerId}/loans`)
    setLoans(list)
    setLoanId((current) => {
      const preferred = preferredLoanId !== undefined ? preferredLoanId : current
      if (preferred !== '' && list.some((l) => l.id === preferred)) return preferred
      const fromQuery = initialLoanId ? Number(initialLoanId) : NaN
      if (Number.isFinite(fromQuery) && list.some((l) => l.id === fromQuery)) return fromQuery
      if (list.length === 1) return list[0].id
      if (preferred !== '' && !list.some((l) => l.id === preferred)) return ''
      return preferred === '' ? '' : preferred
    })
  }

  const loadLoanExtras = async (lid: number, opts?: { fillAmount?: boolean }) => {
    const [detail, fieldNotes] = await Promise.all([
      api<LoanDetailBundle>(`/api/customers/${customerId}/loans/${lid}`),
      api<LoanFieldNote[]>(`/api/customers/${customerId}/loans/${lid}/field-notes`),
    ])
    setSchedule(detail.schedule)
    setPayments(detail.payments)
    setNotes(fieldNotes)
    if (opts?.fillAmount !== false) {
      const amount = defaultPayAmount(detail.schedule, detail.loan.installmentAmount)
      setPayForm((prev) => ({ ...prev, amount }))
    }
  }

  useEffect(() => {
    if (!Number.isFinite(customerId)) return
    setLoading(true)
    Promise.all([loadCustomer(), loadLoans()])
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId])

  useEffect(() => {
    if (loanId === '') {
      setSchedule([])
      setPayments([])
      setNotes([])
      setPayForm((prev) => ({ ...prev, amount: '' }))
      return
    }
    loadLoanExtras(loanId).catch((err) =>
      setError(err instanceof Error ? err.message : 'Failed to load loan'),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loanId])

  const onPay = async (e: FormEvent) => {
    e.preventDefault()
    if (loanId === '') return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await api(`/api/customers/${customerId}/loans/${loanId}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(payForm.amount),
          paidAt: payForm.paidAt || null,
          method: payForm.method || 'Cash',
          reference: payForm.reference || null,
          notes: payForm.notes || null,
        }),
      })
      setPayForm((prev) => ({ ...prev, reference: '', notes: '' }))
      setMessage('Payment recorded.')
      await loadLoans()
      await loadLoanExtras(loanId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed')
    } finally {
      setBusy(false)
    }
  }

  const onNote = async (e: FormEvent) => {
    e.preventDefault()
    if (loanId === '') return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const created = await api<LoanFieldNote>(`/api/customers/${customerId}/loans/${loanId}/field-notes`, {
        method: 'POST',
        body: JSON.stringify({ body: noteBody }),
      })
      if (noteFile) {
        const fd = new FormData()
        fd.append('file', noteFile)
        await apiForm(
          `/api/customers/${customerId}/loans/${loanId}/field-notes/${created.id}/attachments`,
          fd,
        )
      }
      setNoteBody('')
      clearNoteFile()
      setMessage('Note saved.')
      await loadLoanExtras(loanId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save note')
    } finally {
      setBusy(false)
    }
  }

  if (!Number.isFinite(customerId)) {
    return <p className="text-sm text-red-600">Invalid customer.</p>
  }

  if (loading && !customer) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white">
        <LoadingBlock label="Loading customer..." />
      </div>
    )
  }

  const selected = loans.find((l) => l.id === loanId)

  return (
    <div className="space-y-4">
      <Link to="/field/customers" className="text-sm text-sky-700 hover:underline">
        ← My customers
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-slate-900">{customer?.fullName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {customer?.mobile || 'No mobile'}
          {customer?.addressDisplay ? ` · ${customer.addressDisplay}` : ''}
        </p>
        {customer &&
          (customer.dateOfBirth ||
            customer.idType ||
            customer.idNumber ||
            customer.coMakerName ||
            customer.guarantorName ||
            (customer.latitude != null && customer.longitude != null)) && (
            <div className="mt-3 space-y-1.5 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
              {(customer.dateOfBirth || customer.idType || customer.idNumber) && (
                <p>
                  {customer.dateOfBirth
                    ? `DOB ${new Date(customer.dateOfBirth).toLocaleDateString()}`
                    : null}
                  {customer.dateOfBirth && (customer.idType || customer.idNumber) ? ' · ' : null}
                  {customer.idType || customer.idNumber
                    ? [customer.idType, customer.idNumber].filter(Boolean).join(' ')
                    : null}
                </p>
              )}
              {customer.coMakerName && (
                <p>
                  Co-maker: {customer.coMakerName}
                  {customer.coMakerMobile ? ` · ${customer.coMakerMobile}` : ''}
                  {customer.coMakerIdNumber ? ` · ID ${customer.coMakerIdNumber}` : ''}
                </p>
              )}
              {customer.guarantorName && (
                <p>
                  Guarantor: {customer.guarantorName}
                  {customer.guarantorMobile ? ` · ${customer.guarantorMobile}` : ''}
                  {customer.guarantorIdNumber ? ` · ID ${customer.guarantorIdNumber}` : ''}
                </p>
              )}
              {customer.latitude != null && customer.longitude != null && (
                <p>
                  <a
                    className="font-medium text-sky-700 hover:underline"
                    href={`https://www.google.com/maps?q=${customer.latitude},${customer.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in maps
                  </a>
                  <span className="text-slate-500">
                    {' '}
                    ({customer.latitude}, {customer.longitude})
                  </span>
                </p>
              )}
            </div>
          )}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {message && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Loan</label>
        <select
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          value={loanId === '' ? '' : String(loanId)}
          onChange={(e) => setLoanId(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">Select loan</option>
          {loans.map((l) => (
            <option key={l.id} value={l.id}>
              {l.loanNumber} — rem {money(l.remainingBalance)}
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-[10px] uppercase text-slate-500">Payable</div>
            <div className="text-sm font-semibold">{money(selected.totalPayable)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-[10px] uppercase text-slate-500">Paid</div>
            <div className="text-sm font-semibold">{money(selected.totalPaid)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-[10px] uppercase text-slate-500">Remaining</div>
            <div className="text-sm font-semibold">{money(selected.remainingBalance)}</div>
          </div>
          <div className="col-span-3">
            <StatusTag status={selected.status} />
          </div>
        </div>
      )}

      {loanId !== '' && (
        <form onSubmit={onPay} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">Record payment</h2>
          {(() => {
            const due = schedule.find((s) => s.balance > 0)
            return due ? (
              <p className="text-xs text-slate-500">
                Installment #{due.installmentNumber} scheduled: {money(due.amountDue)}
                {due.penaltyAmount > 0 ? ` · penalty ${money(due.penaltyAmount)}` : ''}
                {` · balance ${money(due.balance)}`}
                {due.paidAmount > 0 ? ` · paid ${money(due.paidAmount)}` : ''}
              </p>
            ) : null
          })()}
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Amount *"
            value={payForm.amount}
            onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              type="date"
              value={payForm.paidAt}
              onChange={(e) => setPayForm({ ...payForm, paidAt: e.target.value })}
            />
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Method"
              value={payForm.method}
              onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}
            />
          </div>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Reference"
            value={payForm.reference}
            onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
          />
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Notes"
            value={payForm.notes}
            onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
          />
          <ActionButton type="submit" loading={busy} loadingText="Saving…" className="w-full">
            Post payment
          </ActionButton>
        </form>
      )}

      {loanId !== '' && (
        <form onSubmit={onNote} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">Field note</h2>
          <textarea
            className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Visit note, collection remark…"
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            required
          />
          <div>
            <input
              ref={noteFileInputRef}
              id={noteFileInputId}
              type="file"
              accept="image/*,.pdf,application/pdf"
              className="sr-only"
              onChange={(e) => setNoteFile(e.target.files?.[0] ?? null)}
            />
            {!noteFile ? (
              <label
                htmlFor={noteFileInputId}
                className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center transition hover:border-sky-400 hover:bg-sky-50/60"
              >
                <span className="text-sm font-medium text-slate-800">Add photo or PDF</span>
                <span className="text-xs text-slate-500">Tap to take a photo or choose a file</span>
              </label>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                {notePreviewUrl ? (
                  <img
                    src={notePreviewUrl}
                    alt="Attachment preview"
                    className="max-h-40 w-full object-cover"
                  />
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-xs font-semibold text-slate-600">
                      PDF
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-800">{noteFile.name}</div>
                      <div className="text-xs text-slate-500">
                        {(noteFile.size / 1024).toFixed(0)} KB
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-3 py-2">
                  <div className="min-w-0 truncate text-xs text-slate-600">
                    {notePreviewUrl ? noteFile.name : 'Ready to upload'}
                  </div>
                  <div className="flex shrink-0 gap-3">
                    <label htmlFor={noteFileInputId} className="cursor-pointer text-xs font-medium text-sky-700">
                      Change
                    </label>
                    <button
                      type="button"
                      className="text-xs font-medium text-red-600"
                      onClick={clearNoteFile}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <ActionButton type="submit" loading={busy} loadingText="Saving…" className="w-full" variant="dark">
            Save note
          </ActionButton>
        </form>
      )}

      {loanId !== '' && payments.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
            Recent payments
          </div>
          <ul className="divide-y divide-slate-100">
            {payments.slice(0, 8).map((p) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-slate-600">{new Date(p.paidAt).toLocaleDateString()}</span>
                <span className="font-medium">{money(p.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loanId !== '' && notes.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">Your notes</h2>
          {notes.map((n) => (
            <div key={n.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <div className="text-xs text-slate-450 text-slate-500">
                {n.createdBy} · {new Date(n.createdAt).toLocaleString()}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-slate-800">{n.body}</p>
              {n.attachments?.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {n.attachments.map((a) => (
                    <li key={a.id}>
                      <a className="text-sky-700 hover:underline" href={a.downloadUrl} target="_blank" rel="noreferrer">
                        {a.originalFileName}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
