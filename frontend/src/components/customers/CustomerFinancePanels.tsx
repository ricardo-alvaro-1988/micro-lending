import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { ActionButton } from '../ActionButton'
import { ApprovalCommentViewer } from '../ApprovalCommentViewer'
import { ApprovalNotesDialog } from '../ApprovalNotesDialog'
import { LoadingTableRow, PageLoading } from '../ListLoading'
import {
  LoanChargeFields,
  LoanProceedsBreakdown,
  chargePayloadFrom,
  chargeStringsFrom,
  emptyChargeStrings,
} from '../LoanProceedsBreakdown'
import { StageTag, StatusTag } from '../StatusTag'
import {
  DEFAULT_INTEREST_RATE_PERCENT,
  dailyPaymentLines,
  feeFieldsFromPrincipal,
  membershipFeeFor,
} from '../../lib/loanFeeRules'
import {
  notifyApprovalsChanged,
  notifyLoansChanged,
  notifyPaymentSchedulesChanged,
} from '../../notify'
import type {
  CustomerPaymentSummary,
  CustomerSavingsSummary,
  Loan,
  LoanApprovalHistory,
  LoanCollateral,
  LoanDetailBundle,
  LoanFieldNote,
  LoanPayment,
  LoanProduct,
  LoanScheduleItem,
  ProcessFlow,
  StatementOfAccount,
} from '../../types'

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const dateOnly = (value?: string | null) => {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}

/** Local `YYYY-MM-DDTHH:mm` for datetime-local inputs. */
function localDateTimeInputValue(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

type SharedProps = {
  customerId: number
  onError: (msg: string) => void
  onMessage: (msg: string) => void
}

export function LoanApplicationPanel({ customerId, onError, onMessage }: SharedProps) {
  const { can } = useAuth()
  const canManageLoans = can('loans.manage')
  const canActApprovals = can('approvals.manage')
  const [loans, setLoans] = useState<Loan[]>([])
  const [flows, setFlows] = useState<ProcessFlow[]>([])
  const [selectedLoanId, setSelectedLoanId] = useState<number | null>(null)
  const [approvals, setApprovals] = useState<LoanApprovalHistory[]>([])
  const [fieldNotes, setFieldNotes] = useState<LoanFieldNote[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [products, setProducts] = useState<LoanProduct[]>([])
  const [form, setForm] = useState({
    loanProductId: 0,
    flowId: 0,
    amount: '',
    interestRatePercent: String(DEFAULT_INTEREST_RATE_PERCENT),
    termCount: '70',
    paymentFrequency: 'Daily',
    interestMethod: 'Flat',
    loanType: 'Providential',
    applicationType: 'New',
    cycle: '1',
    approvedAmount: '',
    applicationDate: localDateTimeInputValue(),
    notes: '',
    ...emptyChargeStrings,
    membershipFee: String(membershipFeeFor(1)),
  })
  const [collaterals, setCollaterals] = useState<LoanCollateral[]>([
    { descriptionOrKind: '', brand: '', estimatedMarketValue: 0 },
    { descriptionOrKind: '', brand: '', estimatedMarketValue: 0 },
    { descriptionOrKind: '', brand: '', estimatedMarketValue: 0 },
  ])

  const load = async () => {
    setLoading(true)
    try {
      const [loanList, flowList, productList] = await Promise.all([
        api<Loan[]>(`/api/customers/${customerId}/loans`),
        api<ProcessFlow[]>('/api/flows?activeOnly=true'),
        api<LoanProduct[]>('/api/loan-products?activeOnly=true'),
      ])
      setLoans(loanList)
      setFlows(flowList)
      setProducts(productList)
      setForm((prev) => ({ ...prev, flowId: prev.flowId || flowList[0]?.id || 0 }))
      if (selectedLoanId != null) {
        const [detail, notes] = await Promise.all([
          api<LoanDetailBundle>(`/api/customers/${customerId}/loans/${selectedLoanId}`),
          api<LoanFieldNote[]>(`/api/customers/${customerId}/loans/${selectedLoanId}/field-notes`),
        ])
        setApprovals(detail.approvals)
        setFieldNotes(notes)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setSelectedLoanId(null)
    setApprovals([])
    setFieldNotes([])
    setForm((prev) => ({
      ...prev,
      applicationDate: localDateTimeInputValue(),
      approvedAmount: prev.approvedAmount || prev.amount,
    }))
    load().catch((err) => onError(err instanceof Error ? err.message : 'Failed to load loans'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId])

  const selectLoan = async (id: number) => {
    setSelectedLoanId(id)
    try {
      const [detail, notes] = await Promise.all([
        api<LoanDetailBundle>(`/api/customers/${customerId}/loans/${id}`),
        api<LoanFieldNote[]>(`/api/customers/${customerId}/loans/${id}/field-notes`),
      ])
      setApprovals(detail.approvals)
      setFieldNotes(notes)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load loan detail')
    }
  }

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const created = await api<Loan>('/api/loans', {
        method: 'POST',
        body: JSON.stringify({
          customerId,
          flowId: form.flowId,
          loanProductId: form.loanProductId || null,
          amount: Number(form.amount),
          interestRatePercent: Number(form.interestRatePercent || 0),
          // Application only — schedule / first payment day are set later on Payment Terms after approval.
          termCount: Number(form.termCount || 0),
          paymentFrequency: form.paymentFrequency,
          interestMethod: form.interestMethod,
          loanType: form.loanType || null,
          applicationType: form.applicationType || null,
          cycle: form.cycle ? Number(form.cycle) : null,
          approvedAmount: Number(form.approvedAmount || form.amount || 0) || null,
          applicationDate: (() => {
            const raw = form.applicationDate?.trim()
            if (!raw) return new Date().toISOString()
            const parsed = new Date(raw)
            return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
          })(),
          firstDueDate: null,
          notes: form.notes || null,
          collaterals: collaterals
            .filter((c) => c.descriptionOrKind.trim() || Number(c.estimatedMarketValue) > 0)
            .map((c) => ({
              descriptionOrKind: c.descriptionOrKind.trim(),
              brand: c.brand || null,
              estimatedMarketValue: Number(c.estimatedMarketValue || 0),
            })),
          ...chargePayloadFrom(form),
        }),
      })
      onMessage(`Loan ${created.loanNumber} created.`)
      notifyLoansChanged()
      notifyApprovalsChanged()
      setForm((prev) => ({
        ...prev,
        amount: '',
        notes: '',
        approvedAmount: '',
        applicationDate: localDateTimeInputValue(),
        cycle: prev.cycle || '1',
        ...emptyChargeStrings,
        membershipFee: String(membershipFeeFor(Number(prev.cycle) || 1)),
      }))
      setCollaterals([
        { descriptionOrKind: '', brand: '', estimatedMarketValue: 0 },
        { descriptionOrKind: '', brand: '', estimatedMarketValue: 0 },
        { descriptionOrKind: '', brand: '', estimatedMarketValue: 0 },
      ])
      await load()
      await selectLoan(created.id)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Create loan failed')
    } finally {
      setBusy(false)
    }
  }

  const onAdvance = async (loan: Loan) => {
    setBusy(true)
    try {
      await api(`/api/loans/${loan.id}/advance`, { method: 'POST' })
      onMessage(`Advanced ${loan.loanNumber}.`)
      notifyLoansChanged()
      notifyApprovalsChanged()
      await load()
      await selectLoan(loan.id)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Advance failed')
    } finally {
      setBusy(false)
    }
  }

  const [approvalDialog, setApprovalDialog] = useState<{
    approvalId: number
    action: 'approve' | 'reject'
  } | null>(null)

  const onApproval = async (notes: string) => {
    if (!approvalDialog) return
    const { approvalId, action } = approvalDialog
    setBusy(true)
    try {
      await api(`/api/approvals/${approvalId}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ comments: notes }),
      })
      setApprovalDialog(null)
      onMessage(action === 'approve' ? 'Approved.' : 'Rejected.')
      notifyApprovalsChanged()
      notifyLoansChanged()
      notifyPaymentSchedulesChanged()
      await load()
      if (selectedLoanId != null) await selectLoan(selectedLoanId)
      notifyApprovalsChanged()
      notifyLoansChanged()
      notifyPaymentSchedulesChanged()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Approval action failed')
    } finally {
      setBusy(false)
    }
  }

  const selected = loans.find((l) => l.id === selectedLoanId) ?? null
  const pendingApproval = approvals.find((a) => a.decision === 'Pending')

  return (
    <div className="space-y-5">
      {canManageLoans && (
        <form onSubmit={onCreate} className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-3"
            value={form.loanProductId}
            onChange={(e) => {
              const id = Number(e.target.value)
              const product = products.find((p) => p.id === id)
              if (!product) {
                setForm((prev) => ({ ...prev, loanProductId: 0 }))
                return
              }
              const fees = feeFieldsFromPrincipal(product.amount, product.termCount, form.cycle)
              setForm((prev) => ({
                ...prev,
                loanProductId: product.id,
                paymentFrequency: product.paymentFrequency,
                interestMethod: product.interestMethod,
                ...fees,
                amount: String(product.amount),
                approvedAmount: String(product.amount),
                termCount: String(product.termCount),
              }))
            }}
          >
            <option value={0}>Loan product (optional template)</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {money(p.amount)} · {p.interestRatePercent}% · {p.termCount} {p.paymentFrequency} ·{' '}
                {p.interestMethod === 'DecliningBalance' ? 'declining' : 'flat'}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.flowId}
            onChange={(e) => setForm({ ...form, flowId: Number(e.target.value) })}
            required
          >
            <option value={0}>Select process flow</option>
            {flows.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <div className="md:col-span-3 grid gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-500">Loan type</span>
              <div className="flex flex-wrap gap-3 pt-1">
                {['Providential', 'Business'].map((t) => (
                  <label key={t} className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="loanType"
                      checked={form.loanType === t}
                      onChange={() => setForm({ ...form, loanType: t })}
                    />
                    {t} loan
                  </label>
                ))}
              </div>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-500">Application type</span>
              <div className="flex flex-wrap gap-3 pt-1">
                {['New', 'Renewal', 'Restructured'].map((t) => (
                  <label key={t} className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="applicationType"
                      checked={form.applicationType === t}
                      onChange={() => setForm({ ...form, applicationType: t })}
                    />
                    {t}
                  </label>
                ))}
              </div>
            </label>
            <input
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Amount applied *"
              type="number"
              min="0"
              step="any"
              value={form.amount}
              onChange={(e) => {
                const amount = e.target.value
                const product = products.find((p) => p.id === form.loanProductId)
                const n = Number(amount)
                const terms = Number(form.termCount)
                if (product && n > 0 && terms > 0) {
                  setForm({
                    ...form,
                    amount,
                    approvedAmount: amount,
                    ...feeFieldsFromPrincipal(n, terms, form.cycle),
                    termCount: form.termCount,
                  })
                  return
                }
                setForm({ ...form, amount, approvedAmount: amount })
              }}
              required
            />
            <input
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Approved amount (defaults to applied)"
              type="number"
              min="0"
              step="any"
              value={form.approvedAmount}
              onChange={(e) => setForm({ ...form, approvedAmount: e.target.value })}
            />
            <label className="text-sm md:col-span-1">
              <span className="mb-1 block text-xs font-medium text-slate-500">Application date *</span>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                type="datetime-local"
                value={form.applicationDate || localDateTimeInputValue()}
                onChange={(e) =>
                  setForm({
                    ...form,
                    applicationDate: e.target.value || localDateTimeInputValue(),
                  })
                }
                required
              />
            </label>
            <input
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Cycle # (1 = membership 125; 2+ = none)"
              type="number"
              min="1"
              value={form.cycle}
              onChange={(e) => {
                const cycle = e.target.value
                const product = products.find((p) => p.id === form.loanProductId)
                const n = Number(form.amount)
                const terms = Number(form.termCount)
                if (product && n > 0 && terms > 0) {
                  setForm({
                    ...form,
                    cycle,
                    ...feeFieldsFromPrincipal(n, terms, cycle),
                  })
                  return
                }
                setForm({
                  ...form,
                  cycle,
                  membershipFee: String(membershipFeeFor(Number(cycle) || 1)),
                })
              }}
            />
            <input
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Terms (e.g. 70 days)"
              type="number"
              min="1"
              value={form.termCount}
              onChange={(e) => {
                const termCount = e.target.value
                const product = products.find((p) => p.id === form.loanProductId)
                const n = Number(form.amount)
                const terms = Number(termCount)
                if (product && n > 0 && terms > 0) {
                  setForm({
                    ...form,
                    ...feeFieldsFromPrincipal(n, terms, form.cycle),
                    termCount,
                  })
                  return
                }
                setForm({ ...form, termCount })
              }}
            />
            <input
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Interest %"
              type="number"
              min="0"
              step="0.01"
              value={form.interestRatePercent}
              onChange={(e) => setForm({ ...form, interestRatePercent: e.target.value })}
            />
            <select
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.paymentFrequency}
              onChange={(e) => setForm({ ...form, paymentFrequency: e.target.value })}
            >
              <option value="Daily">Daily payment</option>
              <option value="Weekly">Weekly</option>
              <option value="BiWeekly">Bi-weekly</option>
              <option value="Monthly">Monthly</option>
            </select>
            <select
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.interestMethod}
              onChange={(e) => setForm({ ...form, interestMethod: e.target.value })}
              title="Interest method"
            >
              <option value="Flat">Flat interest</option>
              <option value="DecliningBalance">Declining balance</option>
            </select>
            <input
              className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
              placeholder="Notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div className="md:col-span-3 space-y-2 rounded-lg border border-slate-200 bg-white p-3">
            <div className="rounded bg-sky-700 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
              Assets / properties for collateral
            </div>
            <div className="overflow-hidden rounded border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Description / kind</th>
                    <th className="px-3 py-2 font-medium">Brand</th>
                    <th className="px-3 py-2 font-medium">Est. market value</th>
                  </tr>
                </thead>
                <tbody>
                  {collaterals.map((row, index) => (
                    <tr key={index} className="border-t border-slate-100">
                      <td className="px-2 py-1.5">
                        <input
                          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                          value={row.descriptionOrKind}
                          onChange={(e) =>
                            setCollaterals((prev) =>
                              prev.map((r, i) =>
                                i === index ? { ...r, descriptionOrKind: e.target.value } : r,
                              ),
                            )
                          }
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                          value={row.brand ?? ''}
                          onChange={(e) =>
                            setCollaterals((prev) =>
                              prev.map((r, i) => (i === index ? { ...r, brand: e.target.value } : r)),
                            )
                          }
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.estimatedMarketValue || ''}
                          onChange={(e) =>
                            setCollaterals((prev) =>
                              prev.map((r, i) =>
                                i === index
                                  ? { ...r, estimatedMarketValue: Number(e.target.value || 0) }
                                  : r,
                              ),
                            )
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              className="text-xs font-medium text-sky-700 hover:underline"
              onClick={() =>
                setCollaterals((prev) => [
                  ...prev,
                  { descriptionOrKind: '', brand: '', estimatedMarketValue: 0 },
                ])
              }
            >
              Add collateral row
            </button>
          </div>
          <div className="md:col-span-3">
            <LoanChargeFields form={form} setForm={setForm} />
          </div>
          {Number(form.amount) > 0 && Number(form.termCount) > 0 && (
            <div className="md:col-span-3">
              <LoanProceedsBreakdown
                values={{
                  amount: Number(form.amount),
                  termCount: Number(form.termCount),
                  paymentFrequency: form.paymentFrequency,
                  ...chargePayloadFrom(form),
                  ...dailyPaymentLines({
                    amount: Number(form.amount),
                    termCount: Number(form.termCount),
                    interestRatePercent: Number(form.interestRatePercent || 0),
                    savingsPerPeriod: Number(form.savingsPerPeriod || 0),
                    insurancePerPeriod: Number(form.insurancePerPeriod || 0),
                  }),
                }}
              />
            </div>
          )}
          <ActionButton type="submit" loading={busy} loadingText="Creating…">
            Create loan application
          </ActionButton>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Loan</th>
              <th className="px-3 py-2 font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Stage</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && loans.length === 0 ? (
              <LoadingTableRow colSpan={5} label="Loading loans..." />
            ) : (
              <>
            {loans.map((loan) => (
              <tr
                key={loan.id}
                className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${
                  selectedLoanId === loan.id ? 'bg-sky-50' : ''
                }`}
                onClick={() => void selectLoan(loan.id)}
              >
                <td className="px-3 py-2 font-medium">{loan.loanNumber}</td>
                <td className="px-3 py-2">{money(loan.amount)}</td>
                <td className="px-3 py-2">
                  <StageTag stage={loan.currentStageName} />
                </td>
                <td className="px-3 py-2">
                  <StatusTag status={loan.status} />
                </td>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/lending/loans/${loan.id}/agreement`}
                      className="text-sky-700 hover:underline"
                    >
                      Print agreement
                    </Link>
                    {canManageLoans && loan.canAdvance && (
                      <button
                        type="button"
                        className="text-sky-700 hover:underline"
                        onClick={() => void onAdvance(loan)}
                      >
                        Advance
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && loans.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-slate-500" colSpan={5}>
                  No loan applications for this customer.
                </td>
              </tr>
            )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="space-y-3 rounded-lg border border-slate-200 p-4">
          <h4 className="text-sm font-semibold text-slate-700">Field notes — {selected.loanNumber}</h4>
          {fieldNotes.length === 0 ? (
            <p className="text-sm text-slate-500">No field notes yet.</p>
          ) : (
            <ul className="space-y-3">
              {fieldNotes.map((n) => (
                <li key={n.id} className="rounded-md border border-slate-100 bg-slate-50/80 p-3 text-sm">
                  <div className="text-xs text-slate-500">
                    {n.createdBy} · {new Date(n.createdAt).toLocaleString()}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-slate-800">{n.body}</p>
                  {n.attachments?.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {n.attachments.map((a) => (
                        <li key={a.id}>
                          <a
                            className="text-sky-700 hover:underline"
                            href={a.downloadUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {a.originalFileName}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {selected && (
        <div className="space-y-3 rounded-lg border border-slate-200 p-4">
          <h4 className="text-sm font-semibold text-slate-700">
            Approval history — {selected.loanNumber}
          </h4>
          {canActApprovals && selected.canApprove && pendingApproval && (
            <div className="flex flex-wrap gap-3">
              <ActionButton
                type="button"
                loading={busy}
                onClick={() => setApprovalDialog({ approvalId: pendingApproval.id, action: 'approve' })}
              >
                Approve current stage
              </ActionButton>
              <ActionButton
                type="button"
                variant="danger"
                loading={busy}
                onClick={() => setApprovalDialog({ approvalId: pendingApproval.id, action: 'reject' })}
              >
                Decline
              </ActionButton>
            </div>
          )}
          <div className="overflow-hidden rounded-md border border-slate-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Stage</th>
                  <th className="px-3 py-2 font-medium">Decision</th>
                  <th className="px-3 py-2 font-medium">By</th>
                  <th className="px-3 py-2 font-medium">Notes</th>
                  <th className="px-3 py-2 font-medium">Requested</th>
                </tr>
              </thead>
              <tbody>
                {approvals.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{a.stageName}</td>
                    <td className="px-3 py-2">
                      <StatusTag status={a.decision} />
                    </td>
                    <td className="px-3 py-2">{a.decidedBy || '—'}</td>
                    <td className="px-3 py-2">
                      <ApprovalCommentViewer entry={a} />
                    </td>
                    <td className="px-3 py-2">{dateOnly(a.requestedAt)}</td>
                  </tr>
                ))}
                {approvals.length === 0 && (
                  <tr>
                    <td className="px-3 py-3 text-slate-500" colSpan={5}>
                      No approval records yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ApprovalNotesDialog
        open={approvalDialog != null}
        action={approvalDialog?.action ?? 'approve'}
        title={
          approvalDialog && selected
            ? `${approvalDialog.action === 'approve' ? 'Approve' : 'Decline'} ${selected.loanNumber}`
            : undefined
        }
        subtitle={selected?.currentStageName}
        busy={busy}
        onCancel={() => setApprovalDialog(null)}
        onConfirm={(notes) => void onApproval(notes)}
      />
    </div>
  )
}

export function PaymentTermsPanel({ customerId, onError, onMessage }: SharedProps) {
  const { can } = useAuth()
  const canManage = can('loans.manage')
  const [loans, setLoans] = useState<Loan[]>([])
  const [loanId, setLoanId] = useState<number | ''>('')
  const [schedule, setSchedule] = useState<LoanScheduleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [products, setProducts] = useState<LoanProduct[]>([])
  const [form, setForm] = useState({
    loanProductId: 0,
    amount: '',
    interestRatePercent: '0',
    termCount: '12',
    paymentFrequency: 'Monthly',
    interestMethod: 'Flat',
    firstDueDate: '',
    notes: '',
    ...emptyChargeStrings,
  })

  const loadLoans = async () => {
    setLoading(true)
    try {
      const [list, productList] = await Promise.all([
        api<Loan[]>(`/api/customers/${customerId}/loans`),
        api<LoanProduct[]>('/api/loan-products?activeOnly=true'),
      ])
      setLoans(list)
      setProducts(productList)
      if (loanId !== '' && !list.some((l) => l.id === loanId)) setLoanId('')
    } finally {
      setLoading(false)
    }
  }

  const loadDetail = async (id: number) => {
    const detail = await api<LoanDetailBundle>(`/api/customers/${customerId}/loans/${id}`)
    setSchedule(detail.schedule)
    setForm({
      loanProductId: detail.loan.loanProductId ?? 0,
      amount: String(detail.loan.amount || ''),
      interestRatePercent: String(detail.loan.interestRatePercent ?? 0),
      termCount: String(detail.loan.termCount || 12),
      paymentFrequency: detail.loan.paymentFrequency || 'Monthly',
      interestMethod: detail.loan.interestMethod || 'Flat',
      firstDueDate: detail.loan.firstDueDate ? detail.loan.firstDueDate.slice(0, 10) : '',
      notes: detail.loan.notes ?? '',
      ...chargeStringsFrom(detail.loan),
    })
  }

  useEffect(() => {
    setLoanId('')
    setSchedule([])
    loadLoans().catch((err) => onError(err instanceof Error ? err.message : 'Failed to load'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId])

  useEffect(() => {
    if (loanId === '') {
      setSchedule([])
      return
    }
    loadDetail(loanId).catch((err) => onError(err instanceof Error ? err.message : 'Failed to load terms'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loanId])

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    if (loanId === '') return
    setBusy(true)
    try {
      const result = await api<{ loan: Loan; schedule: LoanScheduleItem[] }>(
        `/api/customers/${customerId}/loans/${loanId}/terms`,
        {
          method: 'PUT',
          body: JSON.stringify({
            loanProductId: form.loanProductId || null,
            amount: Number(form.amount),
            interestRatePercent: Number(form.interestRatePercent || 0),
            termCount: Number(form.termCount),
            paymentFrequency: form.paymentFrequency,
            interestMethod: form.interestMethod,
            firstDueDate: form.firstDueDate,
            notes: form.notes || null,
            ...chargePayloadFrom(form),
          }),
        },
      )
      setSchedule(result.schedule)
      onMessage('Payment terms saved and schedule generated.')
      notifyPaymentSchedulesChanged()
      await loadLoans()
      if (result.loan) {
        setForm((prev) => ({
          ...prev,
          ...chargeStringsFrom(result.loan),
        }))
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Save terms failed')
    } finally {
      setBusy(false)
    }
  }

  const selected = loans.find((l) => l.id === loanId)
  const readyForTerms =
    selected?.status === 'ApprovedFinal' || selected?.status === 'Closed'

  if (loading && loans.length === 0) {
    return <PageLoading label="Loading loans..." compact />
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600">Loan</label>
        <select
          className="w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={loanId === '' ? '' : String(loanId)}
          onChange={(e) => setLoanId(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">Select loan</option>
          {loans.map((l) => (
            <option key={l.id} value={l.id}>
              {l.loanNumber} — {money(l.amount)} ({l.status === 'ApprovedFinal' ? 'Approved-Final' : l.status})
            </option>
          ))}
        </select>
        {selected && (
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
            Status <StatusTag status={selected.status} />
            {!readyForTerms && (
              <span className="text-amber-700">— payment terms unlock at Approved-Final</span>
            )}
          </div>
        )}
      </div>

      {loanId !== '' && (
        <form onSubmit={onSave} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-3">
              <label className="mb-1 block text-xs font-medium text-slate-500">Loan product</label>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form.loanProductId}
                onChange={(e) => {
                  const id = Number(e.target.value)
                  const product = products.find((p) => p.id === id)
                  if (!product) {
                    setForm((prev) => ({ ...prev, loanProductId: 0 }))
                    return
                  }
                  const fees = feeFieldsFromPrincipal(product.amount, product.termCount, selected?.cycle)
                  setForm((prev) => ({
                    ...prev,
                    loanProductId: product.id,
                    paymentFrequency: product.paymentFrequency,
                    interestMethod: product.interestMethod,
                    ...fees,
                    amount: String(product.amount),
                    termCount: String(product.termCount),
                  }))
                }}
                disabled={!canManage || !readyForTerms}
              >
                <option value={0}>None — enter terms manually</option>
                {form.loanProductId !== 0 && !products.some((p) => p.id === form.loanProductId) && (
                  <option value={form.loanProductId}>{selected?.loanProductName || `Product #${form.loanProductId}`}</option>
                )}
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {money(p.amount)} · {p.interestRatePercent}% · {p.termCount} {p.paymentFrequency}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Principal *</label>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                type="number"
                min="0"
                step="any"
                value={form.amount}
                onChange={(e) => {
                  const amount = e.target.value
                  const product = products.find((p) => p.id === form.loanProductId)
                  const n = Number(amount)
                  const terms = Number(form.termCount)
                  if (product && n > 0 && terms > 0) {
                    setForm({
                      ...form,
                      amount,
                      ...feeFieldsFromPrincipal(n, terms, selected?.cycle),
                      termCount: form.termCount,
                    })
                    return
                  }
                  setForm({ ...form, amount })
                }}
                required
                disabled={!canManage || !readyForTerms}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Interest % *</label>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                type="number"
                min="0"
                step="0.01"
                value={form.interestRatePercent}
                onChange={(e) => setForm({ ...form, interestRatePercent: e.target.value })}
                required
                disabled={!canManage || !readyForTerms}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Term count *</label>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                type="number"
                min="1"
                value={form.termCount}
                onChange={(e) => {
                  const termCount = e.target.value
                  const product = products.find((p) => p.id === form.loanProductId)
                  const n = Number(form.amount)
                  const terms = Number(termCount)
                  if (product && n > 0 && terms > 0) {
                    setForm({
                      ...form,
                      ...feeFieldsFromPrincipal(n, terms, selected?.cycle),
                      termCount,
                    })
                    return
                  }
                  setForm({ ...form, termCount })
                }}
                required
                disabled={!canManage || !readyForTerms}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Frequency *</label>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form.paymentFrequency}
                onChange={(e) => setForm({ ...form, paymentFrequency: e.target.value })}
                disabled={!canManage || !readyForTerms}
              >
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
                <option value="BiWeekly">Bi-weekly</option>
                <option value="Monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Interest method *</label>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form.interestMethod}
                onChange={(e) => setForm({ ...form, interestMethod: e.target.value })}
                disabled={!canManage || !readyForTerms}
              >
                <option value="Flat">Flat interest</option>
                <option value="DecliningBalance">Declining balance</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                First day of payment *
              </label>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                type="date"
                value={form.firstDueDate}
                onChange={(e) => setForm({ ...form, firstDueDate: e.target.value })}
                required
                disabled={!canManage || !readyForTerms}
              />
              <span className="mt-0.5 block text-[11px] text-slate-500">
                Date of the first installment
              </span>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Notes</label>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                disabled={!canManage || !readyForTerms}
              />
            </div>
          </div>

          <LoanChargeFields form={form} setForm={setForm} disabled={!canManage || !readyForTerms} />

          {Number(form.amount) > 0 && Number(form.termCount) > 0 && (
            <LoanProceedsBreakdown
              values={{
                amount: Number(form.amount),
                termCount: Number(form.termCount),
                paymentFrequency: form.paymentFrequency,
                ...chargePayloadFrom(form),
                totalDeductions: selected?.totalDeductions,
                netProceeds: selected?.netProceeds,
                ...dailyPaymentLines({
                  amount: Number(form.amount),
                  termCount: Number(form.termCount),
                  interestRatePercent: Number(form.interestRatePercent || 0),
                  savingsPerPeriod: Number(form.savingsPerPeriod || 0),
                  insurancePerPeriod: Number(form.insurancePerPeriod || 0),
                }),
              }}
            />
          )}

          {selected?.hasTerms && (
            <div className="grid gap-3 rounded-lg bg-slate-50 p-3 text-sm md:grid-cols-5">
              <div>
                <div className="text-xs text-slate-500">Interest</div>
                <div className="font-medium">{money(selected.interestAmount)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Total payable</div>
                <div className="font-medium">{money(selected.totalPayable)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Installment</div>
                <div className="font-medium">{money(selected.installmentAmount)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Net proceeds</div>
                <div className="font-medium">{money(selected.netProceeds ?? 0)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Remaining</div>
                <div className="font-medium">{money(selected.remainingBalance)}</div>
              </div>
            </div>
          )}

          {canManage && readyForTerms && (
            <ActionButton type="submit" loading={busy} loadingText="Saving…">
              Save terms & generate schedule
            </ActionButton>
          )}
        </form>
      )}

      {schedule.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Due</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Principal</th>
                <th className="px-3 py-2 font-medium">Interest</th>
                <th className="px-3 py-2 font-medium">Savings</th>
                <th className="px-3 py-2 font-medium">Insurance</th>
                <th className="px-3 py-2 font-medium">Penalty</th>
                <th className="px-3 py-2 font-medium">Paid</th>
                <th className="px-3 py-2 font-medium">Balance</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{s.installmentNumber}</td>
                  <td className="px-3 py-2">{dateOnly(s.dueDate)}</td>
                  <td className="px-3 py-2">{money(s.amountDue)}</td>
                  <td className="px-3 py-2">{money(s.principalPortion)}</td>
                  <td className="px-3 py-2">{money(s.interestPortion)}</td>
                  <td className="px-3 py-2">{money(s.savingsPortion ?? 0)}</td>
                  <td className="px-3 py-2">{money(s.insurancePortion ?? 0)}</td>
                  <td className="px-3 py-2">{s.penaltyAmount ? money(s.penaltyAmount) : '—'}</td>
                  <td className="px-3 py-2">{money(s.paidAmount)}</td>
                  <td className="px-3 py-2 font-medium">{money(s.balance)}</td>
                  <td className="px-3 py-2">
                    <StatusTag status={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function PaymentSummaryPanel({ customerId, onError }: SharedProps) {
  const [summary, setSummary] = useState<CustomerPaymentSummary | null>(null)

  useEffect(() => {
    api<CustomerPaymentSummary>(`/api/customers/${customerId}/payment-summary`)
      .then(setSummary)
      .catch((err) => onError(err instanceof Error ? err.message : 'Failed to load summary'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId])

  if (!summary) return <PageLoading label="Loading summary..." compact />

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total principal" value={money(summary.totalPrincipal)} />
        <SummaryCard label="Total payable" value={money(summary.totalPayable)} />
        <SummaryCard label="Total paid" value={money(summary.totalPaid)} />
        <SummaryCard label="Remaining" value={money(summary.remainingBalance)} />
        <SummaryCard label="Overdue amount" value={money(summary.overdueAmount)} tone="warn" />
        <SummaryCard label="Overdue installments" value={String(summary.overdueCount)} tone="warn" />
        <SummaryCard label="Loans" value={String(summary.loanCount)} />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Loan</th>
              <th className="px-3 py-2 font-medium">Payable</th>
              <th className="px-3 py-2 font-medium">Paid</th>
              <th className="px-3 py-2 font-medium">Remaining</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {summary.loans.map((l) => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">{l.loanNumber}</td>
                <td className="px-3 py-2">{money(l.totalPayable)}</td>
                <td className="px-3 py-2">{money(l.totalPaid)}</td>
                <td className="px-3 py-2">{money(l.remainingBalance)}</td>
                <td className="px-3 py-2">
                  <StatusTag status={l.status} />
                </td>
              </tr>
            ))}
            {summary.loans.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-slate-500" colSpan={5}>
                  No loans yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function defaultPayAmount(schedule: LoanScheduleItem[], installmentAmount?: number) {
  const open = schedule.find((s) => s.balance > 0)
  if (open) return open.amountDue.toFixed(2)
  if (installmentAmount != null && installmentAmount > 0) return installmentAmount.toFixed(2)
  return ''
}

function pickCollectableLoan(list: Loan[], preferredId?: number | null) {
  if (preferredId != null && list.some((l) => l.id === preferredId)) return preferredId
  const withBalance = list.filter((l) => l.remainingBalance > 0 && l.hasTerms)
  const active =
    withBalance.find((l) => /active|approved|disbursed|released/i.test(l.status)) ?? withBalance[0]
  return active?.id ?? withBalance[0]?.id ?? list.find((l) => l.remainingBalance > 0)?.id ?? list[0]?.id ?? ''
}

export function RecordPaymentPanel({
  customerId,
  onError,
  onMessage,
  preferredLoanId,
  compact,
}: SharedProps & { preferredLoanId?: number | null; compact?: boolean }) {
  const { can } = useAuth()
  const canManage = can('loans.manage')
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [loanId, setLoanId] = useState<number | ''>('')
  const [payments, setPayments] = useState<LoanPayment[]>([])
  const [schedule, setSchedule] = useState<LoanScheduleItem[]>([])
  const [busy, setBusy] = useState(false)
  const [payForm, setPayForm] = useState({
    amount: '',
    paidAt: new Date().toISOString().slice(0, 10),
    method: 'Cash',
    reference: '',
    notes: '',
    useExtraSavings: false,
  })

  const load = async () => {
    setLoading(true)
    try {
      const list = await api<Loan[]>(`/api/customers/${customerId}/loans`)
      setLoans(list)
      setLoanId((current) => {
        if (current !== '' && list.some((l) => l.id === current)) return current
        return pickCollectableLoan(list, preferredLoanId)
      })
    } finally {
      setLoading(false)
    }
  }

  const loadLoanDetail = async (id: number) => {
    const detail = await api<LoanDetailBundle>(`/api/customers/${customerId}/loans/${id}`)
    setPayments(detail.payments)
    setSchedule(detail.schedule)
    setPayForm((prev) => ({
      ...prev,
      amount: prev.amount || defaultPayAmount(detail.schedule, detail.loan.installmentAmount),
    }))
  }

  useEffect(() => {
    setLoanId('')
    setPayments([])
    setSchedule([])
    setPayForm((prev) => ({ ...prev, amount: '', reference: '', notes: '' }))
    load().catch((err) => onError(err instanceof Error ? err.message : 'Failed to load loans'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId])

  useEffect(() => {
    if (loanId === '') {
      setPayments([])
      setSchedule([])
      return
    }
    setPayForm((prev) => ({ ...prev, amount: '' }))
    loadLoanDetail(loanId).catch((err) => onError(err instanceof Error ? err.message : 'Failed to load payments'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loanId])

  const onPay = async (e: FormEvent) => {
    e.preventDefault()
    if (loanId === '') return
    setBusy(true)
    try {
      await api(`/api/customers/${customerId}/loans/${loanId}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(payForm.amount),
          paidAt: payForm.paidAt || null,
          method: payForm.method || null,
          reference: payForm.reference || null,
          notes: payForm.notes || null,
          useExtraSavings: payForm.useExtraSavings,
        }),
      })
      setPayForm((prev) => ({ ...prev, amount: '', reference: '', notes: '', useExtraSavings: false }))
      onMessage('Payment recorded.')
      await load()
      await loadLoanDetail(loanId)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Payment failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading && loans.length === 0) return <PageLoading label="Loading payments..." compact />

  const selected = loans.find((l) => l.id === loanId)
  const nextDue = schedule.find((s) => s.balance > 0)
  const collectable = loans.filter((l) => l.remainingBalance > 0)

  return (
    <div className="space-y-5">
      {!compact && (
        <div>
          <h4 className="text-sm font-semibold text-slate-800">Record payment</h4>
          <p className="mt-1 text-sm text-slate-500">
            Post office or field collections against a loan, then review recent payment history.
          </p>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600">Loan</label>
        <select
          className="w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={loanId === '' ? '' : String(loanId)}
          onChange={(e) => setLoanId(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">Select loan</option>
          {(collectable.length > 0 ? collectable : loans).map((l) => (
            <option key={l.id} value={l.id}>
              {l.loanNumber} — {l.status} — remaining {money(l.remainingBalance)}
            </option>
          ))}
        </select>
        {collectable.length > 0 && collectable.length < loans.length && (
          <p className="mt-1 text-xs text-slate-500">Showing loans with remaining balance first.</p>
        )}
      </div>

      {selected && (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <SummaryCard label="Payable" value={money(selected.totalPayable)} />
          <SummaryCard label="Paid" value={money(selected.totalPaid)} />
          <SummaryCard label="Remaining" value={money(selected.remainingBalance)} />
          <SummaryCard label="Primary savings" value={money(selected.primarySavingsBalance ?? 0)} />
          <SummaryCard label="Extra savings" value={money(selected.extraSavingsBalance ?? 0)} />
        </div>
      )}

      {nextDue && (
        <p className="text-sm text-slate-600">
          Next installment #{nextDue.installmentNumber} due {dateOnly(nextDue.dueDate)}:{' '}
          <strong>{money(nextDue.amountDue)}</strong>
          {nextDue.balance !== nextDue.amountDue ? ` · open balance ${money(nextDue.balance)}` : ''}
        </p>
      )}

      {loanId === '' ? (
        <p className="text-sm text-slate-500">Select a loan to record a payment.</p>
      ) : !canManage ? (
        <p className="text-sm text-slate-500">You do not have permission to record payments.</p>
      ) : (
        <form onSubmit={onPay} className="grid gap-3 rounded-lg border border-slate-200 p-4 md:grid-cols-3">
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount *"
            value={payForm.amount}
            onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
            required
            autoFocus={compact}
          />
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            type="date"
            value={payForm.paidAt}
            onChange={(e) => setPayForm({ ...payForm, paidAt: e.target.value })}
          />
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Method"
            value={payForm.method}
            onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}
          />
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Reference"
            value={payForm.reference}
            onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
            <input
              type="checkbox"
              checked={payForm.useExtraSavings}
              disabled={(selected?.extraSavingsBalance ?? 0) <= 0}
              onChange={(e) => setPayForm({ ...payForm, useExtraSavings: e.target.checked })}
            />
            Use extra (daily) savings to cover shortfall — primary (initial) savings are never deducted
          </label>
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2"
            placeholder="Notes"
            value={payForm.notes}
            onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
          />
          <ActionButton type="submit" loading={busy} loadingText="Saving…">
            Post payment
          </ActionButton>
        </form>
      )}

      {loanId !== '' && (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Method</th>
                <th className="px-3 py-2 font-medium">Reference</th>
                <th className="px-3 py-2 font-medium">By</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{dateOnly(p.paidAt)}</td>
                  <td className="px-3 py-2">{money(p.amount)}</td>
                  <td className="px-3 py-2">{p.method || '—'}</td>
                  <td className="px-3 py-2">{p.reference || '—'}</td>
                  <td className="px-3 py-2">{p.recordedBy}</td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-slate-500" colSpan={5}>
                    No payments recorded for this loan yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

type LoanOption = { id: number; loanNumber: string; status: string }

export function StatementOfAccountPanel({ customerId, onError, onMessage }: SharedProps) {
  const { can } = useAuth()
  const canManageLoans = can('loans.manage')
  const [loans, setLoans] = useState<LoanOption[]>([])
  const [loanId, setLoanId] = useState<number | ''>('')
  const [lateFeeLoanId, setLateFeeLoanId] = useState<number | ''>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [statement, setStatement] = useState<StatementOfAccount | null>(null)
  const [loading, setLoading] = useState(false)
  const [lateFeeAmount, setLateFeeAmount] = useState('')
  const [lateFeeNotes, setLateFeeNotes] = useState('')
  const [lateFeeBusy, setLateFeeBusy] = useState(false)

  const lateFeeLoan = lateFeeLoanId === '' ? null : loans.find((l) => l.id === lateFeeLoanId) ?? null

  useEffect(() => {
    setLoanId('')
    setLateFeeLoanId('')
    setFrom('')
    setTo('')
    setStatement(null)
    setLateFeeAmount('')
    setLateFeeNotes('')
    api<LoanOption[]>(`/api/customers/${customerId}/loan-options`)
      .then(setLoans)
      .catch((err) => onError(err instanceof Error ? err.message : 'Failed to load loans'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId])

  const loadStatement = async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (loanId !== '') qs.set('loanId', String(loanId))
      if (from) qs.set('from', from)
      if (to) qs.set('to', to)
      const q = qs.toString()
      setStatement(await api<StatementOfAccount>(`/api/customers/${customerId}/statement${q ? `?${q}` : ''}`))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load statement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadStatement()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId])

  const addLateFee = async () => {
    if (lateFeeLoanId === '') {
      onError('Select the loan # for this late fee.')
      return
    }
    const amount = Number(lateFeeAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      onError('Enter a late fee amount greater than zero.')
      return
    }
    setLateFeeBusy(true)
    try {
      await api(`/api/customers/${customerId}/loans/${lateFeeLoanId}/late-fees`, {
        method: 'POST',
        body: JSON.stringify({
          amount,
          notes: lateFeeNotes.trim() || null,
        }),
      })
      const loanNo = lateFeeLoan?.loanNumber ?? `#${lateFeeLoanId}`
      setLateFeeAmount('')
      setLateFeeNotes('')
      onMessage(`Late fee added to loan ${loanNo}.`)
      await loadStatement()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to add late fee')
    } finally {
      setLateFeeBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Loan filter</label>
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={loanId === '' ? '' : String(loanId)}
            onChange={(e) => setLoanId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">All loans</option>
            {loans.map((l) => (
              <option key={l.id} value={l.id}>
                {l.loanNumber}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">From</label>
          <input
            type="date"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">To</label>
          <input
            type="date"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <ActionButton type="button" loading={loading} loadingText="Loading…" onClick={() => void loadStatement()}>
          Apply / Refresh
        </ActionButton>
        <ActionButton type="button" onClick={() => window.print()} disabled={!statement}>
          Print
        </ActionButton>
      </div>

      {canManageLoans && (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 print:hidden">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Loan # (late fee)</label>
            <select
              className="min-w-[14rem] rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={lateFeeLoanId === '' ? '' : String(lateFeeLoanId)}
              onChange={(e) => setLateFeeLoanId(e.target.value ? Number(e.target.value) : '')}
              required
            >
              <option value="">Select loan #…</option>
              {loans.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.loanNumber} ({l.status})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Late fee amount</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              placeholder="Amount"
              className="w-40 rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={lateFeeAmount}
              onChange={(e) => setLateFeeAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
            <input
              type="text"
              placeholder="Optional"
              className="w-48 rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={lateFeeNotes}
              onChange={(e) => setLateFeeNotes(e.target.value)}
            />
          </div>
          <ActionButton
            type="button"
            loading={lateFeeBusy}
            loadingText="Saving…"
            disabled={lateFeeLoanId === '' || !lateFeeAmount}
            onClick={() => void addLateFee()}
          >
            {lateFeeLoan
              ? `Add late fee to ${lateFeeLoan.loanNumber}`
              : 'Add late fee'}
          </ActionButton>
        </div>
      )}

      {statement && (
        <div className="statement-print-root space-y-3 rounded-xl border border-slate-200 bg-white p-5 print:border-0 print:p-0 print:shadow-none">
          <div>
            <h3 className="text-lg font-semibold">Statement of Account</h3>
            <p className="text-sm text-slate-500">
              {statement.customerName}
              {statement.loanNumber ? ` · ${statement.loanNumber}` : ' · All loans'} · Generated{' '}
              {new Date(statement.generatedAt).toLocaleString()}
              {from || to ? ` · ${from || '…'} → ${to || '…'}` : ''}
            </p>
          </div>
          {(from || to) && (
            <div className="text-sm text-slate-600">Opening balance: {money(statement.openingBalance)}</div>
          )}
          <div className="overflow-hidden rounded-lg border border-slate-200 print:overflow-visible print:rounded-none">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Loan #</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium text-right">Debit</th>
                  <th className="px-3 py-2 font-medium text-right">Credit</th>
                  <th className="px-3 py-2 font-medium text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {statement.lines.map((line, idx) => (
                  <tr
                    key={`${line.date}-${idx}`}
                    className={`border-t border-slate-100 ${
                      line.type === 'LateFee' ? 'bg-amber-50/70' : ''
                    }`}
                  >
                    <td className="px-3 py-2">{dateOnly(line.date)}</td>
                    <td className="px-3 py-2 font-medium">
                      {line.loanId && line.loanNumber ? (
                        <Link
                          to={`/lending/loans/${line.loanId}/agreement`}
                          className="text-sky-700 underline-offset-2 hover:underline print:text-slate-900 print:no-underline"
                        >
                          {line.loanNumber}
                        </Link>
                      ) : (
                        line.loanNumber || '—'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatusTag status={line.type} />
                    </td>
                    <td className="px-3 py-2">{line.description}</td>
                    <td className="px-3 py-2 text-right">{line.debit ? money(line.debit) : '—'}</td>
                    <td className="px-3 py-2 text-right">{line.credit ? money(line.credit) : '—'}</td>
                    <td className="px-3 py-2 text-right font-medium">{money(line.balance)}</td>
                  </tr>
                ))}
                {statement.lines.length === 0 && (
                  <tr>
                    <td className="px-3 py-4 text-slate-500" colSpan={7}>
                      No charges, payments, or savings records in this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {(from || to) && (
            <div className="text-right text-sm text-slate-600">
              Statement closing (loan running): {money(statement.closingBalance)}
            </div>
          )}
          <div className="grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Loan balance</div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                {money(statement.loanBalance ?? statement.closingBalance)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Primary balance</div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                {money(statement.primarySavingsBalance ?? 0)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Extra balance</div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                {money(statement.extraSavingsBalance ?? 0)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function CustomerSavingsPanel({ customerId, onError, onMessage }: SharedProps) {
  const { can } = useAuth()
  const canManage = can('loans.manage') || can('field.collect')
  const [summary, setSummary] = useState<CustomerSavingsSummary | null>(null)
  const [kind, setKind] = useState<'All' | 'Primary' | 'Extra'>('All')
  const [loading, setLoading] = useState(true)
  const [depositLoanId, setDepositLoanId] = useState<number | ''>('')
  const [depositAmount, setDepositAmount] = useState('')
  const [depositNotes, setDepositNotes] = useState('')
  const [depositBusy, setDepositBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const qs = kind === 'All' ? '' : `?kind=${kind}`
      setSummary(await api<CustomerSavingsSummary>(`/api/customers/${customerId}/savings${qs}`))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load savings')
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, kind])

  const onDeposit = async (e: FormEvent) => {
    e.preventDefault()
    if (depositLoanId === '') {
      onError('Select a loan for the extra savings deposit.')
      return
    }
    const amount = Number(depositAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      onError('Enter an amount greater than zero.')
      return
    }
    setDepositBusy(true)
    try {
      await api(`/api/customers/${customerId}/loans/${depositLoanId}/extra-savings`, {
        method: 'POST',
        body: JSON.stringify({ amount, notes: depositNotes || null }),
      })
      setDepositAmount('')
      setDepositNotes('')
      onMessage('Extra savings deposited.')
      await load()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Deposit failed')
    } finally {
      setDepositBusy(false)
    }
  }

  if (loading && !summary) return <PageLoading label="Loading savings..." compact />
  if (!summary) return <p className="text-sm text-slate-500">No savings data.</p>

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Primary savings balance" value={money(summary.primaryBalance)} />
        <SummaryCard label="Extra savings balance" value={money(summary.extraBalance)} />
        <SummaryCard label="Total savings" value={money(summary.totalBalance)} />
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-slate-800">Balances by loan</h4>
        <div className="overflow-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Loan</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium text-right">Primary</th>
                <th className="px-3 py-2 font-medium text-right">Extra</th>
                <th className="px-3 py-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {summary.loans.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-slate-500" colSpan={5}>
                    No loans yet.
                  </td>
                </tr>
              ) : (
                summary.loans.map((l) => (
                  <tr key={l.loanId} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium">{l.loanNumber}</td>
                    <td className="px-3 py-2">
                      <StatusTag status={l.status} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(l.primaryBalance)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(l.extraBalance)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {money(l.primaryBalance + l.extraBalance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {canManage && summary.loans.length > 0 && (
        <form
          onSubmit={onDeposit}
          className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-4"
        >
          <div className="sm:col-span-4 text-sm font-semibold text-slate-800">Add extra savings</div>
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={depositLoanId === '' ? '' : String(depositLoanId)}
            onChange={(e) => setDepositLoanId(e.target.value ? Number(e.target.value) : '')}
            required
          >
            <option value="">Select loan</option>
            {summary.loans.map((l) => (
              <option key={l.loanId} value={l.loanId}>
                {l.loanNumber}
              </option>
            ))}
          </select>
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Amount *"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            required
          />
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
            placeholder="Notes (optional)"
            value={depositNotes}
            onChange={(e) => setDepositNotes(e.target.value)}
          />
          <ActionButton type="submit" loading={depositBusy} loadingText="Saving…">
            Deposit extra savings
          </ActionButton>
        </form>
      )}

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-slate-800">Savings history</h4>
          <select
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as 'All' | 'Primary' | 'Extra')}
          >
            <option value="All">All (primary + extra)</option>
            <option value="Primary">Primary only</option>
            <option value="Extra">Extra only</option>
          </select>
        </div>
        <div className="overflow-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Loan</th>
                <th className="px-3 py-2 font-medium">Kind</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium text-right">Amount</th>
                <th className="px-3 py-2 font-medium text-right">Balance after</th>
                <th className="px-3 py-2 font-medium">Notes</th>
                <th className="px-3 py-2 font-medium">By</th>
              </tr>
            </thead>
            <tbody>
              {summary.transactions.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-slate-500" colSpan={8}>
                    No savings transactions yet.
                  </td>
                </tr>
              ) : (
                summary.transactions.map((t) => (
                  <tr key={t.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(t.occurredAt).toLocaleString()}</td>
                    <td className="px-3 py-2">{t.loanNumber}</td>
                    <td className="px-3 py-2">{t.kind}</td>
                    <td className="px-3 py-2">{t.type}</td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        t.amount < 0 ? 'text-rose-700' : 'text-emerald-700'
                      }`}
                    >
                      {money(t.amount)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(t.balanceAfter)}</td>
                    <td className="px-3 py-2 text-slate-600">{t.notes || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{t.recordedBy || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'warn'
}) {
  return (
    <div className={`rounded-lg border p-3 ${tone === 'warn' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-800">{value}</div>
    </div>
  )
}
