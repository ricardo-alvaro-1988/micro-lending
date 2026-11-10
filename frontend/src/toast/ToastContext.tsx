import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export type ToastTone = 'success' | 'error' | 'warning' | 'info'

type ToastItem = {
  id: number
  tone: ToastTone
  message: string
}

type ToastApi = {
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
  info: (message: string) => void
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const MAX_VISIBLE = 4
const DURATION_MS: Record<ToastTone, number> = {
  success: 3500,
  info: 4000,
  warning: 4500,
  error: 5000,
}

const toneClass: Record<ToastTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-rose-200 bg-rose-50 text-rose-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  info: 'border-sky-200 bg-sky-50 text-sky-950',
}

const toneLabel: Record<ToastTone, string> = {
  success: 'Success',
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const timers = useRef<Map<number, number>>(new Map())
  const seq = useRef(1)

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer) {
      window.clearTimeout(timer)
      timers.current.delete(id)
    }
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const text = message.trim()
      if (!text) return
      const id = seq.current++
      setItems((prev) => {
        const next = [{ id, tone, message: text }, ...prev]
        return next.slice(0, MAX_VISIBLE)
      })
      const timer = window.setTimeout(() => dismiss(id), DURATION_MS[tone])
      timers.current.set(id, timer)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      warning: (message) => push('warning', message),
      info: (message) => push('info', message),
      dismiss,
    }),
    [push, dismiss],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed right-4 top-4 z-[70] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
        aria-live="polite"
        aria-relevant="additions"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-3.5 py-3 text-sm shadow-lg ${toneClass[item.tone]}`}
            role={item.tone === 'error' ? 'alert' : 'status'}
          >
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
                {toneLabel[item.tone]}
              </div>
              <div className="mt-0.5 whitespace-pre-wrap break-words">{item.message}</div>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium opacity-70 hover:bg-black/5 hover:opacity-100"
              aria-label="Dismiss"
              onClick={() => dismiss(item.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
