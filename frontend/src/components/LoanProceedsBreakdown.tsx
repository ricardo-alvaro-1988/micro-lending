const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export type LoanProceedsValues = {
  amount: number
  termCount: number
  paymentFrequency: string
  insuranceAmount?: number
  initialSavings?: number
  membershipFee?: number
  processingFee?: number
  loanRedemptionFee?: number
  taxes?: number
  notarialFee?: number
  raffle?: number
  totalDeductions?: number
  netProceeds?: number
  principalPerPeriod?: number
  interestPerPeriod?: number
  savingsPerPeriod?: number
  insurancePerPeriod?: number
  installmentAmount?: number
}

function Row({
  label,
  value,
  strong,
  underline,
}: {
  label: string
  value: string
  strong?: boolean
  underline?: boolean
}) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${strong ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <span className={`tabular-nums ${underline ? 'underline decoration-slate-400 underline-offset-2' : ''}`}>
        {value}
      </span>
    </div>
  )
}

export function LoanProceedsBreakdown({ values }: { values: LoanProceedsValues }) {
  const deductions =
    values.totalDeductions ??
    (values.membershipFee ?? 0) +
      (values.processingFee ?? 0) +
      (values.loanRedemptionFee ?? 0) +
      (values.taxes ?? 0) +
      (values.notarialFee ?? 0) +
      (values.raffle ?? 0)
  const net = values.netProceeds ?? values.amount - deductions
  const periodLabel =
    values.paymentFrequency?.toLowerCase() === 'daily'
      ? 'Daily'
      : values.paymentFrequency?.toLowerCase() === 'weekly'
        ? 'Weekly'
        : values.paymentFrequency?.toLowerCase() === 'biweekly'
          ? 'Bi-weekly'
          : 'Monthly'
  const installment =
    values.installmentAmount ??
    (values.principalPerPeriod ?? 0) +
      (values.interestPerPeriod ?? 0) +
      (values.savingsPerPeriod ?? 0) +
      (values.insurancePerPeriod ?? 0)

  return (
    <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Row label="Loan amount" value={money(values.amount)} />
        <Row
          label="Terms / duration"
          value={`${values.termCount} ${periodLabel === 'Daily' ? 'DAYS' : 'PERIODS'}`}
          underline
        />
        <Row label="Schedule of payment" value={periodLabel.toUpperCase()} />
        <div className="border-t border-slate-200 pt-2">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {periodLabel} payment
          </div>
          <div className="space-y-1.5">
            <Row label="Principal" value={money(values.principalPerPeriod ?? 0)} />
            <Row label="Interest" value={money(values.interestPerPeriod ?? 0)} />
            <Row label="Savings" value={money(values.savingsPerPeriod ?? 0)} />
            <Row label="Insurance" value={money(values.insurancePerPeriod ?? 0)} />
            <Row label="Total" value={money(installment)} strong underline />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Row label="Insurance" value={money(values.insuranceAmount ?? 0)} underline />
        <Row label="Initial savings" value={money(values.initialSavings ?? 0)} underline />
        <div className="border-t border-slate-200 pt-2">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Disposition of loan proceeds
          </div>
          <div className="space-y-1.5">
            <Row label="Membership fee" value={money(values.membershipFee ?? 0)} />
            <Row label="Processing fee" value={money(values.processingFee ?? 0)} />
            <Row label="Loan redemption fee" value={money(values.loanRedemptionFee ?? 0)} />
            <Row label="Taxes" value={money(values.taxes ?? 0)} />
            <Row label="Notarial fee" value={money(values.notarialFee ?? 0)} />
            <Row label="Raffle" value={money(values.raffle ?? 0)} />
            <Row label="Total deduction" value={money(deductions)} strong />
            <Row label="Net loan proceeds" value={money(net)} strong underline />
          </div>
        </div>
      </div>
    </div>
  )
}

export const emptyLoanCharges = {
  insuranceAmount: 0,
  initialSavings: 0,
  savingsPerPeriod: 0,
  insurancePerPeriod: 5,
  membershipFee: 0,
  processingFee: 0,
  loanRedemptionFee: 0,
  taxes: 0,
  notarialFee: 0,
  raffle: 0,
}

export function chargesFromProduct(p: {
  insuranceAmount?: number
  initialSavings?: number
  savingsPerPeriod?: number
  insurancePerPeriod?: number
  membershipFee?: number
  processingFee?: number
  loanRedemptionFee?: number
  taxes?: number
  notarialFee?: number
  raffle?: number
}) {
  return {
    insuranceAmount: p.insuranceAmount ?? 0,
    initialSavings: p.initialSavings ?? 0,
    savingsPerPeriod: p.savingsPerPeriod ?? 0,
    insurancePerPeriod: p.insurancePerPeriod ?? 0,
    membershipFee: p.membershipFee ?? 0,
    processingFee: p.processingFee ?? 0,
    loanRedemptionFee: p.loanRedemptionFee ?? 0,
    taxes: p.taxes ?? 0,
    notarialFee: p.notarialFee ?? 0,
    raffle: p.raffle ?? 0,
  }
}

export function chargeStringsFrom(p: Parameters<typeof chargesFromProduct>[0]) {
  const n = chargesFromProduct(p)
  return {
    insuranceAmount: String(n.insuranceAmount),
    initialSavings: String(n.initialSavings),
    savingsPerPeriod: String(n.savingsPerPeriod),
    insurancePerPeriod: String(n.insurancePerPeriod),
    membershipFee: String(n.membershipFee),
    processingFee: String(n.processingFee),
    loanRedemptionFee: String(n.loanRedemptionFee),
    taxes: String(n.taxes),
    notarialFee: String(n.notarialFee),
    raffle: String(n.raffle),
  }
}

export function chargePayloadFrom(form: Record<string, unknown>) {
  const n = (key: string) => Number(form[key] || 0)
  return {
    insuranceAmount: n('insuranceAmount'),
    initialSavings: n('initialSavings'),
    savingsPerPeriod: n('savingsPerPeriod'),
    insurancePerPeriod: n('insurancePerPeriod'),
    membershipFee: n('membershipFee'),
    processingFee: n('processingFee'),
    loanRedemptionFee: n('loanRedemptionFee'),
    taxes: n('taxes'),
    notarialFee: n('notarialFee'),
    raffle: n('raffle'),
  }
}

export const emptyChargeStrings = chargeStringsFrom(emptyLoanCharges)

export function LoanChargeFields<T extends Record<string, unknown>>({
  form,
  setForm,
  disabled,
}: {
  form: T
  setForm: (next: T) => void
  disabled?: boolean
}) {
  const num = (key: string, label: string) => (
    <label key={key} className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <input
        type="number"
        min={0}
        step="0.01"
        disabled={disabled}
        className="w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-50"
        value={Number(form[key] ?? 0)}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </label>
  )

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {num('insuranceAmount', 'Insurance (header)')}
        {num('initialSavings', 'Initial savings')}
        {num('savingsPerPeriod', 'Savings')}
        {num('insurancePerPeriod', 'Insurance')}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {num('membershipFee', 'Membership fee')}
        {num('processingFee', 'Processing fee')}
        {num('loanRedemptionFee', 'Loan redemption fee')}
        {num('taxes', 'Taxes')}
        {num('notarialFee', 'Notarial fee')}
        {num('raffle', 'Raffle')}
      </div>
    </div>
  )
}
