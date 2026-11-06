const API_BASE = import.meta.env.VITE_API_URL ?? ''

function getToken() {
  return localStorage.getItem('ml_token')
}

function parseBody(text: string): unknown {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function errorFromResponse(status: number, data: unknown, text: string): Error {
  const body = data as {
    message?: string
    title?: string
    errors?: Record<string, string[] | string>
  } | null

  if (body?.message) return new Error(body.message)

  if (body?.errors) {
    const first = Object.values(body.errors).flat()[0]
    if (first) return new Error(String(first))
  }

  if (body?.title) return new Error(body.title)

  if (status === 401) return new Error('Session expired or not logged in. Please log in again.')
  if (status === 403) return new Error('You do not have permission for this action.')
  if (status === 404) return new Error('Record not found.')
  if (status === 0 || status === 502 || status === 503 || status === 504) {
    return new Error('API is unreachable. Start the backend and try again.')
  }

  if (!text) return new Error(`Request failed (${status})`)
  return new Error(`Request failed (${status})`)
}

async function readResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T
  const text = await res.text()
  const data = parseBody(text)
  if (!res.ok) throw errorFromResponse(res.status, data, text)
  return data as T
}

const DEFAULT_TIMEOUT_MS = 20000

function withTimeoutSignal(existing: AbortSignal | null | undefined, ms: number) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), ms)
  const onAbort = () => controller.abort()
  existing?.addEventListener('abort', onAbort)
  const cleanup = () => {
    window.clearTimeout(timer)
    existing?.removeEventListener('abort', onAbort)
  }
  return { signal: controller.signal, cleanup }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const { signal, cleanup } = withTimeoutSignal(options.signal ?? null, DEFAULT_TIMEOUT_MS)
  try {
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers, signal })
    return await readResponse<T>(res)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out. Check that the API is running and try again.')
    }
    if (err instanceof Error && err.message.includes('API is unreachable')) throw err
    if (err instanceof TypeError) {
      throw new Error('API is unreachable. Start the backend and try again.')
    }
    throw err
  } finally {
    cleanup()
  }
}

export async function apiForm<T>(path: string, formData: FormData, method = 'POST'): Promise<T> {
  const headers = new Headers()
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const { signal, cleanup } = withTimeoutSignal(null, DEFAULT_TIMEOUT_MS)
  try {
    const res = await fetch(`${API_BASE}${path}`, { method, headers, body: formData, signal })
    return await readResponse<T>(res)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out. Check that the API is running and try again.')
    }
    if (err instanceof Error && err.message.includes('API is unreachable')) throw err
    if (err instanceof TypeError) {
      throw new Error('API is unreachable. Start the backend and try again.')
    }
    throw err
  } finally {
    cleanup()
  }
}
