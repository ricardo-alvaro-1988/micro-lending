import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client'
import { withBranchQuery } from '../../branch/BranchContext'
import { ActionButton } from '../../components/ActionButton'
import { todayIso } from '../../lib/phDate'
import { downloadCsv, money } from '../../reports/csv'
import { FilterField, ReportChrome, filterClass } from './ReportChrome'
import { useReportFilters } from './useReportFilters'

type DayRow = {
  date: string
  remitted: number
  injectedFunds: number
  disbursement: number
  expenses: number
  savings: number
  netChange: number
}

type Result = {
  from: string
  to: string
  branchId?: number | null
  branchName?: string | null
  beginningBalance: number
  beginningBalanceIsSet: boolean
  remitted: number
  remittanceCount: number
  injectedFunds: number
  injectedFundsCount: number
  disbursement: number
  disbursementCount: number
  expenses: number
  expenseCount: number
  cashOnHand: number
  savings: number
  primarySavings: number
  extraSavings: number
  savingsLoanCount: number
  cashAvailable: number
  days: DayRow[]
}

export function CashflowReportPage() {
  const { filterBranchId } = useReportFilters()
  const [mode, setMode] = useState<'date' | 'range'>('date')
  const [asOf, setAsOf] = useState(todayIso())
  const [from, setFrom] = useState(todayIso())
  const [to, setTo] = useState(todayIso())
  const [data, setData] = useState<Result | null>(null)
  const [beginningDate, setBeginningDate] = useState(todayIso())
  const [beginningAmount, setBeginningAmount] = useState('')
  const [injectDate, setInjectDate] = useState(todayIso())
  const [injectAmount, setInjectAmount] = useState('')
  const [injectNotes, setInjectNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingBeginning, setSavingBeginning] = useState(false)
  const [savingInject, setSavingInject] = useState(false)
  const [error, setError] = useState('')

  const rangeFrom = mode === 'date' ? asOf : from
  const rangeTo = mode === 'date' ? asOf : to

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ from: rangeFrom, to: rangeTo })
      const res = await api<Result>(withBranchQuery(`/api/reports/cashflow?${qs}`, filterBranchId))
      setData(res)
      setBeginningDate(rangeFrom)
      setBeginningAmount(String(res.beginningBalance))
      setInjectDate(rangeFrom)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [rangeFrom, rangeTo, filterBranchId])

  useEffect(() => {
    void load()
  }, [load])

  const saveBeginning = async () => {
    const amount = Number(beginningAmount)
    if (!beginningDate) {
      setError('Beginning balance date is required.')
      return
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Beginning balance must be zero or greater.')
      return
    }
    setSavingBeginning(true)
    setError('')
    try {
      await api(withBranchQuery('/api/reports/cashflow/beginning-balance', filterBranchId), {
        method: 'PUT',
        body: JSON.stringify({ asOfDate: beginningDate, amount }),
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save beginning balance')
    } finally {
      setSavingBeginning(false)
    }
  }

  const saveInject = async () => {
    const amount = Number(injectAmount)
    if (!injectDate) {
      setError('Inject fund date is required.')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Injected amount must be greater than zero.')
      return
    }
    setSavingInject(true)
    setError('')
    try {
      await api(withBranchQuery('/api/reports/cashflow/inject-fund', filterBranchId), {
        method: 'POST',
        body: JSON.stringify({
          injectionDate: injectDate,
          amount,
          notes: injectNotes.trim() || null,
        }),
      })
      setInjectAmount('')
      setInjectNotes('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to inject funds')
    } finally {
      setSavingInject(false)
    }
  }

  const periodLabel = rangeFrom === rangeTo ? rangeFrom : `${rangeFrom} → ${rangeTo}`

  return (
    <ReportChrome
      title="Cashflow report"
      description="Beginning + Remitted + Injected − Disbursement − Expenses − Savings (Primary + Extra) = Cash on hand."
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      onExport={() => {
        if (!data) return
        downloadCsv(
          `cashflow-${rangeFrom}_${rangeTo}.csv`,
          ['Line', 'Amount', 'Count / note'],
          [
            ['Beginning balance', data.beginningBalance, data.beginningBalanceIsSet ? 'Saved' : 'Not set (0)'],
            ['Remitted (+)', data.remitted, data.remittanceCount],
            ['Injected funds (+)', data.injectedFunds, data.injectedFundsCount],
            ['Disbursement (−)', data.disbursement, data.disbursementCount],
            ['Expenses (−)', data.expenses, data.expenseCount],
            [
              'Savings (−)',
              data.savings,
              `Primary ${data.primarySavings}; Extra ${data.extraSavings}; ${data.savingsLoanCount} loan(s)`,
            ],
            ['Cash on hand', data.cashAvailable, 'After Savings (Primary + Extra)'],
            ...data.days.map((d) => [
              d.date.slice(0, 10),
              d.netChange,
              `Remitted ${d.remitted}; Injected ${d.injectedFunds}; Disb ${d.disbursement}; Exp ${d.expenses}; Sav ${d.savings}`,
            ]),
          ],
        )
      }}
      filters={
        <div className="flex flex-wrap gap-3">
          <FilterField label="Filter mode">
            <select
              className={filterClass}
              value={mode}
              onChange={(e) => setMode(e.target.value === 'range' ? 'range' : 'date')}
            >
              <option value="date">By date</option>
              <option value="range">By range</option>
            </select>
          </FilterField>
          {mode === 'date' ? (
            <FilterField label="Date">
              <input className={filterClass} type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
            </FilterField>
          ) : (
            <>
              <FilterField label="From">
                <input className={filterClass} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </FilterField>
              <FilterField label="To">
                <input className={filterClass} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </FilterField>
            </>
          )}
        </div>
      }
    >
      <div className="cashflow-print-root space-y-6 p-4 print:p-0">
        <div className="hidden print:block print:mb-3">
          <h1 className="text-center text-base font-bold uppercase tracking-wide">Cashflow report</h1>
          <p className="text-center text-[11px] text-slate-600">
            {periodLabel}
            {data?.branchName ? ` · ${data.branchName}` : ''}
          </p>
        </div>

        <div className="grid gap-4 print:hidden lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-800">Beginning balance</h3>
            <p className="mt-0.5 text-xs text-slate-500">Date, then amount only.</p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="flex min-w-[10rem] flex-col gap-1 text-xs font-medium text-slate-600">
                Date
                <input
                  type="date"
                  className={filterClass}
                  value={beginningDate}
                  onChange={(e) => setBeginningDate(e.target.value)}
                />
              </label>
              <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
                Amount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={filterClass}
                  value={beginningAmount}
                  onChange={(e) => setBeginningAmount(e.target.value)}
                />
              </label>
              <ActionButton
                type="button"
                loading={savingBeginning}
                loadingText="Saving…"
                onClick={() => void saveBeginning()}
              >
                Save
              </ActionButton>
            </div>
            {data && !data.beginningBalanceIsSet && beginningDate === rangeFrom && (
              <p className="mt-2 text-xs text-amber-700">Not set for this report date — treated as 0.</p>
            )}
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
            <h3 className="text-sm font-semibold text-emerald-950">Inject fund</h3>
            <p className="mt-0.5 text-xs text-emerald-800/80">Adds cash into office float for the chosen date.</p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="flex min-w-[10rem] flex-col gap-1 text-xs font-medium text-emerald-900">
                Date
                <input
                  type="date"
                  className={filterClass}
                  value={injectDate}
                  onChange={(e) => setInjectDate(e.target.value)}
                />
              </label>
              <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs font-medium text-emerald-900">
                Amount
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className={filterClass}
                  value={injectAmount}
                  onChange={(e) => setInjectAmount(e.target.value)}
                  placeholder="0.00"
                />
              </label>
              <ActionButton
                type="button"
                loading={savingInject}
                loadingText="Saving…"
                onClick={() => void saveInject()}
              >
                Inject
              </ActionButton>
            </div>
            <label className="mt-3 flex flex-col gap-1 text-xs font-medium text-emerald-900">
              Notes (optional)
              <input
                className={filterClass}
                value={injectNotes}
                onChange={(e) => setInjectNotes(e.target.value)}
                placeholder="e.g. HQ top-up"
              />
            </label>
          </div>
        </div>

        {data && (
          <>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-700">Beginning balance</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(data.beginningBalance)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">+</td>
                  </tr>
                  <tr className="border-b border-slate-100 bg-violet-50/40">
                    <td className="px-4 py-3 font-medium text-violet-900">
                      Remitted
                      <div className="text-xs font-normal text-violet-700/80">
                        {data.remittanceCount} slip{data.remittanceCount === 1 ? '' : 's'} turned in · gross cash (includes
                        savings)
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-violet-900">
                      {money(data.remitted)}
                    </td>
                    <td className="px-4 py-3 text-xs text-violet-700">+</td>
                  </tr>
                  <tr className="border-b border-slate-100 bg-emerald-50/50">
                    <td className="px-4 py-3 font-medium text-emerald-950">
                      Injected funds
                      <div className="text-xs font-normal text-emerald-800/80">
                        {data.injectedFundsCount} injection{data.injectedFundsCount === 1 ? '' : 's'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-emerald-950">
                      {money(data.injectedFunds)}
                    </td>
                    <td className="px-4 py-3 text-xs text-emerald-800">+</td>
                  </tr>
                  <tr className="border-b border-slate-100 bg-sky-50/40">
                    <td className="px-4 py-3 font-medium text-sky-900">
                      Disbursement
                      <div className="text-xs font-normal text-sky-700/80">
                        {data.disbursementCount} loan release{data.disbursementCount === 1 ? '' : 's'} (net
                        proceeds)
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-sky-900">
                      {money(data.disbursement)}
                    </td>
                    <td className="px-4 py-3 text-xs text-sky-700">−</td>
                  </tr>
                  <tr className="border-b border-slate-100 bg-rose-50/40">
                    <td className="px-4 py-3 font-medium text-rose-900">
                      Expenses
                      <div className="text-xs font-normal text-rose-700/80">
                        {data.expenseCount} entr{data.expenseCount === 1 ? 'y' : 'ies'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-rose-900">
                      {money(data.expenses)}
                    </td>
                    <td className="px-4 py-3 text-xs text-rose-700">−</td>
                  </tr>
                  <tr className="border-b border-slate-100 bg-amber-50/50">
                    <td className="px-4 py-3 font-medium text-amber-950">
                      Savings
                      <div className="text-xs font-normal text-amber-800/80">
                        Primary {money(data.primarySavings)} + Extra {money(data.extraSavings)}
                        {data.savingsLoanCount > 0
                          ? ` · ${data.savingsLoanCount} loan${data.savingsLoanCount === 1 ? '' : 's'}`
                          : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-amber-950">
                      {money(data.savings)}
                    </td>
                    <td className="px-4 py-3 text-xs text-amber-800">−</td>
                  </tr>
                  <tr className="bg-emerald-50">
                    <td className="px-4 py-4 text-base font-semibold text-emerald-900">Cash on hand</td>
                    <td className="px-4 py-4 text-right text-xl font-semibold tabular-nums text-emerald-900">
                      {money(data.cashAvailable)}
                    </td>
                    <td className="px-4 py-4 text-xs font-semibold text-emerald-800">=</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-xs text-slate-500 print:hidden">
              Formula: Beginning + Remitted + Injected − Disbursement − Expenses − Savings (Primary + Extra) = Cash on
              hand.
            </p>

            {data.days.length > 0 && rangeFrom !== rangeTo && (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-800">Daily movement</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="border border-slate-200 px-3 py-2">Date</th>
                        <th className="border border-slate-200 px-3 py-2 text-right">Remitted</th>
                        <th className="border border-slate-200 px-3 py-2 text-right">Injected</th>
                        <th className="border border-slate-200 px-3 py-2 text-right">Disbursement</th>
                        <th className="border border-slate-200 px-3 py-2 text-right">Expenses</th>
                        <th className="border border-slate-200 px-3 py-2 text-right">Savings</th>
                        <th className="border border-slate-200 px-3 py-2 text-right">Net change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.days.map((d) => (
                        <tr key={d.date} className="break-inside-avoid">
                          <td className="border border-slate-200 px-3 py-2 whitespace-nowrap">
                            {d.date.slice(0, 10)}
                          </td>
                          <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">
                            {money(d.remitted)}
                          </td>
                          <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">
                            {money(d.injectedFunds)}
                          </td>
                          <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">
                            {money(d.disbursement)}
                          </td>
                          <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">
                            {money(d.expenses)}
                          </td>
                          <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">
                            {money(d.savings)}
                          </td>
                          <td className="border border-slate-200 px-3 py-2 text-right tabular-nums font-medium">
                            {money(d.netChange)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </ReportChrome>
  )
}
