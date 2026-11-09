import { useEffect, useState } from 'react'

type Props = {
  customerId?: number | null
  hasPicture?: boolean | null
  name: string
  className?: string
  textClassName?: string
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function CustomerAvatar({
  customerId,
  hasPicture,
  name,
  className = 'h-10 w-10 rounded-xl text-xs',
  textClassName = 'bg-[#0f2744] text-sky-100',
}: Props) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false

    const load = async () => {
      setSrc(null)
      if (!customerId || !hasPicture) return
      const token = localStorage.getItem('ml_token')
      try {
        const res = await fetch(`/api/customers/${customerId}/profile-picture`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!res.ok || cancelled) return
        const blob = await res.blob()
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setSrc(objectUrl)
      } catch {
        if (!cancelled) setSrc(null)
      }
    }

    void load()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [customerId, hasPicture])

  if (src) {
    return <img src={src} alt={name} className={`${className} object-cover`} />
  }

  return (
    <span className={`inline-flex shrink-0 items-center justify-center font-bold tracking-wide ${className} ${textClassName}`}>
      {initials(name)}
    </span>
  )
}
