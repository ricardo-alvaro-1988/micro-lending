/** Philippine business calendar (Asia/Manila, UTC+8). */

const PH_TZ = 'Asia/Manila'

/** Today's date in the Philippines as YYYY-MM-DD (for date inputs / API filters). */
export function todayIso(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PH_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** Philippine calendar date N months before today (YYYY-MM-DD). */
export function monthsAgoIso(months: number, date = new Date()): string {
  const [y, m, d] = todayIso(date).split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1 - months, d))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

/** Philippine calendar date N days before today (YYYY-MM-DD). */
export function daysAgoIso(days: number, date = new Date()): string {
  const [y, m, d] = todayIso(date).split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d - days))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

/** Format an instant for display in Philippine local time. */
export function formatPhDateTime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-PH', { timeZone: PH_TZ })
}

/** Format an instant as a Philippine calendar date. */
export function formatPhDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-PH', { timeZone: PH_TZ })
}
