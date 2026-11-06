import { Link } from 'react-router-dom'

const reports = [
  {
    section: 'Daily operations',
    items: [
      {
        to: '/reports/due-collections',
        title: 'Daily due collections',
        blurb: 'Installments due or overdue as of a date, by agent or group.',
      },
      {
        to: '/reports/delinquency-aging',
        title: 'Delinquency aging',
        blurb: 'Overdue balances in 1–7, 8–15, 16–30, and 30+ day buckets.',
      },
      {
        to: '/reports/agent-collections',
        title: 'Agent collections',
        blurb: 'Expected schedule due vs payments collected by Agent 1.',
      },
      {
        to: '/reports/payment-register',
        title: 'Payment register',
        blurb: 'All payment postings for audit, with method and recorder.',
      },
      {
        to: '/reports/portfolio-summary',
        title: 'Portfolio summary',
        blurb: 'Active loans, outstanding balance, and overdue totals.',
      },
    ],
  },
  {
    section: 'Portfolio & collections',
    items: [
      {
        to: '/reports/loan-releases',
        title: 'Loan releases',
        blurb: 'New loans approved-final / released in a period.',
      },
      {
        to: '/reports/expected-vs-actual',
        title: 'Expected vs actual',
        blurb: 'Daily schedule due compared with payments received.',
      },
      {
        to: '/reports/par',
        title: 'Portfolio at Risk (PAR)',
        blurb: 'PAR 1 / 7 / 30 outstanding and ratios.',
      },
      {
        to: '/reports/closed-loans',
        title: 'Closed / matured loans',
        blurb: 'Closed or fully paid loans in the period.',
      },
      {
        to: '/reports/group-collection-sheet',
        title: 'Group collection sheet',
        blurb: 'Printable due list organized by cluster / group.',
      },
      {
        to: '/reports/statements',
        title: 'Statements export',
        blurb: 'Bulk statement lines across customers for CSV export.',
      },
    ],
  },
  {
    section: 'Management & compliance',
    items: [
      {
        to: '/reports/interest-income',
        title: 'Interest income',
        blurb: 'Accrued schedule interest vs pro-rata collected.',
      },
      {
        to: '/reports/approval-tat',
        title: 'Approval pipeline / TAT',
        blurb: 'Hours from request to decision by stage.',
      },
      {
        to: '/reports/rejected-applications',
        title: 'Rejected applications',
        blurb: 'Declined / rejected loans with stage and comments.',
      },
      {
        to: '/reports/customer-assignments',
        title: 'Customer assignments',
        blurb: 'Master list with branch, group, and agents.',
      },
      {
        to: '/reports/field-notes-log',
        title: 'Field notes log',
        blurb: 'Visit notes and attachment counts by author.',
      },
      {
        to: '/reports/payment-methods',
        title: 'Payment methods',
        blurb: 'Cash vs other methods — counts and totals.',
      },
    ],
  },
]

export function ReportsHomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Reports</h1>
        <p className="mt-1 text-sm text-slate-500">
          Collection and portfolio reports for office staff. Branch filter in the header applies where relevant.
        </p>
      </div>
      {reports.map((section) => (
        <div key={section.section} className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{section.section}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {section.items.map((r) => (
              <Link
                key={r.to}
                to={r.to}
                className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-sky-300 hover:bg-sky-50/40"
              >
                <div className="text-sm font-semibold text-slate-900">{r.title}</div>
                <p className="mt-1 text-sm text-slate-500">{r.blurb}</p>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
