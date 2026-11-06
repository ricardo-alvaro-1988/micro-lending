import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useBranchScope, withBranchQuery } from '../branch/BranchContext'
import { LoadingBlock } from '../components/ListLoading'
import { money } from '../reports/csv'

type DashboardKpi = {
  asOf: string
  dueToday: number
  dueTodayCount: number
  collectedToday: number
  collectedTodayCount: number
  collectionVariance: number
  collectionRatePercent: number
  overdueTotal: number
  overdueCount: number
  overdueLoanCount: number
  cashToday: number
  cashTodayCount: number
  nonCashToday: number
  activeLoanCount: number
  portfolioOutstanding: number
}

type TrendPoint = {
  date: string
  due: number
  collected: number
  cash: number
  variance: number
}

type TrendResponse = {
  from: string
  to: string
  points: TrendPoint[]
}

const RANGE_OPTIONS = [
  { days: 7, label: '7d' },
  { days: 14, label: '14d' },
  { days: 30, label: '30d' },
] as const

const chartMoney = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 })

export function DashboardPage() {
  const { user, can } = useAuth()
  const { filterBranchId } = useBranchScope()
  const [kpi, setKpi] = useState<DashboardKpi | null>(null)
  const [trend, setTrend] = useState<TrendResponse | null>(null)
  const [days, setDays] = useState<7 | 14 | 30>(14)
  const [loading, setLoading] = useState(true)
  const [trendLoading, setTrendLoading] = useState(true)
  const [error, setError] = useState('')
  const [hiddenSeries, setHiddenSeries] = useState<Record<string, boolean>>({})

  const loadKpi = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setKpi(await api<DashboardKpi>(withBranchQuery('/api/dashboard/summary', filterBranchId)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard')
      setKpi(null)
    } finally {
      setLoading(false)
    }
  }, [filterBranchId])

  const loadTrend = useCallback(async () => {
    setTrendLoading(true)
    try {
      const path = withBranchQuery(`/api/dashboard/collections-trend?days=${days}`, filterBranchId)
      setTrend(await api<TrendResponse>(path))
    } catch {
      setTrend(null)
    } finally {
      setTrendLoading(false)
    }
  }, [days, filterBranchId])

  useEffect(() => {
    void loadKpi()
  }, [loadKpi])

  useEffect(() => {
    void loadTrend()
  }, [loadTrend])

  const chartData = useMemo(
    () =>
      (trend?.points ?? []).map((p) => ({
        ...p,
        label: new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      })),
    [trend],
  )

  const asOfLabel = kpi ? new Date(kpi.asOf).toLocaleDateString() : '—'

  const onLegendClick = (payload: unknown) => {
    const dataKey = (payload as { dataKey?: unknown } | null)?.dataKey
    const key = typeof dataKey === 'string' || typeof dataKey === 'number' ? String(dataKey) : ''
    if (!key) return
    setHiddenSeries((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Dashboard</h2>
          <p className="text-sm text-slate-500">
            Collections snapshot for {asOfLabel}
            {user?.branchName ? ` · ${user.branchName}` : ''}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void loadKpi()
            void loadTrend()
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading && !kpi ? (
        <div className="rounded-xl border border-slate-200 bg-white">
          <LoadingBlock label="Loading dashboard…" />
        </div>
      ) : kpi ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Due today"
              value={money(kpi.dueToday)}
              hint={`${kpi.dueTodayCount} installment(s)`}
              to={can('reports.view') ? '/reports/due-collections' : undefined}
            />
            <KpiCard
              label="Collected today"
              value={money(kpi.collectedToday)}
              hint={`${kpi.collectedTodayCount} payment(s) · ${kpi.collectionRatePercent}% of due`}
              tone={kpi.collectedToday >= kpi.dueToday && kpi.dueToday > 0 ? 'good' : undefined}
              to={can('reports.view') ? '/reports/payment-register' : undefined}
            />
            <KpiCard
              label="Variance"
              value={money(kpi.collectionVariance)}
              hint="Collected − due today"
              tone={kpi.collectionVariance < 0 ? 'bad' : kpi.collectionVariance > 0 ? 'good' : undefined}
              to={can('reports.view') ? '/reports/expected-vs-actual' : undefined}
            />
            <KpiCard
              label="Cash today"
              value={money(kpi.cashToday)}
              hint={
                kpi.nonCashToday > 0
                  ? `${kpi.cashTodayCount} cash · other ${money(kpi.nonCashToday)}`
                  : `${kpi.cashTodayCount} cash payment(s)`
              }
              to={can('reports.view') ? '/reports/payment-methods' : undefined}
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Collections trend</h3>
                <p className="text-xs text-slate-500">
                  Due vs collected by day · hover for detail · click legend to toggle
                </p>
              </div>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                {RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.days}
                    type="button"
                    onClick={() => setDays(opt.days)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                      days === opt.days
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {trendLoading && chartData.length === 0 ? (
              <LoadingBlock label="Loading chart…" />
            ) : chartData.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-500">No collection activity in this range.</div>
            ) : (
              <div className="h-72 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                      interval="preserveStartEnd"
                      minTickGap={28}
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={56}
                      tickFormatter={(v: number) => chartMoney(v)}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                            <div className="mb-1.5 font-semibold text-slate-800">{label}</div>
                            {payload.map((entry) => (
                              <div key={String(entry.dataKey)} className="flex items-center justify-between gap-6 py-0.5">
                                <span className="flex items-center gap-1.5 text-slate-600">
                                  <span
                                    className="inline-block h-2 w-2 rounded-full"
                                    style={{ background: String(entry.color) }}
                                  />
                                  {entry.name}
                                </span>
                                <span className="font-medium tabular-nums text-slate-900">
                                  {money(Number(entry.value ?? 0))}
                                </span>
                              </div>
                            ))}
                          </div>
                        )
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={28}
                      iconType="circle"
                      onClick={onLegendClick}
                      wrapperStyle={{ cursor: 'pointer', fontSize: 12 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="due"
                      name="Due"
                      stroke="#0ea5e9"
                      fill="url(#dueFill)"
                      strokeWidth={2}
                      hide={hiddenSeries.due}
                      isAnimationActive
                    />
                    <Bar
                      dataKey="collected"
                      name="Collected"
                      fill="#059669"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={28}
                      hide={hiddenSeries.collected}
                      isAnimationActive
                    />
                    <Line
                      type="monotone"
                      dataKey="cash"
                      name="Cash"
                      stroke="#d97706"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                      hide={hiddenSeries.cash}
                      isAnimationActive
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              label="Overdue"
              value={money(kpi.overdueTotal)}
              hint={`${kpi.overdueCount} installment(s) · ${kpi.overdueLoanCount} loan(s)`}
              tone={kpi.overdueTotal > 0 ? 'bad' : 'good'}
              to={can('reports.view') ? '/reports/delinquency-aging' : undefined}
            />
            <KpiCard
              label="Active loans"
              value={String(kpi.activeLoanCount)}
              hint={`Outstanding ${money(kpi.portfolioOutstanding)}`}
              to={can('reports.view') ? '/reports/portfolio-summary' : undefined}
            />
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick links</div>
              <ul className="mt-3 space-y-2 text-sm">
                {can('customers.view') && (
                  <li>
                    <Link className="text-sky-700 hover:underline" to="/transaction/customers">
                      Customers
                    </Link>
                  </li>
                )}
                {can('approvals.view') && (
                  <li>
                    <Link className="text-sky-700 hover:underline" to="/lending/approvals">
                      Approvals
                    </Link>
                  </li>
                )}
                {can('reports.view') && (
                  <li>
                    <Link className="text-sky-700 hover:underline" to="/reports">
                      All reports
                    </Link>
                  </li>
                )}
                {can('paymentSchedule.view') && (
                  <li>
                    <Link className="text-sky-700 hover:underline" to="/transaction/payment-schedule">
                      Payment schedules
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function KpiCard({
  label,
  value,
  hint,
  tone,
  to,
}: {
  label: string
  value: string
  hint: string
  tone?: 'good' | 'bad'
  to?: string
}) {
  const valueClass =
    tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-700' : 'text-slate-900'

  const body = (
    <>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</div>
      <div className="mt-1 text-sm text-slate-500">{hint}</div>
    </>
  )

  if (to) {
    return (
      <Link
        to={to}
        className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-300 hover:bg-sky-50/40"
      >
        {body}
      </Link>
    )
  }

  return <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">{body}</div>
}
