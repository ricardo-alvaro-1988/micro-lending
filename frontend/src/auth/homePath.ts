import type { AuthUser } from '../types'

export function isFieldAgent(user: AuthUser | null | undefined) {
  if (!user) return false
  if (user.isAdmin) return false
  return user.role === 'Field Agent' || !!user.permissions?.includes('field.collect')
}

export function homePathFor(user: AuthUser | null | undefined) {
  return isFieldAgent(user) ? '/field' : '/dashboard'
}
