import { useState, type InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: string
}

export function PasswordInput({ label, className = '', ...props }: Props) {
  const [visible, setVisible] = useState(false)

  return (
    <label className="block text-sm">
      {label && <span className="mb-1 block text-slate-600">{label}</span>}
      <div className="relative">
        <input
          {...props}
          type={visible ? 'text' : 'password'}
          className={`w-full rounded-md border border-slate-300 px-3 py-2 pr-10 outline-none focus:border-sky-500 ${className}`}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={visible ? 'Hide password' : 'Show password'}
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 hover:text-slate-800"
        >
          {visible ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
              <path d="M3 3l18 18" />
              <path d="M10.6 10.6a2 2 0 002.8 2.8" />
              <path d="M9.9 5.1A9.8 9.8 0 0112 5c5 0 9.3 3.1 11 7.5a11.5 11.5 0 01-4.2 5.1" />
              <path d="M6.1 6.1A11.5 11.5 0 001 12.5C2.7 16.9 7 20 12 20a9.8 9.8 0 005.1-1.4" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
              <path d="M1 12.5C2.7 8.1 7 5 12 5s9.3 3.1 11 7.5c-1.7 4.4-6 7.5-11 7.5S2.7 16.9 1 12.5z" />
              <circle cx="12" cy="12.5" r="3" />
            </svg>
          )}
        </button>
      </div>
    </label>
  )
}
