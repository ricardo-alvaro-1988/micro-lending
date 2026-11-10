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
import { useToast } from '../toast/ToastContext'

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

const AUTO_REFRESH_MS = 60_000

const chartMoney = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 })

function greetingFor(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function useNow(tickMs = 30_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), tickMs)
    return () => window.clearInterval(id)
  }, [tickMs])
  return now
}

function useCountUp(target: number, active: boolean, durationMs = 900) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!active) {
      setValue(target)
      return
    }
    let frame = 0
    const start = performance.now()
    const from = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(from + (target - from) * eased)
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, active, durationMs])
  return value
}

function relativeFreshness(lastAt: number, nowMs: number) {
  const sec = Math.max(0, Math.floor((nowMs - lastAt) / 1000))
  if (sec < 8) return 'Just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  return `${min}m ago`
}

export function DashboardPage() {
  const { user, can } = useAuth()
  const { filterBranchId } = useBranchScope()
  const now = useNow(15_000)
  const [kpi, setKpi] = useState<DashboardKpi | null>(null)
  const [trend, setTrend] = useState<TrendResponse | null>(null)
  const [days, setDays] = useState<7 | 14 | 30>(14)
  const [loading, setLoading] = useState(true)
  const [trendLoading, setTrendLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshAt, setLastRefreshAt] = useState(() => Date.now())
  const toast = useToast()
  const [hiddenSeries, setHiddenSeries] = useState<Record<string, boolean>>({})

  const loadKpi = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      setKpi(await api<DashboardKpi>(withBranchQuery('/api/dashboard/summary', filterBranchId)))
      setLastRefreshAt(Date.now())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load dashboard')
      if (!silent) setKpi(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
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

  useEffect(() => {
    const id = window.setInterval(() => {
      void loadKpi(true)
      void loadTrend()
    }, AUTO_REFRESH_MS)
    return () => window.clearInterval(id)
  }, [loadKpi, loadTrend])

  const chartData = useMemo(
    () =>
      (trend?.points ?? []).map((p) => ({
        ...p,
        label: new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      })),
    [trend],
  )

  const asOfLabel = kpi ? new Date(kpi.asOf).toLocaleDateString() : '—'
  const greet = greetingFor(now.getHours())
  const clock = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const firstName = user?.fullName?.trim().split(/\s+/)[0] ?? 'there'
  const rate = Math.max(0, Math.min(100, kpi?.collectionRatePercent ?? 0))
  const freshness = relativeFreshness(lastRefreshAt, now.getTime())

  const onLegendClick = (payload: unknown) => {
    const dataKey = (payload as { dataKey?: unknown } | null)?.dataKey
    const key = typeof dataKey === 'string' || typeof dataKey === 'number' ? String(dataKey) : ''
    if (!key) return
    setHiddenSeries((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const refreshAll = () => {
    void loadKpi(true)
    void loadTrend()
  }

  return (
    <div className="dash-page space-y-6">
      <section className="dash-hero px-5 py-6 sm:px-7 sm:py-7">
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0 max-w-xl">
            <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-medium tracking-wide text-sky-100/90">
              <span className="dash-live-dot inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Live · {freshness}
              {refreshing ? ' · updating' : ''}
            </div>
            <h2 className="cust-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {greet}, {firstName}
            </h2>
            <p className="mt-2 text-sm text-sky-100/80">
              Collections pulse for {asOfLabel}
              {user?.branchName ? ` · ${user.branchName}` : ''} · {clock}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {kpi && (
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-100/70">
                  Collection rate
                </div>
                <div className="mt-1 flex items-end gap-3">
                  <div className="cust-display text-3xl font-semibold tabular-nums text-white">
                    {Math.round(rate)}%
                  </div>
                  <div className="mb-1.5 h-1.5 w-28 overflow-hidden rounded-full bg-white/15">
                    <div
                      className={`dash-rate-fill h-full rounded-full ${
                        rate >= 100 ? 'bg-emerald-400' : rate >= 60 ? 'bg-sky-300' : 'bg-amber-300'
                      }`}
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={refreshAll}
              disabled={refreshing}
              className="rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-white/20 disabled:opacity-60"
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
        <div className="dash-shimmer-line relative z-10 mt-5 h-px w-full opacity-40" />
      </section>

      {loading && !kpi ? (
        <div className="rounded-xl border border-slate-200 bg-white">
          <LoadingBlock label="Loading dashboard…" />
        </div>
      ) : kpi ? (
        <>
          <div className="dash-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Due today"
              value={kpi.dueToday}
              format="money"
              hint={`${kpi.dueTodayCount} installment(s)`}
              accent="sky"
              to={can('reports.view') ? '/reports/due-collections' : undefined}
            />
            <KpiCard
              label="Collected today"
              value={kpi.collectedToday}
              format="money"
              hint={`${kpi.collectedTodayCount} payment(s) · ${kpi.collectionRatePercent}% of due`}
              tone={kpi.collectedToday >= kpi.dueToday && kpi.dueToday > 0 ? 'good' : undefined}
              accent="teal"
              to={can('reports.view') ? '/reports/payment-register' : undefined}
            />
            <KpiCard
              label="Variance"
              value={kpi.collectionVariance}
              format="money"
              hint="Collected − due today"
              tone={kpi.collectionVariance < 0 ? 'bad' : kpi.collectionVariance > 0 ? 'good' : undefined}
              accent="amber"
              to={can('reports.view') ? '/reports/expected-vs-actual' : undefined}
            />
            <KpiCard
              label="Cash today"
              value={kpi.cashToday}
              format="money"
              hint={
                kpi.nonCashToday > 0
                  ? `${kpi.cashTodayCount} cash · other ${money(kpi.nonCashToday)}`
                  : `${kpi.cashTodayCount} cash payment(s)`
              }
              accent="navy"
              to={can('reports.view') ? '/reports/payment-methods' : undefined}
            />
          </div>

          <div className="dash-stagger overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-sky-50/40 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Collections trend</h3>
                  <p className="text-xs text-slate-500">
                    Due vs collected by day · hover for detail · click legend to toggle
                  </p>
                </div>
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
                  {RANGE_OPTIONS.map((opt) => (
                    <button
                      key={opt.days}
                      type="button"
                      onClick={() => setDays(opt.days)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                        days === opt.days
                          ? 'bg-[#0f2744] text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5">
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
                          <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.4} />
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
                            <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
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
                        animationDuration={900}
                      />
                      <Bar
                        dataKey="collected"
                        name="Collected"
                        fill="#059669"
                        radius={[3, 3, 0, 0]}
                        maxBarSize={28}
                        hide={hiddenSeries.collected}
                        isAnimationActive
                        animationDuration={900}
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
                        animationDuration={900}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="dash-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              label="Overdue"
              value={kpi.overdueTotal}
              format="money"
              hint={`${kpi.overdueCount} installment(s) · ${kpi.overdueLoanCount} loan(s)`}
              tone={kpi.overdueTotal > 0 ? 'bad' : 'good'}
              accent="rose"
              to={can('reports.view') ? '/reports/delinquency-aging' : undefined}
            />
            <KpiCard
              label="Active loans"
              value={kpi.activeLoanCount}
              format="int"
              hint={`Outstanding ${money(kpi.portfolioOutstanding)}`}
              accent="navy"
              to={can('reports.view') ? '/reports/portfolio-summary' : undefined}
            />
            <div className="dash-kpi rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Jump in</div>
              <ul className="mt-3 space-y-1.5 text-sm">
                <QuickLink to="/lending/how-to-apply" label="How to apply a loan" />
                {can('customers.view') && <QuickLink to="/transaction/customers" label="Customers" />}
                {can('approvals.view') && <QuickLink to="/lending/approvals" label="Approvals" />}
                {can('reports.view') && <QuickLink to="/reports" label="All reports" />}
                {can('paymentSchedule.view') && (
                  <QuickLink to="/transaction/payment-schedule" label="Payment schedules" />
                )}
              </ul>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <li>
      <Link
        to={to}
        className="group flex items-center justify-between rounded-lg px-2 py-2 text-slate-700 transition hover:bg-sky-50 hover:text-sky-800"
      >
        <span>{label}</span>
        <span className="translate-x-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-sky-500">
          →
        </span>
      </Link>
    </li>
  )
}

function KpiCard({
  label,
  value,
  format,
  hint,
  tone,
  accent = 'sky',
  to,
}: {
  label: string
  value: number
  format: 'money' | 'int'
  hint: string
  tone?: 'good' | 'bad'
  accent?: 'sky' | 'teal' | 'amber' | 'navy' | 'rose'
  to?: string
}) {
  const animated = useCountUp(value, true)
  const display =
    format === 'money'
      ? money(animated)
      : Math.round(animated).toLocaleString()

  const valueClass =
    tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-700' : 'text-slate-900'

  const accentBar =
    accent === 'teal'
      ? 'from-teal-400 to-emerald-500'
      : accent === 'amber'
        ? 'from-amber-400 to-orange-500'
        : accent === 'navy'
          ? 'from-sky-700 to-[#0f2744]'
          : accent === 'rose'
            ? 'from-rose-400 to-red-500'
            : 'from-sky-400 to-cyan-500'

  const body = (
    <>
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accentBar}`} />
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight ${valueClass}`}>{display}</div>
      <div className="mt-1 text-sm text-slate-500">{hint}</div>
    </>
  )

  const className =
    'dash-kpi relative block overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'

  if (to) {
    return (
      <Link to={to} className={`${className} hover:border-sky-300`}>
        {body}
      </Link>
    )
  }

  return <div className={className}>{body}</div>
}
