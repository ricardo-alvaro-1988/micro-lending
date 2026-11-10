import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../api/client'
import type {
  CustomerDetail,
  CustomerDocument,
  Loan,
  LoanApprovalHistory,
  LoanFieldNote,
  LoanFieldNoteAttachment,
  LoanPayment,
  LoanScheduleItem,
} from '../types'
import { ApprovalCommentViewer } from './ApprovalCommentViewer'
import { CustomerAvatar } from './CustomerAvatar'
import { LoadingBlock } from './ListLoading'
import { StatusTag } from './StatusTag'

export type LoanApplicationReview = {
  loan: Loan
  customer: CustomerDetail
  schedule: LoanScheduleItem[]
  payments: LoanPayment[]
  approvals: LoanApprovalHistory[]
  fieldNotes: LoanFieldNote[]
}

type Tab =
  | 'personal'
  | 'documents'
  | 'notes'
  | 'loan'
  | 'schedule'
  | 'payments'
  | 'approvals'

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

async function openAuthenticatedFile(path: string, fileName: string) {
  const token = localStorage.getItem('ml_token')
  const res = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error('Download failed')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

type Props = {
  loanId: number
  onClose: () => void
  headerActions?: ReactNode
}

export function LoanApplicationReviewDialog({ loanId, onClose, headerActions }: Props) {
  const [review, setReview] = useState<LoanApplicationReview | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('personal')
  const [fileError, setFileError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setFileError('')
    setReview(null)
    setTab('personal')
    api<LoanApplicationReview>(`/api/loans/${loanId}/review`)
      .then((data) => {
        if (!cancelled) setReview(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load application')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loanId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const loan = review?.loan
  const customer = review?.customer

  const downloadDoc = async (doc: CustomerDocument) => {
    if (!customer) return
    setFileError('')
    try {
      await openAuthenticatedFile(
        `/api/customers/${customer.id}/documents/${doc.id}/file`,
        doc.originalFileName,
      )
    } catch {
      setFileError('Could not download document.')
    }
  }

  const downloadNoteFile = async (att: LoanFieldNoteAttachment) => {
    setFileError('')
    try {
      await openAuthenticatedFile(att.downloadUrl, att.originalFileName)
    } catch {
      setFileError('Could not download attachment.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Loan application review"
      onClick={onClose}
    >
      <div
        className="my-2 flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        style={{ maxHeight: 'calc(100vh - 2rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            {customer && (
              <CustomerAvatar
                customerId={customer.id}
                hasPicture={customer.hasProfilePicture}
                name={customer.fullName}
                className="h-12 w-12 shrink-0 rounded-full text-sm"
                textClassName="bg-[#0f2744] text-sky-100"
              />
            )}
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-slate-900">
                {loan?.loanNumber ?? `Loan #${loanId}`}
              </h3>
              <p className="mt-0.5 text-sm text-slate-500">
                {customer
                  ? `${customer.fullName} · full application review`
                  : 'Loading application package…'}
              </p>
              {loan && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <StatusTag status={loan.status} />
                  <span className="text-xs text-slate-500">{loan.currentStageName}</span>
                  <span className="text-xs tabular-nums text-slate-500">{money(loan.amount)}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {headerActions}
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-4 shrink-0 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {fileError && (
          <div className="mx-5 mt-2 shrink-0 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {fileError}
          </div>
        )}

        {loading || !review || !loan || !customer ? (
          <LoadingBlock label="Loading full application…" />
        ) : (
          <>
            <div className="flex shrink-0 flex-wrap gap-1 overflow-x-auto border-b border-slate-100 px-5 pt-3">
              {(
                [
                  ['personal', 'Personal'],
                  ['documents', `Documents (${customer.documents.length})`],
                  ['notes', `Agent notes (${review.fieldNotes.length})`],
                  ['loan', 'Loan'],
                  ['schedule', `Schedule (${review.schedule.length})`],
                  ['payments', `Payments (${review.payments.length})`],
                  ['approvals', `Approvals (${review.approvals.length})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`whitespace-nowrap rounded-t-lg px-3 py-2 text-sm font-medium ${
                    tab === key
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
              {tab === 'personal' && <PersonalTab customer={customer} />}
              {tab === 'documents' && (
                <DocumentsTab documents={customer.documents} onDownload={(d) => void downloadDoc(d)} />
              )}
              {tab === 'notes' && (
                <NotesTab notes={review.fieldNotes} onDownload={(a) => void downloadNoteFile(a)} />
              )}
              {tab === 'loan' && <LoanTab loan={loan} />}
              {tab === 'schedule' && <ScheduleTab rows={review.schedule} />}
              {tab === 'payments' && <PaymentsTab rows={review.payments} />}
              {tab === 'approvals' && <ApprovalsTab rows={review.approvals} />}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm text-slate-900">{value?.trim() ? value : '—'}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  )
}

function PersonalTab({ customer }: { customer: CustomerDetail }) {
  return (
    <div className="space-y-5">
      <Section title="Identity">
        <Field label="First name" value={customer.firstName} />
        <Field label="Middle name" value={customer.middleName} />
        <Field label="Last name" value={customer.lastName} />
        <Field label="Date of birth" value={customer.dateOfBirth?.slice(0, 10)} />
        <Field label="ID type" value={customer.idType} />
        <Field label="ID number" value={customer.idNumber} />
      </Section>
      <Section title="Contact">
        <Field label="Mobile" value={customer.mobile} />
        <Field label="Phone" value={customer.phone} />
        <Field label="Email" value={customer.email} />
        <Field label="Referred by" value={customer.referredBy} />
      </Section>
      <Section title="Address">
        <Field label="House / unit" value={customer.houseUnit} />
        <Field label="Street" value={customer.street} />
        <Field label="Barangay" value={customer.barangay} />
        <Field label="City" value={customer.city} />
        <Field label="Province" value={customer.province} />
        <Field label="ZIP" value={customer.zipCode} />
        <div className="sm:col-span-2 lg:col-span-3">
          <Field label="Full address" value={customer.addressDisplay} />
        </div>
        <Field
          label="Coordinates"
          value={
            customer.latitude != null && customer.longitude != null
              ? `${customer.latitude}, ${customer.longitude}`
              : null
          }
        />
      </Section>
      <Section title="Assignment">
        <Field label="Branch" value={customer.branchName} />
        <Field label="Group" value={customer.groupName} />
        <Field label="Agent 1" value={customer.agent1Name} />
        <Field label="Agent 2" value={customer.agent2Name} />
        <Field label="Agent 3" value={customer.agent3Name} />
      </Section>
      <Section title="Co-maker">
        <Field label="Name" value={customer.coMakerName} />
        <Field label="Mobile" value={customer.coMakerMobile} />
        <Field label="ID number" value={customer.coMakerIdNumber} />
      </Section>
      <Section title="Guarantor">
        <Field label="Name" value={customer.guarantorName} />
        <Field label="Mobile" value={customer.guarantorMobile} />
        <Field label="ID number" value={customer.guarantorIdNumber} />
      </Section>
    </div>
  )
}

function DocumentsTab({
  documents,
  onDownload,
}: {
  documents: CustomerDocument[]
  onDownload: (doc: CustomerDocument) => void
}) {
  if (documents.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">No documents uploaded.</p>
  }
  return (
    <div className="overflow-auto rounded-lg border border-slate-200">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2 font-medium">Label</th>
            <th className="px-3 py-2 font-medium">File</th>
            <th className="px-3 py-2 font-medium">Uploaded</th>
            <th className="px-3 py-2 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((d) => (
            <tr key={d.id} className="border-t border-slate-100">
              <td className="px-3 py-2 font-medium">{d.label || '—'}</td>
              <td className="px-3 py-2">
                <div>{d.originalFileName}</div>
                <div className="text-xs text-slate-500">
                  {d.contentType} · {(d.sizeBytes / 1024).toFixed(1)} KB
                </div>
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{new Date(d.uploadedAt).toLocaleString()}</td>
              <td className="px-3 py-2">
                <button
                  type="button"
                  className="text-sky-700 hover:underline"
                  onClick={() => onDownload(d)}
                >
                  Download
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function NotesTab({
  notes,
  onDownload,
}: {
  notes: LoanFieldNote[]
  onDownload: (att: LoanFieldNoteAttachment) => void
}) {
  if (notes.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">No agent notes yet.</p>
  }
  return (
    <ul className="space-y-3">
      {notes.map((n) => (
        <li key={n.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span className="font-medium text-slate-700">{n.createdBy}</span>
            <span>{new Date(n.createdAt).toLocaleString()}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{n.body}</p>
          {n.attachments.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-slate-200 pt-3">
              {n.attachments.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className="text-sm text-sky-700 hover:underline"
                    onClick={() => onDownload(a)}
                  >
                    {a.originalFileName}
                  </button>
                  <span className="ml-2 text-xs text-slate-500">
                    {(a.sizeBytes / 1024).toFixed(1)} KB · {new Date(a.uploadedAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}

function LoanTab({ loan }: { loan: Loan }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Status" value={loan.status} />
      <Field label="Current stage" value={loan.currentStageName} />
      <Field label="Flow" value={loan.flowName} />
      <Field label="Customer" value={loan.customerName} />
      <Field label="Created by" value={loan.createdBy} />
      <Field label="Created" value={new Date(loan.createdAt).toLocaleString()} />
      <Field label="Principal" value={money(loan.amount)} />
      <Field label="Interest rate" value={`${loan.interestRatePercent}%`} />
      <Field label="Interest amount" value={money(loan.interestAmount)} />
      <Field label="Total payable" value={money(loan.totalPayable)} />
      <Field label="Total paid" value={money(loan.totalPaid)} />
      <Field label="Remaining" value={money(loan.remainingBalance)} />
      <Field label="Term count" value={String(loan.termCount || '—')} />
      <Field label="Frequency" value={loan.paymentFrequency || '—'} />
      <Field label="First due" value={loan.firstDueDate?.slice(0, 10)} />
      <Field label="Installment" value={money(loan.installmentAmount)} />
      <Field label="Product" value={loan.loanProductName} />
      <Field label="Interest method" value={loan.interestMethod} />
      <Field label="Has terms" value={loan.hasTerms ? 'Yes' : 'No'} />
      {loan.notes && (
        <div className="sm:col-span-2 lg:col-span-3">
          <Field label="Loan notes" value={loan.notes} />
        </div>
      )}
    </div>
  )
}

function ScheduleTab({ rows }: { rows: LoanScheduleItem[] }) {
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">No payment schedule yet.</p>
  }
  return (
    <div className="overflow-auto rounded-lg border border-slate-200">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Due</th>
            <th className="px-3 py-2 font-medium text-right">Due amt</th>
            <th className="px-3 py-2 font-medium text-right">Paid</th>
            <th className="px-3 py-2 font-medium text-right">Balance</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="border-t border-slate-100">
              <td className="px-3 py-2">{s.installmentNumber}</td>
              <td className="px-3 py-2">{s.dueDate.slice(0, 10)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{money(s.amountDue)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{money(s.paidAmount)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{money(s.balance)}</td>
              <td className="px-3 py-2">
                <StatusTag status={s.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PaymentsTab({ rows }: { rows: LoanPayment[] }) {
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">No payments recorded.</p>
  }
  return (
    <div className="overflow-auto rounded-lg border border-slate-200">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2 font-medium">Paid at</th>
            <th className="px-3 py-2 font-medium text-right">Amount</th>
            <th className="px-3 py-2 font-medium">Method</th>
            <th className="px-3 py-2 font-medium">Reference</th>
            <th className="px-3 py-2 font-medium">By</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-t border-slate-100">
              <td className="px-3 py-2 whitespace-nowrap">{new Date(p.paidAt).toLocaleString()}</td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">{money(p.amount)}</td>
              <td className="px-3 py-2">{p.method || '—'}</td>
              <td className="px-3 py-2">{p.reference || '—'}</td>
              <td className="px-3 py-2">{p.recordedBy}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ApprovalsTab({ rows }: { rows: LoanApprovalHistory[] }) {
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">No approval history yet.</p>
  }
  return (
    <div className="overflow-auto rounded-lg border border-slate-200">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2 font-medium">Stage</th>
            <th className="px-3 py-2 font-medium">Decision</th>
            <th className="px-3 py-2 font-medium">By</th>
            <th className="px-3 py-2 font-medium">Requested</th>
            <th className="px-3 py-2 font-medium">Decided</th>
            <th className="px-3 py-2 font-medium">Comments</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="border-t border-slate-100">
              <td className="px-3 py-2">{a.stageName}</td>
              <td className="px-3 py-2">
                <StatusTag status={a.decision} />
              </td>
              <td className="px-3 py-2">{a.decidedBy || '—'}</td>
              <td className="px-3 py-2 whitespace-nowrap">{new Date(a.requestedAt).toLocaleString()}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                {a.decidedAt ? new Date(a.decidedAt).toLocaleString() : '—'}
              </td>
              <td className="px-3 py-2">
                <ApprovalCommentViewer entry={a} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
