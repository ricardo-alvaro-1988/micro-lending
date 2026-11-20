import type { CustomerDetail, Loan, LoanCollateral, LoanScheduleItem } from '../types'
import { amountInWords } from '../lib/numberToWords'

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const dateOnly = (value?: string | null) => {
  if (!value) return '____________________'
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function frequencyUnit(freq: string) {
  const key = freq.replace(/[\s_-]/g, '').toLowerCase()
  if (key === 'daily') return 'day'
  if (key === 'weekly') return 'week'
  if (key === 'biweekly' || key === 'fortnightly') return 'two weeks'
  if (key === 'monthly') return 'month'
  return freq.toLowerCase() || 'period'
}

function blank(value?: string | null, width = 28) {
  const t = (value ?? '').trim()
  if (t) return t
  return '_'.repeat(width)
}

type Props = {
  loan: Loan
  customer: CustomerDetail
  schedule: LoanScheduleItem[]
  collaterals?: LoanCollateral[]
  printDate?: Date
}

export function LoanAgreementPrintView({
  loan,
  customer,
  schedule,
  collaterals = [],
  printDate = new Date(),
}: Props) {
  const company = 'GOLDEN HEARTS MICROFINANCE INC.'
  const faceAmount = loan.totalPayable > 0 ? loan.totalPayable : loan.amount
  const installment = loan.installmentAmount
  const freqWord = frequencyUnit(loan.paymentFrequency)
  const place =
    [customer.city, customer.province].filter(Boolean).join(', ') ||
    customer.addressDisplay ||
    ''
  const day = printDate.getDate()
  const monthYear = printDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const pledged = collaterals.filter((c) => c.descriptionOrKind?.trim())

  return (
    <div className="agreement-print-root mx-auto max-w-[210mm] bg-white text-[12px] leading-relaxed text-slate-900">
      <header className="mb-4 text-center">
        <h1 className="text-base font-bold tracking-wide uppercase">{company}</h1>
        <div className="mt-1 text-right text-[11px]">Date: {dateOnly(printDate.toISOString())}</div>
        <div className="mt-1 text-[11px] text-slate-600">
          Loan {loan.loanNumber}
          {customer.branchName ? ` · ${customer.branchName}` : ''}
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-center text-sm font-bold uppercase tracking-wide">
          Terms and conditions · Contract of loan
        </h2>

        <p className="text-justify">
          I hereby certify that the foregoing application of loan and the statements therein are true and
          correct to the best of my knowledge and belief. I hereby authorize the personnel of {company}{' '}
          (Branch Manager / Account Officer) to verify the correctness of my statements and references
          relative to my application for a loan.
        </p>

        <p className="text-justify">
          I hereby acknowledge that whatever outcome, risk, or fallout that may arise from this loan shall
          be my personal responsibility and accountability.
        </p>

        <p className="text-justify">
          I hereby agree that in case of non-payment of this loan, {company} has the right to seize and
          forfeit any property I have pledged as collateral
          {pledged.length > 0
            ? ` (${pledged.map((c) => c.descriptionOrKind).join('; ')})`
            : ''}
          . Additionally, {company} will require me to pay extra 4% interest if I am unable to pay off my
          loan in full within two months of its maturity.
        </p>

        <p className="text-justify">
          I further agree that if a lawsuit is filed for the collection of this loan, I shall be liable for
          attorney&apos;s fees, court costs, and other expenses of litigation.
        </p>

        <p className="pt-1">
          In witness whereof, we have hereunto set our hands this day of {day}{' '}
          {blank(monthYear, 18)}, at {blank(place, 24)}, Philippines.
        </p>

        <div className="grid grid-cols-2 gap-8 pt-8">
          <div className="text-center">
            <div className="mx-auto mb-1 h-10 w-4/5 border-b border-slate-800" />
            <div className="text-[10px] font-semibold uppercase">
              Borrower&apos;s signature over printed name
            </div>
            <div className="mt-1 text-[11px]">{customer.fullName}</div>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-1 h-10 w-4/5 border-b border-slate-800" />
            <div className="text-[10px] font-semibold uppercase">
              Spouse signature over printed name
            </div>
            <div className="mt-1 text-[11px]">{customer.spouseName || '—'}</div>
          </div>
        </div>
        <div className="mx-auto max-w-xs pt-6 text-center">
          <div className="mx-auto mb-1 h-10 w-4/5 border-b border-slate-800" />
          <div className="text-[10px] font-semibold uppercase">
            Co-maker&apos;s signature over printed name
          </div>
          <div className="mt-1 text-[11px]">{customer.coMakerName || '—'}</div>
        </div>
      </section>

      <section className="mt-8 space-y-3 break-inside-avoid">
        <h2 className="text-center text-sm font-bold uppercase tracking-wide">Promissory Note</h2>

        <p className="text-justify">
          For value I received, I, Mr/Mrs. <strong>{blank(customer.fullName, 32)}</strong>, resident of{' '}
          <strong>{blank(customer.addressDisplay, 40)}</strong>, agree and promise to pay {company}, in
          the sum of <strong>{blank(amountInWords(faceAmount), 48)}</strong> (P{' '}
          <strong>{money(faceAmount)}</strong>).
        </p>

        <p className="text-justify">
          Repayment is to be made in installment of <strong>{money(installment)}</strong> per{' '}
          <strong>{freqWord}</strong>, until the obligation has been fulfilled
          {loan.termCount ? ` (${loan.termCount} installments)` : ''}.
          {loan.firstDueDate ? ` First day of payment: ${dateOnly(loan.firstDueDate)}.` : ''}
        </p>

        <p className="text-justify">
          If this note is in default and is placed for collection, Mr./Mrs.{' '}
          <strong>{blank(customer.fullName, 28)}</strong> shall pay all reasonable costs of collection and
          attorney&apos;s fee.
        </p>

        <div className="mx-auto max-w-xs pt-8 text-center">
          <div className="mx-auto mb-1 h-10 w-4/5 border-b border-slate-800" />
          <div className="text-[10px] font-semibold uppercase">Affiant</div>
          <div className="mt-1 text-[11px]">{customer.fullName}</div>
        </div>

        <div className="grid grid-cols-2 gap-8 pt-8">
          <div className="text-center">
            <div className="text-[10px] font-medium uppercase text-slate-600">Witnessed by:</div>
            <div className="mx-auto mb-1 mt-6 h-10 w-4/5 border-b border-slate-800" />
            <div className="text-[10px] font-semibold uppercase">
              Co-maker&apos;s signature over printed name
            </div>
            <div className="mt-1 text-[11px]">{customer.coMakerName || '—'}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] font-medium uppercase text-slate-600">&nbsp;</div>
            <div className="mx-auto mb-1 mt-6 h-10 w-4/5 border-b border-slate-800" />
            <div className="text-[10px] font-semibold uppercase">Branch Manager</div>
          </div>
        </div>

        <div className="pt-10 text-right">
          <div className="inline-block min-w-[10rem] text-center">
            <div className="mb-1 h-10 border-b border-slate-800" />
            <div className="text-[10px] font-semibold uppercase">Notary Public</div>
          </div>
        </div>
      </section>

      <section className="mt-10 break-before-page space-y-3">
        <h2 className="text-center text-sm font-bold uppercase tracking-wide">
          Loan terms &amp; payment schedule
        </h2>

        <table className="w-full border-collapse text-[11px]">
          <tbody>
            <tr>
              <td className="border border-slate-300 px-2 py-1.5 font-medium w-1/3">Loan number</td>
              <td className="border border-slate-300 px-2 py-1.5">{loan.loanNumber}</td>
              <td className="border border-slate-300 px-2 py-1.5 font-medium w-1/3">Product</td>
              <td className="border border-slate-300 px-2 py-1.5">{loan.loanProductName || '—'}</td>
            </tr>
            <tr>
              <td className="border border-slate-300 px-2 py-1.5 font-medium">Borrower</td>
              <td className="border border-slate-300 px-2 py-1.5" colSpan={3}>
                {customer.fullName}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-300 px-2 py-1.5 font-medium">Address</td>
              <td className="border border-slate-300 px-2 py-1.5" colSpan={3}>
                {customer.addressDisplay || '—'}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-300 px-2 py-1.5 font-medium">Principal</td>
              <td className="border border-slate-300 px-2 py-1.5 tabular-nums">{money(loan.amount)}</td>
              <td className="border border-slate-300 px-2 py-1.5 font-medium">Interest rate</td>
              <td className="border border-slate-300 px-2 py-1.5">{loan.interestRatePercent}%</td>
            </tr>
            <tr>
              <td className="border border-slate-300 px-2 py-1.5 font-medium">Interest amount</td>
              <td className="border border-slate-300 px-2 py-1.5 tabular-nums">
                {money(loan.interestAmount)}
              </td>
              <td className="border border-slate-300 px-2 py-1.5 font-medium">Total payable</td>
              <td className="border border-slate-300 px-2 py-1.5 tabular-nums font-semibold">
                {money(loan.totalPayable)}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-300 px-2 py-1.5 font-medium">Terms</td>
              <td className="border border-slate-300 px-2 py-1.5">
                {loan.termCount} × {loan.paymentFrequency}
              </td>
              <td className="border border-slate-300 px-2 py-1.5 font-medium">Installment</td>
              <td className="border border-slate-300 px-2 py-1.5 tabular-nums">
                {money(loan.installmentAmount)} / {freqWord}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-300 px-2 py-1.5 font-medium">First day of payment</td>
              <td className="border border-slate-300 px-2 py-1.5">{dateOnly(loan.firstDueDate)}</td>
              <td className="border border-slate-300 px-2 py-1.5 font-medium">Net proceeds</td>
              <td className="border border-slate-300 px-2 py-1.5 tabular-nums">
                {money(loan.netProceeds ?? 0)}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-300 px-2 py-1.5 font-medium">Loan type</td>
              <td className="border border-slate-300 px-2 py-1.5">{loan.loanType || '—'}</td>
              <td className="border border-slate-300 px-2 py-1.5 font-medium">Application</td>
              <td className="border border-slate-300 px-2 py-1.5">
                {loan.applicationType || '—'}
                {loan.cycle != null ? ` · Cycle ${loan.cycle}` : ''}
              </td>
            </tr>
          </tbody>
        </table>

        <h3 className="pt-2 text-xs font-bold uppercase tracking-wide">Payment schedule</h3>
        {schedule.length === 0 ? (
          <p className="text-[11px] text-slate-600">No payment schedule generated yet.</p>
        ) : (
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-300 px-1.5 py-1 text-left font-semibold">#</th>
                <th className="border border-slate-300 px-1.5 py-1 text-left font-semibold">Due date</th>
                <th className="border border-slate-300 px-1.5 py-1 text-right font-semibold">Amount due</th>
                <th className="border border-slate-300 px-1.5 py-1 text-right font-semibold">Principal</th>
                <th className="border border-slate-300 px-1.5 py-1 text-right font-semibold">Interest</th>
                <th className="border border-slate-300 px-1.5 py-1 text-right font-semibold">Savings</th>
                <th className="border border-slate-300 px-1.5 py-1 text-right font-semibold">Insurance</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((row) => (
                <tr key={row.id ?? row.installmentNumber} className="break-inside-avoid">
                  <td className="border border-slate-300 px-1.5 py-0.5">{row.installmentNumber}</td>
                  <td className="border border-slate-300 px-1.5 py-0.5">{dateOnly(row.dueDate)}</td>
                  <td className="border border-slate-300 px-1.5 py-0.5 text-right tabular-nums">
                    {money(row.amountDue)}
                  </td>
                  <td className="border border-slate-300 px-1.5 py-0.5 text-right tabular-nums">
                    {money(row.principalPortion)}
                  </td>
                  <td className="border border-slate-300 px-1.5 py-0.5 text-right tabular-nums">
                    {money(row.interestPortion)}
                  </td>
                  <td className="border border-slate-300 px-1.5 py-0.5 text-right tabular-nums">
                    {money(row.savingsPortion ?? 0)}
                  </td>
                  <td className="border border-slate-300 px-1.5 py-0.5 text-right tabular-nums">
                    {money(row.insurancePortion ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
